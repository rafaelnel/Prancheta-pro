import {
  NaturalPosition,
  Player,
  PlayerAttributes,
  PositionSector,
  PotentialStars,
  YouthAcademyState,
  YouthInvestmentTier,
  YouthFocusSector,
  YouthRegenReportItem,
} from '../types/football';
import { calculatePlayerOverall } from './playerOverall';
import {
  calculateBalancedValuationAndWage,
  calibrateAttributesToTargetOvr,
  getMaxRealisticOvrForAgeAndPotential,
  getDynamicPotentialProfile,
} from './economyAndEvolution';
import { generateAttributesFromSeed } from '../data/squadBuilder';
import { getDefaultFormationRoleForPosition } from '../data/transferCatalog';

export interface YouthStarProbabilities {
  star1_2_5: number; // % chance of 1–2,5★
  star3_3_5: number; // % chance of 3–3,5★
  star4_4_5: number; // % chance of 4–4,5★
  star5: number;     // % chance of 5★
  // Legacy aliases for backward compatibility
  star1_2?: number;
  star3?: number;
  star4?: number;
}

export interface YouthTierProgressionNote {
  fromTierLabel: string;
  badgeSummary: string;
  detail: string;
}

export interface YouthTierDefinition {
  tier: YouthInvestmentTier;
  label: string;
  shortLabel: string;
  monthlyCost: number;
  annualEstimate: number;
  minRegens: number;
  maxRegens: number;
  minOvr: number;
  maxOvr: number;
  starProbabilities: YouthStarProbabilities;
  progressionNote?: YouthTierProgressionNote;
  description: string;
}

export const YOUTH_TIERS: YouthTierDefinition[] = [
  {
    tier: 'BASICO',
    label: 'Básico (Captação Regional)',
    shortLabel: 'Básico',
    monthlyCost: 80_000,
    annualEstimate: 960_000,
    minRegens: 2,
    maxRegens: 3,
    minOvr: 60,
    maxOvr: 63,
    starProbabilities: {
      star1_2_5: 72,
      star3_3_5: 25.5,
      star4_4_5: 2.4,
      star5: 0.1,
      star1_2: 72,
      star3: 25.5,
      star4: 2.4,
    },
    description:
      'Peneiras locais e escolinhas conveniadas. Foco em formação inicial a baixo custo com 72% de atletas para composição.',
  },
  {
    tier: 'ESTRUTURADO',
    label: 'Estruturado (CT de Formação)',
    shortLabel: 'Estruturado',
    monthlyCost: 250_000,
    annualEstimate: 3_000_000,
    minRegens: 3,
    maxRegens: 4,
    minOvr: 60,
    maxOvr: 65,
    starProbabilities: {
      star1_2_5: 48,
      star3_3_5: 43.5,
      star4_4_5: 8.0,
      star5: 0.5,
      star1_2: 48,
      star3: 43.5,
      star4: 8.0,
    },
    progressionNote: {
      fromTierLabel: 'Básico → Estruturado',
      badgeSummary: '+70% em 3–3,5★ · 3,3x mais 4–4,5★ · 5x mais 5★',
      detail:
        '+70% de chance na faixa 3–3,5★, 3,3x mais chances de 4–4,5★ e 5x mais chances de 5★.',
    },
    description:
      'CT oficial com comissão Sub-17 e Sub-20 dedicada. Grande salto de regularidade na faixa 3–3,5★ (43,5%) e 8% em 4–4,5★.',
  },
  {
    tier: 'AVANCADO',
    label: 'Avançado (Rede Nacional)',
    shortLabel: 'Avançado',
    monthlyCost: 600_000,
    annualEstimate: 7_200_000,
    minRegens: 4,
    maxRegens: 5,
    minOvr: 61,
    maxOvr: 67,
    starProbabilities: {
      star1_2_5: 25,
      star3_3_5: 57.0,
      star4_4_5: 16.8,
      star5: 1.2,
      star1_2: 25,
      star3: 57.0,
      star4: 16.8,
    },
    progressionNote: {
      fromTierLabel: 'Estruturado → Avançado',
      badgeSummary: '+31% em 3–3,5★ · 2,1x mais 4–4,5★ · 2,4x mais 5★',
      detail:
        '+31% na faixa 3–3,5★, 2,1x mais chances de 4–4,5★ e 2,4x mais chances de 5★.',
    },
    description:
      'Rede de olheiros por todo o Brasil e fisiologia de ponta. Mais da metade da safra em 3–3,5★ (57%) e 16,8% de promessas 4–4,5★.',
  },
  {
    tier: 'ELITE',
    label: 'Elite (Padrão Internacional)',
    shortLabel: 'Elite',
    monthlyCost: 1_250_000,
    annualEstimate: 15_000_000,
    minRegens: 4,
    maxRegens: 6,
    minOvr: 62,
    maxOvr: 70,
    starProbabilities: {
      star1_2_5: 12,
      star3_3_5: 56.0,
      star4_4_5: 29.0,
      star5: 3.0,
      star1_2: 12,
      star3: 56.0,
      star4: 29.0,
    },
    progressionNote: {
      fromTierLabel: 'Avançado → Elite',
      badgeSummary:
        'Base sólida 3–3,5★ · +72% em 4–4,5★ (1 em 3) · 2,5x em 5★ (30x do Básico)',
      detail:
        'Mantém a base sólida de 3–3,5★, aumenta em +72% a geração de 4–4,5★ (quase 1 em cada 3 jovens) e multiplica por 2,5x a chance de 5★ (30x maior que no nível Básico).',
    },
    description:
      'Estrutura padrão mundial de captação e formação. Quase 1 em cada 3 jovens é 4–4,5★ (29%) e 30x mais chance de joias 5★ (3,0%) que o Básico.',
  },
];

