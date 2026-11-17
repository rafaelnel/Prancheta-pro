import {
  Club,
  CompetitionType,
  CopaDoBrasilStage,
  CopaDoBrasilState,
  LibertadoresGroup,
  LibertadoresGroupName,
  LibertadoresKnockoutStage,
  LibertadoresState,
  RoundFixture,
  SeasonCalendarStep,
  StandingsRow,
} from '../types/football';
import {
  ALL_WORLD_CLUBS,
  CONMEBOL_FOREIGN_CLUBS,
  LIBERTADORES_BR_CLUB_IDS,
  SERIE_A_CLUBS,
  SERIE_B_CLUBS,
} from './initialDatabase';
import {
  simulateRoundFixtures,
  updateStandingsWithRound,
} from '../engine/matchEngine';

export const COPA_DO_BRASIL_STAGES: CopaDoBrasilStage[] = [
  '3ª Fase',
  'Oitavas',
  'Quartas',
  'Semifinal',
  'Final',
];

export const LIBERTADORES_KNOCKOUT_STAGES: LibertadoresKnockoutStage[] = [
  'Oitavas',
  'Quartas',
  'Semifinal',
  'Final',
];

export const SEASON_CALENDAR: SeasonCalendarStep[] = [
  { index: 0, competition: 'BRASILEIRAO', leagueRound: 1, dayOffset: 0, label: 'Brasileirão · 1ª Rodada' },
  { index: 1, competition: 'BRASILEIRAO', leagueRound: 2, dayOffset: 4, label: 'Brasileirão · 2ª Rodada' },
  { index: 2, competition: 'COPA_DO_BRASIL', copaStage: '3ª Fase', dayOffset: 14, label: 'Copa do Brasil · 3ª Fase' },
  { index: 3, competition: 'LIBERTADORES', libStage: 'Grupos', libGroupRound: 1, dayOffset: 21, label: 'Libertadores · Grupos (1ªR)' },
  { index: 4, competition: 'BRASILEIRAO', leagueRound: 3, dayOffset: 25, label: 'Brasileirão · 3ª Rodada' },
  { index: 5, competition: 'LIBERTADORES', libStage: 'Grupos', libGroupRound: 2, dayOffset: 35, label: 'Libertadores · Grupos (2ªR)' },
  { index: 6, competition: 'BRASILEIRAO', leagueRound: 4, dayOffset: 39, label: 'Brasileirão · 4ª Rodada' },
  { index: 7, competition: 'COPA_DO_BRASIL', copaStage: 'Oitavas', dayOffset: 49, label: 'Copa do Brasil · Oitavas' },
  { index: 8, competition: 'BRASILEIRAO', leagueRound: 5, dayOffset: 53, label: 'Brasileirão · 5ª Rodada' },
  { index: 9, competition: 'LIBERTADORES', libStage: 'Grupos', libGroupRound: 3, dayOffset: 63, label: 'Libertadores · Grupos (3ªR)' },
  { index: 10, competition: 'BRASILEIRAO', leagueRound: 6, dayOffset: 67, label: 'Brasileirão · 6ª Rodada' },
  { index: 11, competition: 'LIBERTADORES', libStage: 'Grupos', libGroupRound: 4, dayOffset: 77, label: 'Libertadores · Grupos (4ªR)' },
  { index: 12, competition: 'BRASILEIRAO', leagueRound: 7, dayOffset: 81, label: 'Brasileirão · 7ª Rodada' },
  { index: 13, competition: 'COPA_DO_BRASIL', copaStage: 'Quartas', dayOffset: 91, label: 'Copa do Brasil · Quartas' },
  { index: 14, competition: 'BRASILEIRAO', leagueRound: 8, dayOffset: 95, label: 'Brasileirão · 8ª Rodada' },
  { index: 15, competition: 'LIBERTADORES', libStage: 'Grupos', libGroupRound: 5, dayOffset: 105, label: 'Libertadores · Grupos (5ªR)' },
  { index: 16, competition: 'BRASILEIRAO', leagueRound: 9, dayOffset: 109, label: 'Brasileirão · 9ª Rodada' },
  { index: 17, competition: 'LIBERTADORES', libStage: 'Grupos', libGroupRound: 6, dayOffset: 119, label: 'Libertadores · Grupos (6ªR)' },
  { index: 18, competition: 'BRASILEIRAO', leagueRound: 10, dayOffset: 123, label: 'Brasileirão · 10ª Rodada' },
  { index: 19, competition: 'COPA_DO_BRASIL', copaStage: 'Semifinal', dayOffset: 140, label: 'Copa do Brasil · Semifinal' },
  { index: 20, competition: 'BRASILEIRAO', leagueRound: 11, dayOffset: 144, label: 'Brasileirão · 11ª Rodada' },
  { index: 21, competition: 'LIBERTADORES', libStage: 'Oitavas', dayOffset: 168, label: 'Libertadores · Oitavas' },
  { index: 22, competition: 'BRASILEIRAO', leagueRound: 12, dayOffset: 172, label: 'Brasileirão · 12ª Rodada' },
  { index: 23, competition: 'LIBERTADORES', libStage: 'Quartas', dayOffset: 196, label: 'Libertadores · Quartas' },
  { index: 24, competition: 'BRASILEIRAO', leagueRound: 13, dayOffset: 200, label: 'Brasileirão · 13ª Rodada' },
  { index: 25, competition: 'COPA_DO_BRASIL', copaStage: 'Final', dayOffset: 221, label: 'Copa do Brasil · Final' },
  { index: 26, competition: 'BRASILEIRAO', leagueRound: 14, dayOffset: 228, label: 'Brasileirão · 14ª Rodada' },
  { index: 27, competition: 'LIBERTADORES', libStage: 'Semifinal', dayOffset: 238, label: 'Libertadores · Semifinal' },
  { index: 28, competition: 'BRASILEIRAO', leagueRound: 15, dayOffset: 242, label: 'Brasileirão · 15ª Rodada' },
  { index: 29, competition: 'BRASILEIRAO', leagueRound: 16, dayOffset: 263, label: 'Brasileirão · 16ª Rodada' },
  { index: 30, competition: 'LIBERTADORES', libStage: 'Final', dayOffset: 273, label: 'Libertadores · Final' },
  { index: 31, competition: 'BRASILEIRAO', leagueRound: 17, dayOffset: 284, label: 'Brasileirão · 17ª Rodada' },
  { index: 32, competition: 'BRASILEIRAO', leagueRound: 18, dayOffset: 298, label: 'Brasileirão · 18ª Rodada' },
  { index: 33, competition: 'BRASILEIRAO', leagueRound: 19, dayOffset: 312, label: 'Brasileirão · 19ª Rodada' },
];

