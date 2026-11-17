import { getRealSquadForClub } from '../data/initialDatabase';
import { calculatePlayerOverall } from './playerOverall';
import { assignPotentialStars } from './economyAndEvolution';
import { MIN_GOALKEEPERS, MIN_SQUAD_SIZE } from './transferEngine';
import { formatCalendarDate, formatCompactBRL } from '../utils/formatters';
import {
  Club,
  InboxMessage,
  IncomingTransferOffer,
  Player,
  PositionSector,
  TransferRecord,
} from '../types/football';

export function buildInitialAiSquads(
  clubs: Club[],
  userClubId: string
): Record<string, Player[]> {
  const map: Record<string, Player[]> = {};
  for (const club of clubs) {
    if (club.id === userClubId) continue;
    map[club.id] = getRealSquadForClub(club);
  }
  return map;
}

function recalculateClubSectorRatings(
  club: Club,
  squad: Player[]
): Pick<Club, 'overallAttack' | 'overallMidfield' | 'overallDefense'> {
  const starters = squad.filter((p) => p.isStarter);
  const pool = starters.length >= 11 ? starters : squad.slice(0, 11);
  const avgSec = (sectors: PositionSector[], fallback: number) => {
    const list = pool.filter((p) => sectors.includes(p.sector));
    if (list.length === 0) return fallback;
    const sum = list.reduce(
      (acc, p) => acc + calculatePlayerOverall(p.attributes, p.position),
      0
    );
    return Math.min(99, Math.max(60, Math.round(sum / list.length)));
  };
  return {
    overallAttack: avgSec(['ATA'], club.overallAttack),
    overallMidfield: avgSec(['MEI'], club.overallMidfield),
    overallDefense: avgSec(['GOL', 'DEF'], club.overallDefense),
  };
}

function findWeakestSector(squad: Player[]): PositionSector {
  const sectors: PositionSector[] = ['DEF', 'MEI', 'ATA', 'GOL'];
  let weakest: PositionSector = 'ATA';
  let lowestScore = 999;

  for (const sec of sectors) {
    const list = squad.filter((p) => p.sector === sec);
    if (list.length === 0) return sec;
    const bestOvr = Math.max(
      ...list.map((p) => calculatePlayerOverall(p.attributes, p.position))
    );
    const depthBonus = list.length >= 4 ? 1.5 : list.length <= 2 ? -2.5 : 0;
    const score = bestOvr + depthBonus;
    if (score < lowestScore) {
      lowestScore = score;
      weakest = sec;
    }
  }
  return weakest;
}

/**
 * Simulates autonomous AI-to-AI transfers (purchases and loans) based on cash balance,
 * wage budget, club reputation, and positional squad needs.
 */
