import {
  CompetitionType,
  CopaDoBrasilState,
  LibertadoresState,
  LiveMatchState,
  MatchHistoryRecord,
  RoundFixture,
} from '../types/football';

export interface HeadToHeadMatchItem {
  id: string;
  seasonYear: number;
  dateLabel: string;
  competition: CompetitionType;
  competitionLabel: string;
  homeClubId: string;
  awayClubId: string;
  homeGoals: number;
  awayGoals: number;
  homePenalties?: number | null;
  awayPenalties?: number | null;
  isUserHome: boolean;
  userGoals: number;
  opponentGoals: number;
  outcome: 'V' | 'E' | 'D';
  decidedOnPenalties: boolean;
}

export interface HeadToHeadSummary {
  opponentClubId: string;
  totalMatches: number;
  userWins: number;
  draws: number;
  opponentWins: number;
  userGoalsFor: number;
  userGoalsAgainst: number;
  goalDifference: number;
  winRatePct: number;
  recentMatches: HeadToHeadMatchItem[];
}

export function createMatchHistoryRecordFromLiveMatch(params: {
  match: LiveMatchState;
  seasonYear: number;
  dateLabel: string;
  fallbackDivision?: 'A' | 'B';
}): MatchHistoryRecord {
  const { match, seasonYear, dateLabel, fallbackDivision = 'A' } = params;
  const comp: CompetitionType = match.competition || 'BRASILEIRAO';
  const compLabel =
    match.competitionLabel ||
    `Série ${fallbackDivision} · ${match.roundNumber}ª Rodada`;

  return {
    id: `mh-${seasonYear}-${match.fixtureId}`,
    fixtureId: match.fixtureId,
    seasonYear,
    dateLabel,
    competition: comp,
    competitionLabel: compLabel,
    roundNumber: match.roundNumber,
    homeClubId: match.homeClubId,
    awayClubId: match.awayClubId,
    homeGoals: match.homeGoals,
    awayGoals: match.awayGoals,
    homePenalties: match.homePenalties ?? null,
    awayPenalties: match.awayPenalties ?? null,
    winnerClubId: match.winnerClubId ?? null,
    isKnockout: Boolean(match.isKnockout),
  };
}

function formatFixtureCompetitionLabel(
  fix: RoundFixture,
  fallbackComp: CompetitionType
): string {
  const comp = fix.competition || fallbackComp;
  if (comp === 'COPA_DO_BRASIL') {
    return `Copa do Brasil · ${fix.stageLabel || `${fix.roundNumber}ª Fase`}`;
  }
  if (comp === 'LIBERTADORES') {
    if (fix.groupName) {
      return `Libertadores · Gr. ${fix.groupName} (${fix.roundNumber}ªR)`;
    }
    return `Libertadores · ${fix.stageLabel || `${fix.roundNumber}ª Fase`}`;
  }
  if (comp === 'CHAMPIONS_LEAGUE') {
    return `Champions League · ${fix.stageLabel || 'Mata-Mata'}`;
  }
  if (comp === 'MUNDIAL') {
    return `Mundial de Clubes · ${fix.stageLabel || 'Mata-Mata'}`;
  }
  if (comp === 'SUPER_MUNDIAL') {
    if (fix.groupName) {
      return `Super Mundial · Gr. ${fix.groupName} (${fix.roundNumber}ªR)`;
    }
    return `Super Mundial · ${fix.stageLabel || 'Mata-Mata'}`;
  }
  const divLabel = fix.division === 'B' ? 'Série B' : 'Série A';
  return `${divLabel} · ${fix.roundNumber}ª Rodada`;
}

