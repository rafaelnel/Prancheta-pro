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

export function getYouthInitialOvrRange(stars: PotentialStars): {
  minOvr: number;
  maxOvr: number;
} {
  if (stars >= 5) {
    return { minOvr: 75, maxOvr: 85 };
  }
  if (stars >= 4.5) {
    return { minOvr: 74, maxOvr: 80 };
  }
  if (stars >= 3) {
    return { minOvr: 70, maxOvr: 75 };
  }
  return { minOvr: 60, maxOvr: 70 };
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
    maxOvr: 75,
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
      'Peneiras locais e escolinhas conveniadas. Foco em formação inicial a baixo custo (1–2,5★: 60–70 OVR · 3–4★: 70–75 OVR).',
  },
  {
    tier: 'ESTRUTURADO',
    label: 'Estruturado (CT de Formação)',
    shortLabel: 'Estruturado',
    monthlyCost: 250_000,
    annualEstimate: 3_000_000,
    minRegens: 3,
    maxRegens: 4,
    minOvr: 62,
    maxOvr: 80,
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
      badgeSummary: '+70% em 3–3,5★ (70–75 OVR) · 3,3x mais 4–4,5★ (até 80 OVR)',
      detail:
        '+70% de chance na faixa 3–3,5★ (70–75 OVR), 3,3x mais chances de 4–4,5★ (até 80 OVR) e 5x mais chances de 5★ (75–85 OVR).',
    },
    description:
      'CT oficial com comissão Sub-17 e Sub-20 dedicada. Grande salto de regularidade na faixa 3–4★ (70–75 OVR) e 8% em 4–4,5★ (até 80 OVR).',
  },
  {
    tier: 'AVANCADO',
    label: 'Avançado (Rede Nacional)',
    shortLabel: 'Avançado',
    monthlyCost: 600_000,
    annualEstimate: 7_200_000,
    minRegens: 4,
    maxRegens: 5,
    minOvr: 65,
    maxOvr: 82,
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
      badgeSummary: '+31% em 3–3,5★ (70–75 OVR) · 2,1x mais 4–4,5★ · 2,4x mais 5★',
      detail:
        '+31% na faixa 3–3,5★, 2,1x mais chances de 4–4,5★ (até 80 OVR) e 2,4x mais chances de 5★ (75–85 OVR).',
    },
    description:
      'Rede de olheiros por todo o Brasil e fisiologia de ponta. Mais da metade da safra em 3–4★ (70–75 OVR) e 16,8% de promessas 4–4,5★ (até 80 OVR).',
  },
  {
    tier: 'ELITE',
    label: 'Elite (Padrão Internacional)',
    shortLabel: 'Elite',
    monthlyCost: 1_250_000,
    annualEstimate: 15_000_000,
    minRegens: 4,
    maxRegens: 6,
    minOvr: 68,
    maxOvr: 85,
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
        'Base sólida 3–4★ (70–75 OVR) · +72% em 4–4,5★ (até 80 OVR) · Joias 5★ (75–85 OVR)',
      detail:
        'Mantém a base sólida de 3–3,5★ (70–75 OVR), aumenta em +72% a geração de 4–4,5★ (até 80 OVR) e multiplica por 2,5x a chance de fenômenos 5★ (75 a 85 OVR já na base).',
    },
    description:
      'Estrutura padrão mundial de captação e formação. Quase 1 em cada 3 jovens é 4–4,5★ (até 80 OVR) e 30x mais chance de joias 5★ (75 a 85 OVR).',
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

  // OVR inicial na base é determinado pela faixa de potencial em estrelas:
  // - 1 a 2,5★: 60 a 70 OVR
  // - 3 a 4★: 70 a 75 OVR
  // - 4,5★: 74 a 80 OVR (até 80)
  // - 5★: 75 a 85 OVR
  const starOvrBounds = getYouthInitialOvrRange(potentialStars);
  let subMin = starOvrBounds.minOvr;
  let subMax = starOvrBounds.maxOvr;

  if (potentialStars < 3) {
    if (potentialStars <= 1.5) {
      subMin = 60;
      subMax = 65;
    } else if (potentialStars === 2) {
      subMin = 62;
      subMax = 68;
    } else {
      subMin = 64;
      subMax = 70;
    }
  } else if (potentialStars >= 3 && potentialStars <= 4) {
    if (potentialStars === 3) {
      subMin = 70;
      subMax = 73;
    } else if (potentialStars === 3.5) {
      subMin = 71;
      subMax = 74;
    } else {
      subMin = 72;
      subMax = 75;
    }
  }

  const ageBonus = Math.max(0, (age - 15) * 0.45);
  const rawTargetOvr =
    subMin + rng() * Math.max(1, subMax - subMin) + ageBonus * 0.35;
  const clampedTargetOvr = Math.max(
    starOvrBounds.minOvr,
    Math.min(starOvrBounds.maxOvr, Math.round(rawTargetOvr))
  );

  // Convert 60..85 OVR target into the 1..20 seed scale expected by generateAttributesFromSeed
  const seed1to20 = 10.1 + (clampedTargetOvr - 60) * 0.22;
  const rawAttributes = generateAttributesFromSeed(position, seed1to20, rng);
  let attributes = calibrateAttributesToTargetOvr(
    rawAttributes,
    position,
    clampedTargetOvr,
    starOvrBounds.maxOvr
  );
  let ovr = calculatePlayerOverall(attributes, position);
  if (ovr < starOvrBounds.minOvr || ovr > starOvrBounds.maxOvr) {
    const correctedTarget = Math.max(
      starOvrBounds.minOvr,
      Math.min(starOvrBounds.maxOvr, ovr)
    );
    attributes = calibrateAttributesToTargetOvr(
      attributes,
      position,
      correctedTarget,
      starOvrBounds.maxOvr
    );
    ovr = calculatePlayerOverall(attributes, position);
  }
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
    position,
  });

  // Base Sub-20 scholarship / initial contract is much more affordable (35% of senior wage)
  const youthSalary = Math.max(
    15_000,
    Math.round((salary * 0.35) / 5_000) * 5_000
  );

  const dynProfile = getDynamicPotentialProfile(potentialStars, rng);
  const basePotentialOvr = Math.min(
    94,
    Math.max(ovr + 2, dynProfile.basePotentialOvr)
  );
  const dynamicCeilingOvr = Math.min(
    96,
    Math.max(basePotentialOvr + 2, dynProfile.dynamicCeilingOvr)
  );

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
    basePotentialOvr,
    dynamicCeilingOvr,
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
    basePotentialOvr,
    dynamicCeilingOvr,
    marketValue,
    salary: youthSalary,
    highlightNote: `${potentialStars}★ · OVR ${ovr} · Pot. Base ${basePotentialOvr} (Teto Dinâmico: ${dynamicCeilingOvr}) · ${statusTag}`,
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

