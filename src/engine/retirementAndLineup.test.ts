import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createNewCareerSave } from '../data/careerFactory';
import {
  evaluatePlayerRetirementProbability,
  processSeasonEvolutionAndAging,
} from './economyAndEvolution';
import { calculatePlayerOverall, pickBestLineupForFormation } from './matchEngine';
import { executeNewSeasonRollover } from './seasonLifecycle';

test('Outfield players start thinking about retirement at 35 and odds rise every year up to 40+', () => {
  const career = createNewCareerSave(1, 'flamengo', 'Técnico');
  const outfield = career.squad.find((p) => p.position === 'ATA')!;

  const at34 = evaluatePlayerRetirementProbability(
    { ...outfield, age: 34, seasonStats: { ...outfield.seasonStats, matches: 10 } },
    75
  );
  assert.equal(at34.isConsideringRetirement, false);
  assert.equal(at34.annualProbability, 0);

  let prevProb = 0;
  for (const age of [35, 36, 37, 38, 39, 40, 41]) {
    const evalAge = evaluatePlayerRetirementProbability(
      { ...outfield, age, seasonStats: { ...outfield.seasonStats, matches: 8 }, isStarter: false },
      72
    );
    assert.equal(evalAge.isConsideringRetirement, true);
    assert.ok(
      evalAge.annualProbability > prevProb,
      `Outfield age ${age} (${evalAge.annualProbability}) must exceed age ${age - 1} (${prevProb})`
    );
    prevProb = evalAge.annualProbability;
  }
});

test('Goalkeepers start thinking about retirement at 40 and odds rise cleanly through 50', () => {
  const career = createNewCareerSave(1, 'flamengo', 'Técnico');
  const gk = career.squad.find((p) => p.position === 'GOL')!;

  const at38 = evaluatePlayerRetirementProbability(
    { ...gk, age: 38, seasonStats: { ...gk.seasonStats, matches: 20 } },
    76
  );
  assert.equal(at38.isConsideringRetirement, false);
  assert.equal(at38.annualProbability, 0);

  let prevProb = 0;
  for (const age of [40, 42, 44, 46, 48, 50]) {
    const evalAge = evaluatePlayerRetirementProbability(
      { ...gk, age, seasonStats: { ...gk.seasonStats, matches: 8 }, isStarter: false },
      72
    );
    assert.equal(evalAge.isConsideringRetirement, true);
    assert.ok(
      evalAge.annualProbability > prevProb,
      `GK age ${age} (${evalAge.annualProbability}) must exceed previous (${prevProb})`
    );
    prevProb = evalAge.annualProbability;
  }
});

test('Regular match usage and good OVR noticeably reduce retirement probability for veterans & GKs', () => {
  const career = createNewCareerSave(1, 'flamengo', 'Técnico');
  const outfield = career.squad.find((p) => p.position === 'MC')!;
  const gk = career.squad.find((p) => p.position === 'GOL')!;

  const benchLowOvrOutfield = evaluatePlayerRetirementProbability(
    { ...outfield, age: 37, isStarter: false, seasonStats: { ...outfield.seasonStats, matches: 1 } },
    67
  );
  const usedHighOvrOutfield = evaluatePlayerRetirementProbability(
    { ...outfield, age: 37, isStarter: true, seasonStats: { ...outfield.seasonStats, matches: 32 } },
    83
  );
  assert.ok(
    usedHighOvrOutfield.annualProbability < benchLowOvrOutfield.annualProbability * 0.4,
    `Active high-OVR 37yo (${usedHighOvrOutfield.annualProbability}) should be much lower than unused low-OVR (${benchLowOvrOutfield.annualProbability})`
  );

  const unusedLowGk = evaluatePlayerRetirementProbability(
    { ...gk, age: 44, isStarter: false, seasonStats: { ...gk.seasonStats, matches: 0 } },
    68
  );
  const activeHighGk = evaluatePlayerRetirementProbability(
    { ...gk, age: 44, isStarter: true, seasonStats: { ...gk.seasonStats, matches: 34 } },
    82
  );
  assert.ok(
    activeHighGk.annualProbability < unusedLowGk.annualProbability * 0.4,
    `Active high-OVR 44yo GK (${activeHighGk.annualProbability}) should be much lower than unused low-OVR GK (${unusedLowGk.annualProbability})`
  );
});

