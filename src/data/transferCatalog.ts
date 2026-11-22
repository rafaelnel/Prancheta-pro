import { FORMATIONS, getRolesForSector, getRoleById } from './tacticsData';
import { generateAttributesFromSeed, RealPlayerSeed } from './squadBuilder';
import { calculatePlayerOverall } from '../engine/playerOverall';
import {
  assignPotentialStars,
  calculateBalancedValuationAndWage,
  calibrateAttributesToTargetOvr,
  getDynamicPotentialProfile,
  getMaxRealisticOvrForAgeAndPotential,
} from '../engine/economyAndEvolution';
import {
  MarketClubProfile,
  MarketPlayerListing,
  NaturalPosition,
  Player,
  PositionSector,
  PotentialStars,
} from '../types/football';

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
  let state = hashSeed(seedStr) || 123456789;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export const INTERNATIONAL_MARKET_CLUBS: MarketClubProfile[] = [
  {
    id: 'intl-porto',
    name: 'FC Porto',
    shortName: 'Porto',
    abbr: 'FCP',
    country: 'Portugal',
    leagueName: 'Liga Portugal',
    scope: 'INTERNACIONAL',
    primaryColor: '#0284c7',
    reputation: 84,
    avgStrength: 80,
  },
  {
    id: 'intl-shaktar',
    name: 'Shakhtar Donetsk',
    shortName: 'Shakhtar',
    abbr: 'SHK',
    country: 'Ucrânia',
    leagueName: 'Liga Leste Europeu',
    scope: 'INTERNACIONAL',
    primaryColor: '#f97316',
    reputation: 77,
    avgStrength: 76,
  },
];

type IntlListingMode = 'NONE' | 'LOAN' | 'TRANSFER' | 'BOTH';

type IntlSeed = [
  clubId: string,
  shirt: number,
  name: string,
  age: number,
  nationality: string,
  position: NaturalPosition,
  seedStrength: number,
  isClubStarter: boolean,
  listingMode: IntlListingMode,
  potentialStars?: PotentialStars,
  overrides?: RealPlayerSeed[6]
];

/**
 * Catálogo Internacional complementar (clubes fora da Champions, Premier League, La Liga e Mundial):
 * - Os 16 clubes da Champions League, todos os 20 da Premier League, todos os 20 de La Liga
 *   e os 4 clubes do Mundial já estão integrados com elencos completos de 18 atletas em ALL_WORLD_CLUBS (sem duplicidade).
 */
const INTERNATIONAL_PLAYER_SEEDS: IntlSeed[] = [
  // Porto
  ['intl-porto', 11, 'Pepê', 29, 'Brasil', 'PD', 16.2, true, 'NONE', 4.0, { drible: 17, velocidade: 17 }],
  ['intl-porto', 22, 'Alan Varela', 24, 'Argentina', 'VOL', 16.1, true, 'NONE', 4.0, { desarme: 17, passe: 16 }],
  ['intl-porto', 4, 'Otávio Ataíde', 23, 'Brasil', 'ZAG', 15.3, false, 'LOAN', 3.5],
  ['intl-porto', 19, 'Danny Namaso', 25, 'Inglaterra', 'ATA', 15.1, false, 'TRANSFER', 3.5],

  // Shakhtar
  ['intl-shaktar', 7, 'Eguinaldo', 21, 'Brasil', 'ATA', 14.9, false, 'LOAN', 3.5, { velocidade: 17 }],
  ['intl-shaktar', 11, 'Kevin', 23, 'Brasil', 'PE', 15.4, true, 'NONE', 4.0, { drible: 17, aceleracao: 17 }],
  ['intl-shaktar', 22, 'Mykola Matviyenko', 29, 'Ucrânia', 'ZAG', 15.5, true, 'NONE', 3.5],
];

