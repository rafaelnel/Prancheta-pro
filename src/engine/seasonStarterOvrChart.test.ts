import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewCareerSave } from '../data/careerFactory';
import { MatchHistoryRecord } from '../types/football';
import {
  buildStarterOvrEvolutionSeries,
  computeStarterMetrics,
  computeStarterOvrChartSummary,
} from './seasonStarterOvrChart';
import {
  AutoSimCareerSnapshot,
  getMaxSeasonDayOffset,
  simulateNextAutoStep,
} from './autoTacticsAndSim';
import { buildSeasonEndSummary } from './seasonLifecycle';

test('computeStarterMetrics accurately calculates starting XI average OVR and player rating average', () => {
  const career = createNewCareerSave(1, 'flamengo', 'Técnico');
  const squadWithRatings = career.squad.map((p, idx) =>
    p.isStarter
      ? {
          ...p,
          seasonStats: {
            ...p.seasonStats,
            matches: 12,
            avgRating: idx % 2 === 0 ? 7.4 : 7.0,
          },
        }
      : p
  );

  const metrics = computeStarterMetrics(squadWithRatings);
  assert.ok(
    metrics.userStarterAvgOvr >= 70 && metrics.userStarterAvgOvr <= 90,
    `Expected realistic starter avg OVR, got ${metrics.userStarterAvgOvr}`
  );
  assert.ok(
    metrics.userStarterAvgRating >= 7.1 && metrics.userStarterAvgRating <= 7.3,
    `Expected average rating near 7.2, got ${metrics.userStarterAvgRating}`
  );
});

test('buildStarterOvrEvolutionSeries aggregates monthly bars chronologically from recorded starter OVR and player rating history', () => {
  const career = createNewCareerSave(1, 'flamengo', 'Técnico');

  // Match history is stored newest-first in the app
  const matchHistory: MatchHistoryRecord[] = [
    {
      id: 'mh-4',
      fixtureId: 'f-4',
      seasonYear: 2026,
      dateLabel: 'Dom, 15 Nov 2026',
      competition: 'BRASILEIRAO',
      competitionLabel: 'Série A · 35ªR',
      roundNumber: 35,
      homeClubId: 'flamengo',
      awayClubId: 'palmeiras',
      homeGoals: 2,
      awayGoals: 0,
      userStarterAvgOvr: 82.6,
      userStarterAvgRating: 7.34,
      userMatchAvgRating: 7.52,
    },
    {
      id: 'mh-3',
      fixtureId: 'f-3',
      seasonYear: 2026,
      dateLabel: 'Qua, 12 Ago 2026',
      competition: 'BRASILEIRAO',
      competitionLabel: 'Série A · 22ªR',
      roundNumber: 22,
      homeClubId: 'flamengo',
      awayClubId: 'gremio',
      homeGoals: 3,
      awayGoals: 1,
      userStarterAvgOvr: 81.9,
      userStarterAvgRating: 7.18,
      userMatchAvgRating: 7.3,
    },
    {
      id: 'mh-2',
      fixtureId: 'f-2',
      seasonYear: 2026,
      dateLabel: 'Dom, 19 Abr 2026',
      competition: 'BRASILEIRAO',
      competitionLabel: 'Série A · 5ªR',
      roundNumber: 5,
      homeClubId: 'botafogo',
      awayClubId: 'flamengo',
      homeGoals: 1,
      awayGoals: 2,
      userStarterAvgOvr: 81.2,
      userStarterAvgRating: 7.02,
      userMatchAvgRating: 7.14,
    },
    {
      id: 'mh-1',
      fixtureId: 'f-1',
      seasonYear: 2026,
      dateLabel: 'Dom, 08 Fev 2026',
      competition: 'BRASILEIRAO',
      competitionLabel: 'Série A · 1ªR',
      roundNumber: 1,
      homeClubId: 'flamengo',
      awayClubId: 'santos',
      homeGoals: 1,
      awayGoals: 1,
      userStarterAvgOvr: 80.5,
      userStarterAvgRating: 6.82,
      userMatchAvgRating: 6.88,
    },
  ];

  const series = buildStarterOvrEvolutionSeries({
    seasonYear: 2026,
    userClubId: 'flamengo',
    userSquad: career.squad,
    matchHistory,
  });

  assert.equal(series.length, 4);
  assert.deepEqual(
    series.map((p) => p.label),
    ['Fev', 'Abr', 'Ago', 'Nov']
  );
  assert.equal(series[0].starterAvgOvr, 80.5);
  assert.equal(series[0].deltaOvr, 0);
  assert.equal(series[3].starterAvgOvr, 82.6);
  assert.equal(series[3].deltaOvr, 2.1);
  assert.ok(series[3].avgRating > series[0].avgRating);

  const summary = computeStarterOvrChartSummary(series);
  assert.ok(summary);
  assert.equal(summary!.startOvr, 80.5);
  assert.equal(summary!.endOvr, 82.6);
  assert.equal(summary!.netDeltaOvr, 2.1);
  assert.equal(summary!.peakOvr, 82.6);
  assert.equal(summary!.peakLabel, 'Nov');
  assert.equal(summary!.totalMatches, 4);
});

