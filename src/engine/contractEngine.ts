import {
  Club,
  ContractFlexibility,
  ContractRenewalExpectation,
  ContractRenewalOutcome,
  Player,
} from '../types/football';
import { calculateBalancedValuationAndWage } from './economyAndEvolution';
import { calculatePlayerOverall } from './playerOverall';

export function getPlayerContractRemainingYears(player: Player): number {
  if (typeof player.contractYearsRemaining === 'number' && player.contractYearsRemaining >= 1) {
    return Math.round(player.contractYearsRemaining);
  }
  return player.contractType === 'EMPRESTADO' ? player.loanDurationYears ?? 1 : 2;
}

export function getPlayerContractEndYear(
  player: Player,
  currentYear: number
): number {
  if (typeof player.contractEndYear === 'number' && player.contractEndYear >= currentYear) {
    return player.contractEndYear;
  }
  return currentYear + getPlayerContractRemainingYears(player) - 1;
}

/**
 * Computes realistic contract renewal expectation (desired salary, extension years,
 * flexibility, and demand explanation) for a squad player.
 * - OVR improvement -> higher fairMarketValue & higher desiredSalary
 * - OVR decline -> lower fairMarketValue & lower desiredSalary (willing to cut)
 * - Experience (older age) -> higher salary expectation than younger players at same OVR
 */
export function calculateContractRenewalExpectation(
  player: Player,
  club: Club,
  currentYear: number
): ContractRenewalExpectation {
  const currentOvr = calculatePlayerOverall(player.attributes, player.position);
  const recentOvrDelta = player.recentOvrDelta ?? 0;
  const remainingYears = getPlayerContractRemainingYears(player);

  const valuation = calculateBalancedValuationAndWage({
    ovr: currentOvr,
    age: player.age,
    clubReputation: club.reputation,
    division: club.division,
    potentialStars: player.potentialStars ?? 3,
    position: player.position,
  });

  // Explicit momentum factor for recent evolution/decline so improved players ask for raises
  // and declined players ask for noticeably less.
  let trendSalaryMult = 1.0;
  if (recentOvrDelta > 0) {
    trendSalaryMult = 1 + Math.min(0.26, recentOvrDelta * 0.065);
  } else if (recentOvrDelta < 0) {
    trendSalaryMult = Math.max(0.7, 1 + recentOvrDelta * 0.08);
  }

  // Starter status & age experience subtle anchor
  const starterAskMult = player.isStarter ? 1.04 : 0.96;
  const targetMarketAsk = valuation.salary * trendSalaryMult * starterAskMult;

  let desiredSalaryRaw: number;
  if (recentOvrDelta > 0) {
    // Improved player demands at least an increase over his old salary
    const minRaiseFromCurrent = player.salary * (1 + Math.min(0.24, recentOvrDelta * 0.055));
    desiredSalaryRaw = Math.max(targetMarketAsk, minRaiseFromCurrent);
  } else if (recentOvrDelta < 0) {
    // Declined player asks for less than old wage & less than before
    const discountedCurrent = player.salary * Math.max(0.68, 1 + recentOvrDelta * 0.075);
    desiredSalaryRaw = Math.min(discountedCurrent, targetMarketAsk);
  } else {
    // Stable OVR: experienced players hold ground slightly above current salary; young/fair converges smoothly
    const currentAnchor =
      player.age >= 29 ? player.salary * 1.03 : player.salary * 0.98;
    desiredSalaryRaw = Math.round((targetMarketAsk * 0.55 + currentAnchor * 0.45));
  }

  const maxContractSalary =
    club.division === 'UCL'
      ? 16_000_000
      : club.division === 'WORLD'
      ? 8_000_000
      : club.division === 'B'
      ? 900_000
      : 3_500_000;

  const desiredSalary = Math.min(
    maxContractSalary,
    Math.max(20_000, Math.round(desiredSalaryRaw / 5_000) * 5_000)
  );
  const salaryDeltaPct =
    player.salary > 0
      ? Math.round(((desiredSalary - player.salary) / player.salary) * 100)
      : 0;

  // Desired contract extension years
  const desiredAddYears: 1 | 2 | 3 =
    player.age >= 34 ? 1 : player.age >= 29 ? 2 : 3;

  // Flexibility score (0..100) determines how close to desiredSalary the club must get
  let flexScore = 52;
  if (player.morale === 'Exuberante') flexScore += 20;
  else if (player.morale === 'Muito Alta') flexScore += 14;
  else if (player.morale === 'Bom') flexScore += 6;
  else if (player.morale === 'Regular') flexScore -= 10;
  else if (player.morale === 'Baixa') flexScore -= 22;

  if (recentOvrDelta < 0) {
    // Declining players are more willing to negotiate / accept reductions
    flexScore += Math.min(18, Math.abs(recentOvrDelta) * 7);
  } else if (recentOvrDelta >= 2) {
    // Breakout performers drive a harder bargain
    flexScore -= Math.min(18, recentOvrDelta * 6);
  }

  if (player.exceededExpectations) flexScore -= 10;
  if (player.age >= 32) flexScore += 10; // veterans value stability & club continuation
  if (!player.isStarter && player.age <= 24) flexScore -= 6; // frustrated prospect
  if (remainingYears === 2) flexScore -= 4; // still has 1 extra year buffer so less urgent

  const flexibilityScore = Math.max(10, Math.min(95, Math.round(flexScore)));
  const flexibility: ContractFlexibility =
    flexibilityScore >= 64
      ? 'Alta'
      : flexibilityScore >= 38
      ? 'Média'
      : 'Baixa';

  const demandReasons: string[] = [];
  if (recentOvrDelta > 0) {
    demandReasons.push(
      `Evoluiu +${recentOvrDelta} OVR (agora ${currentOvr}) — valorizou e pede aumento salarial`
    );
  } else if (recentOvrDelta < 0) {
    demandReasons.push(
      `Caiu ${recentOvrDelta} OVR (agora ${currentOvr}) — valor diminuiu e aceita redução na pedida`
    );
  } else {
    demandReasons.push(`Manteve OVR ${currentOvr} estável na temporada`);
  }

  if (player.age >= 31) {
    demandReasons.push(
      `Experiência (${player.age} anos) eleva patamar salarial por rodagem no elenco`
    );
  } else if (player.age <= 22) {
    demandReasons.push(`Atleta jovem (${player.age} anos) com foco em longo prazo`);
  }

  const endYear = getPlayerContractEndYear(player, currentYear);
  const canRenewEarly = remainingYears === 2;
  const isExpiringFinalYear = remainingYears <= 1;

  demandReasons.push(
    isExpiringFinalYear
      ? `Contrato expira no fim de ${endYear} (renovação prioritária)`
      : `Contrato válido até ${endYear} — elegível para renovação antecipada`
  );

  return {
    playerId: player.id,
    currentOvr,
    recentOvrDelta,
    fairMarketValue: valuation.marketValue,
    currentSalary: player.salary,
    desiredSalary,
    salaryDeltaPct,
    desiredAddYears,
    flexibility,
    flexibilityScore,
    isExpiringFinalYear,
    canRenewEarly,
    demandReason: demandReasons.join(' · '),
  };
}

