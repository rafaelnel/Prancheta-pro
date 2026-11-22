import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewCareerSave } from '../data/careerFactory';
import {
  NEGOTIATION_LOCK_DAYS,
  acceptTransferCounterOffer,
  evaluateTransferNegotiation,
  executeIncomingTransfer,
  getPlayerNegotiationBlockInfo,
  recordTransferNegotiationAttempt,
  rollPlayerNegotiationMaxAttempts,
} from './transferEngine';
import type {
  MarketPlayerListing,
  Player,
  PlayerNegotiationState,
} from '../types/football';
import { calculatePlayerOverall } from './matchEngine';

function makeCustomListing(params: {
  id: string;
  name: string;
  age: number;
  attrLevel: number;
  potentialStars: 1 | 1.5 | 2 | 2.5 | 3 | 3.5 | 4 | 4.5 | 5;
  dynamicCeilingOvr: number;
  sellerRep: number;
  sellerScope?: 'SERIE_A' | 'SERIE_B' | 'INTERNACIONAL';
  isStarter?: boolean;
  isLoanListed?: boolean;
  isTransferListed?: boolean;
  salary?: number;
  buyFee?: number;
  loanFee?: number;
}): MarketPlayerListing {
  const v = params.attrLevel;
  const player: Player = {
    id: params.id,
    number: 10,
    name: params.name,
    age: params.age,
    nationality: 'Brasil',
    position: 'MEI',
    sector: 'MEI',
    condition: 95,
    morale: 'Bom',
    marketValue: params.buyFee ?? 30_000_000,
    salary: params.salary ?? 350_000,
    potentialStars: params.potentialStars,
    basePotentialOvr: params.dynamicCeilingOvr,
    dynamicCeilingOvr: params.dynamicCeilingOvr,
    attributes: {
      passe: v,
      finalizacao: v,
      drible: v,
      desarme: Math.max(8, v - 3),
      primeiroToque: v,
      cruzamento: v,
      decisoes: v,
      visaoDeJogo: v,
      compostura: v,
      semBola: v,
      posicionamento: v,
      indiceDeTrabalho: v,
      velocidade: v,
      aceleracao: v,
      resistencia: v,
      forca: Math.max(10, v - 2),
      impulsao: Math.max(10, v - 2),
      agilidade: v,
    },
    isStarter: params.isStarter ?? true,
    slotIndex: params.isStarter ? 8 : null,
    assignedRole: 'meia-atacante',
    assignedDuty: 'Atacar',
    injured: false,
    seasonStats: {
      matches: 0,
      goals: 0,
      assists: 0,
      yellowCards: 0,
      avgRating: 7.0,
    },
    isLoanListed: params.isLoanListed,
    isTransferListed: params.isTransferListed,
  };

  const ovr = calculatePlayerOverall(player.attributes, player.position);

  return {
    player,
    ovr,
    originClub: {
      id: `club-${params.id}`,
      name: 'Clube Gigante',
      shortName: 'GIG',
      abbr: 'GIG',
      country: 'Brasil',
      leagueName: params.sellerScope === 'INTERNACIONAL' ? 'Europa' : 'Série A',
      scope: params.sellerScope ?? 'SERIE_A',
      primaryColor: '#ffffff',
      reputation: params.sellerRep,
      avgStrength: 80,
    },
    scope: params.sellerScope ?? 'SERIE_A',
    isClubStarter: params.isStarter ?? true,
    buyFee: params.buyFee ?? 25_000_000,
    loanFee: params.loanFee ?? 2_000_000,
    loanAvailable: true,
    isLoanListed: params.isLoanListed,
    isTransferListed: params.isTransferListed,
  };
}

test('Young high-potential player resists and rejects weaker club while veteran accepts much more easily', () => {
  const ponteCareer = createNewCareerSave(1, 'ponte-preta', 'Técnico');
  const richWeakClub = {
    ...ponteCareer.clubs.find((c) => c.id === 'ponte-preta')!,
    cashBalance: 300_000_000,
    wageBudget: 30_000_000,
  };

  const youngProdigy = makeCustomListing({
    id: 'young-star',
    name: 'Joia Sub-20',
    age: 20,
    attrLevel: 16,
    potentialStars: 4.5,
    dynamicCeilingOvr: 88,
    sellerRep: 86,
    sellerScope: 'INTERNACIONAL',
  });

  const experiencedVet = makeCustomListing({
    id: 'vet-33',
    name: 'Veterano 33',
    age: 33,
    attrLevel: 15,
    potentialStars: 2.5,
    dynamicCeilingOvr: youngProdigy.ovr - 1,
    sellerRep: 82,
    sellerScope: 'SERIE_A',
  });

  const evalYoungBuy = evaluateTransferNegotiation({
    userClub: richWeakClub,
    userSquad: ponteCareer.squad,
    listing: youngProdigy,
    dealMode: 'BUY',
  });
  const evalYoungLoan = evaluateTransferNegotiation({
    userClub: richWeakClub,
    userSquad: ponteCareer.squad,
    listing: youngProdigy,
    dealMode: 'LOAN',
  });
  const evalVetBuy = evaluateTransferNegotiation({
    userClub: richWeakClub,
    userSquad: ponteCareer.squad,
    listing: experiencedVet,
    dealMode: 'BUY',
  });

  assert.equal(
    evalYoungBuy.willHardRejectByPlayer,
    true,
    'Young high-potential star should flag hard refusal for much weaker Série B club'
  );
  assert.equal(
    evalYoungLoan.willHardRejectByPlayer,
    true,
    'Young high-potential star not loan-listed should also resist unappealing loan to weaker club'
  );
  assert.ok(
    evalVetBuy.playerWillingnessChance > evalYoungBuy.playerWillingnessChance + 20,
    'Experienced 33yo veteran should be much more willing to join weaker club than 20yo prodigy'
  );
  assert.ok(
    evalVetBuy.acceptanceChance > evalYoungBuy.acceptanceChance + 15,
    'Veteran overall acceptance chance at weaker club should exceed young prodigy'
  );

  const execYoungRejected = executeIncomingTransfer({
    userClub: richWeakClub,
    userSquad: ponteCareer.squad,
    freeAgents: [],
    transferredOutClubPlayerIds: [],
    listing: youngProdigy,
    dealMode: 'BUY',
    evaluation: evalYoungBuy,
    rng: () => 0.75,
  });
  assert.equal(execYoungRejected.outcome, 'RECUSADA');
  assert.equal(execYoungRejected.rejectedBy, 'JOGADOR');
  assert.equal(execYoungRejected.accepted, false);
});

test('Offered money (fee tier + salary boost) lowers resistance and unlocks counteroffer/acceptance', () => {
  const flamengoCareer = createNewCareerSave(2, 'flamengo', 'Técnico');
  const richFlamengo = {
    ...flamengoCareer.clubs.find((c) => c.id === 'flamengo')!,
    cashBalance: 500_000_000,
    wageBudget: 60_000_000,
  };

  const primeTarget = makeCustomListing({
    id: 'prime-target',
    name: 'Meia Valorizado',
    age: 26,
    attrLevel: 16,
    potentialStars: 4,
    dynamicCeilingOvr: 84,
    sellerRep: 85,
    sellerScope: 'INTERNACIONAL',
    salary: 600_000,
    buyFee: 40_000_000,
  });

  const stdEval = evaluateTransferNegotiation({
    userClub: richFlamengo,
    userSquad: flamengoCareer.squad,
    listing: primeTarget,
    dealMode: 'BUY',
    offerTier: 'PADRAO',
    salaryOfferMult: 1.0,
  });

  const boostedEval = evaluateTransferNegotiation({
    userClub: richFlamengo,
    userSquad: flamengoCareer.squad,
    listing: primeTarget,
    dealMode: 'BUY',
    offerTier: 'FORTE_50',
    salaryOfferMult: 1.4,
  });

  assert.ok(boostedEval.acceptanceChance > stdEval.acceptanceChance);
  assert.ok(boostedEval.playerWillingnessChance > stdEval.playerWillingnessChance);
  assert.ok(boostedEval.effectiveFee > stdEval.effectiveFee);
  assert.ok(boostedEval.effectiveSalary > stdEval.effectiveSalary);
});

