import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_WORLD_CLUBS,
  GLOBAL_WORLD_CLUBS,
  UCL_CLUBS,
  getRealSquadForClub,
} from '../data/initialDatabase';
import { INTERNATIONAL_MARKET_CLUBS } from '../data/transferCatalog';
import {
  CHAMPIONS_STAGES,
  MUNDIAL_STAGES,
  SUPER_MUNDIAL_KNOCKOUT_STAGES,
  advanceChampionsLeagueStage,
  advanceMundialStage,
  advanceSuperMundialGroupRound,
  advanceSuperMundialKnockoutStage,
  createInitialChampionsLeague,
  createInitialMundial,
  createInitialSuperMundial,
  isSuperMundialYear,
  seedMundialBracket,
  syncSuperMundialWithChampionsResults,
} from '../data/cupFactory';
import { createNewCareerSave } from '../data/careerFactory';
import { calculatePlayerOverall } from './matchEngine';
import {
  buildAllMarketListings,
  evaluateTransferNegotiation,
} from './transferEngine';
import { maybeGenerateIncomingOfferForUser } from './aiMarketEngine';
import { executeNewSeasonRollover } from './seasonLifecycle';
import {
  GLOBAL_SCALE_VERSION,
  calculateBalancedValuationAndWage,
} from './economyAndEvolution';
import { formatCompactBRL } from '../utils/formatters';
import { hydrateCareerSave } from '../utils/saveManager';

test('16 Champions League clubs + 4 Global Mundial clubs have complete 18-player rosters with zero duplicates', () => {
  assert.equal(UCL_CLUBS.length, 16);
  assert.equal(GLOBAL_WORLD_CLUBS.length, 4);

  const worldIds = new Set(ALL_WORLD_CLUBS.map((c) => c.id));
  assert.equal(worldIds.size, ALL_WORLD_CLUBS.length, 'No duplicate club IDs in ALL_WORLD_CLUBS');

  // No overlap between promoted UCL/Global clubs and supplementary transferCatalog clubs
  const catalogNames = new Set(
    INTERNATIONAL_MARKET_CLUBS.map((c) => c.name.toLowerCase())
  );
  for (const club of [...UCL_CLUBS, ...GLOBAL_WORLD_CLUBS]) {
    assert.equal(
      catalogNames.has(club.name.toLowerCase()),
      false,
      `Club ${club.name} should not be duplicated in transferCatalog`
    );

    const squad = getRealSquadForClub(club);
    assert.equal(
      squad.length,
      18,
      `Expected 18 real players for ${club.name}, got ${squad.length}`
    );
    assert.equal(
      squad.filter((p) => p.isStarter).length,
      11,
      `Expected 11 starters for ${club.name}`
    );
    for (const p of squad) {
      const ovr = calculatePlayerOverall(p.attributes, p.position);
      assert.ok(
        ovr >= 60 && ovr <= 95,
        `OVR ${ovr} out of 60..95 bounds for ${p.name} (${club.name})`
      );
    }
  }
});