export interface RenewalCandidateItem {
  player: Player;
  remainingYears: number;
  endYear: number;
  expectation: ContractRenewalExpectation;
}

/**
 * Allows the user to explicitly decide not to renew a player's contract (or reopen talks).
 * - doNotRenew = true -> sets contractRenewalStatus to 'RECUSADO' and marks player transfer-listed.
 * - doNotRenew = false -> restores contractRenewalStatus to 'PENDENTE'.
 */
export function setContractNonRenewalDecision(
  player: Player,
  doNotRenew: boolean
): Player {
  const nonRenewalReason = 'Decisão do clube: Não renovará contrato';
  if (doNotRenew) {
    return {
      ...player,
      contractRenewalStatus: 'RECUSADO',
      isTransferListed: true,
      marketListingReason: player.marketListingReason || nonRenewalReason,
    };
  }
  return {
    ...player,
    contractRenewalStatus: 'PENDENTE',
    isTransferListed:
      player.marketListingReason === nonRenewalReason
        ? false
        : player.isTransferListed,
    marketListingReason:
      player.marketListingReason === nonRenewalReason
        ? undefined
        : player.marketListingReason,
  };
}

/**
 * Returns players eligible for the annual contract renewal list:
 * - Definitive squad players expiring at end of this season (contractYearsRemaining <= 1)
 * - Definitive squad players in the year before expiry (contractYearsRemaining === 2)
 */