test('executeIncomingTransfer supports ACEITA, CONTRAPROPOSTA, RECUSADA and acceptTransferCounterOffer closes deal', () => {
  const flamengoCareer = createNewCareerSave(3, 'flamengo', 'Técnico');
  const richFlamengo = {
    ...flamengoCareer.clubs.find((c) => c.id === 'flamengo')!,
    cashBalance: 300_000_000,
    wageBudget: 50_000_000,
  };

  const target = makeCustomListing({
    id: 'mid-target',
    name: 'Atleta Negociável',
    age: 26,
    attrLevel: 16,
    potentialStars: 4,
    dynamicCeilingOvr: 84,
    sellerRep: 85,
    sellerScope: 'INTERNACIONAL',
    salary: 450_000,
    buyFee: 32_000_000,
  });

  const evaluation = evaluateTransferNegotiation({
    userClub: richFlamengo,
    userSquad: flamengoCareer.squad,
    listing: target,
    dealMode: 'BUY',
    offerTier: 'PADRAO',
  });
  assert.ok(
    evaluation.acceptanceChance > 15 && evaluation.acceptanceChance < 80,
    `Expected mid-band acceptanceChance, got ${evaluation.acceptanceChance}`
  );

  // 1. Accepted when roll <= acceptanceChance
  const acceptedAttempt = executeIncomingTransfer({
    userClub: richFlamengo,
    userSquad: flamengoCareer.squad,
    freeAgents: [],
    transferredOutClubPlayerIds: [],
    listing: target,
    dealMode: 'BUY',
    evaluation,
    rng: () => 0.05,
  });
  assert.equal(acceptedAttempt.outcome, 'ACEITA');
  assert.equal(acceptedAttempt.accepted, true);
  assert.ok(acceptedAttempt.signedPlayer);

  // 2. Counter-offer when roll falls inside [acceptanceChance + 1 .. acceptanceChance + 30]
  const counterRollNorm = Math.min(0.92, (evaluation.acceptanceChance + 12) / 100);
  const counterAttempt = executeIncomingTransfer({
    userClub: richFlamengo,
    userSquad: flamengoCareer.squad,
    freeAgents: [],
    transferredOutClubPlayerIds: [],
    listing: target,
    dealMode: 'BUY',
    evaluation,
    rng: () => counterRollNorm,
  });
  assert.equal(counterAttempt.outcome, 'CONTRAPROPOSTA');
  assert.equal(counterAttempt.accepted, false);
  assert.ok(counterAttempt.counterOffer);
  assert.ok(
    counterAttempt.counterOffer!.counterFee >= evaluation.effectiveFee
  );

  // Accepting the counter-offer completes the transfer cleanly
  const resolved = acceptTransferCounterOffer({
    userClub: richFlamengo,
    userSquad: flamengoCareer.squad,
    freeAgents: [],
    transferredOutClubPlayerIds: [],
    listing: target,
    dealMode: 'BUY',
    counterOffer: counterAttempt.counterOffer!,
  });
  assert.equal(resolved.accepted, true);
  assert.ok(resolved.signedPlayer);
  assert.equal(resolved.updatedSquad.length, flamengoCareer.squad.length + 1);
  assert.equal(
    resolved.updatedClub.cashBalance,
    richFlamengo.cashBalance - counterAttempt.counterOffer!.counterFee
  );

  // 3. Refused when roll > acceptanceChance + 30
  const rejectedAttempt = executeIncomingTransfer({
    userClub: richFlamengo,
    userSquad: flamengoCareer.squad,
    freeAgents: [],
    transferredOutClubPlayerIds: [],
    listing: target,
    dealMode: 'BUY',
    evaluation,
    rng: () => 0.99,
  });
  assert.equal(rejectedAttempt.outcome, 'RECUSADA');
  assert.equal(rejectedAttempt.accepted, false);
});

test('Market listings are coherent: starters are never loan-listed, U22 wonderkids are loan-listed (not discount transfer-listed), and PES/EA FC OVRs & potentials are realistic', async () => {
  const { buildAllMarketListings } = await import('./transferEngine');
  const career = createNewCareerSave(1, 'flamengo', 'Técnico');
  const listings = buildAllMarketListings({
    clubs: career.clubs,
    userClubId: 'flamengo',
    freeAgents: career.freeAgents || [],
    transferredOutClubPlayerIds: [],
    aiSquads: career.aiSquads,
  });

  // 1. No starter should ever be loan-listed or loan-available
  const starterLoanListed = listings.filter(
    (l) => l.isClubStarter && (l.isLoanListed || l.loanAvailable)
  );
  assert.equal(
    starterLoanListed.length,
    0,
    'No club starter should be marked as loan-listed or loan-available'
  );

  // 2. Real Madrid & Bayern Munich players are now full UCL club rosters under INTERNACIONAL scope
  const endrick = listings.find((l) => l.player.name === 'Endrick');
  assert.ok(endrick, 'Endrick should exist in international UCL listings');
  assert.equal(endrick!.scope, 'INTERNACIONAL');
  assert.equal(endrick!.isTransferListed, false);
  assert.ok(
    (endrick!.player.potentialStars ?? 0) >= 4.5,
    `Expected Endrick high potential stars (>=4.5), got ${endrick!.player.potentialStars}`
  );
  assert.ok(
    endrick!.ovr >= 75 && endrick!.ovr <= 82,
    `Expected Endrick OVR in 75..82 range, got ${endrick!.ovr}`
  );

  // 3. UCL club rotational players (e.g. João Palhinha) appear in INTERNACIONAL scope with Champions League label
  const palhinha = listings.find((l) => l.player.name === 'João Palhinha');
  assert.ok(palhinha, 'João Palhinha should exist in Bayern UCL squad');
  assert.equal(palhinha!.scope, 'INTERNACIONAL');
  assert.ok(palhinha!.originClub?.leagueName.startsWith('Champions League'));

  // 4. Brasileirão Série A stars (Arrascaeta, Léo Ortiz) have realistic global-scale OVRs and age-anchored potential ceilings
  const arrascaeta = career.squad.find((p) => p.name.includes('Arrascaeta'))!;
  const leoOrtiz = career.squad.find((p) => p.name.includes('Léo Ortiz'))!;
  const arrOvr = calculatePlayerOverall(arrascaeta.attributes, arrascaeta.position);
  const ortizOvr = calculatePlayerOverall(leoOrtiz.attributes, leoOrtiz.position);

  assert.ok(
    arrOvr >= 79 && arrOvr <= 84,
    `Expected Arrascaeta OVR in 79..84 global range, got ${arrOvr}`
  );
  assert.ok(
    ortizOvr >= 76 && ortizOvr <= 81,
    `Expected Léo Ortiz OVR in 76..81 global range, got ${ortizOvr}`
  );
  assert.ok(
    (leoOrtiz.potentialStars ?? 0) >= 3.5 && (leoOrtiz.potentialStars ?? 0) <= 4,
    `30yo Léo Ortiz should be 3.5★..4★ in global scale with UCL stars, got ${leoOrtiz.potentialStars}`
  );
  assert.equal(
    leoOrtiz.dynamicCeilingOvr,
    ortizOvr,
    '30yo player should have dynamicCeilingOvr anchored to current OVR'
  );

  // 5. Free agents are in a balanced 66..75 OVR range
  const freeAgentListings = listings.filter((l) => l.scope === 'LIVRES');
  assert.ok(freeAgentListings.length >= 15);
  for (const fa of freeAgentListings) {
    assert.ok(
      fa.ovr >= 65 && fa.ovr <= 75,
      `Free agent ${fa.player.name} OVR (${fa.ovr}) should stay within balanced 65..75 range`
    );
  }

  // 6. Selective reserve listings: NOT all reserves are listed; most bench players stay unlisted as active rotation
  const domesticBench = listings.filter(
    (l) =>
      (l.scope === 'SERIE_A' || l.scope === 'SERIE_B') &&
      !l.isClubStarter
  );
  const domesticListed = domesticBench.filter(
    (l) => l.isTransferListed || l.isLoanListed
  );
  const listedRatio = domesticListed.length / Math.max(1, domesticBench.length);
  assert.ok(
    listedRatio < 0.35,
    `Expected selective reserve listings (<35% of bench), got ${(listedRatio * 100).toFixed(1)}% (${domesticListed.length}/${domesticBench.length})`
  );

  // Every domestic player marked loanAvailable must genuinely be loan-listed by their club
  const unrequestedLoan = domesticBench.filter(
    (l) => l.loanAvailable && !l.isLoanListed
  );
  assert.equal(
    unrequestedLoan.length,
    0,
    'Reserves not loan-listed by their club should not be forced into loanAvailable'
  );
});

