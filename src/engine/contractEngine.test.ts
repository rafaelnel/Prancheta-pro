import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewCareerSave } from '../data/careerFactory';
import {
  calculateBalancedValuationAndWage,
  calculateDynamicPerformanceGrowth,
} from './economyAndEvolution';
import {
  calculateContractRenewalExpectation,
  getRenewalEligiblePlayers,
  negotiateContractRenewal,
  processSeasonEndContracts,
  setContractNonRenewalDecision,
} from './contractEngine';
import fs from 'node:fs';
import path from 'node:path';
import {
  createInitialYouthAcademy,
  evolveYouthAcademyRoster,
  generateYouthRegens,
  getYouthInitialOvrRange,
  releaseYouthPlayerFromAcademy,
} from './youthAcademyEngine';
import { maybeGenerateIncomingOfferForUser } from './aiMarketEngine';
import { calculatePlayerOverall } from './playerOverall';
import { executeNewSeasonRollover } from './seasonLifecycle';
import {
  evaluateTransferNegotiation,
  executeIncomingTransfer,
} from './transferEngine';
import type { MarketPlayerListing, Player, PotentialStars } from '../types/football';

function makeTestPlayer(overrides: Partial<Player> = {}): Player {
  const baseAttr = 15;
  return {
    id: overrides.id ?? 'p-test-1',
    number: overrides.number ?? 10,
    name: overrides.name ?? 'Atleta Teste',
    age: overrides.age ?? 25,
    nationality: 'Brasil',
    position: overrides.position ?? 'MC',
    sector: overrides.sector ?? 'MEI',
    condition: 94,
    morale: overrides.morale ?? 'Bom',
    marketValue: overrides.marketValue ?? 20_000_000,
    salary: overrides.salary ?? 260_000,
    potentialStars: overrides.potentialStars ?? 3.5,
    basePotentialOvr: 82,
    dynamicCeilingOvr: 85,
    attributes: overrides.attributes ?? {
      passe: baseAttr,
      finalizacao: baseAttr,
      drible: baseAttr,
      desarme: baseAttr - 1,
      primeiroToque: baseAttr,
      cruzamento: baseAttr - 1,
      decisoes: baseAttr,
      visaoDeJogo: baseAttr,
      compostura: baseAttr,
      semBola: baseAttr,
      posicionamento: baseAttr - 1,
      indiceDeTrabalho: baseAttr,
      velocidade: baseAttr,
      aceleracao: baseAttr,
      resistencia: baseAttr,
      forca: baseAttr - 1,
      impulsao: baseAttr - 1,
      agilidade: baseAttr,
    },
    isStarter: overrides.isStarter ?? true,
    slotIndex: overrides.slotIndex ?? 6,
    assignedRole: 'meia-central',
    assignedDuty: 'Apoiar',
    injured: false,
    contractType: overrides.contractType ?? 'DEFINITIVO',
    contractYearsRemaining: overrides.contractYearsRemaining ?? 1,
    contractEndYear: overrides.contractEndYear ?? 2026,
    loanDurationYears: overrides.loanDurationYears,
    contractRenewalStatus: overrides.contractRenewalStatus ?? 'PENDENTE',
    recentOvrDelta: overrides.recentOvrDelta ?? 0,
    exceededExpectations: overrides.exceededExpectations ?? false,
    seasonStats: overrides.seasonStats ?? {
      matches: 28,
      goals: 4,
      assists: 7,
      yellowCards: 3,
      avgRating: 7.05,
    },
  };
}

