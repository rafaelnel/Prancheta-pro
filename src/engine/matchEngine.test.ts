import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_CLUBS,
  INITIAL_STANDINGS,
  INITIAL_USER_SQUAD,
  SERIE_A_CLUBS,
  SERIE_B_CLUBS,
  USER_CLUB_ID,
  generateLeagueSchedule,
  getInitialStandingsForDivision,
  getRealSquadForClub,
} from '../data/initialDatabase';
import { TACTICAL_ROLES } from '../data/tacticsData';
import {
  calculatePlayerOverall,
  calculateRoleSuitability,
  calculateTeamTacticalRatings,
  createInitialMatchState,
  rawScoreToOvr,
  simulateRoundFixtures,
  stepMatchMinute,
  updateStandingsWithRound,
} from './matchEngine';
import type { PlayerAttributes } from '../types/football';

test('Database contains 40 official 2026 clubs (20 Série A + 20 Série B) and 880 real players with 18 attributes (1-20)', () => {
  assert.equal(SERIE_A_CLUBS.length, 20);
  assert.equal(SERIE_B_CLUBS.length, 20);
  assert.equal(INITIAL_CLUBS.length, 40);
  assert.equal(INITIAL_STANDINGS.length, 20);
  assert.equal(getInitialStandingsForDivision('B').length, 20);
  assert.equal(INITIAL_USER_SQUAD.length, 22);

  // Verify 2026 promoted clubs to Série A (Coritiba, Athletico-PR, Chapecoense, Remo)
  const serieAIds = new Set(SERIE_A_CLUBS.map((c) => c.id));
  for (const id of ['coritiba', 'athletico-pr', 'chapecoense', 'remo']) {
    assert.ok(serieAIds.has(id), `Expected ${id} in 2026 Série A`);
  }

  // Verify 2026 Série B includes relegated from A (Fortaleza, Sport, Ceará, Juventude) and promoted from C (Ponte Preta, Náutico, Londrina, São Bernardo)
  const serieBIds = new Set(SERIE_B_CLUBS.map((c) => c.id));
  for (const id of [
    'fortaleza',
    'sport',
    'ceara',
    'juventude',
    'ponte-preta',
    'nautico',
    'londrina',
    'sao-bernardo',
  ]) {
    assert.ok(serieBIds.has(id), `Expected ${id} in 2026 Série B`);
  }

  // Verify season starts with 0 matches played
  assert.ok(
    INITIAL_STANDINGS.every((row) => row.played === 0 && row.points === 0),
    'Expected Série A standings to start at 0 played / 0 points for the beginning of 2026 season'
  );
  assert.ok(
    getInitialStandingsForDivision('B').every(
      (row) => row.played === 0 && row.points === 0
    ),
    'Expected Série B standings to start at 0 played / 0 points for the beginning of 2026 season'
  );

  for (const club of INITIAL_CLUBS) {
    const squad = getRealSquadForClub(club);
    assert.equal(squad.length, 22, `Expected 22 players for ${club.name}`);
    assert.equal(
      squad.filter((p) => p.isStarter).length,
      11,
      `Expected 11 starters for ${club.name}`
    );

    for (const player of squad) {
      assert.equal(player.seasonStats.matches, 0);
      const attrKeys = Object.keys(player.attributes);
      assert.equal(attrKeys.length, 18);
      for (const val of Object.values(player.attributes)) {
        assert.ok(
          val >= 1 && val <= 20,
          `Attribute out of 1..20 range for ${player.name} (${club.name})`
        );
      }
      const ovr = calculatePlayerOverall(player.attributes, player.position);
      assert.ok(
        ovr >= 60 && ovr <= 99,
        `OVR ${ovr} out of 60..99 range for ${player.name} (${club.name})`
      );
    }
  }

  // Peak Messi / Pelé check: 20 across all attributes => OVR 99
  const peakLegendAttributes: PlayerAttributes = {
    passe: 20,
    finalizacao: 20,
    drible: 20,
    desarme: 20,
    primeiroToque: 20,
    cruzamento: 20,
    decisoes: 20,
    visaoDeJogo: 20,
    compostura: 20,
    semBola: 20,
    posicionamento: 20,
    indiceDeTrabalho: 20,
    velocidade: 20,
    aceleracao: 20,
    resistencia: 20,
    forca: 20,
    impulsao: 20,
    agilidade: 20,
  };
  assert.equal(calculatePlayerOverall(peakLegendAttributes, 'MEI'), 99);
  assert.equal(calculatePlayerOverall(peakLegendAttributes, 'ATA'), 99);
  assert.equal(rawScoreToOvr(12), 60);
  assert.equal(rawScoreToOvr(20), 99);
});

