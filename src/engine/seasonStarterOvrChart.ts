import {
  LiveMatchState,
  MatchHistoryRecord,
  Player,
  PlayerEvolutionReportItem,
  SeasonStarterOvrPoint,
} from '../types/football';
import { calculatePlayerOverall } from './matchEngine';

const MONTH_META: Record<string, { order: number; fullName: string }> = {
  Jan: { order: 1, fullName: 'Janeiro' },
  Fev: { order: 2, fullName: 'Fevereiro' },
  Mar: { order: 3, fullName: 'Março' },
  Abr: { order: 4, fullName: 'Abril' },
  Mai: { order: 5, fullName: 'Maio' },
  Jun: { order: 6, fullName: 'Junho' },
  Jul: { order: 7, fullName: 'Julho' },
  Ago: { order: 8, fullName: 'Agosto' },
  Set: { order: 9, fullName: 'Setembro' },
  Out: { order: 10, fullName: 'Outubro' },
  Nov: { order: 11, fullName: 'Novembro' },
  Dez: { order: 12, fullName: 'Dezembro' },
};

export interface StarterMatchSnapshotMetrics {
  userStarterAvgOvr: number;
  userStarterAvgRating: number;
  userMatchAvgRating?: number;
}

export interface StarterOvrChartSummary {
  startOvr: number;
  endOvr: number;
  netDeltaOvr: number;
  peakOvr: number;
  peakLabel: string;
  overallAvgRating: number;
  totalMatches: number;
}

