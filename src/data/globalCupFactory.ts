import {
  ChampionsKnockoutStage,
  ChampionsLeagueState,
  Club,
  MundialStage,
  MundialState,
  RoundFixture,
  StandingsRow,
  SuperMundialGroup,
  SuperMundialGroupName,
  SuperMundialKnockoutStage,
  SuperMundialState,
} from '../types/football';
import {
  ALL_WORLD_CLUBS,
  GLOBAL_WORLD_CLUBS,
  UCL_CLUBS,
} from './initialDatabase';
import {
  simulateRoundFixtures,
  updateStandingsWithRound,
} from '../engine/matchEngine';

export const CHAMPIONS_STAGES: ChampionsKnockoutStage[] = [
  'Oitavas',
  'Quartas',
  'Semifinal',
  'Final',
];

export const MUNDIAL_STAGES: MundialStage[] = ['Semifinal', 'Final'];

export const SUPER_MUNDIAL_KNOCKOUT_STAGES: SuperMundialKnockoutStage[] = [
  'Quartas',
  'Semifinal',
  'Final',
];

const SUPER_MUNDIAL_GROUP_NAMES: SuperMundialGroupName[] = ['A', 'B', 'C', 'D'];

export function isSuperMundialYear(year: number): boolean {
  return year >= 2026 && (year - 2026) % 4 === 0;
}

export function getNextSuperMundialYear(year: number): number {
  if (year < 2026) return 2026;
  const rem = (year - 2026) % 4;
  return rem === 0 ? year : year + (4 - rem);
}

function resolveKnockoutMatchList(
  fixtures: RoundFixture[],
  clubs: Club[],
  rng: () => number = Math.random
): RoundFixture[] {
  const clubMap = new Map(clubs.map((c) => [c.id, c]));
  const penScores: Array<[number, number]> = [
    [5, 4],
    [4, 3],
    [4, 2],
    [5, 3],
    [3, 1],
    [6, 5],
  ];

  return fixtures.map((f) => {
    if (!f.played || f.homeGoals === null || f.awayGoals === null) return f;
    if (f.winnerClubId) return f;
    if (f.homeGoals > f.awayGoals) {
      return { ...f, winnerClubId: f.homeClubId };
    }
    if (f.awayGoals > f.homeGoals) {
      return { ...f, winnerClubId: f.awayClubId };
    }
    const homeRep = clubMap.get(f.homeClubId)?.reputation ?? 80;
    const awayRep = clubMap.get(f.awayClubId)?.reputation ?? 80;
    const homeWinProb = Math.min(
      0.68,
      Math.max(0.32, 0.52 + (homeRep - awayRep) * 0.01)
    );
    const homeWins = rng() < homeWinProb;
    const [winScore, loseScore] = penScores[Math.floor(rng() * penScores.length)];
    return {
      ...f,
      homePenalties: homeWins ? winScore : loseScore,
      awayPenalties: homeWins ? loseScore : winScore,
      winnerClubId: homeWins ? f.homeClubId : f.awayClubId,
    };
  });
}

