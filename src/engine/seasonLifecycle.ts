import {
  generateLeagueSchedule,
  getInitialStandingsForDivision,
  getPlayableDivisionForClub,
  getPlayableLeagueShortLabel,
  getSecondaryPlayableDivision,
  isEuropeanPlayableDivision,
} from '../data/initialDatabase';
import {
  createInitialChampionsLeague,
  createInitialCopaDoBrasil,
  createInitialLibertadores,
  createInitialMundial,
  createInitialSuperMundial,
  isSuperMundialYear,
} from '../data/cupFactory';
import { calculatePlayerOverall } from './playerOverall';
import {
  applyInjuryToPlayer,
  advanceSquadRecoveryByDays,
  ensureHealthyStartingLineup,
  evaluatePlayerInjuryRisk,
  pickWeightedInjury,
} from './injuryEngine';
import {
  applyAntiInflationSeasonMaintenance,
  applyPostMatchProbabilisticEvolution,
  calculateDynamicSponsorship,
  calculateOperationalCost,
  evaluatePlayerRetirementProbability,
  processSeasonEvolutionAndAging,
} from './economyAndEvolution';
import { generateYouthRegens } from './youthAcademyEngine';
import {
  getRenewalEligiblePlayers,
  processSeasonEndContracts,
} from './contractEngine';
import { createInitialMatchState } from './matchEngine';
import { buildStarterOvrEvolutionSeries } from './seasonStarterOvrChart';
import { formatCompactBRL } from '../utils/formatters';
import {
  ChampionsLeagueState,
  Club,
  ClubFinanceLedger,
  CopaDoBrasilState,
  InboxMessage,
  LibertadoresState,
  LiveMatchState,
  MatchHistoryRecord,
  MundialState,
  NewSeasonEvolutionReport,
  PlayableDivision,
  Player,
  PlayerEvolutionReportItem,
  RoundFixture,
  SeasonArchiveEntry,
  SeasonAwardPlayer,
  SeasonAwardsSummary,
  SeasonEndReport,
  StandingsRow,
  SuperMundialState,
} from '../types/football';

/**
 * Credits simulated match appearances, goals, assists, and ratings to AI clubs' players
 * after any round or cup stage completes so league awards & evolution reflect true stats.
 */
export function attributeAiRoundPlayerStats(
  aiSquads: Record<string, Player[]>,
  completedFixtures: RoundFixture[],
  userClubId: string,
  rng: () => number = Math.random
): Record<string, Player[]> {
  if (!aiSquads || completedFixtures.length === 0) return aiSquads;

  const updated: Record<string, Player[]> = { ...aiSquads };

  const applyTeamMatchStats = (
    clubId: string,
    goalsScored: number,
    goalsConceded: number
  ) => {
    if (clubId === userClubId) return;
    const roster = updated[clubId];
    if (!roster || roster.length === 0) return;

    // Advance AI squad recovery (~5 days between rounds) & ensure injured players are rotated out
    const { updatedSquad: recoveredRoster } = advanceSquadRecoveryByDays(roster, 5);
    const { updatedSquad: healthyRoster } = ensureHealthyStartingLineup(recoveredRoster);

    // Pick 11 healthy/freshest starters (AI rotates heavily fatigued players <70% when fresh option exists)
    const healthyPlayers = healthyRoster.filter((p) => !p.injured);
    const poolForXI = healthyPlayers.length >= 11 ? healthyPlayers : healthyRoster;
    const starters = [...poolForXI]
      .sort((a, b) => {
        const aStarterBonus = a.isStarter ? 4 : 0;
        const bStarterBonus = b.isStarter ? 4 : 0;
        const aFatiguePen = a.condition < 70 ? -14 : a.condition < 78 ? -5 : 0;
        const bFatiguePen = b.condition < 70 ? -14 : b.condition < 78 ? -5 : 0;
        return (
          calculatePlayerOverall(b.attributes, b.position) +
          bStarterBonus +
          bFatiguePen -
          (calculatePlayerOverall(a.attributes, a.position) +
            aStarterBonus +
            aFatiguePen)
        );
      })
      .slice(0, 11);
    const activeSet =
      starters.length >= 11 ? starters : healthyRoster.slice(0, Math.min(11, healthyRoster.length));
    const bench = healthyRoster
      .filter((p) => !p.injured && !activeSet.some((a) => a.id === p.id))
      .slice(0, 3);
    const participants = [...activeSet, ...bench];
    const starterIds = new Set(activeSet.map((p) => p.id));
    const participantIds = new Set(participants.map((p) => p.id));

    // Distribute goals weighted towards attackers/midfielders
    const goalScorerIds: string[] = [];
    const assistIds: string[] = [];

    const attackingPool = activeSet.filter(
      (p) => p.position !== 'GOL'
    );

    for (let g = 0; g < goalsScored; g++) {
      if (attackingPool.length === 0) break;
      const weights = attackingPool.map((p) => {
        const posW =
          p.position === 'ATA'
            ? 5.0
            : p.position === 'PD' || p.position === 'PE' || p.position === 'MEI'
            ? 3.2
            : p.position === 'MC'
            ? 1.6
            : p.position === 'VOL' || p.position === 'LD' || p.position === 'LE'
            ? 0.9
            : 0.5;
        return posW * (0.7 + p.attributes.finalizacao * 0.05);
      });
      const totalW = weights.reduce((a, b) => a + b, 0);
      let roll = rng() * totalW;
      let scorer = attackingPool[0];
      for (let i = 0; i < attackingPool.length; i++) {
        roll -= weights[i];
        if (roll <= 0) {
          scorer = attackingPool[i];
          break;
        }
      }
      goalScorerIds.push(scorer.id);

      // Assist (80% chance)
      if (rng() < 0.8 && attackingPool.length > 1) {
        const assistPool = attackingPool.filter((p) => p.id !== scorer.id);
        const aWeights = assistPool.map((p) => {
          const posW =
            p.position === 'MEI' || p.position === 'PD' || p.position === 'PE'
              ? 3.8
              : p.position === 'MC' || p.position === 'LD' || p.position === 'LE'
              ? 2.8
              : p.position === 'ATA'
              ? 1.6
              : 0.9;
          return posW * (0.7 + p.attributes.visaoDeJogo * 0.05);
        });
        const totalAW = aWeights.reduce((a, b) => a + b, 0);
        let aRoll = rng() * totalAW;
        let assister = assistPool[0];
        for (let i = 0; i < assistPool.length; i++) {
          aRoll -= aWeights[i];
          if (aRoll <= 0) {
            assister = assistPool[i];
            break;
          }
        }
        assistIds.push(assister.id);
      }
    }

    const resultBonus =
      goalsScored > goalsConceded ? 0.38 : goalsScored === goalsConceded ? 0.05 : -0.28;
    const cleanSheetBonus = goalsConceded === 0 ? 0.35 : -Math.min(0.45, goalsConceded * 0.14);

    let aiTeamInjuriesThisMatch = 0;

    const afterMatchRoster = healthyRoster.map((p) => {
      if (!participantIds.has(p.id)) {
        // Rested AI player recovers extra freshness & resets consecutive match streak
        return p.injured
          ? p
          : {
              ...p,
              condition: Math.min(99, p.condition + 6),
              consecutiveMatches: 0,
            };
      }
      const gCount = goalScorerIds.filter((id) => id === p.id).length;
      const aCount = assistIds.filter((id) => id === p.id).length;
      const ovr = calculatePlayerOverall(p.attributes, p.position);
      const isFullMatch = starterIds.has(p.id);
      const fatigueDrain =
        p.sector === 'GOL' ? 6 : isFullMatch ? Math.round(19 + rng() * 8) : Math.round(8 + rng() * 5);
      const nextCond = Math.max(38, p.condition - fatigueDrain);
      const nextStreak = isFullMatch ? (p.consecutiveMatches ?? 0) + 1 : p.consecutiveMatches ?? 0;

      const baseMatchRating =
        6.55 +
        (ovr - 74) * 0.025 +
        resultBonus +
        (p.sector === 'GOL' || p.sector === 'DEF' ? cleanSheetBonus : 0) +
        gCount * 0.65 +
        aCount * 0.4 +
        (p.condition < 70 ? -0.45 : 0) +
        (rng() - 0.5) * 0.45;
      const clampedRating = Math.max(5.2, Math.min(9.6, baseMatchRating));

      const prevM = p.seasonStats.matches;
      const nextM = prevM + 1;
      const nextAvg = Number(
        ((p.seasonStats.avgRating * prevM + clampedRating) / nextM).toFixed(2)
      );

      let updatedPlayer: Player = {
        ...p,
        condition: nextCond,
        consecutiveMatches: nextStreak,
        seasonStats: {
          ...p.seasonStats,
          matches: nextM,
          goals: p.seasonStats.goals + gCount,
          assists: p.seasonStats.assists + aCount,
          avgRating: nextAvg,
        },
      };

      // Roll AI match injury based on workload & condition (cap 1 per AI match)
      if (aiTeamInjuriesThisMatch < 1 && !updatedPlayer.injured) {
        const risk = evaluatePlayerInjuryRisk(updatedPlayer, nextCond);
        if (rng() < (risk.riskPctPerMatch / 100) * (isFullMatch ? 0.9 : 0.35)) {
          aiTeamInjuriesThisMatch += 1;
          const rolled = pickWeightedInjury(nextCond < 74 || nextStreak >= 3, rng);
          updatedPlayer = applyInjuryToPlayer(updatedPlayer, rolled);
        }
      }

      return applyPostMatchProbabilisticEvolution({
        player: updatedPlayer,
        matchRating: clampedRating,
        goals: gCount,
        assists: aCount,
        clubReputation: Math.min(95, Math.max(66, Math.round(ovr))),
        division: 'A',
        rng,
      });
    });

    updated[clubId] = ensureHealthyStartingLineup(afterMatchRoster).updatedSquad;
  };

  for (const fix of completedFixtures) {
    if (!fix.played || fix.homeGoals === null || fix.awayGoals === null) continue;
    applyTeamMatchStats(fix.homeClubId, fix.homeGoals, fix.awayGoals);
    applyTeamMatchStats(fix.awayClubId, fix.awayGoals, fix.homeGoals);
  }

  return updated;
}