test('Veteran high-OVR player has lower marketValue and higher salary than younger same-OVR player', () => {
  const career = createNewCareerSave(1, 'palmeiras', 'Técnico');
  const club = career.clubs.find((c) => c.id === 'palmeiras')!;

  const youngEconomy = calculateBalancedValuationAndWage({
    ovr: 82,
    age: 21,
    clubReputation: club.reputation,
    division: 'A',
    potentialStars: 4,
    position: 'ATA',
  });

  const veteranEconomy = calculateBalancedValuationAndWage({
    ovr: 82,
    age: 34,
    clubReputation: club.reputation,
    division: 'A',
    potentialStars: 4,
    position: 'ATA',
  });

  assert.ok(
    veteranEconomy.marketValue < youngEconomy.marketValue,
    `Expected veteran marketValue (${veteranEconomy.marketValue}) < young marketValue (${youngEconomy.marketValue})`
  );
  assert.ok(
    veteranEconomy.salary > youngEconomy.salary,
    `Expected veteran salary (${veteranEconomy.salary}) > young salary (${youngEconomy.salary})`
  );

  // Also validate via calculateContractRenewalExpectation at equal base attributes/OVR
  const youngPlayer = makeTestPlayer({
    id: 'young-82',
    name: 'Jovem Promessa',
    age: 21,
    salary: youngEconomy.salary,
    marketValue: youngEconomy.marketValue,
    potentialStars: 4,
    contractYearsRemaining: 1,
  });
  const veteranPlayer = makeTestPlayer({
    id: 'vet-82',
    name: 'Veterano Experiente',
    age: 34,
    salary: veteranEconomy.salary,
    marketValue: veteranEconomy.marketValue,
    potentialStars: 4,
    contractYearsRemaining: 1,
  });

  const youngExp = calculateContractRenewalExpectation(youngPlayer, club, 2026);
  const vetExp = calculateContractRenewalExpectation(veteranPlayer, club, 2026);

  assert.equal(youngExp.currentOvr, vetExp.currentOvr);
  assert.ok(vetExp.fairMarketValue < youngExp.fairMarketValue);
  assert.ok(vetExp.desiredSalary > youngExp.desiredSalary);
});

test('Improved player values up and demands higher salary while declining player drops value and accepts lower salary', () => {
  const career = createNewCareerSave(1, 'palmeiras', 'Técnico');
  const club = career.clubs.find((c) => c.id === 'palmeiras')!;

  const improved = makeTestPlayer({
    id: 'improved',
    age: 23,
    salary: 220_000,
    recentOvrDelta: 2,
    exceededExpectations: true,
    attributes: {
      passe: 16,
      finalizacao: 15,
      drible: 16,
      desarme: 14,
      primeiroToque: 16,
      cruzamento: 15,
      decisoes: 16,
      visaoDeJogo: 16,
      compostura: 16,
      semBola: 15,
      posicionamento: 14,
      indiceDeTrabalho: 15,
      velocidade: 16,
      aceleracao: 16,
      resistencia: 16,
      forca: 14,
      impulsao: 14,
      agilidade: 16,
    },
  });

  const declined = makeTestPlayer({
    id: 'declined',
    age: 32,
    salary: 420_000,
    recentOvrDelta: -2,
    attributes: {
      passe: 14,
      finalizacao: 13,
      drible: 13,
      desarme: 13,
      primeiroToque: 14,
      cruzamento: 13,
      decisoes: 14,
      visaoDeJogo: 14,
      compostura: 14,
      semBola: 13,
      posicionamento: 13,
      indiceDeTrabalho: 13,
      velocidade: 11,
      aceleracao: 11,
      resistencia: 11,
      forca: 13,
      impulsao: 12,
      agilidade: 12,
    },
  });

  const improvedExp = calculateContractRenewalExpectation(improved, club, 2026);
  const declinedExp = calculateContractRenewalExpectation(declined, club, 2026);

  assert.ok(improvedExp.desiredSalary > improved.salary);
  assert.ok(improvedExp.salaryDeltaPct > 0);
  assert.ok(declinedExp.desiredSalary < declined.salary);
  assert.ok(declinedExp.salaryDeltaPct < 0);
});

test('getRenewalEligiblePlayers includes both expiring (<=1y) and early-renewal (2y) players, excluding loaned & >=3y', () => {
  const career = createNewCareerSave(1, 'palmeiras', 'Técnico');
  const club = career.clubs.find((c) => c.id === 'palmeiras')!;

  const p1 = makeTestPlayer({ id: 'exp-1', contractYearsRemaining: 1, contractEndYear: 2026 });
  const p2 = makeTestPlayer({ id: 'early-2', contractYearsRemaining: 2, contractEndYear: 2027 });
  const p3 = makeTestPlayer({ id: 'long-3', contractYearsRemaining: 3, contractEndYear: 2028 });
  const pLoan = makeTestPlayer({
    id: 'loan-1',
    contractType: 'EMPRESTADO',
    contractYearsRemaining: 1,
    contractEndYear: 2026,
  });

  const eligible = getRenewalEligiblePlayers([p3, pLoan, p2, p1], club, 2026);
  const ids = eligible.map((e) => e.player.id);

  assert.deepEqual(ids, ['exp-1', 'early-2']);
  assert.equal(eligible[0].expectation.isExpiringFinalYear, true);
  assert.equal(eligible[1].expectation.canRenewEarly, true);
});