export function resolvePenaltyShootout(
  homeClubId: string,
  awayClubId: string,
  clubs: Club[],
  rng: () => number = Math.random
): { homePenalties: number; awayPenalties: number; winnerClubId: string } {
  const clubMap = new Map(clubs.map((c) => [c.id, c]));
  const homeRep = clubMap.get(homeClubId)?.reputation ?? 75;
  const awayRep = clubMap.get(awayClubId)?.reputation ?? 75;
  const homeWinProb = Math.min(0.68, Math.max(0.32, 0.52 + (homeRep - awayRep) * 0.01));
  const homeWins = rng() < homeWinProb;

  const scores: Array<[number, number]> = [
    [5, 4],
    [4, 3],
    [4, 2],
    [5, 3],
    [3, 1],
    [6, 5],
  ];
  const [winScore, loseScore] = scores[Math.floor(rng() * scores.length)];
  return homeWins
    ? {
        homePenalties: winScore,
        awayPenalties: loseScore,
        winnerClubId: homeClubId,
      }
    : {
        homePenalties: loseScore,
        awayPenalties: winScore,
        winnerClubId: awayClubId,
      };
}

export function resolveKnockoutFixtures(
  fixtures: RoundFixture[],
  clubs: Club[],
  rng: () => number = Math.random
): RoundFixture[] {
  return fixtures.map((f) => {
    if (!f.played || f.homeGoals === null || f.awayGoals === null) return f;
    if (f.winnerClubId) return f;
    if (f.homeGoals > f.awayGoals) {
      return { ...f, winnerClubId: f.homeClubId };
    }
    if (f.awayGoals > f.homeGoals) {
      return { ...f, winnerClubId: f.awayClubId };
    }
    const pen = resolvePenaltyShootout(f.homeClubId, f.awayClubId, clubs, rng);
    return {
      ...f,
      homePenalties: pen.homePenalties,
      awayPenalties: pen.awayPenalties,
      winnerClubId: pen.winnerClubId,
    };
  });
}