export function buildSeasonAwardsSummary(params: {
  clubs: Club[];
  userClubId: string;
  userSquad: Player[];
  aiSquads: Record<string, Player[]>;
}): SeasonAwardsSummary {
  const { clubs, userClubId, userSquad, aiSquads } = params;
  const clubMap = new Map(clubs.map((c) => [c.id, c]));

  const entries: Array<{ player: Player; club: Club; ovr: number }> = [];

  const userClub = clubMap.get(userClubId);
  const userPlayableDiv = userClub ? getPlayableDivisionForClub(userClub) : 'A';
  const userIsEuro = isEuropeanPlayableDivision(userPlayableDiv);

  if (userClub) {
    for (const p of userSquad) {
      entries.push({
        player: p,
        club: userClub,
        ovr: calculatePlayerOverall(p.attributes, p.position),
      });
    }
  }

  for (const [cid, list] of Object.entries(aiSquads)) {
    const c = clubMap.get(cid);
    if (!c) continue;
    if (userIsEuro) {
      if (getPlayableDivisionForClub(c) !== userPlayableDiv) continue;
    } else if (
      c.division === 'LIB' ||
      c.division === 'UCL' ||
      c.division === 'PL' ||
      c.division === 'LALIGA' ||
      c.division === 'BUNDESLIGA' ||
      c.division === 'SERIE_A_IT' ||
      c.division === 'WORLD'
    ) {
      continue;
    }
    for (const p of list) {
      entries.push({
        player: p,
        club: c,
        ovr: calculatePlayerOverall(p.attributes, p.position),
      });
    }
  }

  if (entries.length === 0) {
    return { topScorer: null, topAssist: null, bestPlayer: null };
  }

  const toAward = (
    item: { player: Player; club: Club; ovr: number },
    value: number
  ): SeasonAwardPlayer => ({
    playerId: item.player.id,
    playerName: item.player.name,
    clubId: item.club.id,
    clubName: item.club.shortName,
    position: item.player.position,
    ovr: item.ovr,
    value,
  });

  const topScorerEntry = [...entries].sort(
    (a, b) =>
      b.player.seasonStats.goals - a.player.seasonStats.goals ||
      b.player.seasonStats.avgRating - a.player.seasonStats.avgRating
  )[0];

  const topAssistEntry = [...entries].sort(
    (a, b) =>
      b.player.seasonStats.assists - a.player.seasonStats.assists ||
      b.player.seasonStats.avgRating - a.player.seasonStats.avgRating
  )[0];

  const qualifiedForMvp = entries.filter((e) => e.player.seasonStats.matches >= 12);
  const mvpPool = qualifiedForMvp.length > 0 ? qualifiedForMvp : entries;
  const bestEntry = [...mvpPool].sort(
    (a, b) =>
      b.player.seasonStats.avgRating - a.player.seasonStats.avgRating ||
      b.ovr - a.ovr
  )[0];

  return {
    topScorer: topScorerEntry
      ? toAward(topScorerEntry, topScorerEntry.player.seasonStats.goals)
      : null,
    topAssist: topAssistEntry
      ? toAward(topAssistEntry, topAssistEntry.player.seasonStats.assists)
      : null,
    bestPlayer: bestEntry
      ? toAward(bestEntry, bestEntry.player.seasonStats.avgRating)
      : null,
  };
}

/**
 * Premiação oficial por colocação final do Brasileirão Série A (em Reais):
 * 1º: R$ 48,1M · 2º: R$ 45,7M · 3º: R$ 43,4M · 4º: R$ 40,9M
 * Caindo progressivamente até R$ 16,3M no 16º lugar.
 * 17º ao 20º (rebaixados): R$ 0 de bônus por colocação/desempenho.
 */
export const SERIE_A_END_PRIZES: ReadonlyArray<number> = [
  48_100_000, // 1º
  45_700_000, // 2º
  43_400_000, // 3º
  40_900_000, // 4º
  38_500_000, // 5º
  36_100_000, // 6º
  33_700_000, // 7º
  31_300_000, // 8º
  28_800_000, // 9º
  26_400_000, // 10º
  24_000_000, // 11º
  21_600_000, // 12º
  19_900_000, // 13º
  18_700_000, // 14º
  17_500_000, // 15º
  16_300_000, // 16º
  0, // 17º (rebaixado)
  0, // 18º (rebaixado)
  0, // 19º (rebaixado)
  0, // 20º (rebaixado)
];