test('Role suitability and team tactical ratings respond to mentality and role changes', () => {
  const striker = INITIAL_USER_SQUAD.find((p) => p.sector === 'ATA' && p.isStarter)!;
  const attackerRole = TACTICAL_ROLES.find((r) => r.id === 'atacante-completo')!;
  const gkRole = TACTICAL_ROLES.find((r) => r.id === 'goleiro-libero')!;

  const strikerFit = calculateRoleSuitability(striker, attackerRole);
  const gkFit = calculateRoleSuitability(striker, gkRole);

  assert.ok(strikerFit.score > gkFit.score);
  const strikerOvr = calculatePlayerOverall(striker.attributes, striker.position);
  assert.ok(strikerOvr >= 75 && strikerOvr <= 95);

  const balancedRatings = calculateTeamTacticalRatings(INITIAL_USER_SQUAD, '4-3-3', {
    mentality: 'Equilibrada',
    defensiveLine: 'Padrão',
    pressingIntensity: 'Moderada',
    passingStyle: 'Curto e Apoiado',
  });

  const offensiveRatings = calculateTeamTacticalRatings(INITIAL_USER_SQUAD, '4-3-3', {
    mentality: 'Ofensiva',
    defensiveLine: 'Alta',
    pressingIntensity: 'Extrema',
    passingStyle: 'Curto e Apoiado',
  });

  assert.ok(offensiveRatings.attack > balancedRatings.attack);
});

test('2D Match Engine initializes 22 real tokens (including real opponent squad) for Round 1 of 2026 and simulates 0 to 90 minutes', () => {
  const schedule = generateLeagueSchedule(USER_CLUB_ID, 'A');
  const r1UserMatch = schedule.find((f) => f.roundNumber === 1 && f.isUserMatch)!;
  const homeClub = INITIAL_CLUBS.find((c) => c.id === r1UserMatch.homeClubId)!;
  const awayClub = INITIAL_CLUBS.find((c) => c.id === r1UserMatch.awayClubId)!;

  let match = createInitialMatchState(
    1,
    r1UserMatch,
    homeClub,
    awayClub,
    INITIAL_USER_SQUAD,
    USER_CLUB_ID
  );

  assert.equal(match.homeTokens.length, 11);
  assert.equal(match.awayTokens.length, 11);
  assert.equal(match.minute, 0);

  const oppTokens = match.isUserHome ? match.awayTokens : match.homeTokens;
  assert.ok(
    oppTokens.every((t) => !t.name.startsWith('Atleta ')),
    'Opponent pitch tokens should use real player names'
  );

  // Deterministic RNG
  let seed = 42;
  const rng = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  match.phase = 'FIRST_HALF';
  match.isRunning = true;

  for (let m = 1; m <= 45; m++) {
    match = stepMatchMinute(match, homeClub, awayClub, INITIAL_USER_SQUAD, rng);
  }
  assert.equal(match.minute, 45);

  // Next step triggers HALF_TIME
  match = stepMatchMinute(match, homeClub, awayClub, INITIAL_USER_SQUAD, rng);
  assert.equal(match.phase, 'HALF_TIME');
  assert.equal(match.isRunning, false);

  // Resume second half
  match.phase = 'SECOND_HALF';
  match.isRunning = true;
  while (match.phase !== 'FULL_TIME') {
    match = stepMatchMinute(match, homeClub, awayClub, INITIAL_USER_SQUAD, rng);
  }

  assert.equal(match.minute, 90);
  assert.equal(match.phase, 'FULL_TIME');
  assert.ok(match.homePasses + match.awayPasses > 100);
});