export function createInitialCopaDoBrasil(userClubId: string): CopaDoBrasilState {
  const serieAIds = SERIE_A_CLUBS.map((c) => c.id);
  const topSerieB = [...SERIE_B_CLUBS]
    .sort((a, b) => b.reputation - a.reputation)
    .map((c) => c.id);

  const participantSet = new Set<string>(serieAIds);
  if (!participantSet.has(userClubId)) {
    participantSet.add(userClubId);
  }
  for (const id of topSerieB) {
    if (participantSet.size >= 32) break;
    participantSet.add(id);
  }

  const participantIds = Array.from(participantSet);
  const clubMap = new Map(ALL_WORLD_CLUBS.map((c) => [c.id, c]));
  const sortedByRep = [...participantIds].sort(
    (a, b) => (clubMap.get(b)?.reputation ?? 70) - (clubMap.get(a)?.reputation ?? 70)
  );

  // Pot 1 (top 16 seeded) vs Pot 2 (16 clubs) — guaranteed unique opponents
  const pot1 = sortedByRep.slice(0, 16);
  const pot2 = sortedByRep.slice(16, 32);

  const stage3Fixtures: RoundFixture[] = pot1.map((seedClubId, idx) => {
    const oppClubId = pot2[(idx * 5 + 3) % 16];
    const homeClubId = idx % 2 === 0 ? oppClubId : seedClubId;
    const awayClubId = idx % 2 === 0 ? seedClubId : oppClubId;
    return {
      id: `cdb-3f-m${idx + 1}`,
      division: 'A',
      competition: 'COPA_DO_BRASIL',
      stageLabel: '3ª Fase',
      roundNumber: 1,
      homeClubId,
      awayClubId,
      homeGoals: null,
      awayGoals: null,
      homePenalties: null,
      awayPenalties: null,
      winnerClubId: null,
      played: false,
      isUserMatch: homeClubId === userClubId || awayClubId === userClubId,
    };
  });

  return {
    participantIds,
    currentStage: '3ª Fase',
    fixturesByStage: {
      '3ª Fase': stage3Fixtures,
      Oitavas: [],
      Quartas: [],
      Semifinal: [],
      Final: [],
    },
    eliminatedIds: [],
    championClubId: null,
  };
}

