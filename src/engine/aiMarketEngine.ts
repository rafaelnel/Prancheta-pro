import { getRealSquadForClub } from '../data/initialDatabase';
import { FORMATIONS } from '../data/tacticsData';
import { calculatePlayerOverall } from './playerOverall';
import {
  assignPotentialStars,
  calculateBalancedValuationAndWage,
  calculateDynamicSponsorship,
  calculateMatchGateRevenue,
  calculateOperationalCost,
} from './economyAndEvolution';
import {
  MIN_GOALKEEPERS,
  MIN_SQUAD_SIZE,
  REALISTIC_BUY_OFFER_MIN_RATIO,
  REALISTIC_LOAN_COUNTER_MAX_RATIO,
  clampTransferFeeToMarketCorridor,
  getDynamicFeeStep,
  isTransferWindowOpen,
} from './transferEngine';
import { formatCalendarDate, formatCompactBRL } from '../utils/formatters';
import {
  Club,
  InboxMessage,
  IncomingTransferOffer,
  NaturalPosition,
  Player,
  PositionSector,
  TransferRecord,
} from '../types/football';

export interface AiClubMarketProfile {
  clubId: string;
  clubShortName: string;
  posture:
    | 'COMPRADOR'
    | 'EQUILIBRADO'
    | 'VENDEDOR_ALIVIO_FOLHA'
    | 'BUSCA_EMPRESTIMOS';
  postureLabel: string;
  preferredIncomingMode: 'COMPRA' | 'EMPRESTIMO' | 'AMBOS';
  neededPositions: NaturalPosition[];
  neededSectors: PositionSector[];
  transferListedCount: number;
  loanListedCount: number;
  wageUsagePct: number;
  targetStarterOvr: number;
  summaryText: string;
}

export interface ClubTransferFinancialHealth {
  cashBalance: number;
  estimatedAnnualNetIncome: number;
  estimatedMonthlyNetIncome: number;
  currentMonthlyPayroll: number;
  projectedMonthlyPayroll: number;
  monthlyNetCashflow: number;
  minHealthyCashReserve: number;
  maxHealthySingleDealFee: number;
  hasCashInHand: boolean;
  withinHealthyFeeCap: boolean;
  payrollHealthy: boolean;
  canAffordAndHealthy: boolean;
  reason?: string;
}

const ESTIMATED_ANNUAL_PRIZE_AND_TV_BY_DIVISION: Record<Club['division'], number> = {
  B: 2_000_000,
  A: 32_000_000,
  LIB: 38_000_000,
  LALIGA: 135_000_000,
  PL: 220_000_000,
  UCL: 380_000_000,
  WORLD: 180_000_000,
};

/**
 * Avalia se uma proposta de compra ou empréstimo é financeiramente coerente e saudável
 * para o clube proponente, considerando:
 * 1. Dinheiro real em caixa (nunca pode propor valor acima do cashBalance ou estando em dívida);
 * 2. Receita anual líquida real (patrocínio + bilheteria menos 30% de custo operacional + premiações/TV);
 * 3. Reserva operacional mínima em caixa após a operação (mín. 2,5 meses de folha projetada);
 * 4. Solvência de fluxo de caixa nos próximos 6 meses (evita gastar o caixa necessário para cobrir déficits);
 * 5. Sustentabilidade salarial da folha projetada frente ao orçamento e à receita mensal.
 */
export function evaluateClubTransferFinancialHealth(params: {
  club: Club;
  clubSquad?: Player[];
  proposedFee: number;
  addedMonthlySalary: number;
  dealType: 'BUY' | 'LOAN';
  seasonYear?: number;
}): ClubTransferFinancialHealth {
  const {
    club,
    clubSquad,
    proposedFee,
    addedMonthlySalary,
    dealType,
    seasonYear = 2026,
  } = params;

  const avgOvr =
    clubSquad && clubSquad.length > 0
      ? Math.round(
          clubSquad.reduce(
            (sum, p) => sum + calculatePlayerOverall(p.attributes, p.position),
            0
          ) / clubSquad.length
        )
      : Math.max(66, Math.round(club.reputation - 5));

  const annualSponsor = calculateDynamicSponsorship(
    club,
    avgOvr,
    seasonYear
  ).annualValue;
  const singleHomeGate = calculateMatchGateRevenue({
    club,
    rank: 10,
    competition: 'BRASILEIRAO',
    isHome: true,
  }).gateRevenue;
  const annualGate = singleHomeGate * 19;
  const grossOperatingRevenue = annualSponsor + annualGate;
  const netOperatingRevenue =
    grossOperatingRevenue - calculateOperationalCost(grossOperatingRevenue);
  const estimatedPrizeAndTv =
    ESTIMATED_ANNUAL_PRIZE_AND_TV_BY_DIVISION[club.division] ?? 32_000_000;

  const estimatedAnnualNetIncome =
    club.division === 'WORLD'
      ? Math.max(
          netOperatingRevenue + estimatedPrizeAndTv,
          Math.round(club.wageBudget * 10)
        )
      : netOperatingRevenue + estimatedPrizeAndTv;
  const estimatedMonthlyNetIncome = Math.round(estimatedAnnualNetIncome / 12);

  const currentMonthlyPayroll =
    clubSquad && clubSquad.length > 0
      ? Math.round(
          clubSquad.reduce(
            (sum, p) => sum + p.salary * (p.wageSharePaid ?? 1),
            0
          )
        )
      : Math.round(club.wageBudget * 0.72);
  const safeAddedSalary = Math.max(0, Math.round(addedMonthlySalary));
  const projectedMonthlyPayroll = currentMonthlyPayroll + safeAddedSalary;
  const monthlyNetCashflow = estimatedMonthlyNetIncome - projectedMonthlyPayroll;

  const payrollCushion = Math.round(projectedMonthlyPayroll * 2.5);
  const proportionalFloor = Math.round(Math.max(0, club.cashBalance) * 0.25);
  const minHealthyCashReserve = Math.max(
    payrollCushion,
    Math.min(proportionalFloor, Math.round(estimatedAnnualNetIncome * 0.25))
  );

  // Solvência de 6 meses: protege o caixa necessário para atravessar déficits mensais sem endividar o clube
  const sixMonthDeficitBuffer = Math.max(0, -monthlyNetCashflow) * 6;
  const solvencyReserve =
    sixMonthDeficitBuffer + Math.round(projectedMonthlyPayroll * 1.5);
  const solvencyMaxFee = Math.max(0, club.cashBalance - solvencyReserve);

  const cashShareCap = Math.round(
    Math.max(0, club.cashBalance) * (dealType === 'LOAN' ? 0.30 : 0.60)
  );
  const incomeCoherenceCap = Math.round(
    estimatedAnnualNetIncome * (dealType === 'LOAN' ? 0.25 : 0.85)
  );
  const reserveAdjustedCap = Math.max(
    0,
    club.cashBalance - minHealthyCashReserve
  );

  const maxHealthySingleDealFee =
    club.cashBalance <= 0
      ? 0
      : Math.max(
          0,
          Math.min(
            club.cashBalance,
            reserveAdjustedCap,
            cashShareCap,
            incomeCoherenceCap,
            solvencyMaxFee
          )
        );

  const safeProposedFee = Math.max(0, Math.round(proposedFee));
  const hasCashInHand =
    club.cashBalance > 0 && safeProposedFee <= club.cashBalance;
  const withinHealthyFeeCap =
    club.cashBalance > 0 && safeProposedFee <= maxHealthySingleDealFee;

  const withinWageBudget =
    safeAddedSalary === 0 || projectedMonthlyPayroll <= club.wageBudget * 1.05;
  const singleWageCoherent =
    safeAddedSalary === 0 ||
    safeAddedSalary <=
      Math.max(
        Math.round(club.wageBudget * 0.28),
        Math.round(estimatedMonthlyNetIncome * 0.28)
      );
  const payrollHealthy = withinWageBudget && singleWageCoherent;

  let reason: string | undefined;
  if (club.cashBalance <= 0) {
    reason = 'Clube sem saldo positivo em caixa (em dívida).';
  } else if (!hasCashInHand) {
    reason = 'Valor da proposta excede o dinheiro disponível em caixa.';
  } else if (!withinHealthyFeeCap) {
    reason =
      'Operação comprometeria a reserva de caixa, a solvência ou a coerência com as receitas do clube.';
  } else if (!payrollHealthy) {
    reason =
      'Salário do atleta comprometeria a saúde financeira da folha salarial do clube.';
  }

  return {
    cashBalance: club.cashBalance,
    estimatedAnnualNetIncome,
    estimatedMonthlyNetIncome,
    currentMonthlyPayroll,
    projectedMonthlyPayroll,
    monthlyNetCashflow,
    minHealthyCashReserve,
    maxHealthySingleDealFee,
    hasCashInHand,
    withinHealthyFeeCap,
    payrollHealthy,
    canAffordAndHealthy:
      hasCashInHand && withinHealthyFeeCap && payrollHealthy,
    reason,
  };
}

/**
 * Avalia o elenco de um clube da IA (necessidades por posição/setor, folha salarial, caixa e idade)
 * e define quais jogadores o clube coloca como disponíveis para COMPRA (isTransferListed)
 * ou EMPRÉSTIMO (isLoanListed), incluindo a justificativa técnica/financeira.
 */
