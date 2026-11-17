import { getRealSquadForClub } from '../data/initialDatabase';
import {
  getDefaultFormationRoleForPosition,
  getInternationalMarketListings,
} from '../data/transferCatalog';
import { calculatePlayerOverall } from './matchEngine';
import {
  Club,
  MarketClubProfile,
  MarketLeagueScope,
  MarketPlayerListing,
  Player,
  TransferDealMode,
  TransferDifficultyLevel,
  TransferEvaluation,
  TransferOfferTier,
} from '../types/football';

export const MIN_SQUAD_SIZE = 18;
export const MIN_GOALKEEPERS = 1;

export type LoanWageShare = 0.5 | 0.75 | 1.0;

export function getPlayerPaidSalary(player: Player): number {
  const share = player.wageSharePaid ?? 1;
  return Math.round(player.salary * share);
}

export function getEffectivePayroll(
  squad: Player[],
  loanedOutPlayers: Player[] = []
): number {
  const activePayroll = squad.reduce(
    (acc, p) => acc + getPlayerPaidSalary(p),
    0
  );
  const residualLoanedOutPayroll = loanedOutPlayers.reduce(
    (acc, p) => acc + Math.round(p.salary * (p.wageSharePaid ?? 0)),
    0
  );
  return activePayroll + residualLoanedOutPayroll;
}

export function clubToMarketProfile(club: Club): MarketClubProfile {
  const scope: MarketLeagueScope =
    club.division === 'B'
      ? 'SERIE_B'
      : club.division === 'LIB'
      ? 'LIBERTADORES'
      : 'SERIE_A';

  const leagueName =
    scope === 'SERIE_B'
      ? 'Brasileirão Série B'
      : scope === 'LIBERTADORES'
      ? `Libertadores · ${club.country || 'CONMEBOL'}`
      : 'Brasileirão Série A';

  const avgStrength = Math.round(
    (club.overallAttack + club.overallMidfield + club.overallDefense) / 3
  );

  return {
    id: club.id,
    name: club.name,
    shortName: club.shortName,
    abbr: club.abbr,
    country: club.country || 'Brasil',
    leagueName,
    scope,
    primaryColor: club.primaryColor,
    reputation: club.reputation,
    avgStrength,
  };
}

export function buildAllMarketListings(params: {
  clubs: Club[];
  userClubId: string;
  freeAgents: Player[];
  transferredOutClubPlayerIds: string[];
  aiSquads?: Record<string, Player[]>;
}): MarketPlayerListing[] {
  const { clubs, userClubId, freeAgents, transferredOutClubPlayerIds, aiSquads } =
    params;
  const excludedSet = new Set(transferredOutClubPlayerIds);
  const listings: MarketPlayerListing[] = [];

  // 1. Real clubs (Série A, Série B, Libertadores CONMEBOL)
  for (const club of clubs) {
    if (club.id === userClubId) continue;
    const originClub = clubToMarketProfile(club);
    const clubSquad =
      aiSquads && aiSquads[club.id] && aiSquads[club.id].length > 0
        ? aiSquads[club.id]
        : getRealSquadForClub(club);

    for (const player of clubSquad) {
      if (!aiSquads?.[club.id] && excludedSet.has(player.id)) continue;
      const ovr = calculatePlayerOverall(player.attributes, player.position);
      const buyFee =
        Math.round((player.marketValue * (player.isStarter ? 1.15 : 0.95)) / 250000) *
        250000;
      const loanAvailable = !player.isStarter || player.age <= 23 || ovr <= 79;
      const loanRatio = player.isStarter ? 0.22 : player.age <= 22 ? 0.08 : 0.13;
      const loanFee = Math.max(
        150000,
        Math.round((buyFee * loanRatio) / 50000) * 50000
      );

      listings.push({
        player,
        ovr,
        originClub,
        scope: originClub.scope,
        isClubStarter: player.isStarter,
        buyFee: Math.max(500000, buyFee),
        loanFee,
        loanAvailable,
      });
    }
  }

  // 2. International market catalog (Europe, USA, Saudi Arabia)
  for (const intl of getInternationalMarketListings()) {
    if (excludedSet.has(intl.player.id)) continue;
    listings.push(intl);
  }

  // 3. Free agents
  for (const fa of freeAgents) {
    const ovr = calculatePlayerOverall(fa.attributes, fa.position);
    listings.push({
      player: fa,
      ovr,
      originClub: null,
      scope: 'LIVRES',
      isClubStarter: false,
      buyFee: 0,
      loanFee: 0,
      loanAvailable: false,
    });
  }

  return listings;
}

