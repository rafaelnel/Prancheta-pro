import {
  Club,
  InboxMessage,
  PlayableDivision,
  Player,
  RoundFixture,
  StandingsRow,
} from '../types/football';
import { ALL_REAL_CLUBS, SERIE_A_CLUBS, SERIE_B_CLUBS } from './realClubs';
import {
  CONMEBOL_FOREIGN_CLUBS,
  LIBERTADORES_BR_CLUB_IDS,
} from './libertadoresClubs';
import {
  UCL_CLUBS,
  GLOBAL_WORLD_CLUBS,
  UCL_CLUB_IDS,
  GLOBAL_WORLD_CLUB_IDS,
} from './championsClubs';
import {
  PREMIER_LEAGUE_EXTRA_CLUBS,
  PREMIER_LEAGUE_EXTRA_CLUB_IDS,
} from './premierLeagueClubs';
import {
  LALIGA_EXTRA_CLUBS,
  LALIGA_EXTRA_CLUB_IDS,
} from './laLigaClubs';
import { REAL_SQUADS_SERIE_A } from './realSquadsA';
import { REAL_SQUADS_SERIE_B } from './realSquadsB';
import { REAL_SQUADS_LIBERTADORES } from './realSquadsLibertadores';
import { REAL_SQUADS_CHAMPIONS } from './realSquadsChampions';
import { REAL_SQUADS_PREMIER_LEAGUE } from './realSquadsPremierLeague';
import { REAL_SQUADS_LALIGA } from './realSquadsLaLiga';
import { buildPlayersFromSeeds, RealPlayerSeed } from './squadBuilder';

export const PREMIER_LEAGUE_CLUBS: Club[] = [
  ...UCL_CLUBS.filter((c) => c.countryCode === 'ING'),
  ...PREMIER_LEAGUE_EXTRA_CLUBS,
];

export const LALIGA_CLUBS: Club[] = [
  ...UCL_CLUBS.filter((c) => c.countryCode === 'ESP'),
  ...LALIGA_EXTRA_CLUBS,
];

export const PREMIER_LEAGUE_CLUB_IDS: string[] = PREMIER_LEAGUE_CLUBS.map(
  (c) => c.id
);

export const LALIGA_CLUB_IDS: string[] = LALIGA_CLUBS.map((c) => c.id);

export const ALL_PLAYABLE_CLUBS: Club[] = [
  ...SERIE_A_CLUBS,
  ...SERIE_B_CLUBS,
  ...PREMIER_LEAGUE_CLUBS,
  ...LALIGA_CLUBS,
];

export function getPlayableDivisionForClub(
  club: Pick<Club, 'id' | 'division' | 'countryCode'> | null | undefined
): PlayableDivision {
  if (!club) return 'A';
  if (club.division === 'B') return 'B';
  if (club.division === 'PL' || (club.division === 'UCL' && club.countryCode === 'ING')) {
    return 'PL';
  }
  if (club.division === 'LALIGA' || (club.division === 'UCL' && club.countryCode === 'ESP')) {
    return 'LALIGA';
  }
  return 'A';
}

export function isEuropeanPlayableDivision(
  division: PlayableDivision
): boolean {
  return division === 'PL' || division === 'LALIGA';
}

export function getSecondaryPlayableDivision(
  division: PlayableDivision
): PlayableDivision {
  if (division === 'A') return 'B';
  if (division === 'B') return 'A';
  if (division === 'PL') return 'LALIGA';
  return 'PL';
}

export function getPlayableLeagueLabel(division: PlayableDivision): string {
  switch (division) {
    case 'A':
      return 'Brasileirão Série A';
    case 'B':
      return 'Brasileirão Série B';
    case 'PL':
      return 'Premier League';
    case 'LALIGA':
      return 'La Liga';
  }
}

export function getPlayableLeagueShortLabel(division: PlayableDivision): string {
  switch (division) {
    case 'A':
      return 'Série A';
    case 'B':
      return 'Série B';
    case 'PL':
      return 'Premier League';
    case 'LALIGA':
      return 'La Liga';
  }
}