function createEmptyStandings(clubIds: string[]): StandingsRow[] {
  return clubIds.map((clubId) => ({
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
}

/**
 * UEFA Champions League (16 clubes europeus reais)
 * Simulada automaticamente em segundo plano para definir:
 * - O Campeão Europeu (vaga direta no Mundial de Clubes anual)
 * - Os 6 classificados europeus para o Super Mundial de Clubes (quadrienal)
 */
export function createInitialChampionsLeague(
  seasonYear: number = 2026,
  clubsPool?: Club[]
): ChampionsLeagueState {
  const sourceClubs = clubsPool && clubsPool.length > 0 ? clubsPool : ALL_WORLD_CLUBS;
  const uclClubs = sourceClubs.filter((c) => c.division === 'UCL');
  const pool = uclClubs.length >= 16 ? uclClubs : UCL_CLUBS;

  const sortedByRep = [...pool]
    .sort((a, b) => b.reputation - a.reputation)
    .slice(0, 16);

  const pot1 = sortedByRep.slice(0, 8).map((c) => c.id);
  const pot2 = sortedByRep.slice(8, 16).map((c) => c.id);

  // Rotação determinística anual dos confrontos de Oitavas
  const shift = Math.abs(seasonYear - 2026) % 8;
  const oitavas: RoundFixture[] = pot1.map((seedClubId, idx) => {
    const oppClubId = pot2[(idx * 3 + shift + 1) % 8];
    const homeClubId = idx % 2 === 0 ? seedClubId : oppClubId;
    const awayClubId = idx % 2 === 0 ? oppClubId : seedClubId;
    return {
      id: `ucl-${seasonYear}-oitavas-m${idx + 1}`,
      division: 'UCL',
      competition: 'CHAMPIONS_LEAGUE',
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
      isUserMatch: false,
    };
  });

  return {
    seasonYear,
    participantIds: sortedByRep.map((c) => c.id),
    currentStage: 'Oitavas',
    fixturesByStage: {
      Oitavas: oitavas,
      Quartas: [],
      Semifinal: [],
      Final: [],
    },
    eliminatedIds: [],
    quarterfinalistIds: [],
    semifinalistIds: [],
    runnerUpClubId: null,
    championClubId: null,
  };
}

export function advanceChampionsLeagueStage(
  state: ChampionsLeagueState,
  stage: ChampionsKnockoutStage,
  clubs: Club[],
  rng: () => number = Math.random
): ChampionsLeagueState {
  const stageFixtures = state.fixturesByStage[stage] || [];
  if (stageFixtures.length === 0) return state;
  if (stageFixtures.every((f) => f.played)) return state;

  const simulated = simulateRoundFixtures(
    stageFixtures,
    1,
    {
      fixtureId: '__none__',
      homeGoals: 0,
      awayGoals: 0,
      homeXG: 0,
      awayXG: 0,
    },
    clubs,
    rng
  );

  const resolved = resolveKnockoutMatchList(simulated, clubs, rng);
  const winners: string[] = [];
  const losers: string[] = [];

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

  const nextQuarterfinalists =
    stage === 'Oitavas' ? [...winners] : state.quarterfinalistIds;
  const nextSemifinalists =
    stage === 'Quartas' ? [...winners] : state.semifinalistIds;

  const stageIdx = CHAMPIONS_STAGES.indexOf(stage);
  const nextStage = CHAMPIONS_STAGES[stageIdx + 1];

  if (!nextStage) {
    return {
      ...state,
      fixturesByStage: nextFixturesByStage,
      eliminatedIds: nextEliminated,
      quarterfinalistIds: nextQuarterfinalists,
      semifinalistIds: nextSemifinalists,
      championClubId: winners[0] || null,
      runnerUpClubId: losers[0] || null,
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
      id: `ucl-${state.seasonYear}-${nextStage.toLowerCase()}-m${i / 2 + 1}`,
      division: 'UCL',
      competition: 'CHAMPIONS_LEAGUE',
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
      isUserMatch: false,
    });
  }

  nextFixturesByStage[nextStage] = nextFixtures;

  return {
    ...state,
    currentStage: nextStage,
    fixturesByStage: nextFixturesByStage,
    eliminatedIds: nextEliminated,
    quarterfinalistIds: nextQuarterfinalists,
    semifinalistIds: nextSemifinalists,
  };
}

/**
 * Mundial de Clubes anual (Dezembro · 4 clubes):
 * - Campeão da Libertadores (CONMEBOL)
 * - Campeão da UEFA Champions League (Europa)
 * - 2 representantes globais (Ásia / África / CONCACAF)
 */
export function createInitialMundial(seasonYear: number = 2026): MundialState {
  const globalPairs: [string, string] =
    seasonYear % 2 === 0 ? ['al-hilal', 'al-ahly'] : ['monterrey', 'inter-miami'];

  return {
    seasonYear,
    isSeeded: false,
    participantIds: [],
    uefaChampionId: null,
    conmebolChampionId: null,
    globalClubIds: [...globalPairs],
    currentStage: 'Semifinal',
    fixturesByStage: {
      Semifinal: [],
      Final: [],
    },
    eliminatedIds: [],
    runnerUpClubId: null,
    championClubId: null,
  };
}

export function seedMundialBracket(
  state: MundialState,
  uclChampionId: string | null,
  conmebolChampionId: string | null,
  clubs: Club[],
  userClubId: string
): MundialState {
  if (state.isSeeded && state.fixturesByStage.Semifinal.length === 2) {
    return state;
  }

  const uclFallback =
    [...clubs]
      .filter((c) => c.division === 'UCL')
      .sort((a, b) => b.reputation - a.reputation)[0]?.id ||
    UCL_CLUBS[0].id;

  const conmebolFallback =
    [...clubs]
      .filter((c) => c.division === 'A' || c.division === 'LIB')
      .sort((a, b) => b.reputation - a.reputation)[0]?.id || 'flamengo';

  const resolvedUcl = uclChampionId || uclFallback;
  const resolvedConmebol = conmebolChampionId || conmebolFallback;

  const availableGlobals = GLOBAL_WORLD_CLUBS.map((c) => c.id);
  const global1 = state.globalClubIds[0] || availableGlobals[0];
  const global2 = state.globalClubIds[1] || availableGlobals[1];

  const semifinals: RoundFixture[] = [
    {
      id: `mun-${state.seasonYear}-semi-m1`,
      division: 'WORLD',
      competition: 'MUNDIAL',
      stageLabel: 'Semifinal',
      roundNumber: 1,
      homeClubId: resolvedConmebol,
      awayClubId: global1,
      homeGoals: null,
      awayGoals: null,
      homePenalties: null,
      awayPenalties: null,
      winnerClubId: null,
      played: false,
      isUserMatch: resolvedConmebol === userClubId || global1 === userClubId,
    },
    {
      id: `mun-${state.seasonYear}-semi-m2`,
      division: 'WORLD',
      competition: 'MUNDIAL',
      stageLabel: 'Semifinal',
      roundNumber: 1,
      homeClubId: resolvedUcl,
      awayClubId: global2,
      homeGoals: null,
      awayGoals: null,
      homePenalties: null,
      awayPenalties: null,
      winnerClubId: null,
      played: false,
      isUserMatch: resolvedUcl === userClubId || global2 === userClubId,
    },
  ];

  return {
    ...state,
    isSeeded: true,
    uefaChampionId: resolvedUcl,
    conmebolChampionId: resolvedConmebol,
    globalClubIds: [global1, global2],
    participantIds: [resolvedConmebol, resolvedUcl, global1, global2],
    currentStage: 'Semifinal',
    fixturesByStage: {
      Semifinal: semifinals,
      Final: [],
    },
    eliminatedIds: [],
    runnerUpClubId: null,
    championClubId: null,
  };
}

export function advanceMundialStage(
  state: MundialState,
  stage: MundialStage,
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
): MundialState {
  const stageFixtures = state.fixturesByStage[stage] || [];
  if (stageFixtures.length === 0) return state;
  if (stageFixtures.every((f) => f.played)) return state;

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

  const resolved = resolveKnockoutMatchList(simulated, clubs, rng);
  const winners: string[] = [];
  const losers: string[] = [];

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

  if (stage === 'Final') {
    return {
      ...state,
      fixturesByStage: nextFixturesByStage,
      eliminatedIds: nextEliminated,
      championClubId: winners[0] || null,
      runnerUpClubId: losers[0] || null,
    };
  }

  // Semifinal -> Final
  const finalFixture: RoundFixture[] =
    winners.length >= 2
      ? [
          {
            id: `mun-${state.seasonYear}-final-m1`,
            division: 'WORLD',
            competition: 'MUNDIAL',
            stageLabel: 'Final',
            roundNumber: 1,
            homeClubId: winners[0],
            awayClubId: winners[1],
            homeGoals: null,
            awayGoals: null,
            homePenalties: null,
            awayPenalties: null,
            winnerClubId: null,
            played: false,
            isUserMatch: winners[0] === userClubId || winners[1] === userClubId,
          },
        ]
      : [];

  nextFixturesByStage.Final = finalFixture;

  return {
    ...state,
    currentStage: 'Final',
    fixturesByStage: nextFixturesByStage,
    eliminatedIds: nextEliminated,
  };
}

/**
 * Super Mundial de Clubes (Quadrienal: 2026, 2030, 2034...)
 * 16 clubes (6 UEFA via Champions League + 6 CONMEBOL + 4 Globais)
 * 4 Grupos de 4 (3 rodadas) -> Quartas -> Semifinal -> Final
 */
function createSuperMundialGroupFixtures(
  editionYear: number,
  groupName: SuperMundialGroupName,
  clubIds: [string, string, string, string],
  userClubId: string
): RoundFixture[] {
  const [c0, c1, c2, c3] = clubIds;
  const pairingsByRound: Array<[[string, string], [string, string]]> = [
    [[c0, c1], [c2, c3]], // 1ªR
    [[c0, c2], [c1, c3]], // 2ªR
    [[c0, c3], [c1, c2]], // 3ªR
  ];

  const fixtures: RoundFixture[] = [];
  pairingsByRound.forEach((pairings, rIdx) => {
    const roundNumber = rIdx + 1;
    pairings.forEach(([homeClubId, awayClubId], mIdx) => {
      fixtures.push({
        id: `sm-${editionYear}-g${groupName}-r${roundNumber}-m${mIdx + 1}`,
        division: 'WORLD',
        competition: 'SUPER_MUNDIAL',
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

function buildSuperMundialGroups(
  editionYear: number,
  uefaIds: string[],
  conmebolIds: string[],
  globalIds: string[],
  userClubId: string
): SuperMundialGroup[] {
  // Distribuição equilibrada em 4 grupos (A, B, C, D) de 4 clubes:
  // Cada grupo recebe 1 cabeça UEFA + 1 CONMEBOL + 1 Global + 1 (2 UEFA extras / 2 CONMEBOL extras)
  const pot1 = uefaIds.slice(0, 4);
  const pot2 = conmebolIds.slice(0, 4);
  const pot3 = [uefaIds[4], uefaIds[5], conmebolIds[4], conmebolIds[5]];
  const pot4 = globalIds.slice(0, 4);

  return SUPER_MUNDIAL_GROUP_NAMES.map((name, idx) => {
    const clubIds: [string, string, string, string] = [
      pot1[idx],
      pot2[idx],
      pot3[idx],
      pot4[idx],
    ];
    return {
      name,
      clubIds,
      standings: createEmptyStandings(clubIds),
      fixtures: createSuperMundialGroupFixtures(
        editionYear,
        name,
        clubIds,
        userClubId
      ),
    };
  });
}

function selectUniqueUpTo(
  priorityIds: string[],
  fallbackIds: string[],
  count: number
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const id of [...priorityIds, ...fallbackIds]) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    if (result.length >= count) break;
  }
  return result;
}

export function createInitialSuperMundial(params: {
  seasonYear: number;
  userClubId: string;
  clubsPool?: Club[];
  accumulatedUclChampions?: string[];
  accumulatedLibChampions?: string[];
  libertadoresQualifiedBrIds?: string[];
}): SuperMundialState {
  const {
    seasonYear,
    userClubId,
    clubsPool,
    accumulatedUclChampions = [],
    accumulatedLibChampions = [],
    libertadoresQualifiedBrIds = [],
  } = params;

  const worldClubs = clubsPool && clubsPool.length > 0 ? clubsPool : ALL_WORLD_CLUBS;
  const active = isSuperMundialYear(seasonYear);
  const nextEditionYear = getNextSuperMundialYear(seasonYear);

  const uclSorted = [...worldClubs]
    .filter((c) => c.division === 'UCL')
    .sort((a, b) => b.reputation - a.reputation)
    .map((c) => c.id);
  const uclFallback = uclSorted.length >= 6 ? uclSorted : UCL_CLUBS.map((c) => c.id);

  // 2026: 6 potências reais da Champions; anos seguintes: campeões acumulados + ranking UEFA
  const uefaQualifiedIds = selectUniqueUpTo(
    accumulatedUclChampions,
    uclFallback,
    6
  );

  // CONMEBOL: em 2026 usa os 4 campeões recentes do Brasil (Flamengo, Palmeiras, Fluminense, Botafogo)
  // + River Plate + Boca Juniors; em edições futuras usa campeões da Libertadores acumulados + ranking CONMEBOL
  const default2026Conmebol = [
    'flamengo',
    'palmeiras',
    'fluminense',
    'botafogo',
    'river-plate',
    'boca-juniors',
  ];
  const conmebolByRep = [...worldClubs]
    .filter((c) => c.division === 'A' || c.division === 'LIB')
    .sort((a, b) => b.reputation - a.reputation)
    .map((c) => c.id);

  const conmebolPriority =
    seasonYear === 2026 && accumulatedLibChampions.length === 0
      ? default2026Conmebol
      : [...accumulatedLibChampions, ...libertadoresQualifiedBrIds];

  const conmebolQualifiedIds = selectUniqueUpTo(
    conmebolPriority,
    conmebolByRep,
    6
  );

  const globalQualifiedIds = GLOBAL_WORLD_CLUBS.slice(0, 4).map((c) => c.id);

  const participantIds = active
    ? [...uefaQualifiedIds, ...conmebolQualifiedIds, ...globalQualifiedIds]
    : [];

  const groups = active
    ? buildSuperMundialGroups(
        seasonYear,
        uefaQualifiedIds,
        conmebolQualifiedIds,
        globalQualifiedIds,
        userClubId
      )
    : [];

  return {
    editionYear: active ? seasonYear : nextEditionYear,
    isActiveThisSeason: active,
    nextEditionYear,
    participantIds,
    uefaQualifiedIds,
    conmebolQualifiedIds,
    globalQualifiedIds,
    currentPhase: 'Grupos',
    groupRound: 1,
    groups,
    knockoutFixtures: {
      Quartas: [],
      Semifinal: [],
      Final: [],
    },
    eliminatedIds: [],
    runnerUpClubId: null,
    championClubId: null,
  };
}

/**
 * Chamado logo após a Final da UEFA Champions League (Junho) para garantir que
 * o Campeão Europeu e os semifinalistas/melhores da edição atual integrem
 * o Super Mundial antes da bola rolar na Fase de Grupos.
 */
export function syncSuperMundialWithChampionsResults(
  state: SuperMundialState,
  uclState: ChampionsLeagueState,
  clubs: Club[],
  userClubId: string
): SuperMundialState {
  if (!state.isActiveThisSeason) return state;

  // Se algum jogo do Super Mundial já foi disputado, não altera mais os grupos
  const alreadyStarted = state.groups.some((g) =>
    g.fixtures.some((f) => f.played)
  );
  if (alreadyStarted) return state;

  const uclFallback = [...clubs]
    .filter((c) => c.division === 'UCL')
    .sort((a, b) => b.reputation - a.reputation)
    .map((c) => c.id);

  const uefaPriority: string[] = [];
  if (uclState.championClubId) uefaPriority.push(uclState.championClubId);
  if (uclState.runnerUpClubId) uefaPriority.push(uclState.runnerUpClubId);
  uefaPriority.push(...uclState.semifinalistIds);
  uefaPriority.push(...uclState.quarterfinalistIds);

  const updatedUefaIds = selectUniqueUpTo(
    [...uefaPriority, ...state.uefaQualifiedIds],
    uclFallback,
    6
  );

  const updatedGroups = buildSuperMundialGroups(
    state.editionYear,
    updatedUefaIds,
    state.conmebolQualifiedIds,
    state.globalQualifiedIds,
    userClubId
  );

  return {
    ...state,
    uefaQualifiedIds: updatedUefaIds,
    participantIds: [
      ...updatedUefaIds,
      ...state.conmebolQualifiedIds,
      ...state.globalQualifiedIds,
    ],
    groups: updatedGroups,
  };
}

export function advanceSuperMundialGroupRound(
  state: SuperMundialState,
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
): SuperMundialState {
  if (!state.isActiveThisSeason || state.groups.length === 0) return state;

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

  if (roundNumber < 3) {
    return {
      ...state,
      groupRound: roundNumber + 1,
      groups: updatedGroups,
    };
  }

  // Fim da Fase de Grupos: Top 2 de cada grupo avançam às Quartas de Final
  const eliminatedFromGroups: string[] = [];
  const winners = new Map<SuperMundialGroupName, string>();
  const runnersUp = new Map<SuperMundialGroupName, string>();

  for (const grp of updatedGroups) {
    if (grp.standings[0]) winners.set(grp.name, grp.standings[0].clubId);
    if (grp.standings[1]) runnersUp.set(grp.name, grp.standings[1].clubId);
    if (grp.standings[2]) eliminatedFromGroups.push(grp.standings[2].clubId);
    if (grp.standings[3]) eliminatedFromGroups.push(grp.standings[3].clubId);
  }

  const pairs: Array<[SuperMundialGroupName, SuperMundialGroupName]> = [
    ['A', 'B'],
    ['C', 'D'],
    ['B', 'A'],
    ['D', 'C'],
  ];

  const quartas: RoundFixture[] = pairs.map(([wGrp, rGrp], idx) => {
    const homeClubId = winners.get(wGrp)!;
    const awayClubId = runnersUp.get(rGrp)!;
    return {
      id: `sm-${state.editionYear}-quartas-m${idx + 1}`,
      division: 'WORLD',
      competition: 'SUPER_MUNDIAL',
      stageLabel: 'Quartas',
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
    currentPhase: 'Quartas',
    groupRound: 3,
    groups: updatedGroups,
    knockoutFixtures: {
      ...state.knockoutFixtures,
      Quartas: quartas,
    },
    eliminatedIds: Array.from(
      new Set([...state.eliminatedIds, ...eliminatedFromGroups])
    ),
  };
}

export function advanceSuperMundialKnockoutStage(
  state: SuperMundialState,
  stage: SuperMundialKnockoutStage,
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
): SuperMundialState {
  if (!state.isActiveThisSeason) return state;
  const stageFixtures = state.knockoutFixtures[stage] || [];
  if (stageFixtures.length === 0) return state;
  if (stageFixtures.every((f) => f.played)) return state;

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

  const resolved = resolveKnockoutMatchList(simulated, clubs, rng);
  const winners: string[] = [];
  const losers: string[] = [];

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

  const stageIdx = SUPER_MUNDIAL_KNOCKOUT_STAGES.indexOf(stage);
  const nextStage = SUPER_MUNDIAL_KNOCKOUT_STAGES[stageIdx + 1];

  if (!nextStage) {
    return {
      ...state,
      knockoutFixtures: nextKnockoutFixtures,
      eliminatedIds: nextEliminated,
      championClubId: winners[0] || null,
      runnerUpClubId: losers[0] || null,
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
      id: `sm-${state.editionYear}-${nextStage.toLowerCase()}-m${i / 2 + 1}`,
      division: 'WORLD',
      competition: 'SUPER_MUNDIAL',
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