function getLeagueTierWeight(scope: MarketLeagueScope): number {
  switch (scope) {
    case 'SERIE_B':
      return 1.0;
    case 'SERIE_A':
      return 2.0;
    case 'LIBERTADORES':
      return 2.05;
    case 'INTERNACIONAL':
      return 3.1;
    case 'LIVRES':
    default:
      return 1.0;
  }
}

export function getOfferMultiplier(offerTier: TransferOfferTier): number {
  if (offerTier === 'BONUS_15') return 1.15;
  if (offerTier === 'AGRESSIVA_30') return 1.3;
  return 1.0;
}

export function evaluateTransferNegotiation(params: {
  userClub: Club;
  userSquad: Player[];
  loanedOutPlayers?: Player[];
  listing: MarketPlayerListing;
  dealMode: TransferDealMode;
  offerTier?: TransferOfferTier;
  loanWageShare?: LoanWageShare;
}): TransferEvaluation {
  const {
    userClub,
    userSquad,
    loanedOutPlayers = [],
    listing,
    dealMode,
    offerTier = 'PADRAO',
    loanWageShare = 0.75,
  } = params;

  const userProfile = clubToMarketProfile(userClub);
  const starters = userSquad.filter((p) => p.isStarter);
  const starterOvrs = starters.map((p) =>
    calculatePlayerOverall(p.attributes, p.position)
  );
  const userStartersAvgOvr =
    starterOvrs.length > 0
      ? Math.round(
          starterOvrs.reduce((acc, v) => acc + v, 0) / starterOvrs.length
        )
      : 74;

  const sectorPlayers = userSquad.filter(
    (p) => p.sector === listing.player.sector
  );
  const sectorBestOvr =
    sectorPlayers.length > 0
      ? Math.max(
          ...sectorPlayers.map((p) =>
            calculatePlayerOverall(p.attributes, p.position)
          )
        )
      : userStartersAvgOvr;

  const playerDeltaVsTeam = listing.ovr - userStartersAvgOvr;
  const playerDeltaVsSector = listing.ovr - sectorBestOvr;

  const playerGapNote =
    playerDeltaVsSector >= 3
      ? `OVR ${listing.ovr} é +${playerDeltaVsSector} acima do seu melhor ${listing.player.sector} (${sectorBestOvr}) — chega como referência técnica.`
      : playerDeltaVsTeam >= 2
      ? `OVR ${listing.ovr} supera sua média titular (${userStartersAvgOvr}) e reforça o time principal.`
      : playerDeltaVsTeam <= -3
      ? `OVR ${listing.ovr} fica abaixo da sua média titular (${userStartersAvgOvr}) — opção para composição de elenco.`
      : `OVR ${listing.ovr} em patamar equivalente ao seu grupo titular (${userStartersAvgOvr}).`;

  const offerMult = getOfferMultiplier(offerTier);
  const offerBoost =
    offerTier === 'AGRESSIVA_30' ? 28 : offerTier === 'BONUS_15' ? 14 : 0;

  let resistance = 25;
  let clubGapNote = '';
  let effectiveFee = 0;
  let effectiveSalary = listing.player.salary;

  if (listing.scope === 'LIVRES' || dealMode === 'FREE') {
    const clubPowerExpectation = userClub.reputation >= 80 ? -10 : userClub.division === 'B' ? 12 : 0;
    resistance = Math.round(
      18 +
        clubPowerExpectation +
        Math.max(-6, playerDeltaVsTeam * 2.2) -
        offerBoost * 0.85
    );
    effectiveFee = 0;
    effectiveSalary = Math.round((listing.player.salary * offerMult) / 5000) * 5000;
    clubGapNote = `Atleta sem vínculo contratual (passe livre); decisão depende do salário ofertado e vitrine do ${userClub.shortName}.`;
  } else {
    const seller = listing.originClub!;
    const repDiff = seller.reputation - userProfile.reputation;
    const tierDiff =
      getLeagueTierWeight(seller.scope) - getLeagueTierWeight(userProfile.scope);

    if (repDiff >= 8) {
      clubGapNote = `${seller.shortName} (${seller.reputation} rep.) está ${repDiff} pts acima do ${userClub.shortName} (${userClub.reputation}) — resistência elevada na mesa.`;
    } else if (repDiff <= -8) {
      clubGapNote = `${userClub.shortName} (${userClub.reputation} rep.) possui +${Math.abs(repDiff)} pts de prestígio sobre o ${seller.shortName} — alto poder de atração.`;
    } else {
      clubGapNote = `${seller.shortName} (${seller.reputation} rep.) e ${userClub.shortName} (${userClub.reputation}) têm porte esportivo próximo.`;
    }

    if (dealMode === 'LOAN') {
      effectiveFee = Math.round((listing.loanFee * offerMult) / 50000) * 50000;
      effectiveSalary = Math.round((listing.player.salary * loanWageShare) / 5000) * 5000;

      const starterPenalty = listing.isClubStarter ? 24 : -12;
      const prospectDiscount = !listing.isClubStarter && repDiff > 0 ? -10 : 0;
      const wageCoverDiscount =
        loanWageShare === 1 ? 15 : loanWageShare === 0.75 ? 7 : 0;
      const availabilityPenalty = listing.loanAvailable ? 0 : 22;

      resistance = Math.round(
        24 +
          repDiff * 0.65 +
          Math.max(0, tierDiff) * 7 +
          starterPenalty +
          prospectDiscount +
          availabilityPenalty +
          Math.max(-8, playerDeltaVsTeam * 1.45) -
          wageCoverDiscount -
          offerBoost * 0.85
      );
    } else {
      effectiveFee = Math.round((listing.buyFee * offerMult) / 250000) * 250000;
      effectiveSalary = listing.player.salary;

      const starterPenalty = listing.isClubStarter ? 15 : -8;
      resistance = Math.round(
        30 +
          repDiff * 1.45 +
          tierDiff * 10 +
          starterPenalty +
          Math.max(-10, playerDeltaVsTeam * 2.1) -
          offerBoost
      );
    }
  }

  const clampedResistance = Math.max(5, Math.min(98, resistance));
  const level: TransferDifficultyLevel =
    clampedResistance <= 30
      ? 'Fácil'
      : clampedResistance <= 55
      ? 'Moderada'
      : clampedResistance <= 75
      ? 'Difícil'
      : 'Muito Difícil';

  const acceptanceChance = Math.max(
    8,
    Math.min(98, Math.round(112 - clampedResistance * 1.1))
  );

  const currentPayroll = getEffectivePayroll(userSquad, loanedOutPlayers);
  const projectedCash = userClub.cashBalance - effectiveFee;
  const projectedPayroll = currentPayroll + effectiveSalary;
  const projectedWagePct = Math.round(
    (projectedPayroll / Math.max(1, userClub.wageBudget)) * 100
  );

  const canAffordCash = effectiveFee <= userClub.cashBalance;
  const fitsWageBudget = projectedPayroll <= userClub.wageBudget;
  const isBlocked = !canAffordCash || !fitsWageBudget;

  let blockReason: string | null = null;
  if (!canAffordCash && !fitsWageBudget) {
    blockReason =
      'Saldo em caixa e teto salarial insuficientes para fechar esta operação.';
  } else if (!canAffordCash) {
    blockReason =
      'Saldo em caixa insuficiente. Venda atletas ou tente empréstimo com taxa menor.';
  } else if (!fitsWageBudget) {
    blockReason =
      'A contratação ultrapassa o teto da folha salarial mensal. Venda ou empreste atletas para liberar orçamento.';
  }

  return {
    level,
    resistanceScore: clampedResistance,
    acceptanceChance,
    clubGapNote,
    playerGapNote,
    effectiveFee,
    effectiveSalary,
    projectedCash,
    projectedPayroll,
    projectedWagePct,
    canAffordCash,
    fitsWageBudget,
    isBlocked,
    blockReason,
  };
}