export function evaluateAiClubSquadAndListings(
  club: Club,
  squad: Player[]
): Player[] {
  if (!squad || squad.length === 0) return [];

  const targetStarterOvr = Math.round(
    (club.overallAttack + club.overallMidfield + club.overallDefense) / 3
  );
  const formationSlots = FORMATIONS[club.formation] || FORMATIONS['4-2-3-1'];
  const requiredStartersByPos = new Map<NaturalPosition, number>();
  for (const slot of formationSlots) {
    requiredStartersByPos.set(
      slot.label,
      (requiredStartersByPos.get(slot.label) || 0) + 1
    );
  }

  // Group players by natural position sorted by starter status then OVR descending
  const byPos = new Map<NaturalPosition, { player: Player; ovr: number }[]>();
  const bySectorCount = new Map<PositionSector, number>();

  for (const p of squad) {
    const ovr = calculatePlayerOverall(p.attributes, p.position);
    const list = byPos.get(p.position) || [];
    list.push({ player: p, ovr });
    byPos.set(p.position, list);
    bySectorCount.set(p.sector, (bySectorCount.get(p.sector) || 0) + 1);
  }

  for (const [, list] of byPos.entries()) {
    list.sort((a, b) => {
      if (a.player.isStarter !== b.player.isStarter) {
        return a.player.isStarter ? -1 : 1;
      }
      return b.ovr - a.ovr;
    });
  }

  const gkTotal = byPos.get('GOL')?.length || 0;
  let loanCount = 0;
  let transferCount = 0;
  const maxLoansPerClub = 2;
  const maxTransfersPerClub = 2;

  return squad.map((player) => {
    // Players on loan from another club cannot be listed by the borrowing club
    if (player.contractType === 'EMPRESTADO') {
      return {
        ...player,
        isTransferListed: false,
        isLoanListed: false,
        marketListingReason: undefined,
      };
    }

    // Never list players if squad is at minimum size, or protect the top 2 goalkeepers
    if (
      squad.length <= MIN_SQUAD_SIZE ||
      (player.position === 'GOL' && gkTotal <= MIN_GOALKEEPERS + 1)
    ) {
      return {
        ...player,
        isTransferListed: false,
        isLoanListed: false,
        marketListingReason: undefined,
      };
    }

    const posGroup = byPos.get(player.position) || [];
    const rankInPos = posGroup.findIndex((item) => item.player.id === player.id);
    const posCount = posGroup.length;
    const sectorCount = bySectorCount.get(player.sector) || 0;
    const reqStarters = requiredStartersByPos.get(player.position) || 0;
    // Active depth needed at this position: starter(s) + 1 direct backup per starting slot (or 1 tactical option if unused in base XI)
    const desiredDepthAtPos = reqStarters > 0 ? reqStarters * 2 : 1;
    const ovr = calculatePlayerOverall(player.attributes, player.position);
    const starterAtPosOvr = posGroup[0]?.ovr ?? targetStarterOvr;
    const potentialCeiling = Math.max(
      ovr,
      player.dynamicCeilingOvr ?? player.basePotentialOvr ?? ovr
    );
    const evolutionRoom = Math.max(0, potentialCeiling - ovr);

    // 1. Positional surplus: more players in the same position than the club actually uses in rotation
    const isPositionalSurplus =
      rankInPos >= desiredDepthAtPos ||
      (reqStarters === 0 && posCount >= 2 && rankInPos >= 1);

    // 2. Out of club planning due to age (aging reserve clearly behind squad level)
    const isOutOfPlanByAge =
      player.age >= 32 &&
      ovr <= targetStarterOvr - 4 &&
      rankInPos >= Math.max(1, reqStarters);

    // 3. Out of club planning due to low evolution / stagnation below the club's tier
    const isStagnatedOutOfPlan =
      player.age >= 25 &&
      evolutionRoom <= 1 &&
      ovr <= targetStarterOvr - 5 &&
      (posCount >= Math.max(2, reqStarters + 1) || reqStarters === 0);

    // 4. Young prospect who still needs evolution/minutes and is clearly blocked behind much stronger options
    const isYoungBlockedForEvolution =
      player.age <= 22 &&
      evolutionRoom >= 4 &&
      (isPositionalSurplus ||
        (rankInPos >= Math.max(1, reqStarters) &&
          starterAtPosOvr - ovr >= 5 &&
          ovr <= targetStarterOvr - 4 &&
          (posCount >= Math.max(2, reqStarters + 1) || sectorCount >= 6)));

    let isTransferListed = false;
    let isLoanListed = false;
    let reason: string | undefined;

    if (!player.isStarter) {
      // Active, competitive direct backups who aren't in positional surplus stay UNLISTED
      if (
        !isPositionalSurplus &&
        !isOutOfPlanByAge &&
        !isStagnatedOutOfPlan &&
        !isYoungBlockedForEvolution
      ) {
        return {
          ...player,
          isTransferListed: false,
          isLoanListed: false,
          marketListingReason: undefined,
        };
      }

      // Case A: Positional surplus -> Loan if young with evolution upside, else Sale
      if (isPositionalSurplus) {
        if (
          player.age <= 23 &&
          evolutionRoom >= 3 &&
          loanCount < maxLoansPerClub
        ) {
          isLoanListed = true;
          loanCount++;
          reason = 'Empréstimo: Excesso na posição — busca minutos p/ evoluir';
        } else if (transferCount < maxTransfersPerClub) {
          isTransferListed = true;
          transferCount++;
          reason = 'Venda: Excesso de atletas na mesma posição';
        } else if (player.age <= 24 && loanCount < maxLoansPerClub) {
          isLoanListed = true;
          loanCount++;
          reason = 'Empréstimo: Sem espaço por excesso na posição';
        }
      }
      // Case B: Young prospect blocked behind stronger starters -> Loan for evolution
      else if (isYoungBlockedForEvolution && loanCount < maxLoansPerClub) {
        isLoanListed = true;
        loanCount++;
        reason = 'Empréstimo: Jovem com potencial p/ evoluir com minutagem';
      }
      // Case C: Out of planning due to age -> Sale
      else if (isOutOfPlanByAge && transferCount < maxTransfersPerClub) {
        isTransferListed = true;
        transferCount++;
        reason = 'Venda: Fora do planejamento pela idade e nível atual';
      }
      // Case D: Stagnated reserve below club standard -> Sale
      else if (isStagnatedOutOfPlan && transferCount < maxTransfersPerClub) {
        isTransferListed = true;
        transferCount++;
        reason = 'Venda: Fora do planejamento por baixa evolução';
      }
    } else if (
      // Occasional starter sale only if club is in severe cash crunch and has a near-equal backup
      club.cashBalance < 7_500_000 &&
      posCount >= 2 &&
      posGroup[1] &&
      posGroup[1].ovr >= ovr - 2 &&
      player.marketValue >= 22_000_000 &&
      transferCount < maxTransfersPerClub
    ) {
      isTransferListed = true;
      transferCount++;
      reason = 'Venda: Clube precisa fazer caixa';
    }

    return {
      ...player,
      isTransferListed,
      isLoanListed,
      marketListingReason: reason,
    };
  });
}

/**
 * Analisa o pensamento de mercado de um clube adversário:
 * carências por posição/setor, postura financeira (compra, venda ou empréstimo) e resumo estratégico.
 */
