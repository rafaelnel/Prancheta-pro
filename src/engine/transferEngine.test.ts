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

  // 2. International U22 wonderkids (Endrick, Arda Güler, Vitor Reis, Moscardo) are loan-listed and NOT dumped on transfer sale list
  const endrick = listings.find((l) => l.player.name === 'Endrick');
  assert.ok(endrick, 'Endrick should exist in international listings');
  assert.equal(endrick!.isLoanListed, true);
  assert.equal(endrick!.isTransferListed, false);
  assert.equal(endrick!.player.potentialStars, 5);
  assert.ok(
    endrick!.ovr >= 75 && endrick!.ovr <= 80,
    `Expected Endrick OVR in 75..80 PES/EA FC range, got ${endrick!.ovr}`
  );

  // 3. Senior rotational players at big clubs (Gabriel Jesus, João Palhinha) are transfer-listed for sale, not loan-listed
  const palhinha = listings.find((l) => l.player.name === 'João Palhinha');
  assert.ok(palhinha);
  assert.equal(palhinha!.isTransferListed, true);
  assert.equal(palhinha!.isLoanListed, false);

  // 4. Brasileirão Série A stars (Arrascaeta, Pedro, Léo Ortiz) have realistic PES/FC OVRs (77-82) and age-anchored potential ceilings
  const arrascaeta = career.squad.find((p) => p.name.includes('Arrascaeta'))!;
  const leoOrtiz = career.squad.find((p) => p.name.includes('Léo Ortiz'))!;
  const arrOvr = calculatePlayerOverall(arrascaeta.attributes, arrascaeta.position);
  const ortizOvr = calculatePlayerOverall(leoOrtiz.attributes, leoOrtiz.position);

  assert.ok(
    arrOvr >= 79 && arrOvr <= 83,
    `Expected Arrascaeta OVR in 79..83 PES/EA FC range, got ${arrOvr}`
  );
  assert.ok(
    ortizOvr >= 76 && ortizOvr <= 80,
    `Expected Léo Ortiz OVR in 76..80 PES/EA FC range, got ${ortizOvr}`
  );
  assert.equal(
    leoOrtiz.potentialStars,
    4,
    '30yo Léo Ortiz should be 4★ in PES/FC scale, not 5★'
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
});