export function simulateAiTransferWindowTick(params: {
  clubs: Club[];
  aiSquads: Record<string, Player[]>;
  userClubId: string;
  dayOffset: number;
  seasonYear: number;
  maxDeals?: number;
  rng?: () => number;
}): {
  updatedClubs: Club[];
  updatedAiSquads: Record<string, Player[]>;
  newRecords: TransferRecord[];
} {
  const {
    clubs,
    aiSquads,
    userClubId,
    dayOffset,
    seasonYear,
    maxDeals = 2,
    rng = Math.random,
  } = params;

  const workingClubs = clubs.map((c) => ({ ...c }));
  const workingSquads: Record<string, Player[]> = {};
  for (const [cid, list] of Object.entries(aiSquads)) {
    workingSquads[cid] = list.map((p) => ({ ...p }));
  }

  const newRecords: TransferRecord[] = [];
  const aiClubIndices = workingClubs
    .map((c, idx) => ({ club: c, idx }))
    .filter((item) => item.club.id !== userClubId && workingSquads[item.club.id]?.length >= 16);

  if (aiClubIndices.length < 2) {
    return {
      updatedClubs: workingClubs,
      updatedAiSquads: workingSquads,
      newRecords,
    };
  }

  const dateLabel = formatCalendarDate(dayOffset, seasonYear);

  for (let d = 0; d < maxDeals; d++) {
    // Pick a buying club with healthy cash and wage budget headroom
    const buyers = aiClubIndices.filter((item) => {
      if (item.club.cashBalance < 4_500_000) return false;
      const sq = workingSquads[item.club.id];
      if (sq.length >= 27) return false;
      const payroll = sq.reduce((s, p) => s + p.salary, 0);
      return item.club.wageBudget - payroll >= 100_000;
    });
    if (buyers.length === 0) break;

    const buyerPick = buyers[Math.floor(rng() * buyers.length)];
    const buyer = buyerPick.club;
    const buyerSquad = workingSquads[buyer.id];
    const buyerPayroll = buyerSquad.reduce((s, p) => s + p.salary, 0);
    const remainingWageRoom = buyer.wageBudget - buyerPayroll;
    if (remainingWageRoom < 100_000) continue;

    const neededSector = findWeakestSector(buyerSquad);

    // Pick candidate sellers
    const candidateSellers = aiClubIndices.filter(
      (item) =>
        item.club.id !== buyer.id &&
        workingSquads[item.club.id].length > MIN_SQUAD_SIZE + 1 &&
        item.club.reputation <= buyer.reputation + 5
    );
    if (candidateSellers.length === 0) continue;

    const sellerPick =
      candidateSellers[Math.floor(rng() * candidateSellers.length)];
    const seller = sellerPick.club;
    const sellerSquad = workingSquads[seller.id];

    // Prefer non-starters or players in buyer's needed sector that buyer can afford
    const candidates = sellerSquad
      .filter((p) => {
        if (p.position === 'GOL') {
          const gks = sellerSquad.filter((x) => x.position === 'GOL').length;
          if (gks <= MIN_GOALKEEPERS + 1) return false;
        }
        return p.sector === neededSector || !p.isStarter;
      })
      .map((p) => ({
        player: p,
        ovr: calculatePlayerOverall(p.attributes, p.position),
      }))
      .filter(
        ({ player, ovr }) =>
          ovr >= 66 &&
          player.salary <= remainingWageRoom * 1.1 &&
          player.marketValue * 1.05 <= buyer.cashBalance * 0.55
      );

    if (candidates.length === 0) continue;

    const chosen = candidates[Math.floor(rng() * Math.min(4, candidates.length))];
    const targetPlayer = chosen.player;
    const isLoan =
      (targetPlayer.age <= 23 || !targetPlayer.isStarter) && rng() < 0.34;

    const fee = isLoan
      ? Math.max(250_000, Math.round((targetPlayer.marketValue * 0.12) / 50_000) * 50_000)
      : Math.max(600_000, Math.round((targetPlayer.marketValue * (0.95 + rng() * 0.2)) / 100_000) * 100_000);

    if (buyer.cashBalance < fee) continue;

    // Move player from sellerSquad to buyerSquad
    workingSquads[seller.id] = sellerSquad.filter(
      (p) => p.id !== targetPlayer.id
    );

    const nextShirtNumber =
      Math.max(22, ...buyerSquad.map((p) => p.number)) + 1;
    const movedPlayer: Player = {
      ...targetPlayer,
      number: nextShirtNumber,
      isStarter: false,
      slotIndex: null,
      contractType: isLoan ? 'EMPRESTADO' : 'DEFINITIVO',
      loanOriginClubId: isLoan ? seller.id : undefined,
      loanOriginClubName: isLoan ? seller.shortName : undefined,
      wageSharePaid: isLoan ? 0.85 : 1,
    };

    // Promote seller replacement if starter left
    if (targetPlayer.isStarter && targetPlayer.slotIndex !== null) {
      const replacement = workingSquads[seller.id].find(
        (p) => !p.isStarter && p.sector === targetPlayer.sector
      ) || workingSquads[seller.id].find((p) => !p.isStarter);
      if (replacement) {
        workingSquads[seller.id] = workingSquads[seller.id].map((p) =>
          p.id === replacement.id
            ? {
                ...p,
                isStarter: true,
                slotIndex: targetPlayer.slotIndex,
              }
            : p
        );
      }
    }

    workingSquads[buyer.id] = [...buyerSquad, movedPlayer];

    const buyerRatings = recalculateClubSectorRatings(
      buyer,
      workingSquads[buyer.id]
    );
    const sellerRatings = recalculateClubSectorRatings(
      seller,
      workingSquads[seller.id]
    );

    workingClubs[buyerPick.idx] = {
      ...buyer,
      cashBalance: buyer.cashBalance - fee,
      ...buyerRatings,
    };
    workingClubs[sellerPick.idx] = {
      ...seller,
      cashBalance: seller.cashBalance + fee,
      ...sellerRatings,
    };

    newRecords.push({
      id: `ai-tr-${seasonYear}-${dayOffset}-${d}-${targetPlayer.id}`,
      date: dateLabel,
      type: isLoan ? 'EMPRESTIMO_IN' : 'COMPRA',
      status: 'CONCLUIDA',
      playerName: targetPlayer.name,
      position: targetPlayer.position,
      ovr: chosen.ovr,
      counterpartyClubName: `${seller.shortName} → ${buyer.shortName}`,
      feeAmount: fee,
      monthlySalaryImpact: targetPlayer.salary,
      note: isLoan
        ? `Empréstimo de ${seller.shortName} para ${buyer.shortName}.`
        : `Transferência entre clubes da liga (${seller.shortName} → ${buyer.shortName}).`,
      isAiTransfer: true,
      fromClubName: seller.shortName,
      toClubName: buyer.shortName,
      dealType: isLoan ? 'EMPRESTIMO' : 'COMPRA',
    });
  }

  return {
    updatedClubs: workingClubs,
    updatedAiSquads: workingSquads,
    newRecords,
  };
}