export function analyzeAiClubMarketProfile(
  club: Club,
  squad: Player[]
): AiClubMarketProfile {
  const targetStarterOvr = Math.round(
    (club.overallAttack + club.overallMidfield + club.overallDefense) / 3
  );
  const totalPayroll = squad.reduce((acc, p) => acc + p.salary, 0);
  const wageUsagePct = Math.round(
    (totalPayroll / Math.max(1, club.wageBudget)) * 100
  );

  const formationSlots = FORMATIONS[club.formation] || FORMATIONS['4-2-3-1'];
  const requiredPosCounts = new Map<NaturalPosition, number>();
  for (const slot of formationSlots) {
    requiredPosCounts.set(
      slot.label,
      (requiredPosCounts.get(slot.label) || 0) + 1
    );
  }

  // Score each position's need urgency
  const posNeedScores: {
    pos: NaturalPosition;
    sector: PositionSector;
    urgency: number;
  }[] = [];

  const allPositions: { pos: NaturalPosition; sector: PositionSector }[] = [
    { pos: 'GOL', sector: 'GOL' },
    { pos: 'ZAG', sector: 'DEF' },
    { pos: 'LD', sector: 'DEF' },
    { pos: 'LE', sector: 'DEF' },
    { pos: 'VOL', sector: 'MEI' },
    { pos: 'MC', sector: 'MEI' },
    { pos: 'MEI', sector: 'MEI' },
    { pos: 'PD', sector: 'ATA' },
    { pos: 'PE', sector: 'ATA' },
    { pos: 'ATA', sector: 'ATA' },
  ];

  for (const { pos, sector } of allPositions) {
    const reqStarters = requiredPosCounts.get(pos) || 0;
    const playersAtPos = squad
      .filter((p) => p.position === pos)
      .map((p) => ({
        player: p,
        ovr: calculatePlayerOverall(p.attributes, p.position),
      }))
      .sort((a, b) => b.ovr - a.ovr);

    let urgency = 0;
    const desiredDepth = reqStarters > 0 ? reqStarters + 1 : 1;
    if (playersAtPos.length < desiredDepth) {
      urgency += (desiredDepth - playersAtPos.length) * 14;
    }
    if (reqStarters > 0) {
      const starterOvr = playersAtPos[0]?.ovr ?? targetStarterOvr - 8;
      if (starterOvr < targetStarterOvr) {
        urgency += (targetStarterOvr - starterOvr) * 4;
      }
      if (playersAtPos[0]?.player.age >= 33) {
        urgency += 6;
      }
    }

    if (urgency > 0) {
      posNeedScores.push({ pos, sector, urgency });
    }
  }

  posNeedScores.sort((a, b) => b.urgency - a.urgency);

  const neededPositions = posNeedScores.slice(0, 3).map((x) => x.pos);
  if (neededPositions.length === 0) {
    const weakestSec = findWeakestSector(squad);
    const defaultPos: NaturalPosition =
      weakestSec === 'ATA'
        ? 'ATA'
        : weakestSec === 'MEI'
        ? 'MC'
        : weakestSec === 'DEF'
        ? 'ZAG'
        : 'GOL';
    neededPositions.push(defaultPos);
  }

  const neededSectors = Array.from(
    new Set(
      posNeedScores.length > 0
        ? posNeedScores.slice(0, 2).map((x) => x.sector)
        : [findWeakestSector(squad)]
    )
  );

  const transferListedCount = squad.filter((p) => p.isTransferListed).length;
  const loanListedCount = squad.filter((p) => p.isLoanListed).length;

  const financialSnapshot = evaluateClubTransferFinancialHealth({
    club,
    clubSquad: squad,
    proposedFee: 0,
    addedMonthlySalary: 0,
    dealType: 'BUY',
  });

  let posture: AiClubMarketProfile['posture'] = 'EQUILIBRADO';
  let postureLabel = 'Equilibrado (Compra & Venda Pontual)';
  let preferredIncomingMode: AiClubMarketProfile['preferredIncomingMode'] =
    'AMBOS';

  if (
    club.cashBalance <= 0 ||
    financialSnapshot.maxHealthySingleDealFee < 2_500_000 ||
    wageUsagePct >= 92
  ) {
    posture = 'VENDEDOR_ALIVIO_FOLHA';
    postureLabel = 'Vendedor & Alívio de Folha';
    preferredIncomingMode = 'EMPRESTIMO';
  } else if (
    financialSnapshot.maxHealthySingleDealFee >= 12_000_000 &&
    wageUsagePct <= 84
  ) {
    posture = 'COMPRADOR';
    postureLabel = 'Comprador Ativo (Busca Titulares)';
    preferredIncomingMode = 'COMPRA';
  } else if (financialSnapshot.maxHealthySingleDealFee < 7_000_000) {
    posture = 'BUSCA_EMPRESTIMOS';
    postureLabel = 'Foco em Empréstimos & Oportunidades';
    preferredIncomingMode = 'EMPRESTIMO';
  }

  const summaryText = `${club.shortName} (${postureLabel}) prioriza reforçar ${neededPositions.join(
    ', '
  )} via ${
    preferredIncomingMode === 'COMPRA'
      ? 'compra definitiva'
      : preferredIncomingMode === 'EMPRESTIMO'
      ? 'empréstimo'
      : 'compra ou empréstimo'
  } e disponibilizou ${transferListedCount} atleta(s) p/ venda e ${loanListedCount} p/ empréstimo.`;

  return {
    clubId: club.id,
    clubShortName: club.shortName,
    posture,
    postureLabel,
    preferredIncomingMode,
    neededPositions,
    neededSectors,
    transferListedCount,
    loanListedCount,
    wageUsagePct,
    targetStarterOvr,
    summaryText,
  };
}

export function buildInitialAiSquads(
  clubs: Club[],
  userClubId: string
): Record<string, Player[]> {
  const map: Record<string, Player[]> = {};
  for (const club of clubs) {
    if (club.id === userClubId) continue;
    const rawSquad = getRealSquadForClub(club);
    map[club.id] = evaluateAiClubSquadAndListings(club, rawSquad);
  }
  return map;
}

function recalculateClubSectorRatings(
  club: Club,
  squad: Player[]
): Pick<Club, 'overallAttack' | 'overallMidfield' | 'overallDefense'> {
  const starters = squad.filter((p) => p.isStarter);
  const pool = starters.length >= 11 ? starters : squad.slice(0, 11);
  const avgSec = (sectors: PositionSector[], fallback: number) => {
    const list = pool.filter((p) => sectors.includes(p.sector));
    if (list.length === 0) return fallback;
    const sum = list.reduce(
      (acc, p) => acc + calculatePlayerOverall(p.attributes, p.position),
      0
    );
    return Math.min(95, Math.max(60, Math.round(sum / list.length)));
  };
  return {
    overallAttack: avgSec(['ATA'], club.overallAttack),
    overallMidfield: avgSec(['MEI'], club.overallMidfield),
    overallDefense: avgSec(['GOL', 'DEF'], club.overallDefense),
  };
}

function findWeakestSector(squad: Player[]): PositionSector {
  const sectors: PositionSector[] = ['DEF', 'MEI', 'ATA', 'GOL'];
  let weakest: PositionSector = 'ATA';
  let lowestScore = 999;

  for (const sec of sectors) {
    const list = squad.filter((p) => p.sector === sec);
    if (list.length === 0) return sec;
    const bestOvr = Math.max(
      ...list.map((p) => calculatePlayerOverall(p.attributes, p.position))
    );
    const depthBonus = list.length >= 4 ? 1.5 : list.length <= 2 ? -2.5 : 0;
    const score = bestOvr + depthBonus;
    if (score < lowestScore) {
      lowestScore = score;
      weakest = sec;
    }
  }
  return weakest;
}

/**
 * Retorna o valor de mercado coerente e atualizado do atleta:
 * nunca permite um valor defasado muito abaixo da avaliação real de OVR/idade/potencial,
 * evitando propostas desproporcionais (ex.: atleta que vale 50M recebendo proposta sobre base antiga de 10M).
 */
export function getCanonicalPlayerMarketValue(
  player: Player,
  club?: Pick<Club, 'reputation' | 'division'>
): number {
  const rawMv = player.marketValue ?? 0;
  if (rawMv > 0 && !club) {
    return Math.max(50_000, rawMv);
  }
  const ovr = calculatePlayerOverall(player.attributes, player.position);
  const rep = club?.reputation ?? 76;
  const div = club?.division ?? 'A';
  const stars =
    player.potentialStars ??
    assignPotentialStars(ovr, player.age, rep, player.id, player.name);
  const balancedMv = calculateBalancedValuationAndWage({
    ovr,
    age: Math.max(16, player.age),
    clubReputation: rep,
    division: div,
    potentialStars: stars,
    position: player.position,
  }).marketValue;
  // Se o marketValue salvo estiver zerado ou mais de 25% abaixo do valor justo pelo OVR em atleta profissional, usa o valor justo
  if (rawMv <= 0 || (rawMv < balancedMv * 0.75 && player.salary >= 120_000)) {
    return Math.max(50_000, balancedMv);
  }
  return Math.max(50_000, rawMv);
}

/**
 * Simulates autonomous AI-to-AI transfers (purchases and loans) driven by each club's
 * positional needs, financial posture, and transfer/loan listed players.
 */