export function advanceCopaDoBrasilStage(
  state: CopaDoBrasilState,
  stage: CopaDoBrasilStage,
  userResult: {
    fixtureId: string;
    homeGoals: number;
    awayGoals: number;
    homeXG: number;
    awayXG: number;
    homePenalties?: number | null;
    awayPenalties?: number | null;
    winnerClubId?: string | null;
  } | null,
  clubs: Club[],
  userClubId: string,
  rng: () => number = Math.random
): CopaDoBrasilState {
  const stageFixtures = state.fixturesByStage[stage] || [];
  if (stageFixtures.length === 0) return state;

  const simulated = simulateRoundFixtures(
    stageFixtures,
    1,
    userResult || {
      fixtureId: '__none__',
      homeGoals: 0,
      awayGoals: 0,
      homeXG: 0,
      awayXG: 0,
    },
    clubs,
    rng
  ).map((f) => {
    if (userResult && f.id === userResult.fixtureId && userResult.winnerClubId) {
      return {
        ...f,
        homePenalties: userResult.homePenalties ?? null,
        awayPenalties: userResult.awayPenalties ?? null,
        winnerClubId: userResult.winnerClubId,
      };
    }
    return f;
  });

  const resolved = resolveKnockoutFixtures(simulated, clubs, rng);
  const losers: string[] = [];
  const winners: string[] = [];

  for (const fix of resolved) {
    const winId = fix.winnerClubId || fix.homeClubId;
    const loseId = winId === fix.homeClubId ? fix.awayClubId : fix.homeClubId;
    winners.push(winId);
    losers.push(loseId);
  }

  const nextEliminated = Array.from(new Set([...state.eliminatedIds, ...losers]));
  const nextFixturesByStage = {
    ...state.fixturesByStage,
    [stage]: resolved,
  };

  const stageIdx = COPA_DO_BRASIL_STAGES.indexOf(stage);
  const nextStage = COPA_DO_BRASIL_STAGES[stageIdx + 1];

  if (!nextStage) {
    return {
      ...state,
      fixturesByStage: nextFixturesByStage,
      eliminatedIds: nextEliminated,
      championClubId: winners[0] || null,
    };
  }

  const nextRoundFixtures: RoundFixture[] = [];
  for (let i = 0; i < winners.length; i += 2) {
    const t1 = winners[i];
    const t2 = winners[i + 1];
    if (!t1 || !t2) continue;
    const homeClubId = i % 4 === 0 ? t1 : t2;
    const awayClubId = i % 4 === 0 ? t2 : t1;
    nextRoundFixtures.push({
      id: `cdb-${nextStage.toLowerCase().replace(/\s+/g, '')}-m${i / 2 + 1}`,
      division: 'A',
      competition: 'COPA_DO_BRASIL',
      stageLabel: nextStage,
      roundNumber: 1,
      homeClubId,
      awayClubId,
      homeGoals: null,
      awayGoals: null,
      homePenalties: null,
      awayPenalties: null,
      winnerClubId: null,
      played: false,
      isUserMatch: homeClubId === userClubId || awayClubId === userClubId,
    });
  }

  nextFixturesByStage[nextStage] = nextRoundFixtures;

  return {
    ...state,
    currentStage: nextStage,
    fixturesByStage: nextFixturesByStage,
    eliminatedIds: nextEliminated,
  };
}

const LIBERTADORES_GROUP_BLUEPRINTS: Array<{
  name: LibertadoresGroupName;
  clubIds: [string, string, string, string];
}> = [
  { name: 'A', clubIds: ['flamengo', 'ldu-quito', 'junior-barranquilla', 'the-strongest'] },
  { name: 'B', clubIds: ['palmeiras', 'penarol', 'cerro-porteno', 'carabobo'] },
  { name: 'C', clubIds: ['river-plate', 'bahia', 'colo-colo', 'universitario'] },
  { name: 'D', clubIds: ['boca-juniors', 'fluminense', 'ind-del-valle', 'dep-tachira'] },
  { name: 'E', clubIds: ['racing-club', 'cruzeiro', 'santa-fe', 'alianza-lima'] },
  { name: 'F', clubIds: ['botafogo', 'nacional-uru', 'libertad', 'bolivar'] },
  { name: 'G', clubIds: ['corinthians', 'estudiantes-lp', 'atletico-nacional', 'barcelona-sc'] },
  { name: 'H', clubIds: ['mirassol', 'rosario-central', 'olimpia', 'u-de-chile'] },
];