test('Recalibrated global 60–95 OVR & rare 5★ hierarchy keeps 5★ exclusive to generational outliers', () => {
  const realMadrid = UCL_CLUBS.find((c) => c.id === 'real-madrid')!;
  const manCity = UCL_CLUBS.find((c) => c.id === 'man-city')!;
  const barcelona = UCL_CLUBS.find((c) => c.id === 'barcelona')!;
  const chelsea = UCL_CLUBS.find((c) => c.id === 'chelsea')!;
  const palmeiras = ALL_WORLD_CLUBS.find((c) => c.id === 'palmeiras')!;
  const flamengo = ALL_WORLD_CLUBS.find((c) => c.id === 'flamengo')!;
  const pontePreta = ALL_WORLD_CLUBS.find((c) => c.id === 'ponte-preta')!;

  const rmSquad = getRealSquadForClub(realMadrid);
  const mcSquad = getRealSquadForClub(manCity);
  const barcaSquad = getRealSquadForClub(barcelona);
  const chelseaSquad = getRealSquadForClub(chelsea);
  const palSquad = getRealSquadForClub(palmeiras);
  const flaSquad = getRealSquadForClub(flamengo);
  const ponteSquad = getRealSquadForClub(pontePreta);

  const mbappe = rmSquad.find((p) => p.name.includes('Mbappé'))!;
  const haaland = mcSquad.find((p) => p.name.includes('Haaland'))!;
  const yamal = barcaSquad.find((p) => p.name.includes('Yamal'))!;
  const estevao = chelseaSquad.find((p) => p.name.includes('Estêvão'))!;
  const vitorRoque = palSquad.find((p) => p.name.includes('Vitor Roque'))!;
  const arrascaeta = flaSquad.find((p) => p.name.includes('Arrascaeta'))!;

  const mbappeOvr = calculatePlayerOverall(mbappe.attributes, mbappe.position);
  const haalandOvr = calculatePlayerOverall(haaland.attributes, haaland.position);
  const yamalOvr = calculatePlayerOverall(yamal.attributes, yamal.position);
  const estevaoOvr = calculatePlayerOverall(estevao.attributes, estevao.position);
  const vitorRoqueOvr = calculatePlayerOverall(vitorRoque.attributes, vitorRoque.position);
  const arrascaOvr = calculatePlayerOverall(arrascaeta.attributes, arrascaeta.position);

  assert.ok(mbappeOvr >= 90 && mbappeOvr <= 95, `Expected Mbappé OVR in 90..95, got ${mbappeOvr}`);
  assert.ok(haalandOvr >= 90 && haalandOvr <= 95, `Expected Haaland OVR in 90..95, got ${haalandOvr}`);
  assert.equal(mbappe.potentialStars, 5);
  assert.equal(haaland.potentialStars, 5);
  assert.equal(yamal.potentialStars, 5);
  assert.equal(estevao.potentialStars, 5, '19yo generational standout Estêvão must project 5★ even before reaching 90 OVR');
  assert.ok(yamalOvr >= 86 && yamalOvr <= 95, `Expected Lamine Yamal OVR in 86..95, got ${yamalOvr}`);
  assert.ok(estevaoOvr >= 82 && estevaoOvr <= 87, `Expected Estêvão OVR in 82..87, got ${estevaoOvr}`);
  assert.ok(
    (vitorRoque.potentialStars ?? 0) >= 4.5,
    `Expected Palmeiras 21yo Vitor Roque (OVR ${vitorRoqueOvr}) projection >= 4.5★, got ${vitorRoque.potentialStars}`
  );

  // Verify Brazilian & South American 5★ and 4.5★ standouts (UCL, Brasileirão, Libertadores, World)
  const findWorldPlayer = (clubId: string, namePart: string) =>
    getRealSquadForClub(ALL_WORLD_CLUBS.find((c) => c.id === clubId)!).find((p) =>
      p.name.includes(namePart)
    )!;
  assert.equal(findWorldPlayer('real-madrid', 'Endrick').potentialStars, 5);
  assert.equal(findWorldPlayer('inter-miami', 'Suárez').potentialStars, 5);
  assert.ok((findWorldPlayer('barcelona', 'Raphinha').potentialStars ?? 0) >= 4.5);
  assert.ok((findWorldPlayer('real-madrid', 'Valverde').potentialStars ?? 0) >= 4.5);
  assert.ok((findWorldPlayer('liverpool', 'Mac Allister').potentialStars ?? 0) >= 4.5);
  assert.ok((findWorldPlayer('liverpool', 'Alisson').potentialStars ?? 0) >= 4.5);
  assert.ok((findWorldPlayer('chelsea', 'Caicedo').potentialStars ?? 0) >= 4.5);
  assert.ok((findWorldPlayer('man-city', 'Vitor Reis').potentialStars ?? 0) >= 4.5);
  assert.ok((findWorldPlayer('psg', 'Beraldo').potentialStars ?? 0) >= 4.5);
  assert.ok((findWorldPlayer('vasco', 'Rayan').potentialStars ?? 0) >= 4.5);
  assert.ok((findWorldPlayer('sao-paulo', 'Ryan Francisco').potentialStars ?? 0) >= 4.5);
  assert.ok((findWorldPlayer('corinthians', 'Breno Bidon').potentialStars ?? 0) >= 4.5);
  assert.ok((findWorldPlayer('botafogo', 'Jair Cunha').potentialStars ?? 0) >= 4.5);
  assert.ok((findWorldPlayer('internacional', 'Gabriel Carvalho').potentialStars ?? 0) >= 4.5);
  assert.ok((findWorldPlayer('river-plate', 'Mastantuono').potentialStars ?? 0) >= 4.5);
  assert.ok((findWorldPlayer('ind-del-valle', 'Kendry Páez').potentialStars ?? 0) >= 4.5);

  // Global scarcity check: 5★ must be truly rare ("fora da curva") across all world clubs
  // AND include both high-projection youths (<=22) and peak Ballon d'Or stars, plus late-bloomers
  let totalWorldPlayers = 0;
  let totalFiveStarPlayers = 0;
  let u22FiveStarPlayers = 0;
  let overachievingVeterans = 0;
  for (const club of ALL_WORLD_CLUBS) {
    for (const p of getRealSquadForClub(club)) {
      totalWorldPlayers++;
      const ovr = calculatePlayerOverall(p.attributes, p.position);
      assert.ok(ovr >= 60 && ovr <= 95, `Global OVR ${ovr} out of 60..95 for ${p.name}`);
      if (p.potentialStars === 5) {
        totalFiveStarPlayers++;
        if (p.age <= 22) u22FiveStarPlayers++;
      }
      if (p.age >= 24 && ovr >= 79 && (p.potentialStars ?? 3) <= 3.5) {
        overachievingVeterans++;
      }
    }
  }
  assert.ok(
    totalFiveStarPlayers >= 5 && totalFiveStarPlayers <= 20,
    `Expected rare 5★ global count (5..20), got ${totalFiveStarPlayers} out of ${totalWorldPlayers}`
  );
  assert.ok(
    u22FiveStarPlayers >= 3,
    `Expected at least 3 generational U22 5★ projections, got ${u22FiveStarPlayers}`
  );
  assert.ok(
    overachievingVeterans >= 10,
    `Expected realistic overachievers with strong OVR despite modest expectation, got ${overachievingVeterans}`
  );
  assert.ok(
    totalFiveStarPlayers / totalWorldPlayers < 0.015,
    `5★ share must stay below 1.5% of world players (got ${totalFiveStarPlayers}/${totalWorldPlayers})`
  );

  // Top Brasileirão star stays realistically below top UCL superstars
  assert.ok(
    arrascaOvr < mbappeOvr - 6,
    `Expected Arrascaeta (${arrascaOvr}) clearly below Mbappé (${mbappeOvr})`
  );

  const avgStarterOvr = (squad: typeof rmSquad) => {
    const starters = squad.filter((p) => p.isStarter);
    return (
      starters.reduce((sum, p) => sum + calculatePlayerOverall(p.attributes, p.position), 0) /
      starters.length
    );
  };

  assert.ok(
    avgStarterOvr(rmSquad) > avgStarterOvr(flaSquad) + 6,
    'UCL giant XI average OVR must clearly exceed top Brasileirão XI'
  );
  assert.ok(
    avgStarterOvr(flaSquad) > avgStarterOvr(ponteSquad) + 6,
    'Top Brasileirão Série A XI average OVR must clearly exceed Série B XI'
  );
});