test('evaluateAiClubSquadAndListings protects useful direct backups and lists only positional surplus or age/evolution out-of-plan reserves', async () => {
  const { evaluateAiClubSquadAndListings } = await import('./aiMarketEngine');
  const career = createNewCareerSave(1, 'flamengo', 'Técnico');
  const club = {
    ...career.clubs.find((c) => c.id === 'palmeiras')!,
    formation: '4-2-3-1' as const,
    overallAttack: 78,
    overallMidfield: 78,
    overallDefense: 78,
    cashBalance: 45_000_000,
  };

  const makeBenchPlayer = (
    id: string,
    pos: Player['position'],
    sector: Player['sector'],
    age: number,
    attr: number,
    ceiling: number,
    isStarter = false
  ): Player => ({
    ...career.squad[0],
    id,
    name: id,
    position: pos,
    sector,
    age,
    isStarter,
    slotIndex: isStarter ? 1 : null,
    basePotentialOvr: ceiling,
    dynamicCeilingOvr: ceiling,
    contractType: 'DEFINITIVO',
    isTransferListed: false,
    isLoanListed: false,
    attributes: {
      passe: attr,
      finalizacao: attr,
      drible: attr,
      desarme: attr,
      primeiroToque: attr,
      cruzamento: attr,
      decisoes: attr,
      visaoDeJogo: attr,
      compostura: attr,
      semBola: attr,
      posicionamento: attr,
      indiceDeTrabalho: attr,
      velocidade: attr,
      aceleracao: attr,
      resistencia: attr,
      forca: attr,
      impulsao: attr,
      agilidade: attr,
    },
  });

  // Build realistic 21-man squad: 11 starters + mix of protected backups & surplus/out-of-plan reserves
  const testSquad: Player[] = [
    makeBenchPlayer('st-gol', 'GOL', 'GOL', 28, 16, 79, true),
    makeBenchPlayer('st-zag1', 'ZAG', 'DEF', 27, 16, 79, true),
    makeBenchPlayer('st-zag2', 'ZAG', 'DEF', 26, 16, 79, true),
    makeBenchPlayer('st-ld', 'LD', 'DEF', 26, 16, 79, true),
    makeBenchPlayer('st-le', 'LE', 'DEF', 25, 16, 79, true),
    makeBenchPlayer('st-vol1', 'VOL', 'MEI', 27, 16, 79, true),
    makeBenchPlayer('st-vol2', 'VOL', 'MEI', 26, 16, 79, true),
    makeBenchPlayer('st-mei', 'MEI', 'MEI', 27, 16, 79, true),
    makeBenchPlayer('st-pd', 'PD', 'ATA', 25, 16, 79, true),
    makeBenchPlayer('st-pe', 'PE', 'ATA', 24, 16, 79, true),
    makeBenchPlayer('st-ata', 'ATA', 'ATA', 26, 16, 79, true),
    // Protected useful direct backups:
    makeBenchPlayer('bk-gol-2', 'GOL', 'GOL', 27, 14, 73, false),
    makeBenchPlayer('bk-zag-3', 'ZAG', 'DEF', 25, 15, 76, false),
    makeBenchPlayer('bk-ld-useful', 'LD', 'DEF', 23, 15, 78, false),
    makeBenchPlayer('bk-vol-useful', 'VOL', 'MEI', 28, 15, 76, false),
    makeBenchPlayer('bk-ata-2', 'ATA', 'ATA', 24, 15, 78, false),
    // Surplus 3rd striker (26yo -> should be transfer-listed due to positional excess):
    makeBenchPlayer('surplus-ata-3', 'ATA', 'ATA', 26, 14, 74, false),
    // Aging veteran below club tier (34yo, low OVR -> should be transfer-listed due to age/plan):
    makeBenchPlayer('aging-mei-out', 'MEI', 'MEI', 34, 13, 71, false),
    // Young blocked prospect needing minutes to evolve (19yo, big headroom, stuck behind 2 STs -> loan-listed):
    makeBenchPlayer('young-ata-4', 'ATA', 'ATA', 19, 13, 82, false),
    // Extra fillers so squad size > MIN_SQUAD_SIZE
    makeBenchPlayer('bk-le-useful', 'LE', 'DEF', 26, 15, 76, false),
    makeBenchPlayer('bk-pd-useful', 'PD', 'ATA', 24, 15, 77, false),
  ];

  const evaluated = evaluateAiClubSquadAndListings(club, testSquad);
  const byId = new Map(evaluated.map((p) => [p.id, p]));

  // Protected backups must NOT be listed
  for (const id of ['bk-gol-2', 'bk-zag-3', 'bk-ld-useful', 'bk-vol-useful', 'bk-ata-2', 'bk-le-useful', 'bk-pd-useful']) {
    const p = byId.get(id)!;
    assert.equal(p.isTransferListed, false, `Useful backup ${id} should NOT be transfer-listed`);
    assert.equal(p.isLoanListed, false, `Useful backup ${id} should NOT be loan-listed`);
  }

  // Surplus / out-of-plan reserves MUST be listed appropriately
  assert.equal(byId.get('surplus-ata-3')!.isTransferListed, true, '3rd striker (26yo) should be transfer-listed for positional surplus');
  assert.equal(byId.get('aging-mei-out')!.isTransferListed, true, '34yo low-OVR reserve should be transfer-listed as out of plan by age');
  assert.equal(byId.get('young-ata-4')!.isLoanListed, true, '19yo high-potential blocked prospect should be loan-listed for evolution');
});

test('Below-market offerMultiplier lowers fee and progressively decreases acceptanceChance', () => {
  const flamengoCareer = createNewCareerSave(4, 'flamengo', 'Técnico');
  const richFlamengo = {
    ...flamengoCareer.clubs.find((c) => c.id === 'flamengo')!,
    cashBalance: 500_000_000,
    wageBudget: 60_000_000,
  };

  const target = makeCustomListing({
    id: 'bargain-target',
    name: 'Meia Barganha',
    age: 27,
    attrLevel: 15,
    potentialStars: 3.5,
    dynamicCeilingOvr: 80,
    sellerRep: 82,
    sellerScope: 'SERIE_A',
    salary: 300_000,
    buyFee: 30_000_000,
  });

  const eval50 = evaluateTransferNegotiation({
    userClub: richFlamengo,
    userSquad: flamengoCareer.squad,
    listing: target,
    dealMode: 'BUY',
    offerMultiplier: 0.5,
  });
  const eval75 = evaluateTransferNegotiation({
    userClub: richFlamengo,
    userSquad: flamengoCareer.squad,
    listing: target,
    dealMode: 'BUY',
    offerMultiplier: 0.75,
  });
  const eval100 = evaluateTransferNegotiation({
    userClub: richFlamengo,
    userSquad: flamengoCareer.squad,
    listing: target,
    dealMode: 'BUY',
    offerMultiplier: 1.0,
  });
  const eval125 = evaluateTransferNegotiation({
    userClub: richFlamengo,
    userSquad: flamengoCareer.squad,
    listing: target,
    dealMode: 'BUY',
    offerMultiplier: 1.25,
  });

  assert.equal(eval50.effectiveFee, 15_000_000, '50% offer should halve the 30M asking fee');
  assert.equal(eval75.effectiveFee, 22_500_000, '75% offer should be 22.5M');
  assert.equal(eval100.effectiveFee, 30_000_000, '100% offer should be 30M');
  assert.ok(
    eval50.acceptanceChance < eval75.acceptanceChance &&
      eval75.acceptanceChance < eval100.acceptanceChance &&
      eval100.acceptanceChance <= eval125.acceptanceChance,
    `Expected monotonically increasing chance: 50%=${eval50.acceptanceChance}, 75%=${eval75.acceptanceChance}, 100%=${eval100.acceptanceChance}, 125%=${eval125.acceptanceChance}`
  );
  assert.ok(
    eval75.moneyInfluenceNote.includes('abaixo'),
    'Below-market note should warn about lower acceptance chance'
  );

  // Counter-offer on lowball bid must ask at least ~95% of asking price
  const lowballCounter = executeIncomingTransfer({
    userClub: richFlamengo,
    userSquad: flamengoCareer.squad,
    freeAgents: [],
    transferredOutClubPlayerIds: [],
    listing: target,
    dealMode: 'BUY',
    evaluation: eval75,
    rng: () => Math.min(0.92, (eval75.acceptanceChance + 10) / 100),
  });
  if (lowballCounter.outcome === 'CONTRAPROPOSTA' && lowballCounter.counterOffer) {
    assert.ok(
      lowballCounter.counterOffer.counterFee >= 28_500_000,
      `Club counter-offer (${lowballCounter.counterOffer.counterFee}) should not undercut asking value`
    );
  }
});

test('Player walks away after 2 to 4 failed proposals and is locked for 1 full year (365 days)', () => {
  const target = makeCustomListing({
    id: 'patience-target',
    name: 'Atleta Impaciente',
    age: 24,
    attrLevel: 16,
    potentialStars: 4,
    dynamicCeilingOvr: 84,
    sellerRep: 85,
    sellerScope: 'SERIE_A',
  });

  // Max attempts always strictly between 2 and 4 across RNG spectrum
  for (const r of [0, 0.15, 0.35, 0.55, 0.75, 0.99]) {
    const maxA = rollPlayerNegotiationMaxAttempts(target.player, target, () => r);
    assert.ok(
      maxA >= 2 && maxA <= 4,
      `rollPlayerNegotiationMaxAttempts must be 2..4, got ${maxA}`
    );
  }

  let states: Record<string, PlayerNegotiationState> = {};

  // Force maxAttempts = 2 via low RNG (0.1)
  const attempt1 = recordTransferNegotiationAttempt({
    states,
    player: target.player,
    listing: target,
    outcome: 'RECUSADA',
    seasonYear: 2026,
    dayOffset: 10,
    rng: () => 0.1,
  });
  states = attempt1.nextStates;
  assert.equal(attempt1.justBlocked, false, 'Should not block after 1st proposal');
  assert.equal(attempt1.playerState?.attemptsCount, 1);
  assert.equal(attempt1.playerState?.maxAttempts, 2);

  // 2nd failed proposal hits maxAttempts=2 -> blocks for 1 full year
  const attempt2 = recordTransferNegotiationAttempt({
    states,
    player: target.player,
    listing: target,
    outcome: 'RECUSADA',
    seasonYear: 2026,
    dayOffset: 10,
    rng: () => 0.9, // ignored because existing cycle preserves maxAttempts=2
  });
  states = attempt2.nextStates;
  assert.equal(attempt2.justBlocked, true, '2nd failed proposal should trigger 1-year block');
  assert.ok(
    attempt2.blockedUntilDateLabel?.includes('2027'),
    `Expected unblock date in 2027, got ${attempt2.blockedUntilDateLabel}`
  );

  // Still blocked 364 days later
  const infoDayBefore = getPlayerNegotiationBlockInfo(states[target.player.id], 2027, 9);
  assert.equal(infoDayBefore.isBlocked, true, 'Should still be blocked 1 day before 1-year expiry');
  assert.equal(infoDayBefore.remainingDays, 1);

  // Unblocked exactly 1 year (365 days) later
  const infoAfterYear = getPlayerNegotiationBlockInfo(states[target.player.id], 2027, 10);
  assert.equal(infoAfterYear.isBlocked, false, 'Should automatically unblock after 1 full year (365 days)');
  assert.equal(infoAfterYear.activeAttemptsCount, 0);
  assert.equal(NEGOTIATION_LOCK_DAYS, 365);

  // Accepted deal clears negotiation state cleanly
  const acceptedClear = recordTransferNegotiationAttempt({
    states,
    player: target.player,
    listing: target,
    outcome: 'ACEITA',
    seasonYear: 2027,
    dayOffset: 10,
  });
  assert.equal(acceptedClear.nextStates[target.player.id], undefined);
});