test('Round 1 simulation simulates all 10 matches of the opening round and updates 20-club table', () => {
  const schedule = generateLeagueSchedule(USER_CLUB_ID, 'A');
  const r1UserMatch = schedule.find((f) => f.roundNumber === 1 && f.isUserMatch)!;

  // In CBF 2026 Round 1, São Paulo hosts Flamengo (sao-paulo vs flamengo)
  const userIsHome = r1UserMatch.homeClubId === USER_CLUB_ID;
  const homeGoals = userIsHome ? 2 : 1;
  const awayGoals = userIsHome ? 1 : 2;

  const updatedFixtures = simulateRoundFixtures(
    schedule,
    1,
    {
      fixtureId: r1UserMatch.id,
      homeGoals,
      awayGoals,
      homeXG: 1.95,
      awayXG: 1.12,
    },
    INITIAL_CLUBS
  );

  const r1Completed = updatedFixtures.filter((f) => f.roundNumber === 1);
  assert.equal(r1Completed.length, 10);
  assert.ok(r1Completed.every((f) => f.played && f.homeGoals !== null && f.awayGoals !== null));

  const newStandings = updateStandingsWithRound(INITIAL_STANDINGS, r1Completed);
  assert.equal(newStandings.length, 20);
  assert.ok(newStandings.every((row) => row.played === 1));

  const userRow = newStandings.find((r) => r.clubId === USER_CLUB_ID)!;
  assert.equal(userRow.points, 3); // 0 + 3 for winning Round 1
});

test('Career factory generates complete real squads and schedules starting at Round 1 for 2026 Série A and Série B clubs', async () => {
  const { createNewCareerSave } = await import('../data/careerFactory');
  const clubsToTest = ['flamengo', 'palmeiras', 'coritiba', 'fortaleza', 'ponte-preta'];

  for (const clubId of clubsToTest) {
    const career = createNewCareerSave(2, clubId, 'Técnico Teste');
    const club = INITIAL_CLUBS.find((c) => c.id === clubId)!;

    assert.equal(career.slotIndex, 2);
    assert.equal(career.userClubId, clubId);
    assert.equal(career.division, club.division);
    assert.equal(career.currentRound, 1);
    assert.equal(career.managerName, 'Técnico Teste');
    assert.equal(career.squad.length, 22);
    assert.equal(career.squad.filter((p) => p.isStarter).length, 11);
    assert.equal(career.standings.length, 20);
    assert.equal(career.secondaryStandings?.length, 20);

    const r1UserMatch = career.fixtures.find(
      (f) => f.roundNumber === 1 && f.isUserMatch
    );
    assert.ok(r1UserMatch, `Round 1 user match missing for ${clubId}`);
    assert.ok(
      r1UserMatch.homeClubId === clubId || r1UserMatch.awayClubId === clubId
    );
    assert.equal(
      career.matchState.isUserHome,
      r1UserMatch.homeClubId === clubId
    );
    assert.equal(career.messages.length, 3);
  }
});

test('Save manager supports 4 independent Série A/B career slots, latest save detection, backup, and deletion', async () => {
  const { createNewCareerSave } = await import('../data/careerFactory');
  const {
    saveCareerToSlot,
    loadAllCareerSlots,
    loadCareerSlot,
    getLatestCareerSave,
    deleteCareerSlot,
    serializeCareerBackup,
    parseCareerBackup,
  } = await import('../utils/saveManager');

  const store = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
  };

  assert.equal(getLatestCareerSave(mockStorage), null);
  assert.deepEqual(loadAllCareerSlots(mockStorage), [null, null, null, null]);

  const career1 = createNewCareerSave(1, 'flamengo', 'Carlos');
  saveCareerToSlot(career1, mockStorage);

  const career3 = createNewCareerSave(3, 'ponte-preta', 'Fernanda');
  career3.currentRound = 4;
  const saved3 = saveCareerToSlot(career3, mockStorage);

  const allSlots = loadAllCareerSlots(mockStorage);
  assert.equal(allSlots[0]?.userClubId, 'flamengo');
  assert.equal(allSlots[0]?.division, 'A');
  assert.equal(allSlots[1], null);
  assert.equal(allSlots[2]?.userClubId, 'ponte-preta');
  assert.equal(allSlots[2]?.division, 'B');
  assert.equal(allSlots[3], null);

  const loaded3 = loadCareerSlot(3, mockStorage);
  assert.equal(loaded3?.currentRound, 4);
  assert.equal(loaded3?.managerName, 'Fernanda');

  const backupJson = serializeCareerBackup(saved3);
  const importedToSlot4 = parseCareerBackup(backupJson, 4);
  assert.ok(importedToSlot4);
  assert.equal(importedToSlot4?.slotIndex, 4);
  assert.equal(importedToSlot4?.userClubId, 'ponte-preta');

  deleteCareerSlot(1, mockStorage);
  assert.equal(loadCareerSlot(1, mockStorage), null);
  const latestAfterDelete = getLatestCareerSave(mockStorage);
  assert.equal(latestAfterDelete?.slotIndex, 3);
});