test('negotiateContractRenewal handles ACEITA, CONTRAPROPOSTA, and RECUSADA properly based on flexibility & offer', () => {
  const career = createNewCareerSave(1, 'palmeiras', 'Técnico');
  const richClub = {
    ...career.clubs.find((c) => c.id === 'palmeiras')!,
    wageBudget: 35_000_000,
  };

  const flexiblePlayer = makeTestPlayer({
    id: 'flex-p',
    name: 'Renovável',
    age: 26,
    morale: 'Exuberante',
    salary: 200_000,
    contractYearsRemaining: 1,
    contractEndYear: 2026,
  });

  const squad = [flexiblePlayer];
  const exp = calculateContractRenewalExpectation(flexiblePlayer, richClub, 2026);
  assert.equal(exp.flexibility, 'Alta');

  // 1. Fair / desired offer -> ACEITA and increments years
  const accepted = negotiateContractRenewal({
    player: flexiblePlayer,
    club: richClub,
    userSquad: squad,
    currentYear: 2026,
    offeredSalary: exp.desiredSalary,
    addYears: 2,
    rng: () => 0.5,
  });
  assert.equal(accepted.outcome, 'ACEITA');
  assert.ok(accepted.updatedPlayer);
  assert.equal(accepted.updatedPlayer!.contractYearsRemaining, 3);
  assert.equal(accepted.updatedPlayer!.contractEndYear, 2028);
  assert.equal(accepted.updatedPlayer!.contractRenewalStatus, 'RENOVADO');

  // 2. Moderate discount in counter zone (e.g. 78% of desired for Alta flexibility where minAccept=0.88, minCounter=0.72) -> CONTRAPROPOSTA
  const counterOfferedSalary = Math.round((exp.desiredSalary * 0.78) / 5_000) * 5_000;
  const counter = negotiateContractRenewal({
    player: flexiblePlayer,
    club: richClub,
    userSquad: squad,
    currentYear: 2026,
    offeredSalary: counterOfferedSalary,
    addYears: 2,
    rng: () => 0.5,
  });
  assert.equal(counter.outcome, 'CONTRAPROPOSTA');
  assert.ok((counter.counterSalary ?? 0) > counterOfferedSalary);

  // 3. Lowball offer -> RECUSADA
  const refused = negotiateContractRenewal({
    player: flexiblePlayer,
    club: richClub,
    userSquad: squad,
    currentYear: 2026,
    offeredSalary: Math.round((exp.desiredSalary * 0.45) / 5_000) * 5_000,
    addYears: 2,
    rng: () => 0.5,
  });
  assert.equal(refused.outcome, 'RECUSADA');
});