test('Incoming offers populate market value, potential ceiling, salary, role and contract snapshots for manager decision analysis', async () => {
  const { maybeGenerateIncomingOfferForUser, createOfferInboxMessage } = await import(
    './aiMarketEngine'
  );
  const career = createNewCareerSave(1, 'flamengo', 'Técnico');
  const userClub = career.clubs.find((c) => c.id === 'flamengo')!;
  const targetPlayer = career.squad.find((p) => p.isStarter && p.position !== 'GOL')!;
  const listedSquad = career.squad.map((p) =>
    p.id === targetPlayer.id ? { ...p, isTransferListed: true } : p
  );

  const offer = maybeGenerateIncomingOfferForUser({
    userClub,
    userSquad: listedSquad,
    clubs: career.clubs,
    aiSquads: career.aiSquads || {},
    pendingOffers: [],
    dayOffset: 14,
    seasonYear: 2026,
    specificPlayerId: targetPlayer.id,
    rng: () => 0.4,
  });

  assert.ok(offer, 'Expected an incoming offer to be generated for the listed player');
  assert.equal(offer!.playerId, targetPlayer.id);
  assert.equal(offer!.playerMarketValue, targetPlayer.marketValue);
  assert.equal(offer!.playerSalary, targetPlayer.salary);
  assert.equal(offer!.playerIsStarter, targetPlayer.isStarter);
  assert.ok(
    typeof offer!.playerPotentialOvr === 'number' &&
      offer!.playerPotentialOvr >= offer!.playerOvr,
    `Expected playerPotentialOvr >= playerOvr, got ${offer!.playerPotentialOvr} vs ${offer!.playerOvr}`
  );
  assert.ok(
    typeof offer!.playerContractYearsRemaining === 'number' &&
      offer!.playerContractYearsRemaining >= 1,
    `Expected playerContractYearsRemaining >= 1, got ${offer!.playerContractYearsRemaining}`
  );

  const inboxMsg = createOfferInboxMessage(offer!, userClub);
  const bulletsJoined = (inboxMsg.bulletPoints || []).join(' | ');
  assert.ok(
    bulletsJoined.includes('Valor de mercado'),
    `Expected inbox bullet points to include market value, got: ${bulletsJoined}`
  );
  assert.ok(
    bulletsJoined.includes('Potencial'),
    `Expected inbox bullet points to include potential ceiling, got: ${bulletsJoined}`
  );
});

test('AutoSimModal renders paused incoming offer strictly outside the scrollable match history container', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const modalSource = fs.readFileSync(
    path.resolve('src/components/AutoSimModal.tsx'),
    'utf-8'
  );
  const pausedIdx = modalSource.indexOf('data-testid="autosim-paused-offer"');
  const historyIdx = modalSource.indexOf('data-testid="autosim-match-history-scroll"');
  assert.ok(pausedIdx > 0, 'AutoSimModal must declare autosim-paused-offer container');
  assert.ok(historyIdx > 0, 'AutoSimModal must declare autosim-match-history-scroll container');
  assert.ok(
    pausedIdx < historyIdx,
    'Paused offer container must appear before and outside the match history scroll container'
  );
  const afterHistory = modalSource.slice(historyIdx);
  assert.equal(
    afterHistory.includes('pausedOffer && onResolveOffer'),
    false,
    'Match history scroll container must not contain the paused incoming offer block'
  );
  assert.ok(
    modalSource.includes('data-testid="autosim-open-offer-modal-btn"'),
    'AutoSimModal must render a compact Ver Proposta trigger button for paused offers'
  );
  assert.ok(
    modalSource.includes('data-testid="autosim-offer-detail-modal"'),
    'AutoSimModal must render a dedicated proposal modal when Ver Proposta is clicked'
  );
  assert.ok(
    modalSource.includes('data-testid="autosim-back-to-sim-btn"'),
    'Dedicated proposal modal must provide a button to return to the simulation modal'
  );
  assert.ok(
    modalSource.includes('data-testid="autosim-reject-offer-btn"'),
    'AutoSimModal must provide a direct Negar button to reject incoming offers during simulation'
  );
});

test('NewSeasonEvolutionModal removes filter/sort controls and top KPI cards to show full player list directly', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const modalSource = fs.readFileSync(
    path.resolve('src/components/NewSeasonEvolutionModal.tsx'),
    'utf-8'
  );
  assert.equal(
    modalSource.includes('Ordenar relatório de evolução'),
    false,
    'NewSeasonEvolutionModal must not render sort dropdown'
  );
  assert.equal(
    modalSource.includes('Média OVR do Elenco'),
    false,
    'NewSeasonEvolutionModal must not render top summary KPI cards'
  );
  assert.equal(
    modalSource.includes("setFilter("),
    false,
    'NewSeasonEvolutionModal must not render filter buttons'
  );
  assert.ok(
    modalSource.includes('data-testid="evolution-report-row"'),
    'NewSeasonEvolutionModal must render the full player evolution list'
  );
});

test('Unlimited wage cap allows signings/renewals while monthly payroll costs can put club into debt', async () => {
  const { createNewCareerSave } = await import('../data/careerFactory');
  const { evaluateTransferNegotiation } = await import('./transferEngine');
  const { negotiateContractRenewal } = await import('./contractEngine');
  const { applyAntiInflationSeasonMaintenance } = await import('./economyAndEvolution');
  const { simulateNextAutoStep } = await import('./autoTacticsAndSim');
  const { buildAllMarketListings } = await import('./transferEngine');

  const career = createNewCareerSave(1, 'mirassol', 'Técnico');
  const club = career.clubs.find((c) => c.id === 'mirassol')!;

  // 1. Contract renewal with massive salary above old wageBudget is never blocked by wage cap
  const renewal = negotiateContractRenewal({
    player: career.squad[0],
    club: { ...club, wageBudget: 100_000 },
    userSquad: career.squad,
    currentYear: 2026,
    offeredSalary: 15_000_000,
    addYears: 2,
    rng: () => 0.5,
  });
  assert.equal(
    renewal.outcome,
    'ACEITA',
    'High-salary renewal must not be blocked by wageBudget cap'
  );

  // 2. Free transfer signing above old wageBudget is never blocked by wage cap
  const listings = buildAllMarketListings({
    clubs: career.clubs,
    userClubId: 'mirassol',
    freeAgents: career.freeAgents || [],
    transferredOutClubPlayerIds: [],
    aiSquads: career.aiSquads,
  });
  const freeTarget = listings.find((l) => l.scope === 'LIVRES')!;
  const freeEval = evaluateTransferNegotiation({
    userClub: { ...club, wageBudget: 50_000 },
    userSquad: career.squad,
    listing: freeTarget,
    dealMode: 'FREE',
  });
  assert.equal(freeEval.fitsWageBudget, true);
  assert.equal(freeEval.isBlocked, false);

  // 3. Bloated payroll causes club cashBalance to drop below 0 (debt) across a month boundary in auto-sim
  const bloatedSquad = career.squad.map((p) => ({ ...p, salary: 12_000_000 }));
  const lowCashClubs = career.clubs.map((c) =>
    c.id === 'mirassol' ? { ...c, cashBalance: 5_000_000 } : c
  );
  let snap: import('./autoTacticsAndSim').AutoSimCareerSnapshot = {
    clubs: lowCashClubs,
    userClubId: 'mirassol',
    squad: bloatedSquad,
    loanedOutPlayers: [],
    aiSquads: career.aiSquads,
    standings: career.standings,
    fixtures: career.fixtures,
    secondaryStandings: career.secondaryStandings!,
    secondaryFixtures: career.secondaryFixtures!,
    copaDoBrasil: career.copaDoBrasil!,
    libertadores: career.libertadores!,
    championsLeague: career.championsLeague,
    mundial: career.mundial,
    superMundial: career.superMundial,
    messages: career.messages,
    matchState: career.matchState,
    seasonYear: 2026,
    seasonStepIndex: 0,
    currentRound: 1,
    dayOffset: 0,
    isMatchDay: false,
    transferredOutClubPlayerIds: [],
    pendingOffers: [],
    transferHistory: [],
    financeLedger: career.financeLedger,
    youthAcademy: career.youthAcademy,
  };
  for (let i = 0; i < 6; i++) {
    const step = simulateNextAutoStep(snap, 60, () => 0.5);
    snap = step.snapshot;
  }
  const userAfterMonth = snap.clubs.find((c) => c.id === 'mirassol')!;
  assert.ok(
    userAfterMonth.cashBalance < 0,
    `Expected club with huge payroll to enter debt (< 0), got ${userAfterMonth.cashBalance}`
  );
  assert.ok(
    (snap.financeLedger?.seasonPayrollExpense || 0) > 0,
    'Monthly payroll deductions must be tracked in seasonPayrollExpense'
  );

  // 4. Season maintenance preserves user club debt instead of silently resetting to a positive floor
  const maint = applyAntiInflationSeasonMaintenance(userAfterMonth, bloatedSquad, true);
  assert.ok(
    maint.updatedClub.cashBalance < 0,
    'User club in debt must remain negative after season maintenance'
  );
});