export function simulateAiTransferWindowTick(params: {
  clubs: Club[];
  aiSquads: Record<string, Player[]>;
  userClubId: string;
  dayOffset: number;
  seasonYear: number;
  maxDeals?: number;
  rng?: () => number;
}): {
  updatedClubs: Club[];
  updatedAiSquads: Record<string, Player[]>;
  newRecords: TransferRecord[];
} {
  const {
    clubs,
    aiSquads,
    userClubId,
    dayOffset,
    seasonYear,
    maxDeals = 2,
    rng = Math.random,
  } = params;

  // Transferências e propostas só ocorrem se a janela de transferências estiver aberta!
  if (!isTransferWindowOpen(dayOffset)) {
    return {
      updatedClubs: clubs,
      updatedAiSquads: aiSquads,
      newRecords: [],
    };
  }

  const workingClubs = clubs.map((c) => ({ ...c }));
  const workingSquads: Record<string, Player[]> = {};
  for (const [cid, list] of Object.entries(aiSquads)) {
    const clubObj = workingClubs.find((c) => c.id === cid);
    workingSquads[cid] = clubObj
      ? evaluateAiClubSquadAndListings(clubObj, list.map((p) => ({ ...p })))
      : list.map((p) => ({ ...p }));
  }

  const newRecords: TransferRecord[] = [];
  const aiClubIndices = workingClubs
    .map((c, idx) => ({ club: c, idx }))
    .filter(
      (item) =>
        item.club.id !== userClubId &&
        workingSquads[item.club.id]?.length >= 16
    );

  if (aiClubIndices.length < 2) {
    return {
      updatedClubs: workingClubs,
      updatedAiSquads: workingSquads,
      newRecords,
    };
  }

  const dateLabel = formatCalendarDate(dayOffset, seasonYear);

  for (let d = 0; d < maxDeals; d++) {
    // Pick a buying/borrowing club with positional needs, positive cash, and healthy financial headroom
    const buyers = aiClubIndices.filter((item) => {
      if (item.club.cashBalance <= 0) return false;
      const sq = workingSquads[item.club.id];
      if (sq.length >= 27) return false;
      const payroll = sq.reduce((s, p) => s + p.salary * (p.wageSharePaid ?? 1), 0);
      if (item.club.wageBudget - payroll < 120_000) return false;
      const baselineHealth = evaluateClubTransferFinancialHealth({
        club: item.club,
        clubSquad: sq,
        proposedFee: 500_000,
        addedMonthlySalary: 80_000,
        dealType: 'LOAN',
        seasonYear,
      });
      return baselineHealth.canAffordAndHealthy;
    });
    if (buyers.length === 0) break;

    const buyerPick = buyers[Math.floor(rng() * buyers.length)];
    const buyer = buyerPick.club;
    const buyerSquad = workingSquads[buyer.id];
    const buyerPayroll = buyerSquad.reduce(
      (s, p) => s + p.salary * (p.wageSharePaid ?? 1),
      0
    );
    const remainingWageRoom = buyer.wageBudget - buyerPayroll;
    if (remainingWageRoom < 120_000) continue;

    const buyerProfile = analyzeAiClubMarketProfile(buyer, buyerSquad);
    const neededPositions = buyerProfile.neededPositions;
    const neededSector =
      buyerProfile.neededSectors[0] || findWeakestSector(buyerSquad);

    // Pick candidate sellers that have depth and players listed or matching buyer's needs
    // Allows Brazilian/CONMEBOL clubs to loan/buy listed reserves from European UCL clubs, and UCL clubs to scout SA stars
    const candidateSellers = aiClubIndices.filter(
      (item) =>
        item.club.id !== buyer.id &&
        workingSquads[item.club.id].length > MIN_SQUAD_SIZE + 1 &&
        (item.club.reputation <= buyer.reputation + 10 ||
          ((item.club.division === 'UCL' ||
            item.club.division === 'PL' ||
            item.club.division === 'LALIGA') &&
            buyer.reputation >= 76 &&
            workingSquads[item.club.id].some(
              (p) => p.isLoanListed || p.isTransferListed
            )))
    );
    if (candidateSellers.length === 0) continue;

    // Score available targets across candidate sellers
    const targetPool: {
      sellerPick: (typeof aiClubIndices)[number];
      player: Player;
      canonicalMv: number;
      ovr: number;
      isLoanDeal: boolean;
      score: number;
    }[] = [];

    for (const sellerPick of candidateSellers) {
      const seller = sellerPick.club;
      const sellerSquad = workingSquads[seller.id];
      const gks = sellerSquad.filter((x) => x.position === 'GOL').length;

      for (const p of sellerSquad) {
        if (p.contractType === 'EMPRESTADO') continue;
        if (p.position === 'GOL' && gks <= MIN_GOALKEEPERS + 1) continue;

        const matchesExactPos = neededPositions.includes(p.position);
        const matchesSector = p.sector === neededSector;
        const isListed = Boolean(p.isTransferListed || p.isLoanListed);

        if (!matchesExactPos && !matchesSector && !isListed) continue;

        const ovr = calculatePlayerOverall(p.attributes, p.position);
        if (ovr < 66) continue;

        const canonicalMv = getCanonicalPlayerMarketValue(p, seller);

        // Empréstimo só é permitido para atletas explicitamente listados p/ empréstimo
        // ou jovens reservas buscando minutagem (nunca titulares ou estrelas de alto valor fora da lista de empréstimo)
        const canBeLoaned =
          Boolean(p.isLoanListed && !p.isTransferListed) ||
          (!p.isStarter &&
            !p.isTransferListed &&
            p.age <= 23 &&
            canonicalMv <= 38_000_000);

        const prefersLoan =
          Boolean(p.isLoanListed && !p.isTransferListed) ||
          (canBeLoaned &&
            (buyerProfile.preferredIncomingMode === 'EMPRESTIMO' ||
              seller.reputation > buyer.reputation));

        const estFee = prefersLoan
          ? clampTransferFeeToMarketCorridor({
              rawFee: canonicalMv * 0.10,
              marketValue: canonicalMv,
              dealType: 'LOAN',
              minRatio: 0.08,
              maxRatio: 0.15,
            })
          : clampTransferFeeToMarketCorridor({
              rawFee: canonicalMv * (p.isTransferListed ? 0.88 : 1.0),
              marketValue: canonicalMv,
              dealType: 'BUY',
              minRatio: 0.85,
              maxRatio: 1.15,
            });

        const estSalaryForBuyer = prefersLoan
          ? Math.round(p.salary * 0.8)
          : p.salary;

        const targetHealth = evaluateClubTransferFinancialHealth({
          club: buyer,
          clubSquad: buyerSquad,
          proposedFee: estFee,
          addedMonthlySalary: estSalaryForBuyer,
          dealType: prefersLoan ? 'LOAN' : 'BUY',
          seasonYear,
        });
        if (!targetHealth.canAffordAndHealthy) continue;

        let score = ovr;
        if (matchesExactPos) score += 18;
        else if (matchesSector) score += 9;
        if (p.isTransferListed || p.isLoanListed) score += 20;
        if (!p.isStarter) score += 8;

        targetPool.push({
          sellerPick,
          player: p,
          canonicalMv,
          ovr,
          isLoanDeal: prefersLoan,
          score,
        });
      }
    }

    if (targetPool.length === 0) continue;

    targetPool.sort((a, b) => b.score - a.score);
    const chosen =
      targetPool[Math.floor(rng() * Math.min(4, targetPool.length))];
    const sellerPick = chosen.sellerPick;
    const seller = sellerPick.club;
    const sellerSquad = workingSquads[seller.id];
    const targetPlayer = chosen.player;
    const targetMv = chosen.canonicalMv;
    const isLoan = chosen.isLoanDeal;

    let fee = isLoan
      ? clampTransferFeeToMarketCorridor({
          rawFee: targetMv * (0.09 + rng() * 0.05),
          marketValue: targetMv,
          dealType: 'LOAN',
          minRatio: 0.08,
          maxRatio: 0.15,
        })
      : clampTransferFeeToMarketCorridor({
          rawFee:
            targetMv *
            (targetPlayer.isTransferListed ? 0.86 + rng() * 0.12 : 0.94 + rng() * 0.16),
          marketValue: targetMv,
          dealType: 'BUY',
          minRatio: 0.85,
          maxRatio: 1.15,
        });

    const finalAddedSalary = isLoan
      ? Math.round(targetPlayer.salary * 0.8)
      : targetPlayer.salary;
    const finalHealthCheck = evaluateClubTransferFinancialHealth({
      club: buyer,
      clubSquad: buyerSquad,
      proposedFee: fee,
      addedMonthlySalary: finalAddedSalary,
      dealType: isLoan ? 'LOAN' : 'BUY',
      seasonYear,
    });
    if (!finalHealthCheck.canAffordAndHealthy) {
      const minAcceptableFee = clampTransferFeeToMarketCorridor({
        rawFee: targetMv * (isLoan ? 0.08 : 0.85),
        marketValue: targetMv,
        dealType: isLoan ? 'LOAN' : 'BUY',
        minRatio: isLoan ? 0.08 : 0.85,
        maxRatio: isLoan ? 0.15 : 1.15,
      });
      if (
        !finalHealthCheck.payrollHealthy ||
        finalHealthCheck.maxHealthySingleDealFee < minAcceptableFee
      ) {
        continue;
      }
      const step = getDynamicFeeStep(targetMv, isLoan);
      const healthyCappedFee = Math.floor(finalHealthCheck.maxHealthySingleDealFee / step) * step;
      if (healthyCappedFee < minAcceptableFee) continue;
      fee = clampTransferFeeToMarketCorridor({
        rawFee: healthyCappedFee,
        marketValue: targetMv,
        dealType: isLoan ? 'LOAN' : 'BUY',
        minRatio: isLoan ? 0.08 : 0.85,
        maxRatio: isLoan ? 0.15 : 1.15,
      });
      const recheck = evaluateClubTransferFinancialHealth({
        club: buyer,
        clubSquad: buyerSquad,
        proposedFee: fee,
        addedMonthlySalary: finalAddedSalary,
        dealType: isLoan ? 'LOAN' : 'BUY',
        seasonYear,
      });
      if (!recheck.canAffordAndHealthy) continue;
    }

    // Move player from sellerSquad to buyerSquad
    workingSquads[seller.id] = sellerSquad.filter(
      (p) => p.id !== targetPlayer.id
    );

    // Check if new player is better than buyer's current starter at that position
    const currentStarterAtPos = buyerSquad.find(
      (p) => p.isStarter && p.position === targetPlayer.position
    );
    const currentStarterOvr = currentStarterAtPos
      ? calculatePlayerOverall(
          currentStarterAtPos.attributes,
          currentStarterAtPos.position
        )
      : 0;
    const becomesStarter =
      Boolean(currentStarterAtPos) && chosen.ovr > currentStarterOvr;

    let updatedBuyerSquad = buyerSquad.map((p) =>
      becomesStarter && currentStarterAtPos && p.id === currentStarterAtPos.id
        ? { ...p, isStarter: false, slotIndex: null }
        : p
    );

    const nextShirtNumber =
      Math.max(22, ...updatedBuyerSquad.map((p) => p.number)) + 1;
    const movedPlayer: Player = {
      ...targetPlayer,
      number: nextShirtNumber,
      isStarter: becomesStarter,
      slotIndex:
        becomesStarter && currentStarterAtPos
          ? currentStarterAtPos.slotIndex
          : null,
      contractType: isLoan ? 'EMPRESTADO' : 'DEFINITIVO',
      loanOriginClubId: isLoan ? seller.id : undefined,
      loanOriginClubName: isLoan ? seller.shortName : undefined,
      wageSharePaid: isLoan ? 0.8 : 1,
      isTransferListed: false,
      isLoanListed: false,
      marketListingReason: undefined,
    };

    // Promote seller replacement if starter left
    if (targetPlayer.isStarter && targetPlayer.slotIndex !== null) {
      const replacement =
        workingSquads[seller.id].find(
          (p) => !p.isStarter && p.position === targetPlayer.position
        ) ||
        workingSquads[seller.id].find(
          (p) => !p.isStarter && p.sector === targetPlayer.sector
        ) ||
        workingSquads[seller.id].find((p) => !p.isStarter);
      if (replacement) {
        workingSquads[seller.id] = workingSquads[seller.id].map((p) =>
          p.id === replacement.id
            ? {
                ...p,
                isStarter: true,
                slotIndex: targetPlayer.slotIndex,
              }
            : p
        );
      }
    }

    updatedBuyerSquad = [...updatedBuyerSquad, movedPlayer];

    const buyerRatings = recalculateClubSectorRatings(buyer, updatedBuyerSquad);
    const sellerRatings = recalculateClubSectorRatings(
      seller,
      workingSquads[seller.id]
    );

    workingClubs[buyerPick.idx] = {
      ...buyer,
      cashBalance: buyer.cashBalance - fee,
      ...buyerRatings,
    };
    workingClubs[sellerPick.idx] = {
      ...seller,
      cashBalance: seller.cashBalance + fee,
      ...sellerRatings,
    };
    buyerPick.club = workingClubs[buyerPick.idx];
    sellerPick.club = workingClubs[sellerPick.idx];

    // Re-evaluate transfer & loan listings for both clubs after squad change
    workingSquads[buyer.id] = evaluateAiClubSquadAndListings(
      workingClubs[buyerPick.idx],
      updatedBuyerSquad
    );
    workingSquads[seller.id] = evaluateAiClubSquadAndListings(
      workingClubs[sellerPick.idx],
      workingSquads[seller.id]
    );

    const sellerListingNote = targetPlayer.isTransferListed
      ? 'listado p/ venda pelo clube'
      : targetPlayer.isLoanListed
      ? 'disponibilizado p/ empréstimo'
      : 'negociação direta';

    newRecords.push({
      id: `ai-tr-${seasonYear}-${dayOffset}-${d}-${targetPlayer.id}`,
      date: dateLabel,
      type: isLoan ? 'EMPRESTIMO_IN' : 'COMPRA',
      status: 'CONCLUIDA',
      playerName: targetPlayer.name,
      position: targetPlayer.position,
      ovr: chosen.ovr,
      counterpartyClubName: `${seller.shortName} → ${buyer.shortName}`,
      feeAmount: fee,
      monthlySalaryImpact: targetPlayer.salary,
      note: isLoan
        ? `Empréstimo: ${buyer.shortName} tinha carência em ${targetPlayer.position}; ${seller.shortName} cedeu o atleta (${sellerListingNote}).`
        : `Compra: ${buyer.shortName} buscou reforço para ${targetPlayer.position}${
            becomesStarter ? ' (assume titularidade)' : ''
          }; ${seller.shortName} negociou (${sellerListingNote}).`,
      isAiTransfer: true,
      fromClubName: seller.shortName,
      toClubName: buyer.shortName,
      dealType: isLoan ? 'EMPRESTIMO' : 'COMPRA',
    });
  }

  return {
    updatedClubs: workingClubs,
    updatedAiSquads: workingSquads,
    newRecords,
  };
}