test('Incoming loan & buy durations persist cleanly and decrement across season rollover', () => {
  const career = createNewCareerSave(1, 'palmeiras', 'Técnico');
  const club = {
    ...career.clubs.find((c) => c.id === 'palmeiras')!,
    cashBalance: 250_000_000,
    wageBudget: 40_000_000,
  };
  const clubs = career.clubs.map((c) => (c.id === club.id ? club : c));

  const target1 = makeTestPlayer({
    id: 'loan-target-1y',
    name: 'Empréstimo Curto',
    age: 24,
    salary: 120_000,
  });
  const target2 = makeTestPlayer({
    id: 'loan-target-2y',
    name: 'Empréstimo Longo',
    age: 23,
    salary: 140_000,
  });

  const makeListing = (p: Player): MarketPlayerListing => ({
    player: p,
    ovr: calculatePlayerOverall(p.attributes, p.position),
    originClub: {
      id: 'flamengo',
      name: 'Flamengo',
      shortName: 'Flamengo',
      abbr: 'FLA',
      country: 'Brasil',
      leagueName: 'Série A',
      scope: 'SERIE_A',
      primaryColor: '#c00',
      reputation: 84,
      avgStrength: 80,
    },
    scope: 'SERIE_A',
    isClubStarter: false,
    buyFee: 10_000_000,
    loanFee: 500_000,
    loanAvailable: true,
    isLoanListed: true,
  });

  const eval1 = evaluateTransferNegotiation({
    userClub: club,
    userSquad: career.squad,
    listing: makeListing(target1),
    dealMode: 'LOAN',
    offerTier: 'FORTE_50',
    salaryOfferMult: 1.25,
    loanWageShare: 1.0,
    loanDurationYears: 1,
  });

  const res1 = executeIncomingTransfer({
    userClub: club,
    userSquad: career.squad,
    freeAgents: career.freeAgents ?? [],
    transferredOutClubPlayerIds: [],
    listing: makeListing(target1),
    dealMode: 'LOAN',
    evaluation: eval1,
    loanWageShare: 1.0,
    loanDurationYears: 1,
    seasonYear: 2026,
    rng: () => 0.01,
  });
  assert.equal(res1.accepted, true);
  assert.equal(res1.signedPlayer?.contractType, 'EMPRESTADO');
  assert.equal(res1.signedPlayer?.contractYearsRemaining, 1);
  assert.equal(res1.signedPlayer?.loanDurationYears, 1);

  const eval2 = evaluateTransferNegotiation({
    userClub: res1.updatedClub,
    userSquad: res1.updatedSquad,
    listing: makeListing(target2),
    dealMode: 'LOAN',
    offerTier: 'FORTE_50',
    salaryOfferMult: 1.25,
    loanWageShare: 1.0,
    loanDurationYears: 2,
  });

  const res2 = executeIncomingTransfer({
    userClub: res1.updatedClub,
    userSquad: res1.updatedSquad,
    freeAgents: res1.updatedFreeAgents,
    transferredOutClubPlayerIds: res1.updatedTransferredOutIds,
    listing: makeListing(target2),
    dealMode: 'LOAN',
    evaluation: eval2,
    loanWageShare: 1.0,
    loanDurationYears: 2,
    seasonYear: 2026,
    rng: () => 0.01,
  });
  assert.equal(res2.accepted, true);
  assert.equal(res2.signedPlayer?.contractYearsRemaining, 2);
  assert.equal(res2.signedPlayer?.loanDurationYears, 2);
  assert.equal(res2.signedPlayer?.contractEndYear, 2027);

  // Also test definitive player expiring vs non-expiring during processSeasonEndContracts
  const expiringDef = makeTestPlayer({
    id: 'unrenewed-def',
    name: 'Sem Renovação',
    contractType: 'DEFINITIVO',
    contractYearsRemaining: 1,
    contractEndYear: 2026,
  });
  const renewedDef = makeTestPlayer({
    id: 'renewed-def',
    name: 'Contrato Seguro',
    contractType: 'DEFINITIVO',
    contractYearsRemaining: 3,
    contractEndYear: 2028,
  });

  const rollover = executeNewSeasonRollover({
    currentYear: 2026,
    clubs,
    userClubId: club.id,
    userSquad: [
      ...res2.updatedSquad.map((p) => ({
        ...p,
        contractYearsRemaining: p.contractType === 'EMPRESTADO' ? p.contractYearsRemaining : 3,
      })),
      expiringDef,
      renewedDef,
    ],
    aiSquads: career.aiSquads ?? {},
    freeAgents: res2.updatedFreeAgents,
    loanedOutPlayers: [],
    standings: career.standings,
    secondaryStandings: career.secondaryStandings ?? [],
    copaDoBrasil: career.copaDoBrasil!,
    libertadores: career.libertadores!,
    seasonHistory: [],
    managerName: 'Técnico',
    rng: () => 0.5,
  });

  const signed1Id = res1.signedPlayer!.id;
  const signed2Id = res2.signedPlayer!.id;

  assert.equal(rollover.nextYear, 2027);
  // 1-season loan left squad
  assert.equal(
    rollover.updatedUserSquad.some((p) => p.id === signed1Id),
    false
  );
  // 2-season loan stayed in squad with 1 remaining year
  const kept2y = rollover.updatedUserSquad.find((p) => p.id === signed2Id);
  assert.ok(kept2y);
  assert.equal(kept2y!.contractYearsRemaining, 1);
  assert.equal(kept2y!.contractEndYear, 2027);

  // Unrenewed definitive expired to free agents; renewed definitive stayed with 2 years remaining
  assert.equal(
    rollover.updatedUserSquad.some((p) => p.id === 'unrenewed-def'),
    false
  );
  assert.ok(rollover.updatedFreeAgents.some((p) => p.id === 'unrenewed-def'));
  const keptRenewed = rollover.updatedUserSquad.find((p) => p.id === 'renewed-def');
  assert.ok(keptRenewed);
  assert.equal(keptRenewed!.contractYearsRemaining, 2);
});