test('Copa Libertadores 2026 covers all 10 CONMEBOL countries, 32 clubs, 8 groups, 6 rounds and knockout bracket to champion', async () => {
  const {
    ALL_WORLD_CLUBS,
    CONMEBOL_FOREIGN_CLUBS,
    LIBERTADORES_BR_CLUB_IDS,
  } = await import('../data/initialDatabase');
  const {
    createInitialLibertadores,
    advanceLibertadoresGroupRound,
    advanceLibertadoresKnockoutStage,
    LIBERTADORES_KNOCKOUT_STAGES,
  } = await import('../data/cupFactory');

  // 8 Brazilian clubs + 24 foreign clubs = 32 clubs across all 10 CONMEBOL countries
  assert.equal(LIBERTADORES_BR_CLUB_IDS.length, 8);
  assert.equal(CONMEBOL_FOREIGN_CLUBS.length, 24);
  assert.equal(ALL_WORLD_CLUBS.length, 64);

  const foreignCountries = new Set(CONMEBOL_FOREIGN_CLUBS.map((c) => c.countryCode));
  for (const code of ['ARG', 'URU', 'COL', 'ECU', 'PAR', 'CHI', 'PER', 'BOL', 'VEN']) {
    assert.ok(foreignCountries.has(code), `Expected CONMEBOL nation ${code} in Libertadores`);
  }
  assert.equal(foreignCountries.size, 9); // + BRA = 10 CONMEBOL nations

  // All 24 foreign clubs have complete starter + bench real squads (13-15 players) & 60-99 ratings
  for (const club of CONMEBOL_FOREIGN_CLUBS) {
    const squad = getRealSquadForClub(club);
    assert.ok(squad.length >= 13, `Expected at least 13 real players for ${club.name}, got ${squad.length}`);
    assert.equal(squad.filter((p) => p.isStarter).length, 11);
    for (const p of squad) {
      const ovr = calculatePlayerOverall(p.attributes, p.position);
      assert.ok(ovr >= 60 && ovr <= 99, `OVR ${ovr} out of bounds for ${p.name}`);
    }
  }

  let lib = createInitialLibertadores('flamengo');
  assert.equal(lib.participantIds.length, 32);
  assert.equal(lib.groups.length, 8);
  for (const grp of lib.groups) {
    assert.equal(grp.clubIds.length, 4);
    assert.equal(grp.fixtures.length, 12); // 6 rounds x 2 matches
  }

  let seed = 101;
  const rng = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let r = 1; r <= 6; r++) {
    lib = advanceLibertadoresGroupRound(lib, r, null, ALL_WORLD_CLUBS, 'flamengo', rng);
  }
  assert.equal(lib.currentPhase, 'Oitavas');
  assert.equal(lib.knockoutFixtures.Oitavas.length, 8);
  assert.equal(lib.eliminatedIds.length, 16);

  for (const stage of LIBERTADORES_KNOCKOUT_STAGES) {
    lib = advanceLibertadoresKnockoutStage(lib, stage, null, ALL_WORLD_CLUBS, 'flamengo', rng);
  }
  assert.ok(lib.championClubId, 'Libertadores should crown a champion');
  assert.ok(lib.knockoutFixtures.Final[0]?.played);
  assert.ok(lib.knockoutFixtures.Final[0]?.winnerClubId);
});