/**
 * Generates realistic official purchase or loan offers from AI clubs for standout,
 * young high-potential, or transfer/loan-listed players in the user's squad,
 * matching the AI club's actual positional needs and financial posture.
 */
export function maybeGenerateIncomingOfferForUser(params: {
  clubs: Club[];
  userClub: Club;
  userSquad: Player[];
  pendingOffers: IncomingTransferOffer[];
  dayOffset: number;
  seasonYear: number;
  aiSquads?: Record<string, Player[]>;
  specificPlayerId?: string;
  rng?: () => number;
}): IncomingTransferOffer | null {
  const {
    clubs,
    userClub,
    userSquad,
    pendingOffers,
    dayOffset,
    seasonYear,
    aiSquads,
    specificPlayerId,
    rng = Math.random,
  } = params;

  // Propostas de outros clubes só podem ocorrer enquanto a janela estiver aberta!
  if (!isTransferWindowOpen(dayOffset)) return null;

  const activePending = pendingOffers.filter(
    (o) => o.status === 'PENDING' && o.expiresDayOffset >= dayOffset
  );
  if (activePending.length >= 5) return null;
  if (userSquad.length <= MIN_SQUAD_SIZE) return null;

  const pendingPlayerIds = new Set(activePending.map((o) => o.playerId));
  const gkCount = userSquad.filter((p) => p.position === 'GOL').length;

  const candidates = userSquad
    .filter((p) => {
      if (specificPlayerId && p.id !== specificPlayerId) return false;
      if (p.contractType === 'EMPRESTADO') return false;
      if (pendingPlayerIds.has(p.id)) return false;
      if (p.position === 'GOL' && gkCount <= MIN_GOALKEEPERS) return false;
      return true;
    })
    .map((p) => {
      const ovr = calculatePlayerOverall(p.attributes, p.position);
      const stars =
        p.potentialStars ??
        assignPotentialStars(ovr, p.age, userClub.reputation, p.id, p.name);
      const formBoost =
        p.seasonStats.matches >= 4 && p.seasonStats.avgRating >= 7.1 ? 6 : 0;
      const youthBoost = p.age <= 22 && stars >= 4 ? 5 : 0;
      const listedBoost =
        p.isTransferListed || p.isLoanListed ? 34 : 0;
      const interestScore = ovr + formBoost + youthBoost + listedBoost;
      return {
        player: p,
        ovr,
        stars,
        interestScore,
        isListed: Boolean(p.isTransferListed || p.isLoanListed),
      };
    })
    .sort((a, b) => b.interestScore - a.interestScore);

  if (candidates.length === 0) return null;

  const listedCandidates = candidates.filter((c) => c.isListed);
  const topPool =
    specificPlayerId
      ? candidates
      : listedCandidates.length > 0 && rng() < 0.8
      ? listedCandidates
      : candidates.slice(0, Math.min(8, candidates.length));

  const picked = topPool[Math.floor(rng() * topPool.length)];
  const p = picked.player;

  const forceLoanOnly = Boolean(p.isLoanListed && !p.isTransferListed);
  const forceBuyOnly = Boolean(p.isTransferListed && !p.isLoanListed);
  const isListed = picked.isListed;

  const safeMarketValue = getCanonicalPlayerMarketValue(p, userClub);
  const minBuyRatio = isListed ? REALISTIC_BUY_OFFER_MIN_RATIO : 0.90;
  const isEliteWonderkid =
    p.age <= 22 && picked.stars >= 4.5 && picked.ovr >= 74;
  const maxBuyRatio = isListed ? 1.10 : isEliteWonderkid ? 1.20 : 1.16;

  const minCoherentBuyFee = clampTransferFeeToMarketCorridor({
    rawFee: safeMarketValue * minBuyRatio,
    marketValue: safeMarketValue,
    dealType: 'BUY',
    minRatio: minBuyRatio,
    maxRatio: maxBuyRatio,
  });
  const minLoanFeeRequired = clampTransferFeeToMarketCorridor({
    rawFee: safeMarketValue * 0.09,
    marketValue: safeMarketValue,
    dealType: 'LOAN',
    minRatio: 0.08,
    maxRatio: 0.16,
  });

  const loanSalaryForBuyer = Math.round(p.salary * 0.9);

  // Avalia rigorosamente caixa disponível, receitas anuais, reserva operacional, solvência e folha salarial
  const canClubAffordBuy = (c: Club): boolean =>
    evaluateClubTransferFinancialHealth({
      club: c,
      clubSquad: aiSquads?.[c.id],
      proposedFee: minCoherentBuyFee,
      addedMonthlySalary: p.salary,
      dealType: 'BUY',
      seasonYear,
    }).canAffordAndHealthy;

  const canClubAffordLoan = (c: Club): boolean =>
    evaluateClubTransferFinancialHealth({
      club: c,
      clubSquad: aiSquads?.[c.id],
      proposedFee: minLoanFeeRequired,
      addedMonthlySalary: loanSalaryForBuyer,
      dealType: 'LOAN',
      seasonYear,
    }).canAffordAndHealthy;

  // Empréstimos para atletas do usuário só ocorrem quando o usuário listou explicitamente o atleta para empréstimo!
  // Isso garante que um jogador de 50M jamais receba uma proposta de 9M (taxa de empréstimo) quando um clube não tem caixa para comprá-lo.
  const loanEligiblePlayer = Boolean(p.isLoanListed && !p.isTransferListed);

  const minRepRequired = isListed
    ? Math.max(58, picked.ovr - 16)
    : Math.max(64, picked.ovr - 11);

  const isEuropeanTarget =
    picked.ovr >= 78 || (p.age <= 22 && picked.stars >= 4 && picked.ovr >= 71);
  // Prevent European superclubs from making bizarre offers for low-OVR / Série B rotation players
  const maxRepAllowed = isEuropeanTarget ? 100 : Math.min(89, picked.ovr + 14);

  const isEuroLeagueDivision = (div: Club['division']) =>
    div === 'UCL' || div === 'PL' || div === 'LALIGA';

  const meetsClubTier = (c: Club): boolean => {
    if (c.id === userClub.id) return false;
    if (c.cashBalance <= 0) return false;
    if (c.reputation < minRepRequired || c.reputation > maxRepAllowed) return false;
    if (!isEuropeanTarget && c.division === 'UCL') return false;
    if (!isEuropeanTarget && picked.ovr < 73 && isEuroLeagueDivision(c.division)) return false;
    return true;
  };

  // Pick a plausible interested AI club with real cash-in-hand and healthy finances for the deal type
  let interestedClubs = clubs.filter((c) => {
    if (!meetsClubTier(c)) return false;
    if (forceLoanOnly) return canClubAffordLoan(c);
    if (forceBuyOnly) return canClubAffordBuy(c);
    return canClubAffordBuy(c) || (loanEligiblePlayer && canClubAffordLoan(c));
  });

  // Fallback for unlisted players if strict reputation ceiling excluded all clubs with healthy budget
  if (interestedClubs.length === 0) {
    interestedClubs = clubs.filter((c) => {
      if (c.id === userClub.id) return false;
      if (c.cashBalance <= 0) return false;
      if (c.reputation < minRepRequired) return false;
      if (!isEuropeanTarget && picked.ovr < 74 && isEuroLeagueDivision(c.division)) return false;
      if (forceLoanOnly) return canClubAffordLoan(c);
      if (forceBuyOnly) return canClubAffordBuy(c);
      return canClubAffordBuy(c) || (loanEligiblePlayer && canClubAffordLoan(c));
    });
  }
  if (interestedClubs.length === 0) return null;

  const clubsWithNeed = aiSquads
    ? interestedClubs.filter((c) => {
        const sq = aiSquads[c.id];
        if (!sq || sq.length === 0) return false;
        const profile = analyzeAiClubMarketProfile(c, sq);
        if (profile.neededPositions.includes(p.position)) return true;
        if (profile.neededSectors.includes(p.sector)) return true;
        const posPlayers = sq.filter((sp) => sp.position === p.position);
        if (posPlayers.length <= 1) return true;
        const bestAtPos = Math.max(
          ...posPlayers.map((sp) =>
            calculatePlayerOverall(sp.attributes, sp.position)
          )
        );
        return picked.ovr >= bestAtPos - 1;
      })
    : [];

  const buyerPool =
    clubsWithNeed.length > 0 && rng() < 0.88 ? clubsWithNeed : interestedClubs;

  // Equilibra propostas entre clubes europeus (Champions, Premier League, La Liga) e mercado sul-americano/global:
  // - Destaques/promessas (OVR >= 78 ou Sub-22 4★+ com OVR >= 71): forte interesse europeu + grandes locais
  // - Jogadores de rotação/Série B: estritamente mercado doméstico/CONMEBOL/compatível
  const euroBuyers = buyerPool.filter((c) => isEuroLeagueDivision(c.division));
  const nonEuroBuyers = buyerPool.filter((c) => !isEuroLeagueDivision(c.division));

  let scopedBuyerPool = buyerPool;
  if (isEuropeanTarget && euroBuyers.length > 0 && nonEuroBuyers.length > 0) {
    scopedBuyerPool = rng() < 0.56 ? euroBuyers : nonEuroBuyers;
  } else if (!isEuropeanTarget && nonEuroBuyers.length > 0) {
    scopedBuyerPool = nonEuroBuyers;
  }

  // Prefer clubs with strongest healthy spending capacity without repeating only the richest 1-2 giants
  const buyerHealthyCap = new Map<string, number>();
  for (const c of scopedBuyerPool) {
    buyerHealthyCap.set(
      c.id,
      evaluateClubTransferFinancialHealth({
        club: c,
        clubSquad: aiSquads?.[c.id],
        proposedFee: forceLoanOnly ? minLoanFeeRequired : minCoherentBuyFee,
        addedMonthlySalary: forceLoanOnly ? loanSalaryForBuyer : p.salary,
        dealType: forceLoanOnly ? 'LOAN' : 'BUY',
        seasonYear,
      }).maxHealthySingleDealFee
    );
  }
  const sortedBuyerPool = [...scopedBuyerPool].sort(
    (a, b) => (buyerHealthyCap.get(b.id) ?? 0) - (buyerHealthyCap.get(a.id) ?? 0)
  );
  const topBuyers = sortedBuyerPool.slice(
    0,
    Math.max(1, Math.min(8, sortedBuyerPool.length))
  );
  const buyer = topBuyers[Math.floor(rng() * topBuyers.length)];
  const buyerSq = aiSquads?.[buyer.id] || [];
  const buyerProfile =
    buyerSq.length > 0 ? analyzeAiClubMarketProfile(buyer, buyerSq) : null;

  const buyerCanAffordFullBuy = canClubAffordBuy(buyer);

  // Se o clube comprador não tem caixa saudável para comprar pelo preço justo (>=85% do valor de mercado)
  // e o jogador NÃO é elegível para empréstimo, a proposta simplesmente não é feita (nunca envia 9M por atleta de 50M!).
  if (!forceLoanOnly && !buyerCanAffordFullBuy && !loanEligiblePlayer) {
    return null;
  }

  const isLoan = forceLoanOnly
    ? true
    : forceBuyOnly
    ? false
    : !buyerCanAffordFullBuy
    ? true
    : loanEligiblePlayer &&
      buyerProfile?.preferredIncomingMode === 'EMPRESTIMO' &&
      !p.isTransferListed
    ? true
    : Boolean(p.isLoanListed) && rng() < 0.45;

  const dealTypeForHealth: 'BUY' | 'LOAN' = isLoan ? 'LOAN' : 'BUY';
  const addedSalaryForDeal = isLoan ? loanSalaryForBuyer : p.salary;
  const buyerHealthBase = evaluateClubTransferFinancialHealth({
    club: buyer,
    clubSquad: aiSquads?.[buyer.id],
    proposedFee: isLoan ? minLoanFeeRequired : minCoherentBuyFee,
    addedMonthlySalary: addedSalaryForDeal,
    dealType: dealTypeForHealth,
    seasonYear,
  });
  if (!buyerHealthBase.canAffordAndHealthy) return null;

  let rawFee = 0;
  if (isLoan) {
    const loanMultiplier = 0.09 + rng() * 0.06; // 9%..15% of marketValue
    rawFee = clampTransferFeeToMarketCorridor({
      rawFee: safeMarketValue * loanMultiplier,
      marketValue: safeMarketValue,
      dealType: 'LOAN',
      minRatio: 0.08,
      maxRatio: 0.16,
    });
    if (rawFee > buyerHealthBase.maxHealthySingleDealFee) {
      const step = getDynamicFeeStep(safeMarketValue, true);
      const maxHealthyLoan =
        Math.floor(buyerHealthBase.maxHealthySingleDealFee / step) * step;
      if (maxHealthyLoan < minLoanFeeRequired) return null;
      rawFee = clampTransferFeeToMarketCorridor({
        rawFee: maxHealthyLoan,
        marketValue: safeMarketValue,
        dealType: 'LOAN',
        minRatio: 0.08,
        maxRatio: 0.16,
      });
    }
  } else {
    const feeMultiplier =
      minBuyRatio + rng() * (maxBuyRatio - minBuyRatio);
    let targetBuyFee = clampTransferFeeToMarketCorridor({
      rawFee: safeMarketValue * feeMultiplier,
      marketValue: safeMarketValue,
      dealType: 'BUY',
      minRatio: minBuyRatio,
      maxRatio: maxBuyRatio,
    });

    if (targetBuyFee > buyerHealthBase.maxHealthySingleDealFee) {
      const step = getDynamicFeeStep(safeMarketValue, false);
      const maxHealthyBuy =
        Math.floor(buyerHealthBase.maxHealthySingleDealFee / step) * step;
      if (maxHealthyBuy < minCoherentBuyFee) {
        return null;
      }
      targetBuyFee = clampTransferFeeToMarketCorridor({
        rawFee: maxHealthyBuy,
        marketValue: safeMarketValue,
        dealType: 'BUY',
        minRatio: minBuyRatio,
        maxRatio: maxBuyRatio,
      });
    }
    rawFee = targetBuyFee;
  }

  if (rawFee <= 0) return null;
  if (!isLoan && rawFee < minCoherentBuyFee) return null;

  // Verificação final absoluta: proposta jamais pode exceder o caixa real nem comprometer a saúde financeira do clube
  const finalOfferHealth = evaluateClubTransferFinancialHealth({
    club: buyer,
    clubSquad: aiSquads?.[buyer.id],
    proposedFee: rawFee,
    addedMonthlySalary: addedSalaryForDeal,
    dealType: dealTypeForHealth,
    seasonYear,
  });
  if (!finalOfferHealth.canAffordAndHealthy) return null;

  const reasonParts: string[] = [];
  if (p.isTransferListed && p.isLoanListed) {
    reasonParts.push('disponível para venda/empréstimo');
  } else if (p.isTransferListed) {
    reasonParts.push('listado para transferência');
  } else if (p.isLoanListed) {
    reasonParts.push('disponível para empréstimo');
  }
  if (p.seasonStats.matches >= 4 && p.seasonStats.avgRating >= 7.0) {
    reasonParts.push(`boa fase (${p.seasonStats.avgRating.toFixed(2)} média)`);
  }
  if (p.age <= 22 && picked.stars >= 4) {
    reasonParts.push(`alto potencial (${picked.stars}★)`);
  }
  if (reasonParts.length === 0) {
    reasonParts.push(`nível OVR ${picked.ovr} no elenco`);
  }

  const needDetail =
    buyerProfile && buyerProfile.neededPositions.includes(p.position)
      ? `identificou carência prioritária na posição (${p.position})`
      : `busca qualificar o setor de ${p.sector} (${p.position})`;

  const potentialOvr = Math.max(
    picked.ovr,
    p.dynamicCeilingOvr ??
      p.basePotentialOvr ??
      Math.min(96, picked.ovr + Math.max(0, Math.round((picked.stars - 2.5) * 4)))
  );
  const contractYearsRemaining =
    p.contractYearsRemaining ??
    (p.contractEndYear ? Math.max(1, p.contractEndYear - seasonYear + 1) : 2);

  return {
    id: `offer-${seasonYear}-${dayOffset}-${p.id}-${Math.round(rng() * 9999)}`,
    createdAtDate: formatCalendarDate(dayOffset, seasonYear),
    fromClubId: buyer.id,
    fromClubName: buyer.shortName,
    fromClubAbbr: buyer.abbr,
    fromClubPrimaryColor: buyer.primaryColor,
    fromClubReputation: buyer.reputation,
    playerId: p.id,
    playerName: p.name,
    playerPosition: p.position,
    playerOvr: picked.ovr,
    playerAge: p.age,
    playerPotentialStars: picked.stars,
    playerMarketValue: safeMarketValue,
    playerSalary: p.salary,
    playerPotentialOvr: potentialOvr,
    playerIsStarter: p.isStarter,
    playerContractYearsRemaining: contractYearsRemaining,
    dealType: isLoan ? 'LOAN' : 'BUY',
    offeredFee: rawFee,
    wageShareCovered: isLoan ? 0.9 : 1.0,
    expiresDayOffset: dayOffset + 18,
    negotiationStep: 0,
    status: 'PENDING',
    rationale: `${buyer.shortName} ${needDetail} e propõe ${
      isLoan ? 'empréstimo (taxa de cessão por 1 temporada)' : 'compra definitiva'
    } (${reasonParts.join(' · ')}).`,
  };
}

