import {
  Club,
  InboxMessage,
  Player,
  RoundFixture,
  StandingsRow,
} from '../types/football';
import { ALL_REAL_CLUBS, SERIE_A_CLUBS, SERIE_B_CLUBS } from './realClubs';
import {
  CONMEBOL_FOREIGN_CLUBS,
  LIBERTADORES_BR_CLUB_IDS,
} from './libertadoresClubs';
import { REAL_SQUADS_SERIE_A } from './realSquadsA';
import { REAL_SQUADS_SERIE_B } from './realSquadsB';
import { REAL_SQUADS_LIBERTADORES } from './realSquadsLibertadores';
import { buildPlayersFromSeeds, RealPlayerSeed } from './squadBuilder';

export {
  SERIE_A_CLUBS,
  SERIE_B_CLUBS,
  CONMEBOL_FOREIGN_CLUBS,
  LIBERTADORES_BR_CLUB_IDS,
};

export const USER_CLUB_ID = 'flamengo';

export const INITIAL_CLUBS: Club[] = ALL_REAL_CLUBS;
export const ALL_WORLD_CLUBS: Club[] = [
  ...ALL_REAL_CLUBS,
  ...CONMEBOL_FOREIGN_CLUBS,
];

export const REAL_SQUAD_SEEDS: Record<string, RealPlayerSeed[]> = {
  ...REAL_SQUADS_SERIE_A,
  ...REAL_SQUADS_SERIE_B,
  ...REAL_SQUADS_LIBERTADORES,
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

// Classificação inicial — Abertura da Temporada 2026 (0 jogos disputados) — Série A (20 clubes reais de 2026)
export const INITIAL_STANDINGS_A: StandingsRow[] = SERIE_A_CLUBS.map((club) => ({
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

// Classificação inicial — Abertura da Temporada 2026 (0 jogos disputados) — Série B (20 clubes reais de 2026)
export const INITIAL_STANDINGS_B: StandingsRow[] = SERIE_B_CLUBS.map((club) => ({
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

export const INITIAL_STANDINGS: StandingsRow[] = INITIAL_STANDINGS_A;

export function getInitialStandingsForDivision(
  division: 'A' | 'B'
): StandingsRow[] {
  const source = division === 'B' ? INITIAL_STANDINGS_B : INITIAL_STANDINGS_A;
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

// Generate deterministic schedule for rounds 1 to 19 within the club's division
export function generateLeagueSchedule(
  userClubId: string = USER_CLUB_ID,
  division?: 'A' | 'B'
): RoundFixture[] {
  const userClub = INITIAL_CLUBS.find((c) => c.id === userClubId);
  const resolvedDivision: 'A' | 'B' =
    division ?? (userClub?.division === 'B' ? 'B' : 'A');
  const divisionClubs =
    resolvedDivision === 'B' ? SERIE_B_CLUBS : SERIE_A_CLUBS;

  const clubIds = divisionClubs.map((c) => c.id);
  const fixtures: RoundFixture[] = [];

  const n = clubIds.length;
  const fixed = clubIds[0];
  const rotating = clubIds.slice(1);

  for (let round = 1; round <= 19; round++) {
    if (resolvedDivision === 'A' && round === 1) {
      OFFICIAL_SERIE_A_ROUND_1_PAIRS.forEach(([homeClubId, awayClubId], idx) => {
        const isUserMatch =
          homeClubId === userClubId || awayClubId === userClubId;
        fixtures.push({
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

      fixtures.push({
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

  return fixtures;
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
