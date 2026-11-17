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

test('Database contains 40 real clubs (20 Série A + 20 Série B) and 880 real players with 18 attributes (1-20)', () => {
  assert.equal(SERIE_A_CLUBS.length, 20);
  assert.equal(SERIE_B_CLUBS.length, 20);
  assert.equal(INITIAL_CLUBS.length, 40);
  assert.equal(INITIAL_STANDINGS.length, 20);
  assert.equal(getInitialStandingsForDivision('B').length, 20);
  assert.equal(INITIAL_USER_SQUAD.length, 22);

  for (const club of INITIAL_CLUBS) {
    const squad = getRealSquadForClub(club);
    assert.equal(squad.length, 22, `Expected 22 players for ${club.name}`);
    assert.equal(
      squad.filter((p) => p.isStarter).length,
      11,
      `Expected 11 starters for ${club.name}`
    );

    for (const player of squad) {
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

test('2D Match Engine initializes 22 real tokens (including real opponent squad) and simulates 0 to 90 minutes', () => {
  const schedule = generateLeagueSchedule(USER_CLUB_ID, 'A');
  const r6UserMatch = schedule.find((f) => f.roundNumber === 6 && f.isUserMatch)!;
  const homeClub = INITIAL_CLUBS.find((c) => c.id === r6UserMatch.homeClubId)!;
  const awayClub = INITIAL_CLUBS.find((c) => c.id === r6UserMatch.awayClubId)!;

  let match = createInitialMatchState(
    6,
    r6UserMatch,
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

test('Round simulation simulates all 10 matches of the round and updates 20-club table', () => {
  const schedule = generateLeagueSchedule(USER_CLUB_ID, 'A');
  const r6UserMatch = schedule.find((f) => f.roundNumber === 6 && f.isUserMatch)!;

  const updatedFixtures = simulateRoundFixtures(
    schedule,
    6,
    {
      fixtureId: r6UserMatch.id,
      homeGoals: 2,
      awayGoals: 1,
      homeXG: 2.15,
      awayXG: 0.94,
    },
    INITIAL_CLUBS
  );

  const r6Completed = updatedFixtures.filter((f) => f.roundNumber === 6);
  assert.equal(r6Completed.length, 10);
  assert.ok(r6Completed.every((f) => f.played && f.homeGoals !== null && f.awayGoals !== null));

  const newStandings = updateStandingsWithRound(INITIAL_STANDINGS, r6Completed);
  assert.equal(newStandings.length, 20);
  assert.ok(newStandings.every((row) => row.played === 6));

  const userRow = newStandings.find((r) => r.clubId === USER_CLUB_ID)!;
  assert.equal(userRow.points, 15); // 12 + 3 for winning 2-1
});

test('Career factory generates complete real squads and schedules for Série A and Série B clubs', async () => {
  const { createNewCareerSave } = await import('../data/careerFactory');
  const clubsToTest = ['flamengo', 'palmeiras', 'athletico-pr', 'coritiba'];

  for (const clubId of clubsToTest) {
    const career = createNewCareerSave(2, clubId, 'Técnico Teste');
    const club = INITIAL_CLUBS.find((c) => c.id === clubId)!;

    assert.equal(career.slotIndex, 2);
    assert.equal(career.userClubId, clubId);
    assert.equal(career.division, club.division);
    assert.equal(career.managerName, 'Técnico Teste');
    assert.equal(career.squad.length, 22);
    assert.equal(career.squad.filter((p) => p.isStarter).length, 11);
    assert.equal(career.standings.length, 20);
    assert.equal(career.secondaryStandings?.length, 20);

    const r6UserMatch = career.fixtures.find(
      (f) => f.roundNumber === 6 && f.isUserMatch
    );
    assert.ok(r6UserMatch, `Round 6 user match missing for ${clubId}`);
    assert.ok(
      r6UserMatch.homeClubId === clubId || r6UserMatch.awayClubId === clubId
    );
    assert.equal(
      career.matchState.isUserHome,
      r6UserMatch.homeClubId === clubId
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

  const career3 = createNewCareerSave(3, 'athletico-pr', 'Fernanda');
  career3.currentRound = 9;
  const saved3 = saveCareerToSlot(career3, mockStorage);

  const allSlots = loadAllCareerSlots(mockStorage);
  assert.equal(allSlots[0]?.userClubId, 'flamengo');
  assert.equal(allSlots[0]?.division, 'A');
  assert.equal(allSlots[1], null);
  assert.equal(allSlots[2]?.userClubId, 'athletico-pr');
  assert.equal(allSlots[2]?.division, 'B');
  assert.equal(allSlots[3], null);

  const loaded3 = loadCareerSlot(3, mockStorage);
  assert.equal(loaded3?.currentRound, 9);
  assert.equal(loaded3?.managerName, 'Fernanda');

  const backupJson = serializeCareerBackup(saved3);
  const importedToSlot4 = parseCareerBackup(backupJson, 4);
  assert.ok(importedToSlot4);
  assert.equal(importedToSlot4?.slotIndex, 4);
  assert.equal(importedToSlot4?.userClubId, 'athletico-pr');

  deleteCareerSlot(1, mockStorage);
  assert.equal(loadCareerSlot(1, mockStorage), null);
  const latestAfterDelete = getLatestCareerSave(mockStorage);
  assert.equal(latestAfterDelete?.slotIndex, 3);
});