const POSITIONS_BY_SECTOR: Record<PositionSector, NaturalPosition[]> = {
  GOL: ['GOL'],
  DEF: ['ZAG', 'LD', 'LE'],
  MEI: ['VOL', 'MC', 'MEI'],
  ATA: ['PD', 'PE', 'ATA'],
};

const FIRST_NAMES = [
  'Kauã', 'Luiz', 'Matheus', 'Gabriel', 'Lucas', 'Thiago', 'Bruno', 'Marcos',
  'Vitor', 'Caio', 'Enzo', 'Breno', 'Murilo', 'Yuri', 'Danilo', 'Wesley',
  'Pedrinho', 'Kaio', 'Arthur', 'Bernardo', 'Ryan', 'Guilherme', 'Igor',
  'João Pedro', 'Felipe', 'Gustavo', 'Riquelme', 'Luan', 'Pablo', 'Otávio',
  'Léo', 'Rafael', 'Nathan', 'Hugo', 'Andrey', 'Marlon',
];

const LAST_NAMES = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves',
  'Pereira', 'Lima', 'Gomes', 'Costa', 'Ribeiro', 'Martins', 'Carvalho',
  'Araújo', 'Melo', 'Barbosa', 'Rocha', 'Dias', 'Nascimento', 'Moreira',
  'Cardoso', 'Teixeira', 'Mendes', 'Freitas', 'Vieira', 'Monteiro', 'Ramos',
];

