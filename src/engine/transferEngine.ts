import { getRealSquadForClub } from '../data/initialDatabase';
import {
  getDefaultFormationRoleForPosition,
  getInternationalMarketListings,
} from '../data/transferCatalog';
import { evaluateAiClubSquadAndListings } from './aiMarketEngine';
import { calculatePlayerOverall } from './matchEngine';
import {
  Club,
  MarketClubProfile,
  MarketLeagueScope,
  MarketPlayerListing,
  Player,
  PlayerNegotiationState,
  TransferCounterOffer,
  TransferDealMode,
  TransferDifficultyLevel,
  TransferEvaluation,
  TransferOfferTier,
  TransferOutcomeStatus,
} from '../types/football';
import { formatCalendarDate } from '../utils/formatters';

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
      : club.division === 'UCL' || club.division === 'WORLD'
      ? 'INTERNACIONAL'
      : 'SERIE_A';

  const leagueName =
    scope === 'SERIE_B'
      ? 'Brasileirão Série B'
      : scope === 'LIBERTADORES'
      ? `Libertadores · ${club.country || 'CONMEBOL'}`
      : club.division === 'UCL'
      ? `Champions League · ${club.country || 'Europa'}`
      : club.division === 'WORLD'
      ? `Mundial · ${club.country || 'Internacional'}`
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
    const rawSquad =
      aiSquads && aiSquads[club.id] && aiSquads[club.id].length > 0
        ? aiSquads[club.id]
        : getRealSquadForClub(club);

    // Ensure opponent clubs always evaluate their transfer/loan listings and positional needs
    const hasExistingListings = rawSquad.some(
      (p) => p.isTransferListed || p.isLoanListed
    );
    const clubSquad = hasExistingListings
      ? rawSquad
      : evaluateAiClubSquadAndListings(club, rawSquad);

    for (const player of clubSquad) {
      if (!aiSquads?.[club.id] && excludedSet.has(player.id)) continue;
      const ovr = calculatePlayerOverall(player.attributes, player.position);
      const isTransferListed = Boolean(player.isTransferListed);
      const isLoanListed = !player.isStarter && Boolean(player.isLoanListed);

      const buyMultiplier = isTransferListed
        ? 0.85
        : player.isStarter
        ? 1.15
        : 0.96;
      const buyFee =
        Math.round((player.marketValue * buyMultiplier) / 250000) * 250000;

      const loanAvailable = !player.isStarter && isLoanListed;
      const loanRatio = isLoanListed
        ? 0.06
        : player.isStarter
        ? 0.22
        : player.age <= 22
        ? 0.08
        : 0.13;
      const loanFee = Math.max(
        100000,
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
        isTransferListed,
        isLoanListed,
        listingReason: player.marketListingReason,
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
      isTransferListed: false,
      isLoanListed: false,
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

export const MIN_OFFER_MULTIPLIER = 0.5;
export const MAX_OFFER_MULTIPLIER = 1.5;
export const NEGOTIATION_LOCK_DAYS = 365;

export function clampOfferMultiplier(multiplier: number): number {
  if (!Number.isFinite(multiplier)) return 1.0;
  return Math.max(
    MIN_OFFER_MULTIPLIER,
    Math.min(MAX_OFFER_MULTIPLIER, Math.round(multiplier * 100) / 100)
  );
}

export function getOfferMultiplier(offerTier: TransferOfferTier): number {
  if (offerTier === 'BONUS_15') return 1.15;
  if (offerTier === 'AGRESSIVA_30') return 1.3;
  if (offerTier === 'FORTE_50') return 1.5;
  return 1.0;
}

export function getOfferTierFromMultiplier(multiplier: number): TransferOfferTier {
  if (multiplier >= 1.45) return 'FORTE_50';
  if (multiplier >= 1.25) return 'AGRESSIVA_30';
  if (multiplier >= 1.1) return 'BONUS_15';
  return 'PADRAO';
}

export function getOfferBoostForMultiplier(offerMult: number): number {
  const clamped = clampOfferMultiplier(offerMult);
  if (clamped >= 1.0) {
    const delta = clamped - 1.0;
    if (delta <= 0.3) {
      return Math.round(delta * (28 / 0.3));
    }
    return Math.round(28 + (delta - 0.3) * (12 / 0.2));
  }
  const discount = 1.0 - clamped;
  return -Math.round(discount * 95 + discount * discount * 95);
}

export function getAbsoluteCareerDay(
  seasonYear: number,
  dayOffset: number
): number {
  return seasonYear * 365 + dayOffset;
}

export function rollPlayerNegotiationMaxAttempts(
  player: Player,
  listing?: MarketPlayerListing,
  rng: () => number = Math.random
): 2 | 3 | 4 {
  const r = Math.max(0, Math.min(0.999999, rng()));
  const isListed = Boolean(
    listing?.isTransferListed ||
      listing?.isLoanListed ||
      player.isTransferListed ||
      player.isLoanListed
  );
  const isAmbitiousStar =
    player.age <= 25 && (player.potentialStars ?? 3) >= 4;

  // Always strictly between 2 and 4 attempts
  if (isListed) {
    if (r < 0.2) return 2;
    if (r < 0.65) return 3;
    return 4;
  }
  if (isAmbitiousStar) {
    if (r < 0.45) return 2;
    if (r < 0.85) return 3;
    return 4;
  }
  if (r < 0.3) return 2;
  if (r < 0.72) return 3;
  return 4;
}

export interface PlayerNegotiationBlockInfo {
  isBlocked: boolean;
  remainingDays: number;
  blockedUntilDateLabel?: string;
  blockedReason?: string;
  activeAttemptsCount: number;
  maxAttempts?: number;
}

export function getPlayerNegotiationBlockInfo(
  state: PlayerNegotiationState | undefined,
  seasonYear: number,
  dayOffset: number
): PlayerNegotiationBlockInfo {
  if (!state) {
    return {
      isBlocked: false,
      remainingDays: 0,
      activeAttemptsCount: 0,
    };
  }
  const currentAbsDay = getAbsoluteCareerDay(seasonYear, dayOffset);

  if (
    state.blockedUntilAbsDay !== null &&
    currentAbsDay < state.blockedUntilAbsDay
  ) {
    return {
      isBlocked: true,
      remainingDays: state.blockedUntilAbsDay - currentAbsDay,
      blockedUntilDateLabel: state.blockedUntilDateLabel,
      blockedReason: state.blockedReason,
      activeAttemptsCount: state.attemptsCount,
      maxAttempts: state.maxAttempts,
    };
  }

  // Expired block or stale attempt cycle (> 1 year without activity) resets cleanly
  if (
    state.blockedUntilAbsDay !== null ||
    currentAbsDay - state.lastAttemptAbsDay >= NEGOTIATION_LOCK_DAYS
  ) {
    return {
      isBlocked: false,
      remainingDays: 0,
      activeAttemptsCount: 0,
    };
  }

  return {
    isBlocked: false,
    remainingDays: 0,
    activeAttemptsCount: state.attemptsCount,
    maxAttempts: state.maxAttempts,
  };
}

export function recordTransferNegotiationAttempt(params: {
  states: Record<string, PlayerNegotiationState>;
  player: Player;
  listing?: MarketPlayerListing;
  outcome: TransferOutcomeStatus;
  seasonYear: number;
  dayOffset: number;
  rng?: () => number;
}): {
  nextStates: Record<string, PlayerNegotiationState>;
  playerState: PlayerNegotiationState | null;
  justBlocked: boolean;
  blockedUntilDateLabel?: string;
} {
  const {
    states,
    player,
    listing,
    outcome,
    seasonYear,
    dayOffset,
    rng = Math.random,
  } = params;

  const nextStates: Record<string, PlayerNegotiationState> = { ...states };

  if (outcome === 'ACEITA') {
    delete nextStates[player.id];
    return {
      nextStates,
      playerState: null,
      justBlocked: false,
    };
  }

  const currentAbsDay = getAbsoluteCareerDay(seasonYear, dayOffset);
  const existing = states[player.id];
  const existingInfo = getPlayerNegotiationBlockInfo(
    existing,
    seasonYear,
    dayOffset
  );

  const maxAttempts =
    existing && existingInfo.activeAttemptsCount > 0 && !existingInfo.isBlocked
      ? existing.maxAttempts
      : rollPlayerNegotiationMaxAttempts(player, listing, rng);

  const attemptsCount = existingInfo.activeAttemptsCount + 1;
  const justBlocked = attemptsCount >= maxAttempts;
  const blockedUntilAbsDay = justBlocked
    ? currentAbsDay + NEGOTIATION_LOCK_DAYS
    : null;
  const blockedUntilDateLabel = justBlocked
    ? formatCalendarDate(dayOffset, seasonYear + 1)
    : undefined;
  const blockedReason = justBlocked
    ? `Após ${attemptsCount} propostas sem acerto, ${player.name} encerrou as negociações por 1 ano.`
    : undefined;

  const playerState: PlayerNegotiationState = {
    playerId: player.id,
    attemptsCount,
    maxAttempts,
    blockedUntilAbsDay,
    blockedUntilDateLabel,
    blockedReason,
    lastAttemptAbsDay: currentAbsDay,
  };

  nextStates[player.id] = playerState;

  return {
    nextStates,
    playerState,
    justBlocked,
    blockedUntilDateLabel,
  };
}

export function getPlayerPotentialCeiling(player: Player, ovr: number): number {
  if (typeof player.dynamicCeilingOvr === 'number') {
    return Math.max(ovr, player.dynamicCeilingOvr);
  }
  if (typeof player.basePotentialOvr === 'number') {
    return Math.max(ovr, player.basePotentialOvr);
  }
  const stars = player.potentialStars ?? 3;
  const starDelta = Math.round((stars - 2.5) * 4);
  return Math.min(96, Math.max(ovr, ovr + Math.max(0, starDelta)));
}

export function evaluateTransferNegotiation(params: {
  userClub: Club;
  userSquad: Player[];
  loanedOutPlayers?: Player[];
  listing: MarketPlayerListing;
  dealMode: TransferDealMode;
  offerTier?: TransferOfferTier;
  offerMultiplier?: number;
  salaryOfferMult?: number;
  loanWageShare?: LoanWageShare;
  loanDurationYears?: 1 | 2;
  contractYears?: 2 | 3 | 4;
}): TransferEvaluation {
  const {
    userClub,
    userSquad,
    loanedOutPlayers = [],
    listing,
    dealMode,
    offerTier = 'PADRAO',
    offerMultiplier,
    salaryOfferMult = 1.0,
    loanWageShare = 0.75,
    loanDurationYears = 1,
    contractYears = 3,
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

  const offerMult = clampOfferMultiplier(
    offerMultiplier !== undefined
      ? offerMultiplier
      : getOfferMultiplier(offerTier)
  );
  const offerBoost = getOfferBoostForMultiplier(offerMult);
  const salaryBoostRelief = Math.round(Math.max(0, salaryOfferMult - 1) * 65);

  const p = listing.player;
  const potentialCeiling = getPlayerPotentialCeiling(p, listing.ovr);
  const growthRoom = Math.max(0, potentialCeiling - listing.ovr);
  const isHighPotentialYoung =
    p.age <= 24 &&
    (growthRoom >= 3 ||
      (p.potentialStars ?? 3) >= 3.5 ||
      listing.ovr >= 76);
  const isVeteran = p.age >= 29;
  const isSeniorVeteran = p.age >= 32;

  const expectedFreeRep = Math.min(
    92,
    Math.max(58, Math.round(52 + (listing.ovr - 62) * 1.35))
  );
  const repDiffForPlayer = listing.originClub
    ? listing.originClub.reputation - userProfile.reputation
    : expectedFreeRep - userProfile.reputation;

  const isWeakerClub =
    repDiffForPlayer >= 6 ||
    (userClub.division === 'B' && listing.ovr >= 75) ||
    (playerDeltaVsTeam >= 4 && repDiffForPlayer >= 0);

  let playerResistance = 15;
  let playerAmbitionNote = '';
  let willHardRejectByPlayer = false;

  if (isHighPotentialYoung) {
    if (isWeakerClub) {
      if (
        dealMode === 'LOAN' &&
        listing.isLoanListed &&
        repDiffForPlayer < 16 &&
        playerDeltaVsTeam < 6
      ) {
        playerResistance += Math.max(
          0,
          Math.round(repDiffForPlayer * 0.65 + growthRoom * 1.3 - 6)
        );
        playerAmbitionNote = `Aos ${p.age} anos (potencial ${potentialCeiling}), vê o empréstimo ao ${userClub.shortName} como chance de minutos — mas quer titularidade garantida.`;
      } else {
        const divisionGapPenalty =
          userClub.division === 'B' && listing.ovr >= 75 ? 16 : 0;
        const loanWeakDivisionPenalty =
          dealMode === 'LOAN' && !listing.isLoanListed ? 10 : 0;
        playerResistance += Math.round(
          Math.max(0, repDiffForPlayer) * 1.45 +
            Math.max(0, playerDeltaVsTeam) * 3.6 +
            growthRoom * 2.4 +
            divisionGapPenalty +
            loanWeakDivisionPenalty
        );
        playerAmbitionNote = `Aos ${p.age} anos (OVR ${listing.ovr}, potencial ${potentialCeiling}), busca clube do seu nível ou maior para continuar evoluindo — forte tendência a recusar times mais fracos.`;
      }
    } else {
      playerResistance -= 8;
      playerAmbitionNote = `Aos ${p.age} anos (potencial ${potentialCeiling}), o projeto do ${userClub.shortName} agrada e favorece sua evolução.`;
    }
  } else if (isVeteran) {
    const ageReceptivity = isSeniorVeteran ? 24 : 13;
    const weakerPenalty = isWeakerClub
      ? Math.round(
          Math.max(0, repDiffForPlayer) * 0.3 +
            Math.max(0, playerDeltaVsTeam) * 0.7
        )
      : -4;
    playerResistance += weakerPenalty - ageReceptivity;
    playerAmbitionNote = isWeakerClub
      ? `Aos ${p.age} anos (experiente), está muito mais receptivo a defender clubes menores em busca de minutos e contrato seguro.`
      : `Aos ${p.age} anos (experiente), vê com bons olhos o contrato e a estabilidade no ${userClub.shortName}.`;
  } else {
    const weakerPenalty = isWeakerClub
      ? Math.round(
          Math.max(0, repDiffForPlayer) * 0.85 +
            Math.max(0, playerDeltaVsTeam) * 2.0
        )
      : -4;
    playerResistance += weakerPenalty;
    playerAmbitionNote = isWeakerClub
      ? `Aos ${p.age} anos (auge técnico, OVR ${listing.ovr}), hesita em descer de patamar — salário reforçado influencia bastante.`
      : `Aos ${p.age} anos (auge técnico, OVR ${listing.ovr}), enxerga equilíbrio competitivo no elenco do ${userClub.shortName}.`;
  }

  playerResistance -= salaryBoostRelief + Math.round(offerBoost * 0.25);
  const clampedPlayerResistance = Math.max(4, Math.min(96, playerResistance));
  const playerWillingnessChance = Math.max(
    5,
    Math.min(97, Math.round(108 - clampedPlayerResistance * 1.05))
  );

  if (
    isHighPotentialYoung &&
    isWeakerClub &&
    !(
      dealMode === 'LOAN' &&
      listing.isLoanListed &&
      repDiffForPlayer < 16 &&
      playerDeltaVsTeam < 6
    ) &&
    (repDiffForPlayer >= 11 ||
      playerDeltaVsTeam >= 5 ||
      (userClub.division === 'B' && listing.ovr >= 77)) &&
    playerWillingnessChance <= 34
  ) {
    willHardRejectByPlayer = true;
  }

  let resistance = 25;
  let clubGapNote = '';
  let effectiveFee = 0;
  let effectiveSalary = p.salary;

  if (listing.scope === 'LIVRES' || dealMode === 'FREE') {
    const clubPowerExpectation =
      userClub.reputation >= 80 ? -10 : userClub.division === 'B' ? 12 : 0;
    const effectiveFreeMult =
      offerMult < 1.0
        ? offerMult * salaryOfferMult
        : Math.max(offerMult, salaryOfferMult);
    resistance = Math.round(
      18 +
        clubPowerExpectation +
        Math.max(-6, playerDeltaVsTeam * 2.0) +
        (clampedPlayerResistance - 25) * 0.45 -
        offerBoost * 0.85 -
        salaryBoostRelief * 0.7
    );
    effectiveFee = 0;
    effectiveSalary = Math.max(
      25000,
      Math.round((p.salary * effectiveFreeMult) / 5000) * 5000
    );
    clubGapNote = `Atleta sem vínculo contratual (passe livre); decisão depende do salário ofertado, ambição de evolução e vitrine do ${userClub.shortName}.`;
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

    const playerAmbitionOffset = isHighPotentialYoung && isWeakerClub
      ? Math.round(Math.max(0, clampedPlayerResistance - 28) * 0.55)
      : isVeteran
      ? isSeniorVeteran
        ? -14
        : -8
      : Math.round((clampedPlayerResistance - 25) * 0.2);

    if (dealMode === 'LOAN') {
      const durationFeeMult = loanDurationYears === 2 ? 1.55 : 1.0;
      effectiveFee = Math.max(
        50000,
        Math.round((listing.loanFee * offerMult * durationFeeMult) / 50000) *
          50000
      );
      effectiveSalary =
        Math.round((p.salary * loanWageShare * salaryOfferMult) / 5000) * 5000;

      const starterPenalty = listing.isClubStarter ? 24 : -12;
      const prospectDiscount = !listing.isClubStarter && repDiff > 0 ? -10 : 0;
      const wageCoverDiscount =
        loanWageShare === 1 ? 15 : loanWageShare === 0.75 ? 7 : 0;
      const availabilityPenalty = listing.loanAvailable ? 0 : 22;
      const clubListedLoanBonus = listing.isLoanListed
        ? 22
        : listing.isTransferListed
        ? 8
        : 0;
      const durationResistance = loanDurationYears === 2 ? 6 : 0;

      if (listing.isLoanListed) {
        clubGapNote += ` O ${seller.shortName} colocou o atleta na LISTA DE EMPRÉSTIMO (${listing.listingReason || 'Ganhar rodagem'}) — liberação facilitada.`;
      }

      resistance = Math.round(
        24 +
          repDiff * 0.65 +
          Math.max(0, tierDiff) * 7 +
          starterPenalty +
          prospectDiscount +
          availabilityPenalty +
          durationResistance +
          Math.max(-8, playerDeltaVsTeam * 1.45) +
          playerAmbitionOffset -
          wageCoverDiscount -
          clubListedLoanBonus -
          offerBoost * 0.85 -
          salaryBoostRelief * 0.5
      );
    } else {
      effectiveFee = Math.max(
        250000,
        Math.round((listing.buyFee * offerMult) / 250000) * 250000
      );
      effectiveSalary = Math.round((p.salary * salaryOfferMult) / 5000) * 5000;

      const starterPenalty = listing.isClubStarter ? 15 : -8;
      const clubListedBuyBonus = listing.isTransferListed ? 20 : 0;

      if (listing.isTransferListed) {
        clubGapNote += ` O ${seller.shortName} colocou o atleta DISPONÍVEL PARA COMPRA (${listing.listingReason || 'Disponível no mercado'}) — pedida com desconto e menor resistência.`;
      }

      const contractDurationFactor = contractYears === 4 ? 3 : contractYears === 2 ? -2 : 0;
      resistance = Math.round(
        30 +
          repDiff * 1.45 +
          tierDiff * 10 +
          starterPenalty +
          contractDurationFactor +
          Math.max(-10, playerDeltaVsTeam * 2.1) +
          playerAmbitionOffset -
          clubListedBuyBonus -
          offerBoost -
          salaryBoostRelief * 0.45
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

  const minChanceFloor = offerMult < 1.0 ? 2 : 6;
  let acceptanceChance = Math.max(
    minChanceFloor,
    Math.min(98, Math.round(112 - clampedResistance * 1.1))
  );

  if (willHardRejectByPlayer) {
    acceptanceChance = Math.min(
      acceptanceChance,
      Math.max(minChanceFloor, Math.round(playerWillingnessChance * 0.55))
    );
  }

  const offerDeltaPct = Math.round((offerMult - 1) * 100);
  const moneyInfluenceParts: string[] = [];
  if (offerDeltaPct > 0) {
    moneyInfluenceParts.push(`+${offerDeltaPct}% na taxa/luvas`);
  } else if (offerDeltaPct < 0) {
    moneyInfluenceParts.push(`${offerDeltaPct}% abaixo do valor pedido`);
  }
  if (salaryOfferMult > 1.0) {
    moneyInfluenceParts.push(
      `+${Math.round((salaryOfferMult - 1) * 100)}% no salário do atleta`
    );
  }
  const moneyInfluenceNote =
    offerDeltaPct < 0
      ? `Oferta ${Math.abs(offerDeltaPct)}% abaixo do valor pedido${salaryOfferMult > 1.0 ? ` (com +${Math.round((salaryOfferMult - 1) * 100)}% no salário)` : ''} — aumenta a resistência e reduz a chance de contratação.`
      : moneyInfluenceParts.length > 0
      ? `Pacote reforçado (${moneyInfluenceParts.join(' e ')}) reduz a resistência na negociação.`
      : 'Valores no padrão de mercado — você pode barganhar abaixo ou subir a barra para melhorar o aceite.';

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
    playerWillingnessChance,
    playerAmbitionNote,
    moneyInfluenceNote,
    willHardRejectByPlayer,
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

function finalizeSignedPlayer(params: {
  userClub: Club;
  userSquad: Player[];
  freeAgents: Player[];
  transferredOutClubPlayerIds: string[];
  listing: MarketPlayerListing;
  dealMode: TransferDealMode;
  feePaid: number;
  agreedMonthlySalary: number;
  loanWageShare: LoanWageShare;
  loanDurationYears?: 1 | 2;
  contractYears?: 2 | 3 | 4;
  seasonYear?: number;
}): {
  updatedClub: Club;
  updatedSquad: Player[];
  updatedFreeAgents: Player[];
  updatedTransferredOutIds: string[];
  signedPlayer: Player;
} {
  const {
    userClub,
    userSquad,
    freeAgents,
    transferredOutClubPlayerIds,
    listing,
    dealMode,
    feePaid,
    agreedMonthlySalary,
    loanWageShare,
    loanDurationYears = 1,
    contractYears = 3,
    seasonYear = 2026,
  } = params;

  const roleDefaults = getDefaultFormationRoleForPosition(
    listing.player.position
  );
  const jerseyNumber = pickAvailableJerseyNumber(
    userSquad,
    listing.player.number
  );
  const isLoan = dealMode === 'LOAN';
  const durationRemaining = isLoan ? loanDurationYears : contractYears;

  const normalizedBaseSalary = isLoan
    ? Math.max(
        listing.player.salary,
        Math.round(agreedMonthlySalary / Math.max(0.5, loanWageShare) / 5000) *
          5000
      )
    : agreedMonthlySalary;

  const signedPlayer: Player = {
    ...listing.player,
    id: `${userClub.id}-signed-${listing.player.id}`,
    number: jerseyNumber,
    isStarter: false,
    slotIndex: null,
    assignedRole: listing.player.assignedRole || roleDefaults.roleId,
    assignedDuty: listing.player.assignedDuty || roleDefaults.duty,
    salary: normalizedBaseSalary,
    condition: Math.max(88, listing.player.condition),
    morale: 'Muito Alta',
    contractType: isLoan ? 'EMPRESTADO' : 'DEFINITIVO',
    contractYearsRemaining: durationRemaining,
    contractEndYear: seasonYear + durationRemaining - 1,
    loanDurationYears: isLoan ? loanDurationYears : undefined,
    contractRenewalStatus: 'PENDENTE',
    loanOriginClubId: isLoan ? listing.originClub?.id : undefined,
    loanOriginClubName: isLoan ? listing.originClub?.shortName : undefined,
    wageSharePaid: isLoan ? loanWageShare : 1,
    purchaseOptionFee: isLoan ? listing.buyFee : undefined,
    isTransferListed: false,
    isLoanListed: false,
    marketListingReason: undefined,
  };

  const updatedClub: Club = {
    ...userClub,
    cashBalance: Math.max(0, userClub.cashBalance - feePaid),
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
    updatedClub,
    updatedSquad,
    updatedFreeAgents,
    updatedTransferredOutIds,
    signedPlayer,
  };
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
  loanDurationYears?: 1 | 2;
  contractYears?: 2 | 3 | 4;
  seasonYear?: number;
  rng?: () => number;
}): {
  accepted: boolean;
  outcome: TransferOutcomeStatus;
  rejectedBy?: 'CLUBE' | 'JOGADOR' | 'ORCAMENTO';
  headline: string;
  summary: string;
  factors: string[];
  counterOffer?: TransferCounterOffer;
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
    loanDurationYears = 1,
    contractYears = 3,
    seasonYear = 2026,
    rng = Math.random,
  } = params;

  const p = listing.player;
  const counterpartyName = listing.originClub?.shortName || 'Passe Livre';
  const baseFactors = [
    `Atleta: ${p.age} anos · OVR ${listing.ovr} (${p.position})`,
    evaluation.playerAmbitionNote,
    evaluation.moneyInfluenceNote,
  ];

  if (evaluation.isBlocked) {
    return {
      accepted: false,
      outcome: 'RECUSADA',
      rejectedBy: 'ORCAMENTO',
      headline: `Operação bloqueada para ${p.name}`,
      summary:
        evaluation.blockReason ||
        'Saldo em caixa ou teto salarial mensal insuficiente.',
      factors: baseFactors,
      roll: 100,
      updatedClub: userClub,
      updatedSquad: userSquad,
      updatedFreeAgents: freeAgents,
      updatedTransferredOutIds: transferredOutClubPlayerIds,
      signedPlayer: null,
    };
  }

  const roll = Math.round(rng() * 100);

  // Hard rejection check when young high-potential/OVR prospect refuses weaker club
  if (evaluation.willHardRejectByPlayer && roll > evaluation.acceptanceChance) {
    if (
      evaluation.playerWillingnessChance >= 20 &&
      roll <= evaluation.acceptanceChance + 18
    ) {
      const counterSalary = Math.max(
        evaluation.effectiveSalary + 15000,
        Math.round((evaluation.effectiveSalary * 1.28) / 5000) * 5000
      );
      return {
        accepted: false,
        outcome: 'CONTRAPROPOSTA',
        headline: `${p.name} fez uma contraproposta salarial`,
        summary: `O estafe de ${p.name} (${p.age} anos, OVR ${listing.ovr}) hesita pela diferença de patamar para o ${userClub.shortName}, mas aceita fechar se o salário mensal subir.`,
        factors: [
          ...baseFactors,
          `Vontade do atleta atual: ${evaluation.playerWillingnessChance}% (precisa de compensação financeira)`,
        ],
        counterOffer: {
          source: 'JOGADOR',
          counterFee: evaluation.effectiveFee,
          counterSalary,
          counterLoanWageShare: dealMode === 'LOAN' ? loanWageShare : undefined,
          summary:
            'O estafe do atleta pede aumento salarial para compensar o risco esportivo.',
        },
        roll,
        updatedClub: userClub,
        updatedSquad: userSquad,
        updatedFreeAgents: freeAgents,
        updatedTransferredOutIds: transferredOutClubPlayerIds,
        signedPlayer: null,
      };
    }

    return {
      accepted: false,
      outcome: 'RECUSADA',
      rejectedBy: 'JOGADOR',
      headline: `${p.name} recusou atuar no ${userClub.shortName}`,
      summary:
        dealMode === 'LOAN'
          ? `${p.name} (${p.age} anos, OVR ${listing.ovr}) rejeitou o empréstimo por entender que o clube é mais fraco no momento e pode travar sua evolução.`
          : `${p.name} (${p.age} anos, OVR ${listing.ovr}) recusou a transferência: busca um clube mais forte compatível com sua expectativa de crescimento.`,
      factors: [
        ...baseFactors,
        `Vontade do atleta: ${evaluation.playerWillingnessChance}% · Chance geral: ${evaluation.acceptanceChance}%`,
      ],
      roll,
      updatedClub: userClub,
      updatedSquad: userSquad,
      updatedFreeAgents: freeAgents,
      updatedTransferredOutIds: transferredOutClubPlayerIds,
      signedPlayer: null,
    };
  }

  const accepted =
    evaluation.acceptanceChance >= 95 || roll <= evaluation.acceptanceChance;

  if (accepted) {
    const finalized = finalizeSignedPlayer({
      userClub,
      userSquad,
      freeAgents,
      transferredOutClubPlayerIds,
      listing,
      dealMode,
      feePaid: evaluation.effectiveFee,
      agreedMonthlySalary: evaluation.effectiveSalary,
      loanWageShare,
      loanDurationYears,
      contractYears,
      seasonYear,
    });

    const durationLabel =
      dealMode === 'LOAN'
        ? `${loanDurationYears} ${loanDurationYears === 1 ? 'temporada' : 'temporadas'}`
        : `${contractYears} anos`;

    return {
      accepted: true,
      outcome: 'ACEITA',
      headline:
        dealMode === 'LOAN'
          ? `Empréstimo fechado! ${p.name} é do ${userClub.shortName}`
          : dealMode === 'FREE'
          ? `Contrato assinado! ${p.name} chega sem custos`
          : `Contratação concluída! ${p.name} acertou com o ${userClub.shortName}`,
      summary:
        dealMode === 'LOAN'
          ? `${counterpartyName} e ${p.name} aceitaram o empréstimo de ${durationLabel} (${Math.round(loanWageShare * 100)}% do salário).`
          : dealMode === 'FREE'
          ? `${p.name} aceitou o projeto esportivo, salário proposto e vínculo de ${durationLabel}.`
          : `${counterpartyName} aceitou a compra e ${p.name} assinou contrato de ${durationLabel}.`,
      factors: [
        ...baseFactors,
        `Duração acordada: ${durationLabel} (até fim de ${seasonYear + (dealMode === 'LOAN' ? loanDurationYears : contractYears) - 1})`,
        `Probabilidade na mesa: ${evaluation.acceptanceChance}% (Dificuldade ${evaluation.level})`,
      ],
      roll,
      ...finalized,
    };
  }

  // Counter-offer window: when roll falls within +30 pts above acceptanceChance
  const counterBandCeiling = Math.min(94, evaluation.acceptanceChance + 30);
  if (roll <= counterBandCeiling) {
    const playerBlockedMore =
      dealMode === 'FREE' || evaluation.playerWillingnessChance < 55;
    const clubBlockedMore =
      dealMode !== 'FREE' && evaluation.playerWillingnessChance >= 55;
    const source: TransferCounterOffer['source'] =
      dealMode === 'FREE'
        ? 'JOGADOR'
        : playerBlockedMore && clubBlockedMore
        ? 'AMBOS'
        : playerBlockedMore && evaluation.resistanceScore >= 55
        ? 'AMBOS'
        : playerBlockedMore
        ? 'JOGADOR'
        : 'CLUBE';

    let counterFee = evaluation.effectiveFee;
    let counterSalary = evaluation.effectiveSalary;
    let counterLoanWageShare: LoanWageShare | undefined =
      dealMode === 'LOAN' ? loanWageShare : undefined;

    if (dealMode === 'FREE') {
      counterFee = 0;
      const baseExpectedSalary = Math.max(evaluation.effectiveSalary, p.salary);
      counterSalary = Math.max(
        baseExpectedSalary + 10000,
        Math.round((baseExpectedSalary * 1.18) / 5000) * 5000
      );
    } else if (dealMode === 'LOAN') {
      if (loanWageShare < 1.0) {
        counterLoanWageShare = loanWageShare === 0.5 ? 0.75 : 1.0;
      }
      const durationFeeMult = loanDurationYears === 2 ? 1.55 : 1.0;
      const askingLoanFee =
        Math.round((listing.loanFee * durationFeeMult) / 50000) * 50000;
      const feeBase = Math.max(evaluation.effectiveFee, askingLoanFee);
      counterFee =
        source === 'JOGADOR'
          ? Math.max(evaluation.effectiveFee, askingLoanFee)
          : feeBase > 0
          ? Math.round((feeBase * 1.15) / 50000) * 50000
          : 250_000;
      const shareToUse = counterLoanWageShare ?? loanWageShare;
      const salaryBump = source === 'CLUBE' ? 1.0 : 1.2;
      counterSalary = Math.max(
        evaluation.effectiveSalary + (source === 'CLUBE' ? 0 : 10000),
        Math.round(
          (p.salary * shareToUse * Math.max(1.0, salaryBump)) / 5000
        ) * 5000
      );
    } else {
      const minClubCounterFee =
        Math.round((listing.buyFee * 0.95) / 250_000) * 250_000;
      counterFee =
        source === 'JOGADOR'
          ? Math.max(evaluation.effectiveFee, minClubCounterFee)
          : Math.max(
              minClubCounterFee,
              evaluation.effectiveFee + 250_000,
              Math.round((evaluation.effectiveFee * 1.2) / 250_000) * 250_000
            );
      counterSalary =
        source === 'CLUBE'
          ? evaluation.effectiveSalary
          : Math.max(
              evaluation.effectiveSalary + 15000,
              Math.round((evaluation.effectiveSalary * 1.22) / 5000) * 5000
            );
    }

    const summary =
      source === 'CLUBE'
        ? `${counterpartyName} respondeu com uma contraproposta: exige ajuste nos valores de liberação para fechar agora.`
        : source === 'JOGADOR'
        ? `${p.name} aceitou conversar, mas o estafe pediu salário mensal maior para assinar com o ${userClub.shortName}.`
        : `${counterpartyName} e ${p.name} enviaram contraproposta combinada (ajuste na taxa e no salário mensal).`;

    return {
      accepted: false,
      outcome: 'CONTRAPROPOSTA',
      headline: `Contraproposta recebida por ${p.name}`,
      summary,
      factors: [
        ...baseFactors,
        `Negociação próxima do aceite (${evaluation.acceptanceChance}% de chance inicial)`,
      ],
      counterOffer: {
        source,
        counterFee,
        counterSalary,
        counterLoanWageShare,
        summary,
      },
      roll,
      updatedClub: userClub,
      updatedSquad: userSquad,
      updatedFreeAgents: freeAgents,
      updatedTransferredOutIds: transferredOutClubPlayerIds,
      signedPlayer: null,
    };
  }

  const rejectedByPlayer =
    dealMode === 'FREE' || evaluation.playerWillingnessChance < 48;

  return {
    accepted: false,
    outcome: 'RECUSADA',
    rejectedBy: rejectedByPlayer ? 'JOGADOR' : 'CLUBE',
    headline: rejectedByPlayer
      ? `${p.name} recusou a proposta do ${userClub.shortName}`
      : `${counterpartyName} recusou a proposta por ${p.name}`,
    summary: rejectedByPlayer
      ? `${p.name} (${p.age} anos, OVR ${listing.ovr}) não se convenceu com o projeto esportivo ou os valores apresentados.`
      : `${counterpartyName} considerou a oferta insuficiente para liberar ${p.name} nesta janela.`,
    factors: [
      ...baseFactors,
      `Probabilidade calculada: ${evaluation.acceptanceChance}% · Vontade do atleta: ${evaluation.playerWillingnessChance}%`,
    ],
    roll,
    updatedClub: userClub,
    updatedSquad: userSquad,
    updatedFreeAgents: freeAgents,
    updatedTransferredOutIds: transferredOutClubPlayerIds,
    signedPlayer: null,
  };
}

export function acceptTransferCounterOffer(params: {
  userClub: Club;
  userSquad: Player[];
  loanedOutPlayers?: Player[];
  freeAgents: Player[];
  transferredOutClubPlayerIds: string[];
  listing: MarketPlayerListing;
  dealMode: TransferDealMode;
  counterOffer: TransferCounterOffer;
  loanWageShare?: LoanWageShare;
  loanDurationYears?: 1 | 2;
  contractYears?: 2 | 3 | 4;
  seasonYear?: number;
}): {
  accepted: boolean;
  blockReason?: string;
  updatedClub: Club;
  updatedSquad: Player[];
  updatedFreeAgents: Player[];
  updatedTransferredOutIds: string[];
  signedPlayer: Player | null;
} {
  const {
    userClub,
    userSquad,
    loanedOutPlayers = [],
    freeAgents,
    transferredOutClubPlayerIds,
    listing,
    dealMode,
    counterOffer,
    loanWageShare = 0.75,
    loanDurationYears = 1,
    contractYears = 3,
    seasonYear = 2026,
  } = params;

  const currentPayroll = getEffectivePayroll(userSquad, loanedOutPlayers);
  const canAffordCash = counterOffer.counterFee <= userClub.cashBalance;
  const fitsWageBudget =
    currentPayroll + counterOffer.counterSalary <= userClub.wageBudget;

  if (!canAffordCash || !fitsWageBudget) {
    return {
      accepted: false,
      blockReason: !canAffordCash
        ? 'Saldo em caixa insuficiente para cobrir a contraproposta.'
        : 'A contraproposta salarial ultrapassa o teto mensal da folha.',
      updatedClub: userClub,
      updatedSquad: userSquad,
      updatedFreeAgents: freeAgents,
      updatedTransferredOutIds: transferredOutClubPlayerIds,
      signedPlayer: null,
    };
  }

  const effectiveShare = counterOffer.counterLoanWageShare ?? loanWageShare;
  const finalized = finalizeSignedPlayer({
    userClub,
    userSquad,
    freeAgents,
    transferredOutClubPlayerIds,
    listing,
    dealMode,
    feePaid: counterOffer.counterFee,
    agreedMonthlySalary: counterOffer.counterSalary,
    loanWageShare: effectiveShare,
    loanDurationYears,
    contractYears,
    seasonYear,
  });

  return {
    accepted: true,
    ...finalized,
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

  const saleMultiplier =
    (ovr >= 82 ? 1.05 : 0.92) + (player.isTransferListed ? 0.06 : 0);
  const saleValue = Math.max(
    500000,
    Math.round((player.marketValue * saleMultiplier) / 250000) * 250000
  );
  const loanMultiplier = 0.08 + (player.isLoanListed ? 0.03 : 0);
  const loanOutFee = Math.max(
    100000,
    Math.round((player.marketValue * loanMultiplier) / 50000) * 50000
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
            contractYearsRemaining: 1,
            loanDurationYears: 1 as const,
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

/**
 * Retorna se a janela oficial de transferências está aberta com base no dia do ano (dayOffset):
 * - Janela de Verão (Início de ano): 28 Jan até 07 Março (dayOffset <= 38)
 * - Janela de Inverno (Meio de ano): 01 Julho até 02 Setembro (dayOffset >= 154 && dayOffset <= 217)
 * Fora desses intervalos, a janela está FECHADA (propostas e transferências pausadas).
 */
export function isTransferWindowOpen(dayOffset: number): boolean {
  return dayOffset <= 38 || (dayOffset >= 154 && dayOffset <= 217);
}

export interface TransferWindowStatus {
  isOpen: boolean;
  name: string;
  badgeLabel: string;
  description: string;
  closesInDays?: number;
  opensInDays?: number;
}

export function getTransferWindowStatus(
  dayOffset: number,
  _seasonYear: number = 2026
): TransferWindowStatus {
  if (dayOffset <= 38) {
    const daysLeft = 38 - dayOffset;
    return {
      isOpen: true,
      name: 'Janela de Verão (Início de Temporada)',
      badgeLabel: 'Janela Aberta',
      description: `Aberta até 07 de Março (${daysLeft} dia${daysLeft === 1 ? '' : 's'} restante${daysLeft === 1 ? '' : 's'})`,
      closesInDays: daysLeft,
    };
  }
  if (dayOffset >= 154 && dayOffset <= 217) {
    const daysLeft = 217 - dayOffset;
    return {
      isOpen: true,
      name: 'Janela de Inverno (Meio de Temporada)',
      badgeLabel: 'Janela Aberta',
      description: `Aberta até 02 de Setembro (${daysLeft} dia${daysLeft === 1 ? '' : 's'} restante${daysLeft === 1 ? '' : 's'})`,
      closesInDays: daysLeft,
    };
  }
  if (dayOffset < 154) {
    const daysToOpen = 154 - dayOffset;
    return {
      isOpen: false,
      name: 'Janela Fechada',
      badgeLabel: 'Janela Fechada',
      description: `Transferências pausadas. Reabre em 01 de Julho (${daysToOpen} dia${daysToOpen === 1 ? '' : 's'})`,
      opensInDays: daysToOpen,
    };
  }
  return {
    isOpen: false,
    name: 'Janela Fechada',
    badgeLabel: 'Janela Fechada',
    description: 'Transferências pausadas até a abertura da próxima temporada.',
  };
}