test('Loaned-out players respect duration and return only when duration expires', () => {
  const career = createNewCareerSave(1, 'palmeiras', 'Técnico');
  const club = career.clubs.find((c) => c.id === 'palmeiras')!;

  const loanOut1y = makeTestPlayer({
    id: 'out-1y',
    name: 'Emprestado 1 Ano',
    contractType: 'EMPRESTADO',
    contractYearsRemaining: 1,
    loanDurationYears: 1,
  });
  const loanOut2y = makeTestPlayer({
    id: 'out-2y',
    name: 'Emprestado 2 Anos',
    contractType: 'EMPRESTADO',
    contractYearsRemaining: 2,
    loanDurationYears: 2,
  });

  const res = processSeasonEndContracts({
    userSquad: career.squad,
    aiSquads: career.aiSquads ?? {},
    loanedOutPlayers: [loanOut1y, loanOut2y],
    freeAgents: career.freeAgents ?? [],
    clubs: career.clubs,
    userClubId: club.id,
    nextYear: 2027,
  });

  assert.ok(res.returnedLoanOutNames.includes('Emprestado 1 Ano'));
  assert.ok(res.updatedUserSquad.some((p) => p.id === 'out-1y' && p.contractType === 'DEFINITIVO'));
  assert.equal(res.updatedLoanedOut.length, 1);
  assert.equal(res.updatedLoanedOut[0].id, 'out-2y');
  assert.equal(res.updatedLoanedOut[0].contractYearsRemaining, 1);
});

test('setContractNonRenewalDecision marks player RECUSADO and releases him on season rollover even with <=16 players', () => {
  const career = createNewCareerSave(1, 'palmeiras', 'Técnico');
  const club = career.clubs.find((c) => c.id === 'palmeiras')!;

  const declinedPlayer = setContractNonRenewalDecision(
    makeTestPlayer({
      id: 'declined-non-renew',
      name: 'Sem Interesse',
      position: 'MC',
      contractType: 'DEFINITIVO',
      contractYearsRemaining: 1,
      contractEndYear: 2026,
    }),
    true
  );

  assert.equal(declinedPlayer.contractRenewalStatus, 'RECUSADO');
  assert.equal(declinedPlayer.isTransferListed, true);

  // Small squad (< 16) plus one GK so normal auto-renew guard would trigger unless RECUSADO
  const minimalSquad = [
    ...career.squad.slice(0, 12),
    declinedPlayer,
  ];

  const rolloverContracts = processSeasonEndContracts({
    userSquad: minimalSquad,
    aiSquads: career.aiSquads ?? {},
    loanedOutPlayers: [],
    freeAgents: career.freeAgents ?? [],
    clubs: career.clubs,
    userClubId: club.id,
    nextYear: 2027,
  });

  assert.equal(
    rolloverContracts.updatedUserSquad.some((p) => p.id === 'declined-non-renew'),
    false
  );
  assert.ok(rolloverContracts.expiredDefinitiveNames.includes('Sem Interesse'));
  assert.ok(
    rolloverContracts.updatedFreeAgents.some((p) => p.id === 'declined-non-renew')
  );

  // Reopening talks restores PENDENTE
  const reopened = setContractNonRenewalDecision(declinedPlayer, false);
  assert.equal(reopened.contractRenewalStatus, 'PENDENTE');
  assert.equal(reopened.isTransferListed, false);
});