test('Copa do Brasil 2026 includes 32 clubs (always guaranteeing Série B user clubs) and resolves ties via penalties through Final', async () => {
  const { ALL_WORLD_CLUBS } = await import('../data/initialDatabase');
  const {
    createInitialCopaDoBrasil,
    advanceCopaDoBrasilStage,
    COPA_DO_BRASIL_STAGES,
  } = await import('../data/cupFactory');

  // Série B club should still be included in the 32-team Copa do Brasil bracket
  let cdb = createInitialCopaDoBrasil('ponte-preta');
  assert.equal(cdb.participantIds.length, 32);
  assert.ok(cdb.participantIds.includes('ponte-preta'));
  assert.equal(cdb.currentStage, '3ª Fase');
  assert.equal(cdb.fixturesByStage['3ª Fase'].length, 16);

  let seed = 2026;
  const rng = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (const stage of COPA_DO_BRASIL_STAGES) {
    cdb = advanceCopaDoBrasilStage(cdb, stage, null, ALL_WORLD_CLUBS, 'ponte-preta', rng);
  }

  assert.ok(cdb.championClubId, 'Copa do Brasil should crown a champion');
  assert.equal(cdb.fixturesByStage.Final.length, 1);
  assert.ok(cdb.fixturesByStage.Final[0].played);
  assert.ok(cdb.fixturesByStage.Final[0].winnerClubId);
});

test('2D Match Engine supports Libertadores foreign opponent and resolves knockout draw via penalty shootout at 90 minutes', async () => {
  const { ALL_WORLD_CLUBS } = await import('../data/initialDatabase');
  const river = ALL_WORLD_CLUBS.find((c) => c.id === 'river-plate')!;
  const flamengo = ALL_WORLD_CLUBS.find((c) => c.id === 'flamengo')!;

  const koFixture = {
    id: 'lib-oitavas-test',
    division: 'LIB' as const,
    competition: 'LIBERTADORES' as const,
    stageLabel: 'Oitavas',
    roundNumber: 1,
    homeClubId: flamengo.id,
    awayClubId: river.id,
    homeGoals: null,
    awayGoals: null,
    homePenalties: null,
    awayPenalties: null,
    winnerClubId: null,
    played: false,
    isUserMatch: true,
  };

  let match = createInitialMatchState(
    1,
    koFixture,
    flamengo,
    river,
    INITIAL_USER_SQUAD,
    flamengo.id
  );
  assert.equal(match.isKnockout, true);
  assert.equal(match.competition, 'LIBERTADORES');
  assert.ok(match.awayTokens.every((t) => !t.name.startsWith('Atleta ')));

  // Jump to minute 89 with a tied score (1-1) to verify shootout trigger at 90'
  match.minute = 89;
  match.homeGoals = 1;
  match.awayGoals = 1;
  match.phase = 'SECOND_HALF';
  match.isRunning = true;

  // Use RNG that triggers penalty win without scoring at minute 90
  const stableDrawRng = () => 0.99;
  match = stepMatchMinute(match, flamengo, river, INITIAL_USER_SQUAD, stableDrawRng);

  assert.equal(match.phase, 'FULL_TIME');
  assert.equal(match.minute, 90);
  assert.ok(match.winnerClubId, 'Tied knockout match must decide a winner via penalties');
  assert.ok(
    match.homePenalties !== null && match.awayPenalties !== null && match.homePenalties !== match.awayPenalties,
    'Penalty shootout scores must be distinct'
  );
});

test('SEASON_CALENDAR spans all 12 months of 2026 chronologically across Brasileirão, Copa do Brasil, and Libertadores', async () => {
  const { SEASON_CALENDAR } = await import('../data/cupFactory');
  assert.equal(SEASON_CALENDAR.length, 34);

  const monthsSeen = new Set<number>();
  let prevOffset = -1;
  for (const step of SEASON_CALENDAR) {
    assert.ok(
      typeof step.dayOffset === 'number' && step.dayOffset > prevOffset,
      `Expected monotonic dayOffset for ${step.label}`
    );
    prevOffset = step.dayOffset;
    const d = new Date(2026, 0, 28);
    d.setDate(d.getDate() + step.dayOffset);
    assert.equal(d.getFullYear(), 2026);
    monthsSeen.add(d.getMonth());
  }

  assert.equal(monthsSeen.size, 12, 'Expected fixtures across all 12 months (Jan-Dec 2026)');
});