export function createOfferInboxMessage(
  offer: IncomingTransferOffer,
  userClub: Club
): InboxMessage {
  const dealLabel =
    offer.dealType === 'LOAN' ? 'Proposta de Empréstimo' : 'Proposta Oficial de Compra';
  const marketValText = offer.playerMarketValue
    ? ` · Valor de mercado: ${formatCompactBRL(offer.playerMarketValue)}`
    : '';
  const potentialText = offer.playerPotentialOvr
    ? ` · Potencial OVR ${offer.playerPotentialOvr}`
    : '';
  return {
    id: `msg-offer-${offer.id}`,
    date: `${offer.createdAtDate} · Mercado`,
    sender: offer.fromClubName,
    senderRole: 'Diretoria Executiva',
    subject: `${dealLabel} por ${offer.playerName} (${formatCompactBRL(
      offer.offeredFee
    )})`,
    category: 'Mercado',
    priority: 'positive',
    read: false,
    relatedPlayerId: offer.playerId,
    relatedOfferId: offer.id,
    body: [
      `O ${offer.fromClubName} formalizou uma ${dealLabel.toLowerCase()} por ${offer.playerName} (${offer.playerPosition}, OVR ${offer.playerOvr}) junto ao ${userClub.shortName}.`,
      offer.dealType === 'LOAN'
        ? `Taxa de empréstimo (cessão por 1 temporada): ${formatCompactBRL(
            offer.offeredFee
          )} com cobertura de ${Math.round(
            offer.wageShareCovered * 100
          )}% dos salários${marketValText}.`
        : `Valor oferecido pela transferência definitiva: ${formatCompactBRL(
            offer.offeredFee
          )}${marketValText}.`,
    ],
    bulletPoints: [
      `Atleta: ${offer.playerName} (${offer.playerPosition} · ${offer.playerAge} anos · ${offer.playerIsStarter ? 'Escalado' : 'Elenco'})`,
      `Avaliação & Potencial: OVR ${offer.playerOvr}${potentialText} (${offer.playerPotentialStars}★)${marketValText}`,
      ...(offer.playerSalary
        ? [
            `Salário atual: ${formatCompactBRL(offer.playerSalary)}/mês${
              offer.playerContractYearsRemaining
                ? ` · Contrato restante: ${offer.playerContractYearsRemaining} ano(s)`
                : ''
            }`,
          ]
        : []),
      `Motivo do interesse: ${offer.rationale}`,
    ],
    actionLabel: 'Analisar no Mercado',
    actionTargetTab: 'market',
  };
}