test('Realistic sponsorship corridors (Série A R$ 40M to >R$ 250M; Série B R$ 12M to R$ 30M) and official League, Copa do Brasil, and Libertadores 2026 prizes', async () => {
  const { SERIE_A_CLUBS, SERIE_B_CLUBS } = await import('../data/initialDatabase');
  const { calculateDynamicSponsorship } = await import('./economyAndEvolution');
  const { getLeagueEndPrizeMoney } = await import('./seasonLifecycle');
  const {
    COPA_DO_BRASIL_PRIZE_TABLE,
    LIBERTADORES_2026_PRIZE_USD,
    LIBERTADORES_USD_TO_BRL,
    getCopaDoBrasilStagePrize,
    getCupPrizeMoney,
  } = await import('../data/cupFactory');

  // 1. Série B sponsorships strictly between R$ 12M and R$ 30M
  for (const club of SERIE_B_CLUBS) {
    const sp = calculateDynamicSponsorship(club, 69, 2026);
    assert.ok(
      sp.annualValue >= 12_000_000 && sp.annualValue <= 30_000_000,
      `Série B ${club.shortName} sponsorship (${sp.annualValue}) must be within R$ 12M..30M`
    );
  }

  // 2. Série A sponsorships scale from ~R$ 40M (smaller fanbase) to >R$ 250M (major giants)
  const mirassol = SERIE_A_CLUBS.find((c) => c.id === 'mirassol')!;
  const flamengo = SERIE_A_CLUBS.find((c) => c.id === 'flamengo')!;
  const corinthians = SERIE_A_CLUBS.find((c) => c.id === 'corinthians')!;
  const mirassolSp = calculateDynamicSponsorship(mirassol, 71, 2026);
  const flamengoSp = calculateDynamicSponsorship(flamengo, 79, 2026);
  const corinthiansSp = calculateDynamicSponsorship(corinthians, 77, 2026);
  assert.ok(
    mirassolSp.annualValue >= 40_000_000 && mirassolSp.annualValue <= 55_000_000,
    `Expected Mirassol sponsorship around R$ 40M-55M, got ${mirassolSp.annualValue}`
  );
  assert.ok(
    flamengoSp.annualValue > 250_000_000,
    `Expected Flamengo sponsorship > R$ 250M, got ${flamengoSp.annualValue}`
  );
  assert.ok(
    corinthiansSp.annualValue >= 240_000_000,
    `Expected Corinthians sponsorship near/above R$ 250M, got ${corinthiansSp.annualValue}`
  );

  // 3. Série A official placement prizes (1º..16º decreasing; 17º..20º = R$ 0)
  assert.equal(getLeagueEndPrizeMoney('A', 1), 48_100_000);
  assert.equal(getLeagueEndPrizeMoney('A', 2), 45_700_000);
  assert.equal(getLeagueEndPrizeMoney('A', 3), 43_400_000);
  assert.equal(getLeagueEndPrizeMoney('A', 4), 40_900_000);
  assert.equal(getLeagueEndPrizeMoney('A', 16), 16_300_000);
  for (let r = 1; r < 16; r++) {
    assert.ok(
      getLeagueEndPrizeMoney('A', r) > getLeagueEndPrizeMoney('A', r + 1),
      `Série A rank ${r} prize must exceed rank ${r + 1}`
    );
  }
  for (let r = 17; r <= 20; r++) {
    assert.equal(getLeagueEndPrizeMoney('A', r), 0, `Relegated rank ${r} must get R$ 0`);
  }

  // 4. Série B official placement prizes
  assert.equal(getLeagueEndPrizeMoney('B', 1), 3_500_000);
  assert.equal(getLeagueEndPrizeMoney('B', 2), 1_350_000);
  assert.equal(getLeagueEndPrizeMoney('B', 3), 1_350_000);
  assert.equal(getLeagueEndPrizeMoney('B', 4), 1_350_000);
  assert.equal(getLeagueEndPrizeMoney('B', 5), 1_000_000);
  assert.equal(getLeagueEndPrizeMoney('B', 20), 1_000_000);

  // 5. Copa do Brasil exact official BRL prizes
  assert.equal(getCopaDoBrasilStagePrize('1ª Fase', 'GRUPO_III'), 400_000);
  assert.equal(getCopaDoBrasilStagePrize('2ª Fase', 'GRUPO_II'), 1_380_000);
  assert.equal(getCopaDoBrasilStagePrize('2ª Fase', 'GRUPO_III'), 830_000);
  assert.equal(getCopaDoBrasilStagePrize('3ª Fase', 'GRUPO_II'), 1_530_000);
  assert.equal(getCopaDoBrasilStagePrize('3ª Fase', 'GRUPO_III'), 950_000);
  assert.equal(getCopaDoBrasilStagePrize('4ª Fase', 'GRUPO_II'), 1_680_000);
  assert.equal(getCopaDoBrasilStagePrize('4ª Fase', 'GRUPO_III'), 1_070_000);
  assert.equal(getCopaDoBrasilStagePrize('5ª Fase', 'GRUPO_I'), 2_000_000);
  assert.equal(getCupPrizeMoney('COPA_DO_BRASIL', '3ª Fase', true, false, { clubDivision: 'A' }), 2_000_000);
  assert.equal(
    getCupPrizeMoney('COPA_DO_BRASIL', '3ª Fase', true, false, { clubDivision: 'B' }),
    COPA_DO_BRASIL_PRIZE_TABLE.fase2.GRUPO_II +
      COPA_DO_BRASIL_PRIZE_TABLE.fase3.GRUPO_II +
      COPA_DO_BRASIL_PRIZE_TABLE.fase4.GRUPO_II +
      COPA_DO_BRASIL_PRIZE_TABLE.fase5
  );
  assert.equal(getCupPrizeMoney('COPA_DO_BRASIL', 'Oitavas', true, false), 3_000_000);
  assert.equal(getCupPrizeMoney('COPA_DO_BRASIL', 'Quartas', true, false), 4_000_000);
  assert.equal(getCupPrizeMoney('COPA_DO_BRASIL', 'Semifinal', true, false), 9_000_000);
  assert.equal(getCupPrizeMoney('COPA_DO_BRASIL', 'Final', false, false), 34_000_000);
  assert.equal(getCupPrizeMoney('COPA_DO_BRASIL', 'Final', true, true), 78_000_000);

  // 6. Copa Libertadores 2026 official USD prizes converted to BRL
  const usd = (amount: number) => Math.round(amount * LIBERTADORES_USD_TO_BRL);
  assert.equal(
    getCupPrizeMoney('LIBERTADORES', 'Grupo', false, false, { isUserHome: true }),
    usd(LIBERTADORES_2026_PRIZE_USD.groupHomeMatch)
  );
  assert.equal(
    getCupPrizeMoney('LIBERTADORES', 'Grupo', true, false, { isUserHome: true }),
    usd(LIBERTADORES_2026_PRIZE_USD.groupHomeMatch + LIBERTADORES_2026_PRIZE_USD.groupWinBonus)
  );
  assert.equal(
    getCupPrizeMoney('LIBERTADORES', 'Grupo', true, false, { isUserHome: false }),
    usd(LIBERTADORES_2026_PRIZE_USD.groupWinBonus)
  );
  assert.equal(
    getCupPrizeMoney('LIBERTADORES', 'Grupo', false, false, { isUserHome: false }),
    0
  );
  assert.equal(getCupPrizeMoney('LIBERTADORES', 'Oitavas', true, false), usd(1_250_000));
  assert.equal(getCupPrizeMoney('LIBERTADORES', 'Quartas', true, false), usd(1_700_000));
  assert.equal(getCupPrizeMoney('LIBERTADORES', 'Semifinal', true, false), usd(2_300_000));
  assert.equal(getCupPrizeMoney('LIBERTADORES', 'Final', true, true), usd(25_000_000));
});

test('DashboardInbox removes Caixa de Entrada panel while keeping match overview and evolution report shortcut', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const dashboardSource = fs.readFileSync(
    path.resolve('src/components/DashboardInbox.tsx'),
    'utf-8'
  );
  assert.equal(
    dashboardSource.includes('Caixa de Entrada da Comissão Técnica'),
    false,
    'DashboardInbox must not render the removed Caixa de Entrada panel'
  );
  assert.ok(
    dashboardSource.includes('Abrir Relatório Completo'),
    'DashboardInbox must still expose the evolution report shortcut'
  );
});

test('MarketView wires celebratory deal acceptance transition with reduced-motion CSS safeguards', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const css = fs.readFileSync(path.resolve('src/index.css'), 'utf-8');
  const modalSource = fs.readFileSync(
    path.resolve('src/components/MarketDealTransitionModal.tsx'),
    'utf-8'
  );
  const marketViewSource = fs.readFileSync(
    path.resolve('src/components/MarketView.tsx'),
    'utf-8'
  );

  assert.ok(css.includes('@keyframes market-deal-card-in'));
  assert.ok(css.includes('@keyframes market-sheen-sweep'));
  assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'));
  assert.ok(modalSource.includes('data-testid="deal-accepted-transition"'));
  assert.ok(modalSource.includes('CONTRATAÇÃO OFICIALIZADA'));
  assert.ok(modalSource.includes('VENDA OFICIALIZADA'));
  assert.ok(marketViewSource.includes('MarketDealTransitionModal'));
  assert.ok(marketViewSource.includes("lastAttemptResult.outcome !== 'ACEITA'"));
  assert.ok(
    marketViewSource.includes(
      "prevMap.get(o.id) === 'PENDING' && o.status === 'ACCEPTED'"
    )
  );
});