test('Opponent Scout generates standings-based analytical summary and detects defensive/form weaknesses', async () => {
  const { ALL_WORLD_CLUBS } = await import('../data/initialDatabase');
  const {
    generateOpponentScoutingSummary,
    resolveOpponentStandingsContext,
  } = await import('./opponentScout');
  const { createInitialLibertadores } = await import('../data/cupFactory');

  const flamengo = ALL_WORLD_CLUBS.find((c) => c.id === 'flamengo')!;
  const saoPaulo = ALL_WORLD_CLUBS.find((c) => c.id === 'sao-paulo')!;

  // 1. Mid-season standings where São Paulo has conceded heavily & is in poor form
  const customStandings = INITIAL_STANDINGS.map((row) => {
    if (row.clubId === 'flamengo') {
      return {
        ...row,
        played: 6,
        won: 5,
        drawn: 1,
        lost: 0,
        goalsFor: 14,
        goalsAgainst: 4,
        goalDifference: 10,
        points: 16,
        form: ['V', 'V', 'E'] as ('V' | 'E' | 'D')[],
      };
    }
    if (row.clubId === 'sao-paulo') {
      return {
        ...row,
        played: 6,
        won: 1,
        drawn: 1,
        lost: 4,
        goalsFor: 4,
        goalsAgainst: 13,
        goalDifference: -9,
        points: 4,
        form: ['D', 'E', 'D'] as ('V' | 'E' | 'D')[],
      };
    }
    return { ...row, played: 6, won: 3, drawn: 1, lost: 2, goalsFor: 8, goalsAgainst: 7, goalDifference: 1, points: 10 };
  }).sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference);

  const report = generateOpponentScoutingSummary({
    opponentClub: saoPaulo,
    userClub: flamengo,
    opponentTable: customStandings,
    tableLabel: 'Brasileirão Série A',
    userSquad: INITIAL_USER_SQUAD,
  });

  assert.equal(report.played, 6);
  assert.equal(report.position, 20);
  assert.ok(report.summary.includes('São Paulo'));
  assert.ok(report.summary.includes('13 GC'));
  assert.ok(report.weaknesses.some((w) => w.id === 'leaky-defense'));
  assert.ok(report.weaknesses.some((w) => w.id === 'low-attack'));
  assert.ok(report.weaknesses.some((w) => w.id === 'poor-form'));

  // 2. Libertadores cross-country opponent resolves to its Libertadores group table
  const ldu = ALL_WORLD_CLUBS.find((c) => c.id === 'ldu-quito')!;
  const lib = createInitialLibertadores('flamengo');
  const ctx = resolveOpponentStandingsContext({
    opponentClub: ldu,
    userClub: flamengo,
    activeCompetition: 'LIBERTADORES',
    standings: INITIAL_STANDINGS,
    libertadores: lib,
  });
  assert.equal(ctx.label, 'Libertadores · Grupo A');
  assert.equal(ctx.table.length, 4);
});

