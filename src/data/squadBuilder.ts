import { FORMATIONS, getRolesForSector, getRoleById } from './tacticsData';
import { calculatePlayerOverall } from '../engine/playerOverall';
import {
  assignDefaultContractTerms,
  assignPotentialStars,
  calculateBalancedValuationAndWage,
  calibrateAttributesToTargetOvr,
  getDynamicPotentialProfile,
  getMaxRealisticOvrForAgeAndPotential,
} from '../engine/economyAndEvolution';
import {
  Club,
  NaturalPosition,
  Player,
  PlayerAttributes,
  PositionSector,
} from '../types/football';

export type RealPlayerSeed = [
  number, // shirt number
  string, // player name
  number, // age
  string, // nationality
  NaturalPosition, // position
  number, // target overall (1..20)
  Partial<PlayerAttributes>?, // signature attribute overrides
];

const SECTOR_BY_POSITION: Record<NaturalPosition, PositionSector> = {
  GOL: 'GOL',
  ZAG: 'DEF',
  LD: 'DEF',
  LE: 'DEF',
  VOL: 'MEI',
  MC: 'MEI',
  MEI: 'MEI',
  PD: 'ATA',
  PE: 'ATA',
  ATA: 'ATA',
};

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRng(seedStr: string): () => number {
  let state = hashSeed(seedStr) || 987654321;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function clampAttr(value: number): number {
  return Math.max(4, Math.min(20, Math.round(value)));
}

export function generateAttributesFromSeed(
  position: NaturalPosition,
  targetOverall: number,
  rng: () => number,
  overrides?: Partial<PlayerAttributes>
): PlayerAttributes {
  const base = Math.max(9.5, Math.min(20.0, targetOverall));
  const jitter = () => (rng() - 0.5) * 2.2;

  const isGK = position === 'GOL';
  const isCB = position === 'ZAG';
  const isFB = position === 'LD' || position === 'LE';
  const isDM = position === 'VOL';
  const isCM = position === 'MC';
  const isAM = position === 'MEI';
  const isWing = position === 'PD' || position === 'PE';
  const isST = position === 'ATA';

  const generated: PlayerAttributes = {
    passe: clampAttr(base + (isCM || isAM || isDM ? 1.8 : isGK ? -2.5 : 0) + jitter()),
    finalizacao: clampAttr(base + (isST ? 2.3 : isWing || isAM ? 0.9 : isGK ? -9 : -4) + jitter()),
    drible: clampAttr(base + (isWing || isAM ? 2.0 : isST || isCM ? 0.9 : isGK ? -8 : -2) + jitter()),
    desarme: clampAttr(base + (isCB || isDM ? 2.2 : isFB || isCM ? 1.3 : isGK ? -6 : -4.5) + jitter()),
    primeiroToque: clampAttr(base + (isAM || isCM || isWing || isST ? 1.8 : isGK ? -2 : -0.4) + jitter()),
    cruzamento: clampAttr(base + (isFB || isWing ? 2.2 : isGK ? -8 : -2.5) + jitter()),

    decisoes: clampAttr(base + (isGK || isCB || isDM || isCM ? 1.5 : 0.3) + jitter()),
    visaoDeJogo: clampAttr(base + (isAM || isCM ? 2.1 : isGK ? -2 : -0.8) + jitter()),
    compostura: clampAttr(base + (isGK || isST || isCB || isCM ? 1.4 : 0.3) + jitter()),
    semBola: clampAttr(base + (isST || isWing || isAM ? 2.0 : isCM ? 1.2 : isGK ? -8 : -2.2) + jitter()),
    posicionamento: clampAttr(base + (isGK || isCB || isDM ? 2.2 : isFB ? 1.0 : -3.2) + jitter()),
    indiceDeTrabalho: clampAttr(base + (isDM || isCM || isFB ? 1.8 : 0.4) + jitter()),

    velocidade: clampAttr(base + (isWing || isFB ? 2.1 : isST ? 1.0 : isGK ? -3 : -0.7) + jitter()),
    aceleracao: clampAttr(base + (isWing || isFB ? 2.1 : isST ? 1.0 : isGK ? -3 : -0.7) + jitter()),
    resistencia: clampAttr(base + (isCM || isDM || isFB ? 1.7 : 0.4) + jitter()),
    forca: clampAttr(base + (isCB || isST || isGK ? 1.7 : isWing ? -2.2 : 0) + jitter()),
    impulsao: clampAttr(base + (isGK || isCB || isST ? 1.9 : isWing ? -2.2 : -0.4) + jitter()),
    agilidade: clampAttr(base + (isGK || isWing || isAM ? 2.0 : isCB ? -1.4 : 0.5) + jitter()),
  };

  if (overrides) {
    for (const [k, v] of Object.entries(overrides)) {
      if (typeof v === 'number') {
        generated[k as keyof PlayerAttributes] = clampAttr(v);
      }
    }
  }

  return generated;
}

export function buildPlayersFromSeeds(
  club: Club,
  seeds: RealPlayerSeed[]
): Player[] {
  const rng = createRng(`real-squad-${club.id}`);
  const formationSlots = FORMATIONS[club.formation] || FORMATIONS['4-2-3-1'];

  return seeds.map((seed, idx) => {
    const [number, name, age, nationality, position, overall, overrides] = seed;
    const isStarter = idx < 11;
    const slotDef = isStarter ? formationSlots[idx] : null;
    const sector = slotDef ? slotDef.sector : SECTOR_BY_POSITION[position];
    const defaultRole = slotDef
      ? getRoleById(slotDef.defaultRole)
      : getRolesForSector(sector)[0] || getRoleById('meia-area-a-area');

    const isFatiguedStarter = idx === 5;
    const isTransitionReserve = idx === 21;

    let attributes = generateAttributesFromSeed(position, overall, rng, overrides);
    let ovr6099 = calculatePlayerOverall(attributes, position);
    const playerId = `${club.id}-p${idx + 1}`;
    const potentialStars = assignPotentialStars(
      ovr6099,
      age,
      club.reputation,
      playerId
    );
    const maxAllowedForAge = getMaxRealisticOvrForAgeAndPotential(
      age,
      potentialStars
    );
    if (age <= 22 && ovr6099 > maxAllowedForAge) {
      attributes = calibrateAttributesToTargetOvr(
        attributes,
        position,
        maxAllowedForAge,
        maxAllowedForAge
      );
      ovr6099 = calculatePlayerOverall(attributes, position);
    }
    const { marketValue, salary } = calculateBalancedValuationAndWage({
      ovr: ovr6099,
      age,
      clubReputation: club.reputation,
      division: club.division,
      potentialStars,
      position,
    });

    const condition = isFatiguedStarter
      ? 76
      : isTransitionReserve
      ? 72
      : isStarter
      ? 89 + Math.floor(rng() * 9)
      : 94 + Math.floor(rng() * 5);

    const initialOvrDelta =
      age <= 20 && potentialStars >= 4
        ? 2
        : age <= 22
        ? 1
        : age >= 34
        ? -2
        : age >= 32
        ? -1
        : 0;

    const dynProfile = getDynamicPotentialProfile(
      potentialStars,
      rng,
      ovr6099,
      age
    );

    const basePlayer: Player = {
      id: playerId,
      number,
      name,
      age,
      nationality,
      position,
      sector,
      condition,
      morale:
        overall >= 16
          ? 'Exuberante'
          : isStarter
          ? rng() > 0.45
            ? 'Muito Alta'
            : 'Bom'
          : isTransitionReserve
          ? 'Regular'
          : 'Bom',
      marketValue,
      salary,
      potentialStars,
      basePotentialOvr: dynProfile.basePotentialOvr,
      dynamicCeilingOvr: dynProfile.dynamicCeilingOvr,
      attributes,
      isStarter,
      slotIndex: isStarter ? idx : null,
      assignedRole: defaultRole.id,
      assignedDuty: slotDef ? slotDef.defaultDuty : defaultRole.allowedDuties[0] || 'Apoiar',
      injured: isTransitionReserve,
      injuryNote: isTransitionReserve ? 'Transição física (desgaste leve)' : undefined,
      recentOvrDelta: initialOvrDelta,
      seasonStats: {
        matches: 0,
        goals: 0,
        assists: 0,
        yellowCards: 0,
        avgRating: Number(
          (6.80 + Math.max(0, overall - 13) * 0.14 + rng() * 0.15).toFixed(2)
        ),
      },
    };
    const contractTerms = assignDefaultContractTerms(basePlayer, 2026);
    return {
      ...basePlayer,
      ...contractTerms,
    };
  });
}