function createSeededRng(seedStr: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0 || 123456789;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/**
 * Rolls potential stars (2★ to 5★) using the realistic probability table of the active tier,
 * blended with actual financial commitment during the season so switching tiers without
 * investing doesn't grant free 5★ players, and caps 5★ gems to keep squads balanced.
 */
function rollRealisticPotentialStars(params: {
  tierConfig: YouthTierDefinition;
  investmentConsistencyRatio: number; // 0..1 based on months/money invested
  alreadyHasFiveStarInBatch: boolean;
  rng: () => number;
}): PotentialStars {
  const { tierConfig, investmentConsistencyRatio, alreadyHasFiveStarInBatch, rng } =
    params;

  const baseProbs = YOUTH_TIERS[0].starProbabilities;
  const targetProbs = tierConfig.starProbabilities;
  const blend = Math.max(0.3, Math.min(1, investmentConsistencyRatio));

  let p5 = baseProbs.star5 + (targetProbs.star5 - baseProbs.star5) * blend;
  let p4 = baseProbs.star4_4_5 + (targetProbs.star4_4_5 - baseProbs.star4_4_5) * blend;
  let p3 = baseProbs.star3_3_5 + (targetProbs.star3_3_5 - baseProbs.star3_3_5) * blend;

  // Prevent multiple 5★ phenomena in the same batch
  if (alreadyHasFiveStarInBatch && p5 > 0) {
    p4 += p5;
    p5 = 0;
  }

  const roll = rng() * 100;
  if (roll < p5) return 5;
  if (roll < p5 + p4) {
    return rng() < 0.4 ? 4.5 : 4;
  }
  if (roll < p5 + p4 + p3) {
    return rng() < 0.45 ? 3.5 : 3;
  }
  const subRoll = rng();
  if (subRoll < 0.45) return 2.5;
  if (subRoll < 0.8) return 2;
  if (subRoll < 0.95) return 1.5;
  return 1;
}

function buildSingleYouthProspect(params: {
  clubId: string;
  clubReputation: number;
  division: 'A' | 'B' | 'LIB';
  seasonYear: number;
  index: number;
  chosenSector: PositionSector;
  age: number;
  minOvr: number;
  maxOvr: number;
  potentialStars: PotentialStars;
  usedNames: Set<string>;
  rng: () => number;
}): { player: Player; reportItem: YouthRegenReportItem } {
  const {
    clubId,
    clubReputation,
    division,
    seasonYear,
    index,
    chosenSector,
    age,
    minOvr,
    maxOvr,
    potentialStars,
    usedNames,
    rng,
  } = params;

  const possiblePos = POSITIONS_BY_SECTOR[chosenSector];
  const position = possiblePos[Math.floor(rng() * possiblePos.length)];

  let name = '';
  for (let attempt = 0; attempt < 12; attempt++) {
    const first = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
    const last = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
    const candidate = `${first} ${last}`;
    if (!usedNames.has(candidate)) {
      name = candidate;
      usedNames.add(candidate);
      break;
    }
  }
  if (!name) {
    name = `${FIRST_NAMES[index % FIRST_NAMES.length]} ${
      LAST_NAMES[(index * 3) % LAST_NAMES.length]
    }`;
  }

  // Youngsters aged 15-18 start with realistic youth OVRs (60 to 70, or up to 72 only for a 5★ 17-18yo gem).
  // They must develop through training and senior matches to reach 78-85+ in the future.
  const ageOffset = (age - 16) * 0.9;
  const starOffset =
    potentialStars === 5
      ? 2.0
      : potentialStars === 4
      ? 0.9
      : potentialStars === 2
      ? -1.0
      : 0;

  const maxInitialYouthOvr = Math.min(
    potentialStars === 5 ? 72 : potentialStars === 4 ? 69 : 66,
    getMaxRealisticOvrForAgeAndPotential(age, potentialStars)
  );

  const rawTargetOvr =
    minOvr + rng() * (maxOvr - minOvr) + ageOffset + starOffset;
  const clampedTargetOvr = Math.max(
    60,
    Math.min(maxInitialYouthOvr, Math.round(rawTargetOvr))
  );

  // Convert 60..72 OVR target into the 1..20 seed scale expected by generateAttributesFromSeed
  const seed1to20 = 10.1 + (clampedTargetOvr - 60) * 0.21;
  const rawAttributes = generateAttributesFromSeed(position, seed1to20, rng);
  const attributes = calibrateAttributesToTargetOvr(
    rawAttributes,
    position,
    clampedTargetOvr,
    maxInitialYouthOvr
  );
  const ovr = calculatePlayerOverall(attributes, position);
  const roleDefaults = getDefaultFormationRoleForPosition(position);

  const playerId = `regen-${clubId}-${seasonYear}-${index + 1}-${Math.round(
    rng() * 8999 + 1000
  )}`;
  const { marketValue, salary } = calculateBalancedValuationAndWage({
    ovr,
    age: Math.max(16, age),
    clubReputation,
    division,
    potentialStars,
  });

  // Base Sub-20 scholarship / initial contract is much more affordable (35% of senior wage)
  const youthSalary = Math.max(
    15_000,
    Math.round((salary * 0.35) / 5_000) * 5_000
  );

  const dynProfile = getDynamicPotentialProfile(potentialStars, rng);

  const regenPlayer: Player = {
    id: playerId,
    number: 40 + index,
    name,
    age,
    nationality: 'Brasil',
    position,
    sector: chosenSector,
    condition: 98,
    morale: 'Muito Alta',
    marketValue,
    salary: youthSalary,
    potentialStars,
    basePotentialOvr: dynProfile.basePotentialOvr,
    dynamicCeilingOvr: dynProfile.dynamicCeilingOvr,
    attributes,
    isStarter: false,
    slotIndex: null,
    assignedRole: roleDefaults.roleId,
    assignedDuty: roleDefaults.duty,
    injured: false,
    seasonStats: {
      matches: 0,
      goals: 0,
      assists: 0,
      yellowCards: 0,
      avgRating: 6.8,
    },
    contractType: 'DEFINITIVO',
    isRegen: true,
    regenBatchYear: seasonYear,
  };

  const statusTag =
    age < 16
      ? 'Sub-17 (Sobe aos 16 anos)'
      : 'Apto a subir ao Profissional (16+)';

  const reportItem: YouthRegenReportItem = {
    id: playerId,
    name,
    age,
    position,
    sector: chosenSector,
    ovr,
    potentialStars,
    basePotentialOvr: dynProfile.basePotentialOvr,
    dynamicCeilingOvr: dynProfile.dynamicCeilingOvr,
    marketValue,
    salary: youthSalary,
    highlightNote: `${potentialStars}★ · OVR ${ovr} · Pot. Base ${dynProfile.basePotentialOvr} (Teto Dinâmico: ${dynProfile.dynamicCeilingOvr}) · ${statusTag}`,
  };

  return { player: regenPlayer, reportItem };
}

export function createInitialYouthAcademy(
  clubId: string = 'flamengo',
  clubReputation: number = 78,
  division: 'A' | 'B' | 'LIB' = 'A',
  seasonYear: number = 2026
): YouthAcademyState {
  const defaultTier: YouthInvestmentTier =
    division === 'B' && clubReputation < 72 ? 'BASICO' : 'ESTRUTURADO';
  const tierConfig =
    YOUTH_TIERS.find((t) => t.tier === defaultTier) || YOUTH_TIERS[1];

  const rng = createSeededRng(`init-youth-${clubId}-${seasonYear}`);
  const sectors: PositionSector[] = ['ATA', 'MEI', 'DEF', 'MEI', 'GOL'];
  // Include 15-year-olds (Sub-17, waiting to turn 16) and 16-18 year-olds (ready for promotion)
  const initialAges = [17, 16, 16, 15, 15];
  const initialStars: PotentialStars[] = [
    clubReputation >= 80 ? 4 : 3.5,
    3.5,
    3,
    clubReputation >= 76 ? 3.5 : 3,
    2.5,
  ];

  const usedNames = new Set<string>();
  const youthRoster: Player[] = [];
  const lastGraduatedRegens: YouthRegenReportItem[] = [];

  for (let i = 0; i < 5; i++) {
    const built = buildSingleYouthProspect({
      clubId,
      clubReputation,
      division,
      seasonYear,
      index: i,
      chosenSector: sectors[i],
      age: initialAges[i],
      minOvr: tierConfig.minOvr,
      maxOvr: tierConfig.maxOvr,
      potentialStars: initialStars[i],
      usedNames,
      rng,
    });
    youthRoster.push(built.player);
    lastGraduatedRegens.push(built.reportItem);
  }

  return {
    investmentTier: defaultTier,
    focusSector: 'EQUILIBRADO',
    monthlyCost: tierConfig.monthlyCost,
    accumulatedSeasonInvestment: tierConfig.monthlyCost,
    monthsInvestedThisSeason: 1,
    lastGraduatedRegens,
    youthRoster,
  };
}

/**
 * Evolves existing U-20 players (+1 year of age and training boost) and generates
 * the new annual intake of youth regens into the Sub-20 roster based on actual investment.
 */
export function generateYouthRegens(params: {
  academy: YouthAcademyState;
  clubId: string;
  clubReputation: number;
  division: 'A' | 'B' | 'LIB';
  seasonYear: number;
  rng?: () => number;
}): {
  newPlayers: Player[];
  reportItems: YouthRegenReportItem[];
  updatedYouthRoster: Player[];
} {
  const {
    academy,
    clubId,
    clubReputation,
    division,
    seasonYear,
    rng = Math.random,
  } = params;

  const tierConfig =
    YOUTH_TIERS.find((t) => t.tier === academy.investmentTier) || YOUTH_TIERS[1];

  // Calculate financial commitment consistency (0..1)
  const expectedAnnualSpend = tierConfig.monthlyCost * 10;
  const spendRatio =
    expectedAnnualSpend > 0
      ? academy.accumulatedSeasonInvestment / expectedAnnualSpend
      : 0.5;
  const monthsRatio = Math.max(1, academy.monthsInvestedThisSeason) / 10;
  const investmentConsistencyRatio = Math.min(
    1,
    Math.max(0.3, spendRatio * 0.65 + monthsRatio * 0.35)
  );

  // 1. Age (+1 year) and train (+1 to +2 OVR max) existing youth roster players who stay in Sub-20 (up to age 19)
  const existingRoster = academy.youthRoster || [];
  const agedYouthRoster: Player[] = [];
  const usedNames = new Set<string>();

  for (const yp of existingRoster) {
    usedNames.add(yp.name);
    const nextAge = yp.age + 1;
    // Players who turn 20+ without being promoted leave the U-20 category
    if (nextAge > 19) continue;

    const stars = yp.potentialStars ?? 3;
    const sub20Ceiling = Math.min(
      stars === 5 ? 73 : stars === 4 ? 70 : 67,
      getMaxRealisticOvrForAgeAndPotential(nextAge, stars)
    );
    const currentOvr = calculatePlayerOverall(yp.attributes, yp.position);
    const annualGain =
      currentOvr >= sub20Ceiling
        ? 0
        : stars >= 4 && rng() < 0.55
        ? 2
        : 1;
    const targetNextOvr = Math.min(sub20Ceiling, currentOvr + annualGain);

    const upgradedAttrs = calibrateAttributesToTargetOvr(
      yp.attributes,
      yp.position,
      targetNextOvr,
      sub20Ceiling
    );

    const newOvr = calculatePlayerOverall(upgradedAttrs, yp.position);
    const { marketValue, salary } = calculateBalancedValuationAndWage({
      ovr: newOvr,
      age: Math.max(16, nextAge),
      clubReputation,
      division,
      potentialStars: stars,
    });

    agedYouthRoster.push({
      ...yp,
      age: nextAge,
      attributes: upgradedAttrs,
      marketValue,
      salary: Math.max(15_000, Math.round((salary * 0.35) / 5_000) * 5_000),
    });
  }

  // 2. Generate new annual intake of youth prospects
  const countSpan = tierConfig.maxRegens - tierConfig.minRegens + 1;
  const count = tierConfig.minRegens + Math.floor(rng() * countSpan);

  const newPlayers: Player[] = [];
  const reportItems: YouthRegenReportItem[] = [];
  let alreadyHasFiveStarInBatch = false;

  for (let i = 0; i < count; i++) {
    let chosenSector: PositionSector = 'MEI';
    if (academy.focusSector !== 'EQUILIBRADO') {
      // 75% chance of matching the prioritized sector, 25% general rotation
      if (rng() < 0.75) {
        chosenSector = academy.focusSector;
      } else {
        const sectors: PositionSector[] = ['GOL', 'DEF', 'MEI', 'ATA'];
        chosenSector = sectors[Math.floor(rng() * sectors.length)];
      }
    } else {
      const sectors: PositionSector[] = ['GOL', 'DEF', 'MEI', 'ATA'];
      chosenSector = sectors[Math.floor(rng() * sectors.length)];
    }

    // Ages 15 to 18 (approx 25% age 15 in Sub-17, 75% ages 16-18 ready to promote)
    const ageRoll = rng();
    const age =
      ageRoll < 0.25 ? 15 : ageRoll < 0.60 ? 16 : ageRoll < 0.85 ? 17 : 18;

    let potentialStars = rollRealisticPotentialStars({
      tierConfig,
      investmentConsistencyRatio,
      alreadyHasFiveStarInBatch,
      rng,
    });

    // Guarantee at least one 3★+ helpful prospect if the club invested consistently in Estruturado+
    if (
      i === count - 1 &&
      tierConfig.tier !== 'BASICO' &&
      investmentConsistencyRatio >= 0.5 &&
      !reportItems.some((r) => r.potentialStars >= 3) &&
      potentialStars < 3
    ) {
      potentialStars = 3;
    }

    if (potentialStars === 5) {
      alreadyHasFiveStarInBatch = true;
    }

    const built = buildSingleYouthProspect({
      clubId,
      clubReputation,
      division,
      seasonYear,
      index: i,
      chosenSector,
      age,
      minOvr: tierConfig.minOvr,
      maxOvr: tierConfig.maxOvr,
      potentialStars,
      usedNames,
      rng,
    });

    newPlayers.push(built.player);
    reportItems.push(built.reportItem);
  }

  // Combine new intake + remaining Sub-20 roster, sorted by potential & OVR (cap at 14 in U-20s)
  const combinedRoster = [...newPlayers, ...agedYouthRoster]
    .sort((a, b) => {
      const starsDiff = (b.potentialStars ?? 3) - (a.potentialStars ?? 3);
      if (starsDiff !== 0) return starsDiff;
      return (
        calculatePlayerOverall(b.attributes, b.position) -
        calculatePlayerOverall(a.attributes, a.position)
      );
    })
    .slice(0, 14);

  return {
    newPlayers,
    reportItems,
    updatedYouthRoster: combinedRoster,
  };
}

function pickAvailableSeniorNumber(squad: Player[], preferred: number): number {
  const used = new Set(squad.map((p) => p.number));
  if (!used.has(preferred) && preferred >= 12 && preferred <= 99) {
    return preferred;
  }
  for (let n = 12; n <= 99; n++) {
    if (!used.has(n)) return n;
  }
  return preferred;
}

/**
 * Promotes a youth prospect aged 16+ from the Base/Sub-20 roster to the main senior squad.
 */
export function promoteYouthPlayerToSeniorSquad(params: {
  academy: YouthAcademyState;
  seniorSquad: Player[];
  playerId: string;
}): {
  success: boolean;
  errorReason?: string;
  promotedPlayer?: Player;
  updatedAcademy: YouthAcademyState;
  updatedSeniorSquad: Player[];
} {
  const { academy, seniorSquad, playerId } = params;
  const roster = academy.youthRoster || [];
  const target = roster.find((p) => p.id === playerId);

  if (!target) {
    return {
      success: false,
      errorReason: 'Atleta não encontrado no elenco Sub-20.',
      updatedAcademy: academy,
      updatedSeniorSquad: seniorSquad,
    };
  }

  if (target.age < 16) {
    return {
      success: false,
      errorReason: `${target.name} tem ${target.age} anos. Pela regra de transição da base, o atleta só pode subir ao elenco profissional a partir dos 16 anos.`,
      updatedAcademy: academy,
      updatedSeniorSquad: seniorSquad,
    };
  }

  const roleDefaults = getDefaultFormationRoleForPosition(target.position);
  const seniorNumber = pickAvailableSeniorNumber(seniorSquad, target.number);

  const promotedPlayer: Player = {
    ...target,
    number: seniorNumber,
    isStarter: false,
    slotIndex: null,
    assignedRole: target.assignedRole || roleDefaults.roleId,
    assignedDuty: target.assignedDuty || roleDefaults.duty,
    morale: 'Exuberante',
    condition: Math.max(92, target.condition),
    contractType: 'DEFINITIVO',
  };

  const nextYouthRoster = roster.filter((p) => p.id !== playerId);
  const updatedAcademy: YouthAcademyState = {
    ...academy,
    youthRoster: nextYouthRoster,
  };

  return {
    success: true,
    promotedPlayer,
    updatedAcademy,
    updatedSeniorSquad: [...seniorSquad, promotedPlayer],
  };
}

/**
 * Releases a youth prospect from the Sub-20 academy roster without cost.
 */
export function releaseYouthPlayerFromAcademy(params: {
  academy: YouthAcademyState;
  playerId: string;
}): YouthAcademyState {
  const { academy, playerId } = params;
  const roster = academy.youthRoster || [];
  return {
    ...academy,
    youthRoster: roster.filter((p) => p.id !== playerId),
  };
}
