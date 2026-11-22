import { calculatePlayerOverall } from './playerOverall';
import {
  Club,
  ClubDivision,
  ClubFinanceLedger,
  CompetitionType,
  NaturalPosition,
  Player,
  PlayerAttributes,
  PlayerEvolutionReportItem,
  PotentialStars,
  RetiredPlayerReportItem,
  SponsorshipContract,
  StandingsRow,
  InboxMessage,
} from '../types/football';

export const GLOBAL_SCALE_VERSION = 6;

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
 * Dynamic Potential Mechanism (Global Pyramid: Série B -> Série A/Libertadores -> UEFA Champions League Elite):
 * 2.0★: Base Potential 65–67 (Dynamic Ceiling: 69)
 * 2.5★: Base Potential 68–71 (Dynamic Ceiling: 73)
 * 3.0★: Base Potential 72–75 (Dynamic Ceiling: 77)
 * 3.5★: Base Potential 76–79 (Dynamic Ceiling: 81)
 * 4.0★: Base Potential 80–83 (Dynamic Ceiling: 85)
 * 4.5★: Base Potential 85–88 (Dynamic Ceiling: 90)
 * 5.0★: Base Potential 90–93 (Dynamic Ceiling: 95)
 */
export function getDynamicPotentialProfile(
  stars: PotentialStars,
  rng: () => number = Math.random,
  currentOvr?: number,
  age?: number
): DynamicPotentialProfile {
  let baseMin = 60;
  let baseMax = 62;
  let ceiling = 64;
  let normalizedStars: PotentialStars = stars ?? 1;

  if (stars >= 5) {
    normalizedStars = 5;
    baseMin = 90;
    baseMax = 93;
    ceiling = 95;
  } else if (stars >= 4.5) {
    normalizedStars = 4.5;
    baseMin = 85;
    baseMax = 88;
    ceiling = 90;
  } else if (stars >= 4) {
    normalizedStars = 4;
    baseMin = 80;
    baseMax = 83;
    ceiling = 85;
  } else if (stars >= 3.5) {
    normalizedStars = 3.5;
    baseMin = 76;
    baseMax = 79;
    ceiling = 81;
  } else if (stars >= 3) {
    normalizedStars = 3;
    baseMin = 72;
    baseMax = 75;
    ceiling = 77;
  } else if (stars >= 2.5) {
    normalizedStars = 2.5;
    baseMin = 68;
    baseMax = 71;
    ceiling = 73;
  } else if (stars >= 2) {
    normalizedStars = 2;
    baseMin = 65;
    baseMax = 67;
    ceiling = 69;
  } else if (stars >= 1.5) {
    normalizedStars = 1.5;
    baseMin = 62;
    baseMax = 64;
    ceiling = 66;
  }

  let basePotentialOvr = baseMin + Math.floor(rng() * (baseMax - baseMin + 1));
  let dynamicCeilingOvr = ceiling;

  if (typeof currentOvr === 'number' && typeof age === 'number') {
    if (age >= 30) {
      basePotentialOvr = currentOvr;
      dynamicCeilingOvr = currentOvr;
    } else if (age >= 26) {
      const margin = age <= 27 ? 3 : 1;
      basePotentialOvr = Math.max(currentOvr, Math.min(basePotentialOvr, currentOvr + margin));
      dynamicCeilingOvr = Math.max(basePotentialOvr, Math.min(dynamicCeilingOvr, currentOvr + margin + 1));
    } else {
      const maxGrowth = age <= 19 ? 15 : age <= 21 ? 12 : age <= 23 ? 8 : 6;
      basePotentialOvr = Math.max(currentOvr, Math.min(basePotentialOvr, currentOvr + maxGrowth));
      dynamicCeilingOvr = Math.max(basePotentialOvr, Math.min(dynamicCeilingOvr, basePotentialOvr + (age <= 21 ? 3 : 2)));
    }
  } else if (typeof currentOvr === 'number') {
    basePotentialOvr = Math.max(currentOvr, basePotentialOvr);
    dynamicCeilingOvr = Math.max(basePotentialOvr, dynamicCeilingOvr);
  }

  return {
    stars: normalizedStars,
    basePotentialMin: baseMin,
    basePotentialMax: baseMax,
    basePotentialOvr,
    dynamicCeilingOvr,
  };
}

/**
 * Maps Potential Stars (1..5, with half-stars) to the maximum realistic dynamic OVR ceiling (60..95 scale).
 */
export function getPotentialCeilingOvr(stars: PotentialStars): number {
  if (stars >= 5) return 95;
  if (stars >= 4.5) return 90;
  if (stars >= 4) return 85;
  if (stars >= 3.5) return 81;
  if (stars >= 3) return 77;
  if (stars >= 2.5) return 73;
  if (stars >= 2) return 69;
  if (stars >= 1.5) return 66;
  return 64;
}

/**
 * Returns the maximum realistic OVR a player can have at a given age and star potential.
 * Supports generational European wonderkids (e.g. Lamine Yamal at 18-19 with 88-89 OVR)
 * while keeping standard youth prospects properly tiered.
 */