test('buildStarterOvrEvolutionSeries gracefully reconstructs series for legacy saves lacking per-match OVR snapshots', () => {
  const career = createNewCareerSave(1, 'palmeiras', 'Técnico');
  const legacySquad = career.squad.map((p) =>
    p.isStarter
      ? { ...p, seasonStats: { ...p.seasonStats, matches: 20, avgRating: 7.25 } }
      : p
  );

  const legacyHistory: MatchHistoryRecord[] = [
    {
      id: 'legacy-2',
      fixtureId: 'lf-2',
      seasonYear: 2026,
      dateLabel: 'Dom, 22 Nov 2026',
      competition: 'BRASILEIRAO',
      competitionLabel: 'Série A · 36ªR',
      roundNumber: 36,
      homeClubId: 'palmeiras',
      awayClubId: 'corinthians',
      homeGoals: 3,
      awayGoals: 0,
    },
    {
      id: 'legacy-1',
      fixtureId: 'lf-1',
      seasonYear: 2026,
      dateLabel: 'Dom, 15 Mar 2026',
      competition: 'BRASILEIRAO',
      competitionLabel: 'Série A · 3ªR',
      roundNumber: 3,
      homeClubId: 'palmeiras',
      awayClubId: 'bahia',
      homeGoals: 1,
      awayGoals: 1,
    },
  ];

  const series = buildStarterOvrEvolutionSeries({
    seasonYear: 2026,
    userClubId: 'palmeiras',
    userSquad: legacySquad,
    matchHistory: legacyHistory,
  });

  assert.equal(series.length, 2);
  assert.equal(series[0].label, 'Mar');
  assert.equal(series[1].label, 'Nov');
  assert.ok(series[1].avgRating > series[0].avgRating);
  assert.ok(series[1].starterAvgOvr >= series[0].starterAvgOvr);
});

test('Full-season auto-sim records starter OVR and rating history on matchHistory and populates SeasonEndReport.starterOvrHistory', () => {
  const career = createNewCareerSave(1, 'olympique-marseille', 'Manager');
  let snapshot: AutoSimCareerSnapshot = {
    clubs: career.clubs,
    userClubId: career.userClubId,
    squad: career.squad,
    loanedOutPlayers: career.loanedOutPlayers,
    aiSquads: career.aiSquads,
    standings: career.standings,
    fixtures: career.fixtures,
    secondaryStandings: career.secondaryStandings || [],
    secondaryFixtures: career.secondaryFixtures || [],
    copaDoBrasil: career.copaDoBrasil!,
    libertadores: career.libertadores!,
    championsLeague: career.championsLeague,
    mundial: career.mundial,
    superMundial: career.superMundial,
    messages: career.messages,
    matchState: career.matchState,
    matchHistory: career.matchHistory,
    seasonYear: career.currentYear,
    seasonStepIndex: career.seasonStepIndex ?? 0,
    currentRound: career.currentRound,
    dayOffset: career.dayOffset,
    isMatchDay: career.isMatchDay,
    transferredOutClubPlayerIds: career.transferredOutClubPlayerIds ?? [],
    pendingOffers: career.pendingOffers,
    transferHistory: career.transferHistory,
    financeLedger: career.financeLedger,
    youthAcademy: career.youthAcademy,
  };

  const endDay = getMaxSeasonDayOffset(2026);
  let guard = 0;
  while (guard < 120) {
    guard++;
    const stepRes = simulateNextAutoStep(snapshot, endDay, () => 0.45);
    snapshot = stepRes.snapshot;
    if (stepRes.done) break;
  }

  const mh = snapshot.matchHistory || [];
  assert.ok(mh.length >= 34, `Expected >= 34 user match history records, got ${mh.length}`);
  assert.ok(
    mh.every((m) => typeof m.userStarterAvgOvr === 'number' && m.userStarterAvgOvr > 60),
    'Every simulated match history record must capture userStarterAvgOvr'
  );
  assert.ok(
    mh.every((m) => typeof m.userStarterAvgRating === 'number' && m.userStarterAvgRating >= 5),
    'Every simulated match history record must capture userStarterAvgRating'
  );

  const report = buildSeasonEndSummary({
    seasonYear: 2026,
    clubs: snapshot.clubs,
    userClubId: snapshot.userClubId,
    userSquad: snapshot.squad,
    aiSquads: snapshot.aiSquads || {},
    standings: snapshot.standings,
    secondaryStandings: snapshot.secondaryStandings,
    copaDoBrasil: snapshot.copaDoBrasil,
    libertadores: snapshot.libertadores,
    championsLeague: snapshot.championsLeague,
    mundial: snapshot.mundial,
    superMundial: snapshot.superMundial,
    matchHistory: mh,
  });

  assert.ok(
    report.starterOvrHistory && report.starterOvrHistory.length >= 6,
    `Expected >= 6 monthly bars in starterOvrHistory, got ${report.starterOvrHistory?.length}`
  );
  const summary = computeStarterOvrChartSummary(report.starterOvrHistory!);
  assert.ok(summary && summary.totalMatches >= 34);
  assert.ok(summary!.overallAvgRating >= 6.0 && summary!.overallAvgRating <= 8.5);
});
