import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  ALL_PLAYABLE_CLUBS,
  ALL_WORLD_CLUBS,
  BUNDESLIGA_CLUBS,
  BUNDESLIGA_CLUB_IDS,
  BUNDESLIGA_EXTRA_CLUBS,
  GLOBAL_WORLD_CLUBS,
  LALIGA_CLUBS,
  LALIGA_CLUB_IDS,
  LALIGA_EXTRA_CLUBS,
  LIGUE_1_CLUBS,
  LIGUE_1_CLUB_IDS,
  LIGUE_1_EXTRA_CLUBS,
  LIGA_PORTUGAL_CLUBS,
  LIGA_PORTUGAL_CLUB_IDS,
  LIGA_PORTUGAL_EXTRA_CLUBS,
  PREMIER_LEAGUE_CLUBS,
  PREMIER_LEAGUE_CLUB_IDS,
  PREMIER_LEAGUE_EXTRA_CLUBS,
  SERIE_A_IT_CLUBS,
  SERIE_A_IT_CLUB_IDS,
  SERIE_A_IT_EXTRA_CLUBS,
  UCL_CLUBS,
  getRealSquadForClub,
} from '../data/initialDatabase';
import { getClubBadgeUrl } from '../data/clubBadgeAssets';
import {
  COMPETITION_LOGO_FILES,
  CompetitionLogoKey,
  getCompetitionLogoKeyFromContext,
  getCompetitionLogoUrl,
} from '../data/competitionLogoAssets';
import { INTERNATIONAL_MARKET_CLUBS } from '../data/transferCatalog';
import {
  CHAMPIONS_STAGES,
  MUNDIAL_STAGES,
  SEASON_CALENDAR,
  SUPER_MUNDIAL_KNOCKOUT_STAGES,
  advanceChampionsLeagueStage,
  advanceMundialStage,
  advanceSuperMundialGroupRound,
  advanceSuperMundialKnockoutStage,
  createInitialChampionsLeague,
  createInitialMundial,
  createInitialSuperMundial,
  findUserFixtureForStep,
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
  AutoSimCareerSnapshot,
  getMaxSeasonDayOffset,
  simulateNextAutoStep,
} from './autoTacticsAndSim';
import {
  GLOBAL_SCALE_VERSION,
  calculateBalancedValuationAndWage,
} from './economyAndEvolution';
import { formatCompactBRL } from '../utils/formatters';
import {
  StorageAdapter,
  hydrateCareerSave,
  loadCareerSlot,
  saveCareerToSlot,
} from '../utils/saveManager';

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