/**
 * Generates realistic official purchase or loan offers from AI clubs for standout,
 * young high-potential, or in-form players in the user's squad.
 */
export function maybeGenerateIncomingOfferForUser(params: {
  clubs: Club[];
  userClub: Club;
  userSquad: Player[];
  pendingOffers: IncomingTransferOffer[];
  dayOffset: number;
  seasonYear: number;
  rng?: () => number;
}): IncomingTransferOffer | null {
  const {
    clubs,
    userClub,
    userSquad,
    pendingOffers,
    dayOffset,
    seasonYear,
    rng = Math.random,
  } = params;

  const activePending = pendingOffers.filter(
    (o) => o.status === 'PENDING' && o.expiresDayOffset >= dayOffset
  );
  if (activePending.length >= 3) return null;
  if (userSquad.length <= MIN_SQUAD_SIZE) return null;

  const pendingPlayerIds = new Set(activePending.map((o) => o.playerId));
  const gkCount = userSquad.filter((p) => p.position === 'GOL').length;

  const candidates = userSquad
    .filter((p) => {
      if (p.contractType === 'EMPRESTADO') return false;
      if (pendingPlayerIds.has(p.id)) return false;
      if (p.position === 'GOL' && gkCount <= MIN_GOALKEEPERS) return false;
      return true;
    })
    .map((p) => {
      const ovr = calculatePlayerOverall(p.attributes, p.position);
      const stars =
        p.potentialStars ??
        assignPotentialStars(ovr, p.age, userClub.reputation, p.id);
      const formBoost =
        p.seasonStats.matches >= 4 && p.seasonStats.avgRating >= 7.1 ? 6 : 0;
      const youthBoost = p.age <= 22 && stars >= 4 ? 5 : 0;
      const interestScore = ovr + formBoost + youthBoost;
      return { player: p, ovr, stars, interestScore };
    })
    .sort((a, b) => b.interestScore - a.interestScore);

  if (candidates.length === 0) return null;

  const topPool = candidates.slice(0, Math.min(8, candidates.length));
  const picked = topPool[Math.floor(rng() * topPool.length)];
  const p = picked.player;

  // Pick a plausible interested AI club with cash
  const interestedClubs = clubs.filter(
    (c) =>
      c.id !== userClub.id &&
      c.cashBalance >= Math.max(3_500_000, p.marketValue * 0.45) &&
      c.reputation >= Math.max(66, picked.ovr - 12)
  );
  if (interestedClubs.length === 0) return null;

  const buyer =
    interestedClubs[Math.floor(rng() * interestedClubs.length)];
  const isLoan =
    (!p.isStarter || p.age <= 22) && rng() < 0.35;

  const rawFee = isLoan
    ? Math.max(300_000, Math.round((p.marketValue * 0.14) / 50_000) * 50_000)
    : Math.min(
        Math.round((buyer.cashBalance * 0.85) / 100_000) * 100_000,
        Math.max(
          900_000,
          Math.round((p.marketValue * (0.95 + rng() * 0.22)) / 250_000) * 250_000
        )
      );

  if (rawFee < 300_000) return null;

  const reasonParts: string[] = [];
  if (p.seasonStats.matches >= 4 && p.seasonStats.avgRating >= 7.0) {
    reasonParts.push(`boa fase (${p.seasonStats.avgRating.toFixed(2)} média)`);
  }
  if (p.age <= 22 && picked.stars >= 4) {
    reasonParts.push(`alto potencial (${picked.stars}★)`);
  }
  if (reasonParts.length === 0) {
    reasonParts.push(`nível OVR ${picked.ovr} no elenco`);
  }

  return {
    id: `offer-${seasonYear}-${dayOffset}-${p.id}-${Math.round(rng() * 9999)}`,
    createdAtDate: formatCalendarDate(dayOffset, seasonYear),
    fromClubId: buyer.id,
    fromClubName: buyer.shortName,
    fromClubAbbr: buyer.abbr,
    fromClubPrimaryColor: buyer.primaryColor,
    fromClubReputation: buyer.reputation,
    playerId: p.id,
    playerName: p.name,
    playerPosition: p.position,
    playerOvr: picked.ovr,
    playerAge: p.age,
    playerPotentialStars: picked.stars,
    dealType: isLoan ? 'LOAN' : 'BUY',
    offeredFee: rawFee,
    wageShareCovered: isLoan ? 0.9 : 1.0,
    expiresDayOffset: dayOffset + 18,
    negotiationStep: 0,
    status: 'PENDING',
    rationale: `${buyer.shortName} busca reforço no setor (${reasonParts.join(' · ')}).`,
  };
}