test('Youth academy prospects spawn with star-based OVR brackets (1-2.5★: 60-70, 3-4★: 70-75, 4.5★: 74-80, 5★: 75-85) and can be released', () => {
  assert.deepEqual(getYouthInitialOvrRange(2), { minOvr: 60, maxOvr: 70 });
  assert.deepEqual(getYouthInitialOvrRange(3.5), { minOvr: 70, maxOvr: 75 });
  assert.deepEqual(getYouthInitialOvrRange(4.5), { minOvr: 74, maxOvr: 80 });
  assert.deepEqual(getYouthInitialOvrRange(5), { minOvr: 75, maxOvr: 85 });

  let academy = createInitialYouthAcademy('flamengo', 84, 'A', 2026);
  academy = { ...academy, investmentTier: 'ELITE', accumulatedSeasonInvestment: 15_000_000, monthsInvestedThisSeason: 10 };

  const initialCount = academy.youthRoster?.length ?? 0;
  assert.ok(initialCount >= 3);
  const targetReleaseId = academy.youthRoster![0].id;
  const afterRelease = releaseYouthPlayerFromAcademy({
    academy,
    playerId: targetReleaseId,
  });
  assert.equal(afterRelease.youthRoster?.length, initialCount - 1);
  assert.equal(
    afterRelease.youthRoster?.some((p) => p.id === targetReleaseId),
    false
  );

  // Verify generated youth regens across batches obey star OVR bounds (60..85)
  for (let seed = 1; seed <= 8; seed++) {
    let step = 0;
    const batch = generateYouthRegens({
      academy,
      clubId: 'flamengo',
      clubReputation: 86,
      division: 'A',
      seasonYear: 2026 + seed,
      rng: () => {
        step += 1;
        return ((seed * 37 + step * 17) % 100) / 100;
      },
    });
    for (const item of batch.reportItems) {
      const range = getYouthInitialOvrRange((item.potentialStars ?? 3) as PotentialStars);
      assert.ok(
        item.ovr >= range.minOvr && item.ovr <= range.maxOvr,
        `Youth ${item.name} (${item.potentialStars}★) got OVR ${item.ovr}, expected [${range.minOvr}, ${range.maxOvr}]`
      );
    }
  }
});

test('88 OVR 38yo veteran commands high OVR-driven market value (>= 45M) and coherent AI incoming purchase offer (not 8M)', () => {
  const career = createNewCareerSave(1, 'flamengo', 'Técnico');
  const userClub = career.clubs.find((c) => c.id === 'flamengo')!;

  const vetValuation = calculateBalancedValuationAndWage({
    ovr: 88,
    age: 38,
    clubReputation: 85,
    division: 'A',
    potentialStars: 4.5,
    position: 'ATA',
  });
  const youngValuation = calculateBalancedValuationAndWage({
    ovr: 88,
    age: 22,
    clubReputation: 85,
    division: 'A',
    potentialStars: 4.5,
    position: 'ATA',
  });

  assert.ok(
    vetValuation.marketValue >= 45_000_000,
    `Expected 88 OVR 38yo marketValue >= 45M, got ${vetValuation.marketValue}`
  );
  assert.ok(
    vetValuation.marketValue < youngValuation.marketValue,
    'Veteran 38yo should still cost less than 22yo of equal 88 OVR'
  );

  const vet88 = makeTestPlayer({
    id: 'vet-88-38',
    name: 'Craque Veterano',
    age: 38,
    position: 'ATA',
    sector: 'ATA',
    marketValue: vetValuation.marketValue,
    salary: vetValuation.salary,
    isTransferListed: true,
    attributes: {
      passe: 17,
      finalizacao: 19,
      drible: 18,
      desarme: 10,
      primeiroToque: 19,
      cruzamento: 16,
      decisoes: 19,
      visaoDeJogo: 18,
      compostura: 19,
      semBola: 19,
      posicionamento: 14,
      indiceDeTrabalho: 15,
      velocidade: 15,
      aceleracao: 15,
      resistencia: 14,
      forca: 16,
      impulsao: 16,
      agilidade: 16,
    },
  });

  const clubsWithRichBuyer = career.clubs.map((c) =>
    c.id === 'palmeiras' ? { ...c, cashBalance: 95_000_000, reputation: 86 } : c
  );

  const offer = maybeGenerateIncomingOfferForUser({
    userClub,
    userSquad: [vet88, ...career.squad],
    clubs: clubsWithRichBuyer,
    aiSquads: career.aiSquads,
    seasonYear: 2026,
    dayOffset: 10,
    pendingOffers: [],
    specificPlayerId: vet88.id,
    rng: () => 0.4,
  });

  assert.ok(offer, 'Expected an incoming offer for listed 88 OVR star');
  assert.equal(offer!.dealType, 'BUY');
  assert.ok(
    offer!.offeredFee >= vetValuation.marketValue * 0.85,
    `Expected coherent AI offer >= 85% of marketValue (${vetValuation.marketValue}), got ${offer!.offeredFee}`
  );
});

