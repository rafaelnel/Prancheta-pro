import { getRealSquadForClub } from '../data/initialDatabase';
import { FORMATIONS } from '../data/tacticsData';
import { calculatePlayerOverall } from './playerOverall';
import { assignPotentialStars } from './economyAndEvolution';
import { MIN_GOALKEEPERS, MIN_SQUAD_SIZE, isTransferWindowOpen } from './transferEngine';
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
      club.cashBalance < 3_800_000 &&
      posCount >= 2 &&
      posGroup[1] &&
      posGroup[1].ovr >= ovr - 2 &&
      player.marketValue >= 10_000_000 &&
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

  let posture: AiClubMarketProfile['posture'] = 'EQUILIBRADO';
  let postureLabel = 'Equilibrado (Compra & Venda Pontual)';
  let preferredIncomingMode: AiClubMarketProfile['preferredIncomingMode'] =
    'AMBOS';

  if (club.cashBalance >= 16_000_000 && wageUsagePct <= 84) {
    posture = 'COMPRADOR';
    postureLabel = 'Comprador Ativo (Busca Titulares)';
    preferredIncomingMode = 'COMPRA';
  } else if (club.cashBalance < 5_500_000 || wageUsagePct >= 90) {
    posture = 'VENDEDOR_ALIVIO_FOLHA';
    postureLabel = 'Vendedor & Alívio de Folha';
    preferredIncomingMode = 'EMPRESTIMO';
  } else if (club.cashBalance < 10_000_000) {
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
    return Math.min(99, Math.max(60, Math.round(sum / list.length)));
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
    // Pick a buying/borrowing club with positional needs and budget headroom
    const buyers = aiClubIndices.filter((item) => {
      if (item.club.cashBalance < 1_500_000) return false;
      const sq = workingSquads[item.club.id];
      if (sq.length >= 27) return false;
      const payroll = sq.reduce((s, p) => s + p.salary, 0);
      return item.club.wageBudget - payroll >= 80_000;
    });
    if (buyers.length === 0) break;

    const buyerPick = buyers[Math.floor(rng() * buyers.length)];
    const buyer = buyerPick.club;
    const buyerSquad = workingSquads[buyer.id];
    const buyerPayroll = buyerSquad.reduce((s, p) => s + p.salary, 0);
    const remainingWageRoom = buyer.wageBudget - buyerPayroll;
    if (remainingWageRoom < 80_000) continue;

    const buyerProfile = analyzeAiClubMarketProfile(buyer, buyerSquad);
    const neededPositions = buyerProfile.neededPositions;
    const neededSector =
      buyerProfile.neededSectors[0] || findWeakestSector(buyerSquad);

    // Pick candidate sellers that have depth and players listed or matching buyer's needs
    const candidateSellers = aiClubIndices.filter(
      (item) =>
        item.club.id !== buyer.id &&
        workingSquads[item.club.id].length > MIN_SQUAD_SIZE + 1 &&
        item.club.reputation <= buyer.reputation + 8
    );
    if (candidateSellers.length === 0) continue;

    // Score available targets across candidate sellers
    const targetPool: {
      sellerPick: (typeof aiClubIndices)[number];
      player: Player;
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

        // Decide if this would be a loan or purchase based on club listing & buyer posture
        const prefersLoan =
          buyerProfile.preferredIncomingMode === 'EMPRESTIMO' ||
          Boolean(p.isLoanListed && !p.isTransferListed) ||
          (p.age <= 23 && !p.isStarter && seller.reputation > buyer.reputation);

        const estFee = prefersLoan
          ? Math.max(
              150_000,
              Math.round((p.marketValue * 0.1) / 50_000) * 50_000
            )
          : Math.max(
              500_000,
              Math.round(
                (p.marketValue * (p.isTransferListed ? 0.88 : 1.0)) / 100_000
              ) * 100_000
            );

        const estSalaryForBuyer = prefersLoan
          ? Math.round(p.salary * 0.8)
          : p.salary;

        if (estFee > buyer.cashBalance * 0.65) continue;
        if (estSalaryForBuyer > remainingWageRoom * 1.05) continue;

        let score = ovr;
        if (matchesExactPos) score += 18;
        else if (matchesSector) score += 9;
        if (p.isTransferListed || p.isLoanListed) score += 20;
        if (!p.isStarter) score += 8;

        targetPool.push({
          sellerPick,
          player: p,
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
    const isLoan = chosen.isLoanDeal;

    const fee = isLoan
      ? Math.max(
          150_000,
          Math.round((targetPlayer.marketValue * 0.1) / 50_000) * 50_000
        )
      : Math.max(
          500_000,
          Math.round(
            (targetPlayer.marketValue *
              (targetPlayer.isTransferListed ? 0.88 : 0.96 + rng() * 0.12)) /
              100_000
          ) * 100_000
        );

    if (buyer.cashBalance < fee) continue;

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
        assignPotentialStars(ovr, p.age, userClub.reputation, p.id);
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

  const minBuyCashRequired = isListed
    ? Math.max(2_500_000, p.marketValue * 0.85)
    : Math.max(4_000_000, p.marketValue * 0.92);

  const minLoanCashRequired = Math.max(800_000, p.marketValue * 0.12);

  const minCashRequired = forceLoanOnly
    ? minLoanCashRequired
    : forceBuyOnly
    ? minBuyCashRequired
    : minLoanCashRequired;

  const minRepRequired = isListed
    ? Math.max(60, picked.ovr - 16)
    : Math.max(66, picked.ovr - 11);

  // Pick a plausible interested AI club with cash, prioritizing clubs whose strategic profile needs this exact position
  let interestedClubs = clubs.filter(
    (c) =>
      c.id !== userClub.id &&
      c.cashBalance >= minCashRequired &&
      c.reputation >= minRepRequired
  );
  // If no club can afford a definitive purchase of a high-OVR star (e.g. 88 OVR worth R$ 60M+),
  // allow top-reputation clubs (reputation >= 80) backed by transfer financing so offers are never artificially tiny
  if (interestedClubs.length === 0 && !forceLoanOnly) {
    interestedClubs = clubs.filter(
      (c) =>
        c.id !== userClub.id &&
        c.reputation >= Math.max(78, minRepRequired) &&
        c.cashBalance >= Math.max(5_000_000, p.marketValue * 0.35)
    );
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
  // Prefer richer clubs for purchase offers
  const sortedBuyerPool = [...buyerPool].sort(
    (a, b) => b.cashBalance - a.cashBalance
  );
  const topBuyers = sortedBuyerPool.slice(
    0,
    Math.max(1, Math.min(4, sortedBuyerPool.length))
  );
  const buyer = topBuyers[Math.floor(rng() * topBuyers.length)];
  const buyerSq = aiSquads?.[buyer.id] || [];
  const buyerProfile =
    buyerSq.length > 0 ? analyzeAiClubMarketProfile(buyer, buyerSq) : null;

  const buyerCanAffordFullBuy = buyer.cashBalance >= p.marketValue * 0.85;

  const isLoan = forceLoanOnly
    ? true
    : forceBuyOnly
    ? false
    : !buyerCanAffordFullBuy && (p.isLoanListed || p.age <= 24 || !p.isStarter)
    ? true
    : buyerProfile?.preferredIncomingMode === 'EMPRESTIMO' && !p.isTransferListed
    ? true
    : (!p.isStarter || p.age <= 22 || p.isLoanListed) && rng() < 0.35;

  const feeMultiplier = isListed ? 0.92 + rng() * 0.16 : 0.96 + rng() * 0.20;

  // Never cap a purchase offer below 88% of the player's marketValue — OVR & marketValue dictate transfer price!
  const targetBuyFee = Math.max(
    750_000,
    Math.round((p.marketValue * feeMultiplier) / 250_000) * 250_000
  );
  const minCoherentBuyFee = Math.max(
    750_000,
    Math.round((p.marketValue * 0.88) / 250_000) * 250_000
  );

  const rawFee = isLoan
    ? Math.max(250_000, Math.round((p.marketValue * 0.13) / 50_000) * 50_000)
    : Math.max(
        minCoherentBuyFee,
        buyer.cashBalance >= targetBuyFee
          ? targetBuyFee
          : Math.max(
              minCoherentBuyFee,
              Math.round((buyer.cashBalance * 0.92) / 250_000) * 250_000
            )
      );

  if (rawFee < 250_000) return null;

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
    dealType: isLoan ? 'LOAN' : 'BUY',
    offeredFee: rawFee,
    wageShareCovered: isLoan ? 0.9 : 1.0,
    expiresDayOffset: dayOffset + 18,
    negotiationStep: 0,
    status: 'PENDING',
    rationale: `${buyer.shortName} ${needDetail} e propõe ${
      isLoan ? 'empréstimo' : 'compra definitiva'
    } (${reasonParts.join(' · ')}).`,
  };
}

export function createOfferInboxMessage(
  offer: IncomingTransferOffer,
  userClub: Club
): InboxMessage {
  const dealLabel =
    offer.dealType === 'LOAN' ? 'Proposta de Empréstimo' : 'Proposta Oficial de Compra';
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
        ? `Valor oferecido pela cessão: ${formatCompactBRL(
            offer.offeredFee
          )} com cobertura de ${Math.round(
            offer.wageShareCovered * 100
          )}% dos salários.`
        : `Valor oferecido pela transferência definitiva: ${formatCompactBRL(
            offer.offeredFee
          )}.`,
    ],
    bulletPoints: [
      `Atleta: ${offer.playerName} (${offer.playerPosition} · ${offer.playerAge} anos · ${offer.playerPotentialStars}★)`,
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
  const multiplier =
    action === 'COUNTER_30' ? 1.3 : action === 'COUNTER_15' ? 1.15 : 1.0;
  const requestedFee = Math.round((offer.offeredFee * multiplier) / 50_000) * 50_000;

  if (action === 'COUNTER_15' || action === 'COUNTER_30') {
    const canBuyerPay = buyerClub ? buyerClub.cashBalance >= requestedFee : true;
    const listedBonus =
      targetPlayer.isTransferListed || targetPlayer.isLoanListed ? 0.14 : 0;
    const baseAcceptProb =
      (action === 'COUNTER_15' ? 0.68 : 0.42) + listedBonus;
    const isAccepted = canBuyerPay && rng() < baseAcceptProb;

    if (!isAccepted) {
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
        )}.`,
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
      return { ...c, cashBalance: Math.max(1_000_000, c.cashBalance - requestedFee) };
    }
    return c;
  });

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
        : `Contraproposta (+${action === 'COUNTER_30' ? '30%' : '15%'}) aceita por ${
            offer.fromClubName
          }.`,
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
