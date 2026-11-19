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
  RetiredPlayerReportItem,
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
 * Dynamic Potential Mechanism (Performance Ceiling calibrated to EA FC / PES):
 * 3.0★: Base Potential 74–76 (Dynamic Ceiling: 78)
 * 3.5★: Base Potential 77–79 (Dynamic Ceiling: 81)
 * 4.0★: Base Potential 80–83 (Dynamic Ceiling: 85)
 * 4.5★: Base Potential 84–87 (Dynamic Ceiling: 89)
 * 5.0★: Base Potential 88–92 (Dynamic Ceiling: 94)
 */
export function getDynamicPotentialProfile(
  stars: PotentialStars,
  rng: () => number = Math.random,
  currentOvr?: number,
  age?: number
): DynamicPotentialProfile {
  let baseMin = 63;
  let baseMax = 66;
  let ceiling = 68;
  let normalizedStars: PotentialStars = stars ?? 1;

  if (stars >= 5) {
    normalizedStars = 5;
    baseMin = 88;
    baseMax = 92;
    ceiling = 94;
  } else if (stars >= 4.5) {
    normalizedStars = 4.5;
    baseMin = 84;
    baseMax = 87;
    ceiling = 89;
  } else if (stars >= 4) {
    normalizedStars = 4;
    baseMin = 80;
    baseMax = 83;
    ceiling = 85;
  } else if (stars >= 3.5) {
    normalizedStars = 3.5;
    baseMin = 77;
    baseMax = 79;
    ceiling = 81;
  } else if (stars >= 3) {
    normalizedStars = 3;
    baseMin = 74;
    baseMax = 76;
    ceiling = 78;
  } else if (stars >= 2.5) {
    normalizedStars = 2.5;
    baseMin = 70;
    baseMax = 72;
    ceiling = 74;
  } else if (stars >= 2) {
    normalizedStars = 2;
    baseMin = 66;
    baseMax = 69;
    ceiling = 71;
  } else if (stars >= 1.5) {
    normalizedStars = 1.5;
    baseMin = 64;
    baseMax = 66;
    ceiling = 68;
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
      const maxGrowth = age <= 19 ? 14 : age <= 21 ? 11 : age <= 23 ? 8 : 6;
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
 * Maps Potential Stars (1..5, with half-stars) to the maximum realistic dynamic OVR ceiling (60..99 scale).
 */
export function getPotentialCeilingOvr(stars: PotentialStars): number {
  if (stars >= 5) return 94;
  if (stars >= 4.5) return 89;
  if (stars >= 4) return 85;
  if (stars >= 3.5) return 81;
  if (stars >= 3) return 78;
  if (stars >= 2.5) return 74;
  if (stars >= 2) return 71;
  return 68;
}

/**
 * Returns the maximum realistic OVR a player can have at a given age and star potential.
 * Supports high-potential youth academy prospects appearing with up to:
 * - 1.0★ to 2.5★: up to 70 OVR from youth
 * - 3.0★ to 4.0★: up to 75 OVR from youth
 * - 4.5★: up to 80 OVR from youth
 * - 5.0★: up to 85 OVR from youth
 */
export function getMaxRealisticOvrForAgeAndPotential(
  age: number,
  stars: PotentialStars,
  player?: { basePotentialOvr?: number; dynamicCeilingOvr?: number }
): number {
  const profile = getDynamicPotentialProfile(stars);
  const careerCeiling = player?.dynamicCeilingOvr ?? profile.dynamicCeilingOvr;

  const youthStarCap =
    stars >= 5 ? 85 : stars >= 4.5 ? 80 : stars >= 3 ? 75 : 70;

  let ageCap = careerCeiling;
  if (age <= 17) {
    ageCap = youthStarCap;
  } else if (age === 18) {
    ageCap = Math.max(youthStarCap, stars >= 5 ? 86 : stars >= 4.5 ? 82 : stars >= 3 ? 77 : 71);
  } else if (age === 19) {
    ageCap = Math.max(youthStarCap, stars >= 5 ? 87 : stars >= 4.5 ? 83 : stars >= 3 ? 78 : 72);
  } else if (age === 20) {
    ageCap = Math.max(youthStarCap, stars >= 5 ? 88 : stars >= 4.5 ? 85 : stars >= 3 ? 80 : 73);
  } else if (age === 21) {
    ageCap = Math.max(youthStarCap, stars >= 5 ? 90 : stars >= 4.5 ? 86 : stars >= 3 ? 82 : 74);
  } else if (age === 22) {
    ageCap = Math.max(youthStarCap, stars >= 5 ? 91 : stars >= 4.5 ? 88 : stars >= 3 ? 83 : 74);
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
    } else if (current < targetOvr) {
      const k = posKeys[guard % posKeys.length];
      if (next[k] < 19) {
        next[k] += 1;
      } else {
        const anyKey = allKeys[guard % allKeys.length];
        if (next[anyKey] < 19) next[anyKey] += 1;
      }
    } else {
      break;
    }
  }

  return next;
}

/**
 * Deterministic initial star potential (1..5) based on current OVR, age, club reputation, and player ID.
 * Calibrated to EA FC / eFootball (PES) standards:
 * - 5.0★: Rare U21 world-class wonderkids (Endrick, Estêvão, Arda Güler, Savinho) or 85+ OVR superstars
 * - 4.5★: Elite U23 prospects (Vitor Roque, Beraldo, Vitor Reis, Moscardo) or prime 81-84 OVR stars (Arrascaeta, Pedro, Paquetá, Martinelli)
 * - 4.0★: Top Série A / Libertadores starters (77-80 OVR) or promising U23 talents (72-75 OVR)
 * - 3.5★: Solid Série A starters (74-76 OVR) or good U23 prospects (68-71 OVR)
 * - 3.0★: Série A rotation / strong Série B starters (70-73 OVR)
 * - 2.5★: Série B regulars (66-69 OVR)
 * - 2.0★: Série B backups (<= 65 OVR)
 */
export function assignPotentialStars(
  ovr: number,
  age: number,
  clubReputation: number = 78,
  playerId: string = 'p'
): PotentialStars {
  const roll = (hashStr(playerId) % 100) / 100;
  let score = 2.5;

  if (age <= 20) {
    if (ovr >= 76) score = 4.9;
    else if (ovr >= 72) score = 4.5;
    else if (ovr >= 69) score = 4.0;
    else if (ovr >= 66) score = 3.5;
    else if (ovr >= 63) score = 3.0;
    else score = 2.5;
    if (clubReputation >= 84 && roll > 0.65) score += 0.25;
  } else if (age <= 23) {
    if (ovr >= 79) score = 4.9;
    else if (ovr >= 75) score = 4.5;
    else if (ovr >= 72) score = 4.0;
    else if (ovr >= 69) score = 3.5;
    else if (ovr >= 65) score = 3.0;
    else score = 2.5;
    if (clubReputation >= 85 && roll > 0.75) score += 0.2;
  } else if (age <= 28) {
    if (ovr >= 85) score = 5.0;
    else if (ovr >= 81) score = 4.5;
    else if (ovr >= 77) score = 4.0;
    else if (ovr >= 74) score = 3.5;
    else if (ovr >= 70) score = 3.0;
    else if (ovr >= 66) score = 2.5;
    else score = 2.0;
  } else if (age <= 32) {
    if (ovr >= 85) score = 5.0;
    else if (ovr >= 81) score = 4.5;
    else if (ovr >= 77) score = 4.0;
    else if (ovr >= 74) score = 3.5;
    else if (ovr >= 70) score = 3.0;
    else if (ovr >= 66) score = 2.5;
    else score = 2.0;
  } else {
    // 33+ veterans
    if (ovr >= 83) score = 4.5;
    else if (ovr >= 78) score = 4.0;
    else if (ovr >= 74) score = 3.5;
    else if (ovr >= 70) score = 3.0;
    else if (ovr >= 66) score = 2.5;
    else score = 2.0;
  }

  const roundedHalf = Math.round(score * 2) / 2;
  return Math.max(1, Math.min(5, roundedHalf)) as PotentialStars;
}

/**
 * Healthy market value and monthly salary calculation based primarily on OVR + Potential Upside +
 * moderate Age curve + Club Relevance + Position.
 * OVR is the decisive factor: even a 36–39yo superstar with 85–88+ OVR retains high market value
 * (e.g. R$ 50M–65M+ for an 88 OVR 38yo star), while still being worth less than a 21yo of the exact same OVR.
 * Base currency is BRL (1 EUR ≈ R$ 6,00).
 */
export function calculateBalancedValuationAndWage(params: {
  ovr: number;
  age: number;
  clubReputation: number;
  division: 'A' | 'B' | 'LIB';
  potentialStars: PotentialStars;
  position?: NaturalPosition;
}): { marketValue: number; salary: number } {
  const { ovr, age, clubReputation, division, potentialStars, position } = params;

  // Blend current OVR with potential upside for younger players so elite U24 prospects
  // are worth more than older players of the same OVR.
  const ceiling = getPotentialCeilingOvr(potentialStars);
  const upsideWeight =
    age <= 19
      ? 0.30
      : age <= 21
      ? 0.24
      : age <= 23
      ? 0.15
      : age <= 25
      ? 0.08
      : 0;
  const upsideBonus =
    ceiling > ovr && upsideWeight > 0
      ? Math.min(7.0, (ceiling - ovr) * upsideWeight)
      : 0;
  const effectiveOvr = Math.min(99, ovr + upsideBonus);

  // Smooth continuous exponential curve on effective OVR 60..99 (OVR is the dominant driver)
  const u = Math.max(0, effectiveOvr - 60);
  const baseVal = 650_000 + Math.pow(u, 2.38) * 32_000;

  // Moderate age curve: age influences value, but OVR remains the heavyweight factor
  let ageMult = 1.0;
  if (age <= 20) {
    ageMult = 1.20;
  } else if (age <= 23) {
    ageMult = 1.14;
  } else if (age <= 25) {
    ageMult = 1.08;
  } else if (age <= 27) {
    ageMult = 1.02;
  } else if (age === 28) {
    ageMult = 0.97;
  } else if (age === 29) {
    ageMult = 0.92;
  } else if (age === 30) {
    ageMult = 0.86;
  } else if (age === 31) {
    ageMult = 0.80;
  } else if (age === 32) {
    ageMult = 0.75;
  } else if (age === 33) {
    ageMult = 0.70;
  } else if (age === 34) {
    ageMult = 0.65;
  } else if (age === 35) {
    ageMult = 0.60;
  } else if (age === 36) {
    ageMult = 0.56;
  } else if (age === 37) {
    ageMult = 0.52;
  } else {
    ageMult = Math.max(0.45, 0.49 - (age - 38) * 0.02);
  }

  // High-OVR veterans (80+ OVR) retain extra immediate technical market value
  if (age >= 30 && ovr >= 80) {
    const eliteOvrRetention =
      ovr >= 87 ? 0.14 : ovr >= 84 ? 0.10 : ovr >= 82 ? 0.06 : 0.03;
    ageMult = Math.min(0.90, ageMult + eliteOvrRetention);
  }

  // Subtle star aura multiplier
  const potMult = 0.94 + potentialStars * 0.024;

  // Position market premium (attackers & creative mids command higher fees than goalkeepers)
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
    posMult = 1.1;
  }

  // Club relevance & division factor
  const divMult = division === 'B' ? 0.62 : division === 'LIB' ? 0.96 : 1.0;
  const repMult = Math.max(
    0.68,
    Math.min(1.38, Math.pow(clubReputation / 84, 1.3))
  );

  // Pure OVR minimum value floor so an 85-88+ OVR player is never sold for a pittance regardless of age/club
  const pureOvrBase = 650_000 + Math.pow(Math.max(0, ovr - 60), 2.38) * 32_000;
  const ovrFloor =
    ovr >= 86
      ? pureOvrBase * 0.56
      : ovr >= 82
      ? pureOvrBase * 0.48
      : ovr >= 78
      ? pureOvrBase * 0.40
      : 300_000;

  const rawValue = Math.max(
    ovrFloor,
    baseVal * ageMult * potMult * posMult * divMult * repMult
  );
  const step = rawValue < 1_500_000 ? 50_000 : 250_000;
  const marketValue = Math.min(
    280_000_000,
    Math.max(300_000, Math.round(rawValue / step) * step)
  );

  // Balanced monthly salary aligned with real Série A/B/CONMEBOL club payrolls:
  // Older / experienced players command HIGHER salaries than young players of equal OVR,
  // even while their resale marketValue is lower.
  const t = Math.max(0, ovr - 60);
  const baseSalary = 15_000 + Math.pow(t, 1.92) * 820;
  const salaryAgeMult =
    age >= 34
      ? 1.32
      : age >= 31
      ? 1.22
      : age >= 28
      ? 1.12
      : age >= 24
      ? 1.0
      : age >= 21
      ? 0.82
      : 0.68;
  const salaryDivMult = division === 'B' ? 0.65 : division === 'LIB' ? 0.88 : 1.0;
  const salaryRepMult = Math.max(
    0.58,
    Math.min(1.26, Math.pow(clubReputation / 84, 1.3))
  );
  const hardSalaryCap =
    ovr < 70
      ? 110_000
      : ovr < 75
      ? 230_000
      : ovr < 80
      ? 460_000
      : ovr < 85
      ? 880_000
      : 1_500_000;

  const rawSalary = baseSalary * salaryAgeMult * salaryDivMult * salaryRepMult;
  const salary = Math.min(
    hardSalaryCap,
    Math.max(15_000, Math.round(rawSalary / 5_000) * 5_000)
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
  division: 'A' | 'B' | 'LIB' = 'A',
  currentYear: number = 2026
): Player {
  let attributes = player.attributes;
  let ovr = calculatePlayerOverall(attributes, player.position);
  const potentialStars =
    player.potentialStars ??
    assignPotentialStars(ovr, player.age, clubReputation, player.id);
  const contractTerms = assignDefaultContractTerms(player, currentYear);

  // Sanitize any young player or regen whose OVR exceeds the realistic cap for their star tier
  const maxAllowedForAge = getMaxRealisticOvrForAgeAndPotential(
    player.age,
    potentialStars,
    player
  );
  if ((player.age <= 22 || player.isRegen) && ovr > maxAllowedForAge) {
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
        ? Math.max(15_000, Math.round((recalc.salary * 0.45) / 5_000) * 5_000)
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

  // Upgrade any veteran player whose saved marketValue was severely undervalued by legacy age multipliers
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
  const titlesBonus = Math.min(14, (club.recentTitles?.length ?? 0) * 3.5);
  const divBonus = club.division === 'A' ? 6 : 0;
  const compositeScore =
    club.reputation * 0.58 + squadAvgOvr * 0.42 + titlesBonus + divBonus;

  const tier =
    SPONSOR_BRANDS_BY_TIER.find((t) => compositeScore >= t.minScore) ||
    SPONSOR_BRANDS_BY_TIER[SPONSOR_BRANDS_BY_TIER.length - 1];

  const sponsorIdx = (hashStr(club.id) + seasonYear) % tier.sponsors.length;
  const sponsorName = tier.sponsors[sponsorIdx];

  // Annual sponsorship + commercial package calibrated to 2025/2026 Brasileirão Série A & B realities:
  // Série B: ~R$ 9M to R$ 24M/year · Série A: ~R$ 24M (newly promoted) to R$ 135M/year (elite champions)
  const baseAnnual =
    club.division === 'B'
      ? 8_500_000 + Math.max(0, compositeScore - 58) * 750_000
      : 22_000_000 + Math.max(0, compositeScore - 68) * 2_850_000;

  const titleMultiplier = 1 + Math.min(0.35, (club.recentTitles?.length ?? 0) * 0.08);
  const annualValue = Math.min(
    135_000_000,
    Math.max(7_000_000, Math.round((baseAnnual * titleMultiplier) / 500_000) * 500_000)
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
  developmentStatus:
    | 'SUPEROU_EXPECTATIVAS'
    | 'EVOLUCAO_NORMAL'
    | 'ESTAGNADO'
    | 'DECLINIO_TECNICO'
    | 'REGRESSAO_FISICA';
  reasonNote: string;
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

  const isExceptional =
    matches >= minMatchesForBreakout &&
    (avgRating >= 7.20 || relativePerf >= 0.52 || (isAttackerOrMid && goalsAndAssists >= (isMidSeason ? 8 : 12)));

  let canExceedCeiling = false;
  let bonusOvrBeyondCeiling = 0;
  let effectiveCeiling = standardAgeCeiling;
  let desiredDelta = 0;
  let isPhysicalDecline = false;
  let starsPromoted = false;
  let promotedStars = stars;
  let developmentStatus: DynamicPerformanceGrowthResult['developmentStatus'] = 'EVOLUCAO_NORMAL';
  let reasonNote = isMidSeason ? 'Primeiro turno regular' : 'Temporada regular';

  const gaText =
    goals > 0 || assists > 0
      ? ` (${goals > 0 ? `${goals}g` : ''}${goals > 0 && assists > 0 ? ', ' : ''}${assists > 0 ? `${assists}a` : ''})`
      : '';

  // =========================================================================
  // FAIXA 1: ATÉ 25 ANOS (currentAge <= 25)
  // Evolui muito bem, mas pode evoluir pouco ou até regredir mesmo com pouca idade
  // =========================================================================
  if (currentAge <= 25) {
    if (isExceptional) {
      canExceedCeiling = true;
      developmentStatus = 'SUPEROU_EXPECTATIVAS';
      const superExcellence =
        avgRating >= 7.35 || relativePerf >= 0.80 || goalsAndAssists >= (isMidSeason ? 10 : 16);
      bonusOvrBeyondCeiling = superExcellence ? (isMidSeason ? 2 : 3) : (isMidSeason ? 1 : 2);
      effectiveCeiling = Math.min(
        99,
        Math.max(oldOvr + (isMidSeason ? 1 : 2), standardAgeCeiling + bonusOvrBeyondCeiling)
      );
      const baseDelta = isMidSeason ? 1.15 : 2.15;
      desiredDelta = Math.min(
        isMidSeason ? 2 : 4,
        Math.max(isMidSeason ? 1 : 2, Math.round(baseDelta * Math.max(1.1, growthMultiplier)))
      );
      if (stars < 5) {
        promotedStars = Math.min(5, stars + (stars <= 3 ? 1 : 0.5)) as PotentialStars;
        starsPromoted = promotedStars > stars;
      }
      reasonNote = `⚡ Superou expectativas (Até 25a)! Multiplicador de ${growthMultiplier.toFixed(2)}x (nota ${avgRating.toFixed(2)}${gaText}) rompeu o teto de ${stars}★ (+${desiredDelta} OVR)!`;
    } else if (hasPoorPerformance) {
      growthMultiplier = Math.min(-0.5, growthMultiplier);
      desiredDelta = -1;
      developmentStatus = 'DECLINIO_TECNICO';
      if (stars >= 3.5 && matches >= (isMidSeason ? 8 : 14) && avgRating < 6.50) {
        promotedStars = Math.max(1, stars - 0.5) as PotentialStars;
      }
      reasonNote = `Mesmo jovem (${currentAge}a), o baixo rendimento em campo (${matches}j, nota ${avgRating.toFixed(2)}) gerou regressão técnica (-1 OVR).`;
    } else if (hasLowMinutes) {
      growthMultiplier = 0;
      // Jovem sem jogar quase nada pode estagnar (+0) ou até regredir (-1) por falta de ritmo/oscilação
      if (avgRating < 6.68 && rng() < 0.25) {
        desiredDelta = -1;
        developmentStatus = 'DECLINIO_TECNICO';
        reasonNote = `Falta de ritmo de jogo (${matches}j) e oscilação na faixa jovem causaram leve regressão (-1 OVR).`;
      } else {
        desiredDelta = 0;
        developmentStatus = 'ESTAGNADO';
        reasonNote = `Minutagem insuficiente (${matches}j) impediu evolução nesta temporada (+0 OVR).`;
      }
    } else {
      // Evolução regular muito boa até os 25 anos (+1 a +3 OVR), com chance de oscilação/pouca evolução
      if (oldOvr >= standardAgeCeiling) {
        desiredDelta = 0;
        developmentStatus = 'ESTAGNADO';
        reasonNote = 'Rendimento regular atingiu o teto padrão atual da categoria.';
      } else if (avgRating < 6.74 && rng() < 0.18) {
        // Oscilação natural mesmo jovem: evolui zero ou até regride -1 se temporada foi irregular
        desiredDelta = rng() < 0.35 ? -1 : 0;
        developmentStatus = desiredDelta < 0 ? 'DECLINIO_TECNICO' : 'ESTAGNADO';
        reasonNote =
          desiredDelta < 0
            ? `Temporada irregular (${avgRating.toFixed(2)}) provocou oscilação negativa mesmo aos ${currentAge} anos (-1 OVR).`
            : `Oscilação natural aos ${currentAge} anos resultou em pouca evolução neste ciclo (+0 OVR).`;
      } else {
        const ageBoost = currentAge <= 21 ? 1.25 : 1.1;
        const rawStep = Math.round(ageBoost * growthMultiplier);
        const maxRegularStep = isMidSeason ? 2 : 3;
        desiredDelta = Math.min(
          maxRegularStep,
          Math.max(0, Math.min(rawStep, standardAgeCeiling - oldOvr))
        );
        if (desiredDelta === 0 && oldOvr < standardAgeCeiling && growthMultiplier >= 0.8 && rng() < 0.65) {
          desiredDelta = 1;
        }
        developmentStatus = desiredDelta > 0 ? 'EVOLUCAO_NORMAL' : 'ESTAGNADO';
        reasonNote = `Forte evolução na faixa até 25 anos (${matches}j, nota ${avgRating.toFixed(2)}, mult. ${growthMultiplier.toFixed(2)}x).`;
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
        99,
        Math.max(oldOvr + 1, standardAgeCeiling + bonusOvrBeyondCeiling)
      );
      desiredDelta = isMidSeason
        ? 1
        : growthMultiplier >= 1.65 && avgRating >= 7.3
        ? 2
        : 1;
      if (stars < 5 && avgRating >= 7.3) {
        promotedStars = Math.min(5, stars + 0.5) as PotentialStars;
        starsPromoted = promotedStars > stars;
      }
      reasonNote = `⚡ Grande fase no auge (${currentAge}a)! Rendimento de ${avgRating.toFixed(2)}${gaText} rendeu evolução média-alta (+${desiredDelta} OVR).`;
    } else if (hasPoorPerformance) {
      growthMultiplier = Math.min(-0.5, growthMultiplier);
      desiredDelta = -1;
      developmentStatus = 'DECLINIO_TECNICO';
      reasonNote = `Baixo rendimento na faixa de 26–30 anos (${matches}j, nota ${avgRating.toFixed(2)}) gerou queda técnica (-1 OVR).`;
    } else if (hasLowMinutes) {
      growthMultiplier = 0;
      if (rng() < 0.3) {
        desiredDelta = -1;
        developmentStatus = 'DECLINIO_TECNICO';
        reasonNote = `Pouca minutagem (${matches}j) aos ${currentAge} anos causou perda de ritmo e queda (-1 OVR).`;
      } else {
        desiredDelta = 0;
        developmentStatus = 'ESTAGNADO';
        reasonNote = `Minutagem reduzida (${matches}j) manteve os atributos estáveis (+0 OVR).`;
      }
    } else {
      // Evolução média (26–30 anos): +1 OVR (ou +2 se excelente multiplicador) quando abaixo do teto
      if (oldOvr < standardAgeCeiling && growthMultiplier >= 1.45 && !isMidSeason) {
        desiredDelta = Math.min(2, standardAgeCeiling - oldOvr);
        developmentStatus = 'EVOLUCAO_NORMAL';
        reasonNote = `Evolução média consistente no auge (${currentAge}a, nota ${avgRating.toFixed(2)}, +${desiredDelta} OVR).`;
      } else if (oldOvr < standardAgeCeiling && growthMultiplier >= 0.95 && rng() < 0.65) {
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
        effectiveCeiling = Math.min(99, Math.max(oldOvr + 1, standardAgeCeiling + 1));
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
    division: 'A' | 'B' | 'LIB'
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
      assignPotentialStars(oldOvr, oldAge, clubRep, player.id);
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
    const newDynamicCeiling = Math.max(dynCeiling, newOvr);

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
      retiredItem,
      report: {
        playerId: player.id,
        playerName: player.name,
        position: player.position,
        oldAge,
        newAge,
        oldOvr,
        newOvr,
        deltaOvr: newOvr - oldOvr,
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
    const newDynamicCeiling = Math.max(dynCeiling, newOvr);

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