test('Champions League simulates strictly in background (isUserMatch=false) and feeds Mundial & Super Mundial', () => {
  let ucl = createInitialChampionsLeague(2026, ALL_WORLD_CLUBS);
  assert.equal(ucl.participantIds.length, 16);
  assert.equal(ucl.fixturesByStage['Oitavas'].length, 8);

  for (const stage of CHAMPIONS_STAGES) {
    for (const fix of ucl.fixturesByStage[stage]) {
      assert.equal(fix.isUserMatch, false, 'Champions League must never be a user match');
    }
    ucl = advanceChampionsLeagueStage(ucl, stage, ALL_WORLD_CLUBS);
  }

  assert.ok(ucl.championClubId, 'Champions League must crown a European champion');
  assert.ok(ucl.runnerUpClubId, 'Champions League must record a runner-up');
  assert.ok(
    ucl.participantIds.includes(ucl.championClubId!),
    'UCL champion must come from the 16 UCL participants'
  );

  // Mundial de Clubes seeds with UCL Champion + Libertadores Champion (user) + 2 Global clubs
  let mundial = createInitialMundial(2026);
  assert.equal(mundial.isSeeded, false);

  mundial = seedMundialBracket(
    mundial,
    ucl.championClubId,
    'flamengo',
    ALL_WORLD_CLUBS,
    'flamengo'
  );
  assert.equal(mundial.isSeeded, true);
  assert.equal(mundial.participantIds.length, 4);
  assert.ok(mundial.participantIds.includes(ucl.championClubId!));
  assert.ok(mundial.participantIds.includes('flamengo'));
  assert.ok(
    mundial.fixturesByStage['Semifinal'].some((f) => f.isUserMatch),
    'User who won Libertadores must have isUserMatch=true in Mundial Semifinal'
  );

  for (const stage of MUNDIAL_STAGES) {
    mundial = advanceMundialStage(mundial, stage, null, ALL_WORLD_CLUBS, 'flamengo');
  }
  assert.ok(mundial.championClubId, 'Mundial de Clubes must crown a champion');
});