function round1(value: number): number {
  return Number(value.toFixed(1));
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Selects the 11 starting XI players (falling back to highest-OVR players if fewer than 11 are marked starters).
 */
export function getStartingEleven(squad: Player[]): Player[] {
  const starters = squad
    .filter((p) => p.isStarter)
    .sort((a, b) => (a.slotIndex ?? 99) - (b.slotIndex ?? 99));

  if (starters.length >= 11) {
    return starters.slice(0, 11);
  }

  const starterIds = new Set(starters.map((p) => p.id));
  const benchSorted = squad
    .filter((p) => !starterIds.has(p.id))
    .sort(
      (a, b) =>
        calculatePlayerOverall(b.attributes, b.position) -
        calculatePlayerOverall(a.attributes, a.position)
    );

  return [...starters, ...benchSorted].slice(0, Math.min(11, squad.length));
}

/**
 * Computes starting XI average OVR, cumulative player average rating, and optional live match rating.
 */
export function computeStarterMetrics(
  squad: Player[],
  match?: LiveMatchState,
  userClubId?: string
): StarterMatchSnapshotMetrics {
  const xi = getStartingEleven(squad);
  if (xi.length === 0) {
    return {
      userStarterAvgOvr: 0,
      userStarterAvgRating: 6.5,
    };
  }

  const ovrSum = xi.reduce(
    (acc, p) => acc + calculatePlayerOverall(p.attributes, p.position),
    0
  );
  const userStarterAvgOvr = round1(ovrSum / xi.length);

  const ratedStarters = xi.filter(
    (p) => (p.seasonStats?.matches ?? 0) > 0 && (p.seasonStats?.avgRating ?? 0) > 0
  );
  const ratingPool =
    ratedStarters.length > 0
      ? ratedStarters.map((p) => p.seasonStats.avgRating)
      : xi.map((p) => (p.seasonStats?.avgRating > 0 ? p.seasonStats.avgRating : 6.5));
  const userStarterAvgRating = round2(
    ratingPool.reduce((acc, r) => acc + r, 0) / Math.max(1, ratingPool.length)
  );

  let userMatchAvgRating: number | undefined;
  if (match && userClubId) {
    const isHome = match.homeClubId === userClubId;
    const isAway = match.awayClubId === userClubId;
    if (isHome || isAway) {
      const tokens = isHome ? match.homeTokens : match.awayTokens;
      if (tokens && tokens.length > 0) {
        const tokenSum = tokens.reduce((acc, t) => acc + (t.rating ?? 6.5), 0);
        userMatchAvgRating = round2(tokenSum / tokens.length);
      }
    }
  }

  return {
    userStarterAvgOvr,
    userStarterAvgRating,
    userMatchAvgRating,
  };
}

function extractMonthToken(dateLabel: string): string | null {
  for (const key of Object.keys(MONTH_META)) {
    const regex = new RegExp(`\\b${key}\\b`, 'i');
    if (regex.test(dateLabel)) {
      return key;
    }
  }
  return null;
}

function estimateMatchRatingFromOutcome(
  rec: MatchHistoryRecord,
  userClubId: string,
  squadBaselineRating: number
): number {
  const isHome = rec.homeClubId === userClubId;
  const userGoals = isHome ? rec.homeGoals : rec.awayGoals;
  const oppGoals = isHome ? rec.awayGoals : rec.homeGoals;
  const gd = userGoals - oppGoals;
  const outcomeDelta =
    gd > 0
      ? Math.min(0.55, 0.16 + gd * 0.11)
      : gd < 0
      ? Math.max(-0.55, -0.16 + gd * 0.11)
      : -0.02;
  return round2(clamp(squadBaselineRating + outcomeDelta, 5.6, 8.6));
}

/**
 * Builds the chronological bar-chart series comparing the evolution of the starting XI's
 * average OVR across the season, driven by the players' average rating history.
 */
export function buildStarterOvrEvolutionSeries(params: {
  seasonYear: number;
  userClubId: string;
  userSquad: Player[];
  matchHistory?: MatchHistoryRecord[];
  userEvolutionHighlights?: PlayerEvolutionReportItem[];
}): SeasonStarterOvrPoint[] {
  const {
    seasonYear,
    userClubId,
    userSquad,
    matchHistory = [],
    userEvolutionHighlights = [],
  } = params;

  const currentMetrics = computeStarterMetrics(userSquad);
  if (currentMetrics.userStarterAvgOvr <= 0) {
    return [];
  }

  // Match history is stored newest-first; reverse into chronological order for the current season
  const seasonMatches = matchHistory
    .filter(
      (m) =>
        m.seasonYear === seasonYear &&
        (m.homeClubId === userClubId || m.awayClubId === userClubId)
    )
    .slice()
    .reverse();

  // Fallback when no match history records exist yet for this season
  if (seasonMatches.length === 0) {
    const xi = getStartingEleven(userSquad);
    const evoById = new Map(userEvolutionHighlights.map((e) => [e.playerId, e]));
    const hasEvo = xi.some((p) => evoById.has(p.id));
    const startOvr = hasEvo
      ? round1(
          xi.reduce((acc, p) => {
            const evo = evoById.get(p.id);
            const cur = calculatePlayerOverall(p.attributes, p.position);
            return acc + (evo ? evo.oldOvr : cur);
          }, 0) / Math.max(1, xi.length)
        )
      : currentMetrics.userStarterAvgOvr;

    const endOvr = currentMetrics.userStarterAvgOvr;
    const avgRating = currentMetrics.userStarterAvgRating;
    const ratingShift = round1(clamp((avgRating - 6.75) * 0.75, -0.6, 0.9));
    const midOvr = round1((startOvr + endOvr) / 2 + ratingShift * 0.25);

    const points: SeasonStarterOvrPoint[] = [
      {
        id: `ovr-${seasonYear}-start`,
        label: 'Início',
        periodTitle: `Pré-Temporada ${seasonYear}`,
        starterAvgOvr: startOvr,
        avgRating: round2(clamp(avgRating - 0.12, 6.0, 8.2)),
        deltaOvr: 0,
        matchesCount: 0,
      },
      {
        id: `ovr-${seasonYear}-mid`,
        label: 'Meio',
        periodTitle: `Meio da Temporada ${seasonYear}`,
        starterAvgOvr: midOvr,
        avgRating: round2(clamp(avgRating - 0.04, 6.0, 8.4)),
        deltaOvr: round1(midOvr - startOvr),
        matchesCount: 0,
      },
      {
        id: `ovr-${seasonYear}-end`,
        label: 'Final',
        periodTitle: `Encerramento ${seasonYear}`,
        starterAvgOvr: endOvr,
        avgRating,
        deltaOvr: round1(endOvr - startOvr),
        matchesCount: 0,
      },
    ];
    return points;
  }

  // Group chronologically by month token extracted from dateLabel (fallback to sequential blocks)
  interface MonthBucket {
    key: string;
    label: string;
    fullName: string;
    matches: MatchHistoryRecord[];
  }

  const buckets: MonthBucket[] = [];
  const bucketIndexByKey = new Map<string, number>();

  seasonMatches.forEach((rec, idx) => {
    const monthToken = extractMonthToken(rec.dateLabel);
    const key = monthToken ?? `B${Math.floor(idx / Math.max(1, Math.ceil(seasonMatches.length / 6))) + 1}`;
    const label = monthToken ?? `Fase ${Math.floor(idx / Math.max(1, Math.ceil(seasonMatches.length / 6))) + 1}`;
    const fullName = monthToken ? MONTH_META[monthToken].fullName : label;

    const existingIdx = bucketIndexByKey.get(key);
    if (existingIdx !== undefined) {
      buckets[existingIdx].matches.push(rec);
    } else {
      bucketIndexByKey.set(key, buckets.length);
      buckets.push({ key, label, fullName, matches: [rec] });
    }
  });

  const hasRecordedOvrSnapshots = seasonMatches.some(
    (m) => typeof m.userStarterAvgOvr === 'number' && m.userStarterAvgOvr > 0
  );

  // Estimate starting baseline OVR when reconstructing legacy saves without recorded snapshots
  const xi = getStartingEleven(userSquad);
  const evoById = new Map(userEvolutionHighlights.map((e) => [e.playerId, e]));
  const totalRatingSurplus = currentMetrics.userStarterAvgRating - 6.72;
  const estimatedLegacyStartOvr = xi.some((p) => evoById.has(p.id))
    ? round1(
        xi.reduce((acc, p) => {
          const evo = evoById.get(p.id);
          const cur = calculatePlayerOverall(p.attributes, p.position);
          return acc + (evo ? evo.oldOvr : cur);
        }, 0) / Math.max(1, xi.length)
      )
    : round1(
        clamp(
          currentMetrics.userStarterAvgOvr - clamp(totalRatingSurplus * 2.2, -1.6, 2.2),
          55,
          95
        )
      );

  const rawPoints = buckets.map((bucket, idx) => {
    const matchRatings = bucket.matches.map((m) => {
      if (typeof m.userStarterAvgRating === 'number' && m.userStarterAvgRating > 0) {
        if (typeof m.userMatchAvgRating === 'number' && m.userMatchAvgRating > 0) {
          // Blend cumulative starter rating history with period match rating
          return round2(m.userStarterAvgRating * 0.55 + m.userMatchAvgRating * 0.45);
        }
        return m.userStarterAvgRating;
      }
      if (typeof m.userMatchAvgRating === 'number' && m.userMatchAvgRating > 0) {
        return m.userMatchAvgRating;
      }
      return estimateMatchRatingFromOutcome(
        m,
        userClubId,
        currentMetrics.userStarterAvgRating
      );
    });

    const periodAvgRating = round2(
      matchRatings.reduce((acc, r) => acc + r, 0) / Math.max(1, matchRatings.length)
    );

    const recordedOvrs = bucket.matches
      .map((m) => m.userStarterAvgOvr)
      .filter((v): v is number => typeof v === 'number' && v > 0);

    let starterAvgOvr: number;
    if (recordedOvrs.length > 0) {
      // Combine the real end-of-period starting XI OVR with rating-history momentum
      const recordedMean =
        recordedOvrs.reduce((acc, v) => acc + v, 0) / recordedOvrs.length;
      const latestInPeriod = recordedOvrs[recordedOvrs.length - 1];
      starterAvgOvr = round1(recordedMean * 0.4 + latestInPeriod * 0.6);
    } else if (!hasRecordedOvrSnapshots) {
      const progress = buckets.length > 1 ? idx / (buckets.length - 1) : 1;
      const baseInterpolated =
        estimatedLegacyStartOvr +
        (currentMetrics.userStarterAvgOvr - estimatedLegacyStartOvr) * progress;
      const ratingMod = clamp((periodAvgRating - 6.75) * 0.55, -0.5, 0.7);
      starterAvgOvr = round1(
        idx === buckets.length - 1
          ? currentMetrics.userStarterAvgOvr
          : clamp(baseInterpolated + ratingMod * (1 - progress * 0.35), 55, 96)
      );
    } else {
      starterAvgOvr = currentMetrics.userStarterAvgOvr;
    }

    const matchesLabel =
      bucket.matches.length === 1 ? '1 jogo' : `${bucket.matches.length} jogos`;

    return {
      id: `ovr-${seasonYear}-${bucket.key}-${idx}`,
      label: bucket.label,
      periodTitle: `${bucket.fullName} · ${matchesLabel}`,
      starterAvgOvr,
      avgRating: periodAvgRating,
      deltaOvr: 0,
      matchesCount: bucket.matches.length,
    };
  });

  // Ensure the final period aligns accurately with the final starting XI average OVR
  if (rawPoints.length > 0) {
    const lastIdx = rawPoints.length - 1;
    const lastRec = buckets[lastIdx].matches[buckets[lastIdx].matches.length - 1];
    if (typeof lastRec.userStarterAvgOvr !== 'number') {
      rawPoints[lastIdx].starterAvgOvr = currentMetrics.userStarterAvgOvr;
    }
  }

  const firstOvr = rawPoints[0]?.starterAvgOvr ?? currentMetrics.userStarterAvgOvr;

  return rawPoints.map((pt) => ({
    ...pt,
    deltaOvr: round1(pt.starterAvgOvr - firstOvr),
  }));
}

export function computeStarterOvrChartSummary(
  points: SeasonStarterOvrPoint[]
): StarterOvrChartSummary | null {
  if (points.length === 0) return null;

  const startOvr = points[0].starterAvgOvr;
  const endOvr = points[points.length - 1].starterAvgOvr;
  const netDeltaOvr = round1(endOvr - startOvr);

  let peakPoint = points[0];
  let totalMatches = 0;
  let weightedRatingSum = 0;

  for (const pt of points) {
    if (pt.starterAvgOvr >= peakPoint.starterAvgOvr) {
      peakPoint = pt;
    }
    const weight = Math.max(1, pt.matchesCount);
    totalMatches += pt.matchesCount;
    weightedRatingSum += pt.avgRating * weight;
  }

  const totalWeight = points.reduce((acc, pt) => acc + Math.max(1, pt.matchesCount), 0);
  const overallAvgRating = round2(weightedRatingSum / Math.max(1, totalWeight));

  return {
    startOvr,
    endOvr,
    netDeltaOvr,
    peakOvr: peakPoint.starterAvgOvr,
    peakLabel: peakPoint.label,
    overallAvgRating,
    totalMatches,
  };
}