test('Season rollover retires eligible veterans, maintains minimum squad/GK & 11 starters, and logs inbox notice', () => {
  const career = createNewCareerSave(1, 'flamengo', 'Técnico');
  const retiringVet = {
    ...career.squad[10],
    id: 'vet-retire-1',
    name: 'Craque Veterano 40',
    age: 40,
    isStarter: true,
    slotIndex: 10,
    seasonStats: { matches: 2, goals: 0, assists: 0, yellowCards: 0, avgRating: 6.4 },
  };
  const customSquad = career.squad.map((p, idx) => (idx === 10 ? retiringVet : p));

  const evo = processSeasonEvolutionAndAging({
    clubs: career.clubs,
    userClubId: career.userClubId,
    userSquad: customSquad,
    aiSquads: career.aiSquads || {},
    freeAgents: career.freeAgents || [],
    loanedOutPlayers: [],
    rng: () => 0.05,
  });

  assert.ok(
    evo.retiredUserPlayers.some((r) => r.playerId === 'vet-retire-1'),
    'Eligible 41yo low-minutes player should retire on low rng roll'
  );
  assert.ok(
    !evo.updatedUserSquad.some((p) => p.id === 'vet-retire-1'),
    'Retired player must be removed from active user squad'
  );
  assert.ok(
    evo.updatedUserSquad.length >= 16,
    'User squad must maintain minimum safe size after retirements'
  );
  assert.ok(
    evo.updatedUserSquad.some((p) => p.position === 'GOL'),
    'User squad must maintain at least 1 GK after retirements'
  );
  assert.equal(
    evo.updatedUserSquad.filter((p) => p.isStarter).length,
    11,
    'User squad must keep 11 valid starters after a starter retires'
  );

  const rollover = executeNewSeasonRollover({
    currentYear: 2026,
    clubs: career.clubs,
    userClubId: career.userClubId,
    userSquad: customSquad,
    aiSquads: career.aiSquads || {},
    freeAgents: career.freeAgents || [],
    loanedOutPlayers: [],
    standings: career.standings,
    secondaryStandings: career.secondaryStandings || [],
    copaDoBrasil: career.copaDoBrasil!,
    libertadores: career.libertadores!,
    seasonHistory: [],
    managerName: 'Técnico',
    rng: () => 0.05,
  });

  assert.ok(
    (rollover.report.retiredPlayers?.length ?? 0) >= 1,
    'SeasonEndReport must record retired players'
  );
  assert.ok(
    rollover.nextMessages.some((m) => m.id.startsWith('msg-retirements-')),
    'Season rollover must emit inbox retirement announcement when players retire'
  );
});

test('pickBestLineupForFormation (Melhor Escalação) selects highest-OVR healthy XI + GK in slot 0', () => {
  const career = createNewCareerSave(1, 'flamengo', 'Técnico');

  // Force the best outfield player onto the bench & a weak injured player into starters
  const withWeakStarter = career.squad.map((p) => {
    if (p.isStarter && p.slotIndex === 10) {
      return {
        ...p,
        injured: true,
        attributes: Object.fromEntries(
          Object.keys(p.attributes).map((k) => [k, 6])
        ) as unknown as typeof p.attributes,
      };
    }
    if (!p.isStarter && p.sector !== 'GOL') {
      return {
        ...p,
        injured: false,
        attributes: Object.fromEntries(
          Object.keys(p.attributes).map((k) => [k, 17])
        ) as unknown as typeof p.attributes,
      };
    }
    return p;
  });

  const boostedReserve = withWeakStarter.find((p) => !p.isStarter && p.sector !== 'GOL')!;
  const crippledStarter = withWeakStarter.find((p) => p.isStarter && p.slotIndex === 10)!;

  const bestXI = pickBestLineupForFormation(withWeakStarter, '4-3-3');
  const starters = bestXI.filter((p) => p.isStarter);
  assert.equal(starters.length, 11);

  const gkSlotPlayer = starters.find((p) => p.slotIndex === 0);
  assert.equal(gkSlotPlayer?.position, 'GOL', 'Slot 0 must always be natural GOL');

  const promotedReserve = bestXI.find((p) => p.id === boostedReserve.id)!;
  const benchedInjured = bestXI.find((p) => p.id === crippledStarter.id)!;
  assert.equal(promotedReserve.isStarter, true, 'High-OVR reserve must be promoted to starting XI');
  assert.equal(benchedInjured.isStarter, false, 'Weak/injured player must be benched');

  // Average starter OVR must exceed average reserve OVR
  const starterAvg =
    starters.reduce((s, p) => s + calculatePlayerOverall(p.attributes, p.position), 0) /
    starters.length;
  const reserves = bestXI.filter((p) => !p.isStarter && p.position !== 'GOL');
  const reserveMax = Math.max(
    ...reserves.map((p) => calculatePlayerOverall(p.attributes, p.position))
  );
  assert.ok(starterAvg >= 70);
  assert.ok(
    calculatePlayerOverall(promotedReserve.attributes, promotedReserve.position) >= reserveMax
  );
});