test('All 20 Premier League and 20 La Liga clubs exist with 18 real players each, calibrated OVRs, zero duplicates, and Mercado Internacional listings', () => {
  assert.equal(PREMIER_LEAGUE_CLUB_IDS.length, 20, 'Premier League must have all 20 clubs');
  assert.equal(LALIGA_CLUB_IDS.length, 20, 'La Liga must have all 20 clubs');
  assert.equal(PREMIER_LEAGUE_EXTRA_CLUBS.length, 16);
  assert.equal(LALIGA_EXTRA_CLUBS.length, 17);

  const byId = new Map(ALL_WORLD_CLUBS.map((c) => [c.id, c]));
  const allPlAndLaLigaIds = [...PREMIER_LEAGUE_CLUB_IDS, ...LALIGA_CLUB_IDS];
  assert.equal(new Set(allPlAndLaLigaIds).size, 40, 'No overlap between PL and La Liga club IDs');

  for (const clubId of allPlAndLaLigaIds) {
    const club = byId.get(clubId);
    assert.ok(club, `Missing club ${clubId} in ALL_WORLD_CLUBS`);
    const squad = getRealSquadForClub(club);
    assert.equal(squad.length, 18, `Expected 18 real players for ${club.name}`);
    assert.equal(squad.filter((p) => p.isStarter).length, 11, `Expected 11 starters for ${club.name}`);

    const shirtSet = new Set(squad.map((p) => p.number));
    assert.equal(shirtSet.size, 18, `Duplicate shirt numbers found in ${club.name}`);

    for (const p of squad) {
      const ovr = calculatePlayerOverall(p.attributes, p.position);
      assert.ok(ovr >= 60 && ovr <= 95, `OVR ${ovr} out of bounds for ${p.name} (${club.name})`);
    }
  }

  // Spot-check real OVR hierarchy (Dibu Martínez, Bruno Guimarães, Nico Williams, Yeremay Hernández)
  const villaSquad = getRealSquadForClub(byId.get('aston-villa')!);
  const dibu = villaSquad.find((p) => p.name.includes('Dibu'))!;
  assert.equal(calculatePlayerOverall(dibu.attributes, dibu.position), 86);

  const arsenalSquad = getRealSquadForClub(byId.get('arsenal')!);
  const brunoG = arsenalSquad.find((p) => p.name.includes('Bruno Guimarães'))!;
  assert.equal(calculatePlayerOverall(brunoG.attributes, brunoG.position), 87);

  const athleticSquad = getRealSquadForClub(byId.get('athletic-bilbao')!);
  const nico = athleticSquad.find((p) => p.name === 'Nico Williams')!;
  assert.equal(calculatePlayerOverall(nico.attributes, nico.position), 85);

  // Verify all 154 playable clubs resolve to an existing .png badge on disk
  for (const playableClub of ALL_PLAYABLE_CLUBS) {
    const badgeUrl = getClubBadgeUrl(playableClub.id, './');
    assert.ok(badgeUrl, `Missing badge URL for playable club ${playableClub.id}`);
    assert.ok(
      badgeUrl.endsWith('.png'),
      `Expected playable club ${playableClub.id} badge to use .png, got ${badgeUrl}`
    );
    const diskPath = path.resolve(process.cwd(), 'public', badgeUrl.replace(/^\.\//, ''));
    assert.ok(fs.existsSync(diskPath), `Missing .png badge file on disk for ${playableClub.id}: ${diskPath}`);
  }

  // Market listings include all 33 additional PL & La Liga clubs under INTERNACIONAL
  const career = createNewCareerSave(1, 'flamengo', 'Técnico');
  const listings = buildAllMarketListings({
    clubs: career.clubs,
    userClubId: 'flamengo',
    freeAgents: career.freeAgents || [],
    transferredOutClubPlayerIds: [],
    aiSquads: career.aiSquads,
  });
  const plExtraListings = listings.filter(
    (l) => l.scope === 'INTERNACIONAL' && Boolean(l.originClub?.leagueName.startsWith('Premier League'))
  );
  const laLigaExtraListings = listings.filter(
    (l) => l.scope === 'INTERNACIONAL' && Boolean(l.originClub?.leagueName.startsWith('La Liga'))
  );
  assert.equal(plExtraListings.length, 16 * 18);
  assert.equal(laLigaExtraListings.length, 17 * 18);
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
    totalFiveStarPlayers >= 5 && totalFiveStarPlayers <= 24,
    `Expected rare 5★ global count (5..24), got ${totalFiveStarPlayers} out of ${totalWorldPlayers}`
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
    arrascaOvr <= mbappeOvr - 5,
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
    avgStarterOvr(rmSquad) >= avgStarterOvr(flaSquad) + 3.5,
    'UCL giant XI average OVR must clearly exceed top Brasileirão XI'
  );
  assert.ok(
    avgStarterOvr(flaSquad) >= avgStarterOvr(ponteSquad) + 5,
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
  const divisions = ['B', 'A', 'LIB', 'WORLD', 'LIGA_PORTUGAL', 'LIGUE_1', 'LALIGA', 'BUNDESLIGA', 'SERIE_A_IT', 'PL', 'UCL'] as const;
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
  assert.ok(vini.marketValue >= 900_000_000, `Expected Vinícius Jr >= R$900M, got ${vini.marketValue}`);
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

test('All Premier League, La Liga, Bundesliga, Serie A Italiana, Ligue 1 & Liga Portugal clubs are 100% playable alongside Brasileirão Série A & B (154 playable clubs total)', () => {
  assert.equal(PREMIER_LEAGUE_CLUBS.length, 20);
  assert.equal(LALIGA_CLUBS.length, 20);
  assert.equal(BUNDESLIGA_CLUBS.length, 18);
  assert.equal(SERIE_A_IT_CLUBS.length, 20);
  assert.equal(LIGUE_1_CLUBS.length, 18);
  assert.equal(LIGA_PORTUGAL_CLUBS.length, 18);
  assert.equal(ALL_PLAYABLE_CLUBS.length, 154);
  assert.equal(new Set(ALL_PLAYABLE_CLUBS.map((c) => c.id)).size, 154);

  for (const club of PREMIER_LEAGUE_CLUBS) {
    const save = createNewCareerSave(1, club.id, 'Treinador');
    assert.equal(save.division, 'PL', `${club.name} must launch in Premier League (PL)`);
    assert.equal(save.userClubId, club.id);
    assert.equal(save.standings.length, 20, `${club.name} must have 20-club PL standings`);
    assert.equal(
      save.secondaryStandings?.length,
      20,
      `${club.name} must have 20-club La Liga secondary standings`
    );
    assert.equal(save.fixtures.length, 380, `${club.name} must have 380 PL fixtures`);
    assert.equal(
      save.fixtures.filter((f) => f.isUserMatch).length,
      38,
      `${club.name} must have 38 user league fixtures`
    );
    assert.equal(save.squad.length, 18);
    assert.equal(save.squad.filter((p) => p.isStarter).length, 11);
  }

  for (const club of LALIGA_CLUBS) {
    const save = createNewCareerSave(2, club.id, 'Entrenador');
    assert.equal(save.division, 'LALIGA', `${club.name} must launch in La Liga (LALIGA)`);
    assert.equal(save.userClubId, club.id);
    assert.equal(save.standings.length, 20, `${club.name} must have 20-club La Liga standings`);
    assert.equal(
      save.secondaryStandings?.length,
      20,
      `${club.name} must have 20-club PL secondary standings`
    );
    assert.equal(save.fixtures.length, 380, `${club.name} must have 380 La Liga fixtures`);
    assert.equal(
      save.fixtures.filter((f) => f.isUserMatch).length,
      38,
      `${club.name} must have 38 user league fixtures`
    );
    assert.equal(save.squad.length, 18);
    assert.equal(save.squad.filter((p) => p.isStarter).length, 11);
  }
});

test('European UCL clubs play Champions League knockout matches while non-UCL PL/La Liga clubs stay domestic', () => {
  const uclR16Step = SEASON_CALENDAR.find(
    (s) => s.competition === 'CHAMPIONS_LEAGUE' && s.uclStage === 'Oitavas'
  )!;
  assert.ok(uclR16Step, 'Season calendar must include UCL Oitavas step');

  const arsenalCareer = createNewCareerSave(1, 'arsenal', 'Arteta');
  const arsenalUclFix = findUserFixtureForStep(
    uclR16Step,
    'arsenal',
    arsenalCareer.fixtures,
    arsenalCareer.copaDoBrasil!,
    arsenalCareer.libertadores!,
    arsenalCareer.mundial,
    arsenalCareer.superMundial,
    arsenalCareer.championsLeague
  );
  assert.ok(arsenalUclFix, 'Arsenal must have a playable UCL Oitavas fixture');
  assert.equal(arsenalUclFix!.isUserMatch, true);
  assert.ok(
    arsenalUclFix!.homeClubId === 'arsenal' || arsenalUclFix!.awayClubId === 'arsenal'
  );

  const realCareer = createNewCareerSave(2, 'real-madrid', 'Ancelotti');
  const realUclFix = findUserFixtureForStep(
    uclR16Step,
    'real-madrid',
    realCareer.fixtures,
    realCareer.copaDoBrasil!,
    realCareer.libertadores!,
    realCareer.mundial,
    realCareer.superMundial,
    realCareer.championsLeague
  );
  assert.ok(realUclFix, 'Real Madrid must have a playable UCL Oitavas fixture');
  assert.equal(realUclFix!.isUserMatch, true);

  const villaCareer = createNewCareerSave(3, 'aston-villa', 'Emery');
  const villaUclFix = findUserFixtureForStep(
    uclR16Step,
    'aston-villa',
    villaCareer.fixtures,
    villaCareer.copaDoBrasil!,
    villaCareer.libertadores!,
    villaCareer.mundial,
    villaCareer.superMundial,
    villaCareer.championsLeague
  );
  assert.equal(villaUclFix, null, 'Non-UCL PL club should not be forced into UCL Oitavas');
});

test('Premier League and La Liga careers complete full-season auto-simulation and rollover to 2027 cleanly', () => {
  const runFullSeasonAndRollover = (clubId: string, expectedDiv: 'PL' | 'LALIGA') => {
    const career = createNewCareerSave(1, clubId, 'Manager');
    assert.equal(career.division, expectedDiv);

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
      const stepRes = simulateNextAutoStep(snapshot, endDay, () => 0.42);
      snapshot = stepRes.snapshot;
      if (stepRes.done) break;
    }

    assert.equal(
      snapshot.fixtures.filter((f) => f.played).length,
      380,
      `All 380 ${expectedDiv} league fixtures must be played`
    );
    assert.equal(
      snapshot.secondaryFixtures.filter((f) => f.played).length,
      380,
      `All 380 secondary European league fixtures must be played`
    );
    assert.ok(snapshot.championsLeague?.championClubId, 'Champions League must finish with a champion');

    const rollover = executeNewSeasonRollover({
      currentYear: 2026,
      clubs: snapshot.clubs,
      userClubId: clubId,
      userSquad: snapshot.squad,
      aiSquads: snapshot.aiSquads || {},
      freeAgents: career.freeAgents || [],
      loanedOutPlayers: snapshot.loanedOutPlayers || [],
      standings: snapshot.standings,
      secondaryStandings: snapshot.secondaryStandings,
      copaDoBrasil: snapshot.copaDoBrasil,
      libertadores: snapshot.libertadores,
      championsLeague: snapshot.championsLeague,
      mundial: snapshot.mundial,
      superMundial: snapshot.superMundial,
      accumulatedUclChampions: [],
      accumulatedLibChampions: [],
      seasonHistory: [],
      managerName: 'Manager',
      youthAcademy: snapshot.youthAcademy,
    });

    assert.equal(rollover.nextYear, 2027);
    assert.equal(rollover.report.userFinalDivision, expectedDiv);
    assert.equal(rollover.report.userPromoted, false);
    assert.equal(rollover.report.userRelegated, false);
    assert.ok(rollover.report.premierLeagueChampionName);
    assert.ok(rollover.report.laLigaChampionName);
    assert.ok(rollover.report.userSeasonPrize > 0, 'European clubs must receive end-of-season league prize');
    assert.equal(rollover.nextStandings.length, 20);
    assert.equal(rollover.nextSecondaryStandings.length, 20);
    assert.equal(rollover.nextFixtures.length, 380);
    assert.equal(rollover.nextSecondaryFixtures.length, 380);
    assert.equal(rollover.nextFixtures.filter((f) => f.isUserMatch).length, 38);
  };

  runFullSeasonAndRollover('arsenal', 'PL');
  runFullSeasonAndRollover('villarreal', 'LALIGA');
});

test('saveManager persists and reloads Premier League and La Liga career slots cleanly', () => {
  const mem = new Map<string, string>();
  const storage: StorageAdapter = {
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => {
      mem.set(k, v);
    },
    removeItem: (k) => {
      mem.delete(k);
    },
  };

  const plSave = createNewCareerSave(1, 'liverpool', 'Slot');
  const laLigaSave = createNewCareerSave(2, 'barcelona', 'Flick');
  saveCareerToSlot(plSave, storage);
  saveCareerToSlot(laLigaSave, storage);

  const loadedPl = loadCareerSlot(1, storage);
  const loadedLaLiga = loadCareerSlot(2, storage);

  assert.ok(loadedPl, 'PL career slot must reload cleanly');
  assert.equal(loadedPl!.division, 'PL');
  assert.equal(loadedPl!.userClubId, 'liverpool');
  assert.equal(loadedPl!.standings.length, 20);

  assert.ok(loadedLaLiga, 'La Liga career slot must reload cleanly');
  assert.equal(loadedLaLiga!.division, 'LALIGA');
  assert.equal(loadedLaLiga!.userClubId, 'barcelona');
  assert.equal(loadedLaLiga!.standings.length, 20);
});

test('All 18 Bundesliga and 20 Serie A Italiana clubs have 18 real players, calibrated OVRs, registered SVG badges on disk, and Mercado Internacional listings', () => {
  assert.equal(BUNDESLIGA_CLUB_IDS.length, 18, 'Bundesliga must have all 18 clubs');
  assert.equal(SERIE_A_IT_CLUB_IDS.length, 20, 'Serie A Italiana must have all 20 clubs');
  assert.equal(BUNDESLIGA_EXTRA_CLUBS.length, 15);
  assert.equal(SERIE_A_IT_EXTRA_CLUBS.length, 17);

  const byId = new Map(ALL_WORLD_CLUBS.map((c) => [c.id, c]));
  const allDeItIds = [...BUNDESLIGA_CLUB_IDS, ...SERIE_A_IT_CLUB_IDS];
  assert.equal(new Set(allDeItIds).size, 38, 'No overlap between Bundesliga and Serie A Italiana IDs');

  for (const clubId of allDeItIds) {
    const club = byId.get(clubId);
    assert.ok(club, `Missing club ${clubId} in ALL_WORLD_CLUBS`);
    const squad = getRealSquadForClub(club);
    assert.equal(squad.length, 18, `Expected 18 real players for ${club.name}`);
    assert.equal(squad.filter((p) => p.isStarter).length, 11, `Expected 11 starters for ${club.name}`);

    const shirtSet = new Set(squad.map((p) => p.number));
    assert.equal(shirtSet.size, 18, `Duplicate shirt numbers found in ${club.name}`);

    for (const p of squad) {
      const ovr = calculatePlayerOverall(p.attributes, p.position);
      assert.ok(ovr >= 60 && ovr <= 95, `OVR ${ovr} out of bounds for ${p.name} (${club.name})`);
    }

    const badgeUrl = getClubBadgeUrl(clubId, './');
    assert.ok(badgeUrl, `Badge URL must be registered for ${clubId}`);
    const diskPath = path.resolve(process.cwd(), 'public', badgeUrl.replace(/^\.\//, ''));
    assert.ok(fs.existsSync(diskPath), `Badge file missing on disk: ${diskPath}`);
  }

  // Market listings include all 15 extra Bundesliga and 17 extra Serie A Italiana clubs under INTERNACIONAL
  const career = createNewCareerSave(1, 'flamengo', 'Técnico');
  const listings = buildAllMarketListings({
    clubs: career.clubs,
    userClubId: 'flamengo',
    freeAgents: career.freeAgents || [],
    transferredOutClubPlayerIds: [],
    aiSquads: career.aiSquads,
  });
  const buLiExtraListings = listings.filter(
    (l) => l.scope === 'INTERNACIONAL' && Boolean(l.originClub?.leagueName.startsWith('Bundesliga'))
  );
  const serieAItExtraListings = listings.filter(
    (l) => l.scope === 'INTERNACIONAL' && Boolean(l.originClub?.leagueName.startsWith('Serie A Italiana'))
  );
  assert.equal(buLiExtraListings.length, 15 * 18);
  assert.equal(serieAItExtraListings.length, 17 * 18);
});

test('Every Bundesliga (18) and Serie A Italiana (20) club launches a valid playable career with exact 34-round / 38-round schedules', () => {
  for (const club of BUNDESLIGA_CLUBS) {
    const save = createNewCareerSave(1, club.id, 'Trainer');
    assert.equal(save.division, 'BUNDESLIGA', `${club.name} must launch in BUNDESLIGA`);
    assert.equal(save.userClubId, club.id);
    assert.equal(save.standings.length, 18, `${club.name} must have 18-club Bundesliga standings`);
    assert.equal(save.secondaryStandings?.length, 20, `${club.name} must have 20-club Serie A IT secondary standings`);
    assert.equal(save.fixtures.length, 306, `${club.name} must have 306 Bundesliga fixtures (34 rounds x 9)`);
    assert.equal(save.secondaryFixtures?.length, 380, `${club.name} must have 380 Serie A IT secondary fixtures`);
    assert.equal(save.fixtures.filter((f) => f.isUserMatch).length, 34, `${club.name} must have 34 user league matches`);
    assert.equal(save.squad.length, 18);
    assert.equal(save.squad.filter((p) => p.isStarter).length, 11);
  }

  for (const club of SERIE_A_IT_CLUBS) {
    const save = createNewCareerSave(2, club.id, 'Mister');
    assert.equal(save.division, 'SERIE_A_IT', `${club.name} must launch in SERIE_A_IT`);
    assert.equal(save.userClubId, club.id);
    assert.equal(save.standings.length, 20, `${club.name} must have 20-club Serie A IT standings`);
    assert.equal(save.secondaryStandings?.length, 18, `${club.name} must have 18-club Bundesliga secondary standings`);
    assert.equal(save.fixtures.length, 380, `${club.name} must have 380 Serie A IT fixtures (38 rounds x 10)`);
    assert.equal(save.secondaryFixtures?.length, 306, `${club.name} must have 306 Bundesliga secondary fixtures`);
    assert.equal(save.fixtures.filter((f) => f.isUserMatch).length, 38, `${club.name} must have 38 user league matches`);
    assert.equal(save.squad.length, 18);
    assert.equal(save.squad.filter((p) => p.isStarter).length, 11);
  }
});

test('Bundesliga (34 rounds) and Serie A Italiana (38 rounds) careers complete full-season auto-sim, rollover to 2027, and save/reload cleanly', () => {
  const runDeItSeason = (
    clubId: string,
    expectedDiv: 'BUNDESLIGA' | 'SERIE_A_IT',
    expectedPrimaryFixtures: number,
    expectedSecondaryFixtures: number,
    expectedPrimaryClubs: number,
    expectedSecondaryClubs: number,
    expectedUserRounds: number
  ) => {
    const career = createNewCareerSave(1, clubId, 'Manager');
    assert.equal(career.division, expectedDiv);

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
      const stepRes = simulateNextAutoStep(snapshot, endDay, () => 0.44);
      snapshot = stepRes.snapshot;
      if (stepRes.done) break;
    }

    assert.equal(
      snapshot.fixtures.filter((f) => f.played).length,
      expectedPrimaryFixtures,
      `All ${expectedPrimaryFixtures} ${expectedDiv} league fixtures must be played`
    );
    assert.equal(
      snapshot.secondaryFixtures.filter((f) => f.played).length,
      expectedSecondaryFixtures,
      `All ${expectedSecondaryFixtures} paired secondary fixtures must be played`
    );
    assert.ok(snapshot.championsLeague?.championClubId, 'Champions League must finish with a champion');

    const rollover = executeNewSeasonRollover({
      currentYear: 2026,
      clubs: snapshot.clubs,
      userClubId: clubId,
      userSquad: snapshot.squad,
      aiSquads: snapshot.aiSquads || {},
      freeAgents: career.freeAgents || [],
      loanedOutPlayers: snapshot.loanedOutPlayers || [],
      standings: snapshot.standings,
      secondaryStandings: snapshot.secondaryStandings,
      copaDoBrasil: snapshot.copaDoBrasil,
      libertadores: snapshot.libertadores,
      championsLeague: snapshot.championsLeague,
      mundial: snapshot.mundial,
      superMundial: snapshot.superMundial,
      accumulatedUclChampions: [],
      accumulatedLibChampions: [],
      seasonHistory: [],
      managerName: 'Manager',
      youthAcademy: snapshot.youthAcademy,
    });

    assert.equal(rollover.nextYear, 2027);
    assert.equal(rollover.report.userFinalDivision, expectedDiv);
    assert.ok(rollover.report.bundesligaChampionName, 'Bundesliga champion must be recorded');
    assert.ok(rollover.report.serieAItChampionName, 'Serie A Italiana champion must be recorded');
    assert.ok(rollover.report.userSeasonPrize > 0, 'European clubs must receive end-of-season league prize');
    assert.equal(rollover.nextStandings.length, expectedPrimaryClubs);
    assert.equal(rollover.nextSecondaryStandings.length, expectedSecondaryClubs);
    assert.equal(rollover.nextFixtures.length, expectedPrimaryFixtures);
    assert.equal(rollover.nextSecondaryFixtures.length, expectedSecondaryFixtures);
    assert.equal(rollover.nextFixtures.filter((f) => f.isUserMatch).length, expectedUserRounds);
  };

  runDeItSeason('rb-leipzig', 'BUNDESLIGA', 306, 380, 18, 20, 34);
  runDeItSeason('napoli', 'SERIE_A_IT', 380, 306, 20, 18, 38);

  const mem = new Map<string, string>();
  const storage: StorageAdapter = {
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => {
      mem.set(k, v);
    },
    removeItem: (k) => {
      mem.delete(k);
    },
  };

  const buLiSave = createNewCareerSave(3, 'eintracht-frankfurt', 'Toppmöller');
  const serieAItSave = createNewCareerSave(4, 'atalanta', 'Gasperini');
  saveCareerToSlot(buLiSave, storage);
  saveCareerToSlot(serieAItSave, storage);

  const loadedBuLi = loadCareerSlot(3, storage);
  const loadedSerieAIt = loadCareerSlot(4, storage);

  assert.ok(loadedBuLi, 'Bundesliga career slot must reload cleanly');
  assert.equal(loadedBuLi!.division, 'BUNDESLIGA');
  assert.equal(loadedBuLi!.userClubId, 'eintracht-frankfurt');
  assert.equal(loadedBuLi!.standings.length, 18);

  assert.ok(loadedSerieAIt, 'Serie A Italiana career slot must reload cleanly');
  assert.equal(loadedSerieAIt!.division, 'SERIE_A_IT');
  assert.equal(loadedSerieAIt!.userClubId, 'atalanta');
  assert.equal(loadedSerieAIt!.standings.length, 20);
});

test('All 18 Ligue 1 and 18 Liga Portugal clubs have 18 real players, unique shirt numbers, calibrated OVRs, registered badges on disk, no intl-porto duplicate, and Mercado Internacional listings', () => {
  assert.equal(LIGUE_1_CLUB_IDS.length, 18, 'Ligue 1 must have all 18 clubs');
  assert.equal(LIGA_PORTUGAL_CLUB_IDS.length, 18, 'Liga Portugal must have all 18 clubs');
  assert.equal(LIGUE_1_EXTRA_CLUBS.length, 17);
  assert.equal(LIGA_PORTUGAL_EXTRA_CLUBS.length, 16);

  assert.equal(
    INTERNATIONAL_MARKET_CLUBS.some((c) => c.id === 'intl-porto'),
    false,
    'Legacy intl-porto stub must be removed now that fc-porto is playable'
  );

  const byId = new Map(ALL_WORLD_CLUBS.map((c) => [c.id, c]));
  const allFrPtIds = [...LIGUE_1_CLUB_IDS, ...LIGA_PORTUGAL_CLUB_IDS];
  assert.equal(new Set(allFrPtIds).size, 36, 'No overlap between Ligue 1 and Liga Portugal IDs');

  for (const clubId of allFrPtIds) {
    const club = byId.get(clubId);
    assert.ok(club, `Missing club ${clubId} in ALL_WORLD_CLUBS`);
    const squad = getRealSquadForClub(club);
    assert.equal(squad.length, 18, `Expected 18 real players for ${club.name}`);
    assert.equal(squad.filter((p) => p.isStarter).length, 11, `Expected 11 starters for ${club.name}`);

    const shirtSet = new Set(squad.map((p) => p.number));
    assert.equal(shirtSet.size, 18, `Duplicate shirt numbers found in ${club.name}`);

    for (const p of squad) {
      const ovr = calculatePlayerOverall(p.attributes, p.position);
      assert.ok(ovr >= 60 && ovr <= 95, `OVR ${ovr} out of bounds for ${p.name} (${club.name})`);
    }

    const badgeUrl = getClubBadgeUrl(clubId, './');
    assert.ok(badgeUrl, `Badge URL must be registered for ${clubId}`);
    const diskPath = path.resolve(process.cwd(), 'public', badgeUrl.replace(/^\.\//, ''));
    assert.ok(fs.existsSync(diskPath), `Badge file missing on disk: ${diskPath}`);
  }

  const career = createNewCareerSave(1, 'flamengo', 'Técnico');
  const listings = buildAllMarketListings({
    clubs: career.clubs,
    userClubId: 'flamengo',
    freeAgents: career.freeAgents || [],
    transferredOutClubPlayerIds: [],
    aiSquads: career.aiSquads,
  });
  const ligue1ExtraListings = listings.filter(
    (l) => l.scope === 'INTERNACIONAL' && Boolean(l.originClub?.leagueName.startsWith('Ligue 1'))
  );
  const ligaPortugalExtraListings = listings.filter(
    (l) => l.scope === 'INTERNACIONAL' && Boolean(l.originClub?.leagueName.startsWith('Liga Portugal'))
  );
  assert.equal(ligue1ExtraListings.length, 17 * 18);
  assert.equal(ligaPortugalExtraListings.length, 16 * 18);
});

test('Every Ligue 1 (18) and Liga Portugal (18) club launches a valid playable career with exact 34-round / 306-fixture schedules', () => {
  for (const club of LIGUE_1_CLUBS) {
    const save = createNewCareerSave(1, club.id, 'Entraîneur');
    assert.equal(save.division, 'LIGUE_1', `${club.name} must launch in LIGUE_1`);
    assert.equal(save.userClubId, club.id);
    assert.equal(save.standings.length, 18, `${club.name} must have 18-club Ligue 1 standings`);
    assert.equal(save.secondaryStandings?.length, 18, `${club.name} must have 18-club Liga Portugal secondary standings`);
    assert.equal(save.fixtures.length, 306, `${club.name} must have 306 Ligue 1 fixtures (34 rounds x 9)`);
    assert.equal(save.secondaryFixtures?.length, 306, `${club.name} must have 306 Liga Portugal secondary fixtures`);
    assert.equal(save.fixtures.filter((f) => f.isUserMatch).length, 34, `${club.name} must have 34 user league matches`);
    assert.equal(save.squad.length, 18);
    assert.equal(save.squad.filter((p) => p.isStarter).length, 11);
  }

  for (const club of LIGA_PORTUGAL_CLUBS) {
    const save = createNewCareerSave(2, club.id, 'Treinador');
    assert.equal(save.division, 'LIGA_PORTUGAL', `${club.name} must launch in LIGA_PORTUGAL`);
    assert.equal(save.userClubId, club.id);
    assert.equal(save.standings.length, 18, `${club.name} must have 18-club Liga Portugal standings`);
    assert.equal(save.secondaryStandings?.length, 18, `${club.name} must have 18-club Ligue 1 secondary standings`);
    assert.equal(save.fixtures.length, 306, `${club.name} must have 306 Liga Portugal fixtures (34 rounds x 9)`);
    assert.equal(save.secondaryFixtures?.length, 306, `${club.name} must have 306 Ligue 1 secondary fixtures`);
    assert.equal(save.fixtures.filter((f) => f.isUserMatch).length, 34, `${club.name} must have 34 user league matches`);
    assert.equal(save.squad.length, 18);
    assert.equal(save.squad.filter((p) => p.isStarter).length, 11);
  }
});

test('Ligue 1 (34 rounds) and Liga Portugal (34 rounds) careers complete full-season auto-sim, rollover to 2027, and save/reload cleanly', () => {
  const runFrPtSeason = (clubId: string, expectedDiv: 'LIGUE_1' | 'LIGA_PORTUGAL') => {
    const career = createNewCareerSave(1, clubId, 'Manager');
    assert.equal(career.division, expectedDiv);

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
      const stepRes = simulateNextAutoStep(snapshot, endDay, () => 0.46);
      snapshot = stepRes.snapshot;
      if (stepRes.done) break;
    }

    assert.equal(
      snapshot.fixtures.filter((f) => f.played).length,
      306,
      `All 306 ${expectedDiv} league fixtures must be played`
    );
    assert.equal(
      snapshot.secondaryFixtures.filter((f) => f.played).length,
      306,
      `All 306 paired Franco-Portuguese fixtures must be played`
    );
    assert.ok(snapshot.championsLeague?.championClubId, 'Champions League must finish with a champion');

    const rollover = executeNewSeasonRollover({
      currentYear: 2026,
      clubs: snapshot.clubs,
      userClubId: clubId,
      userSquad: snapshot.squad,
      aiSquads: snapshot.aiSquads || {},
      freeAgents: career.freeAgents || [],
      loanedOutPlayers: snapshot.loanedOutPlayers || [],
      standings: snapshot.standings,
      secondaryStandings: snapshot.secondaryStandings,
      copaDoBrasil: snapshot.copaDoBrasil,
      libertadores: snapshot.libertadores,
      championsLeague: snapshot.championsLeague,
      mundial: snapshot.mundial,
      superMundial: snapshot.superMundial,
      accumulatedUclChampions: [],
      accumulatedLibChampions: [],
      seasonHistory: [],
      managerName: 'Manager',
      youthAcademy: snapshot.youthAcademy,
    });

    assert.equal(rollover.nextYear, 2027);
    assert.equal(rollover.report.userFinalDivision, expectedDiv);
    assert.ok(rollover.report.ligue1ChampionName, 'Ligue 1 champion must be recorded');
    assert.ok(rollover.report.ligaPortugalChampionName, 'Liga Portugal champion must be recorded');
    assert.ok(rollover.report.userSeasonPrize > 0, 'Franco-Portuguese clubs must receive end-of-season league prize');
    assert.equal(rollover.nextStandings.length, 18);
    assert.equal(rollover.nextSecondaryStandings.length, 18);
    assert.equal(rollover.nextFixtures.length, 306);
    assert.equal(rollover.nextSecondaryFixtures.length, 306);
    assert.equal(rollover.nextFixtures.filter((f) => f.isUserMatch).length, 34);
  };

  runFrPtSeason('olympique-marseille', 'LIGUE_1');
  runFrPtSeason('fc-porto', 'LIGA_PORTUGAL');

  const mem = new Map<string, string>();
  const storage: StorageAdapter = {
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => {
      mem.set(k, v);
    },
    removeItem: (k) => {
      mem.delete(k);
    },
  };

  const ligue1Save = createNewCareerSave(3, 'as-monaco', 'Hütter');
  const ligaPortSave = createNewCareerSave(4, 'sc-braga', 'Carvalhal');
  saveCareerToSlot(ligue1Save, storage);
  saveCareerToSlot(ligaPortSave, storage);

  const loadedLigue1 = loadCareerSlot(3, storage);
  const loadedLigaPort = loadCareerSlot(4, storage);

  assert.ok(loadedLigue1, 'Ligue 1 career slot must reload cleanly');
  assert.equal(loadedLigue1!.division, 'LIGUE_1');
  assert.equal(loadedLigue1!.userClubId, 'as-monaco');
  assert.equal(loadedLigue1!.standings.length, 18);

  assert.ok(loadedLigaPort, 'Liga Portugal career slot must reload cleanly');
  assert.equal(loadedLigaPort!.division, 'LIGA_PORTUGAL');
  assert.equal(loadedLigaPort!.userClubId, 'sc-braga');
  assert.equal(loadedLigaPort!.standings.length, 18);
});

test('September 2026 rosters, starPlayers OVRs, and rising Youth Academy prospects are aligned across all 154 playable clubs', () => {
  const seen = new Set<string>();
  for (const club of ALL_PLAYABLE_CLUBS) {
    if (seen.has(club.id)) continue;
    seen.add(club.id);

    const squad = getRealSquadForClub(club);
    assert.ok(squad.length >= 18, `Club ${club.id} must have at least 18 players`);

    const starters = squad.filter((p) => p.isStarter);
    assert.equal(starters.length, 11, `Club ${club.id} must have 11 starters`);

    const avgStarterOvr = Math.round(
      starters.reduce((sum, p) => sum + calculatePlayerOverall(p.attributes, p.position), 0) /
        starters.length
    );
    const clubAvgOvr = Math.round(
      (club.overallAttack + club.overallMidfield + club.overallDefense) / 3
    );
    assert.ok(
      Math.abs(avgStarterOvr - clubAvgOvr) <= 2,
      `Club ${club.id} starter average OVR (${avgStarterOvr}) drifted from club sectors average (${clubAvgOvr})`
    );

    for (const sp of club.starPlayers || []) {
      const found = squad.find(
        (p) =>
          p.name.toLowerCase().includes(sp.name.toLowerCase()) ||
          sp.name.toLowerCase().includes(p.name.toLowerCase())
      );
      assert.ok(found, `Star player ${sp.name} must exist in ${club.id} squad`);
      const actualOvr = calculatePlayerOverall(found!.attributes, found!.position);
      assert.ok(
        Math.abs(actualOvr - sp.overall) <= 1,
        `Star player ${sp.name} at ${club.id} expected OVR ${sp.overall} but got ${actualOvr}`
      );
    }
  }
  assert.equal(seen.size, 154, 'Must audit all 154 unique playable clubs');

  // Verify club-specific rising youth academy prospects
  const expectedAcademyGems: Array<[string, string, string]> = [
    ['flamengo', 'Lorran', 'Brasil'],
    ['palmeiras', 'Luighi', 'Brasil'],
    ['santos', 'Robinho Jr.', 'Brasil'],
    ['gremio', 'Gabriel Mec', 'Brasil'],
    ['atletico-mg', 'Gabriel Veneno', 'Brasil'],
    ['barcelona', 'Marc Bernal', 'Espanha'],
    ['real-madrid', 'Joan Martínez', 'Espanha'],
    ['arsenal', 'Max Dowman', 'Inglaterra'],
    ['liverpool', 'Rio Ngumoha', 'Inglaterra'],
    ['bayern', 'Lennart Karl', 'Alemanha'],
    ['psg', 'Senny Mayulu', 'França'],
    ['ac-milan', 'Francesco Camarda', 'Itália'],
    ['benfica', 'João Rego', 'Portugal'],
    ['sporting', 'João Simões', 'Portugal'],
    ['fc-porto', 'Gonçalo Sousa', 'Portugal'],
  ];

  for (const [clubId, expectedName, expectedNationality] of expectedAcademyGems) {
    const career = createNewCareerSave(1, clubId, 'Manager');
    const roster = career.youthAcademy?.youthRoster || [];
    assert.ok(roster.length >= 5, `Youth academy for ${clubId} must have at least 5 rising prospects`);
    const gem = roster.find((p) => p.name === expectedName);
    assert.ok(gem, `Youth academy for ${clubId} must include rising prospect ${expectedName}`);
    assert.equal(gem!.nationality, expectedNationality);
    assert.ok((gem!.potentialStars ?? 0) >= 4.0, `${expectedName} must have >= 4.0★ potential`);
    const gemOvr = calculatePlayerOverall(gem!.attributes, gem!.position);
    assert.ok(gemOvr >= 72 && gemOvr <= 80, `${expectedName} OVR (${gemOvr}) must be in rising academy range`);
  }

  // Verify September 2026 Premier League and European transfers & zero unexpected Euro-Euro duplicates
  const worldById = new Map<string, (typeof ALL_WORLD_CLUBS)[number]>();
  for (const c of ALL_WORLD_CLUBS) {
    if (!worldById.has(c.id)) worldById.set(c.id, c);
  }
  const hasPlayer = (clubId: string, nameFragment: string) =>
    getRealSquadForClub(worldById.get(clubId)!).some((p) =>
      p.name.toLowerCase().includes(nameFragment.toLowerCase())
    );

  // 10 Premier League September 2026 transfers
  assert.ok(hasPlayer('man-city', 'Enzo Fernández'));
  assert.ok(hasPlayer('man-city', 'Elliot Anderson'));
  assert.ok(hasPlayer('man-city', 'Ayyoub Bouaddi'));
  assert.ok(hasPlayer('chelsea', 'Morgan Rogers'));
  assert.ok(hasPlayer('liverpool', 'Bradley Barcola'));
  assert.ok(hasPlayer('tottenham', 'Sandro Tonali'));
  assert.ok(hasPlayer('tottenham', 'Mateus Fernandes'));
  assert.ok(hasPlayer('tottenham', 'Savinho'));
  assert.ok(hasPlayer('arsenal', 'Bruno Guimarães'));
  assert.ok(!hasPlayer('brighton', 'Carlos Baleba'));

  // Key European September 2026 transfers
  assert.ok(hasPlayer('barcelona', 'Rodri'));
  assert.ok(hasPlayer('real-madrid', 'Bernardo Silva'));
  assert.ok(hasPlayer('real-madrid', 'Ibrahima Konaté'));
  assert.ok(hasPlayer('atletico-madrid', 'Cristian Romero'));
  assert.ok(hasPlayer('atletico-madrid', 'Alejandro Grimaldo'));
  assert.ok(hasPlayer('atletico-madrid', 'Morten Hjulmand'));
  assert.ok(hasPlayer('rb-leipzig', 'Christopher Nkunku'));
  assert.ok(hasPlayer('napoli', 'Rasmus Højlund'));
  assert.ok(hasPlayer('aston-villa', 'Leon Goretzka'));
  assert.ok(hasPlayer('aston-villa', 'Alejandro Garnacho'));
  assert.ok(hasPlayer('nottingham-forest', 'Ousmane Diomande'));
  assert.ok(hasPlayer('nottingham-forest', 'Liam Delap'));
  assert.ok(hasPlayer('as-roma', 'Rodrigo Mora'));
  assert.ok(hasPlayer('as-roma', 'Leonardo Balerdi'));
  assert.ok(hasPlayer('newcastle', 'Nico González'));

  const euroDivisions = new Set([
    'UCL',
    'PREMIER_LEAGUE',
    'LALIGA',
    'BUNDESLIGA',
    'SERIE_A_IT',
    'LIGUE_1',
    'LIGA_PORTUGAL',
  ]);
  const euroNames = new Map<string, string[]>();
  for (const club of worldById.values()) {
    if (!euroDivisions.has(club.division)) continue;
    for (const player of getRealSquadForClub(club)) {
      const key = player.name.trim().toLowerCase();
      if (!euroNames.has(key)) euroNames.set(key, []);
      euroNames.get(key)!.push(club.id);
    }
  }
  const allowedHomonyms = new Set(['vitinha', 'pablo martínez']);
  for (const [playerName, clubIds] of euroNames.entries()) {
    if (clubIds.length > 1 && !allowedHomonyms.has(playerName)) {
      assert.fail(`Unexpected cross-club duplicate in Europe: ${playerName} at ${clubIds.join(', ')}`);
    }
  }
});

test('All competition and league logos resolve to existing asset files on disk', () => {
  const keys = Object.keys(COMPETITION_LOGO_FILES) as CompetitionLogoKey[];
  assert.ok(keys.length >= 15);

  for (const key of keys) {
    const url = getCompetitionLogoUrl(key, './');
    assert.ok(url.startsWith('./leagues/'), `Unexpected logo URL for ${key}: ${url}`);
    const diskPath = path.resolve(process.cwd(), 'public', url.replace(/^\.\//, ''));
    assert.ok(
      fs.existsSync(diskPath),
      `Missing competition logo asset on disk for ${key}: ${diskPath}`
    );
  }

  assert.equal(getCompetitionLogoKeyFromContext('BRASILEIRAO', 'PL'), 'PL');
  assert.equal(getCompetitionLogoKeyFromContext('BRASILEIRAO', 'A'), 'A');
  assert.equal(getCompetitionLogoKeyFromContext('BRASILEIRAO', 'LIGA_PORTUGAL'), 'LIGA_PORTUGAL');
  assert.equal(getCompetitionLogoKeyFromContext('LIBERTADORES', 'A'), 'LIBERTADORES');
  assert.equal(getCompetitionLogoKeyFromContext('COPA_DO_BRASIL', 'B'), 'COPA_DO_BRASIL');
  assert.equal(getCompetitionLogoKeyFromContext('CHAMPIONS_LEAGUE', 'LALIGA'), 'CHAMPIONS_LEAGUE');
  assert.equal(getCompetitionLogoKeyFromContext('MUNDIAL', 'A'), 'MUNDIAL');
  assert.equal(getCompetitionLogoKeyFromContext('SUPER_MUNDIAL', 'BUNDESLIGA'), 'SUPER_MUNDIAL');
});