function createGroupFixtures(
  groupName: LibertadoresGroupName,
  clubIds: [string, string, string, string],
  userClubId: string
): RoundFixture[] {
  const [c0, c1, c2, c3] = clubIds;
  const pairingsByRound: Array<[[string, string], [string, string]]> = [
    [[c0, c1], [c2, c3]], // R1
    [[c3, c0], [c1, c2]], // R2
    [[c0, c2], [c1, c3]], // R3
    [[c1, c0], [c3, c2]], // R4
    [[c0, c3], [c2, c1]], // R5
    [[c2, c0], [c3, c1]], // R6
  ];

  const fixtures: RoundFixture[] = [];
  pairingsByRound.forEach((pairings, rIdx) => {
    const roundNumber = rIdx + 1;
    pairings.forEach(([homeClubId, awayClubId], mIdx) => {
      fixtures.push({
        id: `lib-g${groupName}-r${roundNumber}-m${mIdx + 1}`,
        division: 'LIB',
        competition: 'LIBERTADORES',
        stageLabel: `Grupo ${groupName} · ${roundNumber}ªR`,
        groupName,
        roundNumber,
        homeClubId,
        awayClubId,
        homeGoals: null,
        awayGoals: null,
        played: false,
        isUserMatch: homeClubId === userClubId || awayClubId === userClubId,
      });
    });
  });
  return fixtures;
}