export function getRenewalEligiblePlayers(
  squad: Player[],
  club: Club,
  currentYear: number
): RenewalCandidateItem[] {
  return squad
    .filter((p) => {
      if (p.contractType === 'EMPRESTADO') return false;
      const rem = getPlayerContractRemainingYears(p);
      return rem <= 2;
    })
    .map((player) => {
      const remainingYears = getPlayerContractRemainingYears(player);
      const endYear = getPlayerContractEndYear(player, currentYear);
      const expectation = calculateContractRenewalExpectation(
        player,
        club,
        currentYear
      );
      return {
        player,
        remainingYears,
        endYear,
        expectation,
      };
    })
    .sort((a, b) => {
      // Expiring this year first, pending before opted-out ('RECUSADO') before already renewed ('RENOVADO'), then highest OVR
      if (a.remainingYears !== b.remainingYears) {
        return a.remainingYears - b.remainingYears;
      }
      const statusRank = (status?: string) =>
        status === 'RENOVADO' ? 2 : status === 'RECUSADO' ? 1 : 0;
      const aRank = statusRank(a.player.contractRenewalStatus);
      const bRank = statusRank(b.player.contractRenewalStatus);
      if (aRank !== bRank) return aRank - bRank;
      return b.expectation.currentOvr - a.expectation.currentOvr;
    });
}

/**
 * Evaluates a user's contract renewal proposal against player's demands & flexibility.
 */
export function negotiateContractRenewal(params: {
  player: Player;
  club: Club;
  userSquad: Player[];
  loanedOutPlayers?: Player[];
  currentYear: number;
  offeredSalary: number;
  addYears: 1 | 2 | 3;
  rng?: () => number;
}): ContractRenewalOutcome {
  const {
    player,
    club,
    userSquad,
    loanedOutPlayers = [],
    currentYear,
    offeredSalary,
    addYears,
    rng = Math.random,
  } = params;

  const expectation = calculateContractRenewalExpectation(
    player,
    club,
    currentYear
  );

  // Teto salarial sem limite: renovações não são bloqueadas pela folha,
  // mas salários elevados aumentam o custo mensal e podem levar o clube à dívida.
  void userSquad;
  void loanedOutPlayers;

  const salaryRatio = offeredSalary / Math.max(15_000, expectation.desiredSalary);

  // Veterans prefer shorter contracts; young players accept longer extensions smoothly
  const yearMismatchPenalty =
    player.age >= 34 && addYears === 3
      ? 0.05
      : player.age <= 25 && addYears === 1
      ? 0.04
      : 0;

  const effectiveRatio = salaryRatio - yearMismatchPenalty;

  let minAcceptRatio: number;
  let minCounterRatio: number;
  if (expectation.flexibility === 'Alta') {
    minAcceptRatio = 0.88;
    minCounterRatio = 0.72;
  } else if (expectation.flexibility === 'Média') {
    minAcceptRatio = 0.96;
    minCounterRatio = 0.82;
  } else {
    minAcceptRatio = 1.03;
    minCounterRatio = 0.9;
  }

  const rngJitter = (rng() - 0.5) * 0.03;
  const currentRem = getPlayerContractRemainingYears(player);

  const factors = [
    `Flexibilidade ${expectation.flexibility} (${expectation.flexibilityScore}/100) · Moral ${player.morale}`,
    `Pedida base: ${Math.round(expectation.desiredSalary / 1000)}k/mês por +${expectation.desiredAddYears} ano(s)`,
    expectation.demandReason,
  ];

  // Clear acceptance if offer hits threshold (or >= 106% always accepted cleanly)
  if (effectiveRatio + rngJitter >= minAcceptRatio || effectiveRatio >= 1.06) {
    const newRemainingYears = Math.min(5, currentRem + addYears);
    const newEndYear = currentYear + newRemainingYears - 1;
    const updatedPlayer: Player = {
      ...player,
      salary: offeredSalary,
      marketValue: Math.max(
        Math.round(expectation.fairMarketValue * 0.9),
        player.marketValue
      ),
      contractYearsRemaining: newRemainingYears,
      contractEndYear: newEndYear,
      contractRenewalStatus: 'RENOVADO',
    };

    return {
      outcome: 'ACEITA',
      headline: `Contrato renovado! ${player.name} segue no ${club.shortName}`,
      summary: `${player.name} aceitou +${addYears} ano(s) até o fim de ${newEndYear} com salário ajustado.`,
      factors,
      offeredSalary,
      offeredAddYears: addYears,
      updatedPlayer,
      expectation,
    };
  }

  // Counteroffer zone
  if (effectiveRatio >= minCounterRatio) {
    const midpoint =
      expectation.flexibility === 'Alta'
        ? offeredSalary * 0.45 + expectation.desiredSalary * 0.55
        : expectation.flexibility === 'Média'
        ? offeredSalary * 0.3 + expectation.desiredSalary * 0.7
        : offeredSalary * 0.15 + expectation.desiredSalary * 0.85;

    const counterSalary = Math.min(
      Math.max(3_500_000, expectation.desiredSalary),
      Math.max(
        offeredSalary + 5_000,
        Math.round(midpoint / 5_000) * 5_000
      )
    );
    const counterAddYears: 1 | 2 | 3 =
      player.age >= 34 && addYears === 3
        ? 2
        : player.age <= 25 && addYears === 1
        ? 2
        : addYears;

    return {
      outcome: 'CONTRAPROPOSTA',
      headline: `${player.name} enviou contraproposta de renovação`,
      summary: `Com flexibilidade ${expectation.flexibility.toLowerCase()}, o estafe pede um ajuste salarial e +${counterAddYears} ano(s) para assinar.`,
      factors,
      offeredSalary,
      offeredAddYears: addYears,
      counterSalary,
      counterAddYears,
      expectation,
    };
  }

  return {
    outcome: 'RECUSADA',
    headline: `${player.name} recusou a proposta de renovação`,
    summary: `Oferta muito distante da pedida para a flexibilidade (${expectation.flexibility}) e momento técnico de ${player.name}. Melhore o salário para tentar novo acordo.`,
    factors,
    offeredSalary,
    offeredAddYears: addYears,
    expectation,
  };
}