function pickAvailableJerseyNumber(squad: Player[], preferred: number): number {
  const used = new Set(squad.map((p) => p.number));
  if (!used.has(preferred) && preferred >= 1 && preferred <= 99) {
    return preferred;
  }
  for (let n = 12; n <= 99; n++) {
    if (!used.has(n)) return n;
  }
  return preferred;
}

export function executeIncomingTransfer(params: {
  userClub: Club;
  userSquad: Player[];
  freeAgents: Player[];
  transferredOutClubPlayerIds: string[];
  listing: MarketPlayerListing;
  dealMode: TransferDealMode;
  evaluation: TransferEvaluation;
  loanWageShare?: LoanWageShare;
  rng?: () => number;
}): {
  accepted: boolean;
  roll: number;
  updatedClub: Club;
  updatedSquad: Player[];
  updatedFreeAgents: Player[];
  updatedTransferredOutIds: string[];
  signedPlayer: Player | null;
} {
  const {
    userClub,
    userSquad,
    freeAgents,
    transferredOutClubPlayerIds,
    listing,
    dealMode,
    evaluation,
    loanWageShare = 0.75,
    rng = Math.random,
  } = params;

  if (evaluation.isBlocked) {
    return {
      accepted: false,
      roll: 100,
      updatedClub: userClub,
      updatedSquad: userSquad,
      updatedFreeAgents: freeAgents,
      updatedTransferredOutIds: transferredOutClubPlayerIds,
      signedPlayer: null,
    };
  }

  const roll = Math.round(rng() * 100);
  const accepted =
    evaluation.acceptanceChance >= 95 || roll <= evaluation.acceptanceChance;

  if (!accepted) {
    return {
      accepted: false,
      roll,
      updatedClub: userClub,
      updatedSquad: userSquad,
      updatedFreeAgents: freeAgents,
      updatedTransferredOutIds: transferredOutClubPlayerIds,
      signedPlayer: null,
    };
  }

  const roleDefaults = getDefaultFormationRoleForPosition(listing.player.position);
  const jerseyNumber = pickAvailableJerseyNumber(userSquad, listing.player.number);
  const isLoan = dealMode === 'LOAN';

  const signedPlayer: Player = {
    ...listing.player,
    id: `${userClub.id}-signed-${listing.player.id}`,
    number: jerseyNumber,
    isStarter: false,
    slotIndex: null,
    assignedRole: listing.player.assignedRole || roleDefaults.roleId,
    assignedDuty: listing.player.assignedDuty || roleDefaults.duty,
    salary: listing.player.salary,
    condition: Math.max(88, listing.player.condition),
    morale: 'Muito Alta',
    contractType: isLoan ? 'EMPRESTADO' : 'DEFINITIVO',
    loanOriginClubId: isLoan ? listing.originClub?.id : undefined,
    loanOriginClubName: isLoan ? listing.originClub?.shortName : undefined,
    wageSharePaid: isLoan ? loanWageShare : 1,
    purchaseOptionFee: isLoan ? listing.buyFee : undefined,
  };

  // Free agents pay boosted salary if user increased offer tier
  if (dealMode === 'FREE') {
    signedPlayer.salary = evaluation.effectiveSalary;
  }

  const updatedClub: Club = {
    ...userClub,
    cashBalance: Math.max(0, userClub.cashBalance - evaluation.effectiveFee),
  };

  const updatedSquad = [...userSquad, signedPlayer];

  const updatedFreeAgents =
    listing.scope === 'LIVRES'
      ? freeAgents.filter((f) => f.id !== listing.player.id)
      : freeAgents;

  const updatedTransferredOutIds =
    listing.scope !== 'LIVRES'
      ? [...transferredOutClubPlayerIds, listing.player.id]
      : transferredOutClubPlayerIds;

  return {
    accepted: true,
    roll,
    updatedClub,
    updatedSquad,
    updatedFreeAgents,
    updatedTransferredOutIds,
    signedPlayer,
  };
}

