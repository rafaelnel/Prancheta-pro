import {
  generateLeagueSchedule,
  getInitialStandingsForDivision,
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
  applyAntiInflationSeasonMaintenance,
  calculateDynamicSponsorship,
  evaluatePlayerRetirementProbability,
  processSeasonEvolutionAndAging,
} from './economyAndEvolution';
import { generateYouthRegens } from './youthAcademyEngine';
import {
  getRenewalEligiblePlayers,
  processSeasonEndContracts,
} from './contractEngine';
import { createInitialMatchState } from './matchEngine';
import { formatCompactBRL } from '../utils/formatters';
import {
  ChampionsLeagueState,
  Club,
  ClubFinanceLedger,
  CopaDoBrasilState,
  InboxMessage,
  LibertadoresState,
  LiveMatchState,
  MundialState,
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

    // Pick 11 starters + up to 3 subs
    const starters = roster.filter((p) => p.isStarter).slice(0, 11);
    const activeSet =
      starters.length >= 11 ? starters : roster.slice(0, Math.min(11, roster.length));
    const bench = roster.filter((p) => !activeSet.some((a) => a.id === p.id)).slice(0, 3);
    const participants = [...activeSet, ...bench];
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

    updated[clubId] = roster.map((p) => {
      if (!participantIds.has(p.id)) return p;
      const gCount = goalScorerIds.filter((id) => id === p.id).length;
      const aCount = assistIds.filter((id) => id === p.id).length;
      const ovr = calculatePlayerOverall(p.attributes, p.position);
      const baseMatchRating =
        6.55 +
        (ovr - 74) * 0.025 +
        resultBonus +
        (p.sector === 'GOL' || p.sector === 'DEF' ? cleanSheetBonus : 0) +
        gCount * 0.65 +
        aCount * 0.4 +
        (rng() - 0.5) * 0.45;
      const clampedRating = Math.max(5.2, Math.min(9.6, baseMatchRating));

      const prevM = p.seasonStats.matches;
      const nextM = prevM + 1;
      const nextAvg = Number(
        ((p.seasonStats.avgRating * prevM + clampedRating) / nextM).toFixed(2)
      );

      return {
        ...p,
        seasonStats: {
          ...p.seasonStats,
          matches: nextM,
          goals: p.seasonStats.goals + gCount,
          assists: p.seasonStats.assists + aCount,
          avgRating: nextAvg,
        },
      };
    });
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
    if (!c || c.division === 'LIB' || c.division === 'UCL' || c.division === 'WORLD') continue;
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
    previewEvolutionHighlights = [],
  } = params;

  const clubMap = new Map(clubs.map((c) => [c.id, c]));
  const userClub = clubMap.get(userClubId) || clubs[0];
  const userDiv: 'A' | 'B' = userClub.division === 'B' ? 'B' : 'A';

  const serieAStandings = userDiv === 'A' ? standings : secondaryStandings;
  const serieBStandings = userDiv === 'B' ? standings : secondaryStandings;

  const serieAChampionId = serieAStandings[0]?.clubId || '';
  const serieBChampionId = serieBStandings[0]?.clubId || '';
  const cdbChampionId = copaDoBrasil.championClubId;
  const libChampionId = libertadores.championClubId;
  const uclChampionId = championsLeague?.championClubId ?? null;
  const mundialChampionId = mundial?.championClubId ?? null;
  const superMundialChampionId = superMundial?.isActiveThisSeason
    ? superMundial.championClubId ?? null
    : null;

  const relegatedClubIds = serieAStandings.slice(-4).map((r) => r.clubId);
  const promotedClubIds = serieBStandings.slice(0, 4).map((r) => r.clubId);

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

  const userTable = userDiv === 'A' ? serieAStandings : serieBStandings;
  const userRank = Math.max(
    1,
    userTable.findIndex((r) => r.clubId === userClubId) + 1
  );
  const userFinalPoints = userTable[userRank - 1]?.points ?? 0;

  let userSeasonPrize = 0;
  if (userDiv === 'A') {
    // Premiação oficial escalonada do Brasileirão Série A (R$ 90M ao Campeão até cota de consolação ao Z-4)
    if (userRank === 1) userSeasonPrize = 90_000_000;
    else if (userRank === 2) userSeasonPrize = 82_000_000;
    else if (userRank === 3) userSeasonPrize = 76_000_000;
    else if (userRank === 4) userSeasonPrize = 70_000_000;
    else if (userRank <= 6) userSeasonPrize = 62_000_000;
    else if (userRank <= 8) userSeasonPrize = 52_000_000;
    else if (userRank <= 12) userSeasonPrize = 40_000_000;
    else if (userRank <= 16) userSeasonPrize = 30_000_000;
    else userSeasonPrize = 15_000_000;
  } else {
    // Premiação e bônus de acesso da Série B
    if (userRank === 1) userSeasonPrize = 28_000_000;
    else if (userRank <= 4) userSeasonPrize = 19_000_000;
    else if (userRank <= 10) userSeasonPrize = 11_500_000;
    else userSeasonPrize = 7_500_000;
  }

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
    userPromoted: userDiv === 'B' && promotedClubIds.includes(userClubId),
    userRelegated: userDiv === 'A' && relegatedClubIds.includes(userClubId),
    userQualifiedLibertadores: libertadoresQualifiedBrIds.includes(userClubId),
    relegatedClubIds,
    promotedClubIds,
    libertadoresQualifiedBrIds,
    awards,
    userEvolutionHighlights: previewEvolutionHighlights,
    thinkingRetirementNames: userSquad
      .filter((p) => evaluatePlayerRetirementProbability(p).isConsideringRetirement)
      .map((p) => `${p.name} (${p.position}, ${p.age}a)`),
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
  nextDivision: 'A' | 'B';
  nextYouthAcademy: import('../types/football').YouthAcademyState;
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

  // 4. Apply Anti-Inflation seasonal operational maintenance & cash/wage caps across ALL clubs
  let userMaintenanceCost = 0;
  const maintainedClubs = evoResult.updatedClubs.map((club) => {
    const sq =
      club.id === userClubId
        ? contractRollover.updatedUserSquad
        : contractRollover.updatedAiSquads[club.id] || [];
    const { updatedClub, annualMaintenanceCost } =
      applyAntiInflationSeasonMaintenance(club, sq);
    if (club.id === userClubId) {
      userMaintenanceCost = annualMaintenanceCost;
    }
    return updatedClub;
  });

  const updatedUserClub =
    maintainedClubs.find((c) => c.id === userClubId) || maintainedClubs[0];
  const nextDivision: 'A' | 'B' = updatedUserClub.division === 'B' ? 'B' : 'A';
  const otherDivision: 'A' | 'B' = nextDivision === 'A' ? 'B' : 'A';

  // 5. Dynamic Sponsorship for new season
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

  // Credit opening sponsorship installment
  const clubsAfterSponsor = maintainedClubs.map((c) =>
    c.id === userClubId
      ? { ...c, cashBalance: c.cashBalance + newSponsorship.monthlyInstallment }
      : c
  );
  const finalUserClub =
    clubsAfterSponsor.find((c) => c.id === userClubId) || updatedUserClub;

  const nextFinanceLedger: ClubFinanceLedger = {
    seasonYear: nextYear,
    seasonGateRevenue: 0,
    seasonTransferIncome: 0,
    seasonTransferSpend: 0,
    seasonPrizeRevenue: 0,
    seasonSponsorshipRevenue: newSponsorship.monthlyInstallment,
    seasonOperationalExpense: userMaintenanceCost,
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

  const nextChampionsLeague = createInitialChampionsLeague(
    nextYear,
    clubsAfterSponsor
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
    (a, b) => Math.abs(b.deltaOvr) - Math.abs(a.deltaOvr)
  );

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
      subject: `Abertura da Temporada ${nextYear} · Série ${nextDivision}`,
      category: 'Diretoria',
      priority: 'positive',
      read: false,
      body: [
        `Iniciamos a temporada ${nextYear}, ${managerName}! Novo contrato de patrocínio fechado com ${newSponsorship.sponsorName} (${newSponsorship.tierLabel}) no valor de ${formatCompactBRL(
          newSponsorship.annualValue
        )}/ano.`,
        `Estreia na 1ª Rodada da Série ${nextDivision}: contra ${oppName}.`,
      ],
      bulletPoints: [
        `Campeão Série A ${currentYear}: ${baseReport.serieAChampionName} · Campeão Série B ${currentYear}: ${baseReport.serieBChampionName}`,
        baseReport.userQualifiedLibertadores
          ? `${finalUserClub.shortName} classificado para a Copa Libertadores ${nextYear}!`
          : `Foco na Série ${nextDivision} e Copa do Brasil ${nextYear}.`,
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
      priority: 'normal',
      read: false,
      body: [
        `Todos os atletas completaram +1 ano de idade e passaram pela reavaliação técnica, tática e física de virada de temporada.`,
        sortedEvoHighlights[0]
          ? `Principal movimentação no elenco: ${sortedEvoHighlights[0].playerName} (${sortedEvoHighlights[0].deltaOvr >= 0 ? '+' : ''}${sortedEvoHighlights[0].deltaOvr} OVR, agora ${sortedEvoHighlights[0].newOvr}).`
          : 'Elenco avaliado e pronto para a pré-temporada.',
      ],
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
  };
}