test('Transfer Catalog & Difficulty Engine evaluate Club x Club and Player x Squad gaps, enforce cash/payroll caps, and execute buys/loans/sales', async () => {
  const { ALL_WORLD_CLUBS } = await import('../data/initialDatabase');
  const {
    createInitialFreeAgents,
    getInternationalMarketListings,
    INTERNATIONAL_MARKET_CLUBS,
  } = await import('../data/transferCatalog');
  const {
    buildAllMarketListings,
    evaluateOutgoingPlayer,
    evaluateTransferNegotiation,
    executeIncomingTransfer,
    executeOutgoingTransfer,
    getEffectivePayroll,
  } = await import('./transferEngine');
  const { createNewCareerSave } = await import('../data/careerFactory');

  // 1. International & Free Agents catalogs integrity
  const intl = getInternationalMarketListings();
  const freeAgents = createInitialFreeAgents();
  assert.ok(INTERNATIONAL_MARKET_CLUBS.length >= 12);
  assert.ok(intl.length >= 40);
  assert.equal(freeAgents.length, 20);
  for (const item of intl) {
    assert.ok(item.ovr >= 60 && item.ovr <= 99);
    assert.equal(Object.keys(item.player.attributes).length, 18);
  }

  // 2. Build market listings for Ponte Preta (Série B) vs Flamengo (Série A)
  const ponteCareer = createNewCareerSave(1, 'ponte-preta', 'Técnico');
  const flamengoCareer = createNewCareerSave(2, 'flamengo', 'Técnico');
  const ponteClub = ponteCareer.clubs.find((c) => c.id === 'ponte-preta')!;
  const flamengoClub = flamengoCareer.clubs.find((c) => c.id === 'flamengo')!;

  const flamengoListings = buildAllMarketListings({
    clubs: flamengoCareer.clubs,
    userClubId: flamengoClub.id,
    freeAgents,
    transferredOutClubPlayerIds: [],
  });
  const ponteListings = buildAllMarketListings({
    clubs: ponteCareer.clubs,
    userClubId: ponteClub.id,
    freeAgents,
    transferredOutClubPlayerIds: [],
  });

  // Excludes user club's own players
  assert.ok(flamengoListings.every((l) => l.originClub?.id !== 'flamengo'));

  // 3. Club x Club & Player x Squad Difficulty comparison:
  // Buying an international starter (e.g. Martinelli at Arsenal) as Série B Ponte Preta is harder than as Flamengo
  const intlStarter = intl.find((l) => l.isClubStarter && l.ovr >= 80)!;
  const ponteVsStar = evaluateTransferNegotiation({
    userClub: { ...ponteClub, cashBalance: 500_000_000, wageBudget: 50_000_000 },
    userSquad: ponteCareer.squad,
    listing: intlStarter,
    dealMode: 'BUY',
  });
  const flamengoVsStar = evaluateTransferNegotiation({
    userClub: { ...flamengoClub, cashBalance: 500_000_000, wageBudget: 50_000_000 },
    userSquad: flamengoCareer.squad,
    listing: intlStarter,
    dealMode: 'BUY',
  });
  assert.ok(
    ponteVsStar.resistanceScore > flamengoVsStar.resistanceScore,
    'Smaller club should face higher resistance for international star'
  );
  assert.ok(
    ponteVsStar.acceptanceChance < flamengoVsStar.acceptanceChance,
    'Smaller club should have lower acceptance probability'
  );

  // Loan of a young international reserve with +30% offer & 100% salary is much easier than buying a starter
  const intlLoanProspect = intl.find((l) => l.loanAvailable && !l.isClubStarter)!;
  const loanStd = evaluateTransferNegotiation({
    userClub: { ...flamengoClub, cashBalance: 500_000_000, wageBudget: 50_000_000 },
    userSquad: flamengoCareer.squad,
    listing: intlLoanProspect,
    dealMode: 'LOAN',
    offerTier: 'PADRAO',
    loanWageShare: 0.5,
  });
  const loanStrong = evaluateTransferNegotiation({
    userClub: { ...flamengoClub, cashBalance: 500_000_000, wageBudget: 50_000_000 },
    userSquad: flamengoCareer.squad,
    listing: intlLoanProspect,
    dealMode: 'LOAN',
    offerTier: 'AGRESSIVA_30',
    loanWageShare: 1.0,
  });
  assert.ok(loanStrong.acceptanceChance >= loanStd.acceptanceChance);

  // 4. Financial guardrails: low cash & exceeded wage budget block transfer
  const noCashEval = evaluateTransferNegotiation({
    userClub: { ...flamengoClub, cashBalance: 100_000 },
    userSquad: flamengoCareer.squad,
    listing: intlStarter,
    dealMode: 'BUY',
  });
  assert.equal(noCashEval.canAffordCash, false);
  assert.equal(noCashEval.isBlocked, true);

  const freeTarget = flamengoListings.find((l) => l.scope === 'LIVRES')!;
  const tightWageEval = evaluateTransferNegotiation({
    userClub: {
      ...flamengoClub,
      wageBudget: getEffectivePayroll(flamengoCareer.squad),
    },
    userSquad: flamengoCareer.squad,
    listing: freeTarget,
    dealMode: 'FREE',
  });
  assert.equal(tightWageEval.fitsWageBudget, false);
  assert.equal(tightWageEval.isBlocked, true);

  // 5. Buying a starter from a Serie A rival (Palmeiras) removes them from rival pitch tokens
  const palmeirasStarterListing = flamengoListings.find(
    (l) => l.originClub?.id === 'palmeiras' && l.isClubStarter
  )!;
  const richFlamengo = {
    ...flamengoClub,
    cashBalance: 300_000_000,
    wageBudget: 40_000_000,
  };
  const buyEval = evaluateTransferNegotiation({
    userClub: richFlamengo,
    userSquad: flamengoCareer.squad,
    listing: palmeirasStarterListing,
    dealMode: 'BUY',
    offerTier: 'AGRESSIVA_30',
  });
  const buyExec = executeIncomingTransfer({
    userClub: richFlamengo,
    userSquad: flamengoCareer.squad,
    freeAgents,
    transferredOutClubPlayerIds: [],
    listing: palmeirasStarterListing,
    dealMode: 'BUY',
    evaluation: buyEval,
    rng: () => 0.01,
  });
  assert.equal(buyExec.accepted, true);
  assert.ok(buyExec.signedPlayer);
  assert.equal(buyExec.updatedSquad.length, 23);
  assert.ok(
    buyExec.updatedTransferredOutIds.includes(palmeirasStarterListing.player.id)
  );

  // Verify createInitialMatchState skips the transferred Palmeiras player in awayTokens
  const palmeirasClub = ALL_WORLD_CLUBS.find((c) => c.id === 'palmeiras')!;
  const matchVsPal = createInitialMatchState(
    1,
    {
      id: 'test-fix',
      roundNumber: 1,
      homeClubId: flamengoClub.id,
      awayClubId: palmeirasClub.id,
      homeGoals: null,
      awayGoals: null,
      played: false,
      isUserMatch: true,
    },
    flamengoClub,
    palmeirasClub,
    buyExec.updatedSquad,
    flamengoClub.id,
    buyExec.updatedTransferredOutIds
  );
  assert.ok(
    matchVsPal.awayTokens.every((t) => t.id !== palmeirasStarterListing.player.id),
    'Sold rival player must not appear in rival 2D pitch tokens'
  );

  // 6. Outgoing loan reduces payroll by 90% and outgoing sale of a starter auto-promotes replacement
  const starterToSell = buyExec.updatedSquad.find((p) => p.isStarter && p.sector === 'MEI')!;
  const sellRes = executeOutgoingTransfer({
    userClub: buyExec.updatedClub,
    userSquad: buyExec.updatedSquad,
    loanedOutPlayers: [],
    player: starterToSell,
    action: 'VENDA',
  });
  assert.equal(sellRes.success, true);
  assert.equal(sellRes.updatedSquad.length, 22);
  assert.equal(sellRes.updatedSquad.filter((p) => p.isStarter).length, 11);
  assert.ok(sellRes.promotedStarterName);

  const reserveToLoanOut = sellRes.updatedSquad.find((p) => !p.isStarter && p.position !== 'GOL')!;
  const payrollBeforeLoanOut = getEffectivePayroll(sellRes.updatedSquad, []);
  const loanOutRes = executeOutgoingTransfer({
    userClub: sellRes.updatedClub,
    userSquad: sellRes.updatedSquad,
    loanedOutPlayers: [],
    player: reserveToLoanOut,
    action: 'EMPRESTIMO_OUT',
    destinationClubName: 'Coritiba',
  });
  assert.equal(loanOutRes.success, true);
  assert.equal(loanOutRes.updatedLoanedOutPlayers.length, 1);
  const payrollAfterLoanOut = getEffectivePayroll(
    loanOutRes.updatedSquad,
    loanOutRes.updatedLoanedOutPlayers
  );
  assert.ok(payrollAfterLoanOut < payrollBeforeLoanOut);

  // Minimum GK & minimum 18 squad size guardrails
  const onlyGkSquad = loanOutRes.updatedSquad.slice(0, 18);
  const gkInSmall = onlyGkSquad.find((p) => p.position === 'GOL')!;
  const blockedMin = evaluateOutgoingPlayer(gkInSmall, onlyGkSquad);
  assert.equal(blockedMin.canSell, false);
  assert.equal(blockedMin.canLoanOut, false);
});




