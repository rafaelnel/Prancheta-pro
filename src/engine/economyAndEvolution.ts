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
  InboxMessage,
} from '../types/football';

function hashStr(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface DynamicPotentialProfile {
  stars: PotentialStars;
  basePotentialMin: number;
  basePotentialMax: number;
  basePotentialOvr: number;
  dynamicCeilingOvr: number;
}

/**
 * Dynamic Potential Mechanism (Performance Ceiling):
 * 3.0★: Base Potential 76–78 (Dynamic Ceiling: 80)
 * 3.5★: Base Potential 81–83 (Dynamic Ceiling: 85)
 * 4.0★: Base Potential 86–88 (Dynamic Ceiling: 90)
 * 4.5★: Base Potential 91–93 (Dynamic Ceiling: 95)
 * 5.0★: Base Potential 95–96 (Dynamic Ceiling: 99)
 */
export function getDynamicPotentialProfile(
  stars: PotentialStars,
  rng: () => number = Math.random
): DynamicPotentialProfile {
  if (stars >= 5) {
    return {
      stars: 5,
      basePotentialMin: 95,
      basePotentialMax: 96,
      basePotentialOvr: rng() < 0.5 ? 95 : 96,
      dynamicCeilingOvr: 99,
    };
  }
  if (stars >= 4.5) {
    return {
      stars: 4.5,
      basePotentialMin: 91,
      basePotentialMax: 93,
      basePotentialOvr: 91 + Math.floor(rng() * 3),
      dynamicCeilingOvr: 95,
    };
  }
  if (stars >= 4) {
    return {
      stars: 4,
      basePotentialMin: 86,
      basePotentialMax: 88,
      basePotentialOvr: 86 + Math.floor(rng() * 3),
      dynamicCeilingOvr: 90,
    };
  }
  if (stars >= 3.5) {
    return {
      stars: 3.5,
      basePotentialMin: 81,
      basePotentialMax: 83,
      basePotentialOvr: 81 + Math.floor(rng() * 3),
      dynamicCeilingOvr: 85,
    };
  }
  if (stars >= 3) {
    return {
      stars: 3,
      basePotentialMin: 76,
      basePotentialMax: 78,
      basePotentialOvr: 76 + Math.floor(rng() * 3),
      dynamicCeilingOvr: 80,
    };
  }
  if (stars >= 2.5) {
    return {
      stars: 2.5,
      basePotentialMin: 70,
      basePotentialMax: 72,
      basePotentialOvr: 70 + Math.floor(rng() * 3),
      dynamicCeilingOvr: 75,
    };
  }
  if (stars >= 2) {
    return {
      stars: 2,
      basePotentialMin: 67,
      basePotentialMax: 69,
      basePotentialOvr: 67 + Math.floor(rng() * 3),
      dynamicCeilingOvr: 72,
    };
  }
  return {
    stars: stars ?? 1,
    basePotentialMin: 63,
    basePotentialMax: 66,
    basePotentialOvr: 63 + Math.floor(rng() * 4),
    dynamicCeilingOvr: 68,
  };
}

/**
 * Maps Potential Stars (1..5, with half-stars) to the maximum realistic dynamic OVR ceiling (60..99 scale).
 */
export function getPotentialCeilingOvr(stars: PotentialStars): number {
  if (stars >= 5) return 99;
  if (stars >= 4.5) return 95;
  if (stars >= 4) return 90;
  if (stars >= 3.5) return 85;
  if (stars >= 3) return 80;
  if (stars >= 2.5) return 75;
  if (stars >= 2) return 72;
  return 68;
}

/**
 * Returns the maximum realistic OVR a player can have at a given age and star potential.
 * Young players (15–20) scale naturally and only reach peak 90+ in their twenties if they perform on pitch.
 */
export function getMaxRealisticOvrForAgeAndPotential(
  age: number,
  stars: PotentialStars,
  player?: { basePotentialOvr?: number; dynamicCeilingOvr?: number }
): number {
  const profile = getDynamicPotentialProfile(stars);
  const careerCeiling = player?.dynamicCeilingOvr ?? profile.dynamicCeilingOvr;

  let ageCap = careerCeiling;
  if (age <= 15) {
    ageCap = stars >= 5 ? 67 : stars >= 4 ? 64 : 62;
  } else if (age === 16) {
    ageCap = stars >= 5 ? 70 : stars >= 4 ? 66 : 64;
  } else if (age === 17) {
    ageCap = stars >= 5 ? 73 : stars >= 4 ? 69 : 66;
  } else if (age === 18) {
    ageCap = stars >= 5 ? 76 : stars >= 4 ? 72 : 68;
  } else if (age === 19) {
    ageCap = stars >= 5 ? 80 : stars >= 4 ? 76 : 71;
  } else if (age === 20) {
    ageCap = stars >= 5 ? 84 : stars >= 4 ? 80 : 74;
  } else if (age === 21) {
    ageCap = stars >= 5 ? 88 : stars >= 4 ? 84 : 77;
  } else if (age === 22) {
    ageCap = stars >= 5 ? 92 : stars >= 4 ? 87 : 80;
  }

  return Math.min(careerCeiling, ageCap);
}

/**
 * Smoothly calibrates a 1..20 attribute set so `calculatePlayerOverall(attrs, position)`
 * lands on `targetOvr` (within ±1) and never exceeds `maxOvr`.
 */
export function calibrateAttributesToTargetOvr(
  attrs: PlayerAttributes,
  position: NaturalPosition,
  targetOvr: number,
  maxOvr: number = targetOvr
): PlayerAttributes {
  const next: PlayerAttributes = { ...attrs };
  const allKeys = Object.keys(next) as Array<keyof PlayerAttributes>;

  // First, if any attributes are exaggerated (e.g., 19-20 on a young player), scale toward a sensible base
  const curOvr = calculatePlayerOverall(next, position);
  if (curOvr > maxOvr + 4) {
    // Convert targetOvr (60..89) to approximate 1..20 raw weighted average (12.0..18.5)
    const t = Math.max(0, Math.min(1, (targetOvr - 60) / 39));
    const targetRaw = 12.0 + Math.pow(t, 1 / 1.42) * 8.0;
    const avgAttr =
      allKeys.reduce((acc, k) => acc + next[k], 0) / allKeys.length;
    const scale = avgAttr > 0 ? (targetRaw - 0.8) / avgAttr : 0.7;

    for (const k of allKeys) {
      next[k] = Math.max(5, Math.min(19, Math.round(next[k] * scale)));
    }
  }

  const priorityByPos: Record<NaturalPosition, (keyof PlayerAttributes)[]> = {
    GOL: ['posicionamento', 'agilidade', 'impulsao', 'compostura', 'decisoes', 'passe', 'forca'],
    ZAG: ['desarme', 'posicionamento', 'forca', 'impulsao', 'decisoes', 'compostura', 'passe', 'velocidade'],
    LD: ['velocidade', 'aceleracao', 'resistencia', 'cruzamento', 'desarme', 'indiceDeTrabalho', 'posicionamento', 'passe', 'drible'],
    LE: ['velocidade', 'aceleracao', 'resistencia', 'cruzamento', 'desarme', 'indiceDeTrabalho', 'posicionamento', 'passe', 'drible'],
    VOL: ['desarme', 'posicionamento', 'indiceDeTrabalho', 'resistencia', 'passe', 'decisoes', 'forca', 'compostura'],
    MC: ['passe', 'visaoDeJogo', 'primeiroToque', 'decisoes', 'resistencia', 'indiceDeTrabalho', 'compostura', 'desarme', 'semBola'],
    MEI: ['passe', 'visaoDeJogo', 'primeiroToque', 'drible', 'decisoes', 'semBola', 'agilidade', 'finalizacao'],
    PD: ['drible', 'velocidade', 'aceleracao', 'agilidade', 'primeiroToque', 'semBola', 'cruzamento', 'finalizacao', 'passe'],
    PE: ['drible', 'velocidade', 'aceleracao', 'agilidade', 'primeiroToque', 'semBola', 'cruzamento', 'finalizacao', 'passe'],
    ATA: ['finalizacao', 'semBola', 'compostura', 'primeiroToque', 'decisoes', 'aceleracao', 'forca', 'impulsao'],
  };

  const posKeys = priorityByPos[position];
  let guard = 0;

  while (guard < 80) {
    guard++;
    const current = calculatePlayerOverall(next, position);
    if (current > maxOvr) {
      const k = posKeys[guard % posKeys.length];
      if (next[k] > 5) next[k] -= 1;
      else {
        const anyKey = allKeys[guard % allKeys.length];
        if (next[anyKey] > 5) next[anyKey] -= 1;
      }
    } else if (current < targetOvr - 1) {
      const k = posKeys[guard % posKeys.length];
      if (next[k] < 19) next[k] += 1;
    } else {
      break;
    }
  }

  return next;
}

/**
 * Deterministic initial star potential (1..5) based on current OVR, age, club reputation, and player ID.
 * 5★ is reserved for true elite stars or rare young phenomena.
 */
export function assignPotentialStars(
  ovr: number,
  age: number,
  clubReputation: number = 78,
  playerId: string = 'p'
): PotentialStars {
  const roll = (hashStr(playerId) % 100) / 100;
  let score = 2.4;

  if (ovr >= 85) score = 4.8;
  else if (ovr >= 81) score = 4.2;
  else if (ovr >= 77) score = 3.6;
  else if (ovr >= 72) score = 3.1;
  else if (ovr >= 67) score = 2.6;
  else score = 1.9;

  // Controlled youth upside
  if (age <= 20) {
    score += 0.55 + (clubReputation >= 82 ? 0.2 : 0) + (roll > 0.88 ? 0.6 : roll > 0.65 ? 0.3 : 0);
  } else if (age <= 23) {
    score += 0.35 + (roll > 0.82 ? 0.35 : 0);
  } else if (age >= 32) {
    score = Math.min(score, ovr >= 82 ? 4 : ovr >= 76 ? 3.5 : 2.5);
  }

  const roundedHalf = Math.round(score * 2) / 2;
  const clamped = Math.max(1, Math.min(5, roundedHalf)) as PotentialStars;
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
  let attributes = player.attributes;
  let ovr = calculatePlayerOverall(attributes, player.position);
  const potentialStars =
    player.potentialStars ??
    assignPotentialStars(ovr, player.age, clubReputation, player.id);

  // Sanitize any young player or regen whose OVR is unrealistically high for their age/stars
  const maxAllowedForAge = getMaxRealisticOvrForAgeAndPotential(
    player.age,
    potentialStars
  );
  if ((player.age <= 22 || player.isRegen) && ovr > maxAllowedForAge) {
    const realisticTarget = player.isRegen
      ? Math.min(
          maxAllowedForAge,
          61 +
            Math.max(0, player.age - 15) * 2 +
            (potentialStars === 5 ? 4 : potentialStars === 4 ? 2 : 0)
        )
      : maxAllowedForAge;
    attributes = calibrateAttributesToTargetOvr(
      attributes,
      player.position,
      realisticTarget,
      maxAllowedForAge
    );
    ovr = calculatePlayerOverall(attributes, player.position);
    const recalc = calculateBalancedValuationAndWage({
      ovr,
      age: Math.max(16, player.age),
      clubReputation,
      division,
      potentialStars,
    });
    return {
      ...player,
      attributes,
      potentialStars,
      basePotentialOvr: player.basePotentialOvr ?? getDynamicPotentialProfile(potentialStars).basePotentialOvr,
      dynamicCeilingOvr: player.dynamicCeilingOvr ?? getDynamicPotentialProfile(potentialStars).dynamicCeilingOvr,
      marketValue: recalc.marketValue,
      salary: player.isRegen
        ? Math.max(15_000, Math.round((recalc.salary * 0.45) / 5_000) * 5_000)
        : recalc.salary,
    };
  }

  const dynProfile = getDynamicPotentialProfile(potentialStars);
  const basePotentialOvr = player.basePotentialOvr ?? dynProfile.basePotentialOvr;
  const dynamicCeilingOvr = player.dynamicCeilingOvr ?? dynProfile.dynamicCeilingOvr;

  const initialOvrDelta =
    player.recentOvrDelta !== undefined
      ? player.recentOvrDelta
      : player.age <= 20 && potentialStars >= 4
      ? 2
      : player.age <= 22
      ? 1
      : player.age >= 34
      ? -2
      : player.age >= 32
      ? -1
      : 0;

  return {
    ...player,
    attributes,
    potentialStars,
    basePotentialOvr,
    dynamicCeilingOvr,
    recentOvrDelta: initialOvrDelta,
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
  maxAllowedOvr: number,
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

  const beforeOvr = calculatePlayerOverall(attrs, position);
  const desiredOvr =
    targetDeltaOvr > 0
      ? Math.min(maxAllowedOvr, beforeOvr + targetDeltaOvr)
      : Math.max(60, beforeOvr + targetDeltaOvr);

  if (desiredOvr === beforeOvr) return next;

  const step = desiredOvr > beforeOvr ? 1 : -1;

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
  let guard = 0;

  while (guard < 24) {
    const curOvr = calculatePlayerOverall(next, position);
    if (step > 0 && curOvr >= desiredOvr) break;
    if (step < 0 && curOvr <= desiredOvr) break;

    const key = keys[guard % keys.length];
    if (rng() < 0.85 || guard >= keys.length) {
      const candidateVal = Math.max(4, Math.min(19, next[key] + step));
      const prevVal = next[key];
      next[key] = candidateVal;
      // Prevent overshooting maxAllowedOvr on upward steps
      if (step > 0 && calculatePlayerOverall(next, position) > maxAllowedOvr) {
        next[key] = prevVal;
        break;
      }
    }
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
    const dynProfile = getDynamicPotentialProfile(stars);
    const basePot = player.basePotentialOvr ?? dynProfile.basePotentialOvr;
    const dynCeiling = player.dynamicCeilingOvr ?? dynProfile.dynamicCeilingOvr;

    const grp = getPositionGroup(player.position);
    const perfScore = computePositionPerformanceScore(player);
    const peerAvg = avgByGroup[grp] ?? 0.4;
    const relativePerf = perfScore - peerAvg; // >0 = outperformed same-position peers
    const matches = player.seasonStats.matches;

    // A player only unlocks the dynamic ceiling beyond base potential if they render in matches
    const hasRenderedInMatches =
      matches >= 16 && (player.seasonStats.avgRating >= 7.15 || relativePerf >= 0.25);
    const effectiveCeiling = hasRenderedInMatches ? dynCeiling : basePot;
    const ceiling = Math.min(
      effectiveCeiling,
      getMaxRealisticOvrForAgeAndPotential(newAge, stars, {
        basePotentialOvr: basePot,
        dynamicCeilingOvr: effectiveCeiling,
      })
    );

    const goalsAndAssists = player.seasonStats.goals + player.seasonStats.assists;
    const isAttackerOrMid = ['ATA', 'PD', 'PE', 'MEI', 'MC'].includes(player.position);
    const hasStandoutGnA = isAttackerOrMid && (goalsAndAssists >= 12 || player.seasonStats.goals >= 10);

    // Exceptional season: high minutes + high rating, or high relative perf, or outstanding goals/assists
    const isExceptionalSeason =
      matches >= 16 &&
      (player.seasonStats.avgRating >= 7.22 || relativePerf >= 0.55 || hasStandoutGnA);

    // Performance deficiency: potential does NOT grant future OVR if performance is poor or absent
    const hasLowMinutes = matches < 7;
    const hasPoorPerformance =
      matches >= 7 && (player.seasonStats.avgRating < 6.62 || relativePerf < -0.35);

    let isBreakoutSeason = false;
    let starsPromoted = false;
    let nextStars = stars;
    let effectiveMaxOvr = ceiling;
    let desiredDelta = 0;
    let isPhysicalDecline = false;
    let reasonNote = 'Temporada regular';
    let developmentStatus:
      | 'SUPEROU_EXPECTATIVAS'
      | 'EVOLUCAO_NORMAL'
      | 'ESTAGNADO'
      | 'DECLINIO_TECNICO'
      | 'REGRESSAO_FISICA' = 'EVOLUCAO_NORMAL';

    if (isExceptionalSeason) {
      // ⚡ SUPEROU EXPECTATIVAS: Rompe o teto de potencial teórico!
      isBreakoutSeason = true;
      developmentStatus = 'SUPEROU_EXPECTATIVAS';
      const breakoutBonus =
        relativePerf >= 0.85 || player.seasonStats.avgRating >= 7.35 || goalsAndAssists >= 15 ? 3 : 2;
      effectiveMaxOvr = Math.min(99, Math.max(oldOvr + 2, ceiling + breakoutBonus));

      desiredDelta = Math.min(
        4,
        Math.max(2, Math.round(2.0 + (relativePerf > 0 ? relativePerf * 0.9 : 0.4)))
      );

      if (stars < 5) {
        nextStars = Math.min(5, stars + (stars <= 3 ? 1 : 0.5)) as PotentialStars;
        starsPromoted = nextStars > stars;
      }

      reasonNote = `⚡ Superou expectativas! Temporada estelar (${matches}j, nota ${player.seasonStats.avgRating.toFixed(1)}${player.seasonStats.goals > 0 ? `, ${player.seasonStats.goals}g` : ''}${player.seasonStats.assists > 0 ? `, ${player.seasonStats.assists}a` : ''}) rompeu o teto de potencial (+${desiredDelta} OVR)!`;
    } else if (hasPoorPerformance) {
      // Jogou mas atuou mal: potencial não protege contra queda técnica
      desiredDelta = -1;
      developmentStatus = 'DECLINIO_TECNICO';
      if (stars >= 3.5 && matches >= 12 && player.seasonStats.avgRating < 6.5) {
        nextStars = Math.max(1, stars - 0.5) as PotentialStars;
      }
      reasonNote = `Baixo rendimento em campo (${matches}j, nota ${player.seasonStats.avgRating.toFixed(1)}) provocou estagnação e queda de nível técnico (-1 OVR).`;
    } else if (hasLowMinutes) {
      // Poucos minutos: potencial não evolui sem minutagem
      desiredDelta = 0;
      developmentStatus = 'ESTAGNADO';
      reasonNote = `Falta de minutagem em campo (${matches}j) impediu o desenvolvimento do potencial.`;
    } else if (oldAge <= 22) {
      // Jovens (16-22) com desempenho regular
      if (oldOvr >= ceiling) {
        desiredDelta = 0;
        reasonNote = 'Desempenho estável dentro do teto regular da categoria';
      } else {
        desiredDelta = oldOvr >= 75 ? (rng() > 0.5 ? 1 : 0) : 1;
        reasonNote = `Evolução gradual compatível com o desempenho na temporada (${matches}j, nota ${player.seasonStats.avgRating.toFixed(1)})`;
      }
      desiredDelta = Math.min(desiredDelta, Math.max(0, ceiling - oldOvr));
      developmentStatus = desiredDelta > 0 ? 'EVOLUCAO_NORMAL' : 'ESTAGNADO';
    } else if (oldAge <= 28) {
      // Auge (23-28) com desempenho regular
      desiredDelta = 0;
      developmentStatus = 'EVOLUCAO_NORMAL';
      reasonNote = 'Manutenção de nível regular no auge da carreira';
    } else if (oldAge <= 32) {
      // Veteranos (29-32)
      if (matches >= 18 && relativePerf >= 0.25) {
        desiredDelta = 0;
        developmentStatus = 'EVOLUCAO_NORMAL';
        reasonNote = 'Experiência manteve o alto nível regular';
      } else {
        desiredDelta = -1;
        isPhysicalDecline = true;
        developmentStatus = 'REGRESSAO_FISICA';
        reasonNote = 'Início de desgaste físico natural com a idade';
      }
    } else {
      // 33+
      const ageSeverity = newAge >= 37 ? 3 : newAge >= 35 ? 2 : 1;
      const perfMitigation = matches >= 20 && relativePerf >= 0.45 ? 0 : 1;
      desiredDelta = -Math.min(4, ageSeverity + perfMitigation);
      isPhysicalDecline = true;
      developmentStatus = 'REGRESSAO_FISICA';
      reasonNote = 'Declínio físico natural pela idade';
    }

    const updatedAttrs = adjustAttributesByDelta(
      player.attributes,
      player.position,
      desiredDelta,
      effectiveMaxOvr,
      isPhysicalDecline,
      rng
    );
    const newOvr = calculatePlayerOverall(updatedAttrs, player.position);
    const breakoutBonusOvr = isBreakoutSeason ? Math.max(0, newOvr - ceiling) : 0;
    const newDynamicCeiling = Math.max(dynCeiling, newOvr);

    const { marketValue, salary } = calculateBalancedValuationAndWage({
      ovr: newOvr,
      age: newAge,
      clubReputation: clubRep,
      division,
      potentialStars: nextStars,
    });

    const evolved: Player = {
      ...player,
      age: newAge,
      potentialStars: nextStars,
      dynamicCeilingOvr: newDynamicCeiling,
      attributes: updatedAttrs,
      marketValue,
      salary,
      recentOvrDelta: newOvr - oldOvr,
      exceededExpectations: isBreakoutSeason,
      breakoutBonusOvr,
      developmentStatus,
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
        potentialStars: nextStars,
        reasonNote,
        exceededExpectations: isBreakoutSeason,
        formerCeiling: ceiling,
        starsPromoted,
        developmentStatus,
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

/**
 * Computes semiannual player evolution (around July 1st) based on first half performance stats,
 * setting recentOvrDelta and generating an inbox report.
 */
export function processMidSeasonEvolution(params: {
  clubs: Club[];
  userClubId: string;
  userSquad: Player[];
  aiSquads: Record<string, Player[]>;
  loanedOutPlayers: Player[];
  currentYear: number;
  rng?: () => number;
}): {
  updatedClubs: Club[];
  updatedUserSquad: Player[];
  updatedAiSquads: Record<string, Player[]>;
  updatedLoanedOut: Player[];
  evolutionHighlights: PlayerEvolutionReportItem[];
  inboxMessage: InboxMessage;
} {
  const {
    clubs,
    userClubId,
    userSquad,
    aiSquads,
    loanedOutPlayers,
    currentYear,
    rng = Math.random,
  } = params;

  const clubMap = new Map(clubs.map((c) => [c.id, c]));

  const allActivePlayers: Player[] = [
    ...userSquad,
    ...Object.values(aiSquads).flat(),
    ...loanedOutPlayers,
  ];

  const scoresByGroup: Record<string, number[]> = {};
  for (const p of allActivePlayers) {
    if (p.seasonStats.matches < 3) continue;
    const grp = getPositionGroup(p.position);
    if (!scoresByGroup[grp]) scoresByGroup[grp] = [];
    scoresByGroup[grp].push(computePositionPerformanceScore(p));
  }

  const avgByGroup: Record<string, number> = {};
  for (const [grp, vals] of Object.entries(scoresByGroup)) {
    avgByGroup[grp] =
      vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0.4;
  }

  const evaluateMidSeasonPlayer = (
    player: Player,
    clubRep: number,
    division: 'A' | 'B' | 'LIB'
  ): { evolved: Player; report: PlayerEvolutionReportItem } => {
    const oldOvr = calculatePlayerOverall(player.attributes, player.position);
    const oldAge = player.age;
    const stars =
      player.potentialStars ??
      assignPotentialStars(oldOvr, oldAge, clubRep, player.id);
    const dynProfile = getDynamicPotentialProfile(stars);
    const basePot = player.basePotentialOvr ?? dynProfile.basePotentialOvr;
    const dynCeiling = player.dynamicCeilingOvr ?? dynProfile.dynamicCeilingOvr;

    const grp = getPositionGroup(player.position);
    const perfScore = computePositionPerformanceScore(player);
    const peerAvg = avgByGroup[grp] ?? 0.4;
    const relativePerf = perfScore - peerAvg;
    const matches = player.seasonStats.matches;

    const hasRenderedInMatches =
      matches >= 8 && (player.seasonStats.avgRating >= 7.1 || relativePerf >= 0.2);
    const effectiveCeiling = hasRenderedInMatches ? dynCeiling : basePot;
    const ceiling = Math.min(
      effectiveCeiling,
      getMaxRealisticOvrForAgeAndPotential(oldAge, stars, {
        basePotentialOvr: basePot,
        dynamicCeilingOvr: effectiveCeiling,
      })
    );

    const goalsAndAssists = player.seasonStats.goals + player.seasonStats.assists;
    const isAttackerOrMid = ['ATA', 'PD', 'PE', 'MEI', 'MC'].includes(player.position);
    const hasStandoutGnA = isAttackerOrMid && (goalsAndAssists >= 8 || player.seasonStats.goals >= 7);

    // Destaque extraordinário de 1º turno: minutagem sólida + nota alta ou participação direta
    const isExceptionalMidSeason =
      matches >= 10 &&
      (player.seasonStats.avgRating >= 7.25 || relativePerf >= 0.50 || hasStandoutGnA);

    // Deficiência de rendimento: potencial não garante OVR sem estatísticas
    const hasLowMinutesMidSeason = matches < 4;
    const hasPoorPerformanceMidSeason =
      matches >= 6 && (player.seasonStats.avgRating < 6.55 || relativePerf < -0.40);

    let isBreakoutSeason = false;
    let starsPromoted = false;
    let nextStars = stars;
    let effectiveMaxOvr = ceiling;
    let desiredDelta = 0;
    let isPhysicalDecline = false;
    let reasonNote = 'Primeiro turno regular';
    let developmentStatus:
      | 'SUPEROU_EXPECTATIVAS'
      | 'EVOLUCAO_NORMAL'
      | 'ESTAGNADO'
      | 'DECLINIO_TECNICO'
      | 'REGRESSAO_FISICA' = 'EVOLUCAO_NORMAL';

    if (isExceptionalMidSeason) {
      // ⚡ SUPEROU EXPECTATIVAS NO MEIO DA TEMPORADA
      isBreakoutSeason = true;
      developmentStatus = 'SUPEROU_EXPECTATIVAS';
      const breakoutBonus =
        relativePerf >= 0.70 || player.seasonStats.avgRating >= 7.35 || goalsAndAssists >= 10 ? 2 : 1;
      effectiveMaxOvr = Math.min(99, Math.max(oldOvr + 1, ceiling + breakoutBonus));
      desiredDelta = Math.min(2, Math.max(1, Math.round(1.0 + (relativePerf > 0.4 ? 0.5 : 0))));

      if (stars < 5 && (relativePerf >= 0.55 || player.seasonStats.avgRating >= 7.30)) {
        nextStars = Math.min(5, stars + 0.5) as PotentialStars;
        starsPromoted = nextStars > stars;
      }

      reasonNote = `⚡ Superou expectativas no 1º turno! Estatísticas estelares (${matches}j, nota ${player.seasonStats.avgRating.toFixed(1)}${player.seasonStats.goals > 0 ? `, ${player.seasonStats.goals}g` : ''}${player.seasonStats.assists > 0 ? `, ${player.seasonStats.assists}a` : ''}) romperam o teto de potencial (+${desiredDelta} OVR)!`;
    } else if (hasPoorPerformanceMidSeason) {
      desiredDelta = -1;
      developmentStatus = 'DECLINIO_TECNICO';
      reasonNote = `Baixo rendimento em campo (${matches}j, nota ${player.seasonStats.avgRating.toFixed(1)}) gerou declínio técnico no 1º turno (-1 OVR).`;
    } else if (oldAge <= 22 && hasLowMinutesMidSeason) {
      desiredDelta = 0;
      developmentStatus = 'ESTAGNADO';
      reasonNote = `Falta de minutagem no 1º turno (${matches}j) estagnou o desenvolvimento do potencial.`;
    } else if (oldAge <= 22) {
      if (oldOvr < ceiling && matches >= 6 && relativePerf >= 0.15) {
        desiredDelta = 1;
        developmentStatus = 'EVOLUCAO_NORMAL';
        reasonNote = `Destaque jovem no 1º turno (${matches}j, nota ${player.seasonStats.avgRating.toFixed(1)})`;
      } else {
        desiredDelta = 0;
        developmentStatus = 'ESTAGNADO';
        reasonNote = 'Evolução em andamento no primeiro turno';
      }
    } else if (oldAge <= 28) {
      if (matches >= 8 && relativePerf >= 0.35 && oldOvr < ceiling) {
        desiredDelta = 1;
        developmentStatus = 'EVOLUCAO_NORMAL';
        reasonNote = `Excelente 1º turno (nota ${player.seasonStats.avgRating.toFixed(1)})`;
      } else if (matches >= 8 && relativePerf < -0.45) {
        desiredDelta = -1;
        developmentStatus = 'DECLINIO_TECNICO';
        reasonNote = 'Queda de rendimento técnico no 1º turno';
      } else {
        desiredDelta = 0;
        developmentStatus = 'EVOLUCAO_NORMAL';
        reasonNote = 'Desempenho estável no 1º turno';
      }
    } else if (oldAge >= 32) {
      if (matches >= 8 && relativePerf < -0.3) {
        desiredDelta = -1;
        isPhysicalDecline = true;
        developmentStatus = 'REGRESSAO_FISICA';
        reasonNote = 'Desgaste físico no 1º turno';
      } else {
        desiredDelta = 0;
        developmentStatus = 'EVOLUCAO_NORMAL';
        reasonNote = 'Experiência mantém regularidade';
      }
    }

    const updatedAttrs = adjustAttributesByDelta(
      player.attributes,
      player.position,
      desiredDelta,
      effectiveMaxOvr,
      isPhysicalDecline,
      rng
    );
    const newOvr = calculatePlayerOverall(updatedAttrs, player.position);
    const deltaOvr = newOvr - oldOvr;
    const breakoutBonusOvr = isBreakoutSeason ? Math.max(0, newOvr - ceiling) : 0;
    const newDynamicCeiling = Math.max(dynCeiling, newOvr);

    const { marketValue, salary } = calculateBalancedValuationAndWage({
      ovr: newOvr,
      age: oldAge,
      clubReputation: clubRep,
      division,
      potentialStars: nextStars,
    });

    const evolved: Player = {
      ...player,
      potentialStars: nextStars,
      dynamicCeilingOvr: newDynamicCeiling,
      attributes: updatedAttrs,
      marketValue,
      salary,
      recentOvrDelta: deltaOvr,
      exceededExpectations: isBreakoutSeason,
      breakoutBonusOvr,
      developmentStatus,
    };

    return {
      evolved,
      report: {
        playerId: player.id,
        playerName: player.name,
        position: player.position,
        oldAge,
        newAge: oldAge,
        oldOvr,
        newOvr,
        deltaOvr,
        potentialStars: nextStars,
        reasonNote,
        exceededExpectations: isBreakoutSeason,
        formerCeiling: ceiling,
        starsPromoted,
        developmentStatus,
      },
    };
  };

  const userClub = clubMap.get(userClubId) || clubs[0];
  const userEvoPairs = userSquad.map((p) =>
    evaluateMidSeasonPlayer(p, userClub.reputation, userClub.division)
  );
  const updatedUserSquad = userEvoPairs.map((pair) => pair.evolved);
  const userEvolutionReport = userEvoPairs.map((pair) => pair.report);

  const updatedAiSquads: Record<string, Player[]> = {};
  for (const [cid, list] of Object.entries(aiSquads)) {
    const c = clubMap.get(cid);
    updatedAiSquads[cid] = list.map(
      (p) =>
        evaluateMidSeasonPlayer(
          p,
          c?.reputation ?? 74,
          c?.division ?? 'A'
        ).evolved
    );
  }

  const updatedLoanedOut = loanedOutPlayers.map(
    (p) =>
      evaluateMidSeasonPlayer(p, userClub.reputation, userClub.division).evolved
  );

  const sortedHighlights = [...userEvolutionReport].sort(
    (a, b) => Math.abs(b.deltaOvr) - Math.abs(a.deltaOvr)
  );

  const topUp = sortedHighlights.find((h) => h.deltaOvr > 0);
  const topDown = sortedHighlights.find((h) => h.deltaOvr < 0);

  const inboxMessage: InboxMessage = {
    id: `msg-midseason-evo-${currentYear}`,
    date: `01 Jul ${currentYear} · 09:00`,
    sender: 'Comissão Técnica',
    senderRole: 'Análise Semestral de OVR',
    subject: `Avaliação Semestral de Desempenho & Evolução (${currentYear})`,
    category: 'Tática',
    priority: 'positive',
    read: false,
    body: [
      `A comissão técnica concluiu a reavalianção de OVR de meio de temporada (1º turno) com base no desempenho e minutagem dos atletas em campo.`,
      topUp
        ? `Destaque positivo: ${topUp.playerName} evoluiu para OVR ${topUp.newOvr} (▲ +${topUp.deltaOvr}).`
        : 'Plantel manteve estabilidade geral no 1º turno.',
      topDown
        ? `Atenção: ${topDown.playerName} registrou queda para OVR ${topDown.newOvr} (▼ ${topDown.deltaOvr}).`
        : 'Nenhuma regressão acentuada registrada.',
    ],
    bulletPoints: sortedHighlights
      .filter((h) => h.deltaOvr !== 0)
      .slice(0, 6)
      .map(
        (h) =>
          `${h.playerName} (${h.position}): ${h.oldOvr} → ${h.newOvr} (${h.deltaOvr > 0 ? `▲ +${h.deltaOvr}` : `▼ ${h.deltaOvr}`}) · ${h.reasonNote}`
      ),
    actionLabel: 'Ver Elenco',
    actionTargetTab: 'squad',
  };

  return {
    updatedClubs: clubs,
    updatedUserSquad,
    updatedAiSquads,
    updatedLoanedOut,
    evolutionHighlights: sortedHighlights,
    inboxMessage,
  };
}