test('UI removes Recalcular Evolução button and exposes Melhor Escalação', () => {
  const squadViewSrc = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/SquadView.tsx'),
    'utf8'
  );
  const tacticalSrc = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/TacticalBoard.tsx'),
    'utf8'
  );
  const appSrc = fs.readFileSync(
    path.resolve(process.cwd(), 'src/App.tsx'),
    'utf8'
  );

  assert.ok(!squadViewSrc.includes('Recalcular Evolução'));
  assert.ok(!squadViewSrc.includes('onSimulateMidSeasonEvolution'));
  assert.ok(!appSrc.includes('onSimulateMidSeasonEvolution'));
  assert.ok(squadViewSrc.includes('Melhor Escalação'));
  assert.ok(tacticalSrc.includes('Melhor Escalação'));
});

test('UI removes segregation between Titulares and Reservas and unifies squad presentation with Escalado indicator', () => {
  const read = (relPath: string) =>
    fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');

  const squadViewSrc = read('src/components/SquadView.tsx');
  const tacticalSrc = read('src/components/TacticalBoard.tsx');
  const profileSrc = read('src/components/PlayerProfileModal.tsx');
  const financesSrc = read('src/components/FinancesView.tsx');
  const marketSrc = read('src/components/MarketView.tsx');
  const offerCardSrc = read('src/components/IncomingOfferCard.tsx');
  const matchSrc = read('src/components/MatchEngineView.tsx');

  // No Reservas filter tab or RES/Reserva badges in SquadView
  assert.ok(!squadViewSrc.includes("'RESERVES'"));
  assert.ok(!squadViewSrc.includes("'STARTERS'"));
  assert.ok(!squadViewSrc.includes("'RES'"));
  assert.ok(!squadViewSrc.includes("'TIT'"));
  assert.ok(!squadViewSrc.includes('Reservas ('));
  assert.ok(!squadViewSrc.includes('Titulares ('));
  assert.ok(squadViewSrc.includes("'LINEUP'"));
  assert.ok(squadViewSrc.includes('Escalados ('));
  assert.ok(squadViewSrc.includes('Escalado'));

  // Other components must not label players as Reserva/Reservas
  for (const [name, src] of [
    ['TacticalBoard', tacticalSrc],
    ['PlayerProfileModal', profileSrc],
    ['FinancesView', financesSrc],
    ['MarketView', marketSrc],
    ['IncomingOfferCard', offerCardSrc],
    ['MatchEngineView', matchSrc],
  ] as const) {
    assert.ok(!/Reserva/i.test(src), `${name} must not label players as Reserva/Reservas`);
  }

  assert.ok(tacticalSrc.includes('Outros jogadores do elenco'));
  assert.ok(profileSrc.includes("'Escalado' : 'Elenco'"));
  assert.ok(financesSrc.includes("'Escalado' : 'Elenco'"));
  assert.ok(marketSrc.includes("'Escalado' : 'Elenco'"));
  assert.ok(offerCardSrc.includes("'Escalado' : 'Elenco'"));
});
