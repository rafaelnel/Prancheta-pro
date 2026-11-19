import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewCareerSave } from '../data/careerFactory';
import {
  acceptTransferCounterOffer,
  evaluateTransferNegotiation,
  executeIncomingTransfer,
} from './transferEngine';
import type { MarketPlayerListing, Player } from '../types/football';
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
});

