import { FORMATIONS, getRolesForSector, getRoleById } from './tacticsData';
import { generateAttributesFromSeed, RealPlayerSeed } from './squadBuilder';
import { calculatePlayerOverall } from '../engine/playerOverall';
import {
  assignPotentialStars,
  calculateBalancedValuationAndWage,
  calibrateAttributesToTargetOvr,
  getMaxRealisticOvrForAgeAndPotential,
} from '../engine/economyAndEvolution';
import {
  MarketClubProfile,
  MarketPlayerListing,
  NaturalPosition,
  Player,
  PositionSector,
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
    id: 'intl-real-madrid',
    name: 'Real Madrid CF',
    shortName: 'Real Madrid',
    abbr: 'RMA',
    country: 'Espanha',
    leagueName: 'La Liga',
    scope: 'INTERNACIONAL',
    primaryColor: '#f8fafc',
    reputation: 96,
    avgStrength: 90,
  },
  {
    id: 'intl-man-city',
    name: 'Manchester City FC',
    shortName: 'Man. City',
    abbr: 'MCI',
    country: 'Inglaterra',
    leagueName: 'Premier League',
    scope: 'INTERNACIONAL',
    primaryColor: '#38bdf8',
    reputation: 95,
    avgStrength: 89,
  },
  {
    id: 'intl-arsenal',
    name: 'Arsenal FC',
    shortName: 'Arsenal',
    abbr: 'ARS',
    country: 'Inglaterra',
    leagueName: 'Premier League',
    scope: 'INTERNACIONAL',
    primaryColor: '#ef4444',
    reputation: 91,
    avgStrength: 86,
  },
  {
    id: 'intl-psg',
    name: 'Paris Saint-Germain',
    shortName: 'PSG',
    abbr: 'PSG',
    country: 'França',
    leagueName: 'Ligue 1',
    scope: 'INTERNACIONAL',
    primaryColor: '#1d4ed8',
    reputation: 92,
    avgStrength: 87,
  },
  {
    id: 'intl-bayern',
    name: 'FC Bayern München',
    shortName: 'Bayern',
    abbr: 'BAY',
    country: 'Alemanha',
    leagueName: 'Bundesliga',
    scope: 'INTERNACIONAL',
    primaryColor: '#dc2626',
    reputation: 94,
    avgStrength: 88,
  },
  {
    id: 'intl-inter-milan',
    name: 'FC Internazionale Milano',
    shortName: 'Inter de Milão',
    abbr: 'INT',
    country: 'Itália',
    leagueName: 'Serie A Itália',
    scope: 'INTERNACIONAL',
    primaryColor: '#2563eb',
    reputation: 90,
    avgStrength: 86,
  },
  {
    id: 'intl-benfica',
    name: 'SL Benfica',
    shortName: 'Benfica',
    abbr: 'SLB',
    country: 'Portugal',
    leagueName: 'Liga Portugal',
    scope: 'INTERNACIONAL',
    primaryColor: '#e11d48',
    reputation: 86,
    avgStrength: 82,
  },
  {
    id: 'intl-porto',
    name: 'FC Porto',
    shortName: 'Porto',
    abbr: 'FCP',
    country: 'Portugal',
    leagueName: 'Liga Portugal',
    scope: 'INTERNACIONAL',
    primaryColor: '#0284c7',
    reputation: 85,
    avgStrength: 81,
  },
  {
    id: 'intl-sporting',
    name: 'Sporting CP',
    shortName: 'Sporting',
    abbr: 'SCP',
    country: 'Portugal',
    leagueName: 'Liga Portugal',
    scope: 'INTERNACIONAL',
    primaryColor: '#16a34a',
    reputation: 85,
    avgStrength: 82,
  },
  {
    id: 'intl-brighton',
    name: 'Brighton & Hove Albion',
    shortName: 'Brighton',
    abbr: 'BHA',
    country: 'Inglaterra',
    leagueName: 'Premier League',
    scope: 'INTERNACIONAL',
    primaryColor: '#0ea5e9',
    reputation: 81,
    avgStrength: 79,
  },
  {
    id: 'intl-girona',
    name: 'Girona FC',
    shortName: 'Girona',
    abbr: 'GIR',
    country: 'Espanha',
    leagueName: 'La Liga',
    scope: 'INTERNACIONAL',
    primaryColor: '#f43f5e',
    reputation: 79,
    avgStrength: 77,
  },
  {
    id: 'intl-inter-miami',
    name: 'Inter Miami CF',
    shortName: 'Inter Miami',
    abbr: 'MIA',
    country: 'EUA',
    leagueName: 'MLS',
    scope: 'INTERNACIONAL',
    primaryColor: '#f472b6',
    reputation: 79,
    avgStrength: 77,
  },
  {
    id: 'intl-al-hilal',
    name: 'Al-Hilal SFC',
    shortName: 'Al-Hilal',
    abbr: 'HIL',
    country: 'Arábia Saudita',
    leagueName: 'Saudi Pro League',
    scope: 'INTERNACIONAL',
    primaryColor: '#1e40af',
    reputation: 83,
    avgStrength: 82,
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

type IntlSeed = [
  clubId: string,
  shirt: number,
  name: string,
  age: number,
  nationality: string,
  position: NaturalPosition,
  seedStrength: number,
  isClubStarter: boolean,
  loanAvailable: boolean,
  overrides?: RealPlayerSeed[6]
];

const INTERNATIONAL_PLAYER_SEEDS: IntlSeed[] = [
  // Real Madrid
  ['intl-real-madrid', 16, 'Endrick', 19, 'Brasil', 'ATA', 15.6, false, true, { finalizacao: 16, aceleracao: 17, forca: 15 }],
  ['intl-real-madrid', 15, 'Arda Güler', 21, 'Turquia', 'MEI', 15.8, false, true, { visaoDeJogo: 17, passe: 16, drible: 17 }],
  ['intl-real-madrid', 21, 'Brahim Díaz', 26, 'Marrocos', 'PD', 16.0, false, true, { drible: 17, agilidade: 17 }],
  ['intl-real-madrid', 17, 'Raúl Asencio', 23, 'Espanha', 'ZAG', 15.3, false, true],

  // Man City
  ['intl-man-city', 26, 'Savinho', 21, 'Brasil', 'PD', 15.9, false, true, { drible: 17, velocidade: 17 }],
  ['intl-man-city', 52, 'Oscar Bobb', 22, 'Noruega', 'PE', 15.0, false, true, { drible: 16, agilidade: 16 }],
  ['intl-man-city', 82, 'Rico Lewis', 21, 'Inglaterra', 'LD', 15.2, false, true],
  ['intl-man-city', 22, 'Vitor Reis', 20, 'Brasil', 'ZAG', 14.8, false, true, { desarme: 15, posicionamento: 15 }],

  // Arsenal
  ['intl-arsenal', 9, 'Gabriel Jesus', 28, 'Brasil', 'ATA', 16.1, false, true, { semBola: 16, drible: 16 }],
  ['intl-arsenal', 11, 'Gabriel Martinelli', 24, 'Brasil', 'PE', 16.5, true, false, { velocidade: 17, aceleracao: 17 }],
  ['intl-arsenal', 23, 'Mikel Merino', 29, 'Espanha', 'MC', 16.0, false, true],
  ['intl-arsenal', 17, 'Oleksandr Zinchenko', 29, 'Ucrânia', 'LE', 15.3, false, true],

  // PSG
  ['intl-psg', 35, 'Lucas Beraldo', 22, 'Brasil', 'ZAG', 15.4, false, true, { passe: 16, posicionamento: 15 }],
  ['intl-psg', 19, 'Lee Kang-in', 25, 'Coreia do Sul', 'MEI', 15.8, false, true, { visaoDeJogo: 16, passe: 16 }],
  ['intl-psg', 9, 'Gonçalo Ramos', 24, 'Portugal', 'ATA', 16.1, false, true, { finalizacao: 16 }],
  ['intl-psg', 20, 'Gabriel Moscardo', 20, 'Brasil', 'VOL', 14.6, false, true, { desarme: 15, resistencia: 15 }],

  // Bayern
  ['intl-bayern', 16, 'João Palhinha', 30, 'Portugal', 'VOL', 16.3, false, true, { desarme: 17, forca: 16 }],
  ['intl-bayern', 18, 'Daniel Peretz', 25, 'Israel', 'GOL', 14.7, false, true],
  ['intl-bayern', 20, 'Tom Bischof', 20, 'Alemanha', 'MC', 14.8, false, true],

  // Inter Milan
  ['intl-inter-milan', 30, 'Carlos Augusto', 27, 'Brasil', 'LE', 15.7, false, true, { cruzamento: 16, velocidade: 16 }],
  ['intl-inter-milan', 21, 'Kristjan Asllani', 24, 'Albânia', 'VOL', 15.1, false, true],
  ['intl-inter-milan', 99, 'Mehdi Taremi', 33, 'Irã', 'ATA', 15.4, false, true],

  // Benfica
  ['intl-benfica', 30, 'Nicolás Otamendi', 38, 'Argentina', 'ZAG', 15.6, true, false, { desarme: 16, posicionamento: 16 }],
  ['intl-benfica', 7, 'Zeki Amdouni', 25, 'Suíça', 'ATA', 15.1, false, true],
  ['intl-benfica', 17, 'Kerem Aktürkoğlu', 27, 'Turquia', 'PE', 15.9, true, false],
  ['intl-benfica', 1, 'Anatoliy Trubin', 24, 'Ucrânia', 'GOL', 16.0, true, false],

  // Porto
  ['intl-porto', 11, 'Pepê', 29, 'Brasil', 'PD', 15.9, true, false, { drible: 16, velocidade: 16 }],
  ['intl-porto', 22, 'Alan Varela', 24, 'Argentina', 'VOL', 15.8, true, false, { desarme: 16, passe: 16 }],
  ['intl-porto', 4, 'Otávio Ataíde', 23, 'Brasil', 'ZAG', 14.9, false, true],
  ['intl-porto', 19, 'Danny Namaso', 25, 'Inglaterra', 'ATA', 14.7, false, true],

  // Sporting
  ['intl-sporting', 42, 'Morten Hjulmand', 26, 'Dinamarca', 'VOL', 16.1, true, false],
  ['intl-sporting', 17, 'Francisco Trincão', 26, 'Portugal', 'PD', 16.0, true, false],
  ['intl-sporting', 11, 'Nuno Santos', 31, 'Portugal', 'LE', 15.1, false, true],

  // Brighton
  ['intl-brighton', 30, 'Pervis Estupiñán', 28, 'Equador', 'LE', 15.6, true, false],
  ['intl-brighton', 20, 'Julio Enciso', 22, 'Paraguai', 'MEI', 15.2, false, true, { drible: 16, finalizacao: 15 }],
  ['intl-brighton', 2, 'Igor Julio', 28, 'Brasil', 'ZAG', 14.9, false, true],

  // Girona
  ['intl-girona', 10, 'Yáser Asprilla', 22, 'Colômbia', 'MEI', 15.0, false, true, { drible: 16 }],
  ['intl-girona', 18, 'Oriol Romeu', 34, 'Espanha', 'VOL', 14.8, false, true],
  ['intl-girona', 9, 'Abel Ruiz', 26, 'Espanha', 'ATA', 15.0, false, true],

  // Inter Miami
  ['intl-inter-miami', 9, 'Luis Suárez', 39, 'Uruguai', 'ATA', 15.7, true, false, { finalizacao: 17, compostura: 17 }],
  ['intl-inter-miami', 5, 'Sergio Busquets', 37, 'Espanha', 'VOL', 15.6, true, false, { passe: 17, visaoDeJogo: 17 }],
  ['intl-inter-miami', 21, 'Tadeo Allende', 27, 'Argentina', 'PD', 14.5, false, true],

  // Al-Hilal
  ['intl-al-hilal', 11, 'Marcos Leonardo', 22, 'Brasil', 'ATA', 15.8, false, true, { finalizacao: 16, semBola: 16 }],
  ['intl-al-hilal', 77, 'Malcom', 29, 'Brasil', 'PD', 16.2, true, false, { drible: 16, velocidade: 16 }],
  ['intl-al-hilal', 8, 'Rúben Neves', 29, 'Portugal', 'VOL', 16.4, true, false, { passe: 17, visaoDeJogo: 16 }],
  ['intl-al-hilal', 6, 'Renan Lodi', 27, 'Brasil', 'LE', 15.2, false, true],

  // Shakhtar
  ['intl-shaktar', 7, 'Eguinaldo', 21, 'Brasil', 'ATA', 14.6, false, true, { velocidade: 16 }],
  ['intl-shaktar', 11, 'Kevin', 23, 'Brasil', 'PE', 15.2, true, true, { drible: 16, aceleracao: 16 }],
  ['intl-shaktar', 22, 'Mykola Matviyenko', 29, 'Ucrânia', 'ZAG', 15.2, true, false],
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
  const potentialStars = assignPotentialStars(ovr, age, clubRep, id);
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
  });

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
      loanAvailable,
      overrides,
    ] = seed;
    const club = clubMap.get(clubId)!;
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
      overrides
    );
    const ovr = calculatePlayerOverall(player.attributes, player.position);
    const buyFee = Math.round((player.marketValue * 1.15) / 250000) * 250000;
    const loanFee =
      !loanAvailable
        ? Math.round((buyFee * 0.24) / 100000) * 100000
        : age <= 22 && !isClubStarter
        ? Math.round((buyFee * 0.08) / 100000) * 100000
        : Math.round((buyFee * 0.14) / 100000) * 100000;

    return {
      player,
      ovr,
      originClub: club,
      scope: 'INTERNACIONAL' as const,
      isClubStarter,
      buyFee,
      loanFee: Math.max(250000, loanFee),
      loanAvailable,
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

const FREE_AGENT_SEEDS_2026: FreeAgentSeed[] = [
  [1, 'Marcelo Grohe', 39, 'Brasil', 'GOL', 15.4, { posicionamento: 17, compostura: 16 }],
  [12, 'Diego Alves', 36, 'Brasil', 'GOL', 14.3],
  [24, 'Matheus Cavichioli', 39, 'Brasil', 'GOL', 13.5],
  [4, 'Rodrigo Caio', 32, 'Brasil', 'ZAG', 14.6, { posicionamento: 16, passe: 15 }],
  [3, 'Samir Caetano', 31, 'Brasil', 'ZAG', 15.1, { forca: 16, desarme: 15 }],
  [15, 'David Luiz', 38, 'Brasil', 'ZAG', 14.9, { passe: 16, compostura: 16 }],
  [2, 'Mariano Ferreira', 39, 'Brasil', 'LD', 14.2, { cruzamento: 15 }],
  [22, 'Rafinha', 40, 'Brasil', 'LD', 14.5, { decisoes: 16, passe: 16 }],
  [6, 'Dalbert Henrique', 32, 'Brasil', 'LE', 14.1],
  [16, 'Dodô Pires', 34, 'Brasil', 'LE', 14.4],
  [5, 'Fernandinho', 40, 'Brasil', 'VOL', 15.5, { decisoes: 18, passe: 17 }],
  [8, 'Walace Souza', 30, 'Brasil', 'VOL', 15.6, { desarme: 16, forca: 16 }],
  [14, 'Edenílson', 36, 'Brasil', 'MC', 14.8],
  [18, 'Giuliano Victor', 35, 'Brasil', 'MEI', 15.0, { visaoDeJogo: 16, passe: 16 }],
  [10, 'Óscar Romero', 33, 'Paraguai', 'MEI', 15.4, { passe: 17, visaoDeJogo: 16 }],
  [20, 'Jaminton Campaz', 25, 'Colômbia', 'MEI', 15.2, { drible: 16 }],
  [7, 'Marinho', 35, 'Brasil', 'PD', 14.6, { velocidade: 15, finalizacao: 15 }],
  [11, 'Keno', 36, 'Brasil', 'PE', 14.9, { drible: 16 }],
  [9, 'Diego Costa', 37, 'Espanha', 'ATA', 15.3, { forca: 17, finalizacao: 16 }],
  [19, 'Leandro Damião', 36, 'Brasil', 'ATA', 14.5, { impulsao: 16, finalizacao: 15 }],
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
      overrides
    );
    return {
      ...player,
      salary: Math.max(70000, Math.round((player.salary * 0.78) / 5000) * 5000),
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