export function getClubsForPlayableDivision(
  division: PlayableDivision,
  clubsPool?: Club[]
): Club[] {
  const source = clubsPool && clubsPool.length > 0 ? clubsPool : ALL_WORLD_CLUBS;
  if (division === 'A') {
    const found = source.filter((c) => c.division === 'A');
    return found.length >= 20 ? found : SERIE_A_CLUBS;
  }
  if (division === 'B') {
    const found = source.filter((c) => c.division === 'B');
    return found.length >= 20 ? found : SERIE_B_CLUBS;
  }
  if (division === 'PL') {
    const found = source.filter(
      (c) => c.division === 'PL' || (c.division === 'UCL' && c.countryCode === 'ING')
    );
    return found.length >= 20 ? found : PREMIER_LEAGUE_CLUBS;
  }
  const found = source.filter(
    (c) => c.division === 'LALIGA' || (c.division === 'UCL' && c.countryCode === 'ESP')
  );
  return found.length >= 20 ? found : LALIGA_CLUBS;
}

export {
  SERIE_A_CLUBS,
  SERIE_B_CLUBS,
  CONMEBOL_FOREIGN_CLUBS,
  LIBERTADORES_BR_CLUB_IDS,
  UCL_CLUBS,
  GLOBAL_WORLD_CLUBS,
  UCL_CLUB_IDS,
  GLOBAL_WORLD_CLUB_IDS,
  PREMIER_LEAGUE_EXTRA_CLUBS,
  PREMIER_LEAGUE_EXTRA_CLUB_IDS,
  LALIGA_EXTRA_CLUBS,
  LALIGA_EXTRA_CLUB_IDS,
};

export const USER_CLUB_ID = 'flamengo';

export const INITIAL_CLUBS: Club[] = ALL_REAL_CLUBS;
export const ALL_WORLD_CLUBS: Club[] = [
  ...ALL_REAL_CLUBS,
  ...CONMEBOL_FOREIGN_CLUBS,
  ...UCL_CLUBS,
  ...PREMIER_LEAGUE_EXTRA_CLUBS,
  ...LALIGA_EXTRA_CLUBS,
  ...GLOBAL_WORLD_CLUBS,
];

export const REAL_SQUAD_SEEDS: Record<string, RealPlayerSeed[]> = {
  ...REAL_SQUADS_SERIE_A,
  ...REAL_SQUADS_SERIE_B,
  ...REAL_SQUADS_LIBERTADORES,
  ...REAL_SQUADS_CHAMPIONS,
  ...REAL_SQUADS_PREMIER_LEAGUE,
  ...REAL_SQUADS_LALIGA,
};

export function getRealSquadForClub(club: Club): Player[] {
  const seeds = REAL_SQUAD_SEEDS[club.id];
  if (seeds && seeds.length > 0) {
    return buildPlayersFromSeeds(club, seeds);
  }
  const fallbackClub = SERIE_A_CLUBS[0];
  return buildPlayersFromSeeds(club, REAL_SQUADS_SERIE_A[fallbackClub.id]);
}

const DEFAULT_CLUB =
  SERIE_A_CLUBS.find((c) => c.id === USER_CLUB_ID) || SERIE_A_CLUBS[0];

export const INITIAL_USER_SQUAD: Player[] = getRealSquadForClub(DEFAULT_CLUB);

const buildEmptyStandings = (clubs: Club[]): StandingsRow[] =>
  clubs.map((club) => ({
    clubId: club.id,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
    form: [],
  }));

// Classificação inicial — Abertura da Temporada 2026 (0 jogos disputados) — Série A (20 clubes reais de 2026)
export const INITIAL_STANDINGS_A: StandingsRow[] =
  buildEmptyStandings(SERIE_A_CLUBS);

// Classificação inicial — Abertura da Temporada 2026 (0 jogos disputados) — Série B (20 clubes reais de 2026)
export const INITIAL_STANDINGS_B: StandingsRow[] =
  buildEmptyStandings(SERIE_B_CLUBS);

