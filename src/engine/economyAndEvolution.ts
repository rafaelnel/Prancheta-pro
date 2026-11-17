import { calculatePlayerOverall } from './playerOverall';
import {
  Club,
  ClubFinanceLedger,
  CompetitionType,
  NaturalPosition,
  Player,
  PlayerAttributes,
  PlayerEvolutionReportItem,
  PotentialStars,
  SponsorshipContract,
  StandingsRow,
} from '../types/football';

function hashStr(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Maps Potential Stars (1..5) to the maximum realistic OVR ceiling (60..99 scale).
 */
export function getPotentialCeilingOvr(stars: PotentialStars): number {
  switch (stars) {
    case 5:
      return 92;
    case 4:
      return 85;
    case 3:
      return 79;
    case 2:
      return 74;
    case 1:
    default:
      return 69;
  }
}

/**
 * Deterministic initial star potential (1..5) based on current OVR, age, club reputation, and player ID.
 */
export function assignPotentialStars(
  ovr: number,
  age: number,
  clubReputation: number = 78,
  playerId: string = 'p'
): PotentialStars {
  const roll = (hashStr(playerId) % 100) / 100;
  let score = 2.6;

  if (ovr >= 86) score = 4.9;
  else if (ovr >= 82) score = 4.3;
  else if (ovr >= 77) score = 3.7;
  else if (ovr >= 72) score = 3.1;
  else if (ovr >= 67) score = 2.4;
  else score = 1.8;

  // Youth bonus: young players at reputable clubs can have higher ceiling than current OVR
  if (age <= 20) {
    score += 0.95 + (clubReputation >= 80 ? 0.35 : 0) + (roll > 0.65 ? 0.45 : 0);
  } else if (age <= 23) {
    score += 0.5 + (roll > 0.72 ? 0.35 : 0);
  } else if (age >= 32) {
    // Veterans' ceiling reflects remaining peak capacity, never exceeding current tier
    score = Math.min(score, ovr >= 82 ? 4 : ovr >= 76 ? 3 : 2);
  }

  const clamped = Math.max(1, Math.min(5, Math.round(score))) as PotentialStars;
  return clamped;
}

/**
 * Healthy market value and monthly salary calculation based on OVR + Age + Club Relevance + Potential Stars,
 * with strict anti-inflation caps per OVR bracket.
 */
export function calculateBalancedValuationAndWage(params: {
  ovr: number;
  age: number;
  clubReputation: number;
  division: 'A' | 'B' | 'LIB';
  potentialStars: PotentialStars;
}): { marketValue: number; salary: number } {
  const { ovr, age, clubReputation, division, potentialStars } = params;

  // Exponential base on OVR 60..99, normalized cleanly for Brazilian / CONMEBOL market reality
  const t = Math.max(0, ovr - 60);
  let baseVal = 900_000 + Math.pow(t, 2.02) * 185_000;

  // Age multiplier: youngsters with high potential carry premium; 31+ depreciates progressively
  let ageMult = 1.0;
  if (age <= 20) {
    ageMult = 1.25 + (potentialStars >= 4 ? 0.25 : 0);
  } else if (age <= 23) {
    ageMult = 1.15 + (potentialStars >= 4 ? 0.12 : 0);
  } else if (age <= 27) {
    ageMult = 1.05;
  } else if (age <= 30) {
    ageMult = 0.88;
  } else if (age <= 33) {
    ageMult = Math.max(0.42, 0.72 - (age - 31) * 0.12);
  } else {
    ageMult = Math.max(0.22, 0.40 - (age - 34) * 0.05);
  }

  // Potential star multiplier for players under 26
  const potMult =
    age <= 25
      ? 0.85 + potentialStars * 0.08
      : 0.92 + potentialStars * 0.025;

  // Club relevance & division factor
  const divMult = division === 'B' ? 0.72 : division === 'LIB' ? 1.02 : 1.0;
  const repMult = Math.max(0.75, Math.min(1.22, clubReputation / 80));

  // Hard anti-inflation cap per OVR bracket (prevents R$ 500M+ runaway inflation after many seasons)
  const hardValueCap =
    ovr < 70
      ? 12_000_000
      : ovr < 75
      ? 28_000_000
      : ovr < 80
      ? 62_000_000
      : ovr < 85
      ? 115_000_000
      : 190_000_000;

  const rawValue = baseVal * ageMult * potMult * divMult * repMult;
  const marketValue = Math.min(
    hardValueCap,
    Math.max(450_000, Math.round(rawValue / 250_000) * 250_000)
  );

  // Balanced monthly salary aligned with real Série A/B club payrolls (~72-86% of initial wageBudget)
  const baseSalary = 18_000 + Math.pow(t, 1.95) * 950;
  const salaryAgeMult = age >= 33 ? 0.82 : age <= 20 ? 0.72 : 1.0;
  const salaryDivMult = division === 'B' ? 0.68 : 1.0;
  const hardSalaryCap =
    ovr < 70
      ? 115_000
      : ovr < 75
      ? 240_000
      : ovr < 80
      ? 490_000
      : ovr < 85
      ? 920_000
      : 1_550_000;

  const rawSalary = baseSalary * salaryAgeMult * salaryDivMult * repMult;
  const salary = Math.min(
    hardSalaryCap,
    Math.max(20_000, Math.round(rawSalary / 5_000) * 5_000)
  );

  return { marketValue, salary };
}

export function ensurePlayerDefaults(
  player: Player,
  clubReputation: number = 78,
  division: 'A' | 'B' | 'LIB' = 'A'
): Player {
  const ovr = calculatePlayerOverall(player.attributes, player.position);
  const potentialStars =
    player.potentialStars ??
    assignPotentialStars(ovr, player.age, clubReputation, player.id);
  return {
    ...player,
    potentialStars,
    marketValue:
      player.marketValue > 0
        ? player.marketValue
        : calculateBalancedValuationAndWage({
            ovr,
            age: player.age,
            clubReputation,
            division,
            potentialStars,
          }).marketValue,
  };
}

const SPONSOR_BRANDS_BY_TIER: Array<{
  minScore: number;
  tierLabel: string;
  sponsors: string[];
}> = [
  {
    minScore: 86,
    tierLabel: 'Patrocínio Master Elite',
    sponsors: [
      'Banco Nacional Prime',
      'AeroBrasil Global',
      'Energia Sul-América',
      'TechPay Master',
    ],
  },
  {
    minScore: 78,
    tierLabel: 'Patrocínio Master Série A',
    sponsors: [
      'CrediMais Brasil',
      'SuperBet Arena',
      'Veloce Telecom',
      'Grupo Horizonte',
    ],
  },
  {
    minScore: 70,
    tierLabel: 'Patrocínio Regional Premium',
    sponsors: [
      'Rede Construtora Sul',
      'Cooperativa AgroForte',
      'MegaFarma Saúde',
      'Viação Expressa',
    ],
  },
  {
    minScore: 0,
    tierLabel: 'Patrocínio Local',
    sponsors: [
      'Comércio Unido',
      'Supermercados Estádio',
      'Banco Estadual',
      'AutoPeças Centro',
    ],
  },
];

/**
 * Generates an automatic annual sponsorship contract calculated from:
 * Club Reputation + Average Squad OVR + Recent Titles + Division.
 */
export function calculateDynamicSponsorship(
  club: Club,
  squadAvgOvr: number,
  seasonYear: number
): SponsorshipContract {
  const titlesBonus = Math.min(12, (club.recentTitles?.length ?? 0) * 3.5);
  const divBonus = club.division === 'A' ? 6 : 0;
  const compositeScore =
    club.reputation * 0.58 + squadAvgOvr * 0.42 + titlesBonus + divBonus;

  const tier =
    SPONSOR_BRANDS_BY_TIER.find((t) => compositeScore >= t.minScore) ||
    SPONSOR_BRANDS_BY_TIER[SPONSOR_BRANDS_BY_TIER.length - 1];

  const sponsorIdx = (hashStr(club.id) + seasonYear) % tier.sponsors.length;
  const sponsorName = tier.sponsors[sponsorIdx];

  // Annual contract scales smoothly from ~R$ 9M (small Série B) to ~R$ 95M (giant champion)
  const baseAnnual =
    club.division === 'B'
      ? 7_500_000 + Math.max(0, compositeScore - 58) * 650_000
      : 18_000_000 + Math.max(0, compositeScore - 68) * 2_450_000;

  const titleMultiplier = 1 + Math.min(0.32, (club.recentTitles?.length ?? 0) * 0.08);
  const annualValue = Math.min(
    110_000_000,
    Math.max(6_000_000, Math.round((baseAnnual * titleMultiplier) / 500_000) * 500_000)
  );
  const monthlyInstallment = Math.round(annualValue / 12 / 50_000) * 50_000;

  return {
    sponsorName,
    tierLabel: tier.tierLabel,
    annualValue,
    monthlyInstallment,
    basisNote: `Rep. ${Math.round(club.reputation)} · OVR Médio ${Math.round(
      squadAvgOvr
    )} · ${club.recentTitles?.length ?? 0} título(s) recente(s)`,
    seasonYear,
  };
}

/**
 * Calculates realistic home match gate revenue (returns 0 for away matches).
 * Scales by club reputation, stadium capacity, standings form, and match importance.
 */
export function calculateMatchGateRevenue(params: {
  club: Club;
  rank: number;
  totalTeams?: number;
  competition: CompetitionType;
  stageLabel?: string;
  isHome: boolean;
}): { gateRevenue: number; attendance: number } {
  const { club, rank, totalTeams = 20, competition, stageLabel, isHome } = params;
  if (!isHome) {
    return { gateRevenue: 0, attendance: 0 };
  }

  const standingFactor =
    rank <= 4 ? 1.12 : rank <= Math.ceil(totalTeams / 2) ? 1.0 : 0.86;

  let competitionMult = club.division === 'B' ? 0.72 : 1.0;
  let ticketBase = club.division === 'B' ? 62 : 90;

  if (competition === 'COPA_DO_BRASIL') {
    if (stageLabel === 'Final') {
      competitionMult = 1.65;
      ticketBase = 145;
    } else if (stageLabel === 'Semifinal') {
      competitionMult = 1.38;
      ticketBase = 120;
    } else {
      competitionMult = 1.15;
      ticketBase = 95;
    }
  } else if (competition === 'LIBERTADORES') {
    if (stageLabel === 'Final') {
      competitionMult = 1.9;
      ticketBase = 165;
    } else if (stageLabel === 'Semifinal' || stageLabel === 'Quartas') {
      competitionMult = 1.5;
      ticketBase = 135;
    } else {
      competitionMult = 1.25;
      ticketBase = 110;
    }
  }

  const repOccupancy = Math.min(0.96, Math.max(0.45, 0.42 + (club.reputation - 60) * 0.013));
  const occupancy = Math.min(0.98, repOccupancy * standingFactor);
  const attendance = Math.round((club.capacity * occupancy) / 100) * 100;
  const rawRevenue = attendance * ticketBase * Math.max(0.8, competitionMult * 0.92);
  const gateRevenue = Math.max(
    180_000,
    Math.min(18_000_000, Math.round(rawRevenue / 50_000) * 50_000)
  );

  return { gateRevenue, attendance };
}

export function createInitialFinanceLedger(
  club: Club,
  squad: Player[],
  seasonYear: number = 2026
): ClubFinanceLedger {
  const avgOvr =
    squad.length > 0
      ? squad.reduce(
          (sum, p) => sum + calculatePlayerOverall(p.attributes, p.position),
          0
        ) / squad.length
      : 74;
  const contract = calculateDynamicSponsorship(club, avgOvr, seasonYear);

  return {
    seasonYear,
    seasonGateRevenue: 0,
    seasonTransferIncome: 0,
    seasonTransferSpend: 0,
    seasonPrizeRevenue: 0,
    seasonSponsorshipRevenue: contract.monthlyInstallment, // opening signing installment
    seasonOperationalExpense: 0,
    lastMatchGateRevenue: 0,
    lastMatchAttendance: 0,
    sponsorshipContract: contract,
  };
}

/**
 * Anti-inflation season-end upkeep & reserve guardrail applied to ALL clubs at year transition.
 * Deducts proportional stadium/staff/youth operational maintenance and caps excessive cash hoarding.
 */
export function applyAntiInflationSeasonMaintenance(
  club: Club,
  squad: Player[]
): { updatedClub: Club; annualMaintenanceCost: number } {
  const annualPayroll = squad.reduce((s, p) => s + p.salary, 0) * 12;
  const structuralUpkeep =
    club.division === 'B'
      ? 6_500_000 + club.reputation * 95_000
      : 16_000_000 + club.reputation * 260_000;

  const annualMaintenanceCost =
    Math.round((structuralUpkeep + annualPayroll * 0.14) / 250_000) * 250_000;

  // Hard cash reserve ceiling prevents multi-decade billionaire runaway
  const maxHealthyCash =
    club.division === 'B' ? 140_000_000 : club.reputation >= 85 ? 420_000_000 : 280_000_000;
  const minFloorCash = club.division === 'B' ? 4_000_000 : 12_000_000;

  let nextCash = club.cashBalance - Math.round(annualMaintenanceCost * 0.25);
  if (nextCash > maxHealthyCash) {
    // Progressive luxury/infrastructure reinvestment above healthy cap
    nextCash = maxHealthyCash + Math.round((nextCash - maxHealthyCash) * 0.25);
  }
  nextCash = Math.max(minFloorCash, Math.round(nextCash / 100_000) * 100_000);

  // Recalibrate wageBudget proportionally to division, squad payroll, and healthy revenue ceiling
  const currentPayroll = squad.reduce((s, p) => s + p.salary, 0);
  const avgSquadOvr =
    squad.length > 0
      ? squad.reduce(
          (acc, p) => acc + calculatePlayerOverall(p.attributes, p.position),
          0
        ) / squad.length
      : 74;
  const baseDivBudget =
    club.division === 'B'
      ? Math.max(2_200_000, Math.min(7_500_000, Math.round(((avgSquadOvr - 56) * 260_000) / 100_000) * 100_000))
      : Math.max(5_200_000, Math.min(18_000_000, Math.round(((avgSquadOvr - 58) * 620_000) / 100_000) * 100_000));
  const minHealthyRoomBudget = Math.round((currentPayroll * 1.18) / 100_000) * 100_000;
  const hardDivisionWageCap = club.division === 'B' ? 8_000_000 : 20_000_000;
  const nextWageBudget = Math.min(
    hardDivisionWageCap,
    Math.max(baseDivBudget, minHealthyRoomBudget)
  );

  return {
    updatedClub: {
      ...club,
      cashBalance: nextCash,
      wageBudget: nextWageBudget,
    },
    annualMaintenanceCost,
  };
}

function getPositionGroup(pos: NaturalPosition): 'GOL' | 'ZAG' | 'LAT' | 'VOL_MC' | 'MEI_WING' | 'ATA' {
  if (pos === 'GOL') return 'GOL';
  if (pos === 'ZAG') return 'ZAG';
  if (pos === 'LD' || pos === 'LE') return 'LAT';
  if (pos === 'VOL' || pos === 'MC') return 'VOL_MC';
  if (pos === 'MEI' || pos === 'PD' || pos === 'PE') return 'MEI_WING';
  return 'ATA';
}

function computePositionPerformanceScore(player: Player): number {
  const { matches, goals, assists, avgRating } = player.seasonStats;
  if (matches <= 0) return 0;
  const grp = getPositionGroup(player.position);
  const goalsPerMatch = goals / matches;
  const assistsPerMatch = assists / matches;

  switch (grp) {
    case 'ATA':
      return (avgRating - 6.6) * 1.8 + goalsPerMatch * 3.8 + assistsPerMatch * 2.2;
    case 'MEI_WING':
      return (avgRating - 6.6) * 1.8 + goalsPerMatch * 2.5 + assistsPerMatch * 3.5;
    case 'VOL_MC':
      return (avgRating - 6.6) * 2.1 + assistsPerMatch * 2.4 + goalsPerMatch * 1.6;
    case 'LAT':
      return (avgRating - 6.6) * 2.1 + assistsPerMatch * 2.8 + goalsPerMatch * 1.2;
    case 'ZAG':
    case 'GOL':
    default:
      return (avgRating - 6.65) * 2.5 + Math.min(0.6, matches / 45) * 0.5;
  }
}

function adjustAttributesByDelta(
  attrs: PlayerAttributes,
  position: NaturalPosition,
  targetDeltaOvr: number,
  isVeteranPhysicalDecline: boolean,
  rng: () => number
): PlayerAttributes {
  const next = { ...attrs };

  if (isVeteranPhysicalDecline) {
    // 33+ or 29-32 decline targets physical stats first
    const drop = Math.max(1, Math.abs(targetDeltaOvr));
    next.velocidade = Math.max(4, next.velocidade - Math.min(3, drop));
    next.aceleracao = Math.max(4, next.aceleracao - Math.min(3, drop));
    next.resistencia = Math.max(4, next.resistencia - Math.max(1, Math.floor(drop * 0.8)));
    next.agilidade = Math.max(4, next.agilidade - (drop >= 2 ? 1 : 0));
    if (drop >= 3) {
      next.impulsao = Math.max(4, next.impulsao - 1);
      next.forca = Math.max(4, next.forca - 1);
    }
    return next;
  }

  if (targetDeltaOvr === 0) return next;

  const step = targetDeltaOvr > 0 ? 1 : -1;
  const numAttributesToShift = Math.min(
    14,
    Math.max(2, Math.round(Math.abs(targetDeltaOvr) * 2.2))
  );

  const priorityByPos: Record<NaturalPosition, (keyof PlayerAttributes)[]> = {
    GOL: ['posicionamento', 'agilidade', 'impulsao', 'compostura', 'decisoes', 'passe'],
    ZAG: ['desarme', 'posicionamento', 'forca', 'impulsao', 'decisoes', 'compostura', 'passe'],
    LD: ['cruzamento', 'velocidade', 'resistencia', 'desarme', 'passe', 'indiceDeTrabalho'],
    LE: ['cruzamento', 'velocidade', 'resistencia', 'desarme', 'passe', 'indiceDeTrabalho'],
    VOL: ['desarme', 'posicionamento', 'indiceDeTrabalho', 'passe', 'decisoes', 'resistencia'],
    MC: ['passe', 'visaoDeJogo', 'primeiroToque', 'decisoes', 'resistencia', 'compostura'],
    MEI: ['passe', 'visaoDeJogo', 'drible', 'primeiroToque', 'finalizacao', 'semBola'],
    PD: ['drible', 'velocidade', 'aceleracao', 'cruzamento', 'finalizacao', 'agilidade'],
    PE: ['drible', 'velocidade', 'aceleracao', 'cruzamento', 'finalizacao', 'agilidade'],
    ATA: ['finalizacao', 'semBola', 'compostura', 'primeiroToque', 'aceleracao', 'impulsao'],
  };

  const keys = priorityByPos[position];
  for (let i = 0; i < numAttributesToShift; i++) {
    const key = keys[i % keys.length];
    if (rng() < 0.85 || i < 2) {
      next[key] = Math.max(4, Math.min(20, next[key] + step));
    }
  }

  // Ensure overall moves in the intended direction if attributes barely shifted
  let guard = 0;
  const beforeOvr = calculatePlayerOverall(attrs, position);
  while (
    Math.abs(calculatePlayerOverall(next, position) - beforeOvr) <
      Math.min(Math.abs(targetDeltaOvr), 4) &&
    guard < 8
  ) {
    const key = keys[guard % keys.length];
    next[key] = Math.max(4, Math.min(20, next[key] + step));
    guard++;
  }

  return next;
}

/**
 * Executes end-of-season aging (+1 year) and attribute/OVR evolution & regression for ALL players
 * across the user squad, AI club squads, loaned-out players, and free agents.
 */
export function processSeasonEvolutionAndAging(params: {
  clubs: Club[];
  userClubId: string;
  userSquad: Player[];
  aiSquads: Record<string, Player[]>;
  freeAgents: Player[];
  loanedOutPlayers: Player[];
  rng?: () => number;
}): {
  updatedClubs: Club[];
  updatedUserSquad: Player[];
  updatedAiSquads: Record<string, Player[]>;
  updatedFreeAgents: Player[];
  updatedLoanedOut: Player[];
  userEvolutionReport: PlayerEvolutionReportItem[];
} {
  const {
    clubs,
    userClubId,
    userSquad,
    aiSquads,
    freeAgents,
    loanedOutPlayers,
    rng = Math.random,
  } = params;

  const clubMap = new Map(clubs.map((c) => [c.id, c]));

  // 1. Gather all active players to compute peer position benchmarks (Relative Position Ranking)
  const allActivePlayers: Player[] = [
    ...userSquad,
    ...Object.values(aiSquads).flat(),
    ...loanedOutPlayers,
  ];

  const scoresByGroup: Record<string, number[]> = {};
  for (const p of allActivePlayers) {
    if (p.seasonStats.matches < 5) continue;
    const grp = getPositionGroup(p.position);
    if (!scoresByGroup[grp]) scoresByGroup[grp] = [];
    scoresByGroup[grp].push(computePositionPerformanceScore(p));
  }

  const avgByGroup: Record<string, number> = {};
  for (const [grp, vals] of Object.entries(scoresByGroup)) {
    avgByGroup[grp] =
      vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0.4;
  }

  const evolveSinglePlayer = (
    player: Player,
    clubRep: number,
    division: 'A' | 'B' | 'LIB'
  ): { evolved: Player; report: PlayerEvolutionReportItem } => {
    const oldOvr = calculatePlayerOverall(player.attributes, player.position);
    const oldAge = player.age;
    const newAge = oldAge + 1;
    const stars =
      player.potentialStars ??
      assignPotentialStars(oldOvr, oldAge, clubRep, player.id);
    const ceiling = getPotentialCeilingOvr(stars);

    const grp = getPositionGroup(player.position);
    const perfScore = computePositionPerformanceScore(player);
    const peerAvg = avgByGroup[grp] ?? 0.4;
    const relativePerf = perfScore - peerAvg; // >0 = outperformed same-position peers
    const matches = player.seasonStats.matches;

    let desiredDelta = 0;
    let isPhysicalDecline = false;
    let reasonNote = 'Temporada estável';

    if (oldAge <= 22) {
      // Jovens (16-22): +1 a +4 OVR se minutagem + bom desempenho até atingir teto
      if (oldOvr >= ceiling) {
        desiredDelta = relativePerf > 0.7 && stars < 5 ? 0 : 0;
        reasonNote = 'Atingiu teto de potencial atual';
      } else if (matches >= 18 && relativePerf >= 0.35) {
        desiredDelta = Math.min(4, Math.max(2, Math.round(2 + relativePerf)));
        reasonNote = `Destaque jovem (${matches}j, nota ${player.seasonStats.avgRating.toFixed(1)})`;
      } else if (matches >= 8 && relativePerf >= -0.25) {
        desiredDelta = 1 + (rng() > 0.55 ? 1 : 0);
        reasonNote = 'Evolução natural com minutagem';
      } else if (matches >= 4) {
        desiredDelta = rng() > 0.4 ? 1 : 0;
        reasonNote = 'Desenvolvimento gradual';
      } else {
        desiredDelta = 0;
        reasonNote = 'Poucos minutos em campo';
      }
      desiredDelta = Math.min(desiredDelta, Math.max(0, ceiling - oldOvr));
    } else if (oldAge <= 28) {
      // Auge (23-28): +1 a +2 se excelente temporada, 0 normal, -1 se mal
      if (matches >= 20 && relativePerf >= 0.45 && oldOvr < ceiling) {
        desiredDelta = relativePerf >= 0.95 && oldOvr + 2 <= ceiling ? 2 : 1;
        reasonNote = `Grande temporada no auge (nota ${player.seasonStats.avgRating.toFixed(1)})`;
      } else if (matches >= 10 && relativePerf < -0.55) {
        desiredDelta = -1;
        reasonNote = 'Queda técnica por baixo rendimento';
      } else {
        desiredDelta = 0;
        reasonNote = 'Manutenção de nível no auge';
      }
    } else if (oldAge <= 32) {
      // Veteranos (29-32): mantém técnico/mental se jogar bem, leve queda física
      if (matches >= 18 && relativePerf >= 0.3) {
        desiredDelta = 0;
        reasonNote = 'Experiência mantém alto nível';
      } else {
        desiredDelta = -1;
        isPhysicalDecline = true;
        reasonNote = 'Início de desgaste físico natural';
      }
    } else {
      // Fim de carreira (33+): regressão natural (-1 a -4 OVR) focada em atributos físicos
      const ageSeverity = newAge >= 37 ? 3 : newAge >= 35 ? 2 : 1;
      const perfMitigation = matches >= 20 && relativePerf >= 0.45 ? 0 : 1;
      desiredDelta = -Math.min(4, ageSeverity + perfMitigation);
      isPhysicalDecline = true;
      reasonNote = 'Declínio físico natural pela idade';
    }

    const updatedAttrs = adjustAttributesByDelta(
      player.attributes,
      player.position,
      desiredDelta,
      isPhysicalDecline,
      rng
    );
    const newOvr = calculatePlayerOverall(updatedAttrs, player.position);

    const { marketValue, salary } = calculateBalancedValuationAndWage({
      ovr: newOvr,
      age: newAge,
      clubReputation: clubRep,
      division,
      potentialStars: stars,
    });

    const evolved: Player = {
      ...player,
      age: newAge,
      potentialStars: stars,
      attributes: updatedAttrs,
      marketValue,
      salary,
      condition: 94,
      injured: false,
      injuryNote: undefined,
      seasonStats: {
        matches: 0,
        goals: 0,
        assists: 0,
        yellowCards: 0,
        avgRating: Number((6.75 + Math.max(0, (newOvr - 68) * 0.03)).toFixed(2)),
      },
    };

    return {
      evolved,
      report: {
        playerId: player.id,
        playerName: player.name,
        position: player.position,
        oldAge,
        newAge,
        oldOvr,
        newOvr,
        deltaOvr: newOvr - oldOvr,
        potentialStars: stars,
        reasonNote,
      },
    };
  };

  const userClub = clubMap.get(userClubId) || clubs[0];
  const userEvoPairs = userSquad.map((p) =>
    evolveSinglePlayer(p, userClub.reputation, userClub.division)
  );
  const updatedUserSquad = userEvoPairs.map((pair) => pair.evolved);
  const userEvolutionReport = userEvoPairs.map((pair) => pair.report);

  const updatedAiSquads: Record<string, Player[]> = {};
  for (const [cid, list] of Object.entries(aiSquads)) {
    const c = clubMap.get(cid);
    updatedAiSquads[cid] = list.map(
      (p) =>
        evolveSinglePlayer(
          p,
          c?.reputation ?? 74,
          c?.division ?? 'A'
        ).evolved
    );
  }

  const updatedLoanedOut = loanedOutPlayers.map(
    (p) =>
      evolveSinglePlayer(p, userClub.reputation, userClub.division).evolved
  );

  // Free agents: age +1, retire >= 41 by refreshing with younger available talents
  const updatedFreeAgents = freeAgents.map((fa) => {
    const res = evolveSinglePlayer(fa, 72, 'A').evolved;
    if (res.age >= 41) {
      const ovr = calculatePlayerOverall(res.attributes, res.position);
      const stars: PotentialStars = 2;
      const { marketValue, salary } = calculateBalancedValuationAndWage({
        ovr,
        age: 26,
        clubReputation: 72,
        division: 'A',
        potentialStars: stars,
      });
      return {
        ...res,
        age: 26,
        potentialStars: stars,
        marketValue,
        salary,
      };
    }
    return res;
  });

  // Recalculate club sector ratings (Attack / Midfield / Defense) from evolved squads
  const computeClubSectorOvrs = (squad: Player[]) => {
    const starters = squad.filter((p) => p.isStarter);
    const pool = starters.length >= 11 ? starters : squad.slice(0, 11);
    const avgSec = (sectors: Player['sector'][], fallback: number) => {
      const matching = pool.filter((p) => sectors.includes(p.sector));
      if (matching.length === 0) return fallback;
      const sum = matching.reduce(
        (acc, p) => acc + calculatePlayerOverall(p.attributes, p.position),
        0
      );
      return Math.min(99, Math.max(60, Math.round(sum / matching.length)));
    };
    return {
      overallAttack: avgSec(['ATA'], 72),
      overallMidfield: avgSec(['MEI'], 72),
      overallDefense: avgSec(['GOL', 'DEF'], 72),
    };
  };

  const updatedClubs = clubs.map((club) => {
    const sq =
      club.id === userClubId ? updatedUserSquad : updatedAiSquads[club.id];
    if (!sq || sq.length === 0) return club;
    const sec = computeClubSectorOvrs(sq);
    return {
      ...club,
      overallAttack: sec.overallAttack,
      overallMidfield: sec.overallMidfield,
      overallDefense: sec.overallDefense,
    };
  });

  return {
    updatedClubs,
    updatedUserSquad,
    updatedAiSquads,
    updatedFreeAgents,
    updatedLoanedOut,
    userEvolutionReport,
  };
}