export type IncomingOfferAction =
  | 'ACCEPT'
  | 'REJECT'
  | 'COUNTER_15'
  | 'COUNTER_30';

export function computeIncomingCounterFee(
  offer: IncomingTransferOffer,
  action: IncomingOfferAction,
  liveMarketValue?: number
): number {
  if (action === 'ACCEPT' || action === 'REJECT') {
    return offer.offeredFee;
  }
  const multiplier = action === 'COUNTER_30' ? 1.3 : 1.15;
  const referenceMv = Math.max(
    50_000,
    liveMarketValue && liveMarketValue > 0
      ? liveMarketValue
      : offer.playerMarketValue || offer.offeredFee
  );
  const isLoan = offer.dealType === 'LOAN';
  const maxRatio = isLoan
    ? action === 'COUNTER_30'
      ? REALISTIC_LOAN_COUNTER_MAX_RATIO
      : 0.19
    : action === 'COUNTER_30'
    ? 1.32
    : 1.25;
  const maxAllowed = referenceMv * maxRatio;
  const rawRequested = offer.offeredFee * multiplier;
  const step = getDynamicFeeStep(
    isLoan ? Math.max(rawRequested, referenceMv * 0.12) : referenceMv,
    isLoan
  );
  const capped = Math.min(rawRequested, Math.max(offer.offeredFee + step, maxAllowed));
  let rounded = Math.round(capped / step) * step;
  if (rounded <= offer.offeredFee) {
    rounded = offer.offeredFee + step;
  }
  if (rounded > maxAllowed && offer.offeredFee < maxAllowed) {
    rounded = Math.max(offer.offeredFee + step, Math.floor(maxAllowed / step) * step);
  }
  return rounded;
}

