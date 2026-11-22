import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewCareerSave } from '../data/careerFactory';
import {
  INJURY_CATALOG,
  advanceSquadRecoveryByDays,
  applyInjuryToPlayer,
  calculateFatiguePerformanceFactor,
  calculateMatchMinuteDrain,
  ensureHealthyStartingLineup,
  evaluatePlayerInjuryRisk,
  pickWeightedInjury,
  rollMinuteInjuryCheck,
} from './injuryEngine';
import {
  calculateTeamTacticalRatings,
  createInitialMatchState,
  pickBestLineupForFormation,
  stepMatchMinute,
} from './matchEngine';
import { generateSubstitutionSuggestions } from './substitutionAdvisor';
import { selectOptimalTacticsForMatch } from './autoTacticsAndSim';

function createSeededRng(seedStart: number) {
  let seed = seedStart;
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

test('Injury catalog covers all 4 severity tiers with distinct recovery durations', () => {
  const bySeverity = new Map<string, typeof INJURY_CATALOG>();
  for (const item of INJURY_CATALOG) {
    const list = bySeverity.get(item.severity) || [];
    list.push(item);
    bySeverity.set(item.severity, list);
  }

  assert.ok((bySeverity.get('LEVE')?.length ?? 0) >= 2);
  assert.ok((bySeverity.get('MODERADA')?.length ?? 0) >= 3);
  assert.ok((bySeverity.get('GRAVE')?.length ?? 0) >= 2);
  assert.ok((bySeverity.get('MUITO_GRAVE')?.length ?? 0) >= 2);

  const rng = createSeededRng(101);
  const rolledSeverities = new Set<string>();
  const rolledDurations = new Set<number>();
  for (let i = 0; i < 400; i++) {
    const inj = pickWeightedInjury(i % 2 === 0, rng);
    rolledSeverities.add(inj.severity);
    rolledDurations.add(inj.days);
    assert.ok(inj.days >= 4 && inj.days <= 195);
  }
  assert.equal(rolledSeverities.size, 4, 'All 4 severity tiers must be reachable');
  assert.ok(rolledDurations.size >= 25, 'Injury durations must vary widely');
});

test('High physical fatigue significantly lowers performance factor and team tactical ratings', () => {
  const freshFactor = calculateFatiguePerformanceFactor(94, false);
  const mildFatigue = calculateFatiguePerformanceFactor(76, false);
  const highFatigue = calculateFatiguePerformanceFactor(62, false);
  const exhausted = calculateFatiguePerformanceFactor(45, false);
  const injuredFactor = calculateFatiguePerformanceFactor(70, true);

  assert.equal(freshFactor, 1);
  assert.ok(mildFatigue < freshFactor);
  assert.ok(highFatigue < mildFatigue - 0.08);
  assert.ok(exhausted < highFatigue - 0.08);
  assert.ok(injuredFactor < exhausted);

  const career = createNewCareerSave(1, 'flamengo', 'Técnico');
  const freshSquad = career.squad.map((p) => ({ ...p, condition: 95, injured: false }));
  const tiredSquad = career.squad.map((p) => ({ ...p, condition: 58, injured: false }));

  const freshRatings = calculateTeamTacticalRatings(
    freshSquad,
    '4-3-3',
    career.clubs[0].instructions
  );
  const tiredRatings = calculateTeamTacticalRatings(
    tiredSquad,
    '4-3-3',
    career.clubs[0].instructions
  );

  assert.ok(
    freshRatings.attack - tiredRatings.attack >= 10,
    `Fatigued attack (${tiredRatings.attack}) must drop markedly vs fresh (${freshRatings.attack})`
  );
  assert.ok(
    freshRatings.midfield - tiredRatings.midfield >= 10,
    `Fatigued midfield (${tiredRatings.midfield}) must drop markedly vs fresh (${freshRatings.midfield})`
  );
  assert.ok(
    freshRatings.defense - tiredRatings.defense >= 10,
    `Fatigued defense (${tiredRatings.defense}) must drop markedly vs fresh (${freshRatings.defense})`
  );
});

test('Overloaded and fatigued players face dramatically higher injury risk than rested players', () => {
  const career = createNewCareerSave(1, 'flamengo', 'Técnico');
  const baseMid = career.squad.find((p) => p.sector === 'MEI')!;

  const freshPlayer = { ...baseMid, condition: 95, consecutiveMatches: 0, injured: false };
  const tiredPlayer = { ...baseMid, condition: 56, consecutiveMatches: 4, injured: false };

  const freshRisk = evaluatePlayerInjuryRisk(freshPlayer, 95, 'Moderada');
  const tiredRisk = evaluatePlayerInjuryRisk(tiredPlayer, 56, 'Extrema');

  assert.equal(freshRisk.riskLevel, 'BAIXO');
  assert.equal(tiredRisk.riskLevel, 'CRITICO');
  assert.ok(
    tiredRisk.riskPctPerMatch >= freshRisk.riskPctPerMatch * 6,
    `Overloaded risk (${tiredRisk.riskPctPerMatch}%) should be >= 6x fresh (${freshRisk.riskPctPerMatch}%)`
  );

  // Monte Carlo check over 300 simulated full matches (90 mins each)
  const rngFresh = createSeededRng(777);
  const rngTired = createSeededRng(777);
  let freshInjuries = 0;
  let tiredInjuries = 0;

  for (let matchIdx = 0; matchIdx < 300; matchIdx++) {
    for (let m = 1; m <= 90; m++) {
      if (
        rollMinuteInjuryCheck({
          player: freshPlayer,
          liveCondition: 92,
          pressingIntensity: 'Moderada',
          rng: rngFresh,
        })
      ) {
        freshInjuries++;
        break;
      }
    }
    for (let m = 1; m <= 90; m++) {
      if (
        rollMinuteInjuryCheck({
          player: tiredPlayer,
          liveCondition: 54,
          pressingIntensity: 'Extrema',
          rng: rngTired,
        })
      ) {
        tiredInjuries++;
        break;
      }
    }
  }

  assert.ok(
    tiredInjuries > freshInjuries * 4,
    `Tired/overloaded player injuries (${tiredInjuries}) must vastly exceed fresh player injuries (${freshInjuries})`
  );

  // Pressing intensity affects match condition drain
  const drainContida = calculateMatchMinuteDrain(baseMid, 'MEI', 'Contida');
  const drainExtrema = calculateMatchMinuteDrain(baseMid, 'MEI', 'Extrema');
  assert.ok(drainExtrema > drainContida * 1.35);
});

test('Daily medical rehabilitation decrements injury days accurately and clears player with inbox bulletin', () => {
  const career = createNewCareerSave(1, 'flamengo', 'Técnico');
  const target = career.squad[5];
  const injuredTarget = applyInjuryToPlayer(target, {
    injuryType: 'Estiramento posterior da coxa (Grau 1)',
    severity: 'MODERADA',
    days: 15,
  });

  const squadWithInjury = career.squad.map((p) =>
    p.id === target.id
      ? injuredTarget
      : { ...p, injured: false, injuryNote: undefined, injuryDaysRemaining: 0, condition: 72 }
  );

  // After 6 days: still injured with 9 days left, healthy teammates recover ~24%
  const after6 = advanceSquadRecoveryByDays(squadWithInjury, 6, 'Sáb, 14 Fev 2026');
  const targetAfter6 = after6.updatedSquad.find((p) => p.id === target.id)!;
  assert.equal(targetAfter6.injured, true);
  assert.equal(targetAfter6.injuryDaysRemaining, 9);
  assert.ok(targetAfter6.injuryNote?.includes('9d restantes'));
  assert.equal(after6.clearanceMessages.length, 0);

  const healthyTeammate = after6.updatedSquad.find((p) => p.id !== target.id && !p.injured)!;
  assert.ok(
    healthyTeammate.condition >= 90 && healthyTeammate.condition <= 99,
    `Healthy teammate should recover realistically after 6 days (got ${healthyTeammate.condition}%)`
  );

  // After 10 more days (total 16 > 15): cleared from DM with inbox message
  const after16 = advanceSquadRecoveryByDays(after6.updatedSquad, 10, 'Ter, 24 Fev 2026');
  const targetCleared = after16.updatedSquad.find((p) => p.id === target.id)!;
  assert.equal(targetCleared.injured, false);
  assert.equal(targetCleared.injuryDaysRemaining, 0);
  assert.equal(targetCleared.injuryNote, undefined);
  assert.equal(after16.recoveredPlayers.length, 1);
  assert.equal(after16.clearanceMessages.length, 1);
  assert.ok(after16.clearanceMessages[0].subject.includes('Alta Médica'));
});

test('Teams rotate heavily fatigued players and auto-replace injured starters', () => {
  const career = createNewCareerSave(1, 'flamengo', 'Técnico');
  const userClub = career.clubs.find((c) => c.id === career.userClubId)!;
  const oppClub = career.clubs.find((c) => c.id !== career.userClubId)!;

  // Exhaust a starter heavily while keeping another same-sector player completely fresh
  const starterAtt = career.squad.find((p) => p.isStarter && p.sector === 'ATA')!;
  const freshAtt = career.squad.find((p) => !p.isStarter && p.sector === 'ATA')!;

  const tiredScenario = career.squad.map((p) => {
    if (p.id === starterAtt.id) {
      return { ...p, condition: 52, consecutiveMatches: 5 };
    }
    if (p.id === freshAtt.id) {
      return { ...p, condition: 98, consecutiveMatches: 0 };
    }
    return { ...p, condition: 92 };
  });

  const autoTactics = selectOptimalTacticsForMatch({
    squad: tiredScenario,
    userClub,
    opponentClub: oppClub,
    isUserHome: true,
    isKnockout: false,
  });

  const starterAttPicked = autoTactics.updatedSquad.find(
    (p) => p.id === starterAtt.id
  )!;
  assert.equal(
    starterAttPicked.isStarter,
    false,
    'AI auto-tactics must rest a critically exhausted 52% starter with 5 consecutive matches'
  );

  // Also test Melhor Escalação & ensureHealthyStartingLineup for injured starters
  const injuredScenario = career.squad.map((p) =>
    p.id === starterAtt.id
      ? applyInjuryToPlayer(p, {
          injuryType: 'Entorse no tornozelo',
          severity: 'MODERADA',
          days: 20,
        })
      : p
  );

  const ensured = ensureHealthyStartingLineup(injuredScenario);
  assert.equal(ensured.replacedStarters.length, 1);
  assert.equal(
    ensured.updatedSquad.find((p) => p.id === starterAtt.id)!.isStarter,
    false
  );
  assert.equal(ensured.updatedSquad.filter((p) => p.isStarter).length, 11);

  const bestXI = pickBestLineupForFormation(injuredScenario, '4-3-3');
  assert.equal(bestXI.find((p) => p.id === starterAtt.id)!.isStarter, false);
});

test('In-match injury emits LESAO event and immediately tops substitution advisor suggestions', () => {
  const career = createNewCareerSave(1, 'flamengo', 'Técnico');
  const fixture = career.fixtures.find((f) => f.roundNumber === 1 && f.isUserMatch)!;
  const homeClub = career.clubs.find((c) => c.id === fixture.homeClubId)!;
  const awayClub = career.clubs.find((c) => c.id === fixture.awayClubId)!;

  // Exhaust all user starters so an injury triggers rapidly with low rng
  const exhaustedSquad = career.squad.map((p) =>
    p.isStarter ? { ...p, condition: 48, consecutiveMatches: 5 } : { ...p, condition: 96 }
  );

  let match = createInitialMatchState(
    1,
    fixture,
    homeClub,
    awayClub,
    exhaustedSquad,
    career.userClubId
  );
  match.phase = 'FIRST_HALF';
  match.isRunning = true;

  // Run minutes until a user player gets injured (low rng makes minute injury trigger promptly)
  const lowRng = () => 0.0005;
  for (let m = 1; m <= 12; m++) {
    match = stepMatchMinute(match, homeClub, awayClub, exhaustedSquad, lowRng);
    if ((match.inMatchInjuries || []).length > 0) break;
  }

  const userTeamTag = match.isUserHome ? 'HOME' : 'AWAY';
  const userInjury = (match.inMatchInjuries || []).find(
    (rec) => rec.team === userTeamTag
  );
  assert.ok(userInjury, 'Critically exhausted squad must produce an in-match injury under low RNG');
  assert.ok(
    match.events.some((e) => e.type === 'LESAO' && e.playerId === userInjury.playerId),
    'Match narration must contain a LESAO event for the injured player'
  );

  // Substitution advisor must immediately prioritize the injured player
  const subs = generateSubstitutionSuggestions(exhaustedSquad, match);
  assert.ok(subs.length > 0);
  const hasInjurySub = subs.some(
    (s) => s.categoryLabel === 'Lesão em Campo' && s.starterInjuredInMatch === true
  );
  // If the injured token happened to be an outfield player, it must be #1 suggestion
  const injuredPlayerObj = exhaustedSquad.find((p) => p.id === userInjury.playerId);
  if (injuredPlayerObj && injuredPlayerObj.position !== 'GOL') {
    assert.ok(hasInjurySub, 'Outfield injury must generate Lesão em Campo suggestion');
    assert.equal(subs[0].categoryLabel, 'Lesão em Campo');
  }
});