/**
 * Premiação por colocação final nas ligas jogáveis (em Reais):
 * - Série A: R$ 48,1M (1º) até R$ 16,3M (16º); 17º–20º = R$ 0.
 * - Série B: R$ 3,5M (1º), R$ 1,35M (2º–4º), R$ 1M (5º–20º).
 * - Premier League: R$ 320M (1º) descendo progressivamente até R$ 95M (20º).
 * - La Liga: R$ 240M (1º) descendo progressivamente até R$ 55M (20º).
 */
export function getLeagueEndPrizeMoney(
  division: PlayableDivision,
  rank: number
): number {
  const safeRank = Math.max(1, Math.min(20, Math.round(rank)));
  if (division === 'A') {
    return SERIE_A_END_PRIZES[safeRank - 1] ?? 0;
  }
  if (division === 'B') {
    if (safeRank === 1) return 3_500_000;
    if (safeRank <= 4) return 1_350_000;
    return 1_000_000;
  }
  if (division === 'PL') {
    const raw = 320_000_000 - (safeRank - 1) * 11_800_000;
    return Math.max(95_000_000, Math.round(raw / 100_000) * 100_000);
  }
  if (division === 'BUNDESLIGA') {
    const clampedBuLiRank = Math.max(1, Math.min(18, Math.round(rank)));
    const raw = 230_000_000 - (clampedBuLiRank - 1) * 9_700_000;
    return Math.max(65_000_000, Math.round(raw / 100_000) * 100_000);
  }
  if (division === 'SERIE_A_IT') {
    const raw = 215_000_000 - (safeRank - 1) * 8_600_000;
    return Math.max(50_000_000, Math.round(raw / 100_000) * 100_000);
  }
  if (division === 'LIGUE_1') {
    const clampedRank = Math.max(1, Math.min(18, Math.round(rank)));
    const raw = 175_000_000 - (clampedRank - 1) * 8_200_000;
    return Math.max(35_000_000, Math.round(raw / 100_000) * 100_000);
  }
  if (division === 'LIGA_PORTUGAL') {
    const clampedRank = Math.max(1, Math.min(18, Math.round(rank)));
    const raw = 110_000_000 - (clampedRank - 1) * 5_400_000;
    return Math.max(18_000_000, Math.round(raw / 100_000) * 100_000);
  }
  // LALIGA
  const raw = 240_000_000 - (safeRank - 1) * 9_700_000;
  return Math.max(55_000_000, Math.round(raw / 100_000) * 100_000);
}

export function buildSeasonEndSummary(params: {
  seasonYear: number;
  clubs: Club[];
  userClubId: string;
  userSquad: Player[];
  aiSquads: Record<string, Player[]>;
  standings: StandingsRow[];
  secondaryStandings: StandingsRow[];
  copaDoBrasil: CopaDoBrasilState;
  libertadores: LibertadoresState;
  championsLeague?: ChampionsLeagueState;
  mundial?: MundialState;
  superMundial?: SuperMundialState;
  matchHistory?: MatchHistoryRecord[];
  previewEvolutionHighlights?: PlayerEvolutionReportItem[];
}): SeasonEndReport {
  const {
    seasonYear,
    clubs,
    userClubId,
    userSquad,
    aiSquads,
    standings,
    secondaryStandings,
    copaDoBrasil,
    libertadores,
    championsLeague,
    mundial,
    superMundial,
    matchHistory = [],
    previewEvolutionHighlights = [],
  } = params;

  const clubMap = new Map(clubs.map((c) => [c.id, c]));
  const userClub = clubMap.get(userClubId) || clubs[0];
  const userDiv: PlayableDivision = getPlayableDivisionForClub(userClub);
  const userIsEuro = isEuropeanPlayableDivision(userDiv);

  const otherDiv: PlayableDivision = getSecondaryPlayableDivision(userDiv);

  const serieAStandings = !userIsEuro
    ? userDiv === 'A'
      ? standings
      : secondaryStandings
    : [];
  const serieBStandings = !userIsEuro
    ? userDiv === 'B'
      ? standings
      : secondaryStandings
    : [];
  const plStandings =
    userDiv === 'PL'
      ? standings
      : otherDiv === 'PL'
      ? secondaryStandings
      : [];
  const laLigaStandings =
    userDiv === 'LALIGA'
      ? standings
      : otherDiv === 'LALIGA'
      ? secondaryStandings
      : [];
  const bundesligaStandings =
    userDiv === 'BUNDESLIGA'
      ? standings
      : otherDiv === 'BUNDESLIGA'
      ? secondaryStandings
      : [];
  const serieAItStandings =
    userDiv === 'SERIE_A_IT'
      ? standings
      : otherDiv === 'SERIE_A_IT'
      ? secondaryStandings
      : [];
  const ligue1Standings =
    userDiv === 'LIGUE_1'
      ? standings
      : otherDiv === 'LIGUE_1'
      ? secondaryStandings
      : [];
  const ligaPortugalStandings =
    userDiv === 'LIGA_PORTUGAL'
      ? standings
      : otherDiv === 'LIGA_PORTUGAL'
      ? secondaryStandings
      : [];

  const serieAChampionId = serieAStandings[0]?.clubId || '';
  const serieBChampionId = serieBStandings[0]?.clubId || '';
  const premierLeagueChampionId = plStandings[0]?.clubId || null;
  const laLigaChampionId = laLigaStandings[0]?.clubId || null;
  const bundesligaChampionId = bundesligaStandings[0]?.clubId || null;
  const serieAItChampionId = serieAItStandings[0]?.clubId || null;
  const ligue1ChampionId = ligue1Standings[0]?.clubId || null;
  const ligaPortugalChampionId = ligaPortugalStandings[0]?.clubId || null;
  const cdbChampionId = copaDoBrasil.championClubId;
  const libChampionId = libertadores.championClubId;
  const uclChampionId = championsLeague?.championClubId ?? null;
  const mundialChampionId = mundial?.championClubId ?? null;
  const superMundialChampionId = superMundial?.isActiveThisSeason
    ? superMundial.championClubId ?? null
    : null;

  const relegatedClubIds = userIsEuro
    ? []
    : serieAStandings.slice(-4).map((r) => r.clubId);
  const promotedClubIds = userIsEuro
    ? []
    : serieBStandings.slice(0, 4).map((r) => r.clubId);

  // Libertadores qualification (Top 4 Série A + CdB champion if BR + Lib champion if BR + next Série A up to 8 BR clubs)
  const libQualifiedSet = new Set<string>();
  const addIfSerieAOrBr = (id: string | null | undefined) => {
    if (!id) return;
    const c = clubMap.get(id);
    if (c && (c.division === 'A' || c.division === 'B') && !relegatedClubIds.includes(id)) {
      libQualifiedSet.add(id);
    }
  };

  addIfSerieAOrBr(cdbChampionId);
  addIfSerieAOrBr(libChampionId);
  for (const row of serieAStandings) {
    if (libQualifiedSet.size >= 8) break;
    if (!relegatedClubIds.includes(row.clubId)) {
      libQualifiedSet.add(row.clubId);
    }
  }
  const libertadoresQualifiedBrIds = Array.from(libQualifiedSet).slice(0, 8);

  const userTable = standings;
  const userRank = Math.max(
    1,
    userTable.findIndex((r) => r.clubId === userClubId) + 1
  );
  const userFinalPoints = userTable[userRank - 1]?.points ?? 0;

  const userSeasonPrize = getLeagueEndPrizeMoney(userDiv, userRank);
  const userQualifiedChampionsLeague = userIsEuro
    ? userRank <= 4 || uclChampionId === userClubId
    : false;

  const awards = buildSeasonAwardsSummary({
    clubs,
    userClubId,
    userSquad,
    aiSquads,
  });

  return {
    seasonYear,
    serieAChampionId,
    serieAChampionName: clubMap.get(serieAChampionId)?.shortName || serieAChampionId,
    serieBChampionId,
    serieBChampionName: clubMap.get(serieBChampionId)?.shortName || serieBChampionId,
    premierLeagueChampionId,
    premierLeagueChampionName: premierLeagueChampionId
      ? clubMap.get(premierLeagueChampionId)?.shortName || premierLeagueChampionId
      : null,
    laLigaChampionId,
    laLigaChampionName: laLigaChampionId
      ? clubMap.get(laLigaChampionId)?.shortName || laLigaChampionId
      : null,
    bundesligaChampionId,
    bundesligaChampionName: bundesligaChampionId
      ? clubMap.get(bundesligaChampionId)?.shortName || bundesligaChampionId
      : null,
    serieAItChampionId,
    serieAItChampionName: serieAItChampionId
      ? clubMap.get(serieAItChampionId)?.shortName || serieAItChampionId
      : null,
    ligue1ChampionId,
    ligue1ChampionName: ligue1ChampionId
      ? clubMap.get(ligue1ChampionId)?.shortName || ligue1ChampionId
      : null,
    ligaPortugalChampionId,
    ligaPortugalChampionName: ligaPortugalChampionId
      ? clubMap.get(ligaPortugalChampionId)?.shortName || ligaPortugalChampionId
      : null,
    cdbChampionId,
    cdbChampionName: cdbChampionId
      ? clubMap.get(cdbChampionId)?.shortName || cdbChampionId
      : null,
    libChampionId,
    libChampionName: libChampionId
      ? clubMap.get(libChampionId)?.shortName || libChampionId
      : null,
    uclChampionId,
    uclChampionName: uclChampionId
      ? clubMap.get(uclChampionId)?.shortName || uclChampionId
      : null,
    mundialChampionId,
    mundialChampionName: mundialChampionId
      ? clubMap.get(mundialChampionId)?.shortName || mundialChampionId
      : null,
    superMundialChampionId,
    superMundialChampionName: superMundialChampionId
      ? clubMap.get(superMundialChampionId)?.shortName || superMundialChampionId
      : null,
    userFinalDivision: userDiv,
    userFinalRank: userRank,
    userFinalPoints,
    userSeasonPrize,
    userPromoted: !userIsEuro && userDiv === 'B' && promotedClubIds.includes(userClubId),
    userRelegated: !userIsEuro && userDiv === 'A' && relegatedClubIds.includes(userClubId),
    userQualifiedLibertadores: !userIsEuro && libertadoresQualifiedBrIds.includes(userClubId),
    userQualifiedChampionsLeague,
    relegatedClubIds,
    promotedClubIds,
    libertadoresQualifiedBrIds,
    awards,
    userEvolutionHighlights: previewEvolutionHighlights,
    thinkingRetirementNames: userSquad
      .filter((p) => evaluatePlayerRetirementProbability(p).isConsideringRetirement)
      .map((p) => `${p.name} (${p.position}, ${p.age}a)`),
    starterOvrHistory: buildStarterOvrEvolutionSeries({
      seasonYear,
      userClubId,
      userSquad,
      matchHistory,
      userEvolutionHighlights: previewEvolutionHighlights,
    }),
  };
}