/**
 * Advances contract years (-1) on season rollover (`currentYear` -> `nextYear`):
 * - Loaned-in players (`EMPRESTADO`) with 1 year left leave at end of loan; 2-year loans continue with 1 year left.
 * - Loaned-out players with 1 year left return as DEFINITIVO; 2-year loans stay loaned out with 1 year left.
 * - Definitive user players whose contract dropped to 0 become Free Agents (guarded against leaving <16 players or 0 GKs).
 * - Resets contractRenewalStatus to 'PENDENTE' for players entering the new season.
 */
export function processSeasonEndContracts(params: {
  userSquad: Player[];
  aiSquads: Record<string, Player[]>;
  loanedOutPlayers: Player[];
  freeAgents: Player[];
  clubs: Club[];
  userClubId: string;
  nextYear: number;
}): {
  updatedUserSquad: Player[];
  updatedAiSquads: Record<string, Player[]>;
  updatedLoanedOut: Player[];
  updatedFreeAgents: Player[];
  expiredDefinitiveNames: string[];
  expiredLoanInNames: string[];
  returnedLoanOutNames: string[];
  continuingLoanNames: string[];
} {
  const {
    userSquad,
    aiSquads,
    loanedOutPlayers,
    freeAgents,
    nextYear,
  } = params;

  const expiredDefinitiveNames: string[] = [];
  const expiredLoanInNames: string[] = [];
  const returnedLoanOutNames: string[] = [];
  const continuingLoanNames: string[] = [];
  const newlyFreeAgents: Player[] = [];

  // 1. Loaned-out players: decrement loan duration
  const remainingLoanedOut: Player[] = [];
  const returnedFromLoan: Player[] = [];

  for (const p of loanedOutPlayers) {
    const rem = getPlayerContractRemainingYears(p) - 1;
    if (rem <= 0) {
      returnedLoanOutNames.push(p.name);
      const nextClubRem = 2; // returning club players keep healthy 2-yr base or saved post-loan contract
      returnedFromLoan.push({
        ...p,
        contractType: 'DEFINITIVO',
        wageSharePaid: 1,
        loanDestinationClubName: undefined,
        loanDurationYears: undefined,
        contractYearsRemaining: nextClubRem,
        contractEndYear: nextYear + nextClubRem - 1,
        contractRenewalStatus: 'PENDENTE',
      });
    } else {
      remainingLoanedOut.push({
        ...p,
        contractYearsRemaining: rem,
        contractEndYear: nextYear + rem - 1,
      });
    }
  }

  // 2. Process user squad contracts (loaned-in & definitive)
  const keptUserSquad: Player[] = [];
  // Keep count of GKs & total players to prevent softlock if user forgot all renewals
  const definitiveCandidates = [...userSquad, ...returnedFromLoan];
  let projectedSquadSize =
    definitiveCandidates.filter(
      (p) => p.contractType !== 'EMPRESTADO' && getPlayerContractRemainingYears(p) - 1 > 0
    ).length +
    userSquad.filter(
      (p) => p.contractType === 'EMPRESTADO' && getPlayerContractRemainingYears(p) - 1 > 0
    ).length;

  let projectedGkCount = definitiveCandidates.filter(
    (p) =>
      p.position === 'GOL' &&
      p.contractType !== 'EMPRESTADO' &&
      getPlayerContractRemainingYears(p) - 1 > 0
  ).length;

  for (const p of userSquad) {
    const currentRem = getPlayerContractRemainingYears(p);
    const nextRem = currentRem - 1;

    if (p.contractType === 'EMPRESTADO') {
      if (nextRem <= 0) {
        expiredLoanInNames.push(p.name);
        continue; // loan ended cleanly
      }
      continuingLoanNames.push(p.name);
      keptUserSquad.push({
        ...p,
        contractYearsRemaining: nextRem,
        contractEndYear: nextYear + nextRem - 1,
      });
      continue;
    }

    if (nextRem <= 0) {
      const userExplicitlyDeclinedRenewal =
        p.contractRenewalStatus === 'RECUSADO';
      const mustProtectMinSquad =
        (p.position === 'GOL' && projectedGkCount < 1) ||
        (!userExplicitlyDeclinedRenewal && projectedSquadSize < 16);
      if (mustProtectMinSquad) {
        // Emergency automatic 1-year board extension to keep legal minimum match squad
        projectedSquadSize += 1;
        if (p.position === 'GOL') projectedGkCount += 1;
        keptUserSquad.push({
          ...p,
          contractYearsRemaining: 1,
          contractEndYear: nextYear,
          contractRenewalStatus: 'PENDENTE',
        });
      } else {
        expiredDefinitiveNames.push(p.name);
        newlyFreeAgents.push({
          ...p,
          isStarter: false,
          slotIndex: null,
          contractType: 'DEFINITIVO',
          contractYearsRemaining: 1,
          contractEndYear: nextYear,
          contractRenewalStatus: 'PENDENTE',
          isTransferListed: false,
          isLoanListed: false,
          marketListingReason: undefined,
        });
      }
      continue;
    }

    keptUserSquad.push({
      ...p,
      contractYearsRemaining: nextRem,
      contractEndYear: nextYear + nextRem - 1,
      // Keep explicit non-renewal decision if the player had 2 years and now enters his final contract year
      contractRenewalStatus:
        p.contractRenewalStatus === 'RECUSADO' ? 'RECUSADO' : 'PENDENTE',
    });
  }

  const updatedUserSquad = [...keptUserSquad, ...returnedFromLoan];

  // 3. AI squads: decrement contract years, automatically renew key AI players when needed
  const updatedAiSquads: Record<string, Player[]> = {};
  for (const [cid, list] of Object.entries(aiSquads)) {
    updatedAiSquads[cid] = list.map((p) => {
      const nextRem = getPlayerContractRemainingYears(p) - 1;
      if (nextRem <= 0) {
        const autoRenewYears = p.age >= 32 ? 1 : 2;
        return {
          ...p,
          contractYearsRemaining: autoRenewYears,
          contractEndYear: nextYear + autoRenewYears - 1,
          contractRenewalStatus: 'PENDENTE',
        };
      }
      return {
        ...p,
        contractYearsRemaining: nextRem,
        contractEndYear: nextYear + nextRem - 1,
        contractRenewalStatus: 'PENDENTE',
      };
    });
  }

  // Deduplicate newly added free agents + cap list cleanly
  const existingFreeIds = new Set(freeAgents.map((f) => f.id));
  const updatedFreeAgents = [
    ...newlyFreeAgents.filter((f) => !existingFreeIds.has(f.id)),
    ...freeAgents,
  ].slice(0, 60);

  return {
    updatedUserSquad,
    updatedAiSquads,
    updatedLoanedOut: remainingLoanedOut,
    updatedFreeAgents,
    expiredDefinitiveNames,
    expiredLoanInNames,
    returnedLoanOutNames,
    continuingLoanNames,
  };
}