function buildCatalogPlayer(
  id: string,
  shirtNumber: number,
  name: string,
  age: number,
  nationality: string,
  position: NaturalPosition,
  seedStrength: number,
  repFactor: number,
  isIntl: boolean,
  explicitStars?: PotentialStars,
  overrides?: RealPlayerSeed[6]
): Player {
  const rng = createRng(`market-${id}`);
  const sector = SECTOR_BY_POSITION[position];
  const defaultRole =
    getRolesForSector(sector)[0] || getRoleById('meia-area-a-area');

  let attributes = generateAttributesFromSeed(
    position,
    seedStrength,
    rng,
    overrides
  );

  let ovr = calculatePlayerOverall(attributes, position);
  const clubRep = isIntl ? Math.round(80 * repFactor) : 74;
  const potentialStars =
    explicitStars ?? assignPotentialStars(ovr, age, clubRep, id, name);
  const maxAllowedForAge = getMaxRealisticOvrForAgeAndPotential(
    age,
    potentialStars
  );
  if (age <= 22 && ovr > maxAllowedForAge) {
    attributes = calibrateAttributesToTargetOvr(
      attributes,
      position,
      maxAllowedForAge,
      maxAllowedForAge
    );
    ovr = calculatePlayerOverall(attributes, position);
  }
  const { marketValue, salary } = calculateBalancedValuationAndWage({
    ovr,
    age,
    clubReputation: clubRep,
    division: 'A',
    potentialStars,
    position,
  });
  const dynProfile = getDynamicPotentialProfile(
    potentialStars,
    rng,
    ovr,
    age
  );

  return {
    id,
    number: shirtNumber,
    name,
    age,
    nationality,
    position,
    sector,
    condition: 94 + Math.floor(rng() * 5),
    morale: 'Bom',
    marketValue,
    salary,
    potentialStars,
    basePotentialOvr: dynProfile.basePotentialOvr,
    dynamicCeilingOvr: dynProfile.dynamicCeilingOvr,
    attributes,
    isStarter: false,
    slotIndex: null,
    assignedRole: defaultRole.id,
    assignedDuty: defaultRole.allowedDuties[0] || 'Apoiar',
    injured: false,
    seasonStats: {
      matches: 0,
      goals: 0,
      assists: 0,
      yellowCards: 0,
      avgRating: Number((6.95 + Math.max(0, seedStrength - 14) * 0.14).toFixed(2)),
    },
    contractType: 'DEFINITIVO',
  };
}

let cachedIntlListings: MarketPlayerListing[] | null = null;

export function getInternationalMarketListings(): MarketPlayerListing[] {
  if (cachedIntlListings) return cachedIntlListings;

  const clubMap = new Map(INTERNATIONAL_MARKET_CLUBS.map((c) => [c.id, c]));

  cachedIntlListings = INTERNATIONAL_PLAYER_SEEDS.map((seed, idx) => {
    const [
      clubId,
      shirt,
      name,
      age,
      nationality,
      position,
      seedStrength,
      isClubStarter,
      listingMode,
      explicitStars,
      overrides,
    ] = seed;
    const club = clubMap.get(clubId)!;
    const isTransferListed =
      listingMode === 'TRANSFER' || listingMode === 'BOTH';
    const isLoanListed = listingMode === 'LOAN' || listingMode === 'BOTH';
    const loanAvailable = isLoanListed;
    const listingReason =
      isTransferListed && isLoanListed
        ? 'Disponível p/ Empréstimo ou Compra (Rotação de elenco)'
        : isTransferListed
        ? age >= 28
          ? 'Listado p/ Compra (Alívio de folha salarial)'
          : 'Listado p/ Compra (Busca mais minutos)'
        : isLoanListed
        ? age <= 23
          ? 'Listado p/ Empréstimo (Jovem p/ ganhar rodagem)'
          : 'Listado p/ Empréstimo (Rotação de elenco)'
        : undefined;

    const player = buildCatalogPlayer(
      `${clubId}-m${idx + 1}`,
      shirt,
      name,
      age,
      nationality,
      position,
      seedStrength,
      club.reputation / 84,
      true,
      explicitStars,
      overrides
    );
    player.isTransferListed = isTransferListed;
    player.isLoanListed = isLoanListed;
    player.marketListingReason = listingReason;

    const ovr = calculatePlayerOverall(player.attributes, player.position);
    const buyMultiplier = isTransferListed
      ? 0.88
      : isClubStarter
      ? 1.14
      : 0.98;
    const buyStep =
      player.marketValue < 2_000_000
        ? 25_000
        : player.marketValue < 8_000_000
        ? 50_000
        : player.marketValue < 30_000_000
        ? 100_000
        : 250_000;
    const buyFee = Math.min(
      Math.floor((player.marketValue * 1.18) / buyStep) * buyStep,
      Math.max(
        Math.ceil((player.marketValue * 0.85) / buyStep) * buyStep,
        Math.round((player.marketValue * buyMultiplier) / buyStep) * buyStep
      )
    );
    const loanRatio = !loanAvailable
      ? 0.18
      : isLoanListed && age <= 22
      ? 0.075
      : isLoanListed
      ? 0.10
      : 0.14;
    const loanStep =
      player.marketValue * loanRatio < 1_000_000
        ? 10_000
        : player.marketValue * loanRatio < 5_000_000
        ? 25_000
        : 50_000;
    const loanFee = Math.min(
      Math.floor((player.marketValue * 0.20) / loanStep) * loanStep,
      Math.max(
        Math.ceil((player.marketValue * 0.06) / loanStep) * loanStep,
        Math.round((player.marketValue * loanRatio) / loanStep) * loanStep
      )
    );

    return {
      player,
      ovr,
      originClub: club,
      scope: 'INTERNACIONAL' as const,
      isClubStarter,
      buyFee,
      loanFee,
      loanAvailable,
      isTransferListed,
      isLoanListed,
      listingReason,
    };
  });

  return cachedIntlListings;
}