export interface OutgoingEvaluation {
  canSell: boolean;
  canLoanOut: boolean;
  canReturnLoan: boolean;
  blockReason: string | null;
  saleValue: number;
  loanOutFee: number;
  loanOutResidualShare: number;
  monthlyWageSavedOnSale: number;
  monthlyWageSavedOnLoan: number;
}

export function evaluateOutgoingPlayer(
  player: Player,
  userSquad: Player[]
): OutgoingEvaluation {
  const ovr = calculatePlayerOverall(player.attributes, player.position);
  const gkCount = userSquad.filter((p) => p.position === 'GOL').length;
  const isLastGk = player.position === 'GOL' && gkCount <= MIN_GOALKEEPERS;
  const belowMinSize = userSquad.length <= MIN_SQUAD_SIZE;
  const isLoanedIn = player.contractType === 'EMPRESTADO';

  let blockReason: string | null = null;
  if (belowMinSize) {
    blockReason = `Elenco no limite mínimo (${MIN_SQUAD_SIZE} atletas). Contrate antes de liberar.`;
  } else if (isLastGk) {
    blockReason = 'Não é possível negociar o único goleiro do elenco.';
  } else if (isLoanedIn) {
    blockReason =
      'Atleta emprestado de outro clube — não pode ser vendido, apenas devolvido.';
  }

  const saleValue = Math.max(
    500000,
    Math.round((player.marketValue * (ovr >= 82 ? 1.05 : 0.92)) / 250000) * 250000
  );
  const loanOutFee = Math.max(
    100000,
    Math.round((player.marketValue * 0.08) / 50000) * 50000
  );
  const loanOutResidualShare = 0.1; // Partner club pays 90% of salary
  const paidCurrently = getPlayerPaidSalary(player);

  return {
    canSell: !belowMinSize && !isLastGk && !isLoanedIn,
    canLoanOut: !belowMinSize && !isLastGk && !isLoanedIn,
    canReturnLoan: isLoanedIn && !belowMinSize && !isLastGk,
    blockReason,
    saleValue,
    loanOutFee,
    loanOutResidualShare,
    monthlyWageSavedOnSale: paidCurrently,
    monthlyWageSavedOnLoan: Math.round(paidCurrently * (1 - loanOutResidualShare)),
  };
}