export function createOfferInboxMessage(
  offer: IncomingTransferOffer,
  userClub: Club
): InboxMessage {
  const dealLabel =
    offer.dealType === 'LOAN' ? 'Proposta de Empréstimo' : 'Proposta Oficial de Compra';
  return {
    id: `msg-offer-${offer.id}`,
    date: `${offer.createdAtDate} · Mercado`,
    sender: offer.fromClubName,
    senderRole: 'Diretoria Executiva',
    subject: `${dealLabel} por ${offer.playerName} (${formatCompactBRL(
      offer.offeredFee
    )})`,
    category: 'Mercado',
    priority: 'positive',
    read: false,
    relatedPlayerId: offer.playerId,
    relatedOfferId: offer.id,
    body: [
      `O ${offer.fromClubName} formalizou uma ${dealLabel.toLowerCase()} por ${offer.playerName} (${offer.playerPosition}, OVR ${offer.playerOvr}) junto ao ${userClub.shortName}.`,
      offer.dealType === 'LOAN'
        ? `Valor oferecido pela cessão: ${formatCompactBRL(
            offer.offeredFee
          )} com cobertura de ${Math.round(
            offer.wageShareCovered * 100
          )}% dos salários.`
        : `Valor oferecido pela transferência definitiva: ${formatCompactBRL(
            offer.offeredFee
          )}.`,
    ],
    bulletPoints: [
      `Atleta: ${offer.playerName} (${offer.playerPosition} · ${offer.playerAge} anos · ${offer.playerPotentialStars}★)`,
      `Motivo do interesse: ${offer.rationale}`,
    ],
    actionLabel: 'Analisar no Mercado',
    actionTargetTab: 'market',
  };
}