export function resolveIncomingOfferAction(params: {
  offer: IncomingTransferOffer;
  action: IncomingOfferAction;
  userClub: Club;
  userSquad: Player[];
  aiSquads: Record<string, Player[]>;
  loanedOutPlayers: Player[];
  clubs: Club[];
  dayOffset: number;
  seasonYear: number;
  rng?: () => number;
}): {
  outcome: 'ACCEPTED' | 'REJECTED_BY_USER' | 'COUNTER_REJECTED';
  finalFee: number;
  updatedClubs: Club[];
  updatedUserSquad: Player[];
  updatedAiSquads: Record<string, Player[]>;
  updatedLoanedOutPlayers: Player[];
  updatedOffer: IncomingTransferOffer;
  transferRecord: TransferRecord | null;
  promotedStarterName?: string;
} {
  const {
    offer,
    action,
    userClub,
    userSquad,
    aiSquads,
    loanedOutPlayers,
    clubs,
    dayOffset,
    seasonYear,
    rng = Math.random,
  } = params;

  const dateLabel = formatCalendarDate(dayOffset, seasonYear);

  if (!isTransferWindowOpen(dayOffset)) {
    return {
      outcome: 'REJECTED_BY_USER',
      finalFee: 0,
      updatedClubs: clubs,
      updatedUserSquad: userSquad,
      updatedAiSquads: aiSquads,
      updatedLoanedOutPlayers: loanedOutPlayers,
      updatedOffer: { ...offer, status: 'EXPIRED' },
      transferRecord: null,
    };
  }

  if (action === 'REJECT') {
    return {
      outcome: 'REJECTED_BY_USER',
      finalFee: 0,
      updatedClubs: clubs,
      updatedUserSquad: userSquad,
      updatedAiSquads: aiSquads,
      updatedLoanedOutPlayers: loanedOutPlayers,
      updatedOffer: { ...offer, status: 'REJECTED' },
      transferRecord: null,
    };
  }

  const targetPlayer = userSquad.find((p) => p.id === offer.playerId);
  if (!targetPlayer || userSquad.length <= MIN_SQUAD_SIZE) {
    return {
      outcome: 'REJECTED_BY_USER',
      finalFee: 0,
      updatedClubs: clubs,
      updatedUserSquad: userSquad,
      updatedAiSquads: aiSquads,
      updatedLoanedOutPlayers: loanedOutPlayers,
      updatedOffer: { ...offer, status: 'REJECTED' },
      transferRecord: null,
    };
  }

  const buyerClub = clubs.find((c) => c.id === offer.fromClubId);
  const referenceMv = getCanonicalPlayerMarketValue(targetPlayer, userClub);
  const requestedFee = computeIncomingCounterFee(offer, action, referenceMv);
  const addedSalaryForBuyer =
    offer.dealType === 'LOAN'
      ? Math.round(targetPlayer.salary * offer.wageShareCovered)
      : targetPlayer.salary;
  const buyerFinancialHealth = buyerClub
    ? evaluateClubTransferFinancialHealth({
        club: buyerClub,
        clubSquad: aiSquads[buyerClub.id],
        proposedFee: requestedFee,
        addedMonthlySalary: addedSalaryForBuyer,
        dealType: offer.dealType,
        seasonYear,
      })
    : null;

  // Mesmo em aceite direto, revalida se o clube comprador ainda possui o dinheiro em caixa e saúde financeira
  if (
    action === 'ACCEPT' &&
    buyerClub &&
    (buyerClub.cashBalance < requestedFee ||
      (buyerFinancialHealth && !buyerFinancialHealth.canAffordAndHealthy))
  ) {
    const failedRec: TransferRecord = {
      id: `tr-offer-nocash-${Date.now()}`,
      date: dateLabel,
      type: offer.dealType === 'LOAN' ? 'EMPRESTIMO_OUT' : 'VENDA',
      status: 'RECUSADA',
      playerName: offer.playerName,
      position: offer.playerPosition,
      ovr: offer.playerOvr,
      counterpartyClubName: offer.fromClubName,
      feeAmount: requestedFee,
      monthlySalaryImpact: 0,
      note:
        buyerClub.cashBalance < requestedFee
          ? `${offer.fromClubName} recuou na conclusão: não possui mais ${formatCompactBRL(
              requestedFee
            )} disponíveis em caixa.`
          : `${offer.fromClubName} recuou na conclusão por limite de saúde financeira (${
              buyerFinancialHealth?.reason || 'proteção de caixa e folha'
            }).`,
    };
    return {
      outcome: 'COUNTER_REJECTED',
      finalFee: requestedFee,
      updatedClubs: clubs,
      updatedUserSquad: userSquad,
      updatedAiSquads: aiSquads,
      updatedLoanedOutPlayers: loanedOutPlayers,
      updatedOffer: { ...offer, status: 'REJECTED' },
      transferRecord: failedRec,
    };
  }

  if (action === 'COUNTER_15' || action === 'COUNTER_30') {
    const canBuyerPay = buyerFinancialHealth
      ? buyerFinancialHealth.canAffordAndHealthy
      : true;
    const ratioVsMarket = requestedFee / referenceMv;
    const exceedsRealisticCeiling =
      offer.dealType === 'LOAN' ? ratioVsMarket > 0.23 : ratioVsMarket > 1.33;
    const marketPremiumPenalty =
      offer.dealType === 'LOAN'
        ? ratioVsMarket > 0.18
          ? 0.22
          : 0
        : ratioVsMarket > 1.24
        ? 0.28
        : ratioVsMarket > 1.18
        ? 0.12
        : 0;
    const listedBonus =
      targetPlayer.isTransferListed || targetPlayer.isLoanListed ? 0.10 : 0;
    const baseAcceptProb = Math.max(
      0.08,
      (action === 'COUNTER_15' ? 0.66 : 0.38) + listedBonus - marketPremiumPenalty
    );
    const isAccepted =
      !exceedsRealisticCeiling && canBuyerPay && rng() < baseAcceptProb;

    if (!isAccepted) {
      const financialReasonNote =
        !canBuyerPay && buyerFinancialHealth?.reason
          ? ` (${buyerFinancialHealth.reason})`
          : '';
      const rejectedRec: TransferRecord = {
        id: `tr-counter-rej-${Date.now()}`,
        date: dateLabel,
        type: offer.dealType === 'LOAN' ? 'EMPRESTIMO_OUT' : 'VENDA',
        status: 'RECUSADA',
        playerName: offer.playerName,
        position: offer.playerPosition,
        ovr: offer.playerOvr,
        counterpartyClubName: offer.fromClubName,
        feeAmount: requestedFee,
        monthlySalaryImpact: 0,
        note: `${offer.fromClubName} não aceitou a contraproposta de ${formatCompactBRL(
          requestedFee
        )}${financialReasonNote}.`,
      };
      return {
        outcome: 'COUNTER_REJECTED',
        finalFee: requestedFee,
        updatedClubs: clubs,
        updatedUserSquad: userSquad,
        updatedAiSquads: aiSquads,
        updatedLoanedOutPlayers: loanedOutPlayers,
        updatedOffer: { ...offer, status: 'REJECTED' },
        transferRecord: rejectedRec,
      };
    }
  }

  // Conclude deal (either direct ACCEPT or AI agreed to COUNTER_15 / COUNTER_30)
  const remainingUserSquad = userSquad.filter((p) => p.id !== targetPlayer.id);
  let promotedStarterName: string | undefined;

  if (targetPlayer.isStarter && targetPlayer.slotIndex !== null) {
    const replacement =
      remainingUserSquad.find(
        (p) => !p.isStarter && !p.injured && p.sector === targetPlayer.sector
      ) || remainingUserSquad.find((p) => !p.isStarter);
    if (replacement) {
      promotedStarterName = replacement.name;
      const idx = remainingUserSquad.findIndex((p) => p.id === replacement.id);
      if (idx !== -1) {
        remainingUserSquad[idx] = {
          ...remainingUserSquad[idx],
          isStarter: true,
          slotIndex: targetPlayer.slotIndex,
          assignedRole: targetPlayer.assignedRole,
          assignedDuty: targetPlayer.assignedDuty,
        };
      }
    }
  }

  const nextAiSquads: Record<string, Player[]> = { ...aiSquads };
  if (offer.dealType === 'BUY' && buyerClub) {
    const buyerList = nextAiSquads[buyerClub.id] || [];
    nextAiSquads[buyerClub.id] = [
      ...buyerList,
      {
        ...targetPlayer,
        isStarter: false,
        slotIndex: null,
        contractType: 'DEFINITIVO',
      },
    ];
  }

  const nextLoanedOut =
    offer.dealType === 'LOAN'
      ? [
          ...loanedOutPlayers,
          {
            ...targetPlayer,
            isStarter: false,
            slotIndex: null,
            contractType: 'EMPRESTADO' as const,
            wageSharePaid: Number((1 - offer.wageShareCovered).toFixed(2)),
            loanDestinationClubName: offer.fromClubName,
          },
        ]
      : loanedOutPlayers;

  const monthlyWageRelief =
    offer.dealType === 'LOAN'
      ? Math.round(targetPlayer.salary * offer.wageShareCovered)
      : targetPlayer.salary;

  const updatedClubs = clubs.map((c) => {
    if (c.id === userClub.id) {
      return { ...c, cashBalance: c.cashBalance + requestedFee };
    }
    if (c.id === offer.fromClubId) {
      return { ...c, cashBalance: c.cashBalance - requestedFee };
    }
    return c;
  });

  const counterPct =
    offer.offeredFee > 0
      ? Math.max(1, Math.round(((requestedFee - offer.offeredFee) / offer.offeredFee) * 100))
      : action === 'COUNTER_30'
      ? 30
      : 15;

  const record: TransferRecord = {
    id: `tr-offer-acc-${Date.now()}`,
    date: dateLabel,
    type: offer.dealType === 'LOAN' ? 'EMPRESTIMO_OUT' : 'VENDA',
    status: 'CONCLUIDA',
    playerName: offer.playerName,
    position: offer.playerPosition,
    ovr: offer.playerOvr,
    counterpartyClubName: offer.fromClubName,
    feeAmount: requestedFee,
    monthlySalaryImpact: -monthlyWageRelief,
    note:
      action === 'ACCEPT'
        ? `Proposta aceita de ${offer.fromClubName}.`
        : `Contraproposta (+${counterPct}%) aceita por ${offer.fromClubName}.`,
  };

  return {
    outcome: 'ACCEPTED',
    finalFee: requestedFee,
    updatedClubs,
    updatedUserSquad: remainingUserSquad,
    updatedAiSquads: nextAiSquads,
    updatedLoanedOutPlayers: nextLoanedOut,
    updatedOffer: {
      ...offer,
      offeredFee: requestedFee,
      status: 'ACCEPTED',
    },
    transferRecord: record,
    promotedStarterName,
  };
}