test('Age-based evolution curve: <=25 evolves strongly (but can regress), 26-30 medium, 31-35 low, >35 regresses', () => {
  const highPerfStats = {
    matches: 30,
    goals: 12,
    assists: 8,
    yellowCards: 2,
    avgRating: 7.35,
  };
  const poorPerfStats = {
    matches: 22,
    goals: 0,
    assists: 0,
    yellowCards: 4,
    avgRating: 6.35,
  };

  const youngStrong = calculateDynamicPerformanceGrowth({
    player: makeTestPlayer({ age: 21, seasonStats: highPerfStats }),
    currentAge: 21,
    stars: 4.5,
    basePotentialOvr: 88,
    dynamicCeilingOvr: 92,
    rng: () => 0.5,
  });
  const youngPoor = calculateDynamicPerformanceGrowth({
    player: makeTestPlayer({ age: 20, seasonStats: poorPerfStats }),
    currentAge: 20,
    stars: 4,
    basePotentialOvr: 86,
    dynamicCeilingOvr: 90,
    rng: () => 0.5,
  });
  const prime28 = calculateDynamicPerformanceGrowth({
    player: makeTestPlayer({ age: 28, seasonStats: { ...highPerfStats, avgRating: 7.05, goals: 5, assists: 4 } }),
    currentAge: 28,
    stars: 4,
    basePotentialOvr: 84,
    dynamicCeilingOvr: 86,
    rng: () => 0.5,
  });
  const veteran33 = calculateDynamicPerformanceGrowth({
    player: makeTestPlayer({ age: 33, seasonStats: { ...highPerfStats, avgRating: 6.85, goals: 3, assists: 2 } }),
    currentAge: 33,
    stars: 4,
    basePotentialOvr: 84,
    dynamicCeilingOvr: 85,
    rng: () => 0.9,
  });
  const elder37 = calculateDynamicPerformanceGrowth({
    player: makeTestPlayer({ age: 37, seasonStats: { ...highPerfStats, avgRating: 6.9, goals: 4, assists: 2 } }),
    currentAge: 37,
    stars: 4,
    basePotentialOvr: 84,
    dynamicCeilingOvr: 84,
    rng: () => 0.5,
  });

  assert.ok(youngStrong.desiredDelta >= 2, `Expected <=25 strong evolution >= +2, got ${youngStrong.desiredDelta}`);
  assert.ok(youngPoor.desiredDelta <= 0, `Expected <=25 poor performance <= 0 (can regress), got ${youngPoor.desiredDelta}`);
  assert.ok(prime28.desiredDelta >= 0 && prime28.desiredDelta <= 2, `Expected 26-30 medium evolution, got ${prime28.desiredDelta}`);
  assert.ok(veteran33.desiredDelta <= 1, `Expected 31-35 low evolution/decline, got ${veteran33.desiredDelta}`);
  assert.ok(elder37.desiredDelta <= 0 && elder37.desiredDelta < youngStrong.desiredDelta, `Expected >35 regression, got ${elder37.desiredDelta}`);
});