export function getMaxRealisticOvrForAgeAndPotential(
  age: number,
  stars: PotentialStars,
  player?: { basePotentialOvr?: number; dynamicCeilingOvr?: number; exceededExpectations?: boolean }
): number {
  const profile = getDynamicPotentialProfile(stars);
  const careerCeiling = player?.dynamicCeilingOvr ?? profile.dynamicCeilingOvr;

  const youthStarCap =
    stars >= 5 ? 90 : stars >= 4.5 ? 86 : stars >= 4 ? 81 : stars >= 3.5 ? 77 : stars >= 3 ? 74 : 70;

  let ageCap = careerCeiling;
  if (age <= 17) {
    ageCap = youthStarCap;
  } else if (age === 18) {
    ageCap = Math.max(youthStarCap, stars >= 5 ? 90 : stars >= 4.5 ? 86 : stars >= 4 ? 81 : stars >= 3.5 ? 77 : stars >= 3 ? 75 : 71);
  } else if (age === 19) {
    ageCap = Math.max(youthStarCap, stars >= 5 ? 91 : stars >= 4.5 ? 86 : stars >= 4 ? 82 : stars >= 3.5 ? 78 : stars >= 3 ? 76 : 71);
  } else if (age === 20) {
    ageCap = Math.max(youthStarCap, stars >= 5 ? 92 : stars >= 4.5 ? 87 : stars >= 4 ? 82 : stars >= 3.5 ? 78 : stars >= 3 ? 77 : 72);
  } else if (age === 21) {
    ageCap = Math.max(youthStarCap, stars >= 5 ? 93 : stars >= 4.5 ? 88 : stars >= 4 ? 83 : stars >= 3.5 ? 79 : stars >= 3 ? 78 : 73);
  } else if (age === 22) {
    ageCap = Math.max(youthStarCap, stars >= 5 ? 94 : stars >= 4.5 ? 89 : stars >= 4 ? 84 : stars >= 3.5 ? 80 : stars >= 3 ? 79 : 73);
  }

  // Players who already broke past their initial star ceiling (late bloomers / sleeper gems)
  // keep their unlocked dynamicCeilingOvr instead of being snapped back down.
  if (player?.exceededExpectations || (typeof player?.dynamicCeilingOvr === 'number' && player.dynamicCeilingOvr > profile.dynamicCeilingOvr)) {
    return Math.min(95, Math.max(careerCeiling, ageCap));
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
    const t = Math.max(0, Math.min(1, (targetOvr - 60) / 35));
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

  const maxAttrAllowed = targetOvr >= 88 ? 20 : 19;

  while (guard < 90) {
    guard++;
    const current = calculatePlayerOverall(next, position);
    if (current > maxOvr) {
      const k = posKeys[guard % posKeys.length];
      if (next[k] > 5) next[k] -= 1;
      else {
        const anyKey = allKeys[guard % allKeys.length];
        if (next[anyKey] > 5) next[anyKey] -= 1;
      }
    } else if (current < targetOvr) {
      const k = posKeys[guard % posKeys.length];
      if (next[k] < maxAttrAllowed) {
        next[k] += 1;
      } else {
        const anyKey = allKeys[guard % allKeys.length];
        if (next[anyKey] < maxAttrAllowed) next[anyKey] += 1;
      }
    } else {
      break;
    }
  }

  return next;
}

function getAgeProjectionBonus(age: number, ovr: number = 75): number {
  if (age <= 17) return 11.5;
  if (age === 18) return 9.2;
  if (age === 19) return 8.0;
  if (age === 20) return 7.0;
  if (age === 21) return 5.5;
  if (age === 22) return 3.8;
  if (age === 23) return 1.8;
  if (age === 24) return 0.5;
  if (age <= 29) return 0;
  // Proven 85+ world-class veterans suffer milder scouting expectation decay than standard players
  if (ovr >= 85) return -Math.min(1.5, (age - 29) * 0.25);
  return -Math.min(2.5, (age - 29) * 0.4);
}

/**
 * Iconic generational superstars & outliers whose historical or youth career projection
 * is 5.0★ regardless of current veteran age or U21 OVR stage
 * (e.g., Neymar Jr., Lionel Messi, Luis Suárez, Endrick).
 */
export function isIconicFiveStarExpectation(playerName?: string): boolean {
  if (!playerName) return false;
  const norm = playerName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return (
    norm.includes('neymar') ||
    norm.includes('lionel messi') ||
    norm.includes('luis suarez') ||
    norm === 'endrick' ||
    norm.startsWith('endrick ')
  );
}

/**
 * Deterministic global star projection (1.0★ to 5.0★) calibrated on the 60..95 OVR scale.
 * Stars represent scout PROJECTION & EXPECTATION (career ceiling vs age peers), not raw current OVR:
 * - Age-adjusted projection lifts young standouts who outperform their age peer group even before hitting 85–90 OVR
 *   (e.g., Lamine Yamal, Estêvão, Endrick, Désiré Doué at 5★; Vitor Roque, Rayan, Ryan Francisco, Breno Bidon,
 *   Jair Cunha, Gabriel Carvalho, Kendry Páez, Franco Mastantuono, Vitor Reis, Lucas Beraldo at 4.5★).
 * - Iconic generational legends (e.g., Neymar Jr., Lionel Messi, Luis Suárez) keep their historical 5.0★ badge.
 * - 5.0★ remains genuinely rare (~1.1% globally), split cleanly between generational youth projections and Ballon d'Or outliers.
 * - Authentic late-bloomers / overachievers apply only to non-elite (<=81 OVR, <=4.0★) players so world-class stars are never distorted.
 */
export function assignPotentialStars(
  ovr: number,
  age: number,
  _clubReputation: number = 78,
  playerId: string = 'p',
  playerName?: string
): PotentialStars {
  if (isIconicFiveStarExpectation(playerName)) {
    return 5.0;
  }

  const projectedPeak = ovr + getAgeProjectionBonus(age, ovr);
  let score = 2.0;

  if (projectedPeak >= 91.0) score = 5.0;
  else if (projectedPeak >= 83.5) score = 4.5;
  else if (projectedPeak >= 78.5) score = 4.0;
  else if (projectedPeak >= 74.5) score = 3.5;
  else if (projectedPeak >= 70.5) score = 3.0;
  else if (projectedPeak >= 66.5) score = 2.5;
  else if (projectedPeak >= 63.0) score = 2.0;
  else score = 1.5;

  // Authentic late-bloomers / overachievers: limited to non-elite (<=81 OVR, <=4.0★) so world-class stars (e.g. Raphinha, Valverde, Mac Allister, Caicedo) keep their true star tier.
  const h = hashStr(playerId) % 100;
  if (age >= 24 && score <= 4.0 && ovr <= 81 && h < 18) {
    score = Math.max(2.5, score - (h < 5 && ovr <= 77 ? 1.0 : 0.5));
  }

  const roundedHalf = Math.round(score * 2) / 2;
  return Math.max(1, Math.min(5, roundedHalf)) as PotentialStars;
}

const AGE_MARKET_MULT_BY_YEAR: Record<number, number> = {
  16: 1.44,
  17: 1.41,
  18: 1.38,
  19: 1.34,
  20: 1.30,
  21: 1.26,
  22: 1.22,
  23: 1.18,
  24: 1.14,
  25: 1.10,
  26: 1.05,
  27: 1.00,
  28: 0.94,
  29: 0.87,
  30: 0.78,
  31: 0.69,
  32: 0.61,
  33: 0.54,
  34: 0.47,
  35: 0.41,
  36: 0.35,
  37: 0.30,
  38: 0.26,
  39: 0.22,
  40: 0.19,
};

/**
 * 2025/2026 Transfermarkt-calibrated market value and monthly salary calculation (1 EUR ≈ R$ 6,00).
 * Strictly monotonic by construction across all tiers (60..95 OVR, ages 16..45, stars 1.0..5.0):
 * - Younger > Older (equal OVR, potential, club, position)
 * - Higher Potential > Lower Potential (equal OVR, age, club, position)
 * - Higher OVR > Lower OVR (equal age, potential, club, position)
 */
export function calculateBalancedValuationAndWage(params: {
  ovr: number;
  age: number;
  clubReputation: number;
  division: ClubDivision;
  potentialStars: PotentialStars;
  position?: NaturalPosition;
}): { marketValue: number; salary: number } {
  const { ovr, age, clubReputation, division, potentialStars, position } = params;

  // 1. Youth potential upside blended smoothly (strictly non-increasing with age)
  const ceiling = getPotentialCeilingOvr(potentialStars);
  const upsideWeight =
    age <= 17
      ? 0.18
      : age === 18
      ? 0.17
      : age === 19
      ? 0.15
      : age === 20
      ? 0.13
      : age === 21
      ? 0.11
      : age === 22
      ? 0.09
      : age === 23
      ? 0.06
      : age === 24
      ? 0.04
      : age === 25
      ? 0.02
      : 0;
  const upsideBonus =
    ceiling > ovr && upsideWeight > 0 ? (ceiling - ovr) * upsideWeight : 0;
  const effectiveOvr = ovr + upsideBonus;

  // 2. Transfermarkt convex OVR curve (60..95) with linear slope at base so every +1 OVR separates cleanly
  const u = Math.max(0, effectiveOvr - 60);
  const baseVal = 1_800_000 + u * 450_000 + Math.pow(u, 3.25) * 6_400;

  // 3. Strictly monotonically decreasing age multiplier (no plateaus or retention clamps)
  const ageMult =
    age <= 16
      ? 1.44 + (16 - age) * 0.03
      : age <= 40
      ? AGE_MARKET_MULT_BY_YEAR[age]
      : Math.max(0.06, 0.19 - (age - 40) * 0.02);

  // 4. Star projection multiplier across ALL ages (higher potential always worth more)
  const potMult = 0.85 + potentialStars * 0.06;

  // 5. Position market premium (attackers & creative mids command higher fees than goalkeepers)
  let posMult = 1.0;
  if (position === 'GOL') posMult = 0.78;
  else if (
    position === 'ZAG' ||
    position === 'LD' ||
    position === 'LE' ||
    position === 'VOL'
  ) {
    posMult = 0.92;
  } else if (position === 'MC' || position === 'MEI') {
    posMult = 1.02;
  } else if (position === 'PD' || position === 'PE' || position === 'ATA') {
    posMult = 1.12;
  }

  // 6. Club relevance & division market multiplier
  const isEuropean =
    division === 'UCL' || division === 'PL' || division === 'LALIGA';
  const isGlobal = division === 'WORLD';
  const divMult =
    division === 'B'
      ? 0.54
      : division === 'LIB'
      ? 0.96
      : division === 'UCL'
      ? 1.25
      : division === 'PL'
      ? 1.18
      : division === 'LALIGA'
      ? 1.12
      : isGlobal
      ? 1.10
      : 1.0;
  const repMult = Math.max(
    0.70,
    Math.min(
      division === 'UCL' ? 1.40 : isEuropean ? 1.32 : 1.22,
      Math.pow(clubReputation / 85, 1.15)
    )
  );

  const rawValue = baseVal * ageMult * potMult * posMult * divMult * repMult;
  const step =
    rawValue < 2_000_000
      ? 1_000
      : rawValue < 8_000_000
      ? 10_000
      : rawValue < 30_000_000
      ? 50_000
      : 250_000;
  const marketValue = Math.min(
    2_400_000_000,
    Math.max(50_000, Math.round(rawValue / step) * step)
  );

  // 7. Realistic 2025/2026 monthly gross salaries aligned with club budgets (BRL, 1 EUR = R$ 6,00)
  const t = Math.max(0, ovr - 60);
  const baseSalary = 25_000 + t * 8_000 + Math.pow(t, 2.15) * 1_050;
  const salaryAgeMult =
    age >= 34
      ? 1.28
      : age >= 31
      ? 1.20
      : age >= 28
      ? 1.10
      : age >= 24
      ? 1.0
      : age >= 21
      ? 0.82
      : 0.68;
  const salaryDivMult =
    division === 'B'
      ? 0.62
      : division === 'LIB'
      ? 0.90
      : division === 'UCL'
      ? 3.15
      : division === 'PL'
      ? 2.55
      : division === 'LALIGA'
      ? 2.05
      : isGlobal
      ? 1.85
      : 1.05;
  const salaryRepMult = Math.max(
    0.60,
    Math.min(
      division === 'UCL' ? 1.85 : isEuropean ? 1.55 : 1.32,
      Math.pow(clubReputation / 85, 1.25)
    )
  );
  const hardSalaryCap = isEuropean
    ? ovr < 76
      ? 1_800_000
      : ovr < 81
      ? 3_800_000
      : ovr < 85
      ? 7_200_000
      : ovr < 89
      ? 11_500_000
      : 16_000_000
    : isGlobal
    ? ovr < 76
      ? 950_000
      : ovr < 82
      ? 2_800_000
      : 7_500_000
    : ovr < 70
    ? 180_000
    : ovr < 75
    ? 420_000
    : ovr < 80
    ? 950_000
    : ovr < 85
    ? 1_950_000
    : 3_200_000;

  const rawSalary = baseSalary * salaryAgeMult * salaryDivMult * salaryRepMult;
  const salary = Math.min(
    hardSalaryCap,
    Math.max(20_000, Math.round(rawSalary / 5_000) * 5_000)
  );

  return { marketValue, salary };
}

export function assignDefaultContractTerms(
  player: Player,
  currentYear: number = 2026
): {
  contractType: 'DEFINITIVO' | 'EMPRESTADO';
  contractYearsRemaining: number;
  contractEndYear: number;
  loanDurationYears?: 1 | 2;
} {
  const contractType = player.contractType ?? 'DEFINITIVO';
  if (contractType === 'EMPRESTADO') {
    const loanDuration: 1 | 2 =
      player.loanDurationYears ??
      (player.contractYearsRemaining && player.contractYearsRemaining >= 2 ? 2 : 1);
    const remaining = Math.max(
      1,
      Math.min(2, player.contractYearsRemaining ?? loanDuration)
    );
    return {
      contractType: 'EMPRESTADO',
      contractYearsRemaining: remaining,
      contractEndYear: player.contractEndYear ?? currentYear + remaining - 1,
      loanDurationYears: loanDuration,
    };
  }

  if (
    typeof player.contractYearsRemaining === 'number' &&
    player.contractYearsRemaining >= 1
  ) {
    const rem = Math.min(5, Math.max(1, Math.round(player.contractYearsRemaining)));
    return {
      contractType: 'DEFINITIVO',
      contractYearsRemaining: rem,
      contractEndYear: player.contractEndYear ?? currentYear + rem - 1,
    };
  }

  const h = hashStr(`${player.id}-${player.name}-contract`) % 10;
  let years: number;
  if (player.age >= 32) {
    years = h < 5 ? 1 : h < 9 ? 2 : 3;
  } else if (player.age <= 21) {
    years = h < 2 ? 1 : h < 5 ? 2 : h < 8 ? 3 : 4;
  } else {
    years = h < 3 ? 1 : h < 6 ? 2 : h < 9 ? 3 : 4;
  }

  return {
    contractType: 'DEFINITIVO',
    contractYearsRemaining: years,
    contractEndYear: currentYear + years - 1,
  };
}

export function ensurePlayerDefaults(
  player: Player,
  clubReputation: number = 78,
  division: ClubDivision = 'A',
  currentYear: number = 2026
): Player {
  let attributes = player.attributes;
  let ovr = calculatePlayerOverall(attributes, player.position);
  const potentialStars =
    player.potentialStars ??
    assignPotentialStars(ovr, player.age, clubReputation, player.id, player.name);
  const contractTerms = assignDefaultContractTerms(player, currentYear);

  // Sanitize any young player or regen whose OVR exceeds the realistic cap for their star tier
  // (never downgrade players who already legitimately broke through expectations)
  const maxAllowedForAge = getMaxRealisticOvrForAgeAndPotential(
    player.age,
    potentialStars,
    player
  );
  if (!player.exceededExpectations && (player.age <= 22 || player.isRegen) && ovr > maxAllowedForAge) {
    attributes = calibrateAttributesToTargetOvr(
      attributes,
      player.position,
      maxAllowedForAge,
      maxAllowedForAge
    );
    ovr = calculatePlayerOverall(attributes, player.position);
    const recalc = calculateBalancedValuationAndWage({
      ovr,
      age: Math.max(16, player.age),
      clubReputation,
      division,
      potentialStars,
      position: player.position,
    });
    const dynRecalc = getDynamicPotentialProfile(potentialStars, Math.random, ovr, player.age);
    return {
      ...player,
      ...contractTerms,
      attributes,
      potentialStars,
      basePotentialOvr: player.basePotentialOvr ?? dynRecalc.basePotentialOvr,
      dynamicCeilingOvr: player.dynamicCeilingOvr ?? dynRecalc.dynamicCeilingOvr,
      marketValue: recalc.marketValue,
      salary: player.isRegen
        ? Math.max(20_000, Math.round((recalc.salary * 0.45) / 5_000) * 5_000)
        : recalc.salary,
    };
  }

  const dynProfile = getDynamicPotentialProfile(potentialStars, Math.random, ovr, player.age);
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

  const balancedValuation = calculateBalancedValuationAndWage({
    ovr,
    age: player.age,
    clubReputation,
    division,
    potentialStars,
    position: player.position,
  }).marketValue;

  const effectiveMarketValue =
    player.marketValue <= 0 ||
    (player.age >= 30 && player.marketValue < balancedValuation * 0.72)
      ? balancedValuation
      : player.marketValue;

  return {
    ...player,
    ...contractTerms,
    attributes,
    potentialStars,
    basePotentialOvr,
    dynamicCeilingOvr,
    recentOvrDelta: initialOvrDelta,
    marketValue: effectiveMarketValue,
  };
}

/**
 * Re-calibrates an existing saved player's star rating, potential ceiling, market value,
 * and salary to the current global Transfermarkt scale during save migration.
 */
export function recalibratePlayerForGlobalScale(
  player: Player,
  clubReputation: number,
  division: ClubDivision,
  currentYear: number
): Player {
  const ovr = calculatePlayerOverall(player.attributes, player.position);
  const nextStars = assignPotentialStars(
    ovr,
    player.age,
    clubReputation,
    player.id,
    player.name
  );
  const preservedStars =
    player.exceededExpectations && (player.potentialStars ?? 0) > nextStars
      ? player.potentialStars!
      : nextStars;
  const dynProfile = getDynamicPotentialProfile(preservedStars, () => 0.5, ovr, player.age);
  const preservedCeiling = player.exceededExpectations
    ? Math.max(dynProfile.dynamicCeilingOvr, player.dynamicCeilingOvr ?? ovr, ovr)
    : dynProfile.dynamicCeilingOvr;
  const recalc = calculateBalancedValuationAndWage({
    ovr,
    age: Math.max(16, player.age),
    clubReputation,
    division,
    potentialStars: preservedStars,
    position: player.position,
  });
  return ensurePlayerDefaults(
    {
      ...player,
      potentialStars: preservedStars,
      basePotentialOvr: Math.max(ovr, dynProfile.basePotentialOvr),
      dynamicCeilingOvr: Math.min(95, preservedCeiling),
      marketValue: recalc.marketValue,
      salary: player.isRegen
        ? Math.max(20_000, Math.round((recalc.salary * 0.45) / 5_000) * 5_000)
        : recalc.salary,
    },
    clubReputation,
    division,
    currentYear
  );
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
 * Índice realista de tamanho de torcida e potencial comercial (0..100) dos clubes brasileiros.
 * Na Série A, define a faixa de patrocínios anuais de ~R$ 40M (torcidas menores) até >R$ 250M (maiores torcidas).
 * Na Série B, calibra os patrocínios entre R$ 12M e R$ 30M/ano.
 */
export const CLUB_FANBASE_SCORE: Record<string, number> = {
  // Série A — Maiores torcidas e alcance comercial
  flamengo: 100,
  corinthians: 96,
  palmeiras: 93,
  'sao-paulo': 90,
  vasco: 80,
  cruzeiro: 79,
  gremio: 78,
  'atletico-mg': 77,
  internacional: 75,
  santos: 72,
  fluminense: 70,
  botafogo: 69,
  bahia: 64,
  'athletico-pr': 54,
  vitoria: 44,
  coritiba: 42,
  remo: 40,
  bragantino: 34,
  chapecoense: 26,
  mirassol: 18,
  // Série B — Torcidas regionais e tradicionais
  fortaleza: 88,
  sport: 84,
  ceara: 82,
  goias: 62,
  'ponte-preta': 56,
  nautico: 56,
  'vila-nova': 54,
  criciuma: 52,
  'america-mg': 50,
  avai: 48,
  juventude: 46,
  'atletico-go': 44,
  cuiaba: 40,
  crb: 40,
  londrina: 32,
  novorizontino: 26,
  'operario-pr': 24,
  'botafogo-sp': 22,
  'sao-bernardo': 18,
  'athletic-mg': 15,
};

export function getClubFanbaseScore(club: Club): number {
  if (CLUB_FANBASE_SCORE[club.id] !== undefined) {
    return CLUB_FANBASE_SCORE[club.id];
  }
  // Fallback coerente por capacidade do estádio e reputação
  const capFactor = Math.min(1, Math.max(0, (club.capacity - 12_000) / 58_000));
  const repFactor = Math.min(1, Math.max(0, (club.reputation - 65) / 28));
  return Math.round(18 + (capFactor * 0.45 + repFactor * 0.55) * 76);
}

/**
 * Generates an automatic annual sponsorship contract calculated from:
 * Fanbase Size (Tamanho da Torcida) + Club Reputation + Average Squad OVR + Recent Titles + Division.
 * - Série A: ~R$ 40M/ano (clubes de menor torcida) até >R$ 250M/ano (principais torcidas/gigantes)
 * - Série B: R$ 12M/ano a R$ 30M/ano
 */
export function calculateDynamicSponsorship(
  club: Club,
  squadAvgOvr: number,
  seasonYear: number
): SponsorshipContract {
  const fanbaseScore = getClubFanbaseScore(club);
  const titlesCount = club.recentTitles?.length ?? 0;
  const titlesBonus = Math.min(14, titlesCount * 3.5);
  const divBonus = club.division === 'A' ? 6 : 0;
  const compositeScore =
    club.reputation * 0.42 +
    fanbaseScore * 0.30 +
    squadAvgOvr * 0.28 +
    titlesBonus +
    divBonus;

  const tier =
    SPONSOR_BRANDS_BY_TIER.find((t) => compositeScore >= t.minScore) ||
    SPONSOR_BRANDS_BY_TIER[SPONSOR_BRANDS_BY_TIER.length - 1];

  const sponsorIdx = (hashStr(club.id) + seasonYear) % tier.sponsors.length;
  const sponsorName = tier.sponsors[sponsorIdx];

  let annualValue: number;
  if (
    club.division === 'PL' ||
    club.division === 'LALIGA' ||
    club.division === 'UCL'
  ) {
    const isEngland = club.division === 'PL' || club.countryCode === 'ING';
    const repNorm = Math.min(1, Math.max(0, (club.reputation - 73) / 22));
    const fanNorm = Math.min(1, Math.max(0, (fanbaseScore - 20) / 80));
    const ovrNorm = Math.min(1, Math.max(0, (squadAvgOvr - 72) / 16));
    const weighted = Math.pow(repNorm * 0.55 + fanNorm * 0.25 + ovrNorm * 0.2, 1.3);
    const titleMultiplier = 1 + Math.min(0.22, titlesCount * 0.05);
    const baseMin = isEngland ? 185_000_000 : 88_000_000;
    const baseSpan = isEngland ? 540_000_000 : 510_000_000;
    const rawEuro = (baseMin + weighted * baseSpan) * titleMultiplier;
    annualValue = Math.min(
      840_000_000,
      Math.max(baseMin, Math.round(rawEuro / 1_000_000) * 1_000_000)
    );
  } else if (club.division === 'B') {
    // Série B: R$ 12 milhões (menor torcida/reputação) até R$ 30 milhões (maiores torcidas da B)
    const fanNorm = Math.min(1, Math.max(0, (fanbaseScore - 15) / 73));
    const repNorm = Math.min(1, Math.max(0, (club.reputation - 68) / 14));
    const ovrNorm = Math.min(1, Math.max(0, (squadAvgOvr - 66) / 12));
    const weighted = fanNorm * 0.58 + repNorm * 0.24 + ovrNorm * 0.18;
    const titleBoost = Math.min(2_500_000, titlesCount * 800_000);
    const rawB = 12_000_000 + weighted * 16_500_000 + titleBoost;
    annualValue = Math.min(
      30_000_000,
      Math.max(12_000_000, Math.round(rawB / 250_000) * 250_000)
    );
  } else {
    // Série A: ~R$ 40 milhões (clubes menores) até >R$ 250 milhões nos principais (Flamengo, Corinthians, Palmeiras...)
    const fanNorm = Math.min(1, Math.max(0, (fanbaseScore - 18) / 82));
    const repNorm = Math.min(1, Math.max(0, (club.reputation - 74) / 20));
    const ovrNorm = Math.min(1, Math.max(0, (squadAvgOvr - 70) / 13));
    // Curva convexa premia as maiores massas de torcida (Flamengo, Corinthians, Palmeiras, São Paulo)
    const fanCurve = Math.pow(fanNorm, 1.32);
    const baseA =
      40_000_000 +
      fanCurve * 190_000_000 +
      repNorm * 28_000_000 +
      ovrNorm * 14_000_000;
    const titleMultiplier = 1 + Math.min(0.24, titlesCount * 0.06);
    annualValue = Math.min(
      340_000_000,
      Math.max(40_000_000, Math.round((baseA * titleMultiplier) / 500_000) * 500_000)
    );
  }

  const monthlyInstallment = Math.round(annualValue / 12 / 50_000) * 50_000;
  const fanbaseTierLabel =
    fanbaseScore >= 88
      ? 'Torcida Nacional Gigante'
      : fanbaseScore >= 68
      ? 'Grande Torcida'
      : fanbaseScore >= 42
      ? 'Torcida Regional Forte'
      : 'Torcida Local';

  return {
    sponsorName,
    tierLabel: tier.tierLabel,
    annualValue,
    monthlyInstallment,
    basisNote: `${fanbaseTierLabel} · Rep. ${Math.round(
      club.reputation
    )} · OVR Médio ${Math.round(squadAvgOvr)} · ${titlesCount} título(s) recente(s)`,
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

  const isEuropeanClub =
    club.division === 'PL' ||
    club.division === 'LALIGA' ||
    club.division === 'UCL';
  let competitionMult =
    club.division === 'B' ? 0.72 : isEuropeanClub ? 1.45 : 1.0;
  let ticketBase =
    club.division === 'B'
      ? 85
      : club.division === 'PL' || (club.division === 'UCL' && club.countryCode === 'ING')
      ? 360
      : isEuropeanClub
      ? 290
      : 135;

  if (competition === 'COPA_DO_BRASIL') {
    if (stageLabel === 'Final') {
      competitionMult = 1.65;
      ticketBase = 215;
    } else if (stageLabel === 'Semifinal') {
      competitionMult = 1.38;
      ticketBase = 175;
    } else {
      competitionMult = 1.15;
      ticketBase = 140;
    }
  } else if (competition === 'LIBERTADORES') {
    if (stageLabel === 'Final') {
      competitionMult = 1.9;
      ticketBase = 240;
    } else if (stageLabel === 'Semifinal' || stageLabel === 'Quartas') {
      competitionMult = 1.5;
      ticketBase = 195;
    } else {
      competitionMult = 1.25;
      ticketBase = 160;
    }
  } else if (competition === 'CHAMPIONS_LEAGUE') {
    if (stageLabel === 'Final') {
      competitionMult = 2.1;
      ticketBase = 480;
    } else if (stageLabel === 'Semifinal' || stageLabel === 'Quartas') {
      competitionMult = 1.75;
      ticketBase = 420;
    } else {
      competitionMult = 1.5;
      ticketBase = 370;
    }
  } else if (competition === 'MUNDIAL' || competition === 'SUPER_MUNDIAL') {
    if (stageLabel === 'Final') {
      competitionMult = 2.2;
      ticketBase = 320;
    } else {
      competitionMult = 1.75;
      ticketBase = 245;
    }
  }

  const repOccupancy = Math.min(0.96, Math.max(0.45, 0.42 + (club.reputation - 60) * 0.013));
  const occupancy = Math.min(0.98, repOccupancy * standingFactor);
  const attendance = Math.round((club.capacity * occupancy) / 100) * 100;
  const rawRevenue = attendance * ticketBase * Math.max(0.8, competitionMult * 0.92);
  const gateRevenue = Math.max(
    250_000,
    Math.min(isEuropeanClub ? 58_000_000 : 35_000_000, Math.round(rawRevenue / 50_000) * 50_000)
  );

  return { gateRevenue, attendance };
}

/**
 * Taxa padrão de custo operacional aplicada sobre TODAS as receitas de patrocínio
 * e bilheteria/ingressos para todos os clubes (30%).
 */
export const OPERATIONAL_COST_RATE = 0.3;

/**
 * Calcula o custo operacional (30%) incidente sobre receitas brutas de patrocínio e ingressos.
 */
export function calculateOperationalCost(grossRevenue: number): number {
  if (grossRevenue <= 0) return 0;
  return Math.round(grossRevenue * OPERATIONAL_COST_RATE);
}

export interface HomeGateSettlementItem {
  clubId: string;
  rank: number;
  totalTeams?: number;
  competition: CompetitionType;
  stageLabel?: string;
}

/**
 * Credita receita líquida de bilheteria (ingressos brutos menos 30% de custo operacional)
 * para todos os clubes mandantes de IA em partidas simuladas.
 */
export function applyAiHomeGateRevenues(params: {
  clubs: Club[];
  userClubId: string;
  homeMatches: HomeGateSettlementItem[];
}): {
  updatedClubs: Club[];
  totalGrossGate: number;
  totalOperationalCost: number;
} {
  const { clubs, userClubId, homeMatches } = params;
  if (homeMatches.length === 0) {
    return { updatedClubs: clubs, totalGrossGate: 0, totalOperationalCost: 0 };
  }

  const netDeltaByClubId = new Map<string, number>();
  let totalGrossGate = 0;
  let totalOperationalCost = 0;

  for (const item of homeMatches) {
    if (!item.clubId || item.clubId === userClubId) continue;
    const club = clubs.find((c) => c.id === item.clubId);
    if (!club) continue;
    const { gateRevenue } = calculateMatchGateRevenue({
      club,
      rank: item.rank,
      totalTeams: item.totalTeams ?? 20,
      competition: item.competition,
      stageLabel: item.stageLabel,
      isHome: true,
    });
    if (gateRevenue <= 0) continue;
    const opCost = calculateOperationalCost(gateRevenue);
    const netGate = gateRevenue - opCost;
    totalGrossGate += gateRevenue;
    totalOperationalCost += opCost;
    netDeltaByClubId.set(
      club.id,
      (netDeltaByClubId.get(club.id) || 0) + netGate
    );
  }

  if (netDeltaByClubId.size === 0) {
    return { updatedClubs: clubs, totalGrossGate: 0, totalOperationalCost: 0 };
  }

  const updatedClubs = clubs.map((c) => {
    const delta = netDeltaByClubId.get(c.id);
    if (!delta) return c;
    return {
      ...c,
      cashBalance: c.cashBalance + delta,
    };
  });

  return { updatedClubs, totalGrossGate, totalOperationalCost };
}

/**
 * Aplica o fechamento mensal para todos os clubes de IA (Série A e Série B):
 * - Recebe parcela mensal de patrocínio proporcional à torcida/reputação/elenco
 * - Deduz 30% de custo operacional sobre o patrocínio recebido
 * - Deduz a folha salarial mensal do elenco
 */
export function applyAiMonthlyEconomyTick(params: {
  clubs: Club[];
  aiSquads: Record<string, Player[]>;
  userClubId: string;
  monthsElapsed: number;
  seasonYear: number;
}): {
  updatedClubs: Club[];
  totalGrossSponsor: number;
  totalOperationalCost: number;
} {
  const { clubs, aiSquads, userClubId, monthsElapsed, seasonYear } = params;
  if (monthsElapsed <= 0) {
    return { updatedClubs: clubs, totalGrossSponsor: 0, totalOperationalCost: 0 };
  }

  let totalGrossSponsor = 0;
  let totalOperationalCost = 0;

  const updatedClubs = clubs.map((c) => {
    if (c.id === userClubId) return c;
    if (c.division !== 'A' && c.division !== 'B') return c;
    const sq = aiSquads[c.id] || [];
    const avgOvr =
      sq.length > 0
        ? sq.reduce(
            (sum, p) => sum + calculatePlayerOverall(p.attributes, p.position),
            0
          ) / sq.length
        : Math.max(66, c.reputation - 5);
    const sponsor = calculateDynamicSponsorship(c, avgOvr, seasonYear);
    const grossSponsor = sponsor.monthlyInstallment * monthsElapsed;
    const sponsorOpCost = calculateOperationalCost(grossSponsor);
    const monthlyPayroll =
      sq.reduce((sum, p) => sum + p.salary, 0) * monthsElapsed;

    totalGrossSponsor += grossSponsor;
    totalOperationalCost += sponsorOpCost;

    return {
      ...c,
      cashBalance: c.cashBalance + grossSponsor - sponsorOpCost - monthlyPayroll,
    };
  });

  return { updatedClubs, totalGrossSponsor, totalOperationalCost };
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
  const openingSponsorOpCost = calculateOperationalCost(
    contract.monthlyInstallment
  );

  return {
    seasonYear,
    seasonGateRevenue: 0,
    seasonTransferIncome: 0,
    seasonTransferSpend: 0,
    seasonPrizeRevenue: 0,
    seasonSponsorshipRevenue: contract.monthlyInstallment, // opening signing installment
    seasonPayrollExpense: 0,
    seasonOperationalExpense: openingSponsorOpCost, // 30% custo operacional sobre o patrocínio
    lastMatchGateRevenue: 0,
    lastMatchAttendance: 0,
    sponsorshipContract: contract,
  };
}

/**
 * Anti-inflation season-end upkeep & reserve guardrail applied to ALL clubs at year transition.
 * Applies the 30% operational cost rate to commercial/sponsorship/ticket refills for UCL/WORLD clubs
 * and curbs runaway cash hoarding while preserving real debt for user clubs.
 */
export function applyAntiInflationSeasonMaintenance(
  club: Club,
  squad: Player[],
  isUserClub: boolean = false
): { updatedClub: Club; annualMaintenanceCost: number } {
  const isEuropean =
    club.division === 'UCL' ||
    club.division === 'PL' ||
    club.division === 'LALIGA';
  const isGlobal = club.division === 'WORLD';
  const avgSquadOvrForSponsor =
    squad.length > 0
      ? squad.reduce(
          (acc, p) => acc + calculatePlayerOverall(p.attributes, p.position),
          0
        ) / squad.length
      : 74;

  // Hard cash reserve ceiling prevents multi-decade runaway while keeping European giants Transfermarkt-wealthy
  const maxHealthyCash =
    club.division === 'UCL'
      ? club.reputation >= 93
        ? 2_600_000_000
        : 1_750_000_000
      : club.division === 'PL'
      ? club.reputation >= 86
        ? 1_650_000_000
        : 1_050_000_000
      : club.division === 'LALIGA'
      ? club.reputation >= 84
        ? 1_150_000_000
        : 780_000_000
      : isGlobal
      ? 1_100_000_000
      : club.division === 'B'
      ? 220_000_000
      : club.reputation >= 85
      ? 680_000_000
      : 450_000_000;
  const minFloorCash =
    club.division === 'UCL'
      ? 350_000_000
      : club.division === 'PL'
      ? 240_000_000
      : club.division === 'LALIGA'
      ? 160_000_000
      : isGlobal
      ? 110_000_000
      : club.division === 'B'
      ? 8_000_000
      : 25_000_000;

  // European & Global clubs receive annual commercial/sponsorship + matchday refill and also pay 30% operational cost
  const annualCommercialRefill =
    club.division === 'UCL'
      ? Math.round((club.reputation * 3_100_000) / 500_000) * 500_000
      : club.division === 'PL'
      ? Math.round((club.reputation * 2_450_000) / 500_000) * 500_000
      : club.division === 'LALIGA'
      ? Math.round((club.reputation * 1_750_000) / 500_000) * 500_000
      : isGlobal
      ? 95_000_000
      : 0;

  const commercialOperationalCost = calculateOperationalCost(annualCommercialRefill);
  const referenceSponsorOpCost =
    isEuropean || isGlobal
      ? commercialOperationalCost
      : calculateOperationalCost(
          calculateDynamicSponsorship(club, avgSquadOvrForSponsor, 2026).annualValue
        );
  const annualMaintenanceCost = Math.max(250_000, referenceSponsorOpCost);

  // Série A/B clubs already pay 30% operational cost on every sponsorship installment & ticket match during the season;
  // UCL/WORLD clubs pay 30% operational cost directly on their annual commercial refill here.
  let nextCash =
    club.cashBalance + annualCommercialRefill - commercialOperationalCost;
  if (nextCash > maxHealthyCash) {
    nextCash = maxHealthyCash + Math.round((nextCash - maxHealthyCash) * 0.25);
  }
  // O clube do jogador pode permanecer em dívida (saldo negativo) caso seus custos superem seus ganhos.
  nextCash = isUserClub
    ? Math.round(nextCash / 100_000) * 100_000
    : Math.max(minFloorCash, Math.round(nextCash / 100_000) * 100_000);

  const currentPayroll = squad.reduce((s, p) => s + p.salary, 0);
  const avgSquadOvr =
    squad.length > 0
      ? squad.reduce(
          (acc, p) => acc + calculatePlayerOverall(p.attributes, p.position),
          0
        ) / squad.length
      : 74;
  const baseDivBudget = isEuropean
    ? Math.max(75_000_000, Math.min(260_000_000, Math.round((currentPayroll * 1.28) / 500_000) * 500_000))
    : isGlobal
    ? Math.max(32_000_000, Math.min(125_000_000, Math.round((currentPayroll * 1.25) / 500_000) * 500_000))
    : club.division === 'B'
    ? Math.max(3_600_000, Math.min(12_000_000, Math.round(((avgSquadOvr - 56) * 420_000) / 100_000) * 100_000))
    : Math.max(8_500_000, Math.min(32_000_000, Math.round(((avgSquadOvr - 58) * 1_050_000) / 100_000) * 100_000));
  const minHealthyRoomBudget = Math.round((currentPayroll * 1.20) / 100_000) * 100_000;
  const hardDivisionWageCap = isEuropean
    ? 290_000_000
    : isGlobal
    ? 140_000_000
    : club.division === 'B'
    ? 13_500_000
    : 36_000_000;
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
      const attrCap = maxAllowedOvr >= 90 ? 20 : 19;
      const candidateVal = Math.max(4, Math.min(attrCap, next[key] + step));
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

export interface DynamicPerformanceGrowthParams {
  player: Player;
  currentAge: number;
  stars: PotentialStars;
  basePotentialOvr: number;
  dynamicCeilingOvr: number;
  isMidSeason?: boolean;
  peerAverageScore?: number;
  rng?: () => number;
}

export interface DynamicPerformanceGrowthResult {
  growthMultiplier: number;
  ratingFactor: number;
  statsBonusFactor: number;
  isExceptional: boolean;
  canExceedCeiling: boolean;
  effectiveCeiling: number;
  bonusOvrBeyondCeiling: number;
  desiredDelta: number;
  isPhysicalDecline: boolean;
  promotedStars: PotentialStars;
  starsPromoted: boolean;
  nextDynamicCeilingOvr?: number;
  nextBasePotentialOvr?: number;
  developmentStatus:
    | 'SUPEROU_EXPECTATIVAS'
    | 'EVOLUCAO_NORMAL'
    | 'ESTAGNADO'
    | 'DECLINIO_TECNICO'
    | 'REGRESSAO_FISICA';
  reasonNote: string;
}

function stepStarsDownForCeiling(
  currentStars: PotentialStars,
  nextCeiling: number
): PotentialStars {
  let s = currentStars;
  while (s > 1) {
    const prevStep = Math.max(1, Number((s - 0.5).toFixed(1))) as PotentialStars;
    const prevStepCeiling = getPotentialCeilingOvr(prevStep);
    const curStepCeiling = getPotentialCeilingOvr(s);
    const dropThreshold = Math.floor((prevStepCeiling + curStepCeiling) / 2);
    if (nextCeiling <= dropThreshold) {
      s = prevStep;
    } else {
      break;
    }
  }
  return s;
}

/**
 * Curva de evolução e regressão por faixa etária e desempenho em campo:
 * - Até 25 anos (currentAge <= 25): Evolui muito bem (+1 a +4 OVR com bom desempenho),
 *   mas pode evoluir pouco (0 a +1) ou até regredir (-1 OVR) mesmo jovem se for mal, tiver baixa minutagem ou sofrer oscilação.
 * - De 26 até 30 anos (26 <= currentAge <= 30): Evolução média (+1 a +2 OVR em boa temporada, 0 regular, -1 se for mal).
 * - De 31 até 35 anos (31 <= currentAge <= 35): Evolução baixa (raramente sobe +1 OVR apenas em temporada excepcional; senão mantém 0 ou cai -1/-2 OVR).
 * - Acima de 35 anos (currentAge > 35): Quase não evolui, mais regride (-1 a -3 OVR, com queda acentuada nos atributos físicos).
 */
export function calculateDynamicPerformanceGrowth(
  params: DynamicPerformanceGrowthParams
): DynamicPerformanceGrowthResult {
  const {
    player,
    currentAge,
    stars,
    basePotentialOvr,
    dynamicCeilingOvr,
    isMidSeason = false,
    peerAverageScore = 0.4,
    rng = Math.random,
  } = params;

  const oldOvr = calculatePlayerOverall(player.attributes, player.position);
  const matches = player.seasonStats.matches;
  const avgRating = player.seasonStats.avgRating;
  const goals = player.seasonStats.goals;
  const assists = player.seasonStats.assists;
  const goalsAndAssists = goals + assists;

  const perfScore = computePositionPerformanceScore(player);
  const relativePerf = matches >= 3 ? perfScore - peerAverageScore : 0;

  const minMatchesForUnlock = isMidSeason ? 8 : 16;
  const minMatchesForMinutes = isMidSeason ? 4 : 7;
  const minMatchesForBreakout = isMidSeason ? 9 : 15;

  const hasRenderedInMatches =
    matches >= minMatchesForUnlock && (avgRating >= 7.12 || relativePerf >= 0.20);
  const effectiveBaseCeiling = hasRenderedInMatches ? dynamicCeilingOvr : basePotentialOvr;
  const standardAgeCeiling = Math.min(
    effectiveBaseCeiling,
    getMaxRealisticOvrForAgeAndPotential(currentAge, stars, {
      basePotentialOvr,
      dynamicCeilingOvr: effectiveBaseCeiling,
      exceededExpectations: player.exceededExpectations,
    })
  );

  // 1. Multiplicador baseado na média de notas (baseline neutro ~6.80)
  let ratingFactor = 1.0;
  if (avgRating >= 6.80) {
    const ratingSurplus = avgRating - 6.80;
    ratingFactor = Number((1.0 + Math.pow(ratingSurplus * 1.85, 1.22)).toFixed(2));
  } else if (avgRating >= 6.62) {
    ratingFactor = Number(Math.max(0.35, 1.0 - (6.80 - avgRating) * 2.8).toFixed(2));
  } else {
    ratingFactor = Number((-0.5 - (6.62 - avgRating) * 2.0).toFixed(2));
  }

  // 2. Fator bônus por estatísticas concretas (gols, assistências e dominância na posição)
  let statsBonusFactor = 0.0;
  const isAttackerOrMid = ['ATA', 'PD', 'PE', 'MEI', 'MC'].includes(player.position);
  if (isAttackerOrMid) {
    if (goalsAndAssists >= (isMidSeason ? 9 : 15) || goals >= (isMidSeason ? 7 : 12)) {
      statsBonusFactor += 0.55;
    } else if (goalsAndAssists >= (isMidSeason ? 6 : 10) || goals >= (isMidSeason ? 4 : 8)) {
      statsBonusFactor += 0.35;
    } else if (goalsAndAssists >= (isMidSeason ? 3 : 5)) {
      statsBonusFactor += 0.15;
    }
  }

  if (relativePerf >= (isMidSeason ? 0.45 : 0.50)) {
    statsBonusFactor += 0.40;
  } else if (relativePerf >= (isMidSeason ? 0.20 : 0.25)) {
    statsBonusFactor += 0.20;
  }

  // Multiplicador consolidado de crescimento
  let growthMultiplier = Number((ratingFactor + statsBonusFactor).toFixed(2));

  // 3. Avaliação de condições especiais:
  const hasLowMinutes = matches < minMatchesForMinutes;
  const hasPoorPerformance =
    matches >= minMatchesForMinutes && (avgRating < 6.62 || relativePerf < -0.38);

  const lowExpectationBreakout =
    currentAge <= 25 &&
    stars <= 3.5 &&
    matches >= minMatchesForBreakout &&
    (avgRating >= 7.12 || relativePerf >= 0.42);

  const isExceptional =
    matches >= minMatchesForBreakout &&
    (avgRating >= 7.20 ||
      relativePerf >= 0.52 ||
      (isAttackerOrMid && goalsAndAssists >= (isMidSeason ? 8 : 12)) ||
      lowExpectationBreakout);

  let canExceedCeiling = false;
  let bonusOvrBeyondCeiling = 0;
  let effectiveCeiling = standardAgeCeiling;
  let desiredDelta = 0;
  let isPhysicalDecline = false;
  let starsPromoted = false;
  let promotedStars = stars;
  let nextDynamicCeilingOvr: number | undefined = undefined;
  let nextBasePotentialOvr: number | undefined = undefined;
  let developmentStatus: DynamicPerformanceGrowthResult['developmentStatus'] = 'EVOLUCAO_NORMAL';
  let reasonNote = isMidSeason ? 'Primeiro turno regular' : 'Temporada regular';

  const gaText =
    goals > 0 || assists > 0
      ? ` (${goals > 0 ? `${goals}g` : ''}${goals > 0 && assists > 0 ? ', ' : ''}${assists > 0 ? `${assists}a` : ''})`
      : '';

  // =========================================================================
  // FAIXA 1: ATÉ 25 ANOS (currentAge <= 25)
  // Tem alta probabilidade de evoluir, MAS também corre risco real de estagnar ou fracassar
  // =========================================================================
  if (currentAge <= 25) {
    if (isExceptional) {
      canExceedCeiling = true;
      developmentStatus = 'SUPEROU_EXPECTATIVAS';
      const superExcellence =
        avgRating >= 7.35 || relativePerf >= 0.80 || goalsAndAssists >= (isMidSeason ? 10 : 16);
      bonusOvrBeyondCeiling = superExcellence
        ? isMidSeason
          ? 2
          : 4
        : isMidSeason
        ? 1
        : 3;
      effectiveCeiling = Math.min(
        95,
        Math.max(oldOvr + (isMidSeason ? 1 : 2), standardAgeCeiling + bonusOvrBeyondCeiling)
      );
      nextDynamicCeilingOvr = Math.max(dynamicCeilingOvr, effectiveCeiling);
      const baseDelta = isMidSeason ? 1.15 : 2.15;
      desiredDelta = Math.min(
        isMidSeason ? 2 : 4,
        Math.max(isMidSeason ? 1 : 2, Math.round(baseDelta * Math.max(1.1, growthMultiplier)))
      );
      if (stars < 4.5) {
        const keepUnderrated = stars <= 3.5 && rng() < 0.28;
        if (!keepUnderrated) {
          promotedStars = Math.min(4.5, stars + 0.5) as PotentialStars;
          starsPromoted = promotedStars > stars;
        }
      } else if (stars === 4.5 && (oldOvr >= 86 || (currentAge <= 20 && oldOvr >= 80)) && avgRating >= 7.55) {
        promotedStars = 5 as PotentialStars;
        starsPromoted = true;
      }
      reasonNote = `⚡ Superou expectativas (Até 25a)! Multiplicador de ${growthMultiplier.toFixed(2)}x (nota ${avgRating.toFixed(2)}${gaText}) rompeu o teto de ${stars}★ (+${desiredDelta} OVR)!`;
    } else if (hasPoorPerformance) {
      growthMultiplier = Math.min(-0.5, growthMultiplier);
      const severeFlop = avgRating < 6.25 && rng() < 0.45;
      desiredDelta = severeFlop && oldOvr >= 62 ? -2 : -1;
      developmentStatus = 'DECLINIO_TECNICO';

      const bustProb = avgRating < 6.30 ? 0.72 : 0.52;
      if (rng() < bustProb) {
        const ceilingLoss = severeFlop ? (isMidSeason ? 2 : 4) : isMidSeason ? 1 : 3;
        const shrunkCeiling = Math.max(Math.max(60, oldOvr - 1), dynamicCeilingOvr - ceilingLoss);
        nextDynamicCeilingOvr = shrunkCeiling;
        nextBasePotentialOvr = Math.max(
          Math.max(60, oldOvr - 1),
          Math.min(basePotentialOvr, shrunkCeiling - 1)
        );
        const downStars = stepStarsDownForCeiling(stars, shrunkCeiling);
        promotedStars =
          downStars < stars
            ? downStars
            : stars >= 2.5 && (avgRating < 6.45 || matches >= (isMidSeason ? 7 : 12))
            ? (Math.max(1, stars - 0.5) as PotentialStars)
            : stars;
      }
      reasonNote = `Mesmo jovem (${currentAge}a), o baixo rendimento em campo (${matches}j, nota ${avgRating.toFixed(2)}) gerou regressão técnica (${desiredDelta} OVR)${
        promotedStars < stars ? ` e reduziu projeção para ${promotedStars}★` : ''
      }.`;
    } else if (hasLowMinutes) {
      growthMultiplier = 0;
      const stallRoll = rng();
      if (stallRoll < 0.28) {
        desiredDelta = -1;
        developmentStatus = 'DECLINIO_TECNICO';
        const shrunkCeiling = Math.max(Math.max(60, oldOvr - 1), dynamicCeilingOvr - (isMidSeason ? 1 : 2));
        nextDynamicCeilingOvr = shrunkCeiling;
        nextBasePotentialOvr = Math.max(Math.max(60, oldOvr - 1), Math.min(basePotentialOvr, shrunkCeiling));
        promotedStars = stepStarsDownForCeiling(stars, shrunkCeiling);
        reasonNote = `Falta de sequência (${matches}j) freou o desenvolvimento e reduziu ritmo (-1 OVR)${
          promotedStars < stars ? `, caindo para ${promotedStars}★` : ''
        }.`;
      } else if (stallRoll < 0.78) {
        desiredDelta = 0;
        developmentStatus = 'ESTAGNADO';
        if (rng() < 0.42 && dynamicCeilingOvr > oldOvr + 1) {
          const shrunkCeiling = Math.max(oldOvr, dynamicCeilingOvr - 1);
          nextDynamicCeilingOvr = shrunkCeiling;
          nextBasePotentialOvr = Math.max(oldOvr, Math.min(basePotentialOvr, shrunkCeiling));
        }
        reasonNote = `Minutagem insuficiente (${matches}j) gerou estagnação nesta fase (+0 OVR).`;
      } else {
        desiredDelta = oldOvr < standardAgeCeiling ? 1 : 0;
        developmentStatus = desiredDelta > 0 ? 'EVOLUCAO_NORMAL' : 'ESTAGNADO';
        reasonNote =
          desiredDelta > 0
            ? `Apesar de poucos minutos (${matches}j), respondeu bem nos treinos (+1 OVR).`
            : `Minutagem reduzida (${matches}j) manteve o nível atual (+0 OVR).`;
      }
    } else {
      // Faixa regular até 25 anos: modelo probabilístico com risco real de estagnar/fracassar OU deslanchar
      const roll = rng();
      if (oldOvr >= standardAgeCeiling) {
        if (avgRating >= 7.02 && roll >= 0.80) {
          desiredDelta = 1;
          nextDynamicCeilingOvr = Math.min(95, Math.max(dynamicCeilingOvr, oldOvr + 1));
          effectiveCeiling = nextDynamicCeilingOvr;
          developmentStatus = 'EVOLUCAO_NORMAL';
          reasonNote = `Destaque consistente rompeu levemente o teto atual (+1 OVR).`;
        } else {
          desiredDelta = 0;
          developmentStatus = 'ESTAGNADO';
          reasonNote = 'Rendimento regular atingiu o teto padrão atual da categoria.';
        }
      } else if (avgRating < 6.88) {
        // Temporada morna/irregular: ~24% de chance de regredir e perder projeção, ~34% estagnar, ~42% evoluir
        if (roll < 0.24) {
          desiredDelta = -1;
          developmentStatus = 'DECLINIO_TECNICO';
          const shrink = isMidSeason ? 2 : roll < 0.12 ? 4 : 3;
          const shrunkCeiling = Math.max(Math.max(60, oldOvr - 1), dynamicCeilingOvr - shrink);
          nextDynamicCeilingOvr = shrunkCeiling;
          nextBasePotentialOvr = Math.max(Math.max(60, oldOvr - 1), Math.min(basePotentialOvr, shrunkCeiling));
          promotedStars = stepStarsDownForCeiling(stars, shrunkCeiling);
          reasonNote = `Temporada abaixo do esperado (${avgRating.toFixed(2)}) derrubou ritmo e projeção (-1 OVR)${
            promotedStars < stars ? ` · ${promotedStars}★` : ''
          }.`;
        } else if (roll < 0.58) {
          desiredDelta = 0;
          developmentStatus = 'ESTAGNADO';
          if (dynamicCeilingOvr > oldOvr + 1 && rng() < 0.5) {
            const shrunkCeiling = Math.max(oldOvr, dynamicCeilingOvr - 1);
            nextDynamicCeilingOvr = shrunkCeiling;
            promotedStars = stepStarsDownForCeiling(stars, shrunkCeiling);
          }
          reasonNote = `Oscilação aos ${currentAge} anos fez o atleta estagnar sem ganho de nível (+0 OVR).`;
        } else {
          const bonusStep = roll >= 0.90 && !isMidSeason && oldOvr + 2 <= standardAgeCeiling ? 2 : 1;
          desiredDelta = Math.min(bonusStep, standardAgeCeiling - oldOvr);
          developmentStatus = desiredDelta > 0 ? 'EVOLUCAO_NORMAL' : 'ESTAGNADO';
          reasonNote = `Mesmo com oscilação (${avgRating.toFixed(2)}), evoluiu positivamente (+${desiredDelta} OVR).`;
        }
      } else {
        // Boa temporada regular (6.88 <= avgRating < 7.20): alta chance de evoluir, mas risco real de estagnar/bater no teto
        const stallProb = avgRating < 7.02 ? 0.20 : 0.10;
        if (roll < stallProb) {
          desiredDelta = 0;
          developmentStatus = 'ESTAGNADO';
          const shrunkCeiling = Math.max(oldOvr, dynamicCeilingOvr - 1);
          nextDynamicCeilingOvr = shrunkCeiling;
          promotedStars = stepStarsDownForCeiling(stars, shrunkCeiling);
          reasonNote = `Embora regular (${avgRating.toFixed(2)}), não deu o salto técnico esperado neste ciclo (+0 OVR).`;
        } else {
          const ageBoost = currentAge <= 21 ? 1.25 : 1.1;
          const rawStep = Math.round(ageBoost * growthMultiplier);
          const maxRegularStep = isMidSeason ? 2 : 3;
          desiredDelta = Math.min(
            maxRegularStep,
            Math.max(0, Math.min(rawStep, standardAgeCeiling - oldOvr))
          );
          if (desiredDelta === 0 && oldOvr < standardAgeCeiling && growthMultiplier >= 0.8 && rng() < 0.68) {
            desiredDelta = 1;
          }
          if (roll >= 0.88 && stars <= 3.5 && avgRating >= 7.0) {
            promotedStars = Math.min(4.5, stars + 0.5) as PotentialStars;
            starsPromoted = promotedStars > stars;
            nextDynamicCeilingOvr = Math.min(95, Math.max(dynamicCeilingOvr + 2, getPotentialCeilingOvr(promotedStars)));
            effectiveCeiling = Math.min(95, Math.max(effectiveCeiling, nextDynamicCeilingOvr));
          }
          developmentStatus = desiredDelta > 0 ? 'EVOLUCAO_NORMAL' : 'ESTAGNADO';
          reasonNote = `Boa evolução na faixa até 25 anos (${matches}j, nota ${avgRating.toFixed(2)}, mult. ${growthMultiplier.toFixed(2)}x).`;
        }
      }
    }
  }
  // =========================================================================
  // FAIXA 2: DE 26 ATÉ 30 ANOS (26 <= currentAge <= 30) — EVOLUÇÃO MÉDIA
  // =========================================================================
  else if (currentAge <= 30) {
    if (isExceptional) {
      canExceedCeiling = true;
      developmentStatus = 'SUPEROU_EXPECTATIVAS';
      bonusOvrBeyondCeiling = isMidSeason ? 1 : 2;
      effectiveCeiling = Math.min(
        95,
        Math.max(oldOvr + 1, standardAgeCeiling + bonusOvrBeyondCeiling)
      );
      nextDynamicCeilingOvr = Math.max(dynamicCeilingOvr, effectiveCeiling);
      desiredDelta = isMidSeason
        ? 1
        : growthMultiplier >= 1.65 && avgRating >= 7.3
        ? 2
        : 1;
      if (stars < 4.5 && avgRating >= 7.3) {
        promotedStars = Math.min(4.5, stars + 0.5) as PotentialStars;
        starsPromoted = promotedStars > stars;
      } else if (stars === 4.5 && oldOvr >= 88 && avgRating >= 7.6) {
        promotedStars = 5 as PotentialStars;
        starsPromoted = true;
      }
      reasonNote = `⚡ Grande fase no auge (${currentAge}a)! Rendimento de ${avgRating.toFixed(2)}${gaText} rendeu evolução média-alta (+${desiredDelta} OVR).`;
    } else if (hasPoorPerformance) {
      growthMultiplier = Math.min(-0.5, growthMultiplier);
      desiredDelta = -1;
      developmentStatus = 'DECLINIO_TECNICO';
      if (dynamicCeilingOvr > oldOvr && rng() < 0.45) {
        nextDynamicCeilingOvr = Math.max(Math.max(60, oldOvr - 1), dynamicCeilingOvr - 2);
      }
      reasonNote = `Baixo rendimento na faixa de 26–30 anos (${matches}j, nota ${avgRating.toFixed(2)}) gerou queda técnica (-1 OVR).`;
    } else if (hasLowMinutes) {
      growthMultiplier = 0;
      if (rng() < 0.34) {
        desiredDelta = -1;
        developmentStatus = 'DECLINIO_TECNICO';
        reasonNote = `Pouca minutagem (${matches}j) aos ${currentAge} anos causou perda de ritmo e queda (-1 OVR).`;
      } else {
        desiredDelta = 0;
        developmentStatus = 'ESTAGNADO';
        reasonNote = `Minutagem reduzida (${matches}j) manteve os atributos estáveis (+0 OVR).`;
      }
    } else {
      // Evolução média (26–30 anos): probabilística (+1..+2 em grande fase, 0 ou -1 em fase morna)
      const primeRoll = rng();
      if (avgRating < 6.80 && primeRoll < 0.22) {
        desiredDelta = -1;
        developmentStatus = 'DECLINIO_TECNICO';
        reasonNote = `Fase abaixo da média (${avgRating.toFixed(2)}) aos ${currentAge} anos trouxe leve desgaste (-1 OVR).`;
      } else if (oldOvr < standardAgeCeiling && growthMultiplier >= 1.45 && !isMidSeason) {
        desiredDelta = Math.min(2, standardAgeCeiling - oldOvr);
        developmentStatus = 'EVOLUCAO_NORMAL';
        reasonNote = `Evolução média consistente no auge (${currentAge}a, nota ${avgRating.toFixed(2)}, +${desiredDelta} OVR).`;
      } else if (oldOvr < standardAgeCeiling && growthMultiplier >= 0.95 && primeRoll < 0.65) {
        desiredDelta = 1;
        developmentStatus = 'EVOLUCAO_NORMAL';
        reasonNote = `Evolução média na faixa 26–30 anos (${matches}j, nota ${avgRating.toFixed(2)}, +1 OVR).`;
      } else {
        desiredDelta = 0;
        developmentStatus = 'EVOLUCAO_NORMAL';
        reasonNote = `Nível consolidado no auge da carreira (${currentAge}a, mult. ${growthMultiplier.toFixed(2)}x).`;
      }
    }
  }
  // =========================================================================
  // FAIXA 3: DE 31 ATÉ 35 ANOS (31 <= currentAge <= 35) — EVOLUÇÃO BAIXA
  // Pouca chance de subir atributos (+1 apenas em grande temporada), maior chance de manter ou cair
  // =========================================================================
  else if (currentAge <= 35) {
    if (isExceptional) {
      // Mesmo em temporada excepcional, entre 31 e 35 anos a evolução é baixa (máx +1 OVR)
      const canGainOne = currentAge <= 33 ? rng() < 0.75 : rng() < 0.45;
      if (canGainOne) {
        canExceedCeiling = true;
        bonusOvrBeyondCeiling = 1;
        effectiveCeiling = Math.min(95, Math.max(oldOvr + 1, standardAgeCeiling + 1));
        nextDynamicCeilingOvr = Math.max(dynamicCeilingOvr, effectiveCeiling);
        desiredDelta = 1;
        developmentStatus = 'SUPEROU_EXPECTATIVAS';
        reasonNote = `⚡ Temporada de alto nível aos ${currentAge} anos (nota ${avgRating.toFixed(2)}${gaText}) garantiu evolução pontual (+1 OVR).`;
      } else {
        desiredDelta = 0;
        developmentStatus = 'EVOLUCAO_NORMAL';
        reasonNote = `Grande temporada aos ${currentAge} anos (nota ${avgRating.toFixed(2)}) blindou o atleta contra declínio físico (+0 OVR).`;
      }
    } else if (hasPoorPerformance || hasLowMinutes) {
      growthMultiplier = Math.min(-0.5, growthMultiplier);
      desiredDelta = currentAge >= 34 && hasPoorPerformance ? -2 : -1;
      isPhysicalDecline = true;
      developmentStatus = 'REGRESSAO_FISICA';
      reasonNote = `Faixa de 31–35 anos (${currentAge}a) com ${hasLowMinutes ? `baixa minutagem (${matches}j)` : `rendimento abaixo (${avgRating.toFixed(2)})`} reduziu atributos físicos (${desiredDelta} OVR).`;
    } else {
      // Temporada normal entre 31 e 35 anos: evolução baixa (rara chance de +1 aos 31-32, senão 0 ou -1)
      if (
        currentAge <= 32 &&
        growthMultiplier >= 1.35 &&
        oldOvr < standardAgeCeiling &&
        rng() < 0.25
      ) {
        desiredDelta = 1;
        developmentStatus = 'EVOLUCAO_NORMAL';
        reasonNote = `Evolução baixa pontual aos ${currentAge} anos graças à regularidade (${avgRating.toFixed(2)}, +1 OVR).`;
      } else if (
        growthMultiplier >= 1.08 &&
        matches >= (isMidSeason ? 8 : 16) &&
        (currentAge <= 33 || rng() < 0.55)
      ) {
        desiredDelta = 0;
        developmentStatus = 'EVOLUCAO_NORMAL';
        reasonNote = `Experiência e boa média (${avgRating.toFixed(2)}) mantiveram os atributos estáveis aos ${currentAge} anos (+0 OVR).`;
      } else {
        desiredDelta = -1;
        isPhysicalDecline = true;
        developmentStatus = 'REGRESSAO_FISICA';
        reasonNote = `Desgaste físico gradual na faixa de 31–35 anos (${currentAge}a, -1 OVR).`;
      }
    }
  }
  // =========================================================================
  // FAIXA 4: A PARTIR DE 36+ ANOS (currentAge > 35)
  // Quase não evolui, mais regride (-1 a -3 OVR)
  // =========================================================================
  else {
    if (isExceptional && avgRating >= 7.35 && matches >= (isMidSeason ? 10 : 20)) {
      // Quase não evolui: mesmo em temporada lendária segura 0 OVR (ou -1 se 38+)
      desiredDelta = currentAge >= 38 && rng() < 0.5 ? -1 : 0;
      isPhysicalDecline = desiredDelta < 0;
      developmentStatus = desiredDelta < 0 ? 'REGRESSAO_FISICA' : 'EVOLUCAO_NORMAL';
      reasonNote =
        desiredDelta === 0
          ? `Temporada extraordinária aos ${currentAge} anos (${avgRating.toFixed(2)}${gaText}) segurou a regressão física (+0 OVR).`
          : `Mesmo atuando em alto nível (${avgRating.toFixed(2)}), o peso dos ${currentAge} anos causou leve regressão física (-1 OVR).`;
    } else {
      const ageSeverity = currentAge >= 38 ? 2 : 1;
      const usagePenalty = hasLowMinutes || hasPoorPerformance ? 1 : growthMultiplier >= 1.25 ? 0 : 1;
      desiredDelta = -Math.min(3, Math.max(1, ageSeverity + usagePenalty));
      isPhysicalDecline = true;
      developmentStatus = 'REGRESSAO_FISICA';
      reasonNote = `Acima dos 35 anos (${currentAge}a), o atleta quase não evolui e sofre regressão física natural (${desiredDelta} OVR).`;
    }
  }

  return {
    growthMultiplier,
    ratingFactor,
    statsBonusFactor,
    isExceptional,
    canExceedCeiling,
    effectiveCeiling,
    bonusOvrBeyondCeiling,
    desiredDelta,
    isPhysicalDecline,
    promotedStars,
    starsPromoted,
    nextDynamicCeilingOvr,
    nextBasePotentialOvr,
    developmentStatus,
    reasonNote,
  };
}

export interface PlayerRetirementEvaluation {
  ageWindowStart: number;
  annualProbability: number; // 0..0.98
  annualProbabilityPct: number; // 0..98
  isConsideringRetirement: boolean;
  isHighRisk: boolean;
  statusLabel: string;
  factorNote: string;
}

/**
 * Evaluates annual retirement probability:
 * - Outfield players: start considering retirement at age 35..40+, probability increasing every year.
 * - Goalkeepers ('GOL'): start considering retirement around age 40..50+, probability increasing every year.
 * - Frequent match usage (`seasonStats.matches` / `isStarter`) and high OVR noticeably reduce retirement odds.
 */
export function evaluatePlayerRetirementProbability(
  player: Player,
  ovrOverride?: number,
  ageOverride?: number
): PlayerRetirementEvaluation {
  const age = ageOverride ?? player.age;
  const ovr =
    ovrOverride ?? calculatePlayerOverall(player.attributes, player.position);
  const isGk = player.position === 'GOL';
  const ageWindowStart = isGk ? 40 : 35;

  if (age < ageWindowStart) {
    return {
      ageWindowStart,
      annualProbability: 0,
      annualProbabilityPct: 0,
      isConsideringRetirement: false,
      isHighRisk: false,
      statusLabel: 'Em plena atividade',
      factorNote: isGk
        ? 'Goleiro abaixo da faixa de aposentadoria (40+ anos).'
        : 'Atleta abaixo da faixa de aposentadoria (35+ anos).',
    };
  }

  let baseProb = 0;
  if (!isGk) {
    const outfieldCurve: Record<number, number> = {
      35: 0.1,
      36: 0.18,
      37: 0.28,
      38: 0.4,
      39: 0.54,
      40: 0.7,
      41: 0.84,
    };
    baseProb =
      outfieldCurve[age] ?? Math.min(0.98, 0.9 + Math.max(0, age - 42) * 0.04);
  } else {
    const gkCurve: Record<number, number> = {
      40: 0.07,
      41: 0.12,
      42: 0.18,
      43: 0.25,
      44: 0.33,
      45: 0.42,
      46: 0.52,
      47: 0.63,
      48: 0.74,
      49: 0.85,
    };
    baseProb =
      gkCurve[age] ?? Math.min(0.98, 0.93 + Math.max(0, age - 50) * 0.025);
  }

  const matches = player.seasonStats?.matches ?? 0;
  let usageMult = 1.0;
  if (matches >= 28) usageMult = 0.48;
  else if (matches >= 18) usageMult = 0.62;
  else if (matches >= 10) usageMult = 0.78;
  else if (player.isStarter) usageMult = 0.76;
  else if (matches >= 4) usageMult = 1.0;
  else usageMult = 1.28;

  let ovrMult = 1.0;
  if (ovr >= 82) ovrMult = 0.5;
  else if (ovr >= 77) ovrMult = 0.66;
  else if (ovr >= 73) ovrMult = 0.82;
  else if (ovr >= 69) ovrMult = 1.0;
  else ovrMult = 1.22;

  const annualProbability = Number(
    Math.max(0.02, Math.min(0.98, baseProb * usageMult * ovrMult)).toFixed(3)
  );
  const annualProbabilityPct = Math.round(annualProbability * 100);
  const isHighRisk = annualProbability >= 0.45;

  const statusLabel =
    annualProbability >= 0.55
      ? 'Aposentadoria muito provável'
      : annualProbability >= 0.28
      ? 'Pensando em se aposentar'
      : 'Avaliando futuro (em atividade)';

  const protections: string[] = [];
  if (usageMult < 0.95) {
    protections.push(
      matches >= 10
        ? `em uso (${matches} jogos)`
        : 'titular em atividade'
    );
  }
  if (ovrMult < 0.95) {
    protections.push(`bom OVR (${ovr})`);
  }

  const factorNote =
    protections.length > 0
      ? `${age} anos (${isGk ? 'Goleiro 40+' : 'Linha 35+'}) · ${protections.join(' e ')} reduzem chance anual para ${annualProbabilityPct}%.`
      : `${age} anos (${isGk ? 'Goleiro 40+' : 'Linha 35+'}) · baixa minutagem (${matches}j) ou queda técnica eleva chance anual para ${annualProbabilityPct}%.`;

  return {
    ageWindowStart,
    annualProbability,
    annualProbabilityPct,
    isConsideringRetirement: true,
    isHighRisk,
    statusLabel,
    factorNote,
  };
}

const EMERGENCY_FIRST_NAMES = [
  'Lucas',
  'Gabriel',
  'Matheus',
  'Rafael',
  'Bruno',
  'Cauã',
  'João',
  'Pedro',
  'Enzo',
  'Henrique',
];
const EMERGENCY_LAST_NAMES = [
  'Silva',
  'Santos',
  'Oliveira',
  'Pereira',
  'Costa',
  'Almeida',
  'Ferreira',
  'Ribeiro',
  'Cardoso',
  'Nunes',
];

function createEmergencyAcademyBackup(
  clubId: string,
  position: NaturalPosition,
  existingNumbers: Set<number>,
  seedOffset: number
): Player {
  const sector: Player['sector'] =
    position === 'GOL'
      ? 'GOL'
      : position === 'ZAG' || position === 'LD' || position === 'LE'
      ? 'DEF'
      : position === 'VOL' || position === 'MC' || position === 'MEI'
      ? 'MEI'
      : 'ATA';

  const baseAttr = position === 'GOL' ? 11 : 10;
  const attrs: PlayerAttributes = {
    passe: baseAttr,
    finalizacao: position === 'ATA' ? 12 : baseAttr - 1,
    drible: baseAttr,
    desarme: sector === 'DEF' ? 12 : baseAttr - 1,
    primeiroToque: baseAttr,
    cruzamento: baseAttr - 1,
    decisoes: baseAttr,
    visaoDeJogo: baseAttr,
    compostura: baseAttr,
    semBola: baseAttr,
    posicionamento: position === 'GOL' || sector === 'DEF' ? 12 : baseAttr,
    indiceDeTrabalho: 12,
    velocidade: position === 'GOL' ? 9 : 12,
    aceleracao: position === 'GOL' ? 9 : 12,
    resistencia: 12,
    forca: 11,
    impulsao: position === 'GOL' ? 12 : 11,
    agilidade: position === 'GOL' ? 12 : 11,
  };

  let jersey = 31;
  while (existingNumbers.has(jersey) && jersey < 99) {
    jersey++;
  }
  existingNumbers.add(jersey);

  const first =
    EMERGENCY_FIRST_NAMES[(seedOffset + hashStr(clubId)) % EMERGENCY_FIRST_NAMES.length];
  const last =
    EMERGENCY_LAST_NAMES[(seedOffset * 3 + hashStr(position)) % EMERGENCY_LAST_NAMES.length];

  const defaultRole =
    position === 'GOL'
      ? 'gk_classic'
      : position === 'ZAG'
      ? 'cb_stopper'
      : position === 'LD' || position === 'LE'
      ? 'fb_support'
      : position === 'VOL'
      ? 'dm_anchor'
      : position === 'MC' || position === 'MEI'
      ? 'cm_box'
      : 'st_poacher';

  return {
    id: `${clubId}-acad-${Date.now()}-${seedOffset}`,
    number: jersey,
    name: `${first} ${last}`,
    age: 19,
    nationality: 'Brasil',
    position,
    sector,
    condition: 96,
    morale: 'Bom',
    marketValue: 1_200_000,
    salary: 25_000,
    potentialStars: 2.5,
    basePotentialOvr: 73,
    dynamicCeilingOvr: 76,
    attributes: attrs,
    isStarter: false,
    slotIndex: null,
    assignedRole: defaultRole,
    assignedDuty: sector === 'DEF' || sector === 'GOL' ? 'Defender' : 'Apoiar',
    injured: false,
    contractType: 'DEFINITIVO',
    contractYearsRemaining: 3,
    seasonStats: {
      matches: 0,
      goals: 0,
      assists: 0,
      yellowCards: 0,
      avgRating: 6.75,
    },
    isRegen: true,
    recentOvrDelta: 0,
  };
}

function healClubRosterAfterRetirements(
  survivingSquad: Player[],
  clubId: string
): Player[] {
  const squad = [...survivingSquad];
  const usedNumbers = new Set(squad.map((p) => p.number));
  let seedOffset = 1;

  // Guarantee at least 1 goalkeeper
  if (!squad.some((p) => p.position === 'GOL')) {
    squad.push(
      createEmergencyAcademyBackup(clubId, 'GOL', usedNumbers, seedOffset++)
    );
  }

  // Guarantee minimum 16 players for match & market safety
  const fillerPositions: NaturalPosition[] = ['ZAG', 'MC', 'ATA', 'LD', 'MEI'];
  while (squad.length < 16) {
    const pos = fillerPositions[(seedOffset - 1) % fillerPositions.length];
    squad.push(
      createEmergencyAcademyBackup(clubId, pos, usedNumbers, seedOffset++)
    );
  }

  // Guarantee valid 11 starters (slots 0..10) if any starter retired
  const starterMap = new Map<number, Player>();
  const unassigned: Player[] = [];

  for (const p of squad) {
    if (
      p.isStarter &&
      typeof p.slotIndex === 'number' &&
      p.slotIndex >= 0 &&
      p.slotIndex <= 10 &&
      !starterMap.has(p.slotIndex)
    ) {
      starterMap.set(p.slotIndex, p);
    } else {
      unassigned.push({ ...p, isStarter: false, slotIndex: null });
    }
  }

  if (starterMap.size < 11) {
    for (let sIdx = 0; sIdx <= 10; sIdx++) {
      if (starterMap.has(sIdx)) continue;
      // Pick best remaining candidate (slot 0 prefers GOL, otherwise outfield)
      unassigned.sort((a, b) => {
        const aOvr = calculatePlayerOverall(a.attributes, a.position);
        const bOvr = calculatePlayerOverall(b.attributes, b.position);
        const aBias = sIdx === 0 ? (a.position === 'GOL' ? 40 : -40) : a.position === 'GOL' ? -40 : 0;
        const bBias = sIdx === 0 ? (b.position === 'GOL' ? 40 : -40) : b.position === 'GOL' ? -40 : 0;
        return bOvr + bBias - (aOvr + aBias);
      });
      const promoted = unassigned.shift();
      if (promoted) {
        starterMap.set(sIdx, {
          ...promoted,
          isStarter: true,
          slotIndex: sIdx,
        });
      }
    }
  }

  const starterIds = new Set(Array.from(starterMap.values()).map((p) => p.id));
  return [
    ...Array.from(starterMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, p]) => p),
    ...unassigned.filter((p) => !starterIds.has(p.id)),
  ];
}

/**
 * Executes end-of-season aging (+1 year), attribute/OVR evolution & regression,
 * and age/usage/OVR-weighted player retirements across ALL squads and free agency.
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
  retiredUserPlayers: RetiredPlayerReportItem[];
  retiredAiCount: number;
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
    division: ClubDivision
  ): {
    evolved: Player;
    report: PlayerEvolutionReportItem;
    retiredItem: RetiredPlayerReportItem | null;
  } => {
    const oldOvr = calculatePlayerOverall(player.attributes, player.position);
    const oldAge = player.age;
    const newAge = oldAge + 1;
    const stars =
      player.potentialStars ??
      assignPotentialStars(oldOvr, oldAge, clubRep, player.id, player.name);
    const dynProfile = getDynamicPotentialProfile(stars);
    const basePot = player.basePotentialOvr ?? dynProfile.basePotentialOvr;
    const dynCeiling = player.dynamicCeilingOvr ?? dynProfile.dynamicCeilingOvr;

    const grp = getPositionGroup(player.position);
    const growth = calculateDynamicPerformanceGrowth({
      player,
      currentAge: newAge,
      stars,
      basePotentialOvr: basePot,
      dynamicCeilingOvr: dynCeiling,
      isMidSeason: false,
      peerAverageScore: avgByGroup[grp] ?? 0.4,
      rng,
    });

    const updatedAttrs = adjustAttributesByDelta(
      player.attributes,
      player.position,
      growth.desiredDelta,
      growth.effectiveCeiling,
      growth.isPhysicalDecline,
      rng
    );
    const newOvr = calculatePlayerOverall(updatedAttrs, player.position);
    const breakoutBonusOvr = growth.isExceptional
      ? Math.max(0, newOvr - (growth.effectiveCeiling - growth.bonusOvrBeyondCeiling))
      : 0;
    const newDynamicCeiling =
      growth.nextDynamicCeilingOvr !== undefined
        ? Math.max(newOvr, Math.min(95, growth.nextDynamicCeilingOvr))
        : Math.max(dynCeiling, newOvr);
    const newBasePotential =
      growth.nextBasePotentialOvr !== undefined
        ? Math.max(newOvr, Math.min(newDynamicCeiling, growth.nextBasePotentialOvr))
        : Math.max(newOvr, Math.min(newDynamicCeiling, basePot));

    const { marketValue, salary } = calculateBalancedValuationAndWage({
      ovr: newOvr,
      age: newAge,
      clubReputation: clubRep,
      division,
      potentialStars: growth.promotedStars,
      position: player.position,
    });

    // Check retirement decision using original pre-reset seasonStats & active status
    const retirementEval = evaluatePlayerRetirementProbability(
      player,
      newOvr,
      newAge
    );
    let retiredItem: RetiredPlayerReportItem | null = null;
    if (
      retirementEval.isConsideringRetirement &&
      rng() < retirementEval.annualProbability
    ) {
      retiredItem = {
        playerId: player.id,
        playerName: player.name,
        position: player.position,
        ageAtRetirement: newAge,
        lastOvr: newOvr,
        matchesPlayed: player.seasonStats.matches,
        reasonNote: retirementEval.factorNote,
      };
    }

    const evolved: Player = {
      ...player,
      age: newAge,
      potentialStars: growth.promotedStars,
      basePotentialOvr: newBasePotential,
      dynamicCeilingOvr: newDynamicCeiling,
      attributes: updatedAttrs,
      marketValue,
      salary,
      recentOvrDelta: newOvr - oldOvr,
      exceededExpectations: growth.isExceptional,
      breakoutBonusOvr,
      growthMultiplier: growth.growthMultiplier,
      developmentStatus: growth.developmentStatus,
      condition: 94,
      injured:
        player.injured && (player.injuryDaysRemaining ?? 0) > 55 ? true : false,
      injuryType:
        player.injured && (player.injuryDaysRemaining ?? 0) > 55
          ? player.injuryType
          : undefined,
      injurySeverity:
        player.injured && (player.injuryDaysRemaining ?? 0) > 55
          ? player.injurySeverity
          : undefined,
      injuryDaysRemaining:
        player.injured && (player.injuryDaysRemaining ?? 0) > 55
          ? (player.injuryDaysRemaining ?? 0) - 55
          : 0,
      injuryTotalDays:
        player.injured && (player.injuryDaysRemaining ?? 0) > 55
          ? player.injuryTotalDays
          : undefined,
      injuryNote:
        player.injured && (player.injuryDaysRemaining ?? 0) > 55
          ? `${player.injuryType || 'Lesão grave'} (${(player.injuryDaysRemaining ?? 0) - 55}d restantes)`
          : undefined,
      consecutiveMatches: 0,
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
      retiredItem,
      report: {
        playerId: player.id,
        playerName: player.name,
        position: player.position,
        shirtNumber: player.number,
        oldAge,
        newAge,
        oldOvr,
        newOvr,
        deltaOvr: newOvr - oldOvr,
        oldPotentialStars: stars,
        potentialStars: growth.promotedStars,
        oldMarketValue: player.marketValue,
        newMarketValue: marketValue,
        matchesPlayed: player.seasonStats.matches,
        goals: player.seasonStats.goals,
        assists: player.seasonStats.assists,
        avgRating: player.seasonStats.avgRating,
        reasonNote: growth.reasonNote,
        exceededExpectations: growth.isExceptional,
        formerCeiling: growth.effectiveCeiling - growth.bonusOvrBeyondCeiling,
        starsPromoted: growth.starsPromoted,
        breakoutBonusOvr,
        growthMultiplier: growth.growthMultiplier,
        developmentStatus: growth.developmentStatus,
      },
    };
  };

  const userClub = clubMap.get(userClubId) || clubs[0];
  const userEvoPairs = userSquad.map((p) =>
    evolveSinglePlayer(p, userClub.reputation, userClub.division)
  );
  const retiredUserPlayers: RetiredPlayerReportItem[] = [];
  const survivingUserRaw: Player[] = [];
  const userEvolutionReport: PlayerEvolutionReportItem[] = [];

  for (const pair of userEvoPairs) {
    if (pair.retiredItem) {
      retiredUserPlayers.push(pair.retiredItem);
    } else {
      survivingUserRaw.push(pair.evolved);
      userEvolutionReport.push(pair.report);
    }
  }
  const updatedUserSquad = healClubRosterAfterRetirements(
    survivingUserRaw,
    userClubId
  );

  let retiredAiCount = 0;
  const updatedAiSquads: Record<string, Player[]> = {};
  for (const [cid, list] of Object.entries(aiSquads)) {
    const c = clubMap.get(cid);
    const survivors: Player[] = [];
    for (const p of list) {
      const res = evolveSinglePlayer(
        p,
        c?.reputation ?? 74,
        c?.division ?? 'A'
      );
      if (res.retiredItem) {
        retiredAiCount++;
      } else {
        survivors.push(res.evolved);
      }
    }
    updatedAiSquads[cid] = healClubRosterAfterRetirements(survivors, cid);
  }

  const updatedLoanedOut: Player[] = [];
  for (const p of loanedOutPlayers) {
    const res = evolveSinglePlayer(p, userClub.reputation, userClub.division);
    if (res.retiredItem) {
      retiredUserPlayers.push(res.retiredItem);
    } else {
      updatedLoanedOut.push(res.evolved);
      userEvolutionReport.push({ ...res.report, isLoanedOut: true });
    }
  }

  // Free agents: age +1, retire veterans smoothly and replace with new younger free agents
  const updatedFreeAgents = freeAgents.map((fa, idx) => {
    const pair = evolveSinglePlayer(fa, 72, 'A');
    if (pair.retiredItem) {
      const ovr = calculatePlayerOverall(
        pair.evolved.attributes,
        pair.evolved.position
      );
      const stars: PotentialStars = 2.5;
      const newAge = 23 + (idx % 4);
      const { marketValue, salary } = calculateBalancedValuationAndWage({
        ovr: Math.max(65, Math.min(75, ovr)),
        age: newAge,
        clubReputation: 72,
        division: 'A',
        potentialStars: stars,
        position: pair.evolved.position,
      });
      const first =
        EMERGENCY_FIRST_NAMES[(idx + 2) % EMERGENCY_FIRST_NAMES.length];
      const last =
        EMERGENCY_LAST_NAMES[(idx * 5 + 1) % EMERGENCY_LAST_NAMES.length];
      return {
        ...pair.evolved,
        id: `fa-regen-${Date.now()}-${idx}`,
        name: `${first} ${last}`,
        age: newAge,
        potentialStars: stars,
        marketValue,
        salary,
        recentOvrDelta: 0,
      };
    }
    return pair.evolved;
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
      return Math.min(95, Math.max(60, Math.round(sum / matching.length)));
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
    retiredUserPlayers,
    retiredAiCount,
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
    division: ClubDivision
  ): { evolved: Player; report: PlayerEvolutionReportItem } => {
    const oldOvr = calculatePlayerOverall(player.attributes, player.position);
    const oldAge = player.age;
    const stars =
      player.potentialStars ??
      assignPotentialStars(oldOvr, oldAge, clubRep, player.id, player.name);
    const dynProfile = getDynamicPotentialProfile(stars);
    const basePot = player.basePotentialOvr ?? dynProfile.basePotentialOvr;
    const dynCeiling = player.dynamicCeilingOvr ?? dynProfile.dynamicCeilingOvr;

    const grp = getPositionGroup(player.position);
    const growth = calculateDynamicPerformanceGrowth({
      player,
      currentAge: oldAge,
      stars,
      basePotentialOvr: basePot,
      dynamicCeilingOvr: dynCeiling,
      isMidSeason: true,
      peerAverageScore: avgByGroup[grp] ?? 0.4,
      rng,
    });

    const updatedAttrs = adjustAttributesByDelta(
      player.attributes,
      player.position,
      growth.desiredDelta,
      growth.effectiveCeiling,
      growth.isPhysicalDecline,
      rng
    );
    const newOvr = calculatePlayerOverall(updatedAttrs, player.position);
    const deltaOvr = newOvr - oldOvr;
    const breakoutBonusOvr = growth.isExceptional
      ? Math.max(0, newOvr - (growth.effectiveCeiling - growth.bonusOvrBeyondCeiling))
      : 0;
    const newDynamicCeiling =
      growth.nextDynamicCeilingOvr !== undefined
        ? Math.max(newOvr, Math.min(95, growth.nextDynamicCeilingOvr))
        : Math.max(dynCeiling, newOvr);
    const newBasePotential =
      growth.nextBasePotentialOvr !== undefined
        ? Math.max(newOvr, Math.min(newDynamicCeiling, growth.nextBasePotentialOvr))
        : Math.max(newOvr, Math.min(newDynamicCeiling, basePot));

    const { marketValue, salary } = calculateBalancedValuationAndWage({
      ovr: newOvr,
      age: oldAge,
      clubReputation: clubRep,
      division,
      potentialStars: growth.promotedStars,
      position: player.position,
    });

    const evolved: Player = {
      ...player,
      potentialStars: growth.promotedStars,
      basePotentialOvr: newBasePotential,
      dynamicCeilingOvr: newDynamicCeiling,
      attributes: updatedAttrs,
      marketValue,
      salary,
      recentOvrDelta: deltaOvr,
      exceededExpectations: growth.isExceptional,
      breakoutBonusOvr,
      growthMultiplier: growth.growthMultiplier,
      developmentStatus: growth.developmentStatus,
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
        potentialStars: growth.promotedStars,
        reasonNote: growth.reasonNote,
        exceededExpectations: growth.isExceptional,
        formerCeiling: growth.effectiveCeiling - growth.bonusOvrBeyondCeiling,
        starsPromoted: growth.starsPromoted,
        breakoutBonusOvr,
        growthMultiplier: growth.growthMultiplier,
        developmentStatus: growth.developmentStatus,
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

export interface PostMatchEvolutionInput {
  player: Player;
  matchRating: number;
  goals?: number;
  assists?: number;
  redCard?: boolean;
  clubReputation?: number;
  division?: ClubDivision;
  rng?: () => number;
}

/**
 * Applies per-match probabilistic development & regression after a game:
 * - Strong performances have probabilistic chances to boost key attributes, OVR, or raise potential ceiling.
 * - Poor / carded performances or veteran wear have probabilistic chances to drop attributes AND erode unrealized potential ("chance de não se tornar bom jogador").
 */
export function applyPostMatchProbabilisticEvolution(
  input: PostMatchEvolutionInput
): Player {
  const {
    player,
    matchRating,
    goals = 0,
    assists = 0,
    redCard = false,
    clubReputation = 75,
    division = 'A',
    rng = Math.random,
  } = input;

  const oldOvr = calculatePlayerOverall(player.attributes, player.position);
  let stars: PotentialStars =
    player.potentialStars ??
    assignPotentialStars(oldOvr, player.age, clubReputation, player.id, player.name);
  const dynProfile = getDynamicPotentialProfile(stars);
  let basePot = player.basePotentialOvr ?? dynProfile.basePotentialOvr;
  let dynCeiling = player.dynamicCeilingOvr ?? dynProfile.dynamicCeilingOvr;

  const effectiveScore =
    matchRating + goals * 0.25 + assists * 0.15 - (redCard ? 0.85 : 0);

  // Plasticity & fragility by age bracket
  const posMult =
    player.age <= 21
      ? 1.38
      : player.age <= 24
      ? 1.12
      : player.age <= 28
      ? 0.72
      : player.age <= 31
      ? 0.34
      : 0.12;

  const starBoost = stars >= 4.5 && player.age <= 23 ? 1.15 : 1.0;

  let nextAttrs: PlayerAttributes = { ...player.attributes };
  let mutatedAttr = false;
  let exceededNow = Boolean(player.exceededExpectations);
  let devStatus = player.developmentStatus;

  const positiveTargetKeys: (keyof PlayerAttributes)[] = (() => {
    if (goals > 0 && player.position !== 'GOL') {
      return ['finalizacao', 'semBola', 'compostura', 'primeiroToque', 'drible'];
    }
    if (assists > 0 && player.position !== 'GOL') {
      return ['visaoDeJogo', 'passe', 'cruzamento', 'primeiroToque', 'decisoes'];
    }
    switch (player.position) {
      case 'GOL':
        return ['posicionamento', 'agilidade', 'impulsao', 'compostura', 'decisoes'];
      case 'ZAG':
        return ['desarme', 'posicionamento', 'forca', 'impulsao', 'compostura'];
      case 'LD':
      case 'LE':
        return ['cruzamento', 'velocidade', 'desarme', 'resistencia', 'passe'];
      case 'VOL':
        return ['desarme', 'posicionamento', 'passe', 'decisoes', 'indiceDeTrabalho'];
      case 'MC':
      case 'MEI':
        return ['passe', 'visaoDeJogo', 'drible', 'primeiroToque', 'decisoes'];
      case 'PD':
      case 'PE':
        return ['drible', 'velocidade', 'aceleracao', 'cruzamento', 'finalizacao'];
      case 'ATA':
      default:
        return ['finalizacao', 'semBola', 'compostura', 'aceleracao', 'primeiroToque'];
    }
  })();

  const veteranPhysicalKeys: (keyof PlayerAttributes)[] = [
    'velocidade',
    'aceleracao',
    'resistencia',
    'agilidade',
  ];

  // 1. CHANCE DE MELHORAR COM A PARTIDA
  let improveProb = 0;
  if (effectiveScore >= 8.0) improveProb = 0.28;
  else if (effectiveScore >= 7.5) improveProb = 0.18;
  else if (effectiveScore >= 7.15) improveProb = 0.10;
  else if (effectiveScore >= 6.95) improveProb = 0.045;

  improveProb = Math.min(0.45, improveProb * posMult * starBoost);

  if (improveProb > 0 && rng() < improveProb) {
    const maxCapOvr = Math.min(
      95,
      Math.max(
        oldOvr,
        getMaxRealisticOvrForAgeAndPotential(player.age, stars, {
          basePotentialOvr: basePot,
          dynamicCeilingOvr: dynCeiling,
          exceededExpectations: exceededNow,
        })
      )
    );

    const pickedKey =
      positiveTargetKeys[Math.floor(rng() * positiveTargetKeys.length)];
    const maxAttrCap = maxCapOvr >= 90 ? 20 : 19;

    if (nextAttrs[pickedKey] < maxAttrCap) {
      const candidateAttrs = {
        ...nextAttrs,
        [pickedKey]: nextAttrs[pickedKey] + 1,
      };
      const candidateOvr = calculatePlayerOverall(candidateAttrs, player.position);

      if (candidateOvr <= maxCapOvr) {
        nextAttrs = candidateAttrs;
        mutatedAttr = true;
        devStatus = 'EVOLUCAO_NORMAL';
      } else if (effectiveScore >= 7.8 && player.age <= 25 && rng() < 0.25 && dynCeiling < 95) {
        // Breakthrough performance expands ceiling right in match play
        dynCeiling = Math.min(95, Math.max(dynCeiling + 1, candidateOvr));
        basePot = Math.max(basePot, Math.min(dynCeiling, basePot + 1));
        nextAttrs = candidateAttrs;
        mutatedAttr = true;
        exceededNow = true;
        devStatus = 'SUPEROU_EXPECTATIVAS';
      }
    }
  }

  // Rare upside ceiling nudge on elite young displays (7.7+ score)
  if (effectiveScore >= 7.7 && player.age <= 24 && dynCeiling < 95 && rng() < 0.14) {
    dynCeiling = Math.min(95, dynCeiling + 1);
    basePot = Math.max(basePot, Math.min(dynCeiling, basePot + 1));
    if (stars < 4.5 && dynCeiling > getPotentialCeilingOvr(stars)) {
      stars = Math.min(4.5, stars + 0.5) as PotentialStars;
      exceededNow = true;
      devStatus = 'SUPEROU_EXPECTATIVAS';
    }
  }

  // 2. CHANCE DE REGRESSÃO / NÃO SE TORNAR BOM JOGADOR APÓS PARTIDA RUIM
  let regressProb = 0;
  if (redCard || effectiveScore < 5.95) {
    regressProb = 0.24;
  } else if (effectiveScore < 6.25) {
    regressProb = 0.14;
  } else if (effectiveScore < 6.50) {
    regressProb = 0.08;
  } else if (
    effectiveScore < 6.65 &&
    ((player.age <= 24 && stars >= 3) || player.age >= 32)
  ) {
    regressProb = 0.045;
  } else if (player.age >= 32 && effectiveScore < 6.85) {
    regressProb = 0.055;
  }

  const negAgeMult = player.age >= 32 ? 1.25 : player.age <= 23 ? 1.15 : 0.85;
  regressProb = Math.min(0.40, regressProb * negAgeMult);

  if (regressProb > 0 && rng() < regressProb) {
    const isVetPhysical = player.age >= 32;
    const pool = isVetPhysical ? veteranPhysicalKeys : positiveTargetKeys;
    const pickedKey = pool[Math.floor(rng() * pool.length)];
    const minAttrFloor = isVetPhysical ? 4 : 5;
    if (nextAttrs[pickedKey] > minAttrFloor) {
      const candidateAttrs = {
        ...nextAttrs,
        [pickedKey]: nextAttrs[pickedKey] - 1,
      };
      const candidateOvr = calculatePlayerOverall(candidateAttrs, player.position);
      if (candidateOvr >= 60) {
        nextAttrs = candidateAttrs;
        mutatedAttr = true;
        devStatus = isVetPhysical ? 'REGRESSAO_FISICA' : 'DECLINIO_TECNICO';
      }
    }

    // Young prospect losing long-term promise on disappointing match
    if (player.age <= 25 && (redCard || effectiveScore < 6.45) && dynCeiling > oldOvr + 1) {
      const bustChance = redCard || effectiveScore < 6.05 ? 0.36 : 0.18;
      if (rng() < bustChance) {
        const shrink = redCard && effectiveScore < 5.95 ? 3 : effectiveScore < 6.05 ? 2 : 1;
        dynCeiling = Math.max(oldOvr, dynCeiling - shrink);
        basePot = Math.max(oldOvr, Math.min(basePot, dynCeiling));
        const downStars = stepStarsDownForCeiling(stars, dynCeiling);
        if (downStars < stars) {
          stars = downStars;
        }
        devStatus = 'DECLINIO_TECNICO';
      }
    }
  } else if (
    player.age <= 24 &&
    (redCard || effectiveScore < 6.20) &&
    dynCeiling > oldOvr + 2 &&
    rng() < 0.16
  ) {
    // Even without immediate attribute drop, terrible displays chip away at unrealized hype
    dynCeiling = Math.max(oldOvr + 1, dynCeiling - 1);
    basePot = Math.max(oldOvr, Math.min(basePot, dynCeiling));
    const downStars = stepStarsDownForCeiling(stars, dynCeiling);
    if (downStars < stars) {
      stars = downStars;
      devStatus = 'DECLINIO_TECNICO';
    }
  }

  const newOvr = calculatePlayerOverall(nextAttrs, player.position);
  const deltaOvr = newOvr - oldOvr;
  const ceilingChanged =
    dynCeiling !== (player.dynamicCeilingOvr ?? dynProfile.dynamicCeilingOvr) ||
    stars !== player.potentialStars;

  if (!mutatedAttr && !ceilingChanged) {
    return player;
  }

  const { marketValue, salary } =
    deltaOvr !== 0 || stars !== player.potentialStars
      ? calculateBalancedValuationAndWage({
          ovr: newOvr,
          age: player.age,
          clubReputation,
          division,
          potentialStars: stars,
          position: player.position,
        })
      : { marketValue: player.marketValue, salary: player.salary };

  return {
    ...player,
    potentialStars: stars,
    basePotentialOvr: basePot,
    dynamicCeilingOvr: dynCeiling,
    attributes: nextAttrs,
    marketValue,
    salary,
    exceededExpectations: exceededNow,
    recentOvrDelta:
      deltaOvr !== 0 ? (player.recentOvrDelta ?? 0) + deltaOvr : player.recentOvrDelta,
    developmentStatus: devStatus ?? player.developmentStatus,
  };
}