test('Super Mundial de Clubes follows quadrennial cycle (2026 active, 2027 inactive, 2030 active) and crowns 16-club champion', () => {
  assert.equal(isSuperMundialYear(2026), true);
  assert.equal(isSuperMundialYear(2027), false);
  assert.equal(isSuperMundialYear(2028), false);
  assert.equal(isSuperMundialYear(2029), false);
  assert.equal(isSuperMundialYear(2030), true);

  const offYearSm = createInitialSuperMundial({
    userClubId: 'flamengo',
    seasonYear: 2027,
    clubsPool: ALL_WORLD_CLUBS,
  });
  assert.equal(offYearSm.isActiveThisSeason, false);
  assert.equal(offYearSm.nextEditionYear, 2030);
  assert.equal(offYearSm.groups.length, 0);

  let sm = createInitialSuperMundial({
    userClubId: 'flamengo',
    seasonYear: 2026,
    clubsPool: ALL_WORLD_CLUBS,
  });
  assert.equal(sm.isActiveThisSeason, true);
  assert.equal(sm.participantIds.length, 16);
  assert.equal(sm.groups.length, 4);
  assert.equal(sm.uefaQualifiedIds.length, 6);
  assert.equal(sm.conmebolQualifiedIds.length, 6);
  assert.equal(sm.globalQualifiedIds.length, 4);

  // Simulate UCL & sync champion into Super Mundial
  let ucl = createInitialChampionsLeague(2026, ALL_WORLD_CLUBS);
  for (const stage of CHAMPIONS_STAGES) {
    ucl = advanceChampionsLeagueStage(ucl, stage, ALL_WORLD_CLUBS);
  }
  sm = syncSuperMundialWithChampionsResults(sm, ucl, ALL_WORLD_CLUBS, 'flamengo');
  assert.ok(
    sm.participantIds.includes(ucl.championClubId!),
    'UCL champion must be present in active Super Mundial participants'
  );

  for (const round of [1, 2, 3] as const) {
    sm = advanceSuperMundialGroupRound(sm, round, null, ALL_WORLD_CLUBS, 'flamengo');
  }
  assert.equal(sm.currentPhase, 'Quartas');
  assert.equal(sm.knockoutFixtures['Quartas'].length, 4);

  for (const stage of SUPER_MUNDIAL_KNOCKOUT_STAGES) {
    sm = advanceSuperMundialKnockoutStage(sm, stage, null, ALL_WORLD_CLUBS, 'flamengo');
  }
  assert.ok(sm.championClubId, 'Super Mundial de Clubes must crown a champion');
});