function collectCurrentSeasonPlayedFixtures(params: {
  fixtures: RoundFixture[];
  copaDoBrasil?: CopaDoBrasilState;
  libertadores?: LibertadoresState;
  currentYear: number;
}): MatchHistoryRecord[] {
  const { fixtures, copaDoBrasil, libertadores, currentYear } = params;
  const collected: MatchHistoryRecord[] = [];

  for (const fix of fixtures) {
    if (!fix.played || fix.homeGoals === null || fix.awayGoals === null) continue;
    collected.push({
      id: `mh-${currentYear}-${fix.id}`,
      fixtureId: fix.id,
      seasonYear: currentYear,
      dateLabel: `Temporada ${currentYear}`,
      competition: fix.competition || 'BRASILEIRAO',
      competitionLabel: formatFixtureCompetitionLabel(fix, 'BRASILEIRAO'),
      roundNumber: fix.roundNumber,
      homeClubId: fix.homeClubId,
      awayClubId: fix.awayClubId,
      homeGoals: fix.homeGoals,
      awayGoals: fix.awayGoals,
      homePenalties: fix.homePenalties ?? null,
      awayPenalties: fix.awayPenalties ?? null,
      winnerClubId: fix.winnerClubId ?? null,
      isKnockout: false,
    });
  }

  if (copaDoBrasil) {
    for (const stageFixtures of Object.values(copaDoBrasil.fixturesByStage)) {
      for (const fix of stageFixtures) {
        if (!fix.played || fix.homeGoals === null || fix.awayGoals === null) continue;
        collected.push({
          id: `mh-${currentYear}-${fix.id}`,
          fixtureId: fix.id,
          seasonYear: currentYear,
          dateLabel: `Temporada ${currentYear}`,
          competition: 'COPA_DO_BRASIL',
          competitionLabel: formatFixtureCompetitionLabel(fix, 'COPA_DO_BRASIL'),
          roundNumber: fix.roundNumber,
          homeClubId: fix.homeClubId,
          awayClubId: fix.awayClubId,
          homeGoals: fix.homeGoals,
          awayGoals: fix.awayGoals,
          homePenalties: fix.homePenalties ?? null,
          awayPenalties: fix.awayPenalties ?? null,
          winnerClubId: fix.winnerClubId ?? null,
          isKnockout: true,
        });
      }
    }
  }

  if (libertadores) {
    for (const grp of libertadores.groups) {
      for (const fix of grp.fixtures) {
        if (!fix.played || fix.homeGoals === null || fix.awayGoals === null) continue;
        collected.push({
          id: `mh-${currentYear}-${fix.id}`,
          fixtureId: fix.id,
          seasonYear: currentYear,
          dateLabel: `Temporada ${currentYear}`,
          competition: 'LIBERTADORES',
          competitionLabel: formatFixtureCompetitionLabel(fix, 'LIBERTADORES'),
          roundNumber: fix.roundNumber,
          homeClubId: fix.homeClubId,
          awayClubId: fix.awayClubId,
          homeGoals: fix.homeGoals,
          awayGoals: fix.awayGoals,
          homePenalties: fix.homePenalties ?? null,
          awayPenalties: fix.awayPenalties ?? null,
          winnerClubId: fix.winnerClubId ?? null,
          isKnockout: false,
        });
      }
    }
    for (const stageFixtures of Object.values(libertadores.knockoutFixtures)) {
      for (const fix of stageFixtures) {
        if (!fix.played || fix.homeGoals === null || fix.awayGoals === null) continue;
        collected.push({
          id: `mh-${currentYear}-${fix.id}`,
          fixtureId: fix.id,
          seasonYear: currentYear,
          dateLabel: `Temporada ${currentYear}`,
          competition: 'LIBERTADORES',
          competitionLabel: formatFixtureCompetitionLabel(fix, 'LIBERTADORES'),
          roundNumber: fix.roundNumber,
          homeClubId: fix.homeClubId,
          awayClubId: fix.awayClubId,
          homeGoals: fix.homeGoals,
          awayGoals: fix.awayGoals,
          homePenalties: fix.homePenalties ?? null,
          awayPenalties: fix.awayPenalties ?? null,
          winnerClubId: fix.winnerClubId ?? null,
          isKnockout: true,
        });
      }
    }
  }

  return collected;
}

