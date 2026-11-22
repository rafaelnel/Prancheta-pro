import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  Eye,
  X,
  Handshake,
  Globe2,
  UserCheck,
  History,
  Coins,
  TrendingUp,
  SlidersHorizontal,
  RotateCcw,
  Lock,
  Bookmark,
  BookmarkCheck,
  TrendingDown,
  Trash2,
  Star,
} from 'lucide-react';
import { calculatePlayerOverall } from '../engine/matchEngine';
import {
  LoanWageShare,
  MAX_OFFER_MULTIPLIER,
  MIN_OFFER_MULTIPLIER,
  MIN_SQUAD_SIZE,
  buildAllMarketListings,
  evaluateOutgoingPlayer,
  evaluateTransferNegotiation,
  getEffectivePayroll,
  getOfferTierFromMultiplier,
  getPlayerNegotiationBlockInfo,
  getPlayerPaidSalary,
  getTransferWindowStatus,
} from '../engine/transferEngine';
import { getRealSquadForClub } from '../data/initialDatabase';
import {
  IncomingOfferAction,
  analyzeAiClubMarketProfile,
  evaluateAiClubSquadAndListings,
} from '../engine/aiMarketEngine';
import {
  Club,
  IncomingTransferOffer,
  MarketPlayerListing,
  NaturalPosition,
  Player,
  PlayerAttributes,
  PlayerNegotiationState,
  PositionSector,
  TransferAttemptResult,
  TransferDealMode,
  TransferDifficultyLevel,
  TransferOfferTier,
  TransferRecord,
  WatchedPlayerEntry,
} from '../types/football';
import { formatCompactBRL } from '../utils/formatters';
import { CurrencyToggle } from '../utils/CurrencyContext';
import { ClubBadge } from './ClubBadge';
import { StarRating } from './StarRating';
import { PlayerJersey, PlayerOvrBadge } from './PlayerJersey';
import { IncomingOfferCard } from './IncomingOfferCard';
import {
  MarketDealTransitionModal,
  MarketDealTransitionPayload,
} from './MarketDealTransitionModal';

export type MarketFeedback = {
  type: 'success' | 'counter' | 'rejected' | 'error';
  title: string;
  detail: string;
} | null;

interface MarketViewProps {
  userClub: Club;
  clubs: Club[];
  squad: Player[];
  freeAgents: Player[];
  loanedOutPlayers: Player[];
  transferHistory: TransferRecord[];
  transferredOutClubPlayerIds: string[];
  watchedPlayers?: WatchedPlayerEntry[];
  negotiationStates?: Record<string, PlayerNegotiationState>;
  seasonYear?: number;
  dayOffset?: number;
  aiSquads?: Record<string, Player[]>;
  pendingOffers?: IncomingTransferOffer[];
  onResolveIncomingOffer?: (
    offerId: string,
    action: IncomingOfferAction
  ) => void;
  lastFeedback: MarketFeedback;
  onClearFeedback: () => void;
  lastAttemptResult?: TransferAttemptResult | null;
  onClearAttemptResult?: () => void;
  onAcceptCounterOffer?: (attempt: TransferAttemptResult) => void;
  onInspectPlayer: (player: Player, listing?: MarketPlayerListing) => void;
  onToggleWatchPlayer?: (listing: MarketPlayerListing) => void;
  onRemoveWatchedPlayer?: (playerId: string) => void;
  onProposeTransfer: (params: {
    listing: MarketPlayerListing;
    dealMode: TransferDealMode;
    offerTier: TransferOfferTier;
    offerMultiplier?: number;
    salaryOfferMult?: number;
    loanWageShare: LoanWageShare;
    loanDurationYears?: 1 | 2;
    contractYears?: 2 | 3 | 4;
  }) => void;
  onOutgoingTransfer: (params: {
    player: Player;
    action: 'VENDA' | 'EMPRESTIMO_OUT' | 'DEVOLVER_EMPRESTIMO';
  }) => void;
  onTogglePlayerMarketListing?: (
    playerId: string,
    mode: 'TRANSFER' | 'LOAN'
  ) => void;
  onSolicitOfferForPlayer?: (playerId: string) => void;
}

type MarketSubTab =
  | 'NACIONAL_LIB'
  | 'INTERNACIONAL'
  | 'LIVRES'
  | 'EMPRESTIMOS'
  | 'OBSERVADOS'
  | 'MEU_ELENCO'
  | 'HISTORICO';

type WatchlistFilter =
  | 'TODOS'
  | 'VALORIZADOS'
  | 'DESVALORIZADOS'
  | 'MUDANCA_STATUS'
  | 'DISPONIVEIS';
type WatchlistSortKey =
  | 'RECENT'
  | 'VALUE_DELTA_DESC'
  | 'OVR_DELTA_DESC'
  | 'OVR_DESC'
  | 'VALUE_ASC';

type DomesticScopeFilter = 'ALL' | 'SERIE_A' | 'SERIE_B' | 'LIBERTADORES';
type IntlScopeFilter = 'ALL' | 'CHAMPIONS' | 'MUNDIAL_OUTROS';
type ClubListingFilter = 'ALL' | 'LISTED_ANY' | 'LISTED_BUY' | 'LISTED_LOAN';
type PriceRangeFilter =
  | 'ALL'
  | 'FREE_ONLY'
  | 'UP_TO_25M'
  | '25M_TO_80M'
  | '80M_TO_250M'
  | 'OVER_250M';
type AgeRangeFilter = 'ALL' | 'SUB_23' | 'AUGE_24_29' | 'EXP_30_PLUS';
type DifficultyFilter =
  | 'ALL'
  | 'FACIL'
  | 'ATE_MODERADA'
  | 'MODERADA'
  | 'DIFICIL';
type SortKey =
  | 'OVR_DESC'
  | 'STARS_DESC'
  | 'OVR_ASC'
  | 'FEE_ASC'
  | 'FEE_DESC'
  | 'SALARY_ASC'
  | 'AGE_ASC'
  | 'EASIEST';
type HistoryTypeFilter =
  | 'ALL'
  | 'ENTRADAS'
  | 'SAIDAS'
  | 'IA_MERCADO'
  | 'RECUSADAS';

const NATURAL_POSITIONS: { value: 'ALL' | NaturalPosition; label: string }[] = [
  { value: 'ALL', label: 'Todas as Posições' },
  { value: 'GOL', label: 'GOL — Goleiro' },
  { value: 'ZAG', label: 'ZAG — Zagueiro' },
  { value: 'LD', label: 'LD — Lateral Direito' },
  { value: 'LE', label: 'LE — Lateral Esquerdo' },
  { value: 'VOL', label: 'VOL — Volante' },
  { value: 'MC', label: 'MC — Meia Central' },
  { value: 'MEI', label: 'MEI — Meia-Atacante' },
  { value: 'PD', label: 'PD — Ponta Direita' },
  { value: 'PE', label: 'PE — Ponta Esquerda' },
  { value: 'ATA', label: 'ATA — Centroavante' },
];

const ATTRIBUTE_OPTIONS: {
  key: 'NONE' | keyof PlayerAttributes;
  label: string;
}[] = [
  { key: 'NONE', label: 'Qualquer Atributo' },
  { key: 'finalizacao', label: 'Finalização' },
  { key: 'passe', label: 'Passe' },
  { key: 'drible', label: 'Drible' },
  { key: 'desarme', label: 'Desarme' },
  { key: 'visaoDeJogo', label: 'Visão de Jogo' },
  { key: 'velocidade', label: 'Velocidade' },
  { key: 'aceleracao', label: 'Aceleração' },
  { key: 'posicionamento', label: 'Posicionamento' },
  { key: 'cruzamento', label: 'Cruzamento' },
  { key: 'forca', label: 'Força Física' },
  { key: 'resistencia', label: 'Resistência' },
  { key: 'decisoes', label: 'Decisões' },
  { key: 'compostura', label: 'Compostura' },
];

const DIFFICULTY_STYLES: Record<
  TransferDifficultyLevel,
  { text: string; bar: string; bg: string }
> = {
  Fácil: {
    text: 'text-[#b5ff00]',
    bar: 'bg-[#b5ff00]',
    bg: 'border-[#b5ff00]/35 bg-[#b5ff00]/10',
  },
  Moderada: {
    text: 'text-amber-300',
    bar: 'bg-amber-400',
    bg: 'border-amber-400/35 bg-amber-400/10',
  },
  Difícil: {
    text: 'text-orange-400',
    bar: 'bg-orange-400',
    bg: 'border-orange-400/35 bg-orange-400/10',
  },
  'Muito Difícil': {
    text: 'text-rose-400',
    bar: 'bg-rose-400',
    bg: 'border-rose-400/35 bg-rose-400/10',
  },
};

function formatTransferRecordBadge(rec: TransferRecord): {
  label: string;
  className: string;
} {
  if (rec.status === 'RECUSADA') {
    return {
      label: 'PROPOSTA RECUSADA',
      className: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    };
  }
  if (rec.status === 'CONTRAPROPOSTA') {
    return {
      label: 'CONTRAPROPOSTA',
      className: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
    };
  }
  if (rec.isAiTransfer) {
    return {
      label:
        rec.type === 'EMPRESTIMO_IN' || rec.type === 'EMPRESTIMO_OUT'
          ? 'EMPRÉSTIMO IA'
          : 'MERCADO IA',
      className: 'bg-purple-500/15 text-purple-300 border-purple-500/35',
    };
  }
  switch (rec.type) {
    case 'COMPRA':
      return {
        label: 'COMPRA DEFINITIVA',
        className: 'bg-[#b5ff00]/15 text-[#b5ff00] border-[#b5ff00]/35',
      };
    case 'LIVRE':
      return {
        label: 'PASSE LIVRE',
        className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
      };
    case 'EMPRESTIMO_IN':
      return {
        label: 'EMPRÉSTIMO RECEBIDO',
        className: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
      };
    case 'VENDA':
      return {
        label: 'VENDA CONCLUÍDA',
        className: 'bg-sky-500/15 text-sky-300 border-sky-500/35',
      };
    case 'EMPRESTIMO_OUT':
      return {
        label: 'EMPRÉSTIMO CEDIDO',
        className: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/35',
      };
  }
}