test('Bi-directional European transfers: UCL players are negotiable by user and UCL clubs can bid on user stars', () => {
  const career = createNewCareerSave(1, 'flamengo', 'Técnico');
  const userClub = career.clubs.find((c) => c.id === 'flamengo')!;
  const listings = buildAllMarketListings({
    clubs: career.clubs,
    userClubId: 'flamengo',
    freeAgents: career.freeAgents || [],
    transferredOutClubPlayerIds: [],
    aiSquads: career.aiSquads,
  });

  const uclListings = listings.filter(
    (l) =>
      l.scope === 'INTERNACIONAL' &&
      Boolean(l.originClub?.leagueName.startsWith('Champions League'))
  );
  assert.equal(
    uclListings.length,
    16 * 18,
    'All 288 players across the 16 UCL clubs must appear in Mercado Internacional'
  );

  // User can evaluate a real negotiation on a UCL player
  const sampleUclPlayer = uclListings[0];
  const evaluation = evaluateTransferNegotiation({
    userClub,
    userSquad: career.squad,
    loanedOutPlayers: [],
    listing: sampleUclPlayer,
    dealMode: 'BUY',
    offerTier: 'PADRAO',
    loanWageShare: 0.75,
  });
  assert.ok(evaluation.effectiveFee > 0);
  assert.ok(evaluation.acceptanceChance >= 0 && evaluation.acceptanceChance <= 100);

  // European UCL clubs can generate incoming offers for standout/young user stars during open transfer window
  const richCareerClubs = career.clubs.map((c) =>
    c.division === 'UCL' ? { ...c, cashBalance: 900_000_000 } : c
  );
  const standoutYoungUserSquad = career.squad.map((p, idx) =>
    idx < 4
      ? {
          ...p,
          age: 20,
          potentialStars: 5 as const,
          isTransferListed: true,
        }
      : p
  );

  let uclBuyerSeen = false;
  for (let i = 0; i < 40; i++) {
    const offer = maybeGenerateIncomingOfferForUser({
      clubs: richCareerClubs,
      userClub,
      userSquad: standoutYoungUserSquad,
      pendingOffers: [],
      dayOffset: 10,
      seasonYear: 2026,
      specificPlayerId: standoutYoungUserSquad[i % 4].id,
    });
    if (offer) {
      const buyer = richCareerClubs.find((c) => c.id === offer.fromClubId);
      if (buyer?.division === 'UCL') {
        uclBuyerSeen = true;
        assert.ok(offer.offeredFee > 0);
        break;
      }
    }
  }
  assert.equal(
    uclBuyerSeen,
    true,
    'Expected at least one European UCL club to submit an incoming offer for a top young user player'
  );
});

test('Season rollover preserves global tournaments and rotates Super Mundial off in 2027', () => {
  const career = createNewCareerSave(1, 'flamengo', 'Técnico');
  let ucl = career.championsLeague!;
  for (const stage of CHAMPIONS_STAGES) {
    ucl = advanceChampionsLeagueStage(ucl, stage, career.clubs);
  }
  let mundial = seedMundialBracket(
    career.mundial!,
    ucl.championClubId,
    'flamengo',
    career.clubs,
    'flamengo'
  );
  for (const stage of MUNDIAL_STAGES) {
    mundial = advanceMundialStage(mundial, stage, null, career.clubs, 'flamengo');
  }

  const rollover = executeNewSeasonRollover({
    currentYear: 2026,
    clubs: career.clubs,
    userClubId: 'flamengo',
    userSquad: career.squad,
    aiSquads: career.aiSquads || {},
    freeAgents: career.freeAgents || [],
    loanedOutPlayers: [],
    standings: career.standings,
    secondaryStandings: career.secondaryStandings || [],
    copaDoBrasil: career.copaDoBrasil!,
    libertadores: career.libertadores!,
    championsLeague: ucl,
    mundial,
    superMundial: career.superMundial,
    accumulatedUclChampions: [],
    accumulatedLibChampions: [],
    seasonHistory: [],
    managerName: 'Técnico',
    youthAcademy: career.youthAcademy,
  });

  assert.equal(rollover.nextYear, 2027);
  assert.ok(rollover.archiveEntry.uclChampionName);
  assert.ok(rollover.archiveEntry.mundialChampionName);
  assert.equal(rollover.nextChampionsLeague.seasonYear, 2027);
  assert.equal(rollover.nextChampionsLeague.championClubId, null);
  assert.equal(rollover.nextMundial.seasonYear, 2027);
  assert.equal(rollover.nextMundial.isSeeded, false);
  assert.equal(rollover.nextSuperMundial.editionYear, 2030);
  assert.equal(rollover.nextSuperMundial.isActiveThisSeason, false);
  assert.equal(rollover.nextSuperMundial.nextEditionYear, 2030);
  assert.ok(
    rollover.nextAccumulatedUclChampions.includes(ucl.championClubId!),
    'Season rollover must track UCL champion for next quadrennial Super Mundial'
  );
});