export function createInitialLibertadores(userClubId: string): LibertadoresState {
  const participantIds = [
    ...LIBERTADORES_BR_CLUB_IDS,
    ...CONMEBOL_FOREIGN_CLUBS.map((c) => c.id),
  ];

  const groups: LibertadoresGroup[] = LIBERTADORES_GROUP_BLUEPRINTS.map((bp) => {
    const standings: StandingsRow[] = bp.clubIds.map((clubId) => ({
      clubId,
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
    return {
      name: bp.name,
      clubIds: [...bp.clubIds],
      standings,
      fixtures: createGroupFixtures(bp.name, bp.clubIds, userClubId),
    };
  });

  return {
    participantIds,
    currentPhase: 'Grupos',
    groupRound: 1,
    groups,
    knockoutFixtures: {
      Oitavas: [],
      Quartas: [],
      Semifinal: [],
      Final: [],
    },
    eliminatedIds: [],
    championClubId: null,
  };
}

export function advanceLibertadoresGroupRound(
  state: LibertadoresState,
  roundNumber: number,
  userResult: {
    fixtureId: string;
    homeGoals: number;
    awayGoals: number;
    homeXG: number;
    awayXG: number;
  } | null,
  clubs: Club[],
  userClubId: string,
  rng: () => number = Math.random
): LibertadoresState {
  const updatedGroups = state.groups.map((grp) => {
    const updatedFixtures = simulateRoundFixtures(
      grp.fixtures,
      roundNumber,
      userResult || {
        fixtureId: '__none__',
        homeGoals: 0,
        awayGoals: 0,
        homeXG: 0,
        awayXG: 0,
      },
      clubs,
      rng
    );
    const roundCompleted = updatedFixtures.filter(
      (f) => f.roundNumber === roundNumber
    );
    const updatedStandings = updateStandingsWithRound(
      grp.standings,
      roundCompleted
    );
    return {
      ...grp,
      fixtures: updatedFixtures,
      standings: updatedStandings,
    };
  });

  if (roundNumber < 6) {
    return {
      ...state,
      groupRound: roundNumber + 1,
      groups: updatedGroups,
    };
  }

  // Group stage completed! Top 2 from each group qualify for Oitavas de Final.
  const eliminatedFromGroups: string[] = [];
  const groupWinners = new Map<LibertadoresGroupName, string>();
  const groupRunnersUp = new Map<LibertadoresGroupName, string>();

  for (const grp of updatedGroups) {
    if (grp.standings[0]) groupWinners.set(grp.name, grp.standings[0].clubId);
    if (grp.standings[1]) groupRunnersUp.set(grp.name, grp.standings[1].clubId);
    if (grp.standings[2]) eliminatedFromGroups.push(grp.standings[2].clubId);
    if (grp.standings[3]) eliminatedFromGroups.push(grp.standings[3].clubId);
  }

  const bracketPairs: Array<[LibertadoresGroupName, LibertadoresGroupName]> = [
    ['A', 'B'],
    ['C', 'D'],
    ['E', 'F'],
    ['G', 'H'],
    ['B', 'A'],
    ['D', 'C'],
    ['F', 'E'],
    ['H', 'G'],
  ];

  const oitavas: RoundFixture[] = bracketPairs.map(([winGrp, runGrp], idx) => {
    const awayClubId = groupRunnersUp.get(runGrp)!;
    const homeClubId = groupWinners.get(winGrp)!;
    return {
      id: `lib-oitavas-m${idx + 1}`,
      division: 'LIB',
      competition: 'LIBERTADORES',
      stageLabel: 'Oitavas',
      roundNumber: 1,
      homeClubId,
      awayClubId,
      homeGoals: null,
      awayGoals: null,
      homePenalties: null,
      awayPenalties: null,
      winnerClubId: null,
      played: false,
      isUserMatch: homeClubId === userClubId || awayClubId === userClubId,
    };
  });

  return {
    ...state,
    currentPhase: 'Oitavas',
    groupRound: 6,
    groups: updatedGroups,
    knockoutFixtures: {
      ...state.knockoutFixtures,
      Oitavas: oitavas,
    },
    eliminatedIds: Array.from(
      new Set([...state.eliminatedIds, ...eliminatedFromGroups])
    ),
  };
}

export function advanceLibertadoresKnockoutStage(
  state: LibertadoresState,
  stage: LibertadoresKnockoutStage,
  userResult: {
    fixtureId: string;
    homeGoals: number;
    awayGoals: number;
    homeXG: number;
    awayXG: number;
    homePenalties?: number | null;
    awayPenalties?: number | null;
    winnerClubId?: string | null;
  } | null,
  clubs: Club[],
  userClubId: string,
  rng: () => number = Math.random
): LibertadoresState {
  const stageFixtures = state.knockoutFixtures[stage] || [];
  if (stageFixtures.length === 0) return state;

  const simulated = simulateRoundFixtures(
    stageFixtures,
    1,
    userResult || {
      fixtureId: '__none__',
      homeGoals: 0,
      awayGoals: 0,
      homeXG: 0,
      awayXG: 0,
    },
    clubs,
    rng
  ).map((f) => {
    if (userResult && f.id === userResult.fixtureId && userResult.winnerClubId) {
      return {
        ...f,
        homePenalties: userResult.homePenalties ?? null,
        awayPenalties: userResult.awayPenalties ?? null,
        winnerClubId: userResult.winnerClubId,
      };
    }
    return f;
  });

  const resolved = resolveKnockoutFixtures(simulated, clubs, rng);
  const losers: string[] = [];
  const winners: string[] = [];

  for (const fix of resolved) {
    const winId = fix.winnerClubId || fix.homeClubId;
    const loseId = winId === fix.homeClubId ? fix.awayClubId : fix.homeClubId;
    winners.push(winId);
    losers.push(loseId);
  }

  const nextEliminated = Array.from(new Set([...state.eliminatedIds, ...losers]));
  const nextKnockoutFixtures = {
    ...state.knockoutFixtures,
    [stage]: resolved,
  };

  const stageIdx = LIBERTADORES_KNOCKOUT_STAGES.indexOf(stage);
  const nextStage = LIBERTADORES_KNOCKOUT_STAGES[stageIdx + 1];

  if (!nextStage) {
    return {
      ...state,
      knockoutFixtures: nextKnockoutFixtures,
      eliminatedIds: nextEliminated,
      championClubId: winners[0] || null,
    };
  }

  const nextFixtures: RoundFixture[] = [];
  for (let i = 0; i < winners.length; i += 2) {
    const t1 = winners[i];
    const t2 = winners[i + 1];
    if (!t1 || !t2) continue;
    const homeClubId = i % 4 === 0 ? t1 : t2;
    const awayClubId = i % 4 === 0 ? t2 : t1;
    nextFixtures.push({
      id: `lib-${nextStage.toLowerCase()}-m${i / 2 + 1}`,
      division: 'LIB',
      competition: 'LIBERTADORES',
      stageLabel: nextStage,
      roundNumber: 1,
      homeClubId,
      awayClubId,
      homeGoals: null,
      awayGoals: null,
      homePenalties: null,
      awayPenalties: null,
      winnerClubId: null,
      played: false,
      isUserMatch: homeClubId === userClubId || awayClubId === userClubId,
    });
  }

  nextKnockoutFixtures[nextStage] = nextFixtures;

  return {
    ...state,
    currentPhase: nextStage,
    knockoutFixtures: nextKnockoutFixtures,
    eliminatedIds: nextEliminated,
  };
}

export function findUserFixtureForStep(
  step: SeasonCalendarStep,
  userClubId: string,
  leagueFixtures: RoundFixture[],
  copaDoBrasil: CopaDoBrasilState,
  libertadores: LibertadoresState
): RoundFixture | null {
  if (step.competition === 'BRASILEIRAO' && step.leagueRound) {
    return (
      leagueFixtures.find(
        (f) => f.roundNumber === step.leagueRound && f.isUserMatch
      ) || null
    );
  }
  if (step.competition === 'COPA_DO_BRASIL' && step.copaStage) {
    const list = copaDoBrasil.fixturesByStage[step.copaStage] || [];
    return (
      list.find(
        (f) =>
          (f.homeClubId === userClubId || f.awayClubId === userClubId) && !f.played
      ) || null
    );
  }
  if (step.competition === 'LIBERTADORES') {
    if (step.libStage === 'Grupos' && step.libGroupRound) {
      for (const grp of libertadores.groups) {
        const match = grp.fixtures.find(
          (f) =>
            f.roundNumber === step.libGroupRound &&
            (f.homeClubId === userClubId || f.awayClubId === userClubId) &&
            !f.played
        );
        if (match) return match;
      }
      return null;
    }
    if (step.libStage && step.libStage !== 'Grupos') {
      const list = libertadores.knockoutFixtures[step.libStage] || [];
      return (
        list.find(
          (f) =>
            (f.homeClubId === userClubId || f.awayClubId === userClubId) && !f.played
        ) || null
      );
    }
  }
  return null;
}

export function getCupPrizeMoney(
  competition: CompetitionType,
  stageLabel: string | undefined,
  userAdvancedOrWon: boolean,
  isFinalWinner: boolean
): number {
  if (competition === 'COPA_DO_BRASIL') {
    if (!userAdvancedOrWon) {
      return stageLabel === 'Final' ? 30000000 : 1200000;
    }
    if (isFinalWinner || stageLabel === 'Final') return 70000000;
    if (stageLabel === 'Semifinal') return 15000000;
    if (stageLabel === 'Quartas') return 7500000;
    if (stageLabel === 'Oitavas') return 4500000;
    return 3200000;
  }
  if (competition === 'LIBERTADORES') {
    if (stageLabel?.startsWith('Grupo')) {
      return userAdvancedOrWon ? 2000000 : 500000;
    }
    if (!userAdvancedOrWon) {
      return stageLabel === 'Final' ? 40000000 : 1500000;
    }
    if (isFinalWinner || stageLabel === 'Final') return 120000000;
    if (stageLabel === 'Semifinal') return 12500000;
    if (stageLabel === 'Quartas') return 9000000;
    return 6500000;
  }
  return 0;
}

export function isKnockoutFixture(fixture: RoundFixture): boolean {
  if (fixture.competition === 'COPA_DO_BRASIL') return true;
  if (
    fixture.competition === 'LIBERTADORES' &&
    fixture.stageLabel &&
    !fixture.stageLabel.startsWith('Grupo')
  ) {
    return true;
  }
  return false;
}