export type IncomingOfferAction =
  | 'ACCEPT'
  | 'REJECT'
  | 'COUNTER_15'
  | 'COUNTER_30';

export function resolveIncomingOfferAction(params: {
  offer: IncomingTransferOffer;
  action: IncomingOfferAction;
  userClub: Club;
  userSquad: Player[];
  aiSquads: Record<string, Player[]>;
  loanedOutPlayers: Player[];
  clubs: Club[];
  dayOffset: number;
  seasonYear: number;
  rng?: () => number;
}): {
  outcome: 'ACCEPTED' | 'REJECTED_BY_USER' | 'COUNTER_REJECTED';
  finalFee: number;
  updatedClubs: Club[];
  updatedUserSquad: Player[];
  updatedAiSquads: Record<string, Player[]>;
  updatedLoanedOutPlayers: Player[];
  updatedOffer: IncomingTransferOffer;
  transferRecord: TransferRecord | null;
  promotedStarterName?: string;
} {
  const {
    offer,
    action,
    userClub,
    userSquad,
    aiSquads,
    loanedOutPlayers,
    clubs,
    dayOffset,
    seasonYear,
    rng = Math.random,
  } = params;

  const dateLabel = formatCalendarDate(dayOffset, seasonYear);

  if (action === 'REJECT') {
    return {
      outcome: 'REJECTED_BY_USER',
      finalFee: 0,
      updatedClubs: clubs,
      updatedUserSquad: userSquad,
      updatedAiSquads: aiSquads,
      updatedLoanedOutPlayers: loanedOutPlayers,
      updatedOffer: { ...offer, status: 'REJECTED' },
      transferRecord: null,
    };
  }

  const targetPlayer = userSquad.find((p) => p.id === offer.playerId);
  if (!targetPlayer || userSquad.length <= MIN_SQUAD_SIZE) {
    return {
      outcome: 'REJECTED_BY_USER',
      finalFee: 0,
      updatedClubs: clubs,
      updatedUserSquad: userSquad,
      updatedAiSquads: aiSquads,
      updatedLoanedOutPlayers: loanedOutPlayers,
      updatedOffer: { ...offer, status: 'REJECTED' },
      transferRecord: null,
    };
  }

  const buyerClub = clubs.find((c) => c.id === offer.fromClubId);
  const multiplier =
    action === 'COUNTER_30' ? 1.3 : action === 'COUNTER_15' ? 1.15 : 1.0;
  const requestedFee = Math.round((offer.offeredFee * multiplier) / 50_000) * 50_000;

  if (action === 'COUNTER_15' || action === 'COUNTER_30') {
    const canBuyerPay = buyerClub ? buyerClub.cashBalance >= requestedFee : true;
    const baseAcceptProb = action === 'COUNTER_15' ? 0.68 : 0.42;
    const isAccepted = canBuyerPay && rng() < baseAcceptProb;

    if (!isAccepted) {
      const rejectedRec: TransferRecord = {
        id: `tr-counter-rej-${Date.now()}`,
        date: dateLabel,
        type: offer.dealType === 'LOAN' ? 'EMPRESTIMO_OUT' : 'VENDA',
        status: 'RECUSADA',
        playerName: offer.playerName,
        position: offer.playerPosition,
        ovr: offer.playerOvr,
        counterpartyClubName: offer.fromClubName,
        feeAmount: requestedFee,
        monthlySalaryImpact: 0,
        note: `${offer.fromClubName} não aceitou a contraproposta de ${formatCompactBRL(
          requestedFee
        )}.`,
      };
      return {
        outcome: 'COUNTER_REJECTED',
        finalFee: requestedFee,
        updatedClubs: clubs,
        updatedUserSquad: userSquad,
        updatedAiSquads: aiSquads,
        updatedLoanedOutPlayers: loanedOutPlayers,
        updatedOffer: { ...offer, status: 'REJECTED' },
        transferRecord: rejectedRec,
      };
    }
  }

  // Conclude deal (either direct ACCEPT or AI agreed to COUNTER_15 / COUNTER_30)
  const remainingUserSquad = userSquad.filter((p) => p.id !== targetPlayer.id);
  let promotedStarterName: string | undefined;

  if (targetPlayer.isStarter && targetPlayer.slotIndex !== null) {
    const replacement =
      remainingUserSquad.find(
        (p) => !p.isStarter && !p.injured && p.sector === targetPlayer.sector
      ) || remainingUserSquad.find((p) => !p.isStarter);
    if (replacement) {
      promotedStarterName = replacement.name;
      const idx = remainingUserSquad.findIndex((p) => p.id === replacement.id);
      if (idx !== -1) {
        remainingUserSquad[idx] = {
          ...remainingUserSquad[idx],
          isStarter: true,
          slotIndex: targetPlayer.slotIndex,
          assignedRole: targetPlayer.assignedRole,
          assignedDuty: targetPlayer.assignedDuty,
        };
      }
    }
  }

  const nextAiSquads: Record<string, Player[]> = { ...aiSquads };
  if (offer.dealType === 'BUY' && buyerClub) {
    const buyerList = nextAiSquads[buyerClub.id] || [];
    nextAiSquads[buyerClub.id] = [
      ...buyerList,
      {
        ...targetPlayer,
        isStarter: false,
        slotIndex: null,
        contractType: 'DEFINITIVO',
      },
    ];
  }

  const nextLoanedOut =
    offer.dealType === 'LOAN'
      ? [
          ...loanedOutPlayers,
          {
            ...targetPlayer,
            isStarter: false,
            slotIndex: null,
            contractType: 'EMPRESTADO' as const,
            wageSharePaid: Number((1 - offer.wageShareCovered).toFixed(2)),
            loanDestinationClubName: offer.fromClubName,
          },
        ]
      : loanedOutPlayers;

  const monthlyWageRelief =
    offer.dealType === 'LOAN'
      ? Math.round(targetPlayer.salary * offer.wageShareCovered)
      : targetPlayer.salary;

  const updatedClubs = clubs.map((c) => {
    if (c.id === userClub.id) {
      return { ...c, cashBalance: c.cashBalance + requestedFee };
    }
    if (c.id === offer.fromClubId) {
      return { ...c, cashBalance: Math.max(1_000_000, c.cashBalance - requestedFee) };
    }
    return c;
  });

  const record: TransferRecord = {
    id: `tr-offer-acc-${Date.now()}`,
    date: dateLabel,
    type: offer.dealType === 'LOAN' ? 'EMPRESTIMO_OUT' : 'VENDA',
    status: 'CONCLUIDA',
    playerName: offer.playerName,
    position: offer.playerPosition,
    ovr: offer.playerOvr,
    counterpartyClubName: offer.fromClubName,
    feeAmount: requestedFee,
    monthlySalaryImpact: -monthlyWageRelief,
    note:
      action === 'ACCEPT'
        ? `Proposta aceita de ${offer.fromClubName}.`
        : `Contraproposta (+${action === 'COUNTER_30' ? '30%' : '15%'}) aceita por ${
            offer.fromClubName
          }.`,
  };

  return {
    outcome: 'ACCEPTED',
    finalFee: requestedFee,
    updatedClubs,
    updatedUserSquad: remainingUserSquad,
    updatedAiSquads: nextAiSquads,
    updatedLoanedOutPlayers: nextLoanedOut,
    updatedOffer: {
      ...offer,
      offeredFee: requestedFee,
      status: 'ACCEPTED',
    },
    transferRecord: record,
    promotedStarterName,
  };
}