test('Youth academy prospects continue evolving stochastically based on potential up to age 20 (leaving only after 20)', () => {
  const highPot19 = makeTestPlayer({
    id: 'youth-5star-19',
    name: 'Joia 19 Anos',
    age: 19,
    position: 'MEI',
    sector: 'MEI',
    potentialStars: 5,
    basePotentialOvr: 88,
    dynamicCeilingOvr: 92,
    attributes: {
      passe: 14,
      finalizacao: 13,
      drible: 14,
      desarme: 10,
      primeiroToque: 14,
      cruzamento: 13,
      decisoes: 14,
      visaoDeJogo: 14,
      compostura: 13,
      semBola: 14,
      posicionamento: 11,
      indiceDeTrabalho: 13,
      velocidade: 14,
      aceleracao: 14,
      resistencia: 14,
      forca: 12,
      impulsao: 12,
      agilidade: 14,
    },
  });

  const lowPot19 = makeTestPlayer({
    id: 'youth-2star-19',
    name: 'Reserva Base 19',
    age: 19,
    position: 'MEI',
    sector: 'MEI',
    potentialStars: 2,
    basePotentialOvr: 70,
    dynamicCeilingOvr: 71,
    attributes: {
      passe: 12,
      finalizacao: 11,
      drible: 12,
      desarme: 10,
      primeiroToque: 12,
      cruzamento: 11,
      decisoes: 12,
      visaoDeJogo: 12,
      compostura: 11,
      semBola: 12,
      posicionamento: 10,
      indiceDeTrabalho: 12,
      velocidade: 12,
      aceleracao: 12,
      resistencia: 12,
      forca: 11,
      impulsao: 11,
      agilidade: 12,
    },
  });

  const turning21 = makeTestPlayer({
    id: 'youth-20-grad',
    name: 'Sub20 Limite',
    age: 20,
    position: 'ATA',
    sector: 'ATA',
    potentialStars: 3.5,
    basePotentialOvr: 79,
    dynamicCeilingOvr: 81,
  });

  const baseAcademy = {
    ...createInitialYouthAcademy('flamengo', 84, 'A', 2026),
    youthRoster: [highPot19, lowPot19, turning21],
  };

  // 1. Mid-season: all players <= 20 (including 20yo!) stay and evolve randomly
  const midRes = evolveYouthAcademyRoster({
    academy: baseAcademy,
    clubReputation: 84,
    division: 'A',
    phase: 'MID_SEASON',
    rng: () => 0.85,
  });
  assert.equal(midRes.updatedYouthRoster.length, 3, '20yo stays in academy during season');
  const midHigh = midRes.updatedYouthRoster.find((p) => p.id === 'youth-5star-19')!;
  const beforeOvr = calculatePlayerOverall(highPot19.attributes, highPot19.position);
  const midOvr = calculatePlayerOverall(midHigh.attributes, midHigh.position);
  assert.ok(midOvr > beforeOvr, `Expected 5★ youth to evolve mid-season (${beforeOvr} -> ${midOvr})`);

  // 2. Season-end: 19yo turns 20 and STAYS & EVOLVES; 20yo turns 21 and graduates out
  const endRes = evolveYouthAcademyRoster({
    academy: baseAcademy,
    clubReputation: 84,
    division: 'A',
    phase: 'SEASON_END',
    rng: () => 0.78,
  });
  const evolved20 = endRes.updatedYouthRoster.find((p) => p.id === 'youth-5star-19');
  assert.ok(evolved20, '19yo turning 20 must remain in academy and evolve up to age 20');
  assert.equal(evolved20!.age, 20);
  assert.ok(
    calculatePlayerOverall(evolved20!.attributes, evolved20!.position) > beforeOvr,
    '19yo turning 20 should gain OVR'
  );
  assert.equal(
    endRes.updatedYouthRoster.some((p) => p.id === 'youth-20-grad'),
    false,
    '20yo turning 21 should leave Sub-20 academy'
  );
  assert.deepEqual(endRes.graduatedOutNames, ['Sub20 Limite']);

  // 3. Stochastic & potential-weighted: 5★ evolves more on average than 2★ across seeds, and outcomes vary randomly
  let highTotalGain = 0;
  let lowTotalGain = 0;
  const highOutcomes = new Set<number>();
  const lowBeforeOvr = calculatePlayerOverall(lowPot19.attributes, lowPot19.position);
  for (let i = 0; i < 40; i++) {
    let s = i * 7919 + 13;
    const seeded = () => {
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return s / 4294967296;
    };
    const res = evolveYouthAcademyRoster({
      academy: baseAcademy,
      clubReputation: 84,
      division: 'A',
      phase: 'SEASON_END',
      rng: seeded,
    });
    const h = res.updatedYouthRoster.find((p) => p.id === 'youth-5star-19')!;
    const l = res.updatedYouthRoster.find((p) => p.id === 'youth-2star-19')!;
    const hDelta = calculatePlayerOverall(h.attributes, h.position) - beforeOvr;
    const lDelta = calculatePlayerOverall(l.attributes, l.position) - lowBeforeOvr;
    highTotalGain += hDelta;
    lowTotalGain += lDelta;
    highOutcomes.add(hDelta);
  }
  assert.ok(
    highOutcomes.size >= 2,
    `Expected stochastic variation in youth OVR gains, got single value: ${[...highOutcomes]}`
  );
  assert.ok(
    highTotalGain > lowTotalGain,
    `Expected 5★ average evolution (${highTotalGain}) > 2★ (${lowTotalGain})`
  );

  // 4. YouthAcademyView removes all rules and mechanics explanation sections
  const youthViewSource = fs.readFileSync(
    path.resolve('src/components/YouthAcademyView.tsx'),
    'utf-8'
  );
  assert.equal(youthViewSource.includes('Regras de Transição'), false);
  assert.equal(youthViewSource.includes('Mecânica de Potencial Dinâmico'), false);
  assert.equal(youthViewSource.includes('Rompimento de Teto'), false);
  assert.equal(youthViewSource.includes('O Potencial Não Protege'), false);
});