type FreeAgentSeed = [
  shirt: number,
  name: string,
  age: number,
  nationality: string,
  position: NaturalPosition,
  seedStrength: number,
  overrides?: RealPlayerSeed[6]
];

/**
 * Agentes Livres (Sem Clube) realistas para 2026:
 * - Atletas genuinamente livres/disponíveis no mercado sul-americano
 * - OVR calibrado na faixa 68 a 74 (úteis para rotação de Série A ou titulares de Série B sem distorcer o mercado por R$ 0)
 */
const FREE_AGENT_SEEDS_2026: FreeAgentSeed[] = [
  [1, 'Marcelo Grohe', 39, 'Brasil', 'GOL', 14.8, { posicionamento: 16, compostura: 16 }],
  [12, 'Muriel Becker', 39, 'Brasil', 'GOL', 14.2],
  [24, 'Matheus Cavichioli', 39, 'Brasil', 'GOL', 13.8],
  [4, 'Rodrigo Caio', 32, 'Brasil', 'ZAG', 14.5, { posicionamento: 16, passe: 15 }],
  [3, 'Wallace Fortuna', 31, 'Brasil', 'ZAG', 14.4, { forca: 16, desarme: 15 }],
  [15, 'Maicon Roque', 37, 'Brasil', 'ZAG', 14.5, { forca: 16, compostura: 16 }],
  [2, 'Mariano Ferreira', 39, 'Brasil', 'LD', 14.3, { cruzamento: 15 }],
  [22, 'Madson Ferreira', 34, 'Brasil', 'LD', 14.4, { velocidade: 15, impulsao: 15 }],
  [6, 'Jorge Marco', 29, 'Brasil', 'LE', 14.2, { passe: 15 }],
  [16, 'Dodô Pires', 34, 'Brasil', 'LE', 14.3],
  [5, 'Gabriel Girotto', 33, 'Brasil', 'VOL', 14.7, { desarme: 16, indiceDeTrabalho: 16 }],
  [8, 'Josef de Souza', 37, 'Brasil', 'VOL', 14.5, { desarme: 15, forca: 16 }],
  [14, 'Rômulo Caldeira', 35, 'Brasil', 'MC', 14.3],
  [18, 'Giuliano Victor', 35, 'Brasil', 'MEI', 14.8, { visaoDeJogo: 16, passe: 16 }],
  [10, 'Óscar Romero', 33, 'Paraguai', 'MEI', 15.0, { passe: 16, visaoDeJogo: 16 }],
  [20, 'Luan Vieira', 32, 'Brasil', 'MEI', 14.2, { passe: 15 }],
  [7, 'Nikão Maycon', 33, 'Brasil', 'PD', 14.6, { passe: 15, forca: 15 }],
  [11, 'Romarinho Silva', 35, 'Brasil', 'PE', 14.8, { drible: 15, finalizacao: 16 }],
  [9, 'Alan Kardec', 37, 'Brasil', 'ATA', 14.4, { impulsao: 16, finalizacao: 15 }],
  [19, 'Alexandre Pato', 36, 'Brasil', 'ATA', 14.3, { primeiroToque: 16, finalizacao: 15 }],
];

export function createInitialFreeAgents(): Player[] {
  return FREE_AGENT_SEEDS_2026.map((seed, idx) => {
    const [shirt, name, age, nationality, position, seedStrength, overrides] = seed;
    const player = buildCatalogPlayer(
      `free-2026-${idx + 1}`,
      shirt,
      name,
      age,
      nationality,
      position,
      seedStrength,
      0.85,
      false,
      undefined,
      overrides
    );
    return {
      ...player,
      salary: Math.max(35000, Math.round((player.salary * 0.78) / 5000) * 5000),
      condition: 90,
      morale: 'Regular',
      contractType: 'DEFINITIVO',
    };
  });
}

export function getDefaultFormationRoleForPosition(
  position: NaturalPosition
): { roleId: string; duty: Player['assignedDuty'] } {
  const sector = SECTOR_BY_POSITION[position];
  const slotMatch = FORMATIONS['4-2-3-1'].find((s) => s.label === position);
  if (slotMatch) {
    return { roleId: slotMatch.defaultRole, duty: slotMatch.defaultDuty };
  }
  const role = getRolesForSector(sector)[0] || getRoleById('meia-area-a-area');
  return {
    roleId: role.id,
    duty: role.allowedDuties[0] || 'Apoiar',
  };
}
