import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_CLUBS,
  INITIAL_STANDINGS,
  INITIAL_USER_SQUAD,
  USER_CLUB_ID,
  generateLeagueSchedule,
} from '../data/initialDatabase';
import { TACTICAL_ROLES } from '../data/tacticsData';
import {
  calculatePlayerOverall,
  calculateRoleSuitability,
  calculateTeamTacticalRatings,
  createInitialMatchState,
  simulateRoundFixtures,
  stepMatchMinute,
  updateStandingsWithRound,
} from './matchEngine';

test('Database contains 20 balanced clubs and 22 user squad players with 18 attributes (1-20)', () => {
  assert.equal(INITIAL_CLUBS.length, 20);
  assert.equal(INITIAL_STANDINGS.length, 20);
  assert.equal(INITIAL_USER_SQUAD.length, 22);

  const starters = INITIAL_USER_SQUAD.filter((p) => p.isStarter);
  assert.equal(starters.length, 11);

  for (const player of INITIAL_USER_SQUAD) {
    const attrKeys = Object.keys(player.attributes);
    assert.equal(attrKeys.length, 18);
    for (const val of Object.values(player.attributes)) {
      assert.ok(val >= 1 && val <= 20, `Attribute out of 1..20 range for ${player.name}`);
    }
  }
});

test('Role suitability and team tactical ratings respond to mentality and role changes', () => {
  const striker = INITIAL_USER_SQUAD.find((p) => p.id === 'p11')!;
  const attackerRole = TACTICAL_ROLES.find((r) => r.id === 'atacante-completo')!;
  const gkRole = TACTICAL_ROLES.find((r) => r.id === 'goleiro-libero')!;

  const strikerFit = calculateRoleSuitability(striker, attackerRole);
  const gkFit = calculateRoleSuitability(striker, gkRole);

  assert.ok(strikerFit.score > gkFit.score);
  assert.ok(calculatePlayerOverall(striker.attributes, striker.position) >= 15);

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

test('2D Match Engine initializes 22 tokens and simulates 0 to 90 minutes with halftime pause', () => {
  const schedule = generateLeagueSchedule();
  const r6UserMatch = schedule.find((f) => f.roundNumber === 6 && f.isUserMatch)!;
  const homeClub = INITIAL_CLUBS.find((c) => c.id === r6UserMatch.homeClubId)!;
  const awayClub = INITIAL_CLUBS.find((c) => c.id === r6UserMatch.awayClubId)!;

  let match = createInitialMatchState(
    6,
    r6UserMatch,
    homeClub,
    awayClub,
    INITIAL_USER_SQUAD
  );

  assert.equal(match.homeTokens.length, 11);
  assert.equal(match.awayTokens.length, 11);
  assert.equal(match.minute, 0);

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
  const schedule = generateLeagueSchedule();
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