/**
 * Transitions the entire game world from `seasonYear` to `seasonYear + 1`:
 * - Archives season champions & awards into SeasonArchiveEntry
 * - Applies Série A <-> Série B promotion/relegation (4 up / 4 down)
 * - Runs annual aging (+1 year) & performance-based evolution/regression for all players
 * - Credits season prize & applies anti-inflation upkeep + recalculates dynamic sponsorships
 * - Regenerates 38-round league schedules & fresh Copa do Brasil + Libertadores draws
 */
export function executeNewSeasonRollover(params: {
  currentYear: number;
  clubs: Club[];
  userClubId: string;
  userSquad: Player[];
  aiSquads: Record<string, Player[]>;
  freeAgents: Player[];
  loanedOutPlayers: Player[];
  standings: StandingsRow[];
  secondaryStandings: StandingsRow[];
  copaDoBrasil: CopaDoBrasilState;
  libertadores: LibertadoresState;
  championsLeague?: ChampionsLeagueState;
  mundial?: MundialState;
  superMundial?: SuperMundialState;
  accumulatedUclChampions?: string[];
  accumulatedLibChampions?: string[];
  seasonHistory: SeasonArchiveEntry[];
  matchHistory?: MatchHistoryRecord[];
  managerName: string;
  youthAcademy?: import('../types/football').YouthAcademyState;
  rng?: () => number;
}): {
  nextYear: number;
  report: SeasonEndReport;
  archiveEntry: SeasonArchiveEntry;
  updatedClubs: Club[];
  updatedUserSquad: Player[];
  updatedAiSquads: Record<string, Player[]>;
  updatedFreeAgents: Player[];
  updatedLoanedOut: Player[];
  nextStandings: StandingsRow[];
  nextFixtures: RoundFixture[];
  nextSecondaryStandings: StandingsRow[];
  nextSecondaryFixtures: RoundFixture[];
  nextCopaDoBrasil: CopaDoBrasilState;
  nextLibertadores: LibertadoresState;
  nextChampionsLeague: ChampionsLeagueState;
  nextMundial: MundialState;
  nextSuperMundial: SuperMundialState;
  nextAccumulatedUclChampions: string[];
  nextAccumulatedLibChampions: string[];
  nextFinanceLedger: ClubFinanceLedger;
  nextMatchState: LiveMatchState;
  nextMessages: InboxMessage[];
  nextDivision: PlayableDivision;
  nextYouthAcademy: import('../types/football').YouthAcademyState;
  newSeasonEvolutionReport: NewSeasonEvolutionReport;
} {
  const {
    currentYear,
    clubs,
    userClubId,
    userSquad,
    aiSquads,
    freeAgents,
    loanedOutPlayers,
    standings,
    secondaryStandings,
    copaDoBrasil,
    libertadores,
    championsLeague,
    mundial,
    superMundial,
    accumulatedUclChampions = [],
    accumulatedLibChampions = [],
    seasonHistory,
    matchHistory = [],
    managerName,
    youthAcademy = {
      investmentTier: 'ESTRUTURADO',
      focusSector: 'EQUILIBRADO',
      monthlyCost: 450_000,
      accumulatedSeasonInvestment: 0,
      monthsInvestedThisSeason: 12,
      lastGraduatedRegens: [],
    },
    rng = Math.random,
  } = params;

  const nextYear = currentYear + 1;
  const baseReport = buildSeasonEndSummary({
    seasonYear: currentYear,
    clubs,
    userClubId,
    userSquad,
    aiSquads,
    standings,
    secondaryStandings,
    copaDoBrasil,
    libertadores,
    championsLeague,
    mundial,
    superMundial,
    matchHistory,
  });

  // 1. Apply promotion/relegation, titles, and reputation updates before evolution/sponsorship
  const relegatedSet = new Set(baseReport.relegatedClubIds);
  const promotedSet = new Set(baseReport.promotedClubIds);

  const clubsWithMovement: Club[] = clubs.map((c) => {
    let nextDivision = c.division;
    let repDelta = 0;
    const titles = [...(c.recentTitles || [])];

    if (c.division === 'A' && relegatedSet.has(c.id)) {
      nextDivision = 'B';
      repDelta -= 2;
    } else if (c.division === 'B' && promotedSet.has(c.id)) {
      nextDivision = 'A';
      repDelta += 2;
    }

    if (c.id === baseReport.serieAChampionId) {
      titles.push(`Série A ${currentYear}`);
      repDelta += 2;
    }
    if (c.id === baseReport.serieBChampionId) {
      titles.push(`Série B ${currentYear}`);
      repDelta += 1;
    }
    if (c.id === baseReport.premierLeagueChampionId) {
      titles.push(`Premier League ${currentYear}`);
      repDelta += 2;
    }
    if (c.id === baseReport.laLigaChampionId) {
      titles.push(`La Liga ${currentYear}`);
      repDelta += 2;
    }
    if (c.id === baseReport.bundesligaChampionId) {
      titles.push(`Bundesliga ${currentYear}`);
      repDelta += 2;
    }
    if (c.id === baseReport.serieAItChampionId) {
      titles.push(`Serie A Italiana ${currentYear}`);
      repDelta += 2;
    }
    if (c.id === baseReport.ligue1ChampionId) {
      titles.push(`Ligue 1 ${currentYear}`);
      repDelta += 2;
    }
    if (c.id === baseReport.ligaPortugalChampionId) {
      titles.push(`Liga Portugal ${currentYear}`);
      repDelta += 2;
    }
    if (c.id === baseReport.cdbChampionId) {
      titles.push(`Copa do Brasil ${currentYear}`);
      repDelta += 2;
    }
    if (c.id === baseReport.libChampionId) {
      titles.push(`Libertadores ${currentYear}`);
      repDelta += 3;
    }
    if (c.id === baseReport.uclChampionId) {
      titles.push(`Champions League ${currentYear}`);
      repDelta += 2;
    }
    if (c.id === baseReport.mundialChampionId) {
      titles.push(`Mundial de Clubes ${currentYear}`);
      repDelta += 3;
    }
    if (c.id === baseReport.superMundialChampionId) {
      titles.push(`Super Mundial ${currentYear}`);
      repDelta += 4;
    }

    const prizeAdd = c.id === userClubId ? baseReport.userSeasonPrize : 0;

    return {
      ...c,
      division: nextDivision,
      reputation: Math.min(99, Math.max(60, c.reputation + repDelta)),
      cashBalance: c.cashBalance + prizeAdd,
      recentTitles: titles.slice(-6),
    };
  });

  // 2. Evolve & Age (+1) all players across the entire world
  const evoResult = processSeasonEvolutionAndAging({
    clubs: clubsWithMovement,
    userClubId,
    userSquad,
    aiSquads,
    freeAgents,
    loanedOutPlayers,
    rng,
  });

  // 3. Process contract & loan duration expirations (-1 year, return/expire loans & unrenewed contracts)
  const contractRollover = processSeasonEndContracts({
    userSquad: evoResult.updatedUserSquad,
    aiSquads: evoResult.updatedAiSquads,
    loanedOutPlayers: evoResult.updatedLoanedOut,
    freeAgents: evoResult.updatedFreeAgents,
    clubs: evoResult.updatedClubs,
    userClubId,
    nextYear,
  });

  // 4. Apply Anti-Inflation seasonal reserve guardrail & UCL/WORLD commercial operational costs across ALL clubs
  const maintainedClubs = evoResult.updatedClubs.map((club) => {
    const sq =
      club.id === userClubId
        ? contractRollover.updatedUserSquad
        : contractRollover.updatedAiSquads[club.id] || [];
    const { updatedClub } = applyAntiInflationSeasonMaintenance(
      club,
      sq,
      club.id === userClubId
    );
    return updatedClub;
  });

  const updatedUserClub =
    maintainedClubs.find((c) => c.id === userClubId) || maintainedClubs[0];
  const nextDivision: PlayableDivision = getPlayableDivisionForClub(updatedUserClub);
  const otherDivision: PlayableDivision = getSecondaryPlayableDivision(nextDivision);
  const nextIsEuro = isEuropeanPlayableDivision(nextDivision);

  // 5. Dynamic Sponsorship for new season (with 30% operational cost applied to all playable clubs)
  const avgUserOvr =
    contractRollover.updatedUserSquad.reduce(
      (s, p) => s + calculatePlayerOverall(p.attributes, p.position),
      0
    ) / Math.max(1, contractRollover.updatedUserSquad.length);
  const newSponsorship = calculateDynamicSponsorship(
    updatedUserClub,
    avgUserOvr,
    nextYear
  );
  const openingSponsorOpCost = calculateOperationalCost(
    newSponsorship.monthlyInstallment
  );
  const openingSponsorNet =
    newSponsorship.monthlyInstallment - openingSponsorOpCost;

  // Credit opening sponsorship installment net of 30% operational cost for user and all active league AI clubs
  const clubsAfterSponsor = maintainedClubs.map((c) => {
    if (c.id === userClubId) {
      return { ...c, cashBalance: c.cashBalance + openingSponsorNet };
    }
    const cPlayableDiv = getPlayableDivisionForClub(c);
    const shouldCreditSponsor = nextIsEuro
      ? isEuropeanPlayableDivision(cPlayableDiv) &&
        (c.division === 'PL' ||
          c.division === 'LALIGA' ||
          c.division === 'BUNDESLIGA' ||
          c.division === 'SERIE_A_IT' ||
          c.division === 'LIGUE_1' ||
          c.division === 'LIGA_PORTUGAL' ||
          (c.division === 'UCL' &&
            (c.countryCode === 'ING' ||
              c.countryCode === 'ESP' ||
              c.countryCode === 'ALE' ||
              c.countryCode === 'ITA' ||
              c.countryCode === 'FRA' ||
              c.countryCode === 'POR')))
      : c.division === 'A' || c.division === 'B';
    if (shouldCreditSponsor) {
      const sq = contractRollover.updatedAiSquads[c.id] || [];
      const avgOvr =
        sq.length > 0
          ? sq.reduce(
              (sum, p) => sum + calculatePlayerOverall(p.attributes, p.position),
              0
            ) / sq.length
          : Math.max(66, c.reputation - 5);
      const aiSp = calculateDynamicSponsorship(c, avgOvr, nextYear);
      const aiOpCost = calculateOperationalCost(aiSp.monthlyInstallment);
      return {
        ...c,
        cashBalance: c.cashBalance + aiSp.monthlyInstallment - aiOpCost,
      };
    }
    return c;
  });
  const finalUserClub =
    clubsAfterSponsor.find((c) => c.id === userClubId) || updatedUserClub;

  const nextFinanceLedger: ClubFinanceLedger = {
    seasonYear: nextYear,
    seasonGateRevenue: 0,
    seasonTransferIncome: 0,
    seasonTransferSpend: 0,
    seasonPrizeRevenue: 0,
    seasonSponsorshipRevenue: newSponsorship.monthlyInstallment,
    seasonPayrollExpense: 0,
    seasonOperationalExpense: openingSponsorOpCost,
    lastMatchGateRevenue: 0,
    lastMatchAttendance: 0,
    sponsorshipContract: newSponsorship,
  };

  // 6. Regenerate 38-round league schedules & fresh cups
  const nextStandings = getInitialStandingsForDivision(
    nextDivision,
    clubsAfterSponsor
  );
  const nextFixtures = generateLeagueSchedule(
    userClubId,
    nextDivision,
    clubsAfterSponsor
  );
  const nextSecondaryStandings = getInitialStandingsForDivision(
    otherDivision,
    clubsAfterSponsor
  );
  const nextSecondaryFixtures = generateLeagueSchedule(
    '__none__',
    otherDivision,
    clubsAfterSponsor
  );

  const nextCopaDoBrasil = createInitialCopaDoBrasil(
    userClubId,
    clubsAfterSponsor
  );
  const nextLibertadores = createInitialLibertadores(
    userClubId,
    baseReport.libertadoresQualifiedBrIds,
    nextYear
  );

  // Acumula campeões da Champions e Libertadores do ciclo quadrienal do Super Mundial
  const wasSuperMundialCycleEnd = isSuperMundialYear(currentYear);
  const baseAccUcl = wasSuperMundialCycleEnd ? [] : accumulatedUclChampions;
  const baseAccLib = wasSuperMundialCycleEnd ? [] : accumulatedLibChampions;

  const nextAccumulatedUclChampions = baseReport.uclChampionId
    ? Array.from(new Set([baseReport.uclChampionId, ...baseAccUcl])).slice(0, 6)
    : [...baseAccUcl];
  const nextAccumulatedLibChampions = baseReport.libChampionId
    ? Array.from(new Set([baseReport.libChampionId, ...baseAccLib])).slice(0, 6)
    : [...baseAccLib];

  // Para carreiras europeias, classifica Top 4 da liga principal + Top 4 da liga secundária pareada + Campeão da UCL
  const activeEuroCountries =
    nextDivision === 'PL' || nextDivision === 'LALIGA'
      ? new Set(['ING', 'ESP'])
      : nextDivision === 'BUNDESLIGA' || nextDivision === 'SERIE_A_IT'
      ? new Set(['ALE', 'ITA'])
      : new Set(['FRA', 'POR']);
  const nextUclQualifiedIds = nextIsEuro
    ? Array.from(
        new Set([
          ...(baseReport.uclChampionId ? [baseReport.uclChampionId] : []),
          ...standings.slice(0, 4).map((r) => r.clubId),
          ...secondaryStandings.slice(0, 4).map((r) => r.clubId),
          ...clubsAfterSponsor
            .filter(
              (c) =>
                c.division === 'UCL' &&
                !activeEuroCountries.has(c.countryCode || '')
            )
            .map((c) => c.id),
        ])
      ).slice(0, 16)
    : undefined;

  const nextChampionsLeague = createInitialChampionsLeague(
    nextYear,
    clubsAfterSponsor,
    nextIsEuro ? userClubId : undefined,
    nextUclQualifiedIds
  );
  const nextMundial = createInitialMundial(nextYear);
  const nextSuperMundial = createInitialSuperMundial({
    seasonYear: nextYear,
    userClubId,
    clubsPool: clubsAfterSponsor,
    accumulatedUclChampions: nextAccumulatedUclChampions,
    accumulatedLibChampions: nextAccumulatedLibChampions,
    libertadoresQualifiedBrIds: baseReport.libertadoresQualifiedBrIds,
  });

  const r1Fix =
    nextFixtures.find((f) => f.roundNumber === 1 && f.isUserMatch) ||
    nextFixtures[0];
  const r1Home =
    clubsAfterSponsor.find((c) => c.id === r1Fix.homeClubId) || clubsAfterSponsor[0];
  const r1Away =
    clubsAfterSponsor.find((c) => c.id === r1Fix.awayClubId) || clubsAfterSponsor[1];

  const youthResult = generateYouthRegens({
    academy: youthAcademy,
    clubId: userClubId,
    clubReputation: updatedUserClub.reputation,
    division: nextDivision,
    seasonYear: nextYear,
    rng,
  });

  const finalUserSquad = contractRollover.updatedUserSquad;
  const nextYouthAcademy = {
    ...youthAcademy,
    accumulatedSeasonInvestment: youthAcademy.monthlyCost,
    monthsInvestedThisSeason: 1,
    lastGraduatedRegens: youthResult.reportItems,
    youthRoster: youthResult.updatedYouthRoster,
  };

  const nextMatchState = createInitialMatchState(
    1,
    r1Fix,
    r1Home,
    r1Away,
    finalUserSquad,
    userClubId,
    [],
    contractRollover.updatedAiSquads
  );

  const sortedEvoHighlights = [...evoResult.userEvolutionReport].sort(
    (a, b) =>
      Math.abs(b.deltaOvr) - Math.abs(a.deltaOvr) ||
      b.deltaOvr - a.deltaOvr ||
      b.newOvr - a.newOvr
  );

  const squadOnlyEvoItems = evoResult.userEvolutionReport.filter(
    (item) => !item.isLoanedOut
  );
  const avgBasis =
    squadOnlyEvoItems.length > 0 ? squadOnlyEvoItems : evoResult.userEvolutionReport;
  const squadAvgOvrBefore =
    avgBasis.length > 0
      ? Number(
          (
            avgBasis.reduce((sum, item) => sum + item.oldOvr, 0) /
            avgBasis.length
          ).toFixed(1)
        )
      : 0;
  const squadAvgOvrAfter =
    avgBasis.length > 0
      ? Number(
          (
            avgBasis.reduce((sum, item) => sum + item.newOvr, 0) /
            avgBasis.length
          ).toFixed(1)
        )
      : 0;

  const newSeasonEvolutionReport: NewSeasonEvolutionReport = {
    fromYear: currentYear,
    toYear: nextYear,
    clubId: finalUserClub.id,
    clubName: finalUserClub.shortName,
    items: [...evoResult.userEvolutionReport].sort(
      (a, b) =>
        b.deltaOvr - a.deltaOvr ||
        Number(Boolean(b.exceededExpectations)) -
          Number(Boolean(a.exceededExpectations)) ||
        b.newOvr - a.newOvr
    ),
    retiredPlayers: evoResult.retiredUserPlayers,
    squadAvgOvrBefore,
    squadAvgOvrAfter,
  };

  const upcomingRenewals = getRenewalEligiblePlayers(
    finalUserSquad,
    finalUserClub,
    nextYear
  );

  const fullReport: SeasonEndReport = {
    ...baseReport,
    userEvolutionHighlights: sortedEvoHighlights,
    promotedYouthRegens: youthResult.reportItems,
    expiringContractsCount: upcomingRenewals.length,
    expiredPlayerNames: [
      ...contractRollover.expiredDefinitiveNames,
      ...contractRollover.expiredLoanInNames,
    ],
    returnedLoanNames: contractRollover.returnedLoanOutNames,
    retiredPlayers: evoResult.retiredUserPlayers,
  };

  const archiveEntry: SeasonArchiveEntry = {
    year: currentYear,
    serieAChampionId: baseReport.serieAChampionId,
    serieAChampionName: baseReport.serieAChampionName,
    serieBChampionId: baseReport.serieBChampionId,
    serieBChampionName: baseReport.serieBChampionName,
    premierLeagueChampionId: baseReport.premierLeagueChampionId ?? null,
    premierLeagueChampionName: baseReport.premierLeagueChampionName ?? null,
    laLigaChampionId: baseReport.laLigaChampionId ?? null,
    laLigaChampionName: baseReport.laLigaChampionName ?? null,
    bundesligaChampionId: baseReport.bundesligaChampionId ?? null,
    bundesligaChampionName: baseReport.bundesligaChampionName ?? null,
    serieAItChampionId: baseReport.serieAItChampionId ?? null,
    serieAItChampionName: baseReport.serieAItChampionName ?? null,
    ligue1ChampionId: baseReport.ligue1ChampionId ?? null,
    ligue1ChampionName: baseReport.ligue1ChampionName ?? null,
    ligaPortugalChampionId: baseReport.ligaPortugalChampionId ?? null,
    ligaPortugalChampionName: baseReport.ligaPortugalChampionName ?? null,
    cdbChampionId: baseReport.cdbChampionId,
    cdbChampionName: baseReport.cdbChampionName,
    libChampionId: baseReport.libChampionId,
    libChampionName: baseReport.libChampionName,
    uclChampionId: baseReport.uclChampionId,
    uclChampionName: baseReport.uclChampionName,
    mundialChampionId: baseReport.mundialChampionId,
    mundialChampionName: baseReport.mundialChampionName,
    superMundialChampionId: baseReport.superMundialChampionId,
    superMundialChampionName: baseReport.superMundialChampionName,
    topScorerName: baseReport.awards.topScorer?.playerName || '—',
    topScorerClubName: baseReport.awards.topScorer?.clubName || '—',
    topScorerGoals: baseReport.awards.topScorer?.value || 0,
    topAssistName: baseReport.awards.topAssist?.playerName || '—',
    topAssistClubName: baseReport.awards.topAssist?.clubName || '—',
    topAssistCount: baseReport.awards.topAssist?.value || 0,
    bestPlayerName: baseReport.awards.bestPlayer?.playerName || '—',
    bestPlayerClubName: baseReport.awards.bestPlayer?.clubName || '—',
    bestPlayerRating: baseReport.awards.bestPlayer?.value || 0,
    userClubName: finalUserClub.shortName,
    userDivision: baseReport.userFinalDivision,
    userRank: baseReport.userFinalRank,
    userPoints: baseReport.userFinalPoints,
  };

  const oppName =
    r1Fix.homeClubId === userClubId ? r1Away.shortName : r1Home.shortName;

  const youthInboxMsg: InboxMessage | null = youthResult.newPlayers.length > 0 ? {
    id: `msg-youth-grads-${nextYear}`,
    date: `28 Jan ${nextYear} · 09:15`,
    sender: 'Coordenação da Base',
    senderRole: 'Sub-20 & Captação',
    subject: `Safra ${nextYear} na Base: ${youthResult.newPlayers.length} Jovens Captados no Sub-20!`,
    category: 'Olheiro',
    priority: 'positive',
    read: false,
    body: [
      `A captação anual da Base e Sub-20 trouxe ${youthResult.newPlayers.length} novos talentos para o CT do ${finalUserClub.shortName}. Os atletas já na base também completaram +1 ano de maturação.`,
      `Acesse a aba Base & Sub-20 para inspecionar os atributos e promover ao elenco profissional os jogadores a partir de 16 anos que vão ajudar a equipe!`,
    ],
    bulletPoints: youthResult.reportItems.map(
      (r) =>
        `${r.name} (${r.position} · ${r.age} anos · OVR ${Math.round(r.ovr)} · ${r.potentialStars}★)`
    ),
    actionLabel: 'Avaliar Base & Sub-20',
    actionTargetTab: 'youth',
  } : null;

  const contractsInboxMsg: InboxMessage | null =
    upcomingRenewals.length > 0 ||
    contractRollover.expiredDefinitiveNames.length > 0 ||
    contractRollover.expiredLoanInNames.length > 0 ||
    contractRollover.returnedLoanOutNames.length > 0
      ? {
          id: `msg-contracts-${nextYear}`,
          date: `28 Jan ${nextYear} · 09:30`,
          sender: 'Departamento Jurídico',
          senderRole: 'Contratos & Empréstimos',
          subject: `Lista Anual de Contratos ${nextYear}: ${upcomingRenewals.length} renovação(ões) disponíveis`,
          category: 'Diretoria',
          priority: upcomingRenewals.some((r) => r.remainingYears <= 1)
            ? 'warning'
            : 'normal',
          read: false,
          body: [
            `Na virada para ${nextYear}, ${upcomingRenewals.length} jogador(es) entraram na lista anual de renovação (vence em ${nextYear} ou elegíveis com 1 ano de antecedência).`,
            contractRollover.expiredDefinitiveNames.length > 0
              ? `Contratos encerrados sem renovação (saíram livres): ${contractRollover.expiredDefinitiveNames.join(', ')}.`
              : 'Nenhum vínculo definitivo expirou sem renovação.',
            contractRollover.expiredLoanInNames.length > 0
              ? `Empréstimos concluídos: ${contractRollover.expiredLoanInNames.join(', ')}.`
              : contractRollover.continuingLoanNames.length > 0
              ? `Empréstimos plurianuais mantidos no elenco: ${contractRollover.continuingLoanNames.join(', ')}.`
              : 'Sem empréstimos encerrados nesta janela.',
          ],
          bulletPoints: upcomingRenewals.slice(0, 6).map(
            (r) =>
              `${r.player.name} (${r.player.position} · OVR ${r.expectation.currentOvr}) — ${
                r.remainingYears <= 1
                  ? `Expira fim de ${r.endYear}`
                  : `Antecipada (até ${r.endYear})`
              } · Flexibilidade ${r.expectation.flexibility} · Pedida ${formatCompactBRL(
                r.expectation.desiredSalary
              )}/mês`
          ),
          actionLabel: 'Abrir Renovações no Elenco',
          actionTargetTab: 'squad',
        }
      : null;

  const retirementInboxMsg: InboxMessage | null =
    evoResult.retiredUserPlayers.length > 0
      ? {
          id: `msg-retirements-${nextYear}`,
          date: `28 Jan ${nextYear} · 09:45`,
          sender: 'Diretoria & Comissão Técnica',
          senderRole: 'Encerramento de Carreira',
          subject: `Aposentadorias (${nextYear}): ${evoResult.retiredUserPlayers
            .map((r) => r.playerName)
            .join(', ')}`,
          category: 'Diretoria',
          priority: 'warning',
          read: false,
          body: [
            `${evoResult.retiredUserPlayers.length} atleta(s) do ${finalUserClub.shortName} anunciaram oficialmente a aposentadoria na virada para ${nextYear}.`,
            `O clube garantiu a integridade do plantel (mínimo de elenco e goleiro) e ajustou a lista de titulares para a pré-temporada.`,
          ],
          bulletPoints: evoResult.retiredUserPlayers.map(
            (r) =>
              `${r.playerName} (${r.position} · ${r.ageAtRetirement} anos · OVR ${r.lastOvr} · ${r.matchesPlayed}j) — ${r.reasonNote}`
          ),
          actionLabel: 'Ver Elenco',
          actionTargetTab: 'squad',
        }
      : null;

  const nextMessages: InboxMessage[] = [
    ...(retirementInboxMsg ? [retirementInboxMsg] : []),
    ...(contractsInboxMsg ? [contractsInboxMsg] : []),
    ...(youthInboxMsg ? [youthInboxMsg] : []),
    {
      id: `msg-newseason-${nextYear}-1`,
      date: `28 Jan ${nextYear} · 09:00`,
      sender: 'Diretoria',
      senderRole: finalUserClub.shortName,
      subject: `Abertura da Temporada ${nextYear} · ${getPlayableLeagueShortLabel(nextDivision)}`,
      category: 'Diretoria',
      priority: 'positive',
      read: false,
      body: [
        `Iniciamos a temporada ${nextYear}, ${managerName}! Novo contrato de patrocínio fechado com ${newSponsorship.sponsorName} (${newSponsorship.tierLabel}) no valor de ${formatCompactBRL(
          newSponsorship.annualValue
        )}/ano.`,
        `Estreia na 1ª Rodada (${getPlayableLeagueShortLabel(nextDivision)}): contra ${oppName}.`,
      ],
      bulletPoints: nextIsEuro
        ? [
            nextDivision === 'BUNDESLIGA' || nextDivision === 'SERIE_A_IT'
              ? `Campeão Bundesliga ${currentYear}: ${baseReport.bundesligaChampionName || '—'} · Campeão Serie A Italiana ${currentYear}: ${baseReport.serieAItChampionName || '—'}`
              : nextDivision === 'LIGUE_1' || nextDivision === 'LIGA_PORTUGAL'
              ? `Campeão Ligue 1 ${currentYear}: ${baseReport.ligue1ChampionName || '—'} · Campeão Liga Portugal ${currentYear}: ${baseReport.ligaPortugalChampionName || '—'}`
              : `Campeão Premier League ${currentYear}: ${baseReport.premierLeagueChampionName || '—'} · Campeão La Liga ${currentYear}: ${baseReport.laLigaChampionName || '—'}`,
            baseReport.userQualifiedChampionsLeague
              ? `${finalUserClub.shortName} classificado para a UEFA Champions League ${nextYear}!`
              : `Foco total no G-4 da ${getPlayableLeagueShortLabel(nextDivision)} ${nextYear}.`,
            `Saldo em caixa ajustado pós-manutenção: ${formatCompactBRL(
              finalUserClub.cashBalance
            )}.`,
          ]
        : [
            `Campeão Série A ${currentYear}: ${baseReport.serieAChampionName} · Campeão Série B ${currentYear}: ${baseReport.serieBChampionName}`,
            baseReport.userQualifiedLibertadores
              ? `${finalUserClub.shortName} classificado para a Copa Libertadores ${nextYear}!`
              : `Foco na ${getPlayableLeagueShortLabel(nextDivision)} e Copa do Brasil ${nextYear}.`,
            `Saldo em caixa ajustado pós-manutenção: ${formatCompactBRL(
              finalUserClub.cashBalance
            )}.`,
          ],
      actionLabel: 'Ver Finanças',
      actionTargetTab: 'finances',
    },
    {
      id: `msg-newseason-${nextYear}-2`,
      date: `28 Jan ${nextYear} · 08:30`,
      sender: 'Comissão Técnica',
      senderRole: 'Análise de Desempenho',
      subject: `Relatório de Evolução do Elenco (${currentYear} → ${nextYear})`,
      category: 'Tática',
      priority:
        newSeasonEvolutionReport.items.filter((i) => i.deltaOvr > 0).length >=
        newSeasonEvolutionReport.items.filter((i) => i.deltaOvr < 0).length
          ? 'positive'
          : 'normal',
      read: false,
      body: [
        `Todos os atletas completaram +1 ano de idade e passaram pela reavaliação técnica, tática e física de início da temporada ${nextYear}. Média do elenco: ${squadAvgOvrBefore.toFixed(1)} → ${squadAvgOvrAfter.toFixed(1)} OVR.`,
        `Resumo geral: ${
          newSeasonEvolutionReport.items.filter((i) => i.deltaOvr > 0).length
        } evoluíram · ${
          newSeasonEvolutionReport.items.filter((i) => i.deltaOvr === 0).length
        } estáveis · ${
          newSeasonEvolutionReport.items.filter((i) => i.deltaOvr < 0).length
        } regrediram.`,
      ],
      bulletPoints: sortedEvoHighlights.slice(0, 6).map((evo) => {
        const sign = evo.deltaOvr > 0 ? `+${evo.deltaOvr}` : `${evo.deltaOvr}`;
        const starShift =
          evo.oldPotentialStars !== undefined &&
          evo.oldPotentialStars !== evo.potentialStars
            ? ` · Potencial ${evo.oldPotentialStars}★→${evo.potentialStars}★`
            : '';
        return `${evo.playerName} (${evo.position} · ${evo.newAge}a): ${evo.oldOvr} → ${evo.newOvr} OVR (${sign})${starShift} — ${evo.reasonNote}`;
      }),
      actionLabel: 'Ver Elenco',
      actionTargetTab: 'squad',
    },
  ];

  // Keep seasonHistory deduplicated by year if needed
  const _ = seasonHistory;

  return {
    nextYear,
    report: fullReport,
    archiveEntry,
    updatedClubs: clubsAfterSponsor,
    updatedUserSquad: finalUserSquad,
    updatedAiSquads: contractRollover.updatedAiSquads,
    updatedFreeAgents: contractRollover.updatedFreeAgents,
    updatedLoanedOut: contractRollover.updatedLoanedOut,
    nextStandings,
    nextFixtures,
    nextSecondaryStandings,
    nextSecondaryFixtures,
    nextCopaDoBrasil,
    nextLibertadores,
    nextChampionsLeague,
    nextMundial,
    nextSuperMundial,
    nextAccumulatedUclChampions,
    nextAccumulatedLibChampions,
    nextFinanceLedger,
    nextMatchState,
    nextMessages,
    nextDivision,
    nextYouthAcademy,
    newSeasonEvolutionReport,
  };
}