test('AI incoming offers, loans, listings, outgoing valuations and counteroffers stay strictly within realistic market-value corridors', async () => {
  const {
    maybeGenerateIncomingOfferForUser,
    computeIncomingCounterFee,
    resolveIncomingOfferAction,
    simulateAiTransferWindowTick,
  } = await import('./aiMarketEngine');
  const {
    buildAllMarketListings,
    evaluateOutgoingPlayer,
    REALISTIC_BUY_OFFER_MIN_RATIO,
    REALISTIC_BUY_OFFER_MAX_RATIO,
    REALISTIC_BUY_COUNTER_MAX_RATIO,
    REALISTIC_LOAN_COUNTER_MAX_RATIO,
  } = await import('./transferEngine');

  // 1. Incoming offers across Série B (including low-value R$ 200k player) and Série A stay close to marketValue
  const ponteCareer = createNewCareerSave(1, 'ponte-preta', 'Técnico');
  const ponteClub = ponteCareer.clubs.find((c) => c.id === 'ponte-preta')!;
  const lowValueProspect: Player = {
    ...ponteCareer.squad[0],
    id: 'low-val-youth-200k',
    name: 'Promessa Base 200k',
    age: 18,
    position: 'ATA',
    sector: 'ATA',
    marketValue: 200_000,
    salary: 25_000,
    isStarter: false,
    isTransferListed: true,
    isLoanListed: false,
  };
  const lowValueLoanProspect: Player = {
    ...lowValueProspect,
    id: 'low-val-loan-250k',
    name: 'Empréstimo Base 250k',
    marketValue: 250_000,
    isTransferListed: false,
    isLoanListed: true,
  };
  const augmentedPonteSquad = [
    ...ponteCareer.squad,
    lowValueProspect,
    lowValueLoanProspect,
  ];

  for (const r of [0.05, 0.5, 0.95]) {
    const buyOffer = maybeGenerateIncomingOfferForUser({
      clubs: ponteCareer.clubs,
      userClub: ponteClub,
      userSquad: augmentedPonteSquad,
      pendingOffers: [],
      dayOffset: 10,
      seasonYear: 2026,
      aiSquads: ponteCareer.aiSquads,
      specificPlayerId: lowValueProspect.id,
      rng: () => r,
    });
    assert.ok(buyOffer, 'Expected realistic BUY offer for R$ 200k listed player');
    assert.equal(buyOffer!.dealType, 'BUY');
    const buyRatio = buyOffer!.offeredFee / lowValueProspect.marketValue;
    assert.ok(
      buyRatio >= REALISTIC_BUY_OFFER_MIN_RATIO &&
        buyRatio <= REALISTIC_BUY_OFFER_MAX_RATIO,
      `Low-value BUY offer (${buyOffer!.offeredFee}) must stay within ${REALISTIC_BUY_OFFER_MIN_RATIO}..${REALISTIC_BUY_OFFER_MAX_RATIO} of MV (${lowValueProspect.marketValue}), got ${buyRatio.toFixed(2)}`
    );

    const loanOffer = maybeGenerateIncomingOfferForUser({
      clubs: ponteCareer.clubs,
      userClub: ponteClub,
      userSquad: augmentedPonteSquad,
      pendingOffers: [],
      dayOffset: 10,
      seasonYear: 2026,
      aiSquads: ponteCareer.aiSquads,
      specificPlayerId: lowValueLoanProspect.id,
      rng: () => r,
    });
    assert.ok(loanOffer, 'Expected realistic LOAN offer for R$ 250k loan-listed player');
    assert.equal(loanOffer!.dealType, 'LOAN');
    const loanRatio = loanOffer!.offeredFee / lowValueLoanProspect.marketValue;
    assert.ok(
      loanRatio >= 0.08 && loanRatio <= 0.16,
      `Low-value LOAN offer (${loanOffer!.offeredFee}) must stay within 8%..16% of MV (${lowValueLoanProspect.marketValue}), got ${(loanRatio * 100).toFixed(1)}%`
    );
  }

  // 2. Poor clubs cannot submit unrealistic lowball purchase offers for expensive stars
  const flamengoCareer = createNewCareerSave(1, 'flamengo', 'Técnico');
  const flamengoClub = flamengoCareer.clubs.find((c) => c.id === 'flamengo')!;
  const expensiveStar = [...flamengoCareer.squad]
    .filter((p) => p.position !== 'GOL')
    .sort((a, b) => b.marketValue - a.marketValue)[0];
  const brokeClubs = flamengoCareer.clubs.map((c) =>
    c.id === 'flamengo' ? c : { ...c, cashBalance: 5_000_000 }
  );
  const listedStarSquad = flamengoCareer.squad.map((p) =>
    p.id === expensiveStar.id
      ? { ...p, isTransferListed: true, isLoanListed: false }
      : p
  );
  const blockedOffer = maybeGenerateIncomingOfferForUser({
    clubs: brokeClubs,
    userClub: flamengoClub,
    userSquad: listedStarSquad,
    pendingOffers: [],
    dayOffset: 10,
    seasonYear: 2026,
    aiSquads: flamengoCareer.aiSquads,
    specificPlayerId: expensiveStar.id,
    rng: () => 0.5,
  });
  assert.equal(
    blockedOffer,
    null,
    'Clubs unable to afford >=85% of star market value must not send unrealistic lowball BUY offers'
  );

  // 3. UCL superclubs must not bid for low-OVR Série B rotation players
  for (const p of ponteCareer.squad) {
    const ovr = calculatePlayerOverall(p.attributes, p.position);
    if (ovr >= 74 || (p.age <= 22 && (p.potentialStars ?? 0) >= 4)) continue;
    for (const r of [0.1, 0.5, 0.92]) {
      const offer = maybeGenerateIncomingOfferForUser({
        clubs: ponteCareer.clubs,
        userClub: ponteClub,
        userSquad: ponteCareer.squad,
        pendingOffers: [],
        dayOffset: 10,
        seasonYear: 2026,
        aiSquads: ponteCareer.aiSquads,
        specificPlayerId: p.id,
        rng: () => r,
      });
      if (!offer) continue;
      const buyer = ponteCareer.clubs.find((c) => c.id === offer.fromClubId)!;
      assert.notEqual(
        buyer.division,
        'UCL',
        `UCL giant ${buyer.shortName} should not bid for Série B player ${p.name} (OVR ${ovr})`
      );
      const ratio = offer.offeredFee / p.marketValue;
      if (offer.dealType === 'BUY') {
        assert.ok(
          ratio >= 0.85 && ratio <= 1.20,
          `BUY offer ratio for ${p.name} out of bounds: ${ratio.toFixed(2)}`
        );
      } else {
        assert.ok(
          ratio >= 0.08 && ratio <= 0.16,
          `LOAN offer ratio for ${p.name} out of bounds: ${ratio.toFixed(2)}`
        );
      }
    }
  }

  // 4. Incoming counteroffer cap & AI rejection above realistic ceiling
  const highOffer = maybeGenerateIncomingOfferForUser({
    clubs: flamengoCareer.clubs,
    userClub: flamengoClub,
    userSquad: flamengoCareer.squad,
    pendingOffers: [],
    dayOffset: 10,
    seasonYear: 2026,
    aiSquads: flamengoCareer.aiSquads,
    specificPlayerId: expensiveStar.id,
    rng: () => 0.95,
  });
  if (highOffer) {
    const c15 = computeIncomingCounterFee(
      highOffer,
      'COUNTER_15',
      expensiveStar.marketValue
    );
    const c30 = computeIncomingCounterFee(
      highOffer,
      'COUNTER_30',
      expensiveStar.marketValue
    );
    if (highOffer.dealType === 'BUY') {
      assert.ok(
        c15 <= expensiveStar.marketValue * 1.26,
        `COUNTER_15 (${c15}) exceeded realistic ceiling for MV ${expensiveStar.marketValue}`
      );
      assert.ok(
        c30 <= expensiveStar.marketValue * 1.33,
        `COUNTER_30 (${c30}) exceeded realistic ceiling for MV ${expensiveStar.marketValue}`
      );
    } else {
      assert.ok(
        c30 <= expensiveStar.marketValue * (REALISTIC_LOAN_COUNTER_MAX_RATIO + 0.01),
        `Loan COUNTER_30 (${c30}) exceeded realistic ceiling for MV ${expensiveStar.marketValue}`
      );
    }

    // Artificially inflated offer forced past ceiling must always be rejected on counter
    const absurdOffer = {
      ...highOffer,
      dealType: 'BUY' as const,
      offeredFee: Math.round(expensiveStar.marketValue * 1.4),
    };
    const rejectedCounter = resolveIncomingOfferAction({
      offer: absurdOffer,
      action: 'COUNTER_30',
      userClub: flamengoClub,
      userSquad: flamengoCareer.squad,
      aiSquads: flamengoCareer.aiSquads || {},
      loanedOutPlayers: [],
      clubs: flamengoCareer.clubs,
      dayOffset: 11,
      seasonYear: 2026,
      rng: () => 0.01,
    });
    assert.equal(
      rejectedCounter.outcome,
      'COUNTER_REJECTED',
      'AI club must always reject counteroffers above the realistic market ceiling'
    );
  }

  // 5. All market listings, outgoing evaluations, and AI counteroffers on user buys stay within realistic bounds
  const listings = buildAllMarketListings({
    clubs: flamengoCareer.clubs,
    userClubId: 'flamengo',
    freeAgents: flamengoCareer.freeAgents || [],
    transferredOutClubPlayerIds: [],
    aiSquads: flamengoCareer.aiSquads,
  });
  for (const l of listings) {
    if (l.scope === 'LIVRES') continue;
    const buyR = l.buyFee / l.player.marketValue;
    const loanR = l.loanFee / l.player.marketValue;
    assert.ok(
      buyR >= 0.84 && buyR <= 1.19,
      `Listing buyFee out of corridor for ${l.player.name}: ${buyR.toFixed(2)}`
    );
    assert.ok(
      loanR >= 0.055 && loanR <= 0.21,
      `Listing loanFee out of corridor for ${l.player.name}: ${loanR.toFixed(2)}`
    );
  }

  for (const p of augmentedPonteSquad) {
    const out = evaluateOutgoingPlayer(p, augmentedPonteSquad);
    const saleR = out.saleValue / p.marketValue;
    const loanR = out.loanOutFee / p.marketValue;
    assert.ok(
      saleR >= 0.87 && saleR <= 1.13,
      `Outgoing saleValue out of corridor for ${p.name}: ${saleR.toFixed(2)}`
    );
    assert.ok(
      loanR >= 0.065 && loanR <= 0.16,
      `Outgoing loanOutFee out of corridor for ${p.name}: ${loanR.toFixed(2)}`
    );
  }

  // 6. Club counteroffers when user bids aggressively (1.0x or 1.5x) on UCL stars never inflate to 2x MV
  const richFlamengo = {
    ...flamengoClub,
    cashBalance: 2_500_000_000,
    wageBudget: 500_000_000,
  };
  const intlListings = listings.filter((l) => l.scope === 'INTERNACIONAL').slice(0, 30);
  for (const l of intlListings) {
    for (const mult of [0.5, 1.0, 1.5]) {
      const ev = evaluateTransferNegotiation({
        userClub: richFlamengo,
        userSquad: flamengoCareer.squad,
        listing: l,
        dealMode: 'BUY',
        offerMultiplier: mult,
      });
      const res = executeIncomingTransfer({
        userClub: richFlamengo,
        userSquad: flamengoCareer.squad,
        freeAgents: [],
        transferredOutClubPlayerIds: [],
        listing: l,
        dealMode: 'BUY',
        evaluation: ev,
        rng: () => Math.min(0.92, (ev.acceptanceChance + 10) / 100),
      });
      if (res.outcome === 'CONTRAPROPOSTA' && res.counterOffer) {
        const counterRatio = res.counterOffer.counterFee / l.player.marketValue;
        assert.ok(
          counterRatio >= 0.85,
          `Counteroffer on ${l.player.name} (mult ${mult}) must not undercut market value: ratio=${counterRatio.toFixed(2)}`
        );
        if (res.counterOffer.source === 'CLUBE' || res.counterOffer.source === 'AMBOS') {
          assert.ok(
            counterRatio <= REALISTIC_BUY_COUNTER_MAX_RATIO + 0.01,
            `Club counteroffer on ${l.player.name} (mult ${mult}) exceeded realistic cap: ratio=${counterRatio.toFixed(2)}`
          );
        }
      }
    }
  }

  // 7. Autonomous AI-to-AI transfers stay within realistic corridor
  const aiTick = simulateAiTransferWindowTick({
    clubs: flamengoCareer.clubs,
    aiSquads: flamengoCareer.aiSquads || {},
    userClubId: 'flamengo',
    dayOffset: 10,
    seasonYear: 2026,
    maxDeals: 4,
    rng: () => 0.35,
  });
  for (const rec of aiTick.newRecords) {
    assert.ok(rec.feeAmount > 0, `AI transfer ${rec.playerName} must have positive fee`);
  }
});