export function getHeadToHeadSummary(params: {
  userClubId: string;
  opponentClubId: string;
  matchHistory?: MatchHistoryRecord[];
  fixtures?: RoundFixture[];
  copaDoBrasil?: CopaDoBrasilState;
  libertadores?: LibertadoresState;
  currentYear?: number;
}): HeadToHeadSummary {
  const {
    userClubId,
    opponentClubId,
    matchHistory = [],
    fixtures = [],
    copaDoBrasil,
    libertadores,
    currentYear = 2026,
  } = params;

  const isBetweenPair = (rec: MatchHistoryRecord) =>
    (rec.homeClubId === userClubId && rec.awayClubId === opponentClubId) ||
    (rec.homeClubId === opponentClubId && rec.awayClubId === userClubId);

  const deduped = new Map<string, MatchHistoryRecord>();

  // 1. Add persisted match history (most recent first in array)
  for (const rec of matchHistory) {
    if (!isBetweenPair(rec)) continue;
    const key = `${rec.seasonYear}:${rec.fixtureId}`;
    if (!deduped.has(key)) {
      deduped.set(key, rec);
    }
  }

  // 2. Supplement with any played fixtures from current season (handles pre-existing saves)
  const seasonPlayed = collectCurrentSeasonPlayedFixtures({
    fixtures,
    copaDoBrasil,
    libertadores,
    currentYear,
  });
  for (const rec of seasonPlayed) {
    if (!isBetweenPair(rec)) continue;
    const key = `${rec.seasonYear}:${rec.fixtureId}`;
    if (!deduped.has(key)) {
      deduped.set(key, rec);
    }
  }

  const allRecords = Array.from(deduped.values()).sort((a, b) => {
    if (b.seasonYear !== a.seasonYear) return b.seasonYear - a.seasonYear;
    const orderA =
      a.competition === 'BRASILEIRAO'
        ? a.roundNumber * 2
        : a.roundNumber * 2 + 1;
    const orderB =
      b.competition === 'BRASILEIRAO'
        ? b.roundNumber * 2
        : b.roundNumber * 2 + 1;
    return orderB - orderA;
  });

  let userWins = 0;
  let draws = 0;
  let opponentWins = 0;
  let userGoalsFor = 0;
  let userGoalsAgainst = 0;

  const recentMatches: HeadToHeadMatchItem[] = allRecords.map((rec) => {
    const isUserHome = rec.homeClubId === userClubId;
    const userGoals = isUserHome ? rec.homeGoals : rec.awayGoals;
    const opponentGoals = isUserHome ? rec.awayGoals : rec.homeGoals;

    userGoalsFor += userGoals;
    userGoalsAgainst += opponentGoals;

    const decidedOnPenalties =
      rec.homePenalties !== null &&
      rec.homePenalties !== undefined &&
      rec.awayPenalties !== null &&
      rec.awayPenalties !== undefined;

    let outcome: 'V' | 'E' | 'D';
    if (userGoals > opponentGoals) {
      outcome = 'V';
      userWins += 1;
    } else if (userGoals < opponentGoals) {
      outcome = 'D';
      opponentWins += 1;
    } else if (decidedOnPenalties && rec.winnerClubId) {
      if (rec.winnerClubId === userClubId) {
        outcome = 'V';
        userWins += 1;
      } else {
        outcome = 'D';
        opponentWins += 1;
      }
    } else {
      outcome = 'E';
      draws += 1;
    }

    return {
      id: rec.id,
      seasonYear: rec.seasonYear,
      dateLabel: rec.dateLabel,
      competition: rec.competition,
      competitionLabel: rec.competitionLabel,
      homeClubId: rec.homeClubId,
      awayClubId: rec.awayClubId,
      homeGoals: rec.homeGoals,
      awayGoals: rec.awayGoals,
      homePenalties: rec.homePenalties ?? null,
      awayPenalties: rec.awayPenalties ?? null,
      isUserHome,
      userGoals,
      opponentGoals,
      outcome,
      decidedOnPenalties,
    };
  });

  const totalMatches = recentMatches.length;
  const winRatePct =
    totalMatches > 0
      ? Math.round(((userWins * 3 + draws) / (totalMatches * 3)) * 100)
      : 0;

  return {
    opponentClubId,
    totalMatches,
    userWins,
    draws,
    opponentWins,
    userGoalsFor,
    userGoalsAgainst,
    goalDifference: userGoalsFor - userGoalsAgainst,
    winRatePct,
    recentMatches,
  };
}