const SECTOR_PRIORITY_ATTRS: Record<
  PositionSector,
  Array<keyof PlayerAttributes>
> = {
  GOL: [
    'posicionamento',
    'compostura',
    'agilidade',
    'decisoes',
    'impulsao',
    'passe',
  ],
  DEF: [
    'desarme',
    'posicionamento',
    'forca',
    'impulsao',
    'velocidade',
    'passe',
    'decisoes',
  ],
  MEI: [
    'passe',
    'visaoDeJogo',
    'primeiroToque',
    'decisoes',
    'drible',
    'resistencia',
    'semBola',
  ],
  ATA: [
    'finalizacao',
    'drible',
    'velocidade',
    'aceleracao',
    'semBola',
    'primeiroToque',
    'compostura',
  ],
};

function rollYouthAcademyOvrGain(params: {
  stars: PotentialStars;
  headroom: number;
  phase: 'MID_SEASON' | 'SEASON_END';
  rng: () => number;
}): number {
  const { stars, headroom, phase, rng } = params;
  if (headroom <= 0) return 0;

  const r = rng();

  if (phase === 'MID_SEASON') {
    // Stochastic mid-season growth weighted by star potential (0 to +2 OVR)
    let gain = 0;
    if (stars >= 5) {
      gain = r < 0.15 ? 0 : r < 0.62 ? 1 : 2;
    } else if (stars >= 4.5) {
      gain = r < 0.22 ? 0 : r < 0.72 ? 1 : 2;
    } else if (stars >= 4) {
      gain = r < 0.30 ? 0 : r < 0.80 ? 1 : 2;
    } else if (stars >= 3) {
      gain = r < 0.44 ? 0 : r < 0.90 ? 1 : 2;
    } else if (stars >= 2) {
      gain = r < 0.62 ? 0 : 1;
    } else {
      gain = r < 0.78 ? 0 : 1;
    }
    return Math.min(headroom, gain);
  }

  // SEASON_END annual stochastic evolution weighted by star potential (0 to +3 OVR)
  let gain = 0;
  if (stars >= 5) {
    gain = r < 0.08 ? 0 : r < 0.34 ? 1 : r < 0.74 ? 2 : 3;
  } else if (stars >= 4.5) {
    gain = r < 0.12 ? 0 : r < 0.42 ? 1 : r < 0.80 ? 2 : 3;
  } else if (stars >= 4) {
    gain = r < 0.16 ? 0 : r < 0.54 ? 1 : r < 0.88 ? 2 : 3;
  } else if (stars >= 3) {
    gain = r < 0.24 ? 0 : r < 0.72 ? 1 : 2;
  } else if (stars >= 2) {
    gain = r < 0.42 ? 0 : r < 0.88 ? 1 : 2;
  } else {
    gain = r < 0.60 ? 0 : 1;
  }

  return Math.min(headroom, gain);
}