test('30% operational cost applies to all sponsorship and ticket revenues for user and AI clubs', async () => {
  const { createNewCareerSave } = await import('../data/careerFactory');
  const {
    OPERATIONAL_COST_RATE,
    calculateOperationalCost,
    applyAiHomeGateRevenues,
    applyAiMonthlyEconomyTick,
    applyAntiInflationSeasonMaintenance,
  } = await import('./economyAndEvolution');
  const { simulateNextAutoStep } = await import('./autoTacticsAndSim');

  assert.equal(OPERATIONAL_COST_RATE, 0.3);
  assert.equal(calculateOperationalCost(10_000_000), 3_000_000);
  assert.equal(calculateOperationalCost(0), 0);

  // 1. Initial ledger charges 30% operational cost on opening sponsorship
  const career = createNewCareerSave(1, 'flamengo', 'Teste Operacional');
  const initLedger = career.financeLedger!;
  assert.equal(
    initLedger.seasonOperationalExpense,
    calculateOperationalCost(initLedger.seasonSponsorshipRevenue),
    'Initial operational cost must equal 30% of opening sponsorship revenue'
  );

  // 2. Across AutoSim steps (home tickets + monthly sponsorship), user seasonOperationalExpense == 30% of (gate + sponsor)
  let snap: import('./autoTacticsAndSim').AutoSimCareerSnapshot = {
    clubs: career.clubs,
    userClubId: 'flamengo',
    squad: career.squad,
    loanedOutPlayers: [],
    aiSquads: career.aiSquads,
    standings: career.standings,
    fixtures: career.fixtures,
    secondaryStandings: career.secondaryStandings!,
    secondaryFixtures: career.secondaryFixtures!,
    copaDoBrasil: career.copaDoBrasil!,
    libertadores: career.libertadores!,
    championsLeague: career.championsLeague,
    mundial: career.mundial,
    superMundial: career.superMundial,
    messages: career.messages,
    matchState: career.matchState,
    seasonYear: 2026,
    seasonStepIndex: 0,
    currentRound: 1,
    dayOffset: 0,
    isMatchDay: false,
    transferredOutClubPlayerIds: [],
    pendingOffers: [],
    transferHistory: [],
    financeLedger: career.financeLedger,
    youthAcademy: career.youthAcademy,
  };
  for (let i = 0; i < 8; i++) {
    snap = simulateNextAutoStep(snap, 90, () => 0.45).snapshot;
  }
  const afterLedger = snap.financeLedger!;
  assert.ok(afterLedger.seasonGateRevenue > 0, 'User must earn home gate revenue across 8 steps');
  assert.ok(
    afterLedger.seasonSponsorshipRevenue > initLedger.seasonSponsorshipRevenue,
    'User must earn monthly sponsorship across 8 steps'
  );
  const expectedUserOpCost = calculateOperationalCost(
    afterLedger.seasonGateRevenue + afterLedger.seasonSponsorshipRevenue
  );
  assert.ok(
    Math.abs(afterLedger.seasonOperationalExpense - expectedUserOpCost) <= 10,
    `User seasonOperationalExpense (${afterLedger.seasonOperationalExpense}) must match 30% of gate+sponsor (${expectedUserOpCost})`
  );

  // 3. AI clubs pay 30% operational cost on home gate revenues
  const palmeirasBefore = career.clubs.find((c) => c.id === 'palmeiras')!;
  const aiGateRes = applyAiHomeGateRevenues({
    clubs: career.clubs,
    userClubId: 'flamengo',
    homeMatches: [
      { clubId: 'palmeiras', rank: 2, totalTeams: 20, competition: 'BRASILEIRAO' },
    ],
  });
  const palmeirasAfter = aiGateRes.updatedClubs.find((c) => c.id === 'palmeiras')!;
  assert.ok(aiGateRes.totalGrossGate > 0);
  assert.equal(
    aiGateRes.totalOperationalCost,
    calculateOperationalCost(aiGateRes.totalGrossGate)
  );
  assert.equal(
    palmeirasAfter.cashBalance - palmeirasBefore.cashBalance,
    aiGateRes.totalGrossGate - aiGateRes.totalOperationalCost,
    'AI home club must receive exactly 70% net gate revenue (30% operational cost deducted)'
  );

  // 4. AI clubs pay 30% operational cost on monthly sponsorship payouts
  const aiMonthlyRes = applyAiMonthlyEconomyTick({
    clubs: career.clubs,
    aiSquads: career.aiSquads || {},
    userClubId: 'flamengo',
    monthsElapsed: 1,
    seasonYear: 2026,
  });
  assert.ok(aiMonthlyRes.totalGrossSponsor > 0);
  assert.ok(
    Math.abs(
      aiMonthlyRes.totalOperationalCost -
        calculateOperationalCost(aiMonthlyRes.totalGrossSponsor)
    ) <= 50,
    'AI monthly operational cost must be 30% of AI monthly sponsorship revenue'
  );

  // 5. UCL/WORLD clubs also pay 30% operational cost on their commercial refill
  const uclClub = career.clubs.find((c) => c.division === 'UCL')!;
  const uclStart = { ...uclClub, cashBalance: 500_000_000 };
  const uclMaint = applyAntiInflationSeasonMaintenance(uclStart, [], false);
  const expectedGrossRefill = Math.round((uclClub.reputation * 3_100_000) / 500_000) * 500_000;
  const expectedUclOpCost = calculateOperationalCost(expectedGrossRefill);
  assert.equal(uclMaint.annualMaintenanceCost, expectedUclOpCost);
  assert.equal(
    uclMaint.updatedClub.cashBalance,
    Math.round((500_000_000 + expectedGrossRefill - expectedUclOpCost) / 100_000) * 100_000
  );
});

