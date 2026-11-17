import {
  Club,
  InboxMessage,
  Player,
  RoundFixture,
  StandingsRow,
} from '../types/football';
import { ALL_REAL_CLUBS, SERIE_A_CLUBS, SERIE_B_CLUBS } from './realClubs';
import { REAL_SQUADS_SERIE_A } from './realSquadsA';
import { REAL_SQUADS_SERIE_B } from './realSquadsB';
import { buildPlayersFromSeeds, RealPlayerSeed } from './squadBuilder';

export { SERIE_A_CLUBS, SERIE_B_CLUBS };

export const USER_CLUB_ID = 'flamengo';

export const INITIAL_CLUBS: Club[] = ALL_REAL_CLUBS;

export const REAL_SQUAD_SEEDS: Record<string, RealPlayerSeed[]> = {
  ...REAL_SQUADS_SERIE_A,
  ...REAL_SQUADS_SERIE_B,
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

// Classificação inicial após 5 rodadas — Série A (20 clubes reais)
export const INITIAL_STANDINGS_A: StandingsRow[] = [
  { clubId: 'palmeiras', played: 5, won: 4, drawn: 1, lost: 0, goalsFor: 11, goalsAgainst: 3, goalDifference: 8, points: 13, form: ['V', 'V', 'E', 'V', 'V'] },
  { clubId: 'flamengo', played: 5, won: 4, drawn: 0, lost: 1, goalsFor: 12, goalsAgainst: 4, goalDifference: 8, points: 12, form: ['V', 'V', 'D', 'V', 'V'] },
  { clubId: 'botafogo', played: 5, won: 3, drawn: 2, lost: 0, goalsFor: 9, goalsAgainst: 4, goalDifference: 5, points: 11, form: ['V', 'E', 'V', 'E', 'V'] },
  { clubId: 'internacional', played: 5, won: 3, drawn: 1, lost: 1, goalsFor: 8, goalsAgainst: 4, goalDifference: 4, points: 10, form: ['V', 'E', 'V', 'D', 'V'] },
  { clubId: 'atletico-mg', played: 5, won: 3, drawn: 1, lost: 1, goalsFor: 9, goalsAgainst: 6, goalDifference: 3, points: 10, form: ['D', 'V', 'V', 'E', 'V'] },
  { clubId: 'fortaleza', played: 5, won: 3, drawn: 0, lost: 2, goalsFor: 7, goalsAgainst: 5, goalDifference: 2, points: 9, form: ['V', 'D', 'V', 'V', 'D'] },
  { clubId: 'sao-paulo', played: 5, won: 2, drawn: 2, lost: 1, goalsFor: 7, goalsAgainst: 5, goalDifference: 2, points: 8, form: ['E', 'V', 'E', 'D', 'V'] },
  { clubId: 'cruzeiro', played: 5, won: 2, drawn: 2, lost: 1, goalsFor: 6, goalsAgainst: 5, goalDifference: 1, points: 8, form: ['E', 'V', 'D', 'V', 'E'] },
  { clubId: 'bahia', played: 5, won: 2, drawn: 1, lost: 2, goalsFor: 7, goalsAgainst: 6, goalDifference: 1, points: 7, form: ['V', 'D', 'E', 'V', 'D'] },
  { clubId: 'corinthians', played: 5, won: 2, drawn: 1, lost: 2, goalsFor: 7, goalsAgainst: 7, goalDifference: 0, points: 7, form: ['D', 'V', 'E', 'D', 'V'] },
  { clubId: 'santos', played: 5, won: 2, drawn: 1, lost: 2, goalsFor: 6, goalsAgainst: 6, goalDifference: 0, points: 7, form: ['V', 'D', 'D', 'E', 'V'] },
  { clubId: 'fluminense', played: 5, won: 2, drawn: 0, lost: 3, goalsFor: 5, goalsAgainst: 6, goalDifference: -1, points: 6, form: ['D', 'V', 'D', 'V', 'D'] },
  { clubId: 'gremio', played: 5, won: 1, drawn: 3, lost: 1, goalsFor: 5, goalsAgainst: 5, goalDifference: 0, points: 6, form: ['E', 'E', 'V', 'D', 'E'] },
  { clubId: 'vasco', played: 5, won: 1, drawn: 2, lost: 2, goalsFor: 5, goalsAgainst: 7, goalDifference: -2, points: 5, form: ['D', 'E', 'V', 'D', 'E'] },
  { clubId: 'bragantino', played: 5, won: 1, drawn: 2, lost: 2, goalsFor: 4, goalsAgainst: 6, goalDifference: -2, points: 5, form: ['E', 'D', 'D', 'V', 'E'] },
  { clubId: 'sport', played: 5, won: 1, drawn: 1, lost: 3, goalsFor: 4, goalsAgainst: 7, goalDifference: -3, points: 4, form: ['D', 'D', 'V', 'E', 'D'] },
  { clubId: 'vitoria', played: 5, won: 1, drawn: 1, lost: 3, goalsFor: 3, goalsAgainst: 7, goalDifference: -4, points: 4, form: ['E', 'D', 'D', 'D', 'V'] },
  { clubId: 'ceara', played: 5, won: 1, drawn: 1, lost: 3, goalsFor: 3, goalsAgainst: 8, goalDifference: -5, points: 4, form: ['D', 'E', 'D', 'V', 'D'] },
  { clubId: 'mirassol', played: 5, won: 0, drawn: 2, lost: 3, goalsFor: 3, goalsAgainst: 8, goalDifference: -5, points: 2, form: ['D', 'E', 'D', 'E', 'D'] },
  { clubId: 'juventude', played: 5, won: 0, drawn: 2, lost: 3, goalsFor: 2, goalsAgainst: 8, goalDifference: -6, points: 2, form: ['E', 'D', 'D', 'E', 'D'] },
];

// Classificação inicial após 5 rodadas — Série B (20 clubes reais)
export const INITIAL_STANDINGS_B: StandingsRow[] = [
  { clubId: 'athletico-pr', played: 5, won: 4, drawn: 1, lost: 0, goalsFor: 10, goalsAgainst: 3, goalDifference: 7, points: 13, form: ['V', 'V', 'E', 'V', 'V'] },
  { clubId: 'goias', played: 5, won: 3, drawn: 2, lost: 0, goalsFor: 8, goalsAgainst: 3, goalDifference: 5, points: 11, form: ['V', 'E', 'V', 'V', 'E'] },
  { clubId: 'coritiba', played: 5, won: 3, drawn: 1, lost: 1, goalsFor: 8, goalsAgainst: 4, goalDifference: 4, points: 10, form: ['V', 'D', 'V', 'E', 'V'] },
  { clubId: 'novorizontino', played: 5, won: 3, drawn: 1, lost: 1, goalsFor: 7, goalsAgainst: 4, goalDifference: 3, points: 10, form: ['E', 'V', 'V', 'D', 'V'] },
  { clubId: 'america-mg', played: 5, won: 3, drawn: 0, lost: 2, goalsFor: 7, goalsAgainst: 5, goalDifference: 2, points: 9, form: ['V', 'V', 'D', 'V', 'D'] },
  { clubId: 'criciuma', played: 5, won: 2, drawn: 2, lost: 1, goalsFor: 6, goalsAgainst: 4, goalDifference: 2, points: 8, form: ['E', 'V', 'E', 'D', 'V'] },
  { clubId: 'atletico-go', played: 5, won: 2, drawn: 2, lost: 1, goalsFor: 6, goalsAgainst: 5, goalDifference: 1, points: 8, form: ['V', 'E', 'D', 'V', 'E'] },
  { clubId: 'cuiaba', played: 5, won: 2, drawn: 1, lost: 2, goalsFor: 5, goalsAgainst: 5, goalDifference: 0, points: 7, form: ['D', 'V', 'E', 'V', 'D'] },
  { clubId: 'avai', played: 5, won: 2, drawn: 1, lost: 2, goalsFor: 6, goalsAgainst: 6, goalDifference: 0, points: 7, form: ['V', 'D', 'V', 'D', 'E'] },
  { clubId: 'vila-nova', played: 5, won: 2, drawn: 1, lost: 2, goalsFor: 5, goalsAgainst: 6, goalDifference: -1, points: 7, form: ['E', 'V', 'D', 'V', 'D'] },
  { clubId: 'crb', played: 5, won: 2, drawn: 0, lost: 3, goalsFor: 5, goalsAgainst: 6, goalDifference: -1, points: 6, form: ['D', 'V', 'D', 'V', 'D'] },
  { clubId: 'paysandu', played: 5, won: 1, drawn: 3, lost: 1, goalsFor: 5, goalsAgainst: 5, goalDifference: 0, points: 6, form: ['E', 'E', 'V', 'D', 'E'] },
  { clubId: 'operario-pr', played: 5, won: 1, drawn: 2, lost: 2, goalsFor: 4, goalsAgainst: 5, goalDifference: -1, points: 5, form: ['E', 'D', 'V', 'E', 'D'] },
  { clubId: 'remo', played: 5, won: 1, drawn: 2, lost: 2, goalsFor: 4, goalsAgainst: 6, goalDifference: -2, points: 5, form: ['D', 'E', 'V', 'D', 'E'] },
  { clubId: 'chapecoense', played: 5, won: 1, drawn: 2, lost: 2, goalsFor: 3, goalsAgainst: 5, goalDifference: -2, points: 5, form: ['E', 'D', 'E', 'V', 'D'] },
  { clubId: 'amazonas', played: 5, won: 1, drawn: 1, lost: 3, goalsFor: 4, goalsAgainst: 7, goalDifference: -3, points: 4, form: ['D', 'D', 'V', 'E', 'D'] },
  { clubId: 'botafogo-sp', played: 5, won: 1, drawn: 1, lost: 3, goalsFor: 3, goalsAgainst: 7, goalDifference: -4, points: 4, form: ['D', 'E', 'D', 'D', 'V'] },
  { clubId: 'ferroviaria', played: 5, won: 1, drawn: 1, lost: 3, goalsFor: 3, goalsAgainst: 7, goalDifference: -4, points: 4, form: ['E', 'D', 'D', 'V', 'D'] },
  { clubId: 'athletic-mg', played: 5, won: 0, drawn: 2, lost: 3, goalsFor: 2, goalsAgainst: 6, goalDifference: -4, points: 2, form: ['D', 'E', 'D', 'E', 'D'] },
  { clubId: 'volta-redonda', played: 5, won: 0, drawn: 2, lost: 3, goalsFor: 2, goalsAgainst: 7, goalDifference: -5, points: 2, form: ['E', 'D', 'D', 'E', 'D'] },
];

export const INITIAL_STANDINGS: StandingsRow[] = INITIAL_STANDINGS_A;

export function getInitialStandingsForDivision(
  division: 'A' | 'B'
): StandingsRow[] {
  const source = division === 'B' ? INITIAL_STANDINGS_B : INITIAL_STANDINGS_A;
  return source.map((row) => ({ ...row, form: [...row.form] }));
}

// Generate deterministic round-robin schedule for rounds 6 to 19 within the club's division
export function generateLeagueSchedule(
  userClubId: string = USER_CLUB_ID,
  division?: 'A' | 'B'
): RoundFixture[] {
  const userClub = INITIAL_CLUBS.find((c) => c.id === userClubId);
  const resolvedDivision = division ?? userClub?.division ?? 'A';
  const divisionClubs =
    resolvedDivision === 'B' ? SERIE_B_CLUBS : SERIE_A_CLUBS;

  const clubIds = divisionClubs.map((c) => c.id);
  const fixtures: RoundFixture[] = [];

  const n = clubIds.length;
  const fixed = clubIds[0];
  const rotating = clubIds.slice(1);

  for (let round = 6; round <= 19; round++) {
    const shift = (round - 6) % (n - 1);
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
    date: '16 Mai 2026 · 09:15',
    sender: 'Comissão Técnica',
    senderRole: 'Auxiliar Técnico',
    subject: 'Dossiê Tático: Preparação para a 6ª Rodada do Brasileirão',
    category: 'Tática',
    priority: 'positive',
    read: false,
    body: [
      'A análise do próximo adversário está pronta. Nossa linha ofensiva vem mantendo alto volume de finalizações com Pedro, Arrascaeta e Gerson.',
      'Revise a prancheta tática antes do apito inicial para ajustar funções e intensidade de pressão.',
    ],
    bulletPoints: [
      'Arrascaeta (MEI) lidera as assistências da equipe.',
      'Pedro (ATA) soma alta taxa de conversão dentro da área.',
    ],
    actionLabel: 'Revisar Prancheta Tática',
    actionTargetTab: 'tactics',
  },
  {
    id: 'msg-2',
    date: '16 Mai 2026 · 08:40',
    sender: 'Departamento Médico',
    senderRole: 'Fisiologia',
    subject: 'Alerta de Fadiga: Erick Pulgar (76%)',
    category: 'Departamento Médico',
    priority: 'warning',
    read: false,
    relatedPlayerId: 'flamengo-p6',
    body: [
      'Os testes físicos apontam desgaste muscular moderado em Erick Pulgar (76%).',
      'Nicolás De La Cruz está 100% apto caso opte por preservar o titular.',
    ],
    bulletPoints: [
      'Erick Pulgar (VOL): 76% de condição.',
      'Nicolás De La Cruz (MC): pronto para iniciar.',
    ],
    actionLabel: 'Gerenciar Elenco',
    actionTargetTab: 'squad',
  },
  {
    id: 'msg-3',
    date: '15 Mai 2026 · 18:10',
    sender: 'Diretoria',
    senderRole: 'Presidência',
    subject: 'Meta da Temporada e Saúde Financeira',
    category: 'Diretoria',
    priority: 'normal',
    read: false,
    body: [
      'O clube segue bem posicionado na parte de cima da tabela e com orçamento equilibrado para a sequência do campeonato.',
    ],
    bulletPoints: [
      'Meta: Briga direta pelo título e vaga no G-4.',
      'Estádio: Maracanã.',
    ],
    actionLabel: 'Ver Finanças',
    actionTargetTab: 'finances',
  },
];