// Classificação inicial — Premier League 2025/26 (20 clubes reais)
export const INITIAL_STANDINGS_PL: StandingsRow[] =
  buildEmptyStandings(PREMIER_LEAGUE_CLUBS);

// Classificação inicial — La Liga 2025/26 (20 clubes reais)
export const INITIAL_STANDINGS_LALIGA: StandingsRow[] =
  buildEmptyStandings(LALIGA_CLUBS);

export const INITIAL_STANDINGS: StandingsRow[] = INITIAL_STANDINGS_A;

export function getInitialStandingsForDivision(
  division: PlayableDivision,
  clubsPool?: Club[]
): StandingsRow[] {
  if (clubsPool && clubsPool.length > 0) {
    const filtered = getClubsForPlayableDivision(division, clubsPool);
    if (filtered.length > 0) {
      return buildEmptyStandings(filtered);
    }
  }
  const source =
    division === 'B'
      ? INITIAL_STANDINGS_B
      : division === 'PL'
      ? INITIAL_STANDINGS_PL
      : division === 'LALIGA'
      ? INITIAL_STANDINGS_LALIGA
      : INITIAL_STANDINGS_A;
  return source.map((row) => ({ ...row, form: [...row.form] }));
}

// Confrontos reais da 1ª Rodada da Série A 2026 (CBF — 28 e 29 de janeiro de 2026)
const OFFICIAL_SERIE_A_ROUND_1_PAIRS: Array<[string, string]> = [
  ['sao-paulo', 'flamengo'],
  ['atletico-mg', 'palmeiras'],
  ['corinthians', 'bahia'],
  ['botafogo', 'cruzeiro'],
  ['fluminense', 'gremio'],
  ['internacional', 'athletico-pr'],
  ['coritiba', 'bragantino'],
  ['vitoria', 'remo'],
  ['mirassol', 'vasco'],
  ['chapecoense', 'santos'],
];

// Generate deterministic 38-round schedule (19 home/away 1º turno + 19 reversed 2º turno)
export function generateLeagueSchedule(
  userClubId: string = USER_CLUB_ID,
  division?: PlayableDivision,
  clubsPool?: Club[]
): RoundFixture[] {
  const sourcePool =
    clubsPool && clubsPool.length > 0 ? clubsPool : ALL_WORLD_CLUBS;
  const userClub = sourcePool.find((c) => c.id === userClubId);
  const resolvedDivision: PlayableDivision =
    division ?? getPlayableDivisionForClub(userClub);
  const divisionClubs = getClubsForPlayableDivision(resolvedDivision, sourcePool);

  const clubIds = divisionClubs.slice(0, 20).map((c) => c.id);

  const clubIdSet = new Set(clubIds);
  const canUseOfficialRound1 =
    resolvedDivision === 'A' &&
    OFFICIAL_SERIE_A_ROUND_1_PAIRS.every(
      ([h, a]) => clubIdSet.has(h) && clubIdSet.has(a)
    );

  const firstHalfFixtures: RoundFixture[] = [];

  const n = clubIds.length;
  const fixed = clubIds[0];
  const rotating = clubIds.slice(1);

  for (let round = 1; round <= 19; round++) {
    if (canUseOfficialRound1 && round === 1) {
      OFFICIAL_SERIE_A_ROUND_1_PAIRS.forEach(([homeClubId, awayClubId], idx) => {
        const isUserMatch =
          homeClubId === userClubId || awayClubId === userClubId;
        firstHalfFixtures.push({
          id: `a-r1-m${idx + 1}`,
          division: 'A',
          roundNumber: 1,
          homeClubId,
          awayClubId,
          homeGoals: null,
          awayGoals: null,
          played: false,
          isUserMatch,
        });
      });
      continue;
    }

    const shift = (round - 1) % (n - 1);
    const rotated = [
      ...rotating.slice(shift),
      ...rotating.slice(0, shift),
    ];
    const roundTeams = [fixed, ...rotated];

    for (let i = 0; i < n / 2; i++) {
      const t1 = roundTeams[i];
      const t2 = roundTeams[n - 1 - i];
      const isEvenRound = round % 2 === 0;
      const homeClubId = isEvenRound ? t1 : t2;
      const awayClubId = isEvenRound ? t2 : t1;
      const isUserMatch =
        homeClubId === userClubId || awayClubId === userClubId;

      firstHalfFixtures.push({
        id: `${resolvedDivision.toLowerCase()}-r${round}-m${i + 1}`,
        division: resolvedDivision,
        roundNumber: round,
        homeClubId,
        awayClubId,
        homeGoals: null,
        awayGoals: null,
        played: false,
        isUserMatch,
      });
    }
  }

  // 2º Turno (Rodadas 20..38): espelha 1..19 com mando de campo invertido
  const secondHalfFixtures: RoundFixture[] = firstHalfFixtures.map((fix, idx) => {
    const returnRound = fix.roundNumber + 19;
    const matchSlot = (idx % (n / 2)) + 1;
    const homeClubId = fix.awayClubId;
    const awayClubId = fix.homeClubId;
    return {
      id: `${resolvedDivision.toLowerCase()}-r${returnRound}-m${matchSlot}`,
      division: resolvedDivision,
      roundNumber: returnRound,
      homeClubId,
      awayClubId,
      homeGoals: null,
      awayGoals: null,
      played: false,
      isUserMatch: homeClubId === userClubId || awayClubId === userClubId,
    };
  });

  return [...firstHalfFixtures, ...secondHalfFixtures];
}