/**
 * Evolves all youth prospects currently in the Base / Sub-20 roster randomly based on their potential.
 * - Players continue evolving while in the academy up until completing age 20 (age <= 20).
 * - On SEASON_END, each prospect ages +1 year; players turning 21 (> 20) graduate out of Sub-20.
 * - On MID_SEASON, age stays the same and eligible prospects (<= 20) undergo random training evolution.
 */
export function evolveYouthAcademyRoster(params: {
  academy: YouthAcademyState;
  clubReputation: number;
  division: 'A' | 'B' | 'LIB';
  phase: 'MID_SEASON' | 'SEASON_END';
  rng?: () => number;
}): {
  updatedAcademy: YouthAcademyState;
  updatedYouthRoster: Player[];
  evolvedCount: number;
  graduatedOutNames: string[];
} {
  const {
    academy,
    clubReputation,
    division,
    phase,
    rng = Math.random,
  } = params;

  const existingRoster = academy.youthRoster || [];
  const nextRoster: Player[] = [];
  const graduatedOutNames: string[] = [];
  let evolvedCount = 0;

  for (const yp of existingRoster) {
    const nextAge = phase === 'SEASON_END' ? yp.age + 1 : yp.age;
    // Youth prospects stay and evolve in the academy until completing age 20 (leave only after 20)
    if (nextAge > 20) {
      graduatedOutNames.push(yp.name);
      continue;
    }

    const stars = yp.potentialStars ?? 3;
    const currentOvr = calculatePlayerOverall(yp.attributes, yp.position);
    const starBounds = getYouthInitialOvrRange(stars);
    const dynProfile = getDynamicPotentialProfile(stars, rng, currentOvr, nextAge);
    const playerBaseCeiling = Math.max(
      yp.basePotentialOvr ?? dynProfile.basePotentialOvr,
      starBounds.maxOvr
    );
    const agePotentialLimit = getMaxRealisticOvrForAgeAndPotential(
      nextAge,
      stars,
      yp
    );
    const academyCeiling = Math.min(
      88,
      Math.max(
        currentOvr,
        Math.min(
          playerBaseCeiling,
          Math.max(starBounds.maxOvr, agePotentialLimit)
        )
      )
    );
    const headroom = Math.max(0, academyCeiling - currentOvr);

    const ovrGain = rollYouthAcademyOvrGain({
      stars,
      headroom,
      phase,
      rng,
    });

    let evolvedAttrs: PlayerAttributes = { ...yp.attributes };
    if (ovrGain > 0) {
      // Nudge random sector-relevant attributes first for organic, individualized growth
      const priorityKeys = SECTOR_PRIORITY_ATTRS[yp.sector] || SECTOR_PRIORITY_ATTRS.MEI;
      const bumps = ovrGain + 1 + Math.floor(rng() * 2);
      for (let b = 0; b < bumps; b++) {
        const key = priorityKeys[Math.floor(rng() * priorityKeys.length)];
        evolvedAttrs[key] = Math.min(19, evolvedAttrs[key] + 1);
      }

      const targetNextOvr = Math.min(academyCeiling, currentOvr + ovrGain);
      evolvedAttrs = calibrateAttributesToTargetOvr(
        evolvedAttrs,
        yp.position,
        targetNextOvr,
        academyCeiling
      );
    }

    const newOvr = calculatePlayerOverall(evolvedAttrs, yp.position);
    const actualDelta = newOvr - currentOvr;
    if (actualDelta > 0) {
      evolvedCount += 1;
    }

    const { marketValue, salary } = calculateBalancedValuationAndWage({
      ovr: newOvr,
      age: Math.max(16, nextAge),
      clubReputation,
      division,
      potentialStars: stars,
      position: yp.position,
    });

    nextRoster.push({
      ...yp,
      age: nextAge,
      attributes: evolvedAttrs,
      marketValue,
      salary: Math.max(15_000, Math.round((salary * 0.35) / 5_000) * 5_000),
      recentOvrDelta:
        phase === 'MID_SEASON'
          ? (yp.recentOvrDelta ?? 0) + actualDelta
          : actualDelta,
    });
  }

  return {
    updatedAcademy: {
      ...academy,
      youthRoster: nextRoster,
    },
    updatedYouthRoster: nextRoster,
    evolvedCount,
    graduatedOutNames,
  };
}

/**
 * Evolves existing youth players (+1 year of age and stochastic potential-based evolution up to age 20)
 * and generates the new annual intake of youth regens into the Sub-20 roster based on actual investment.
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

  // 1. Age (+1 year) and randomly evolve existing youth roster players based on potential (up to age 20)
  const existingRoster = academy.youthRoster || [];
  const usedNames = new Set<string>(existingRoster.map((yp) => yp.name));
  const evolvedExisting = evolveYouthAcademyRoster({
    academy,
    clubReputation,
    division,
    phase: 'SEASON_END',
    rng,
  });
  const agedYouthRoster = evolvedExisting.updatedYouthRoster;

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