test('Neymar Jr. & Messi retain 5★ career expectation, valuation is strictly monotonic across age/potential/OVR, and Transfermarkt 2026 scale + Bi formatting + v5 migration work', () => {
  const santos = ALL_WORLD_CLUBS.find((c) => c.id === 'santos')!;
  const interMiami = ALL_WORLD_CLUBS.find((c) => c.id === 'inter-miami')!;
  const neymar = getRealSquadForClub(santos).find((p) =>
    p.name.toLowerCase().includes('neymar')
  )!;
  const messi = getRealSquadForClub(interMiami).find((p) =>
    p.name.toLowerCase().includes('messi')
  )!;

  assert.equal(neymar.potentialStars, 5, 'Neymar Jr. must have 5★ career expectation');
  assert.equal(messi.potentialStars, 5, 'Lionel Messi must have 5★ career expectation');

  // Strict monotonicity across all divisions, ages, stars, and OVRs
  const divisions = ['B', 'A', 'LIB', 'WORLD', 'UCL'] as const;
  const sampleAges = [17, 20, 24, 28, 34, 38];
  const starsGrid = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const;

  for (const div of divisions) {
    const clubReputation = div === 'UCL' ? 92 : div === 'A' ? 84 : div === 'B' ? 72 : 80;
    for (const age of sampleAges) {
      for (const stars of starsGrid) {
        let prevVal = 0;
        for (let ovr = 60; ovr <= 95; ovr++) {
          const val = calculateBalancedValuationAndWage({
            ovr,
            age,
            clubReputation,
            division: div,
            potentialStars: stars,
            position: 'ATA',
          }).marketValue;
          assert.ok(
            val > prevVal,
            `Higher OVR must always command higher value (${div}, age=${age}, stars=${stars}, ovr=${ovr})`
          );
          prevVal = val;
        }
      }
    }

    for (let ovr = 62; ovr <= 92; ovr += 6) {
      for (const stars of starsGrid) {
        let prevVal = Infinity;
        for (let age = 16; age <= 40; age++) {
          const val = calculateBalancedValuationAndWage({
            ovr,
            age,
            clubReputation,
            division: div,
            potentialStars: stars,
            position: 'ATA',
          }).marketValue;
          assert.ok(
            val < prevVal,
            `Younger player must always be worth more than older player (${div}, ovr=${ovr}, stars=${stars}, age=${age})`
          );
          prevVal = val;
        }
      }

      for (const age of sampleAges) {
        let prevVal = 0;
        for (const stars of starsGrid) {
          const val = calculateBalancedValuationAndWage({
            ovr,
            age,
            clubReputation,
            division: div,
            potentialStars: stars,
            position: 'ATA',
          }).marketValue;
          assert.ok(
            val > prevVal,
            `Higher potential stars must always command higher value (${div}, ovr=${ovr}, age=${age}, stars=${stars})`
          );
          prevVal = val;
        }
      }
    }
  }

  // Modern Transfermarkt 2026 benchmarks & Billion BRL formatting
  const barcelona = ALL_WORLD_CLUBS.find((c) => c.id === 'barcelona')!;
  const realMadrid = ALL_WORLD_CLUBS.find((c) => c.id === 'real-madrid')!;
  const yamal = getRealSquadForClub(barcelona).find((p) => p.name.includes('Yamal'))!;
  const vini = getRealSquadForClub(realMadrid).find((p) => p.name.includes('Vinícius'))!;

  assert.ok(yamal.marketValue >= 800_000_000, `Expected Lamine Yamal >= R$800M, got ${yamal.marketValue}`);
  assert.ok(vini.marketValue >= 950_000_000, `Expected Vinícius Jr >= R$950M, got ${vini.marketValue}`);
  assert.equal(formatCompactBRL(1_068_000_000, 'BRL'), 'R$ 1,07Bi');
  assert.equal(formatCompactBRL(1_068_000_000, 'EUR'), '€ 178,0M');

  // Legacy v4 save hydration upgrades clubs and player values to v5
  const career = createNewCareerSave(1, 'flamengo', 'Técnico');
  const legacyV4Save = {
    ...career,
    globalScaleVersion: 4,
    clubs: career.clubs.map((c) =>
      c.id === 'flamengo' ? { ...c, cashBalance: 90_000_000, wageBudget: 12_000_000 } : c
    ),
    squad: career.squad.map((p) => ({ ...p, marketValue: 10_000_000, salary: 150_000 })),
  };
  const hydrated = hydrateCareerSave(legacyV4Save);
  assert.equal(hydrated.globalScaleVersion, GLOBAL_SCALE_VERSION);
  const upgradedFla = hydrated.clubs.find((c) => c.id === 'flamengo')!;
  assert.ok(upgradedFla.cashBalance >= 240_000_000);
  assert.ok(upgradedFla.wageBudget >= 24_000_000);
  assert.ok(hydrated.squad[0].marketValue > 10_000_000);
});