export function executeOutgoingTransfer(params: {
  userClub: Club;
  userSquad: Player[];
  loanedOutPlayers: Player[];
  player: Player;
  action: 'VENDA' | 'EMPRESTIMO_OUT' | 'DEVOLVER_EMPRESTIMO';
  destinationClubName?: string;
}): {
  success: boolean;
  updatedClub: Club;
  updatedSquad: Player[];
  updatedLoanedOutPlayers: Player[];
  feeReceived: number;
  monthlyWageRelief: number;
  promotedStarterName: string | null;
} {
  const {
    userClub,
    userSquad,
    loanedOutPlayers,
    player,
    action,
    destinationClubName = 'Clube Parceiro',
  } = params;

  const evalOut = evaluateOutgoingPlayer(player, userSquad);
  if (
    (action === 'VENDA' && !evalOut.canSell) ||
    (action === 'EMPRESTIMO_OUT' && !evalOut.canLoanOut) ||
    (action === 'DEVOLVER_EMPRESTIMO' && !evalOut.canReturnLoan)
  ) {
    return {
      success: false,
      updatedClub: userClub,
      updatedSquad: userSquad,
      updatedLoanedOutPlayers: loanedOutPlayers,
      feeReceived: 0,
      monthlyWageRelief: 0,
      promotedStarterName: null,
    };
  }

  let remainingSquad = userSquad.filter((p) => p.id !== player.id);
  let promotedStarterName: string | null = null;

  // If outgoing player was a starter, auto-promote best reserve (same position/sector first)
  if (player.isStarter && player.slotIndex !== null) {
    const candidates = remainingSquad
      .filter((p) => !p.isStarter)
      .sort((a, b) => {
        const aFit =
          a.position === player.position ? 2 : a.sector === player.sector ? 1 : 0;
        const bFit =
          b.position === player.position ? 2 : b.sector === player.sector ? 1 : 0;
        if (aFit !== bFit) return bFit - aFit;
        return (
          calculatePlayerOverall(b.attributes, b.position) -
          calculatePlayerOverall(a.attributes, a.position)
        );
      });

    if (candidates[0]) {
      const replacement = candidates[0];
      promotedStarterName = replacement.name;
      remainingSquad = remainingSquad.map((p) =>
        p.id === replacement.id
          ? {
              ...p,
              isStarter: true,
              slotIndex: player.slotIndex,
              assignedRole: player.assignedRole,
              assignedDuty: player.assignedDuty,
            }
          : p
      );
    }
  }

  const feeReceived =
    action === 'VENDA'
      ? evalOut.saleValue
      : action === 'EMPRESTIMO_OUT'
      ? evalOut.loanOutFee
      : 0;

  const monthlyWageRelief =
    action === 'EMPRESTIMO_OUT'
      ? evalOut.monthlyWageSavedOnLoan
      : evalOut.monthlyWageSavedOnSale;

  const updatedClub: Club = {
    ...userClub,
    cashBalance: userClub.cashBalance + feeReceived,
  };

  const updatedLoanedOutPlayers =
    action === 'EMPRESTIMO_OUT'
      ? [
          ...loanedOutPlayers,
          {
            ...player,
            isStarter: false,
            slotIndex: null,
            contractType: 'EMPRESTADO' as const,
            wageSharePaid: evalOut.loanOutResidualShare,
            loanDestinationClubName: destinationClubName,
          },
        ]
      : loanedOutPlayers;

  return {
    success: true,
    updatedClub,
    updatedSquad: remainingSquad,
    updatedLoanedOutPlayers,
    feeReceived,
    monthlyWageRelief,
    promotedStarterName,
  };
}