export const INITIAL_INBOX_MESSAGES: InboxMessage[] = [
  {
    id: 'msg-1',
    date: '28 Jan 2026 · 09:15',
    sender: 'Comissão Técnica',
    senderRole: 'Auxiliar Técnico',
    subject: 'Estreia no Brasileirão 2026 (1ª Rodada): São Paulo vs Flamengo',
    category: 'Tática',
    priority: 'positive',
    read: false,
    body: [
      'Chegou a abertura oficial do Brasileirão 2026! Nossa estreia na 1ª Rodada será fora de casa contra o São Paulo, no MorumBIS.',
      'Com Lucas Paquetá, Jorginho, Arrascaeta e Pedro no elenco, revise a prancheta tática antes do apito inicial.',
    ],
    bulletPoints: [
      'Confronto de estreia: São Paulo vs Flamengo (MorumBIS).',
      'Pedro (ATA), Arrascaeta (MEI) e Lucas Paquetá (MC) lideram o setor ofensivo.',
    ],
    actionLabel: 'Revisar Prancheta Tática',
    actionTargetTab: 'tactics',
  },
  {
    id: 'msg-2',
    date: '28 Jan 2026 · 08:40',
    sender: 'Departamento Médico',
    senderRole: 'Fisiologia',
    subject: 'Boletim de Pré-Temporada: Jorginho (76%)',
    category: 'Departamento Médico',
    priority: 'warning',
    read: false,
    relatedPlayerId: 'flamengo-p6',
    body: [
      'A avaliação de pré-temporada indica carga física elevada em Jorginho (76%).',
      'Erick Pulgar e Nicolás De La Cruz estão com condição plena no banco caso opte por rodar o meio-campo.',
    ],
    bulletPoints: [
      'Jorginho (VOL): 76% de condição física.',
      'Erick Pulgar / De La Cruz: prontos para iniciar.',
    ],
    actionLabel: 'Gerenciar Elenco',
    actionTargetTab: 'squad',
  },
  {
    id: 'msg-3',
    date: '27 Jan 2026 · 18:10',
    sender: 'Diretoria',
    senderRole: 'Presidência',
    subject: 'Planejamento 2026 e Orçamento da Temporada',
    category: 'Diretoria',
    priority: 'normal',
    read: false,
    body: [
      'Iniciamos a temporada 2026 com elenco reforçado e orçamento robusto para buscar o título nacional desde a 1ª rodada.',
    ],
    bulletPoints: [
      'Meta 2026: Título da Série A e vaga direta no G-4.',
      'Estádio: Maracanã.',
    ],
    actionLabel: 'Ver Finanças',
    actionTargetTab: 'finances',
  },
];