export const MarketView: React.FC<MarketViewProps> = ({
  userClub,
  clubs,
  squad,
  freeAgents,
  loanedOutPlayers,
  transferHistory,
  transferredOutClubPlayerIds,
  watchedPlayers = [],
  negotiationStates = {},
  seasonYear = 2026,
  dayOffset = 0,
  aiSquads,
  pendingOffers = [],
  onResolveIncomingOffer,
  lastFeedback,
  onClearFeedback,
  lastAttemptResult = null,
  onClearAttemptResult,
  onAcceptCounterOffer,
  onInspectPlayer,
  onToggleWatchPlayer,
  onRemoveWatchedPlayer,
  onProposeTransfer,
  onOutgoingTransfer,
  onTogglePlayerMarketListing,
  onSolicitOfferForPlayer,
}) => {
  const windowStatus = getTransferWindowStatus(dayOffset, seasonYear);
  const [subTab, setSubTab] = useState<MarketSubTab>('NACIONAL_LIB');
  const [domesticScope, setDomesticScope] =
    useState<DomesticScopeFilter>('ALL');
  const [intlScope, setIntlScope] = useState<IntlScopeFilter>('ALL');
  const [clubListingFilter, setClubListingFilter] =
    useState<ClubListingFilter>('ALL');
  const [showClubRadar, setShowClubRadar] = useState<boolean>(false);
  const [sectorFilter, setSectorFilter] = useState<'ALL' | PositionSector>('ALL');
  const [positionFilter, setPositionFilter] = useState<'ALL' | NaturalPosition>(
    'ALL'
  );
  const [priceRangeFilter, setPriceRangeFilter] =
    useState<PriceRangeFilter>('ALL');
  const [maxSalaryFilter, setMaxSalaryFilter] = useState<number>(0); // 0 = all
  const [minOvrFilter, setMinOvrFilter] = useState<number>(60);
  const [maxOvrFilter, setMaxOvrFilter] = useState<number>(95);
  const [minStarsFilter, setMinStarsFilter] = useState<number>(0); // 0 = todas estrelas
  const [ageRangeFilter, setAgeRangeFilter] = useState<AgeRangeFilter>('ALL');
  const [difficultyFilter, setDifficultyFilter] =
    useState<DifficultyFilter>('ALL');
  const [keyAttributeFilter, setKeyAttributeFilter] = useState<
    'NONE' | keyof PlayerAttributes
  >('NONE');
  const [minAttributeValue, setMinAttributeValue] = useState<number>(15);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 640 : false
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [onlyAffordable, setOnlyAffordable] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>('OVR_DESC');
  const [visibleLimit, setVisibleLimit] = useState(40);

  // History tab filters
  const [historyTypeFilter, setHistoryTypeFilter] =
    useState<HistoryTypeFilter>('ALL');
  const [historySearch, setHistorySearch] = useState('');

  // Watchlist tab filters & selection
  const [watchlistFilter, setWatchlistFilter] =
    useState<WatchlistFilter>('TODOS');
  const [watchlistSort, setWatchlistSort] =
    useState<WatchlistSortKey>('RECENT');
  const [watchlistSearch, setWatchlistSearch] = useState('');
  const [selectedWatchedId, setSelectedWatchedId] = useState<string | null>(null);

  // Selected listing for desktop & mobile drawer
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [mobileDeskOpen, setMobileDeskOpen] = useState(false);
  const mobileModalScrollRef = useRef<HTMLDivElement | null>(null);

  // Proposal controls
  const [dealMode, setDealMode] = useState<TransferDealMode>('BUY');
  const [offerMultiplier, setOfferMultiplier] = useState<number>(1.0);
  const [salaryOfferMult, setSalaryOfferMult] = useState<number>(1.0);
  const [loanWageShare, setLoanWageShare] = useState<LoanWageShare>(0.75);
  const [loanDurationYears, setLoanDurationYears] = useState<1 | 2>(1);
  const [contractYears, setContractYears] = useState<2 | 3 | 4>(3);
  const offerTier: TransferOfferTier = getOfferTierFromMultiplier(offerMultiplier);

  // Deal acceptance celebratory transition state
  const [dealTransition, setDealTransition] =
    useState<MarketDealTransitionPayload | null>(null);
  const lastSeenAttemptIdRef = useRef<string | null>(
    lastAttemptResult?.id ?? null
  );
  const prevOfferStatusMapRef = useRef<Map<string, IncomingTransferOffer['status']>>(
    new Map(pendingOffers.map((o) => [o.id, o.status]))
  );
  const squadNumberCacheRef = useRef<Map<string, number>>(
    new Map(squad.map((p) => [p.id, p.number]))
  );

  const currentPayroll = useMemo(
    () => getEffectivePayroll(squad, loanedOutPlayers),
    [squad, loanedOutPlayers]
  );
  const isInDebt = userClub.cashBalance < 0;
  const loanedInCount = squad.filter(
    (p) => p.contractType === 'EMPRESTADO'
  ).length;

  const activePendingOffers = useMemo(
    () => pendingOffers.filter((o) => o.status === 'PENDING'),
    [pendingOffers]
  );

  const allListings = useMemo(
    () =>
      buildAllMarketListings({
        clubs,
        userClubId: userClub.id,
        freeAgents,
        transferredOutClubPlayerIds,
        aiSquads,
      }),
    [clubs, userClub.id, freeAgents, transferredOutClubPlayerIds, aiSquads]
  );

  const watchedIdsSet = useMemo(
    () => new Set(watchedPlayers.map((w) => w.playerId)),
    [watchedPlayers]
  );

  // Count active advanced filters
  const activeAdvancedFilterCount = useMemo(() => {
    let count = 0;
    if (clubListingFilter !== 'ALL') count++;
    if (positionFilter !== 'ALL') count++;
    if (priceRangeFilter !== 'ALL') count++;
    if (maxSalaryFilter > 0) count++;
    if (minOvrFilter > 60 || maxOvrFilter < 95) count++;
    if (minStarsFilter > 0) count++;
    if (ageRangeFilter !== 'ALL') count++;
    if (difficultyFilter !== 'ALL') count++;
    if (keyAttributeFilter !== 'NONE') count++;
    if (onlyAffordable) count++;
    return count;
  }, [
    clubListingFilter,
    positionFilter,
    priceRangeFilter,
    maxSalaryFilter,
    minOvrFilter,
    maxOvrFilter,
    minStarsFilter,
    ageRangeFilter,
    difficultyFilter,
    keyAttributeFilter,
    onlyAffordable,
  ]);

  const handleResetFilters = () => {
    setDomesticScope('ALL');
    setIntlScope('ALL');
    setClubListingFilter('ALL');
    setSectorFilter('ALL');
    setPositionFilter('ALL');
    setPriceRangeFilter('ALL');
    setMaxSalaryFilter(0);
    setMinOvrFilter(60);
    setMaxOvrFilter(95);
    setMinStarsFilter(0);
    setAgeRangeFilter('ALL');
    setDifficultyFilter('ALL');
    setKeyAttributeFilter('NONE');
    setMinAttributeValue(15);
    setSearchQuery('');
    setOnlyAffordable(false);
    setSortBy('OVR_DESC');
  };

  // Counts of club-listed players within the current subTab scope
  const clubListingCounts = useMemo(() => {
    let listedAny = 0;
    let listedBuy = 0;
    let listedLoan = 0;

    for (const item of allListings) {
      if (subTab === 'NACIONAL_LIB') {
        if (
          item.scope !== 'SERIE_A' &&
          item.scope !== 'SERIE_B' &&
          item.scope !== 'LIBERTADORES'
        ) {
          continue;
        }
        if (domesticScope !== 'ALL' && item.scope !== domesticScope) continue;
      } else if (subTab === 'INTERNACIONAL') {
        if (item.scope !== 'INTERNACIONAL') continue;
        const isChampionsClub = Boolean(
          item.originClub?.leagueName.startsWith('Champions League')
        );
        if (intlScope === 'CHAMPIONS' && !isChampionsClub) continue;
        if (intlScope === 'MUNDIAL_OUTROS' && isChampionsClub) continue;
      } else if (subTab === 'LIVRES') {
        continue;
      } else if (subTab === 'EMPRESTIMOS') {
        if (item.scope === 'LIVRES' || !item.loanAvailable) continue;
      }

      if (item.isTransferListed) listedBuy++;
      if (item.isLoanListed) listedLoan++;
      if (item.isTransferListed || item.isLoanListed) listedAny++;
    }

    return { listedAny, listedBuy, listedLoan };
  }, [allListings, subTab, domesticScope, intlScope]);

  // Strategic Market Profiles for all opponent clubs (needs, purchases, sales, loans)
  const aiClubProfilesMap = useMemo(() => {
    const map = new Map<
      string,
      {
        club: Club;
        profile: ReturnType<typeof analyzeAiClubMarketProfile>;
        listedBuyPlayers: Player[];
        listedLoanPlayers: Player[];
      }
    >();
    for (const c of clubs) {
      if (c.id === userClub.id) continue;
      const rawSquad =
        aiSquads && aiSquads[c.id] && aiSquads[c.id].length > 0
          ? aiSquads[c.id]
          : getRealSquadForClub(c);
      const hasListings = rawSquad.some(
        (p) => p.isTransferListed || p.isLoanListed
      );
      const evaluatedSquad = hasListings
        ? rawSquad
        : evaluateAiClubSquadAndListings(c, rawSquad);
      const profile = analyzeAiClubMarketProfile(c, evaluatedSquad);
      map.set(c.id, {
        club: c,
        profile,
        listedBuyPlayers: evaluatedSquad.filter((p) => p.isTransferListed),
        listedLoanPlayers: evaluatedSquad.filter((p) => p.isLoanListed),
      });
    }
    return map;
  }, [clubs, userClub.id, aiSquads]);

  // Reset limit & deal mode smoothly when switching tabs
  useEffect(() => {
    setVisibleLimit(40);
    if (subTab === 'LIVRES') {
      setDealMode('FREE');
    } else if (subTab === 'EMPRESTIMOS') {
      setDealMode('LOAN');
    } else if (subTab === 'NACIONAL_LIB' || subTab === 'INTERNACIONAL') {
      setDealMode('BUY');
    }
    setOfferMultiplier(1.0);
    setSalaryOfferMult(1.0);
  }, [subTab]);

  useEffect(() => {
    if (!lastAttemptResult) return;
    if (mobileModalScrollRef.current) {
      mobileModalScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    const raf = requestAnimationFrame(() => {
      if (mobileModalScrollRef.current) {
        mobileModalScrollRef.current.scrollTop = 0;
      }
      const el = document.querySelector('[data-testid="transfer-attempt-result"]');
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.top < 72 || rect.bottom > window.innerHeight) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [lastAttemptResult?.id]);

  // Cache shirt numbers so accepted outgoing deals still show the player's jersey number
  useEffect(() => {
    for (const p of squad) {
      squadNumberCacheRef.current.set(p.id, p.number);
    }
  }, [squad]);

  // Trigger celebratory transition when an incoming signing / counter-offer is accepted
  useEffect(() => {
    if (!lastAttemptResult) return;
    if (lastSeenAttemptIdRef.current === lastAttemptResult.id) return;
    lastSeenAttemptIdRef.current = lastAttemptResult.id;

    if (lastAttemptResult.outcome !== 'ACEITA') return;

    const listing = lastAttemptResult.listing;
    const player = lastAttemptResult.signedPlayer ?? listing.player;
    const stars =
      player.potentialStars ??
      listing.player.potentialStars ??
      3;

    setDealTransition({
      id: `deal-in-${lastAttemptResult.id}`,
      direction: 'INCOMING',
      dealMode: lastAttemptResult.dealMode,
      playerName: player.name,
      playerNumber: player.number,
      position: player.position,
      age: player.age,
      ovr: listing.ovr,
      potentialStars: stars,
      fromClub: listing.originClub
        ? {
            id: listing.originClub.id,
            abbr: listing.originClub.abbr,
            name: listing.originClub.name,
            primaryColor: listing.originClub.primaryColor,
          }
        : null,
      toClub: {
        id: userClub.id,
        abbr: userClub.abbr,
        name: userClub.name,
        primaryColor: userClub.primaryColor,
      },
      fee: lastAttemptResult.offeredFee,
      monthlySalary: lastAttemptResult.offeredSalary,
      durationYears:
        lastAttemptResult.dealMode === 'LOAN'
          ? lastAttemptResult.loanDurationYears ?? 1
          : lastAttemptResult.contractYears ?? 3,
    });
  }, [lastAttemptResult, userClub.id, userClub.abbr, userClub.name, userClub.primaryColor]);

  // Trigger celebratory transition when a user accepts (or wins counter on) an incoming AI offer
  useEffect(() => {
    const prevMap = prevOfferStatusMapRef.current;
    const newlyAccepted = pendingOffers.find(
      (o) => prevMap.get(o.id) === 'PENDING' && o.status === 'ACCEPTED'
    );

    const nextMap = new Map<string, IncomingTransferOffer['status']>();
    for (const o of pendingOffers) {
      nextMap.set(o.id, o.status);
    }
    prevOfferStatusMapRef.current = nextMap;

    if (!newlyAccepted) return;

    const loanedMatch = loanedOutPlayers.find(
      (p) => p.id === newlyAccepted.playerId
    );
    const shirtNumber =
      loanedMatch?.number ??
      squadNumberCacheRef.current.get(newlyAccepted.playerId) ??
      10;

    setDealTransition({
      id: `deal-out-${newlyAccepted.id}`,
      direction: 'OUTGOING',
      dealMode: newlyAccepted.dealType === 'LOAN' ? 'LOAN_OUT' : 'SELL_OUT',
      playerName: newlyAccepted.playerName,
      playerNumber: shirtNumber,
      position: newlyAccepted.playerPosition,
      age: newlyAccepted.playerAge,
      ovr: newlyAccepted.playerOvr,
      potentialStars: newlyAccepted.playerPotentialStars,
      fromClub: {
        id: userClub.id,
        abbr: userClub.abbr,
        name: userClub.name,
        primaryColor: userClub.primaryColor,
      },
      toClub: {
        id: newlyAccepted.fromClubId,
        abbr: newlyAccepted.fromClubAbbr,
        name: newlyAccepted.fromClubName,
        primaryColor: newlyAccepted.fromClubPrimaryColor,
      },
      fee: newlyAccepted.offeredFee,
      monthlySalary: newlyAccepted.playerSalary ?? 0,
      durationYears: 1,
      wageShareCovered: newlyAccepted.wageShareCovered,
    });
  }, [pendingOffers, loanedOutPlayers, userClub.id, userClub.abbr, userClub.name, userClub.primaryColor]);

  // Quick difficulty evaluation helper using default parameters for sorting/badge
  const evaluatedListMap = useMemo(() => {
    const map = new Map<
      string,
      ReturnType<typeof evaluateTransferNegotiation>
    >();
    const baseMode: TransferDealMode =
      subTab === 'EMPRESTIMOS'
        ? 'LOAN'
        : subTab === 'LIVRES'
        ? 'FREE'
        : 'BUY';

    for (const item of allListings) {
      const mode: TransferDealMode =
        item.scope === 'LIVRES' ? 'FREE' : baseMode;
      map.set(
        item.player.id,
        evaluateTransferNegotiation({
          userClub,
          userSquad: squad,
          loanedOutPlayers,
          listing: item,
          dealMode: mode,
          offerTier: 'PADRAO',
          loanWageShare: 0.75,
        })
      );
    }
    return map;
  }, [allListings, subTab, userClub, squad, loanedOutPlayers]);

  const filteredListings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return allListings
      .filter((item) => {
        if (subTab === 'NACIONAL_LIB') {
          if (
            item.scope !== 'SERIE_A' &&
            item.scope !== 'SERIE_B' &&
            item.scope !== 'LIBERTADORES'
          ) {
            return false;
          }
          if (domesticScope !== 'ALL' && item.scope !== domesticScope) {
            return false;
          }
        } else if (subTab === 'INTERNACIONAL') {
          if (item.scope !== 'INTERNACIONAL') return false;
          const isChampionsClub = Boolean(
            item.originClub?.leagueName.startsWith('Champions League')
          );
          if (intlScope === 'CHAMPIONS' && !isChampionsClub) return false;
          if (intlScope === 'MUNDIAL_OUTROS' && isChampionsClub) return false;
        } else if (subTab === 'LIVRES') {
          if (item.scope !== 'LIVRES') return false;
        } else if (subTab === 'EMPRESTIMOS') {
          if (item.scope === 'LIVRES' || !item.loanAvailable) return false;
        }

        // Club availability filter (placed for purchase or loan by opponent clubs)
        if (clubListingFilter === 'LISTED_ANY') {
          if (!item.isTransferListed && !item.isLoanListed) return false;
        } else if (clubListingFilter === 'LISTED_BUY') {
          if (!item.isTransferListed) return false;
        } else if (clubListingFilter === 'LISTED_LOAN') {
          if (!item.isLoanListed) return false;
        }

        if (sectorFilter !== 'ALL' && item.player.sector !== sectorFilter) {
          return false;
        }

        if (
          positionFilter !== 'ALL' &&
          item.player.position !== positionFilter
        ) {
          return false;
        }

        // Skill / OVR range filter
        if (item.ovr < minOvrFilter || item.ovr > maxOvrFilter) {
          return false;
        }

        // Potential stars filter
        if (minStarsFilter > 0) {
          const stars = item.player.potentialStars ?? 3;
          if (stars < minStarsFilter) return false;
        }

        // Specific attribute minimum filter
        if (keyAttributeFilter !== 'NONE') {
          const attrVal = item.player.attributes[keyAttributeFilter] ?? 0;
          if (attrVal < minAttributeValue) return false;
        }

        // Price range filter
        const relevantFee =
          item.scope === 'LIVRES'
            ? 0
            : subTab === 'EMPRESTIMOS'
            ? item.loanFee
            : item.buyFee;

        if (priceRangeFilter === 'FREE_ONLY' && relevantFee > 0) return false;
        if (priceRangeFilter === 'UP_TO_25M' && relevantFee > 25_000_000)
          return false;
        if (
          priceRangeFilter === '25M_TO_80M' &&
          (relevantFee < 25_000_000 || relevantFee > 80_000_000)
        )
          return false;
        if (
          priceRangeFilter === '80M_TO_250M' &&
          (relevantFee < 80_000_000 || relevantFee > 250_000_000)
        )
          return false;
        if (priceRangeFilter === 'OVER_250M' && relevantFee <= 250_000_000)
          return false;

        // Monthly salary ceiling filter
        const relevantSalary =
          subTab === 'EMPRESTIMOS'
            ? Math.round(item.player.salary * 0.75)
            : item.player.salary;
        if (maxSalaryFilter > 0 && relevantSalary > maxSalaryFilter) {
          return false;
        }

        // Age range filter
        if (ageRangeFilter === 'SUB_23' && item.player.age > 23) return false;
        if (
          ageRangeFilter === 'AUGE_24_29' &&
          (item.player.age < 24 || item.player.age > 29)
        )
          return false;
        if (ageRangeFilter === 'EXP_30_PLUS' && item.player.age < 30)
          return false;

        // Negotiation difficulty filter
        const ev = evaluatedListMap.get(item.player.id);
        if (difficultyFilter !== 'ALL' && ev) {
          if (difficultyFilter === 'FACIL' && ev.level !== 'Fácil')
            return false;
          if (
            difficultyFilter === 'ATE_MODERADA' &&
            ev.level !== 'Fácil' &&
            ev.level !== 'Moderada'
          )
            return false;
          if (difficultyFilter === 'MODERADA' && ev.level !== 'Moderada')
            return false;
          if (difficultyFilter === 'DIFICIL' && ev.level !== 'Difícil')
            return false;
        }

        if (q) {
          const hay = `${item.player.name} ${item.player.position} ${
            item.player.nationality
          } ${item.originClub?.name || ''} ${item.originClub?.country || ''} ${
            item.originClub?.leagueName || ''
          }`.toLowerCase();
          if (!hay.includes(q)) return false;
        }

        if (onlyAffordable) {
          if (!ev || ev.isBlocked) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'STARS_DESC') {
          const starsA = a.player.potentialStars ?? 3;
          const starsB = b.player.potentialStars ?? 3;
          return starsB - starsA || b.ovr - a.ovr;
        }
        if (sortBy === 'OVR_ASC') {
          return a.ovr - b.ovr;
        }
        if (sortBy === 'FEE_ASC') {
          const feeA = subTab === 'EMPRESTIMOS' ? a.loanFee : a.buyFee;
          const feeB = subTab === 'EMPRESTIMOS' ? b.loanFee : b.buyFee;
          return feeA - feeB || b.ovr - a.ovr;
        }
        if (sortBy === 'FEE_DESC') {
          const feeA = subTab === 'EMPRESTIMOS' ? a.loanFee : a.buyFee;
          const feeB = subTab === 'EMPRESTIMOS' ? b.loanFee : b.buyFee;
          return feeB - feeA || b.ovr - a.ovr;
        }
        if (sortBy === 'SALARY_ASC') {
          return a.player.salary - b.player.salary || b.ovr - a.ovr;
        }
        if (sortBy === 'AGE_ASC') {
          return a.player.age - b.player.age || b.ovr - a.ovr;
        }
        if (sortBy === 'EASIEST') {
          const evA = evaluatedListMap.get(a.player.id)?.resistanceScore ?? 50;
          const evB = evaluatedListMap.get(b.player.id)?.resistanceScore ?? 50;
          return evA - evB || b.ovr - a.ovr;
        }
        return b.ovr - a.ovr;
      });
  }, [
    allListings,
    subTab,
    domesticScope,
    intlScope,
    clubListingFilter,
    sectorFilter,
    positionFilter,
    minOvrFilter,
    maxOvrFilter,
    minStarsFilter,
    keyAttributeFilter,
    minAttributeValue,
    priceRangeFilter,
    maxSalaryFilter,
    ageRangeFilter,
    difficultyFilter,
    searchQuery,
    onlyAffordable,
    sortBy,
    evaluatedListMap,
  ]);

  // Transfer History KPIs & filtered list
  const transferHistoryStats = useMemo(() => {
    let incomingCount = 0;
    let outgoingCount = 0;
    let rejectedCount = 0;
    let totalSpent = 0;
    let totalReceived = 0;
    let netWageDelta = 0;

    for (const rec of transferHistory) {
      if (rec.isAiTransfer) continue;
      if (rec.status === 'RECUSADA') {
        rejectedCount++;
        continue;
      }
      netWageDelta += rec.monthlySalaryImpact;
      if (
        rec.type === 'COMPRA' ||
        rec.type === 'LIVRE' ||
        rec.type === 'EMPRESTIMO_IN'
      ) {
        incomingCount++;
        totalSpent += rec.feeAmount;
      } else {
        outgoingCount++;
        totalReceived += rec.feeAmount;
      }
    }

    return {
      incomingCount,
      outgoingCount,
      rejectedCount,
      totalSpent,
      totalReceived,
      netBalance: totalReceived - totalSpent,
      netWageDelta,
    };
  }, [transferHistory]);

  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return transferHistory.filter((rec) => {
      if (historyTypeFilter === 'IA_MERCADO') {
        if (!rec.isAiTransfer) return false;
      } else if (historyTypeFilter === 'ENTRADAS') {
        if (
          rec.isAiTransfer ||
          rec.status === 'RECUSADA' ||
          (rec.type !== 'COMPRA' &&
            rec.type !== 'LIVRE' &&
            rec.type !== 'EMPRESTIMO_IN')
        ) {
          return false;
        }
      } else if (historyTypeFilter === 'SAIDAS') {
        if (
          rec.isAiTransfer ||
          rec.status === 'RECUSADA' ||
          (rec.type !== 'VENDA' && rec.type !== 'EMPRESTIMO_OUT')
        ) {
          return false;
        }
      } else if (historyTypeFilter === 'RECUSADAS') {
        if (rec.status !== 'RECUSADA') return false;
      }

      if (q) {
        const hay =
          `${rec.playerName} ${rec.position} ${rec.counterpartyClubName} ${rec.fromClubName || ''} ${rec.toClubName || ''} ${rec.note}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [transferHistory, historyTypeFilter, historySearch]);

  // Watchlist live enrichment (tracks status, OVR, value, salary, and club changes over time)
  const listingByIdMap = useMemo(() => {
    const map = new Map<string, MarketPlayerListing>();
    for (const item of allListings) {
      map.set(item.player.id, item);
    }
    return map;
  }, [allListings]);

  const watchlistItems = useMemo(() => {
    return watchedPlayers.map((entry) => {
      const listing = listingByIdMap.get(entry.playerId) || null;
      const squadPlayer =
        squad.find(
          (p) =>
            p.id === entry.playerId || p.id.endsWith(`-signed-${entry.playerId}`)
        ) || null;
      const loanedOutPlayer =
        loanedOutPlayers.find(
          (p) =>
            p.id === entry.playerId || p.id.endsWith(`-signed-${entry.playerId}`)
        ) || null;

      const statusType:
        | 'AVAILABLE_MARKET'
        | 'IN_USER_SQUAD'
        | 'LOANED_OUT'
        | 'UNAVAILABLE' = listing
        ? 'AVAILABLE_MARKET'
        : squadPlayer
        ? 'IN_USER_SQUAD'
        : loanedOutPlayer
        ? 'LOANED_OUT'
        : 'UNAVAILABLE';

      const currentPlayer =
        listing?.player || squadPlayer || loanedOutPlayer || null;
      const currentOvr =
        listing?.ovr ??
        (currentPlayer
          ? calculatePlayerOverall(currentPlayer.attributes, currentPlayer.position)
          : entry.addedOvr);
      const currentMarketValue = currentPlayer
        ? currentPlayer.marketValue
        : entry.addedMarketValue;
      const currentSalary = currentPlayer
        ? currentPlayer.salary
        : entry.addedSalary;
      const currentAge = currentPlayer ? currentPlayer.age : entry.addedAge;
      const currentClubName =
        statusType === 'IN_USER_SQUAD'
          ? userClub.shortName
          : statusType === 'LOANED_OUT'
          ? loanedOutPlayer?.loanDestinationClubName || 'Emprestado'
          : listing
          ? listing.originClub?.shortName || 'Passe Livre'
          : 'Fora do mercado';

      const ovrDeltaSinceAdded = currentOvr - entry.addedOvr;
      const valueDelta = currentMarketValue - entry.addedMarketValue;
      const valueDeltaPct =
        entry.addedMarketValue > 0
          ? Math.round((valueDelta / entry.addedMarketValue) * 100)
          : 0;
      const salaryDelta = currentSalary - entry.addedSalary;
      const ageDelta = currentAge - entry.addedAge;
      const clubChanged =
        statusType !== 'UNAVAILABLE' && currentClubName !== entry.addedClubName;

      const evaluation = listing
        ? evaluatedListMap.get(listing.player.id) ||
          evaluateTransferNegotiation({
            userClub,
            userSquad: squad,
            loanedOutPlayers,
            listing,
            dealMode: listing.scope === 'LIVRES' ? 'FREE' : 'BUY',
            offerTier: 'PADRAO',
            loanWageShare: 0.75,
          })
        : null;

      return {
        entry,
        listing,
        currentPlayer,
        statusType,
        currentOvr,
        currentMarketValue,
        currentSalary,
        currentAge,
        currentClubName,
        ovrDeltaSinceAdded,
        valueDelta,
        valueDeltaPct,
        salaryDelta,
        ageDelta,
        clubChanged,
        evaluation,
      };
    });
  }, [
    watchedPlayers,
    listingByIdMap,
    squad,
    loanedOutPlayers,
    userClub,
    evaluatedListMap,
  ]);

  const watchlistStats = useMemo(() => {
    let appreciatedCount = 0;
    let declinedCount = 0;
    let statusChangesCount = 0;
    for (const w of watchlistItems) {
      if (w.valueDelta > 0 || w.ovrDeltaSinceAdded > 0) appreciatedCount++;
      if (w.valueDelta < 0 || w.ovrDeltaSinceAdded < 0) declinedCount++;
      if (
        w.clubChanged ||
        w.statusType !== 'AVAILABLE_MARKET' ||
        w.currentPlayer?.injured ||
        w.listing?.scope === 'LIVRES'
      ) {
        statusChangesCount++;
      }
    }
    return {
      total: watchlistItems.length,
      appreciatedCount,
      declinedCount,
      statusChangesCount,
    };
  }, [watchlistItems]);

  const filteredWatchlist = useMemo(() => {
    const q = watchlistSearch.trim().toLowerCase();
    const list = watchlistItems.filter((w) => {
      if (watchlistFilter === 'VALORIZADOS') {
        if (w.valueDelta <= 0 && w.ovrDeltaSinceAdded <= 0) return false;
      } else if (watchlistFilter === 'DESVALORIZADOS') {
        if (w.valueDelta >= 0 && w.ovrDeltaSinceAdded >= 0) return false;
      } else if (watchlistFilter === 'MUDANCA_STATUS') {
        if (
          !w.clubChanged &&
          w.statusType === 'AVAILABLE_MARKET' &&
          !w.currentPlayer?.injured &&
          w.listing?.scope !== 'LIVRES'
        ) {
          return false;
        }
      } else if (watchlistFilter === 'DISPONIVEIS') {
        if (!w.listing || !w.evaluation || w.evaluation.isBlocked) return false;
      }

      if (q) {
        const hay = `${w.entry.playerName} ${w.entry.position} ${w.currentClubName} ${w.entry.addedClubName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (watchlistSort === 'RECENT') return list;

    return [...list].sort((a, b) => {
      if (watchlistSort === 'VALUE_DELTA_DESC') {
        return (
          b.valueDelta - a.valueDelta ||
          b.ovrDeltaSinceAdded - a.ovrDeltaSinceAdded
        );
      }
      if (watchlistSort === 'OVR_DELTA_DESC') {
        return (
          b.ovrDeltaSinceAdded - a.ovrDeltaSinceAdded ||
          b.valueDelta - a.valueDelta
        );
      }
      if (watchlistSort === 'OVR_DESC') {
        return b.currentOvr - a.currentOvr;
      }
      if (watchlistSort === 'VALUE_ASC') {
        return a.currentMarketValue - b.currentMarketValue;
      }
      return 0;
    });
  }, [watchlistItems, watchlistFilter, watchlistSort, watchlistSearch]);

  const selectedWatchedItem = useMemo(() => {
    if (filteredWatchlist.length === 0) return null;
    const found = filteredWatchlist.find(
      (w) => w.entry.playerId === selectedWatchedId
    );
    return found || filteredWatchlist[0];
  }, [filteredWatchlist, selectedWatchedId]);

  // Select first item automatically on desktop when filtered list updates and current selection is missing
  const selectedListing = useMemo(() => {
    if (filteredListings.length === 0) return null;
    const found = filteredListings.find(
      (i) => i.player.id === selectedListingId
    );
    return found || filteredListings[0];
  }, [filteredListings, selectedListingId]);

  const deskListing =
    subTab === 'OBSERVADOS'
      ? selectedWatchedItem?.listing || null
      : selectedListing;

  const effectiveDealMode: TransferDealMode = !deskListing
    ? 'BUY'
    : deskListing.scope === 'LIVRES'
    ? 'FREE'
    : dealMode === 'FREE'
    ? 'BUY'
    : dealMode;

  const activeEvaluation = useMemo(() => {
    if (!deskListing) return null;
    return evaluateTransferNegotiation({
      userClub,
      userSquad: squad,
      loanedOutPlayers,
      listing: deskListing,
      dealMode: effectiveDealMode,
      offerTier,
      offerMultiplier,
      salaryOfferMult,
      loanWageShare,
      loanDurationYears,
      contractYears,
    });
  }, [
    deskListing,
    userClub,
    squad,
    loanedOutPlayers,
    effectiveDealMode,
    offerTier,
    offerMultiplier,
    salaryOfferMult,
    loanWageShare,
    loanDurationYears,
    contractYears,
  ]);

  const handleSelectListing = (item: MarketPlayerListing) => {
    setSelectedListingId(item.player.id);
    setOfferMultiplier(1.0);
    setSalaryOfferMult(1.0);
    if (item.scope === 'LIVRES') {
      setDealMode('FREE');
    } else if (
      subTab === 'EMPRESTIMOS' ||
      clubListingFilter === 'LISTED_LOAN' ||
      (item.isLoanListed && !item.isTransferListed)
    ) {
      setDealMode('LOAN');
    } else if (clubListingFilter === 'LISTED_BUY' || item.isTransferListed) {
      setDealMode('BUY');
    }
    setMobileDeskOpen(true);
    onClearFeedback();
    onClearAttemptResult?.();
  };

  const handleSelectWatched = (
    item: (typeof watchlistItems)[number]
  ) => {
    setSelectedWatchedId(item.entry.playerId);
    setOfferMultiplier(1.0);
    setSalaryOfferMult(1.0);
    if (item.listing?.scope === 'LIVRES') {
      setDealMode('FREE');
    } else {
      setDealMode('BUY');
    }
    setMobileDeskOpen(true);
    onClearFeedback();
    onClearAttemptResult?.();
  };

  const renderNegotiationDesk = (isMobileModal: boolean) => {
    // When a negotiation attempt result exists, close/hide the previous proposal form
    // and replace the modal content with the dedicated Outcome Screen right in the user's field of view.
    if (lastAttemptResult) {
      const attemptListing = lastAttemptResult.listing;
      const attemptPlayer = attemptListing.player;
      const isAccepted = lastAttemptResult.outcome === 'ACEITA';
      const isCounter = lastAttemptResult.outcome === 'CONTRAPROPOSTA';
      const counterCanAfford = lastAttemptResult.counterOffer
        ? lastAttemptResult.counterOffer.counterFee <= 0 ||
          lastAttemptResult.counterOffer.counterFee <= userClub.cashBalance
        : false;

      const handleDismissOutcome = () => {
        onClearAttemptResult?.();
        if (isMobileModal) setMobileDeskOpen(false);
      };

      const handleReopenProposalForm = () => {
        setSelectedListingId(attemptPlayer.id);
        onClearAttemptResult?.();
      };

      return (
        <div
          key={lastAttemptResult.id}
          data-testid="transfer-attempt-result"
          className={`bg-[#14171f] border-2 rounded-[24px] overflow-hidden flex flex-col shadow-2xl animate-market-outcome-enter ${
            isAccepted
              ? 'border-[#b5ff00]'
              : isCounter
              ? 'border-amber-400'
              : 'border-rose-500'
          }`}
        >
          {/* Outcome Header replacing previous form */}
          <div
            className={`relative overflow-hidden p-4 sm:p-5 border-b flex items-start justify-between gap-3 ${
              isAccepted
                ? 'bg-[#b5ff00]/15 border-[#b5ff00]/40'
                : isCounter
                ? 'bg-amber-950/60 border-amber-400/40'
                : 'bg-rose-950/60 border-rose-500/40'
            }`}
          >
            {isAccepted && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-[#b5ff00]/20 to-transparent animate-market-sheen-sweep"
              />
            )}
            <div className="flex items-center gap-3 min-w-0">
              <PlayerJersey
                number={attemptPlayer.number}
                variant={attemptListing.originClub ? 'club' : 'dark'}
                customColor={attemptListing.originClub?.primaryColor || '#b5ff00'}
                size="md"
              />
              <PlayerOvrBadge
                ovr={attemptListing.ovr}
                position={attemptPlayer.position}
                size="lg"
                tone={isAccepted ? 'lime' : isCounter ? 'amber' : 'rose'}
              />

              <div className="min-w-0">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold uppercase ${
                    isAccepted
                      ? 'bg-[#b5ff00] text-[#090a0f]'
                      : isCounter
                      ? 'bg-amber-400 text-[#090a0f]'
                      : 'bg-rose-500 text-white'
                  }`}
                >
                  {isAccepted
                    ? lastAttemptResult.dealMode === 'LOAN'
                      ? '✓ EMPRÉSTIMO FECHADO'
                      : '✓ CONTRATAÇÃO CONCLUÍDA'
                    : isCounter
                    ? '⇄ CONTRAPROPOSTA RECEBIDA'
                    : lastAttemptResult.rejectedBy === 'JOGADOR'
                    ? '✕ RECUSADA PELO ATLETA'
                    : lastAttemptResult.rejectedBy === 'CLUBE'
                    ? '✕ RECUSADA PELO CLUBE'
                    : '✕ PROPOSTA RECUSADA'}
                </span>
                <h3 className="font-display text-xl sm:text-2xl font-extrabold uppercase tracking-tight text-white leading-tight mt-1">
                  {lastAttemptResult.headline}
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDismissOutcome}
              aria-label="Fechar resultado da negociação"
              className="p-2 rounded-full bg-black/40 text-zinc-300 hover:text-white active:scale-95 transition-transform shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Outcome Body */}
          <div className="p-4 sm:p-5 space-y-3.5">
            <p className="text-xs sm:text-sm text-zinc-100 leading-relaxed font-medium">
              {lastAttemptResult.summary}
            </p>

            {/* Deal Terms Snapshot */}
            <div className="grid grid-cols-3 gap-2 bg-[#0b0c10] border border-white/[0.07] rounded-2xl p-3 text-center">
              <div>
                <div className="text-[10px] font-mono uppercase text-zinc-400">
                  Modalidade
                </div>
                <div className="text-xs font-extrabold text-white mt-0.5">
                  {lastAttemptResult.dealMode === 'LOAN'
                    ? `Empréstimo (${lastAttemptResult.loanDurationYears ?? 1}a)`
                    : lastAttemptResult.dealMode === 'FREE'
                    ? `Passe Livre (${lastAttemptResult.contractYears ?? 3}a)`
                    : `Compra (${lastAttemptResult.contractYears ?? 3}a)`}
                </div>
              </div>
              <div className="border-x border-white/[0.06] px-1">
                <div className="text-[10px] font-mono uppercase text-zinc-400">
                  Taxa / Passe
                </div>
                <div className="text-xs font-mono font-extrabold text-[#b5ff00] mt-0.5 tabular-nums">
                  {lastAttemptResult.offeredFee === 0
                    ? 'Sem Custo'
                    : formatCompactBRL(lastAttemptResult.offeredFee)}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase text-zinc-400">
                  Salário Mensal
                </div>
                <div className="text-xs font-mono font-extrabold text-white mt-0.5 tabular-nums">
                  {formatCompactBRL(lastAttemptResult.offeredSalary)}/mês
                </div>
              </div>
            </div>

            {/* Key Decision Factors */}
            {lastAttemptResult.factors.length > 0 && (
              <div className="bg-[#0b0c10]/80 rounded-2xl p-3 border border-white/[0.06] space-y-1.5">
                <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold">
                  Relatório dos Bastidores da Negociação
                </div>
                <ul className="space-y-1 text-[11px] text-zinc-200">
                  {lastAttemptResult.factors.map((factor, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-[#b5ff00] font-bold">•</span>
                      <span>{factor}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Counter-Offer Comparison Box */}
            {isCounter && lastAttemptResult.counterOffer && (
              <div className="bg-[#0b0c10] border border-amber-400/45 rounded-2xl p-3.5 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono uppercase text-[10px] font-bold text-amber-300">
                    Exigência de:{' '}
                    {lastAttemptResult.counterOffer.source === 'CLUBE'
                      ? 'Clube Vendedor'
                      : lastAttemptResult.counterOffer.source === 'JOGADOR'
                      ? 'Estafe do Atleta'
                      : 'Clube + Atleta'}
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    Compare os termos
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-white/[0.03] rounded-xl p-2.5 border border-white/[0.05]">
                    <div className="text-zinc-400">Sua Oferta</div>
                    <div className="font-mono font-bold text-zinc-200 mt-0.5">
                      {formatCompactBRL(lastAttemptResult.offeredFee)}
                    </div>
                    <div className="font-mono text-zinc-400">
                      {formatCompactBRL(lastAttemptResult.offeredSalary)}/mês
                    </div>
                  </div>
                  <div className="bg-amber-400/15 rounded-xl p-2.5 border border-amber-400/45">
                    <div className="text-amber-300 font-bold">
                      Contraproposta
                    </div>
                    <div className="font-mono font-extrabold text-white mt-0.5">
                      {formatCompactBRL(
                        lastAttemptResult.counterOffer.counterFee
                      )}
                    </div>
                    <div className="font-mono font-bold text-amber-200">
                      {formatCompactBRL(
                        lastAttemptResult.counterOffer.counterSalary
                      )}
                      /mês
                      {lastAttemptResult.counterOffer.counterLoanWageShare !==
                        undefined &&
                        ` (${Math.round(lastAttemptResult.counterOffer.counterLoanWageShare * 100)}%)`}
                    </div>
                  </div>
                </div>

                {!counterCanAfford && (
                  <div className="text-[11px] text-rose-300 font-semibold">
                    Saldo em caixa insuficiente para cobrir a taxa da contraproposta.
                  </div>
                )}
              </div>
            )}

            {/* 1-Year Negotiation Cooldown Notice */}
            {lastAttemptResult.negotiationBlockedUntilLabel && (
              <div className="rounded-2xl bg-rose-950/50 border border-rose-500/45 p-3 text-xs text-rose-200 flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-rose-200">
                    Negociações bloqueadas por 1 ano
                  </div>
                  <div className="text-[11px] text-rose-200/85 mt-0.5">
                    {isCounter
                      ? `Esta contraproposta é a última chance. Se não aceitar agora, ${attemptPlayer.name} só voltará a negociar em ${lastAttemptResult.negotiationBlockedUntilLabel}.`
                      : `${attemptPlayer.name} não aceita novas propostas do ${userClub.shortName} até ${lastAttemptResult.negotiationBlockedUntilLabel}.`}
                  </div>
                </div>
              </div>
            )}

            {/* Resolution Action Buttons */}
            <div className="pt-1 flex flex-col sm:flex-row gap-2">
              {isAccepted ? (
                <button
                  type="button"
                  onClick={handleDismissOutcome}
                  className="w-full py-3.5 px-5 rounded-full bg-[#b5ff00] hover:bg-[#c8ff33] active:scale-[0.98] text-[#090a0f] text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Concluir & Voltar ao Mercado
                </button>
              ) : isCounter ? (
                <>
                  {onAcceptCounterOffer && (
                    <button
                      type="button"
                      disabled={!counterCanAfford || !windowStatus.isOpen}
                      onClick={() => onAcceptCounterOffer(lastAttemptResult)}
                      className="flex-1 py-3 px-4 rounded-full bg-[#b5ff00] hover:bg-[#c8ff33] active:scale-[0.98] disabled:bg-zinc-800 disabled:text-zinc-500 text-[#090a0f] text-xs font-extrabold transition-all cursor-pointer"
                    >
                      {lastAttemptResult.negotiationBlockedUntilLabel
                        ? 'Aceitar Última Contraproposta'
                        : 'Aceitar Contraproposta'}
                    </button>
                  )}
                  {!lastAttemptResult.negotiationBlockedUntilLabel && (
                    <button
                      type="button"
                      onClick={handleReopenProposalForm}
                      className="py-3 px-4 rounded-full bg-white/[0.1] hover:bg-white/[0.16] active:scale-[0.98] text-white text-xs font-bold transition-all cursor-pointer"
                    >
                      Ajustar Minha Oferta
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleDismissOutcome}
                    className="py-3 px-4 rounded-full bg-black/40 hover:bg-black/60 active:scale-[0.98] text-zinc-300 text-xs font-bold transition-all cursor-pointer"
                  >
                    {lastAttemptResult.negotiationBlockedUntilLabel
                      ? 'Encerrar'
                      : 'Fechar'}
                  </button>
                </>
              ) : (
                <>
                  {!lastAttemptResult.negotiationBlockedUntilLabel && (
                    <button
                      type="button"
                      onClick={handleReopenProposalForm}
                      className="flex-1 py-3 px-4 rounded-full bg-[#b5ff00] hover:bg-[#c8ff33] active:scale-[0.98] text-[#090a0f] text-xs font-extrabold transition-all cursor-pointer"
                    >
                      Tentar Nova Proposta (Ajustar Valores)
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleDismissOutcome}
                    className={`${
                      lastAttemptResult.negotiationBlockedUntilLabel
                        ? 'w-full'
                        : ''
                    } py-3 px-4 rounded-full bg-white/[0.1] hover:bg-white/[0.16] active:scale-[0.98] text-white text-xs font-bold transition-all cursor-pointer`}
                  >
                    {lastAttemptResult.negotiationBlockedUntilLabel
                      ? 'Voltar ao Mercado'
                      : 'Fechar Modal'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (!deskListing || !activeEvaluation) {
      return (
        <div className="bg-[#14171f] border border-white/[0.07] rounded-[28px] overflow-hidden">
          <div className="p-6 text-center text-xs text-zinc-400">
            Nenhum atleta corresponde aos filtros atuais. Ajuste os filtros
            avançados ou clique em &ldquo;Limpar Filtros&rdquo;.
          </div>
        </div>
      );
    }

    const diffStyle = DIFFICULTY_STYLES[activeEvaluation.level];
    const p = deskListing.player;
    const isFree = deskListing.scope === 'LIVRES';
    const isLoan = effectiveDealMode === 'LOAN';
    const isWatched = watchedIdsSet.has(p.id);
    const deskNegInfo = getPlayerNegotiationBlockInfo(
      negotiationStates[p.id],
      seasonYear,
      dayOffset
    );
    const offerDeltaPct = Math.round((offerMultiplier - 1) * 100);
    const sliderFillPct = Math.round(
      ((offerMultiplier - MIN_OFFER_MULTIPLIER) /
        (MAX_OFFER_MULTIPLIER - MIN_OFFER_MULTIPLIER)) *
        100
    );
    const sliderBarTone =
      offerDeltaPct < -20
        ? 'bg-rose-400'
        : offerDeltaPct < 0
        ? 'bg-amber-400'
        : offerDeltaPct > 0
        ? 'bg-[#b5ff00]'
        : 'bg-white';
    const sliderTextTone =
      offerDeltaPct < -20
        ? 'text-rose-400'
        : offerDeltaPct < 0
        ? 'text-amber-300'
        : offerDeltaPct > 0
        ? 'text-[#b5ff00]'
        : 'text-white';

    return (
      <div className="bg-[#14171f] border border-white/[0.08] rounded-[28px] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-[#0b0c10]/70 border-b border-white/[0.07] space-y-2.5">
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <PlayerJersey
                number={p.number}
                variant={deskListing.originClub ? 'club' : 'dark'}
                customColor={deskListing.originClub?.primaryColor || '#b5ff00'}
                size="md"
              />
              <PlayerOvrBadge
                ovr={deskListing.ovr}
                position={p.position}
                size="lg"
                tone="lime"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <h3 className="font-display text-xl sm:text-2xl font-extrabold uppercase tracking-tight text-white leading-none truncate">
                    {p.name}
                  </h3>
                  <StarRating
                    player={p}
                    ovr={deskListing.ovr}
                    clubReputation={
                      deskListing.originClub?.reputation ?? userClub.reputation
                    }
                    size="sm"
                  />
                </div>
                <div className="text-[11px] sm:text-xs text-zinc-400 mt-1 flex items-center gap-1.5 truncate">
                  {deskListing.originClub && (
                    <ClubBadge
                      clubId={deskListing.originClub.id}
                      abbr={deskListing.originClub.abbr}
                      name={deskListing.originClub.name}
                      primaryColor={deskListing.originClub.primaryColor}
                      size="xs"
                    />
                  )}
                  <span className="truncate">
                    {p.age} anos · {p.nationality} ·{' '}
                    {deskListing.originClub
                      ? `${deskListing.originClub.shortName}`
                      : `Passe Livre ${seasonYear}`}
                  </span>
                </div>
              </div>
            </div>

            {isMobileModal && (
              <button
                type="button"
                onClick={() => setMobileDeskOpen(false)}
                aria-label="Fechar mesa de negociação"
                className="p-2 rounded-full bg-white/[0.08] text-zinc-300 hover:text-white shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {onToggleWatchPlayer && (
              <button
                type="button"
                onClick={() => onToggleWatchPlayer(deskListing)}
                title={
                  isWatched
                    ? 'Remover da Lista de Observação'
                    : 'Adicionar à Lista de Observação'
                }
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors flex items-center gap-1 whitespace-nowrap active:scale-95 ${
                  isWatched
                    ? 'bg-[#b5ff00]/20 border-[#b5ff00] text-[#b5ff00]'
                    : 'bg-white/[0.06] hover:bg-white/[0.12] border-white/10 text-zinc-200'
                }`}
              >
                {isWatched ? (
                  <>
                    <BookmarkCheck className="w-3.5 h-3.5" />
                    <span>Observando</span>
                  </>
                ) : (
                  <>
                    <Bookmark className="w-3.5 h-3.5" />
                    <span>Observar</span>
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => onInspectPlayer(p, deskListing)}
              className="px-3 py-1.5 rounded-full bg-white/[0.08] hover:bg-white/[0.15] text-white text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap active:scale-95"
            >
              <Eye className="w-3.5 h-3.5 text-[#b5ff00]" />
              18 Atributos
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* 6 Key Attributes Summary */}
          <div className="grid grid-cols-6 gap-1.5 text-center">
            {(
              [
                ['PAS', p.attributes.passe],
                ['FIN', p.attributes.finalizacao],
                ['DRI', p.attributes.drible],
                ['DES', p.attributes.desarme],
                ['VIS', p.attributes.visaoDeJogo],
                ['VEL', p.attributes.velocidade],
              ] as const
            ).map(([lbl, val]) => (
              <div
                key={lbl}
                className="bg-[#0b0c10] border border-white/[0.06] rounded-xl py-2 px-1"
              >
                <div className="text-[10px] text-zinc-500 font-mono">{lbl}</div>
                <div
                  className={`font-mono tabular-nums text-sm font-bold ${
                    val >= 16
                      ? 'text-[#b5ff00]'
                      : val >= 13
                      ? 'text-white'
                      : 'text-zinc-300'
                  }`}
                >
                  {val}
                </div>
              </div>
            ))}
          </div>

          {/* Club Listing Status Banner (if placed on market by origin club) */}
          {(deskListing.isTransferListed || deskListing.isLoanListed) && (
            <div className="rounded-2xl border border-[#b5ff00]/40 bg-[#b5ff00]/10 p-3 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {deskListing.isTransferListed && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-400 text-[#090a0f] text-[10px] font-mono font-extrabold uppercase">
                    Disponível p/ Compra pelo Clube
                  </span>
                )}
                {deskListing.isLoanListed && (
                  <span className="px-2 py-0.5 rounded-full bg-sky-400 text-[#090a0f] text-[10px] font-mono font-extrabold uppercase">
                    Disponível p/ Empréstimo pelo Clube
                  </span>
                )}
              </div>
              {deskListing.listingReason && (
                <div className="text-[11px] text-zinc-200 font-medium">
                  Motivo do clube:{' '}
                  <strong className="text-[#b5ff00]">
                    {deskListing.listingReason}
                  </strong>
                </div>
              )}
            </div>
          )}

          {/* Opponent Club Strategic Thinking & Needs Box */}
          {deskListing.originClub &&
            aiClubProfilesMap.has(deskListing.originClub.id) &&
            (() => {
              const clubInfo = aiClubProfilesMap.get(deskListing.originClub.id)!;
              const prof = clubInfo.profile;
              return (
                <div className="rounded-2xl bg-[#0b0c10] border border-white/[0.08] p-3 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono uppercase text-[10px] text-zinc-400 font-bold">
                      Pensamento do {deskListing.originClub.shortName}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-white/[0.07] text-[#b5ff00] font-mono text-[10px] font-bold">
                      {prof.postureLabel}
                    </span>
                  </div>
                  <div className="text-zinc-300 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>
                      Carências:{' '}
                      <strong className="text-white font-mono">
                        {prof.neededPositions.slice(0, 3).join(', ')}
                      </strong>
                    </span>
                    <span>·</span>
                    <span>
                      Folha:{' '}
                      <strong className="text-white font-mono">
                        {prof.wageUsagePct}%
                      </strong>
                    </span>
                    <span>·</span>
                    <span>
                      No mercado:{' '}
                      <strong className="text-amber-300 font-mono">
                        {clubInfo.listedBuyPlayers.length} venda
                      </strong>{' '}
                      /{' '}
                      <strong className="text-sky-300 font-mono">
                        {clubInfo.listedLoanPlayers.length} emprést.
                      </strong>
                    </span>
                  </div>
                </div>
              );
            })()}

          {/* Difficulty Comparison Box (Club x Club, Player x Squad & Ambition/Age/OVR) */}
          <div className={`rounded-2xl border p-3.5 space-y-2.5 ${diffStyle.bg}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-300 font-bold">
                Dificuldade da Negociação
              </span>
              <span
                className={`font-mono tabular-nums text-xs font-extrabold ${diffStyle.text}`}
              >
                {activeEvaluation.level} · {activeEvaluation.acceptanceChance}%
                chance
              </span>
            </div>

            <div className="w-full h-1.5 bg-[#0b0c10] rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${diffStyle.bar}`}
                style={{ width: `${activeEvaluation.acceptanceChance}%` }}
              />
            </div>

            {activeEvaluation.willHardRejectByPlayer && (
              <div className="rounded-xl bg-rose-500/20 border border-rose-500/40 px-2.5 py-1.5 text-[11px] text-rose-200 font-semibold">
                Alerta de Recusa: jovem com potencial/OVR alto tende a rejeitar clubes mais fracos que não impulsionam sua evolução.
              </div>
            )}

            <div className="space-y-1.5 text-[11px] text-zinc-200 leading-relaxed">
              <div>
                <span className="text-zinc-400 font-semibold">
                  Clubes ({userClub.shortName} ×{' '}
                  {deskListing.originClub?.shortName || 'Livre'}):{' '}
                </span>
                {activeEvaluation.clubGapNote}
              </div>
              <div>
                <span className="text-zinc-400 font-semibold">
                  Vontade do Atleta ({activeEvaluation.playerWillingnessChance}%):{' '}
                </span>
                {activeEvaluation.playerAmbitionNote}
              </div>
              <div>
                <span className="text-zinc-400 font-semibold">
                  Nível Técnico:{' '}
                </span>
                {activeEvaluation.playerGapNote}
              </div>
              <div>
                <span className="text-zinc-400 font-semibold">
                  Dinheiro na Mesa:{' '}
                </span>
                {activeEvaluation.moneyInfluenceNote}
              </div>
            </div>
          </div>

          {/* Deal Mode Selector (Compra vs Empréstimo) */}
          {!isFree && (
            <div>
              <div className="text-[11px] text-zinc-400 font-medium mb-1.5">
                Modalidade de Negociação
              </div>
              <div className="grid grid-cols-2 gap-2 bg-[#0b0c10] p-1 rounded-full border border-white/[0.07]">
                <button
                  type="button"
                  onClick={() => setDealMode('BUY')}
                  className={`py-2 px-3 rounded-full text-xs font-bold transition-colors ${
                    effectiveDealMode === 'BUY'
                      ? 'bg-[#b5ff00] text-[#090a0f]'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Compra Definitiva
                </button>
                <button
                  type="button"
                  onClick={() => setDealMode('LOAN')}
                  className={`py-2 px-3 rounded-full text-xs font-bold transition-colors ${
                    effectiveDealMode === 'LOAN'
                      ? 'bg-[#b5ff00] text-[#090a0f]'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Empréstimo {seasonYear}
                </button>
              </div>
            </div>
          )}

          {/* Loan Duration + Loan Wage Share OR Contract Length */}
          {isLoan ? (
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1.5">
                  <span>Duração do Empréstimo</span>
                  <span className="font-mono text-zinc-300">
                    Vence fim de {seasonYear + loanDurationYears - 1}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {([1, 2] as const).map((dur) => (
                    <button
                      key={dur}
                      type="button"
                      onClick={() => setLoanDurationYears(dur)}
                      className={`py-2 px-2 rounded-xl text-xs font-mono font-bold border transition-colors ${
                        loanDurationYears === dur
                          ? 'bg-[#b5ff00]/20 border-[#b5ff00] text-[#b5ff00]'
                          : 'bg-[#0b0c10] border-white/[0.08] text-zinc-300 hover:text-white'
                      }`}
                    >
                      {dur === 1 ? '1 Temporada' : '2 Temporadas (+taxa)'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1.5">
                  <span>Divisão do Salário no Empréstimo</span>
                  <span className="font-mono text-zinc-300">
                    Base: {formatCompactBRL(p.salary)}/mês
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {([0.5, 0.75, 1.0] as LoanWageShare[]).map((share) => (
                    <button
                      key={share}
                      type="button"
                      onClick={() => setLoanWageShare(share)}
                      className={`py-2 px-2 rounded-xl text-xs font-mono font-bold border transition-colors ${
                        loanWageShare === share
                          ? 'bg-[#b5ff00]/20 border-[#b5ff00] text-[#b5ff00]'
                          : 'bg-[#0b0c10] border-white/[0.08] text-zinc-300 hover:text-white'
                      }`}
                    >
                      {Math.round(share * 100)}% salário
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1.5">
                <span>Duração do Contrato</span>
                <span className="font-mono text-zinc-300">
                  Vence fim de {seasonYear + contractYears - 1}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {([2, 3, 4] as const).map((yrs) => (
                  <button
                    key={yrs}
                    type="button"
                    onClick={() => setContractYears(yrs)}
                    className={`py-2 px-2 rounded-xl text-xs font-mono font-bold border transition-colors ${
                      contractYears === yrs
                        ? 'bg-[#b5ff00]/20 border-[#b5ff00] text-[#b5ff00]'
                        : 'bg-[#0b0c10] border-white/[0.08] text-zinc-300 hover:text-white'
                    }`}
                  >
                    {yrs} Anos
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Volume-Style Offer Slider (Below or Above Market/Asking Value) */}
          <div className="bg-[#0b0c10] border border-white/[0.08] rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] text-zinc-300 font-semibold">
                {isFree
                  ? 'Proposta de Luvas / Salário'
                  : isLoan
                  ? 'Valor da Taxa de Empréstimo'
                  : 'Valor da Proposta ao Clube'}
              </div>
              <div className="flex items-center gap-2 font-mono tabular-nums text-xs">
                <span className={`font-extrabold ${sliderTextTone}`}>
                  {offerDeltaPct > 0
                    ? `+${offerDeltaPct}%`
                    : offerDeltaPct < 0
                    ? `${offerDeltaPct}%`
                    : 'Padrão (100%)'}
                </span>
                <span className="text-zinc-600">·</span>
                <span className="font-bold text-white">
                  {isFree
                    ? `${formatCompactBRL(activeEvaluation.effectiveSalary)}/mês`
                    : formatCompactBRL(activeEvaluation.effectiveFee)}
                </span>
              </div>
            </div>

            {/* Volume-bar track + interactive range input */}
            <div className="relative h-7 flex items-center select-none">
              <div className="w-full h-2.5 rounded-full bg-zinc-800/95 border border-white/[0.06] overflow-hidden relative">
                <div
                  className={`h-full transition-all duration-100 ${sliderBarTone}`}
                  style={{ width: `${sliderFillPct}%` }}
                />
              </div>
              {/* Center 100% market/asking anchor tick */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-4 bg-white/50 rounded-full"
              />
              {/* Visual thumb indicator */}
              <div
                aria-hidden="true"
                className={`pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-[#090a0f] shadow-md transition-all duration-75 ${sliderBarTone}`}
                style={{ left: `${sliderFillPct}%` }}
              />
              <input
                type="range"
                aria-label={
                  isFree
                    ? 'Ajustar proposta salarial e luvas'
                    : 'Ajustar valor da proposta em relação ao valor pedido'
                }
                aria-valuetext={`${Math.round(offerMultiplier * 100)}% do valor padrão`}
                min={MIN_OFFER_MULTIPLIER}
                max={MAX_OFFER_MULTIPLIER}
                step={0.05}
                value={offerMultiplier}
                onChange={(e) => setOfferMultiplier(Number(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>

            {/* Quick-snap scale anchors */}
            <div className="flex items-center justify-between text-[10px] font-mono tabular-nums">
              {(
                [
                  [0.5, '-50%'],
                  [0.75, '-25%'],
                  [1.0, 'Padrão'],
                  [1.25, '+25%'],
                  [1.5, '+50%'],
                ] as const
              ).map(([val, lbl]) => {
                const isActive = Math.abs(offerMultiplier - val) < 0.01;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setOfferMultiplier(val)}
                    className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                      isActive
                        ? 'text-white font-extrabold bg-white/[0.1]'
                        : 'text-zinc-500 hover:text-zinc-200'
                    }`}
                  >
                    {lbl}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-0.5 border-t border-white/[0.05]">
              <span>
                {isFree
                  ? `Pedida base: ${formatCompactBRL(p.salary)}/mês`
                  : `Valor de mercado: ${formatCompactBRL(p.marketValue)}`}
              </span>
              <span className={offerDeltaPct < 0 ? 'text-amber-300 font-medium' : 'text-zinc-500'}>
                {offerDeltaPct < 0
                  ? 'Abaixo do pedido reduz chance'
                  : offerDeltaPct > 0
                  ? 'Acima do pedido aumenta chance'
                  : 'Arraste para barganhar ou reforçar'}
              </span>
            </div>
          </div>

          {/* Player Salary Offer Boost */}
          <div>
            <div className="text-[11px] text-zinc-400 font-medium mb-1.5">
              Salário Oferecido ao Atleta (convence o jogador)
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  [1.0, 'Salário Base'],
                  [1.2, '+20% Salário'],
                  [1.4, '+40% Salário'],
                ] as const
              ).map(([mult, label]) => (
                <button
                  key={mult}
                  type="button"
                  onClick={() => setSalaryOfferMult(mult)}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-colors ${
                    salaryOfferMult === mult
                      ? 'bg-[#b5ff00]/20 border-[#b5ff00] text-[#b5ff00]'
                      : 'bg-[#0b0c10] border-white/[0.08] text-zinc-300 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Financial Impact Ledger */}
          <div className="bg-[#0b0c10] border border-white/[0.07] rounded-2xl p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">
                {isFree
                  ? 'Taxa de Passe'
                  : isLoan
                  ? 'Taxa de Empréstimo'
                  : 'Valor da Compra'}
              </span>
              <span className="font-mono tabular-nums font-bold text-white">
                {activeEvaluation.effectiveFee === 0
                  ? `${formatCompactBRL(0)} (Livre)`
                  : formatCompactBRL(activeEvaluation.effectiveFee)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Impacto Mensal na Folha</span>
              <span className="font-mono tabular-nums font-bold text-[#b5ff00]">
                +{formatCompactBRL(activeEvaluation.effectiveSalary)}/mês
              </span>
            </div>

            <div className="pt-2 border-t border-white/[0.07] flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">Novo Caixa Estimado</span>
              <span
                className={`font-mono tabular-nums font-bold ${
                  activeEvaluation.canAffordCash
                    ? 'text-zinc-200'
                    : 'text-rose-400'
                }`}
              >
                {formatCompactBRL(activeEvaluation.projectedCash)}
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">Nova Folha Mensal (Sem Limite)</span>
              <span className="font-mono tabular-nums font-bold text-zinc-200">
                {formatCompactBRL(activeEvaluation.projectedPayroll)}/mês{' '}
                <span className="text-zinc-400 font-normal">
                  ({formatCompactBRL(activeEvaluation.projectedPayroll * 12)}/ano)
                </span>
              </span>
            </div>
          </div>

          {/* Budget Guard Alert */}
          {activeEvaluation.isBlocked && activeEvaluation.blockReason && (
            <div className="rounded-2xl bg-rose-950/40 border border-rose-500/40 p-3 text-xs text-rose-200 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{activeEvaluation.blockReason}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMobileDeskOpen(false);
                  setSubTab('MEU_ELENCO');
                }}
                className="text-[11px] font-bold text-[#b5ff00] hover:underline"
              >
                Vender ou emprestar jogadores para abrir espaço →
              </button>
            </div>
          )}

          {/* Player Negotiation Cooldown Lock OR Attempts Warning */}
          {deskNegInfo.isBlocked ? (
            <div className="rounded-2xl bg-rose-950/45 border border-rose-500/45 p-3 text-xs text-rose-200 flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-rose-200">
                  Negociações encerradas com {p.name}
                </div>
                <div className="text-[11px] text-rose-200/85 mt-0.5">
                  O atleta recusou continuar negociando após as propostas anteriores. Nova tentativa liberada em{' '}
                  <strong className="text-white">
                    {deskNegInfo.blockedUntilDateLabel}
                  </strong>{' '}
                  ({deskNegInfo.remainingDays} dias restantes).
                </div>
              </div>
            </div>
          ) : deskNegInfo.activeAttemptsCount > 0 ? (
            <div className="rounded-2xl bg-amber-950/35 border border-amber-400/35 px-3 py-2.5 text-[11px] text-amber-200 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-300 shrink-0 mt-0.5" />
              <span>
                <strong className="font-mono tabular-nums text-amber-100">
                  {deskNegInfo.activeAttemptsCount}{' '}
                  {deskNegInfo.activeAttemptsCount === 1
                    ? 'proposta anterior'
                    : 'propostas anteriores'}
                </strong>{' '}
                sem acerto. O atleta pode encerrar conversas por 1 ano após 2 a 4 tentativas.
              </span>
            </div>
          ) : null}

          {/* Closed Transfer Window Notice */}
          {!windowStatus.isOpen && (
            <div className="rounded-2xl bg-rose-950/35 border border-rose-500/35 p-3 text-xs text-rose-200 flex items-start gap-2">
              <Lock className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-rose-200">
                  Janela de Transferências Fechada
                </div>
                <div className="text-[11px] text-rose-200/80 mt-0.5">
                  {windowStatus.description}
                </div>
              </div>
            </div>
          )}

          {/* Action CTA */}
          <button
            type="button"
            disabled={
              activeEvaluation.isBlocked ||
              !windowStatus.isOpen ||
              deskNegInfo.isBlocked
            }
            onClick={() =>
              onProposeTransfer({
                listing: deskListing,
                dealMode: effectiveDealMode,
                offerTier,
                offerMultiplier,
                salaryOfferMult,
                loanWageShare,
                loanDurationYears,
                contractYears,
              })
            }
            className="w-full py-3.5 px-5 rounded-full text-xs sm:text-sm font-extrabold bg-[#b5ff00] hover:bg-[#c8ff33] disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-[#090a0f] transition-colors flex items-center justify-center gap-2 shadow-lg cursor-pointer"
          >
            {windowStatus.isOpen && !deskNegInfo.isBlocked ? (
              <Handshake className="w-4 h-4" />
            ) : (
              <Lock className="w-4 h-4" />
            )}
            {!windowStatus.isOpen
              ? 'Janela de Transferências Fechada'
              : deskNegInfo.isBlocked
              ? `Bloqueado até ${deskNegInfo.blockedUntilDateLabel || 'próximo ano'}`
              : isFree
              ? 'Assinar Contrato Gratuito'
              : isLoan
              ? 'Enviar Proposta de Empréstimo'
              : 'Enviar Proposta de Compra'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3 sm:space-y-5">
      {/* Editorial Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-2 sm:gap-4 pb-1.5 sm:pb-2 border-b border-white/[0.07]">
        <div className="flex items-center justify-between md:block">
          <div>
            <span className="hidden sm:block text-xs sm:text-sm font-normal text-zinc-400 tracking-wide">
              Janela de transferências {seasonYear} · Mercado Vivo & Filtros Avançados
            </span>
            <h2 className="font-display text-2xl sm:text-5xl font-extrabold uppercase tracking-tight text-white leading-[0.95]">
              MERCADO
            </h2>
          </div>
          <div className="sm:hidden">
            <CurrencyToggle compact />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5 text-[11px] sm:text-xs text-zinc-400 font-mono">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-mono font-bold border ${
              windowStatus.isOpen
                ? 'bg-[#b5ff00]/15 border-[#b5ff00]/45 text-[#b5ff00]'
                : 'bg-rose-500/15 border-rose-500/35 text-rose-300'
            }`}
          >
            {windowStatus.isOpen ? (
              <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            ) : (
              <Lock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            )}
            {windowStatus.badgeLabel}
          </span>
          <span>
            Rep. {userClub.shortName}:{' '}
            <strong className="text-[#b5ff00]">{userClub.reputation}/100</strong>
          </span>
        </div>
      </div>

      {/* Top Financial KPIs Strip (3 columns side-by-side even on mobile for high density) */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div
          className={`rounded-2xl sm:rounded-[24px] p-2.5 sm:p-5 shadow-lg ${
            isInDebt
              ? 'bg-rose-600 text-white'
              : 'bg-[#b5ff00] text-[#090a0f]'
          }`}
        >
          <div className="flex items-center justify-between text-[9px] sm:text-[11px] font-bold uppercase font-mono opacity-85">
            <span className="truncate">{isInDebt ? 'Em Dívida' : 'Caixa'}</span>
            <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          </div>
          <div className="font-display text-lg sm:text-4xl font-extrabold tabular-nums mt-0.5 sm:mt-1 leading-none truncate">
            {formatCompactBRL(userClub.cashBalance)}
          </div>
          <div className="hidden sm:block text-[11px] opacity-85 mt-1.5 font-semibold">
            {isInDebt
              ? 'Saldo negativo — reduza salários ou venda atletas'
              : 'Disponível para compras e taxas de empréstimo'}
          </div>
        </div>

        <div className="bg-[#14171f] border border-white/[0.08] rounded-2xl sm:rounded-[24px] p-2.5 sm:p-5">
          <div className="flex items-center justify-between text-[9px] sm:text-[11px] font-mono uppercase text-zinc-400">
            <span className="truncate">Folha · Sem Limite</span>
            <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#b5ff00] shrink-0" />
          </div>
          <div className="font-display text-lg sm:text-3xl font-extrabold tabular-nums text-white mt-0.5 sm:mt-1 leading-none truncate">
            {formatCompactBRL(currentPayroll)}
            <span className="hidden sm:inline text-sm font-sans font-medium text-zinc-400">
              /mês
            </span>
          </div>
          <div className="hidden sm:block text-[11px] text-zinc-400 mt-1.5 font-mono tabular-nums">
            Custo anual: {formatCompactBRL(currentPayroll * 12)} · sem teto fixo
          </div>
        </div>

        <div className="bg-[#14171f] border border-white/[0.08] rounded-2xl sm:rounded-[24px] p-2.5 sm:p-5">
          <div className="flex items-center justify-between text-[9px] sm:text-[11px] font-mono uppercase text-zinc-400">
            <span className="truncate">Plantel</span>
            <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#b5ff00] shrink-0" />
          </div>
          <div className="font-display text-lg sm:text-3xl font-extrabold tabular-nums text-white mt-0.5 sm:mt-1 leading-none truncate">
            {squad.length} Atletas
          </div>
          <div className="text-[9px] sm:text-[11px] text-zinc-400 mt-1 sm:mt-2 truncate">
            +{transferHistoryStats.incomingCount} / -{transferHistoryStats.outgoingCount}
          </div>
        </div>
      </div>

      {/* Closed Transfer Window Banner */}
      {!windowStatus.isOpen && (
        <div className="rounded-2xl border border-rose-500/35 bg-rose-950/30 px-4 py-3.5 flex items-start gap-3 text-xs text-rose-100">
          <Lock className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-rose-200">
              {windowStatus.badgeLabel} · Negociações Bloqueadas
            </div>
            <div className="text-zinc-300 mt-0.5">{windowStatus.description}</div>
          </div>
        </div>
      )}

      {/* Feedback Toast Banner */}
      {lastFeedback && (
        <div
          key={`${lastFeedback.type}:${lastFeedback.title}`}
          className={`rounded-2xl border px-4 py-3 flex items-start justify-between gap-3 text-xs animate-market-outcome-enter ${
            lastFeedback.type === 'success'
              ? 'bg-[#b5ff00]/15 border-[#b5ff00]/50 text-white'
              : lastFeedback.type === 'counter'
              ? 'bg-amber-950/45 border-amber-400/50 text-amber-100'
              : 'bg-rose-950/40 border-rose-500/40 text-rose-100'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {lastFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[#b5ff00] shrink-0 mt-0.5" />
            ) : lastFeedback.type === 'counter' ? (
              <Handshake className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-bold">{lastFeedback.title}</div>
              <div className="text-zinc-300 mt-0.5">{lastFeedback.detail}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClearFeedback}
            aria-label="Fechar aviso"
            className="text-zinc-400 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Active Incoming Proposals from AI Clubs */}
      {activePendingOffers.length > 0 && onResolveIncomingOffer && (
        <div className="bg-[#14171f] border border-[#b5ff00]/45 rounded-[24px] p-4 sm:p-5 space-y-3 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Handshake className="w-4 h-4 text-[#b5ff00]" />
              <h3 className="font-display text-lg font-extrabold uppercase tracking-tight text-white">
                Propostas Recebidas pelo Elenco ({activePendingOffers.length})
              </h3>
            </div>
            <span className="text-[11px] font-mono text-[#b5ff00]">
              Clubes da IA interessados · Aceite, Recuse ou Negocie (+15% / +30%)
            </span>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {activePendingOffers.map((offer) => (
              <IncomingOfferCard
                key={offer.id}
                offer={offer}
                userClub={userClub}
                squad={squad}
                seasonYear={seasonYear}
                disabled={!windowStatus.isOpen}
                disabledReason={
                  !windowStatus.isOpen
                    ? `Janela de transferências fechada — ${windowStatus.description}`
                    : undefined
                }
                onResolve={onResolveIncomingOffer}
                onInspectPlayer={(player) => onInspectPlayer(player)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Market Mode Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {(
          [
            { id: 'NACIONAL_LIB', label: 'Nacional & Libertadores' },
            { id: 'INTERNACIONAL', label: 'Mercado Internacional' },
            {
              id: 'LIVRES',
              label: `Agentes Livres (${freeAgents.length})`,
            },
            { id: 'EMPRESTIMOS', label: 'Empréstimos' },
            {
              id: 'OBSERVADOS',
              label: `Observados (${watchedPlayers.length})`,
            },
            {
              id: 'MEU_ELENCO',
              label: `Meu Elenco · Vender (${squad.length})`,
            },
            {
              id: 'HISTORICO',
              label: `Histórico de Transferências (${transferHistory.length})`,
            },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id)}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${
              subTab === tab.id
                ? 'bg-[#b5ff00] text-[#090a0f] shadow-sm'
                : 'bg-[#151821] text-zinc-400 hover:text-white border border-white/[0.07]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* OUTGOING MANAGEMENT TAB (Vender / Emprestar / Devolver) */}
      {subTab === 'MEU_ELENCO' && (
        <div className="space-y-4">
          <div className="bg-[#14171f] border border-white/[0.07] rounded-[28px] overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.07] flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-xl font-extrabold uppercase tracking-tight text-white">
                  Negociar Atletas do Elenco ({squad.length})
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Venda para reforçar o caixa ou empreste atletas para aliviar
                  90% do salário mensal imediatamente.
                </p>
              </div>
              <span className="text-xs font-mono text-zinc-400">
                Mínimo obrigatório: {MIN_SQUAD_SIZE} jogadores e 1 goleiro
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/[0.07] bg-[#0b0c10]/60 text-[11px] text-zinc-400">
                    <th className="py-3 px-4 font-medium">Atleta · OVR & Posição</th>
                    <th className="py-3 px-3 font-medium">Status no Mercado</th>
                    <th className="py-3 px-3 font-medium text-right">
                      Salário Atual
                    </th>
                    <th className="py-3 px-3 font-medium text-right">
                      Venda Estimada
                    </th>
                    <th className="py-3 px-4 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {[...squad]
                    .sort(
                      (a, b) =>
                        calculatePlayerOverall(b.attributes, b.position) -
                        calculatePlayerOverall(a.attributes, a.position)
                    )
                    .map((player) => {
                      const ovr = calculatePlayerOverall(
                        player.attributes,
                        player.position
                      );
                      const ev = evaluateOutgoingPlayer(player, squad);

                      return (
                        <tr
                          key={player.id}
                          className="hover:bg-white/[0.03] transition-colors"
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <PlayerJersey
                                number={player.number}
                                variant="lime"
                                size="sm"
                              />
                              <PlayerOvrBadge
                                ovr={ovr}
                                position={player.position}
                                size="md"
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => onInspectPlayer(player)}
                                    className="font-bold text-sm text-white hover:text-[#b5ff00] text-left"
                                  >
                                    {player.name}
                                  </button>
                                  <span className="font-mono font-bold text-xs text-white tabular-nums">
                                    {player.age} anos
                                  </span>
                                  <StarRating
                                    player={player}
                                    ovr={ovr}
                                    clubReputation={userClub.reputation}
                                    size="xs"
                                  />
                                  {player.exceededExpectations ? (
                                    <span className="text-[10px] text-amber-300 font-mono font-bold" title={`⚡ Superou expectativas! Rompeu o teto (+${player.recentOvrDelta} OVR)`}>
                                      ⚡+{player.recentOvrDelta}
                                    </span>
                                  ) : player.recentOvrDelta !== undefined && player.recentOvrDelta > 0 ? (
                                    <span className="text-[10px] text-[#b5ff00] font-mono font-bold" title={`Evolução: +${player.recentOvrDelta} OVR`}>
                                      ▲+{player.recentOvrDelta}
                                    </span>
                                  ) : player.recentOvrDelta !== undefined && player.recentOvrDelta < 0 ? (
                                    <span className="text-[10px] text-rose-400 font-mono font-bold" title={`Regressão: ${player.recentOvrDelta} OVR`}>
                                      ▼{player.recentOvrDelta}
                                    </span>
                                  ) : null}
                                  {player.isTransferListed && (
                                    <span className="px-1.5 py-0.5 rounded bg-amber-400/15 border border-amber-400/35 text-[9px] font-mono font-bold text-amber-300">
                                      DISP. VENDA
                                    </span>
                                  )}
                                  {player.isLoanListed && (
                                    <span className="px-1.5 py-0.5 rounded bg-sky-400/15 border border-sky-400/35 text-[9px] font-mono font-bold text-sky-300">
                                      DISP. EMPRÉSTIMO
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-zinc-400">
                                  {player.isStarter ? 'Escalado' : 'Elenco'} ·{' '}
                                  {player.contractType === 'EMPRESTADO'
                                    ? `Emprestado (${player.loanOriginClubName || 'Clube'})`
                                    : 'Vínculo Definitivo'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            {player.contractType === 'EMPRESTADO' ? (
                              <span className="text-[11px] text-zinc-500">
                                Atleta emprestado ao clube
                              </span>
                            ) : (
                              <div className="flex flex-wrap items-center gap-1.5">
                                {onTogglePlayerMarketListing && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onTogglePlayerMarketListing(
                                          player.id,
                                          'TRANSFER'
                                        )
                                      }
                                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors ${
                                        player.isTransferListed
                                          ? 'bg-amber-400 text-[#090a0f] border-amber-400 font-extrabold'
                                          : 'bg-[#0b0c10] hover:bg-white/[0.08] text-zinc-300 border-white/10'
                                      }`}
                                    >
                                      {player.isTransferListed
                                        ? 'Listado p/ Venda ✓'
                                        : 'Disponibilizar Venda'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onTogglePlayerMarketListing(
                                          player.id,
                                          'LOAN'
                                        )
                                      }
                                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors ${
                                        player.isLoanListed
                                          ? 'bg-sky-400 text-[#090a0f] border-sky-400 font-extrabold'
                                          : 'bg-[#0b0c10] hover:bg-white/[0.08] text-zinc-300 border-white/10'
                                      }`}
                                    >
                                      {player.isLoanListed
                                        ? 'Listado p/ Emprést. ✓'
                                        : 'Disponibilizar Emprést.'}
                                    </button>
                                  </>
                                )}
                                {onSolicitOfferForPlayer &&
                                  (player.isTransferListed ||
                                    player.isLoanListed) && (
                                    <button
                                      type="button"
                                      disabled={!windowStatus.isOpen}
                                      onClick={() =>
                                        onSolicitOfferForPlayer(player.id)
                                      }
                                      title={
                                        !windowStatus.isOpen
                                          ? windowStatus.description
                                          : 'Sondar clubes interessados que precisam desta posição para receber uma proposta oficial imediatamente'
                                      }
                                      className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-[#b5ff00]/15 hover:bg-[#b5ff00]/25 disabled:opacity-40 disabled:cursor-not-allowed text-[#b5ff00] border border-[#b5ff00]/40 transition-colors"
                                    >
                                      Oferecer a Clubes
                                    </button>
                                  )}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums text-zinc-300">
                            {formatCompactBRL(getPlayerPaidSalary(player))}
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-white">
                            {player.contractType === 'EMPRESTADO'
                              ? '—'
                              : formatCompactBRL(ev.saleValue)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {player.contractType === 'EMPRESTADO' ? (
                              <button
                                type="button"
                                disabled={!ev.canReturnLoan || !windowStatus.isOpen}
                                title={
                                  !windowStatus.isOpen
                                    ? windowStatus.description
                                    : ev.blockReason || undefined
                                }
                                onClick={() =>
                                  onOutgoingTransfer({
                                    player,
                                    action: 'DEVOLVER_EMPRESTIMO',
                                  })
                                }
                                className="px-3 py-1.5 rounded-full bg-white/[0.08] hover:bg-white/[0.15] disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-bold whitespace-nowrap"
                              >
                                Devolver Empréstimo
                              </button>
                            ) : (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  disabled={!ev.canLoanOut || !windowStatus.isOpen}
                                  title={
                                    !windowStatus.isOpen
                                      ? windowStatus.description
                                      : ev.blockReason ||
                                        `Recebe ${formatCompactBRL(
                                          ev.loanOutFee
                                        )} e economiza ${formatCompactBRL(
                                          ev.monthlyWageSavedOnLoan
                                        )}/mês`
                                  }
                                  onClick={() =>
                                    onOutgoingTransfer({
                                      player,
                                      action: 'EMPRESTIMO_OUT',
                                    })
                                  }
                                  className="px-3 py-1.5 rounded-full bg-[#0b0c10] hover:bg-white/[0.08] disabled:opacity-40 disabled:cursor-not-allowed text-zinc-200 border border-white/10 text-[11px] font-bold whitespace-nowrap"
                                >
                                  Emprestar (-90% sal.)
                                </button>
                                <button
                                  type="button"
                                  disabled={!ev.canSell || !windowStatus.isOpen}
                                  title={
                                    !windowStatus.isOpen
                                      ? windowStatus.description
                                      : ev.blockReason || undefined
                                  }
                                  onClick={() =>
                                    onOutgoingTransfer({
                                      player,
                                      action: 'VENDA',
                                    })
                                  }
                                  className="px-3 py-1.5 rounded-full bg-[#b5ff00] hover:bg-[#c8ff33] disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-[#090a0f] text-[11px] font-extrabold whitespace-nowrap"
                                >
                                  Vender Direto
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {loanedOutPlayers.length > 0 && (
            <div className="bg-[#14171f] border border-white/[0.07] rounded-[28px] p-5">
              <h3 className="font-display text-lg font-extrabold uppercase tracking-tight text-white mb-3">
                Atletas Cedidos por Empréstimo em {seasonYear} ({loanedOutPlayers.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {loanedOutPlayers.map((p) => (
                  <div
                    key={p.id}
                    className="bg-[#0b0c10] border border-white/[0.07] rounded-2xl p-3.5 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-white">
                        {p.name} ({p.position})
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        Destino: {p.loanDestinationClubName || 'Clube Parceiro'}
                      </div>
                    </div>
                    <div className="text-right font-mono tabular-nums">
                      <div className="text-[#b5ff00] font-bold">
                        OVR {calculatePlayerOverall(p.attributes, p.position)}
                      </div>
                      <div className="text-[10px] text-zinc-400">
                        Custo: {formatCompactBRL(getPlayerPaidSalary(p))}/mês
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* COMPREHENSIVE TRANSFER HISTORY TAB */}
      {subTab === 'HISTORICO' && (
        <div className="space-y-4">
          {/* Window Financial Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-[#14171f] border border-white/[0.07] rounded-2xl p-4">
              <div className="text-[10px] font-mono uppercase text-zinc-400">
                Reforços Contratados
              </div>
              <div className="font-display text-2xl font-extrabold text-[#b5ff00] mt-1">
                {transferHistoryStats.incomingCount} chegada(s)
              </div>
              <div className="text-[11px] font-mono text-zinc-300 mt-1">
                Investido: {formatCompactBRL(transferHistoryStats.totalSpent)}
              </div>
            </div>

            <div className="bg-[#14171f] border border-white/[0.07] rounded-2xl p-4">
              <div className="text-[10px] font-mono uppercase text-zinc-400">
                Saídas / Vendas
              </div>
              <div className="font-display text-2xl font-extrabold text-sky-400 mt-1">
                {transferHistoryStats.outgoingCount} saída(s)
              </div>
              <div className="text-[11px] font-mono text-zinc-300 mt-1">
                Arrecadado:{' '}
                {formatCompactBRL(transferHistoryStats.totalReceived)}
              </div>
            </div>

            <div className="bg-[#14171f] border border-white/[0.07] rounded-2xl p-4">
              <div className="text-[10px] font-mono uppercase text-zinc-400">
                Balanço Líquido de Caixa
              </div>
              <div
                className={`font-display text-2xl font-extrabold mt-1 ${
                  transferHistoryStats.netBalance >= 0
                    ? 'text-[#b5ff00]'
                    : 'text-white'
                }`}
              >
                {transferHistoryStats.netBalance >= 0 ? '+' : ''}
                {formatCompactBRL(transferHistoryStats.netBalance)}
              </div>
              <div className="text-[11px] font-mono text-zinc-400 mt-1">
                Folha líquida:{' '}
                {transferHistoryStats.netWageDelta >= 0 ? '+' : ''}
                {formatCompactBRL(transferHistoryStats.netWageDelta)}/mês
              </div>
            </div>

            <div className="bg-[#14171f] border border-white/[0.07] rounded-2xl p-4">
              <div className="text-[10px] font-mono uppercase text-zinc-400">
                Negociações Totais
              </div>
              <div className="font-display text-2xl font-extrabold text-white mt-1">
                {transferHistory.length} registro(s)
              </div>
              <div className="text-[11px] font-mono text-rose-400 mt-1">
                {transferHistoryStats.rejectedCount} proposta(s) recusada(s)
              </div>
            </div>
          </div>

          {/* Transfer History Table & Filter Bar */}
          <div className="bg-[#14171f] border border-white/[0.07] rounded-[28px] overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.07] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[#b5ff00]" />
                <h3 className="font-display text-xl font-extrabold uppercase tracking-tight text-white">
                  Histórico Global de Transferências · {seasonYear}
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="Filtrar atleta ou clube..."
                    className="bg-[#0b0c10] border border-white/10 rounded-full pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#b5ff00]"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1 bg-[#0b0c10] p-1 rounded-full border border-white/[0.07]">
                  {(
                    [
                      ['ALL', 'Todas'],
                      ['ENTRADAS', 'Entradas'],
                      ['SAIDAS', 'Saídas'],
                      ['IA_MERCADO', 'Mercado IA'],
                      ['RECUSADAS', 'Recusadas'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setHistoryTypeFilter(id)}
                      className={`px-3 py-1 rounded-full text-[11px] font-bold transition-colors ${
                        historyTypeFilter === id
                          ? 'bg-[#b5ff00] text-[#090a0f]'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {filteredHistory.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-400">
                {transferHistory.length === 0
                  ? 'Nenhuma negociação realizada nesta temporada ainda. Explore o mercado nacional, internacional ou empréstimos para contratar reforços.'
                  : 'Nenhum registro corresponde ao filtro selecionado no histórico.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.07] bg-[#0b0c10]/60 text-[11px] text-zinc-400">
                      <th className="py-3 px-4 font-medium">Data</th>
                      <th className="py-3 px-3 font-medium">Operação</th>
                      <th className="py-3 px-3 font-medium">Atleta</th>
                      <th className="py-3 px-3 font-medium">Clube Envolvido</th>
                      <th className="py-3 px-3 font-medium text-right">
                        Taxa / Passe
                      </th>
                      <th className="py-3 px-4 font-medium text-right">
                        Impacto na Folha
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {filteredHistory.map((rec) => {
                      const badge = formatTransferRecordBadge(rec);
                      return (
                        <tr
                          key={rec.id}
                          className="hover:bg-white/[0.03] transition-colors"
                        >
                          <td className="py-3.5 px-4 font-mono text-[11px] text-zinc-400 whitespace-nowrap">
                            {rec.date}
                          </td>
                          <td className="py-3.5 px-3">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border whitespace-nowrap ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                          </td>
                          <td className="py-3.5 px-3">
                            <div className="font-bold text-white">
                              {rec.playerName}{' '}
                              <span className="font-mono text-xs text-[#b5ff00]">
                                ({rec.position} · OVR {rec.ovr})
                              </span>
                            </div>
                            <div className="text-[11px] text-zinc-400 mt-0.5">
                              {rec.note}
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-zinc-300 font-medium">
                            {rec.counterpartyClubName}
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono tabular-nums font-bold text-white whitespace-nowrap">
                            {rec.feeAmount === 0
                              ? `${formatCompactBRL(0)} (Livre)`
                              : formatCompactBRL(rec.feeAmount)}
                          </td>
                          <td
                            className={`py-3.5 px-4 text-right font-mono tabular-nums font-bold whitespace-nowrap ${
                              rec.status === 'RECUSADA'
                                ? 'text-zinc-500'
                                : rec.monthlySalaryImpact <= 0
                                ? 'text-[#b5ff00]'
                                : 'text-amber-300'
                            }`}
                          >
                            {rec.status === 'RECUSADA'
                              ? 'Sem efeito'
                              : `${rec.monthlySalaryImpact >= 0 ? '+' : ''}${formatCompactBRL(
                                  rec.monthlySalaryImpact
                                )}/mês`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* WATCHLIST / OBSERVADOS TAB */}
      {subTab === 'OBSERVADOS' && (
        <div className="space-y-4">
          {/* Watchlist KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-[#14171f] border border-white/[0.07] rounded-2xl p-4">
              <div className="text-[10px] font-mono uppercase text-zinc-400">
                Lista de Observação
              </div>
              <div className="font-display text-2xl font-extrabold text-white mt-1">
                {watchlistStats.total} atleta(s)
              </div>
              <div className="text-[11px] font-mono text-zinc-400 mt-1">
                Monitoramento contínuo de valor e OVR
              </div>
            </div>

            <div className="bg-[#14171f] border border-white/[0.07] rounded-2xl p-4">
              <div className="text-[10px] font-mono uppercase text-zinc-400">
                Em Valorização / Evolução
              </div>
              <div className="font-display text-2xl font-extrabold text-[#b5ff00] mt-1">
                {watchlistStats.appreciatedCount} em alta
              </div>
              <div className="text-[11px] font-mono text-zinc-400 mt-1">
                Subiram de valor ou OVR desde a inclusão
              </div>
            </div>

            <div className="bg-[#14171f] border border-white/[0.07] rounded-2xl p-4">
              <div className="text-[10px] font-mono uppercase text-zinc-400">
                Desvalorizados / Queda
              </div>
              <div className="font-display text-2xl font-extrabold text-rose-400 mt-1">
                {watchlistStats.declinedCount} em baixa
              </div>
              <div className="text-[11px] font-mono text-zinc-400 mt-1">
                Queda de valor de mercado ou OVR
              </div>
            </div>

            <div className="bg-[#14171f] border border-white/[0.07] rounded-2xl p-4">
              <div className="text-[10px] font-mono uppercase text-zinc-400">
                Alertas de Status / Clube
              </div>
              <div className="font-display text-2xl font-extrabold text-amber-300 mt-1">
                {watchlistStats.statusChangesCount} alerta(s)
              </div>
              <div className="text-[11px] font-mono text-zinc-400 mt-1">
                Transferências, passes livres ou lesões
              </div>
            </div>
          </div>

          {/* Filter & Sort Bar */}
          <div className="bg-[#14171f] border border-white/[0.08] rounded-[24px] p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={watchlistSearch}
                  onChange={(e) => setWatchlistSearch(e.target.value)}
                  placeholder="Buscar atleta ou clube observado..."
                  aria-label="Buscar na lista de observação"
                  className="w-full bg-[#0b0c10] border border-white/[0.08] rounded-full pl-9 pr-4 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#b5ff00]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1 bg-[#0b0c10] p-1 rounded-full border border-white/[0.07]">
                {(
                  [
                    ['TODOS', 'Todos'],
                    ['VALORIZADOS', 'Em Alta'],
                    ['DESVALORIZADOS', 'Em Queda'],
                    ['MUDANCA_STATUS', 'Mudança de Status'],
                    ['DISPONIVEIS', 'Acessíveis'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setWatchlistFilter(id)}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold transition-colors ${
                      watchlistFilter === id
                        ? 'bg-[#b5ff00] text-[#090a0f]'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <select
              aria-label="Ordenar observados"
              value={watchlistSort}
              onChange={(e) =>
                setWatchlistSort(e.target.value as WatchlistSortKey)
              }
              className="bg-[#0b0c10] border border-white/[0.08] rounded-full px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#b5ff00]"
            >
              <option value="RECENT">Adicionados Recentemente</option>
              <option value="VALUE_DELTA_DESC">Maior Valorização</option>
              <option value="OVR_DELTA_DESC">Maior Evolução de OVR</option>
              <option value="OVR_DESC">Maior OVR Atual</option>
              <option value="VALUE_ASC">Menor Valor Atual</option>
            </select>
          </div>

          {watchedPlayers.length === 0 ? (
            <div className="bg-[#14171f] border border-white/[0.07] rounded-[28px] p-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#b5ff00]/15 border border-[#b5ff00]/35 flex items-center justify-center mx-auto text-[#b5ff00]">
                <Bookmark className="w-6 h-6" />
              </div>
              <h3 className="font-display text-2xl font-extrabold uppercase text-white">
                Nenhum Atleta Observado Ainda
              </h3>
              <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                Clique no ícone de marcador em qualquer jogador do mercado ou
                em &ldquo;Observar&rdquo; na mesa de negociação para acompanhar
                evolução de OVR, mudanças de clube e variações de valor ao longo
                das temporadas.
              </p>
              <button
                type="button"
                onClick={() => setSubTab('NACIONAL_LIB')}
                className="px-5 py-2 rounded-full bg-[#b5ff00] text-[#090a0f] text-xs font-extrabold"
              >
                Explorar Mercado Agora
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
              {/* Watched Players List */}
              <div className="xl:col-span-7 bg-[#14171f] border border-white/[0.07] rounded-[28px] overflow-hidden">
                <div className="px-5 py-3.5 border-b border-white/[0.07] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-semibold text-white">
                    <BookmarkCheck className="w-4 h-4 text-[#b5ff00]" />
                    <span>
                      {filteredWatchlist.length} atleta(s) monitorado(s)
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-400">
                    Compare valor inicial × valor atual
                  </span>
                </div>

                {filteredWatchlist.length === 0 ? (
                  <div className="p-8 text-center text-xs text-zinc-400 space-y-2">
                    <div>
                      Nenhum jogador observado corresponde ao filtro atual.
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setWatchlistFilter('TODOS');
                        setWatchlistSearch('');
                      }}
                      className="px-4 py-1.5 rounded-full bg-[#b5ff00] text-[#090a0f] font-bold text-xs"
                    >
                      Mostrar Todos
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.05]">
                    {filteredWatchlist.map((item) => {
                      const isSelected =
                        selectedWatchedItem?.entry.playerId ===
                        item.entry.playerId;
                      const diffStyle = item.evaluation
                        ? DIFFICULTY_STYLES[item.evaluation.level]
                        : null;

                      return (
                        <div
                          key={item.entry.playerId}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleSelectWatched(item)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleSelectWatched(item);
                            }
                          }}
                          className={`w-full text-left px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-[#b5ff00]/10 border-l-2 border-l-[#b5ff00]'
                              : 'hover:bg-white/[0.03]'
                          }`}
                        >
                          <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
                            {item.currentPlayer && (
                              <PlayerJersey
                                number={item.currentPlayer.number}
                                variant={item.listing?.originClub ? 'club' : 'dark'}
                                customColor={
                                  item.listing?.originClub?.primaryColor ||
                                  '#b5ff00'
                                }
                                size="sm"
                              />
                            )}
                            <PlayerOvrBadge
                              ovr={item.currentOvr}
                              position={item.entry.position}
                              size="md"
                            />

                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-sm text-white truncate">
                                  {item.entry.playerName}
                                </span>
                                {item.currentPlayer && (
                                  <StarRating
                                    player={item.currentPlayer}
                                    ovr={item.currentOvr}
                                    clubReputation={
                                      item.listing?.originClub?.reputation ??
                                      userClub.reputation
                                    }
                                    size="xs"
                                  />
                                )}
                                {item.ovrDeltaSinceAdded !== 0 && (
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                                      item.ovrDeltaSinceAdded > 0
                                        ? 'bg-[#b5ff00]/15 text-[#b5ff00]'
                                        : 'bg-rose-500/15 text-rose-300'
                                    }`}
                                    title={`OVR ao observar: ${item.entry.addedOvr}`}
                                  >
                                    {item.ovrDeltaSinceAdded > 0
                                      ? `▲ +${item.ovrDeltaSinceAdded}`
                                      : `▼ ${item.ovrDeltaSinceAdded}`}{' '}
                                    OVR
                                  </span>
                                )}
                                {item.statusType === 'IN_USER_SQUAD' && (
                                  <span className="px-1.5 py-0.5 rounded bg-[#b5ff00]/20 border border-[#b5ff00]/45 text-[#b5ff00] text-[10px] font-mono font-bold">
                                    NO SEU ELENCO
                                  </span>
                                )}
                                {item.statusType === 'LOANED_OUT' && (
                                  <span className="px-1.5 py-0.5 rounded bg-sky-500/15 border border-sky-500/35 text-sky-300 text-[10px] font-mono font-bold">
                                    EMPRESTADO
                                  </span>
                                )}
                                {item.statusType === 'UNAVAILABLE' && (
                                  <span className="px-1.5 py-0.5 rounded bg-zinc-700/40 border border-white/10 text-zinc-300 text-[10px] font-mono font-bold">
                                    INDISPONÍVEL
                                  </span>
                                )}
                                {item.clubChanged && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/35 text-amber-300 text-[10px] font-mono font-bold">
                                    MUDOU DE CLUBE
                                  </span>
                                )}
                                {item.currentPlayer?.injured && (
                                  <span className="px-1.5 py-0.5 rounded bg-rose-500/15 border border-rose-500/35 text-rose-300 text-[10px] font-mono font-bold">
                                    LESIONADO
                                  </span>
                                )}
                              </div>

                              <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 flex-wrap">
                                {item.listing?.originClub && (
                                  <ClubBadge
                                    clubId={item.listing.originClub.id}
                                    abbr={item.listing.originClub.abbr}
                                    name={item.listing.originClub.name}
                                    primaryColor={
                                      item.listing.originClub.primaryColor
                                    }
                                    size="xs"
                                  />
                                )}
                                <span>
                                  {item.currentAge} anos
                                  {item.ageDelta > 0
                                    ? ` (+${item.ageDelta}a)`
                                    : ''}{' '}
                                  ·{' '}
                                  {item.clubChanged ? (
                                    <span className="text-amber-300 font-medium">
                                      {item.entry.addedClubName} →{' '}
                                      {item.currentClubName}
                                    </span>
                                  ) : (
                                    item.currentClubName
                                  )}
                                </span>
                                <span className="text-zinc-600">·</span>
                                <span className="text-zinc-500 font-mono text-[10px]">
                                  Obs. desde {item.entry.addedAtDate}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pl-14 sm:pl-0">
                            <div className="text-left sm:text-right">
                              <div className="font-mono tabular-nums text-xs font-bold text-white flex items-center sm:justify-end gap-1.5">
                                <span>
                                  {item.listing?.scope === 'LIVRES'
                                    ? 'Passe Livre'
                                    : formatCompactBRL(item.currentMarketValue)}
                                </span>
                                {item.valueDelta !== 0 && (
                                  <span
                                    className={`text-[10px] font-bold inline-flex items-center gap-0.5 ${
                                      item.valueDelta > 0
                                        ? 'text-[#b5ff00]'
                                        : 'text-rose-400'
                                    }`}
                                  >
                                    {item.valueDelta > 0 ? (
                                      <TrendingUp className="w-3 h-3" />
                                    ) : (
                                      <TrendingDown className="w-3 h-3" />
                                    )}
                                    {item.valueDelta > 0 ? '+' : ''}
                                    {formatCompactBRL(item.valueDelta)}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] font-mono tabular-nums text-zinc-400">
                                {formatCompactBRL(item.currentSalary)}/mês
                                {item.salaryDelta !== 0 && (
                                  <span
                                    className={`ml-1 text-[10px] ${
                                      item.salaryDelta > 0
                                        ? 'text-amber-300'
                                        : 'text-[#b5ff00]'
                                    }`}
                                  >
                                    ({item.salaryDelta > 0 ? '+' : ''}
                                    {formatCompactBRL(item.salaryDelta)})
                                  </span>
                                )}
                              </div>
                            </div>

                            {item.evaluation && diffStyle && (
                              <div className="hidden md:block text-right min-w-[74px]">
                                <div
                                  className={`text-[11px] font-bold ${diffStyle.text}`}
                                >
                                  {item.evaluation.level}
                                </div>
                                <div className="text-[10px] font-mono tabular-nums text-zinc-500">
                                  {item.evaluation.acceptanceChance}% aceite
                                </div>
                              </div>
                            )}

                            <div className="flex items-center gap-1">
                              {item.currentPlayer && (
                                <button
                                  type="button"
                                  title="Inspecionar 18 atributos"
                                  aria-label={`Inspecionar ${item.entry.playerName}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onInspectPlayer(
                                      item.currentPlayer!,
                                      item.listing || undefined
                                    );
                                  }}
                                  className="p-2 rounded-full bg-white/[0.06] hover:bg-white/[0.14] text-zinc-300 hover:text-[#b5ff00] transition-colors"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {onRemoveWatchedPlayer && (
                                <button
                                  type="button"
                                  title="Remover dos observados"
                                  aria-label={`Remover ${item.entry.playerName} dos observados`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onRemoveWatchedPlayer(item.entry.playerId);
                                  }}
                                  className="p-2 rounded-full bg-white/[0.05] hover:bg-rose-500/20 text-zinc-400 hover:text-rose-300 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right Column: Monitoring History + Negotiation Desk */}
              <div className="hidden xl:block xl:col-span-5 xl:sticky xl:top-20 space-y-4">
                {selectedWatchedItem && (
                  <>
                    {/* Baseline vs Live Monitoring Card */}
                    <div className="bg-[#14171f] border border-white/[0.08] rounded-[24px] p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <BookmarkCheck className="w-4 h-4 text-[#b5ff00]" />
                          <span className="text-xs font-mono uppercase tracking-wider font-bold text-white">
                            Histórico de Monitoramento
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-zinc-400">
                          Desde {selectedWatchedItem.entry.addedAtDate}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-[#0b0c10] border border-white/[0.06] rounded-xl p-2.5">
                          <div className="text-[10px] text-zinc-500 font-mono uppercase">
                            Evolução OVR
                          </div>
                          <div className="font-mono font-bold text-white mt-0.5 flex items-center gap-1.5">
                            <span className="text-zinc-400">
                              {selectedWatchedItem.entry.addedOvr}
                            </span>
                            <span className="text-zinc-600">→</span>
                            <span className="text-[#b5ff00]">
                              {selectedWatchedItem.currentOvr}
                            </span>
                            {selectedWatchedItem.ovrDeltaSinceAdded !== 0 && (
                              <span
                                className={`text-[10px] ${
                                  selectedWatchedItem.ovrDeltaSinceAdded > 0
                                    ? 'text-[#b5ff00]'
                                    : 'text-rose-400'
                                }`}
                              >
                                (
                                {selectedWatchedItem.ovrDeltaSinceAdded > 0
                                  ? `+${selectedWatchedItem.ovrDeltaSinceAdded}`
                                  : selectedWatchedItem.ovrDeltaSinceAdded}
                                )
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="bg-[#0b0c10] border border-white/[0.06] rounded-xl p-2.5">
                          <div className="text-[10px] text-zinc-500 font-mono uppercase">
                            Valor de Mercado
                          </div>
                          <div className="font-mono font-bold text-white mt-0.5 flex items-center gap-1 flex-wrap">
                            <span className="text-zinc-400 text-[11px]">
                              {formatCompactBRL(
                                selectedWatchedItem.entry.addedMarketValue
                              )}
                            </span>
                            <span className="text-zinc-600">→</span>
                            <span>
                              {formatCompactBRL(
                                selectedWatchedItem.currentMarketValue
                              )}
                            </span>
                            {selectedWatchedItem.valueDelta !== 0 && (
                              <span
                                className={`text-[10px] ${
                                  selectedWatchedItem.valueDelta > 0
                                    ? 'text-[#b5ff00]'
                                    : 'text-rose-400'
                                }`}
                              >
                                ({selectedWatchedItem.valueDeltaPct > 0 ? '+' : ''}
                                {selectedWatchedItem.valueDeltaPct}%)
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="bg-[#0b0c10] border border-white/[0.06] rounded-xl p-2.5">
                          <div className="text-[10px] text-zinc-500 font-mono uppercase">
                            Clube / Vínculo
                          </div>
                          <div className="text-[11px] font-semibold text-white mt-0.5 truncate">
                            {selectedWatchedItem.clubChanged ? (
                              <span className="text-amber-300">
                                {selectedWatchedItem.entry.addedClubName} →{' '}
                                {selectedWatchedItem.currentClubName}
                              </span>
                            ) : (
                              selectedWatchedItem.currentClubName
                            )}
                          </div>
                        </div>

                        <div className="bg-[#0b0c10] border border-white/[0.06] rounded-xl p-2.5">
                          <div className="text-[10px] text-zinc-500 font-mono uppercase">
                            Desempenho {seasonYear}
                          </div>
                          <div className="font-mono text-[11px] text-zinc-200 mt-0.5">
                            {selectedWatchedItem.currentPlayer
                              ? `${selectedWatchedItem.currentPlayer.seasonStats.matches}j · ${selectedWatchedItem.currentPlayer.seasonStats.goals}g · ${selectedWatchedItem.currentPlayer.seasonStats.assists}a · ${selectedWatchedItem.currentPlayer.seasonStats.avgRating.toFixed(1)}`
                              : 'Sem dados'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {selectedWatchedItem.listing ? (
                      renderNegotiationDesk(false)
                    ) : (
                      <div className="bg-[#14171f] border border-white/[0.08] rounded-[24px] p-5 space-y-3 text-xs">
                        <div className="font-bold text-white text-sm">
                          {selectedWatchedItem.statusType === 'IN_USER_SQUAD'
                            ? `${selectedWatchedItem.entry.playerName} já faz parte do seu elenco`
                            : selectedWatchedItem.statusType === 'LOANED_OUT'
                            ? `${selectedWatchedItem.entry.playerName} está cedido por empréstimo`
                            : `${selectedWatchedItem.entry.playerName} não está disponível no mercado`}
                        </div>
                        <p className="text-zinc-400">
                          {selectedWatchedItem.statusType === 'IN_USER_SQUAD'
                            ? 'Você já concluiu a contratação deste atleta. Ele pode ser gerenciado na aba Meu Elenco ou removido da lista de observação.'
                            : 'O atleta não está listado para transferência no momento (aposentadoria ou saída de catálogo).'}
                        </p>
                        <div className="flex items-center gap-2">
                          {selectedWatchedItem.currentPlayer && (
                            <button
                              type="button"
                              onClick={() =>
                                onInspectPlayer(
                                  selectedWatchedItem.currentPlayer!
                                )
                              }
                              className="px-4 py-2 rounded-full bg-white/[0.08] hover:bg-white/[0.15] text-white font-bold flex items-center gap-1.5"
                            >
                              <Eye className="w-3.5 h-3.5 text-[#b5ff00]" />
                              <span>Ver 18 Atributos</span>
                            </button>
                          )}
                          {onRemoveWatchedPlayer && (
                            <button
                              type="button"
                              onClick={() =>
                                onRemoveWatchedPlayer(
                                  selectedWatchedItem.entry.playerId
                                )
                              }
                              className="px-4 py-2 rounded-full bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-bold"
                            >
                              Remover da Lista
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* INCOMING MARKET WORKSPACE */}
      {subTab !== 'MEU_ELENCO' &&
        subTab !== 'HISTORICO' &&
        subTab !== 'OBSERVADOS' && (
        <div className="space-y-3 sm:space-y-4">
          {/* Primary & Advanced Filter Panel */}
          <div
            data-testid="market-filter-panel"
            className="bg-[#14171f] border border-white/[0.08] rounded-2xl sm:rounded-[24px] p-3 sm:p-4 space-y-2.5 sm:space-y-3"
          >
            {/* Row 1: Search, Competition Scope & Sort (Balanced Full-Width Grid) */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <div
                className={`relative ${
                  subTab === 'NACIONAL_LIB' || subTab === 'INTERNACIONAL'
                    ? 'sm:col-span-5'
                    : 'sm:col-span-8'
                }`}
              >
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar atleta, clube ou país..."
                  aria-label="Buscar no mercado de transferências"
                  className="w-full bg-[#0b0c10] border border-white/[0.08] rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#b5ff00]"
                />
              </div>

              {subTab === 'NACIONAL_LIB' && (
                <div className="grid grid-cols-2 sm:contents gap-2">
                  <select
                    aria-label="Filtrar competição"
                    value={domesticScope}
                    onChange={(e) =>
                      setDomesticScope(e.target.value as DomesticScopeFilter)
                    }
                    className="w-full sm:col-span-3 bg-[#0b0c10] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#b5ff00]"
                  >
                    <option value="ALL">Todas Ligas (A/B/Lib)</option>
                    <option value="SERIE_A">Série A</option>
                    <option value="SERIE_B">Série B</option>
                    <option value="LIBERTADORES">Libertadores</option>
                  </select>

                  <select
                    aria-label="Ordenar mercado"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortKey)}
                    className="w-full sm:col-span-4 bg-[#0b0c10] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#b5ff00]"
                  >
                    <option value="OVR_DESC">Maior Nível (OVR)</option>
                    <option value="STARS_DESC">Maior Potencial (★)</option>
                    <option value="EASIEST">Menor Dificuldade</option>
                    <option value="FEE_ASC">Menor Preço / Taxa</option>
                    <option value="FEE_DESC">Maior Preço / Taxa</option>
                    <option value="SALARY_ASC">Menor Salário Mensal</option>
                    <option value="AGE_ASC">Mais Jovens Primeiro</option>
                    <option value="OVR_ASC">Menor OVR</option>
                  </select>
                </div>
              )}

              {subTab === 'INTERNACIONAL' && (
                <div className="grid grid-cols-2 sm:contents gap-2">
                  <select
                    aria-label="Filtrar liga internacional"
                    value={intlScope}
                    onChange={(e) =>
                      setIntlScope(e.target.value as IntlScopeFilter)
                    }
                    className="w-full sm:col-span-3 bg-[#0b0c10] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#b5ff00]"
                  >
                    <option value="ALL">Todas Internacionais</option>
                    <option value="CHAMPIONS">Champions (16)</option>
                    <option value="MUNDIAL_OUTROS">Mundial & Europa</option>
                  </select>

                  <select
                    aria-label="Ordenar mercado"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortKey)}
                    className="w-full sm:col-span-4 bg-[#0b0c10] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#b5ff00]"
                  >
                    <option value="OVR_DESC">Maior Nível (OVR)</option>
                    <option value="STARS_DESC">Maior Potencial (★)</option>
                    <option value="EASIEST">Menor Dificuldade</option>
                    <option value="FEE_ASC">Menor Preço / Taxa</option>
                    <option value="FEE_DESC">Maior Preço / Taxa</option>
                    <option value="SALARY_ASC">Menor Salário Mensal</option>
                    <option value="AGE_ASC">Mais Jovens Primeiro</option>
                    <option value="OVR_ASC">Menor OVR</option>
                  </select>
                </div>
              )}

              {subTab !== 'NACIONAL_LIB' && subTab !== 'INTERNACIONAL' && (
                <select
                  aria-label="Ordenar mercado"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortKey)}
                  className="w-full sm:col-span-4 bg-[#0b0c10] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#b5ff00]"
                >
                  <option value="OVR_DESC">Maior Nível (OVR)</option>
                  <option value="STARS_DESC">Maior Potencial (★)</option>
                  <option value="EASIEST">Menor Dificuldade</option>
                  <option value="FEE_ASC">Menor Preço / Taxa</option>
                  <option value="FEE_DESC">Maior Preço / Taxa</option>
                  <option value="SALARY_ASC">Menor Salário Mensal</option>
                  <option value="AGE_ASC">Mais Jovens Primeiro</option>
                  <option value="OVR_ASC">Menor OVR</option>
                </select>
              )}
            </div>

            {/* Row 2: Sectors + Star Potential Filter + Quick Toggles (Zero Scrollbar, Full Occupancy) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-center">
              {/* Sector Filter (5 equal columns) */}
              <div className="lg:col-span-4 grid grid-cols-5 gap-1 bg-[#0b0c10] p-1 rounded-xl border border-white/[0.07]">
                {(['ALL', 'GOL', 'DEF', 'MEI', 'ATA'] as const).map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => {
                      setSectorFilter(sec);
                      if (sec !== 'ALL') setPositionFilter('ALL');
                    }}
                    className={`py-1.5 rounded-lg text-[11px] font-bold transition-colors text-center cursor-pointer ${
                      sectorFilter === sec
                        ? 'bg-[#b5ff00] text-[#090a0f] font-extrabold'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {sec === 'ALL' ? 'Todos' : sec}
                  </button>
                ))}
              </div>

              {/* Potential Stars Filter (6 equal columns) */}
              <div
                data-testid="market-star-filter"
                aria-label="Filtrar por estrelas de potencial"
                className="lg:col-span-5 grid grid-cols-6 gap-1 bg-[#0b0c10] p-1 rounded-xl border border-white/[0.07]"
              >
                {(
                  [
                    { val: 0, label: 'Todas' },
                    { val: 3, label: '3★+' },
                    { val: 3.5, label: '3.5★' },
                    { val: 4, label: '4★+' },
                    { val: 4.5, label: '4.5★' },
                    { val: 5, label: '5★' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => setMinStarsFilter(opt.val)}
                    title={
                      opt.val === 0
                        ? 'Mostrar todas as estrelas'
                        : `Filtrar atletas com pelo menos ${opt.val} estrelas`
                    }
                    className={`min-w-0 py-1.5 px-1 rounded-lg text-[10px] sm:text-[11px] font-bold transition-colors flex items-center justify-center gap-0.5 whitespace-nowrap cursor-pointer ${
                      minStarsFilter === opt.val
                        ? opt.val === 0
                          ? 'bg-white/[0.12] text-white font-extrabold'
                          : 'bg-amber-400 text-[#090a0f] font-extrabold'
                        : 'text-zinc-400 hover:text-amber-300'
                    }`}
                  >
                    {opt.val === 0 && (
                      <Star className="w-2.5 h-2.5 shrink-0 fill-amber-400 text-amber-400" />
                    )}
                    <span className="truncate">{opt.label}</span>
                  </button>
                ))}
              </div>

              {/* Filters & Affordable Quick Actions (2 equal columns) */}
              <div className="lg:col-span-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdvancedFilters((v) => !v)}
                  className={`py-2 px-2.5 rounded-xl text-[11px] sm:text-xs font-bold border transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    showAdvancedFilters || activeAdvancedFilterCount > 0
                      ? 'bg-[#b5ff00]/15 border-[#b5ff00] text-[#b5ff00]'
                      : 'bg-[#0b0c10] border-white/[0.08] text-zinc-300 hover:text-white'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Filtros
                    {activeAdvancedFilterCount > 0
                      ? ` (${activeAdvancedFilterCount})`
                      : ''}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setOnlyAffordable((v) => !v)}
                  className={`py-2 px-2.5 rounded-xl text-[11px] sm:text-xs font-bold border transition-colors flex items-center justify-center whitespace-nowrap cursor-pointer ${
                    onlyAffordable
                      ? 'bg-[#b5ff00] border-[#b5ff00] text-[#090a0f] font-extrabold'
                      : 'bg-[#0b0c10] border-white/[0.08] text-zinc-300 hover:text-white'
                  }`}
                >
                  {onlyAffordable ? '✓ Acessíveis' : 'Acessíveis'}
                </button>
              </div>
            </div>

            {/* Row 3: Club Availability Filter Bar + Opponent Club Needs Radar Toggle (Zero Horizontal Overflow) */}
            {subTab !== 'LIVRES' && (
              <div className="pt-2.5 border-t border-white/[0.06] flex flex-col lg:flex-row lg:items-center justify-between gap-2">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                  <span className="hidden xl:inline text-[10px] font-mono uppercase tracking-wider text-zinc-400 shrink-0">
                    Clubes:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 w-full lg:max-w-2xl">
                    {(
                      [
                        {
                          id: 'ALL',
                          label: 'Todos',
                          badgeClass:
                            'bg-[#b5ff00] text-[#090a0f] border-[#b5ff00] font-extrabold',
                        },
                        {
                          id: 'LISTED_ANY',
                          label: `Listados (${clubListingCounts.listedAny})`,
                          badgeClass:
                            'bg-[#b5ff00] text-[#090a0f] border-[#b5ff00] font-extrabold',
                        },
                        {
                          id: 'LISTED_BUY',
                          label: `Compra (${clubListingCounts.listedBuy})`,
                          badgeClass:
                            'bg-amber-400 text-[#090a0f] border-amber-400 font-extrabold',
                        },
                        {
                          id: 'LISTED_LOAN',
                          label: `Empréstimo (${clubListingCounts.listedLoan})`,
                          badgeClass:
                            'bg-sky-400 text-[#090a0f] border-sky-400 font-extrabold',
                        },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setClubListingFilter(opt.id);
                          if (opt.id === 'LISTED_LOAN') setDealMode('LOAN');
                          if (opt.id === 'LISTED_BUY') setDealMode('BUY');
                        }}
                        className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-colors text-center truncate cursor-pointer ${
                          clubListingFilter === opt.id
                            ? opt.badgeClass
                            : 'bg-[#0b0c10] border-white/[0.08] text-zinc-300 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowClubRadar((v) => !v)}
                  className={`w-full lg:w-auto px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    showClubRadar
                      ? 'bg-[#b5ff00]/20 border-[#b5ff00] text-[#b5ff00]'
                      : 'bg-[#0b0c10] border-white/[0.08] text-zinc-300 hover:text-white'
                  }`}
                >
                  {showClubRadar ? 'Ocultar Radar IA' : 'Radar Clubes IA'}
                </button>
              </div>
            )}

            {/* Collapsible Opponent Clubs Strategic Radar (Purchases, Sales, Loans & Positional Needs) */}
            {showClubRadar && subTab !== 'LIVRES' && (
              <div className="pt-3 border-t border-white/[0.07] space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-white">
                      Pensamento de Mercado dos Clubes Adversários
                    </h4>
                    <p className="text-[11px] text-zinc-400">
                      Veja o que cada clube busca contratar, sua postura financeira e quantos atletas disponibilizou para venda ou empréstimo. Clique em um clube para filtrar seus jogadores listados.
                    </p>
                  </div>
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setClubListingFilter('ALL');
                      }}
                      className="text-[11px] font-bold text-[#b5ff00] hover:underline"
                    >
                      Limpar filtro de clube
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 max-h-72 overflow-y-auto pr-1">
                  {Array.from(aiClubProfilesMap.values())
                    .filter(({ club }) => {
                      if (subTab === 'NACIONAL_LIB') {
                        if (club.division === 'UCL' || club.division === 'WORLD')
                          return false;
                        if (domesticScope === 'SERIE_A' && club.division !== 'A')
                          return false;
                        if (domesticScope === 'SERIE_B' && club.division !== 'B')
                          return false;
                        if (
                          domesticScope === 'LIBERTADORES' &&
                          club.division !== 'LIB'
                        )
                          return false;
                      } else if (subTab === 'INTERNACIONAL') {
                        if (club.division !== 'UCL' && club.division !== 'WORLD')
                          return false;
                        if (intlScope === 'CHAMPIONS' && club.division !== 'UCL')
                          return false;
                        if (
                          intlScope === 'MUNDIAL_OUTROS' &&
                          club.division !== 'WORLD'
                        )
                          return false;
                      }
                      return true;
                    })
                    .map(({ club, profile, listedBuyPlayers, listedLoanPlayers }) => (
                      <button
                        key={club.id}
                        type="button"
                        onClick={() => {
                          setSearchQuery(club.name);
                          setClubListingFilter('LISTED_ANY');
                        }}
                        className="text-left bg-[#0b0c10] hover:bg-white/[0.04] border border-white/[0.08] rounded-2xl p-3 space-y-1.5 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <ClubBadge
                              clubId={club.id}
                              abbr={club.abbr}
                              name={club.name}
                              primaryColor={club.primaryColor}
                              size="xs"
                            />
                            <span className="font-bold text-xs text-white truncate">
                              {club.shortName}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-[#b5ff00] shrink-0">
                            {profile.posture === 'COMPRADOR'
                              ? 'Comprador'
                              : profile.posture === 'VENDEDOR_ALIVIO_FOLHA'
                              ? 'Alívio Folha'
                              : profile.posture === 'BUSCA_EMPRESTIMOS'
                              ? 'Busca Emprést.'
                              : 'Equilibrado'}
                          </span>
                        </div>

                        <div className="text-[11px] text-zinc-300 flex items-center justify-between gap-2">
                          <span>
                            Busca:{' '}
                            <strong className="font-mono text-white">
                              {profile.neededPositions.slice(0, 3).join(', ')}
                            </strong>
                          </span>
                          <span className="font-mono text-[10px] text-zinc-400">
                            Folha {profile.wageUsagePct}%
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 pt-0.5 text-[10px] font-mono">
                          <span className="px-2 py-0.5 rounded bg-amber-400/15 border border-amber-400/30 text-amber-300 font-bold">
                            {listedBuyPlayers.length} p/ Compra
                          </span>
                          <span className="px-2 py-0.5 rounded bg-sky-400/15 border border-sky-400/30 text-sky-300 font-bold">
                            {listedLoanPlayers.length} p/ Empréstimo
                          </span>
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Expandable Advanced Filters Grid (Position, Price Range, OVR/Skill Level, Specific Attribute, Age, Difficulty) */}
            {showAdvancedFilters && (
              <div className="pt-3 border-t border-white/[0.07] space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-2.5">
                  {/* 1. Exact Position Filter */}
                  <div>
                    <label
                      htmlFor="adv-pos-filter"
                      className="block text-[10px] font-mono uppercase text-zinc-400 mb-1"
                    >
                      Posição Específica
                    </label>
                    <select
                      id="adv-pos-filter"
                      value={positionFilter}
                      onChange={(e) => {
                        const val = e.target.value as 'ALL' | NaturalPosition;
                        setPositionFilter(val);
                        if (val !== 'ALL') setSectorFilter('ALL');
                      }}
                      className="w-full bg-[#0b0c10] border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-[#b5ff00]"
                    >
                      {NATURAL_POSITIONS.map((pos) => (
                        <option key={pos.value} value={pos.value}>
                          {pos.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 2. Price / Fee Range Filter */}
                  <div>
                    <label
                      htmlFor="adv-price-filter"
                      className="block text-[10px] font-mono uppercase text-zinc-400 mb-1"
                    >
                      Faixa de Preço (Passe/Taxa)
                    </label>
                    <select
                      id="adv-price-filter"
                      value={priceRangeFilter}
                      onChange={(e) =>
                        setPriceRangeFilter(e.target.value as PriceRangeFilter)
                      }
                      className="w-full bg-[#0b0c10] border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-[#b5ff00]"
                    >
                      <option value="ALL">Qualquer Faixa de Preço</option>
                      <option value="FREE_ONLY">Sem Custo (Passe Livre)</option>
                      <option value="UP_TO_25M">Até {formatCompactBRL(25_000_000)}</option>
                      <option value="25M_TO_80M">
                        {formatCompactBRL(25_000_000)} a {formatCompactBRL(80_000_000)}
                      </option>
                      <option value="80M_TO_250M">
                        {formatCompactBRL(80_000_000)} a {formatCompactBRL(250_000_000)}
                      </option>
                      <option value="OVER_250M">Acima de {formatCompactBRL(250_000_000)}</option>
                    </select>
                  </div>

                  {/* 3. Monthly Salary Cap Filter */}
                  <div>
                    <label
                      htmlFor="adv-salary-filter"
                      className="block text-[10px] font-mono uppercase text-zinc-400 mb-1"
                    >
                      Teto Salarial Mensal
                    </label>
                    <select
                      id="adv-salary-filter"
                      value={maxSalaryFilter}
                      onChange={(e) =>
                        setMaxSalaryFilter(Number(e.target.value))
                      }
                      className="w-full bg-[#0b0c10] border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-[#b5ff00]"
                    >
                      <option value={0}>Qualquer Salário</option>
                      <option value={500000}>Até {formatCompactBRL(500_000)}/mês</option>
                      <option value={1000000}>Até {formatCompactBRL(1_000_000)}/mês</option>
                      <option value={2000000}>Até {formatCompactBRL(2_000_000)}/mês</option>
                      <option value={5000000}>Até {formatCompactBRL(5_000_000)}/mês</option>
                      <option value={10000000}>Até {formatCompactBRL(10_000_000)}/mês</option>
                    </select>
                  </div>

                  {/* 4. Skill Level (OVR Range) */}
                  <div>
                    <label
                      htmlFor="adv-ovr-filter"
                      className="block text-[10px] font-mono uppercase text-zinc-400 mb-1"
                    >
                      Nível de Habilidade (OVR)
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <select
                        id="adv-ovr-filter"
                        aria-label="OVR mínimo"
                        value={minOvrFilter}
                        onChange={(e) =>
                          setMinOvrFilter(Number(e.target.value))
                        }
                        className="bg-[#0b0c10] border border-white/10 rounded-xl px-2 py-2 text-xs text-white focus:outline-none focus:border-[#b5ff00]"
                      >
                        <option value={60}>Mín: 60+</option>
                        <option value={70}>Mín: 70+</option>
                        <option value={74}>Mín: 74+</option>
                        <option value={77}>Mín: 77+</option>
                        <option value={80}>Mín: 80+</option>
                        <option value={83}>Mín: 83+</option>
                        <option value={86}>Mín: 86+</option>
                      </select>
                      <select
                        aria-label="OVR máximo"
                        value={maxOvrFilter}
                        onChange={(e) =>
                          setMaxOvrFilter(Number(e.target.value))
                        }
                        className="bg-[#0b0c10] border border-white/10 rounded-xl px-2 py-2 text-xs text-white focus:outline-none focus:border-[#b5ff00]"
                      >
                        <option value={95}>Máx: 95</option>
                        <option value={85}>Máx: 85</option>
                        <option value={81}>Máx: 81</option>
                        <option value={78}>Máx: 78</option>
                        <option value={75}>Máx: 75</option>
                      </select>
                    </div>
                  </div>

                  {/* 5. Specific Technical/Physical Attribute Filter */}
                  <div>
                    <label
                      htmlFor="adv-attr-filter"
                      className="block text-[10px] font-mono uppercase text-zinc-400 mb-1"
                    >
                      Atributo Chave (1–20)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <select
                        id="adv-attr-filter"
                        value={keyAttributeFilter}
                        onChange={(e) =>
                          setKeyAttributeFilter(
                            e.target.value as 'NONE' | keyof PlayerAttributes
                          )
                        }
                        className="flex-1 min-w-0 bg-[#0b0c10] border border-white/10 rounded-xl px-2 py-2 text-xs text-white focus:outline-none focus:border-[#b5ff00]"
                      >
                        {ATTRIBUTE_OPTIONS.map((opt) => (
                          <option key={opt.key} value={opt.key}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      {keyAttributeFilter !== 'NONE' && (
                        <select
                          aria-label="Nota mínima do atributo"
                          value={minAttributeValue}
                          onChange={(e) =>
                            setMinAttributeValue(Number(e.target.value))
                          }
                          className="w-16 bg-[#0b0c10] border border-[#b5ff00]/50 rounded-xl px-1.5 py-2 text-xs font-mono font-bold text-[#b5ff00]"
                        >
                          <option value={13}>13+</option>
                          <option value={15}>15+</option>
                          <option value={16}>16+</option>
                          <option value={17}>17+</option>
                          <option value={18}>18+</option>
                        </select>
                      )}
                    </div>
                  </div>

                  {/* 6. Age & Negotiation Difficulty Filter */}
                  <div>
                    <label
                      htmlFor="adv-age-diff-filter"
                      className="block text-[10px] font-mono uppercase text-zinc-400 mb-1"
                    >
                      Idade & Dificuldade
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <select
                        id="adv-age-diff-filter"
                        aria-label="Faixa etária"
                        value={ageRangeFilter}
                        onChange={(e) =>
                          setAgeRangeFilter(e.target.value as AgeRangeFilter)
                        }
                        className="bg-[#0b0c10] border border-white/10 rounded-xl px-2 py-2 text-xs text-white focus:outline-none focus:border-[#b5ff00]"
                      >
                        <option value="ALL">Idade</option>
                        <option value="SUB_23">≤23 anos</option>
                        <option value="AUGE_24_29">24–29 anos</option>
                        <option value="EXP_30_PLUS">30+ anos</option>
                      </select>
                      <select
                        aria-label="Dificuldade da negociação"
                        value={difficultyFilter}
                        onChange={(e) =>
                          setDifficultyFilter(
                            e.target.value as DifficultyFilter
                          )
                        }
                        className="bg-[#0b0c10] border border-white/10 rounded-xl px-2 py-2 text-xs text-white focus:outline-none focus:border-[#b5ff00]"
                      >
                        <option value="ALL">Dificuldade</option>
                        <option value="FACIL">Só Fácil</option>
                        <option value="ATE_MODERADA">Fácil/Mod.</option>
                        <option value="MODERADA">Moderada</option>
                        <option value="DIFICIL">Difícil</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Active Filters Summary & Reset */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
                  <span className="text-zinc-400">
                    Exibindo{' '}
                    <strong className="text-white">
                      {filteredListings.length}
                    </strong>{' '}
                    opções compatíveis com o perfil buscado
                  </span>
                  {(activeAdvancedFilterCount > 0 ||
                    sectorFilter !== 'ALL' ||
                    domesticScope !== 'ALL' ||
                    intlScope !== 'ALL' ||
                    searchQuery.trim() !== '') && (
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="text-[#b5ff00] hover:underline font-bold flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Limpar Todos os Filtros</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 2-Column Workspace */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            {/* Players List */}
            <div className="xl:col-span-7 bg-[#14171f] border border-white/[0.07] rounded-[28px] overflow-hidden">
              <div className="px-5 py-3.5 border-b border-white/[0.07] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-semibold text-white">
                  <Globe2 className="w-4 h-4 text-[#b5ff00]" />
                  <span>{filteredListings.length} atletas encontrados</span>
                </div>
                <span className="text-[11px] text-zinc-400">
                  Clique para abrir proposta e comparar níveis
                </span>
              </div>

              {filteredListings.length === 0 ? (
                <div className="p-8 text-center space-y-2 text-xs text-zinc-400">
                  <div>Nenhum atleta encontrado com os filtros atuais.</div>
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="px-4 py-1.5 rounded-full bg-[#b5ff00] text-[#090a0f] font-bold text-xs"
                  >
                    Restaurar Filtros
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.05]">
                  {filteredListings.slice(0, visibleLimit).map((item) => {
                    const ev = evaluatedListMap.get(item.player.id)!;
                    const diffStyle = DIFFICULTY_STYLES[ev.level];
                    const isSelected =
                      selectedListing?.player.id === item.player.id;
                    const isWatched = watchedIdsSet.has(item.player.id);
                    const rowNegInfo = getPlayerNegotiationBlockInfo(
                      negotiationStates[item.player.id],
                      seasonYear,
                      dayOffset
                    );
                    const feeDisplay =
                      item.scope === 'LIVRES'
                        ? 'Livre'
                        : subTab === 'EMPRESTIMOS'
                        ? formatCompactBRL(item.loanFee)
                        : formatCompactBRL(item.buyFee);

                    return (
                      <div
                        key={item.player.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleSelectListing(item)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleSelectListing(item);
                          }
                        }}
                        className={`w-full text-left px-3 sm:px-5 py-2.5 sm:py-3.5 flex items-center justify-between gap-2 sm:gap-3 cursor-pointer active:scale-[0.99] transition-all ${
                          isSelected
                            ? 'bg-[#b5ff00]/10 border-l-2 border-l-[#b5ff00]'
                            : 'hover:bg-white/[0.03]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#0b0c10] border border-white/[0.08] flex flex-col items-center justify-center shrink-0">
                            <span className="font-mono tabular-nums text-xs sm:text-sm font-extrabold text-[#b5ff00] leading-none">
                              {item.ovr}
                            </span>
                            <span className="text-[9px] font-mono text-zinc-400 mt-0.5 leading-none">
                              {item.player.position}
                            </span>
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-xs sm:text-sm text-white truncate">
                                {item.player.name}
                              </span>
                              <StarRating
                                player={item.player}
                                ovr={item.ovr}
                                clubReputation={
                                  item.originClub?.reputation ?? userClub.reputation
                                }
                                size="xs"
                              />
                              {item.isTransferListed && (
                                <span
                                  title={
                                    item.listingReason ||
                                    'Colocado à venda pelo clube de origem'
                                  }
                                  className="px-1.5 py-0.5 rounded bg-amber-400/15 border border-amber-400/40 text-amber-300 text-[9px] font-mono font-extrabold shrink-0"
                                >
                                  LISTADO P/ COMPRA
                                </span>
                              )}
                              {item.isLoanListed && (
                                <span
                                  title={
                                    item.listingReason ||
                                    'Disponibilizado para empréstimo pelo clube de origem'
                                  }
                                  className="px-1.5 py-0.5 rounded bg-sky-400/15 border border-sky-400/40 text-sky-300 text-[9px] font-mono font-extrabold shrink-0"
                                >
                                  LISTADO P/ EMPRÉSTIMO
                                </span>
                              )}
                              {keyAttributeFilter !== 'NONE' && (
                                <span className="px-1.5 py-0.5 rounded bg-[#b5ff00]/15 text-[#b5ff00] text-[10px] font-mono font-bold shrink-0">
                                  {
                                    ATTRIBUTE_OPTIONS.find(
                                      (a) => a.key === keyAttributeFilter
                                    )?.label.slice(0, 3)
                                  }{' '}
                                  {item.player.attributes[keyAttributeFilter]}
                                </span>
                              )}
                              {rowNegInfo.isBlocked && (
                                <span
                                  title={`Negociação bloqueada até ${rowNegInfo.blockedUntilDateLabel}`}
                                  className="text-[10px] font-mono text-rose-400 font-semibold shrink-0"
                                >
                                  · Negociação bloqueada
                                </span>
                              )}
                              {!rowNegInfo.isBlocked && ev.isBlocked && (
                                <span
                                  title={ev.blockReason || undefined}
                                  className="text-[10px] font-mono text-rose-400 shrink-0"
                                >
                                  · Acima teto
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] sm:text-[11px] text-zinc-400 truncate mt-0.5 flex items-center gap-1.5">
                              {item.originClub && (
                                <ClubBadge
                                  clubId={item.originClub.id}
                                  abbr={item.originClub.abbr}
                                  name={item.originClub.name}
                                  primaryColor={item.originClub.primaryColor}
                                  size="xs"
                                />
                              )}
                              <span className="truncate">
                                {item.player.age}a ·{' '}
                                {item.originClub
                                  ? item.originClub.shortName
                                  : 'Agente Livre'}
                                {' · '}
                                <span className={`font-bold ${diffStyle.text}`}>
                                  {ev.level} ({ev.acceptanceChance}%)
                                </span>
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0 flex items-center gap-2 sm:gap-3">
                          <div>
                            <div className="font-mono tabular-nums text-xs font-bold text-white">
                              {feeDisplay}
                            </div>
                            <div className="text-[10px] sm:text-[11px] font-mono tabular-nums text-zinc-400">
                              {formatCompactBRL(
                                subTab === 'EMPRESTIMOS'
                                  ? Math.round(item.player.salary * 0.75)
                                  : item.player.salary
                              )}
                              /mês
                            </div>
                          </div>

                          <div className="hidden sm:block text-right min-w-[82px]">
                            <div
                              className={`text-[11px] font-bold ${diffStyle.text}`}
                            >
                              {ev.level}
                            </div>
                            <div className="text-[10px] font-mono tabular-nums text-zinc-500">
                              {ev.acceptanceChance}% aceite
                            </div>
                          </div>

                          {onToggleWatchPlayer && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleWatchPlayer(item);
                              }}
                              title={
                                isWatched
                                  ? 'Remover da Lista de Observação'
                                  : 'Observar atleta'
                              }
                              aria-label={
                                isWatched
                                  ? `Remover ${item.player.name} dos observados`
                                  : `Observar ${item.player.name}`
                              }
                              className={`p-1.5 rounded-full border transition-colors shrink-0 ${
                                isWatched
                                  ? 'bg-[#b5ff00]/20 border-[#b5ff00]/60 text-[#b5ff00]'
                                  : 'bg-white/[0.04] border-white/[0.08] text-zinc-400 hover:text-[#b5ff00] hover:border-[#b5ff00]/40'
                              }`}
                            >
                              {isWatched ? (
                                <BookmarkCheck className="w-3.5 h-3.5" />
                              ) : (
                                <Bookmark className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}

                          <ArrowUpRight className="w-4 h-4 text-zinc-500 shrink-0" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {filteredListings.length > visibleLimit && (
                <div className="p-4 border-t border-white/[0.07] text-center">
                  <button
                    type="button"
                    onClick={() => setVisibleLimit((v) => v + 40)}
                    className="px-5 py-2 rounded-full bg-[#0b0c10] hover:bg-white/[0.08] text-xs font-bold text-[#b5ff00] border border-white/10"
                  >
                    Mostrar mais atletas ({filteredListings.length - visibleLimit}{' '}
                    restantes)
                  </button>
                </div>
              )}
            </div>

            {/* Desktop Negotiation Desk */}
            <div className="hidden xl:block xl:col-span-5 xl:sticky xl:top-20">
              {renderNegotiationDesk(false)}
            </div>
          </div>
        </div>
      )}

      {/* Mobile / Tablet Negotiation Drawer Sheet */}
      {mobileDeskOpen && subTab !== 'MEU_ELENCO' && subTab !== 'HISTORICO' && (
        <div
          className="xl:hidden fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-2 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Mesa de Negociação"
        >
          <div
            ref={mobileModalScrollRef}
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-3"
          >
            {subTab === 'OBSERVADOS' && selectedWatchedItem && !selectedWatchedItem.listing ? (
              <div className="bg-[#14171f] border border-white/[0.08] rounded-[24px] p-5 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-white text-sm">
                    {selectedWatchedItem.entry.playerName}
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileDeskOpen(false)}
                    aria-label="Fechar painel"
                    className="p-2 rounded-full bg-white/[0.08] text-zinc-300 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-zinc-400">
                  {selectedWatchedItem.statusType === 'IN_USER_SQUAD'
                    ? 'Atleta já integra o elenco principal.'
                    : 'Atleta indisponível para negociação no momento.'}
                </p>
              </div>
            ) : (
              renderNegotiationDesk(true)
            )}
          </div>
        </div>
      )}
      {/* Celebratory Transfer Acceptance Transition */}
      <MarketDealTransitionModal
        deal={dealTransition}
        userClub={userClub}
        onCompleteDismiss={() => setDealTransition(null)}
      />
    </div>
  );
};