test('AI proposals strictly require cash-in-hand and financial health (annual income, cash reserve, 6-month solvency, payroll)', async () => {
  const {
    evaluateClubTransferFinancialHealth,
    maybeGenerateIncomingOfferForUser,
    resolveIncomingOfferAction,
    simulateAiTransferWindowTick,
  } = await import('./aiMarketEngine');

  const career = createNewCareerSave(1, 'flamengo', 'Técnico');
  const flamengoClub = career.clubs.find((c) => c.id === 'flamengo')!;
  const palmeirasClub = career.clubs.find((c) => c.id === 'palmeiras')!;
  const ponteClub = career.clubs.find((c) => c.id === 'ponte-preta')!;
  const realMadridClub = career.clubs.find((c) => c.id === 'real-madrid')!;

  // 1. Club in debt (cashBalance <= 0) is strictly blocked from making any proposal
  const inDebtHealth = evaluateClubTransferFinancialHealth({
    club: { ...palmeirasClub, cashBalance: -15_000_000 },
    clubSquad: career.aiSquads?.['palmeiras'],
    proposedFee: 1_000_000,
    addedMonthlySalary: 100_000,
    dealType: 'BUY',
    seasonYear: 2026,
  });
  assert.equal(inDebtHealth.canAffordAndHealthy, false);
  assert.equal(inDebtHealth.hasCashInHand, false);
  assert.equal(inDebtHealth.maxHealthySingleDealFee, 0);

  // 2. Elite club CANNOT submit a financed mega-deal above its actual cashBalance (old loophole closed)
  const eliteInsufficientCash = evaluateClubTransferFinancialHealth({
    club: { ...realMadridClub, cashBalance: 90_000_000, reputation: 95 },
    clubSquad: career.aiSquads?.['real-madrid'],
    proposedFee: 120_000_000,
    addedMonthlySalary: 2_000_000,
    dealType: 'BUY',
    seasonYear: 2026,
  });
  assert.equal(eliteInsufficientCash.hasCashInHand, false);
  assert.equal(eliteInsufficientCash.canAffordAndHealthy, false);

  // Also verify via maybeGenerateIncomingOfferForUser on a R$ 150M star when all elite clubs only have R$ 100M cash (67% of MV)
  const megaStar: Player = {
    ...career.squad[0],
    id: 'mega-star-150m',
    name: 'Craque 150M',
    position: 'ATA',
    sector: 'ATA',
    age: 22,
    marketValue: 150_000_000,
    salary: 1_500_000,
    isTransferListed: true,
    isLoanListed: false,
  };
  const clubsUnderfundedForMegaStar = career.clubs.map((c) =>
    c.id === 'flamengo' ? c : { ...c, cashBalance: 100_000_000 }
  );
  const blockedMegaOffer = maybeGenerateIncomingOfferForUser({
    clubs: clubsUnderfundedForMegaStar,
    userClub: flamengoClub,
    userSquad: [megaStar, ...career.squad],
    pendingOffers: [],
    dayOffset: 10,
    seasonYear: 2026,
    aiSquads: career.aiSquads,
    specificPlayerId: megaStar.id,
    rng: () => 0.4,
  });
  assert.equal(
    blockedMegaOffer,
    null,
    'No club (even 95-rep elite) may propose a BUY fee it does not hold in cash or that drains its reserve'
  );

  // 3. Club cannot drain its operating cash reserve (e.g., cash R$ 10M with payroll R$ 4M/m cannot bid R$ 8M)
  const thinReserveSquad = (career.aiSquads?.['ponte-preta'] || []).map((p, idx) => ({
    ...p,
    salary: idx < 10 ? 400_000 : 0, // R$ 4M/month total
    wageSharePaid: 1,
  }));
  const thinReserveHealth = evaluateClubTransferFinancialHealth({
    club: { ...ponteClub, cashBalance: 10_000_000, wageBudget: 8_000_000 },
    clubSquad: thinReserveSquad,
    proposedFee: 8_000_000,
    addedMonthlySalary: 150_000,
    dealType: 'BUY',
    seasonYear: 2026,
  });
  assert.equal(thinReserveHealth.hasCashInHand, true);
  assert.equal(thinReserveHealth.withinHealthyFeeCap, false);
  assert.equal(thinReserveHealth.canAffordAndHealthy, false);

  // 4. Club running a heavy monthly operating deficit cannot burn cash needed for 6-month solvency
  const deficitSquad = (career.aiSquads?.['ponte-preta'] || []).map((p, idx) => ({
    ...p,
    salary: idx < 10 ? 1_200_000 : 0, // R$ 12M/month payroll vs ~R$ 2.2M/month Série B net income (~R$ 9.8M deficit/month!)
    wageSharePaid: 1,
  }));
  const deficitHealth = evaluateClubTransferFinancialHealth({
    club: { ...ponteClub, cashBalance: 45_000_000, wageBudget: 20_000_000 },
    clubSquad: deficitSquad,
    proposedFee: 5_000_000,
    addedMonthlySalary: 200_000,
    dealType: 'BUY',
    seasonYear: 2026,
  });
  assert.equal(deficitHealth.canAffordAndHealthy, false);
  assert.equal(
    deficitHealth.maxHealthySingleDealFee,
    0,
    'Club burning ~R$ 9.8M/month with R$ 45M cash must have R$ 0 healthy transfer spend cap'
  );

  // 5. Small club with sudden cash windfall is still capped by its annual earning power (income coherence)
  const windfallPonte = { ...ponteClub, cashBalance: 300_000_000, wageBudget: 4_000_000 };
  const windfallHealth = evaluateClubTransferFinancialHealth({
    club: windfallPonte,
    clubSquad: career.aiSquads?.['ponte-preta'],
    proposedFee: 80_000_000,
    addedMonthlySalary: 100_000,
    dealType: 'BUY',
    seasonYear: 2026,
  });
  assert.equal(windfallHealth.hasCashInHand, true);
  assert.equal(windfallHealth.withinHealthyFeeCap, false);
  assert.ok(
    windfallHealth.maxHealthySingleDealFee <= windfallHealth.estimatedAnnualNetIncome * 0.85,
    'Single deal fee must stay coherent with annual net club revenue'
  );

  // 6. Club cannot absorb a player whose salary breaks its payroll health
  const unsustainableSalaryHealth = evaluateClubTransferFinancialHealth({
    club: { ...ponteClub, cashBalance: 33_000_000, wageBudget: 3_700_000 },
    clubSquad: career.aiSquads?.['ponte-preta'],
    proposedFee: 2_000_000,
    addedMonthlySalary: 2_500_000,
    dealType: 'BUY',
    seasonYear: 2026,
  });
  assert.equal(unsustainableSalaryHealth.payrollHealthy, false);
  assert.equal(unsustainableSalaryHealth.canAffordAndHealthy, false);

  // 7. Every generated incoming offer across 40 deterministic rolls strictly satisfies cash-in-hand & financial health
  let offersVerified = 0;
  for (let i = 0; i < 40; i++) {
    const r = ((i * 37 + 11) % 97) / 100;
    const offer = maybeGenerateIncomingOfferForUser({
      clubs: career.clubs,
      userClub: flamengoClub,
      userSquad: career.squad,
      pendingOffers: [],
      dayOffset: 10,
      seasonYear: 2026,
      aiSquads: career.aiSquads,
      rng: () => r,
    });
    if (!offer) continue;
    offersVerified++;
    const buyer = career.clubs.find((c) => c.id === offer.fromClubId)!;
    const player = career.squad.find((p) => p.id === offer.playerId)!;
    const addedSalary =
      offer.dealType === 'LOAN'
        ? Math.round(player.salary * offer.wageShareCovered)
        : player.salary;
    assert.ok(
      offer.offeredFee <= buyer.cashBalance,
      `Offer from ${buyer.shortName} (${offer.offeredFee}) must never exceed cashBalance (${buyer.cashBalance})`
    );
    const health = evaluateClubTransferFinancialHealth({
      club: buyer,
      clubSquad: career.aiSquads?.[buyer.id],
      proposedFee: offer.offeredFee,
      addedMonthlySalary: addedSalary,
      dealType: offer.dealType,
      seasonYear: 2026,
    });
    assert.equal(
      health.canAffordAndHealthy,
      true,
      `Offer from ${buyer.shortName} (${offer.offeredFee}) failed financial health check: ${health.reason}`
    );
  }
  assert.ok(offersVerified >= 10, `Expected at least 10 valid healthy offers, got ${offersVerified}`);

  // 8. Counteroffer is rejected when +30% would breach buyer's healthy reserve, even with rng() => 0.01
  const targetPlayer = career.squad.find((p) => p.position !== 'GOL' && p.marketValue >= 20_000_000)!;
  const buyerTightCash = { ...palmeirasClub, cashBalance: Math.round(targetPlayer.marketValue * 1.05) };
  const tightClubs = career.clubs.map((c) => (c.id === palmeirasClub.id ? buyerTightCash : c));
  const tightOffer = {
    id: 'test-tight-offer',
    createdAtDate: '12/01/2026',
    fromClubId: palmeirasClub.id,
    fromClubName: palmeirasClub.shortName,
    fromClubAbbr: palmeirasClub.abbr,
    fromClubPrimaryColor: palmeirasClub.primaryColor,
    fromClubReputation: palmeirasClub.reputation,
    playerId: targetPlayer.id,
    playerName: targetPlayer.name,
    playerPosition: targetPlayer.position,
    playerOvr: calculatePlayerOverall(targetPlayer.attributes, targetPlayer.position),
    playerAge: targetPlayer.age,
    playerPotentialStars: targetPlayer.potentialStars ?? 3.5,
    playerMarketValue: targetPlayer.marketValue,
    playerSalary: targetPlayer.salary,
    dealType: 'BUY' as const,
    offeredFee: Math.round(targetPlayer.marketValue * 0.95),
    wageShareCovered: 1.0,
    expiresDayOffset: 30,
    negotiationStep: 0 as const,
    status: 'PENDING' as const,
    rationale: 'Teste de saúde financeira em contraproposta',
  };
  const rejectedTightCounter = resolveIncomingOfferAction({
    offer: tightOffer,
    action: 'COUNTER_30',
    userClub: flamengoClub,
    userSquad: career.squad,
    aiSquads: career.aiSquads || {},
    loanedOutPlayers: [],
    clubs: tightClubs,
    dayOffset: 12,
    seasonYear: 2026,
    rng: () => 0.01,
  });
  assert.equal(
    rejectedTightCounter.outcome,
    'COUNTER_REJECTED',
    'Buyer must reject counteroffer that exceeds cash or healthy financial limits'
  );

  // 9. Autonomous AI-to-AI transfers never leave any buying club with negative cash or unhealthy reserve
  let workingClubs = career.clubs;
  let workingAiSquads = career.aiSquads || {};
  let seed = 777;
  const detRng = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let tick = 0; tick < 8; tick++) {
    const res = simulateAiTransferWindowTick({
      clubs: workingClubs,
      aiSquads: workingAiSquads,
      userClubId: 'flamengo',
      dayOffset: 5 + tick * 2,
      seasonYear: 2026,
      maxDeals: 3,
      rng: detRng,
    });
    for (const rec of res.newRecords) {
      const buyerBefore = workingClubs.find((c) => c.shortName === rec.toClubName);
      const buyerAfter = res.updatedClubs.find((c) => c.shortName === rec.toClubName);
      if (buyerBefore && buyerAfter) {
        assert.ok(
          buyerAfter.cashBalance > 0,
          `AI buyer ${buyerAfter.shortName} must stay cash-positive after ${rec.playerName} (${buyerAfter.cashBalance})`
        );
      }
    }
    workingClubs = res.updatedClubs;
    workingAiSquads = res.updatedAiSquads;
  }
});





