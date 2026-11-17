import React, { useEffect, useMemo, useState } from 'react';
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
  ArrowDownLeft,
} from 'lucide-react';
import { calculatePlayerOverall } from '../engine/matchEngine';
import {
  LoanWageShare,
  MIN_SQUAD_SIZE,
  buildAllMarketListings,
  evaluateOutgoingPlayer,
  evaluateTransferNegotiation,
  getEffectivePayroll,
  getPlayerPaidSalary,
} from '../engine/transferEngine';
import { IncomingOfferAction } from '../engine/aiMarketEngine';
import {
  Club,
  IncomingTransferOffer,
  MarketPlayerListing,
  NaturalPosition,
  Player,
  PlayerAttributes,
  PositionSector,
  TransferDealMode,
  TransferDifficultyLevel,
  TransferOfferTier,
  TransferRecord,
} from '../types/football';
import { formatCompactBRL } from '../utils/formatters';
import { ClubBadge } from './ClubBadge';
import { StarRating } from './StarRating';

export type MarketFeedback = {
  type: 'success' | 'rejected' | 'error';
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
  seasonYear?: number;
  aiSquads?: Record<string, Player[]>;
  pendingOffers?: IncomingTransferOffer[];
  onResolveIncomingOffer?: (
    offerId: string,
    action: IncomingOfferAction
  ) => void;
  lastFeedback: MarketFeedback;
  onClearFeedback: () => void;
  onInspectPlayer: (player: Player) => void;
  onProposeTransfer: (params: {
    listing: MarketPlayerListing;
    dealMode: TransferDealMode;
    offerTier: TransferOfferTier;
    loanWageShare: LoanWageShare;
  }) => void;
  onOutgoingTransfer: (params: {
    player: Player;
    action: 'VENDA' | 'EMPRESTIMO_OUT' | 'DEVOLVER_EMPRESTIMO';
  }) => void;
}

type MarketSubTab =
  | 'NACIONAL_LIB'
  | 'INTERNACIONAL'
  | 'LIVRES'
  | 'EMPRESTIMOS'
  | 'MEU_ELENCO'
  | 'HISTORICO';

type DomesticScopeFilter = 'ALL' | 'SERIE_A' | 'SERIE_B' | 'LIBERTADORES';
type PriceRangeFilter =
  | 'ALL'
  | 'FREE_ONLY'
  | 'UP_TO_10M'
  | '10M_TO_25M'
  | '25M_TO_50M'
  | 'OVER_50M';
type AgeRangeFilter = 'ALL' | 'SUB_23' | 'AUGE_24_29' | 'EXP_30_PLUS';
type DifficultyFilter =
  | 'ALL'
  | 'FACIL'
  | 'ATE_MODERADA'
  | 'MODERADA'
  | 'DIFICIL';
type SortKey =
  | 'OVR_DESC'
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
  seasonYear = 2026,
  aiSquads,
  pendingOffers = [],
  onResolveIncomingOffer,
  lastFeedback,
  onClearFeedback,
  onInspectPlayer,
  onProposeTransfer,
  onOutgoingTransfer,
}) => {
  const [subTab, setSubTab] = useState<MarketSubTab>('NACIONAL_LIB');
  const [domesticScope, setDomesticScope] =
    useState<DomesticScopeFilter>('ALL');
  const [sectorFilter, setSectorFilter] = useState<'ALL' | PositionSector>('ALL');
  const [positionFilter, setPositionFilter] = useState<'ALL' | NaturalPosition>(
    'ALL'
  );
  const [priceRangeFilter, setPriceRangeFilter] =
    useState<PriceRangeFilter>('ALL');
  const [maxSalaryFilter, setMaxSalaryFilter] = useState<number>(0); // 0 = all
  const [minOvrFilter, setMinOvrFilter] = useState<number>(60);
  const [maxOvrFilter, setMaxOvrFilter] = useState<number>(99);
  const [ageRangeFilter, setAgeRangeFilter] = useState<AgeRangeFilter>('ALL');
  const [difficultyFilter, setDifficultyFilter] =
    useState<DifficultyFilter>('ALL');
  const [keyAttributeFilter, setKeyAttributeFilter] = useState<
    'NONE' | keyof PlayerAttributes
  >('NONE');
  const [minAttributeValue, setMinAttributeValue] = useState<number>(15);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [onlyAffordable, setOnlyAffordable] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>('OVR_DESC');
  const [visibleLimit, setVisibleLimit] = useState(40);

  // History tab filters
  const [historyTypeFilter, setHistoryTypeFilter] =
    useState<HistoryTypeFilter>('ALL');
  const [historySearch, setHistorySearch] = useState('');

  // Selected listing for desktop & mobile drawer
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [mobileDeskOpen, setMobileDeskOpen] = useState(false);

  // Proposal controls
  const [dealMode, setDealMode] = useState<TransferDealMode>('BUY');
  const [offerTier, setOfferTier] = useState<TransferOfferTier>('PADRAO');
  const [loanWageShare, setLoanWageShare] = useState<LoanWageShare>(0.75);

  const currentPayroll = useMemo(
    () => getEffectivePayroll(squad, loanedOutPlayers),
    [squad, loanedOutPlayers]
  );
  const wageUsagePct = Math.round(
    (currentPayroll / Math.max(1, userClub.wageBudget)) * 100
  );
  const wageFreeSpace = Math.max(0, userClub.wageBudget - currentPayroll);
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

  // Count active advanced filters
  const activeAdvancedFilterCount = useMemo(() => {
    let count = 0;
    if (positionFilter !== 'ALL') count++;
    if (priceRangeFilter !== 'ALL') count++;
    if (maxSalaryFilter > 0) count++;
    if (minOvrFilter > 60 || maxOvrFilter < 99) count++;
    if (ageRangeFilter !== 'ALL') count++;
    if (difficultyFilter !== 'ALL') count++;
    if (keyAttributeFilter !== 'NONE') count++;
    if (onlyAffordable) count++;
    return count;
  }, [
    positionFilter,
    priceRangeFilter,
    maxSalaryFilter,
    minOvrFilter,
    maxOvrFilter,
    ageRangeFilter,
    difficultyFilter,
    keyAttributeFilter,
    onlyAffordable,
  ]);

  const handleResetFilters = () => {
    setDomesticScope('ALL');
    setSectorFilter('ALL');
    setPositionFilter('ALL');
    setPriceRangeFilter('ALL');
    setMaxSalaryFilter(0);
    setMinOvrFilter(60);
    setMaxOvrFilter(99);
    setAgeRangeFilter('ALL');
    setDifficultyFilter('ALL');
    setKeyAttributeFilter('NONE');
    setMinAttributeValue(15);
    setSearchQuery('');
    setOnlyAffordable(false);
    setSortBy('OVR_DESC');
  };

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
    setOfferTier('PADRAO');
  }, [subTab]);

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
        } else if (subTab === 'LIVRES') {
          if (item.scope !== 'LIVRES') return false;
        } else if (subTab === 'EMPRESTIMOS') {
          if (item.scope === 'LIVRES' || !item.loanAvailable) return false;
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
        if (priceRangeFilter === 'UP_TO_10M' && relevantFee > 10_000_000)
          return false;
        if (
          priceRangeFilter === '10M_TO_25M' &&
          (relevantFee < 10_000_000 || relevantFee > 25_000_000)
        )
          return false;
        if (
          priceRangeFilter === '25M_TO_50M' &&
          (relevantFee < 25_000_000 || relevantFee > 50_000_000)
        )
          return false;
        if (priceRangeFilter === 'OVER_50M' && relevantFee <= 50_000_000)
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
    sectorFilter,
    positionFilter,
    minOvrFilter,
    maxOvrFilter,
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

  // Select first item automatically on desktop when filtered list updates and current selection is missing
  const selectedListing = useMemo(() => {
    if (filteredListings.length === 0) return null;
    const found = filteredListings.find(
      (i) => i.player.id === selectedListingId
    );
    return found || filteredListings[0];
  }, [filteredListings, selectedListingId]);

  const effectiveDealMode: TransferDealMode = !selectedListing
    ? 'BUY'
    : selectedListing.scope === 'LIVRES'
    ? 'FREE'
    : dealMode === 'FREE'
    ? 'BUY'
    : dealMode;

  const activeEvaluation = useMemo(() => {
    if (!selectedListing) return null;
    return evaluateTransferNegotiation({
      userClub,
      userSquad: squad,
      loanedOutPlayers,
      listing: selectedListing,
      dealMode: effectiveDealMode,
      offerTier,
      loanWageShare,
    });
  }, [
    selectedListing,
    userClub,
    squad,
    loanedOutPlayers,
    effectiveDealMode,
    offerTier,
    loanWageShare,
  ]);

  const handleSelectListing = (item: MarketPlayerListing) => {
    setSelectedListingId(item.player.id);
    setOfferTier('PADRAO');
    if (item.scope === 'LIVRES') {
      setDealMode('FREE');
    } else if (subTab === 'EMPRESTIMOS') {
      setDealMode('LOAN');
    }
    setMobileDeskOpen(true);
    onClearFeedback();
  };

  const renderNegotiationDesk = (isMobileModal: boolean) => {
    if (!selectedListing || !activeEvaluation) {
      return (
        <div className="bg-[#14171f] border border-white/[0.07] rounded-[28px] p-6 text-center text-xs text-zinc-400">
          Nenhum atleta corresponde aos filtros atuais. Ajuste os filtros
          avançados ou clique em &ldquo;Limpar Filtros&rdquo;.
        </div>
      );
    }

    const diffStyle = DIFFICULTY_STYLES[activeEvaluation.level];
    const p = selectedListing.player;
    const isFree = selectedListing.scope === 'LIVRES';
    const isLoan = effectiveDealMode === 'LOAN';

    return (
      <div className="bg-[#14171f] border border-white/[0.08] rounded-[28px] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 bg-[#0b0c10]/70 border-b border-white/[0.07] flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-[#b5ff00] text-[#090a0f] flex flex-col items-center justify-center shrink-0 shadow">
              <span className="text-[10px] font-mono font-bold leading-none">
                {p.position}
              </span>
              <span className="font-display text-2xl font-extrabold leading-none">
                {selectedListing.ovr}
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-display text-2xl font-extrabold uppercase tracking-tight text-white leading-none truncate">
                  {p.name}
                </h3>
                <StarRating
                  player={p}
                  ovr={selectedListing.ovr}
                  clubReputation={
                    selectedListing.originClub?.reputation ?? userClub.reputation
                  }
                  size="sm"
                />
              </div>
              <div className="text-xs text-zinc-400 mt-1 flex items-center gap-1.5 truncate">
                {selectedListing.originClub && (
                  <ClubBadge
                    clubId={selectedListing.originClub.id}
                    abbr={selectedListing.originClub.abbr}
                    name={selectedListing.originClub.name}
                    primaryColor={selectedListing.originClub.primaryColor}
                    size="xs"
                  />
                )}
                <span className="truncate">
                  {p.age} anos · {p.nationality} ·{' '}
                  {selectedListing.originClub
                    ? `${selectedListing.originClub.shortName} (${selectedListing.originClub.leagueName})`
                    : `Passe Livre ${seasonYear}`}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onInspectPlayer(p)}
              className="px-3 py-2 rounded-full bg-white/[0.08] hover:bg-white/[0.15] text-white text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap"
            >
              <Eye className="w-3.5 h-3.5 text-[#b5ff00]" />
              18 Atributos
            </button>
            {isMobileModal && (
              <button
                type="button"
                onClick={() => setMobileDeskOpen(false)}
                aria-label="Fechar mesa de negociação"
                className="p-2 rounded-full bg-white/[0.08] text-zinc-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
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

          {/* Difficulty Comparison Box (Club x Club & Player x Squad) */}
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

            <div className="space-y-1.5 text-[11px] text-zinc-200 leading-relaxed">
              <div>
                <span className="text-zinc-400 font-semibold">
                  Clubes ({userClub.shortName} ×{' '}
                  {selectedListing.originClub?.shortName || 'Livre'}):{' '}
                </span>
                {activeEvaluation.clubGapNote}
              </div>
              <div>
                <span className="text-zinc-400 font-semibold">
                  Nível do Atleta:{' '}
                </span>
                {activeEvaluation.playerGapNote}
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

          {/* Loan Wage Share */}
          {isLoan && (
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
          )}

          {/* Offer Boost */}
          <div>
            <div className="text-[11px] text-zinc-400 font-medium mb-1.5">
              {isFree
                ? 'Proposta Salarial / Luvas'
                : 'Agressividade da Proposta (melhora chance de aceite)'}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  ['PADRAO', 'Padrão'],
                  ['BONUS_15', '+15% Oferta'],
                  ['AGRESSIVA_30', '+30% Firme'],
                ] as const
              ).map(([tier, label]) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setOfferTier(tier)}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-colors ${
                    offerTier === tier
                      ? 'bg-white text-[#090a0f] border-white'
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
                  ? 'R$ 0 (Livre)'
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
              <span className="text-zinc-400">Nova Folha / Teto</span>
              <span
                className={`font-mono tabular-nums font-bold ${
                  activeEvaluation.fitsWageBudget
                    ? 'text-zinc-200'
                    : 'text-rose-400'
                }`}
              >
                {formatCompactBRL(activeEvaluation.projectedPayroll)} /{' '}
                {formatCompactBRL(userClub.wageBudget)} (
                {activeEvaluation.projectedWagePct}%)
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

          {/* Action CTA */}
          <button
            type="button"
            disabled={activeEvaluation.isBlocked}
            onClick={() =>
              onProposeTransfer({
                listing: selectedListing,
                dealMode: effectiveDealMode,
                offerTier,
                loanWageShare,
              })
            }
            className="w-full py-3.5 px-5 rounded-full text-xs sm:text-sm font-extrabold bg-[#b5ff00] hover:bg-[#c8ff33] disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-[#090a0f] transition-colors flex items-center justify-center gap-2 shadow-lg"
          >
            <Handshake className="w-4 h-4" />
            {isFree
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
    <div className="space-y-5">
      {/* Editorial Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-white/[0.07]">
        <div>
          <span className="block text-xs sm:text-sm font-normal text-zinc-400 tracking-wide">
            Janela de transferências {seasonYear} · Mercado Vivo & Filtros Avançados
          </span>
          <h2 className="font-display text-3xl sm:text-5xl font-extrabold uppercase tracking-tight text-white leading-[0.95] mt-0.5">
            MERCADO
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 font-mono">
          <span>
            Reputação do {userClub.shortName}:{' '}
            <strong className="text-[#b5ff00]">{userClub.reputation}/100</strong>
          </span>
          <span>·</span>
          <button
            type="button"
            onClick={() => setSubTab('HISTORICO')}
            className="text-[#b5ff00] hover:underline font-bold flex items-center gap-1"
          >
            <History className="w-3.5 h-3.5" />
            <span>
              Histórico de Transferências ({transferHistory.length})
            </span>
          </button>
        </div>
      </div>

      {/* Top Financial KPIs Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#b5ff00] text-[#090a0f] rounded-[24px] p-4 sm:p-5 shadow-lg">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase font-mono opacity-80">
            <span>Saldo em Caixa</span>
            <Coins className="w-4 h-4" />
          </div>
          <div className="font-display text-3xl sm:text-4xl font-extrabold tabular-nums mt-1 leading-none">
            {formatCompactBRL(userClub.cashBalance)}
          </div>
          <div className="text-[11px] opacity-80 mt-1.5 font-semibold">
            Disponível para compras e taxas de empréstimo
          </div>
        </div>

        <div className="bg-[#14171f] border border-white/[0.08] rounded-[24px] p-4 sm:p-5">
          <div className="flex items-center justify-between text-[11px] font-mono uppercase text-zinc-400">
            <span>Folha Mensal / Teto ({wageUsagePct}%)</span>
            <TrendingUp className="w-4 h-4 text-[#b5ff00]" />
          </div>
          <div className="font-display text-3xl font-extrabold tabular-nums text-white mt-1 leading-none">
            {formatCompactBRL(currentPayroll)}{' '}
            <span className="text-sm font-sans font-medium text-zinc-400">
              / {formatCompactBRL(userClub.wageBudget)}
            </span>
          </div>
          <div className="w-full h-1.5 bg-[#0b0c10] rounded-full overflow-hidden mt-2.5">
            <div
              className={`h-full ${
                wageUsagePct >= 95 ? 'bg-rose-400' : 'bg-[#b5ff00]'
              }`}
              style={{ width: `${Math.min(100, wageUsagePct)}%` }}
            />
          </div>
          <div className="text-[11px] text-zinc-400 mt-1.5 font-mono tabular-nums">
            Margem livre mensal: {formatCompactBRL(wageFreeSpace)}
          </div>
        </div>

        <div className="bg-[#14171f] border border-white/[0.08] rounded-[24px] p-4 sm:p-5">
          <div className="flex items-center justify-between text-[11px] font-mono uppercase text-zinc-400">
            <span>Plantel & Movimentações</span>
            <UserCheck className="w-4 h-4 text-[#b5ff00]" />
          </div>
          <div className="font-display text-3xl font-extrabold tabular-nums text-white mt-1 leading-none">
            {squad.length} Atletas
          </div>
          <div className="text-[11px] text-zinc-400 mt-2">
            {transferHistoryStats.incomingCount} chegadas ·{' '}
            {transferHistoryStats.outgoingCount} saídas · Mínimo{' '}
            {MIN_SQUAD_SIZE}
          </div>
        </div>
      </div>

      {/* Feedback Toast Banner */}
      {lastFeedback && (
        <div
          className={`rounded-2xl border px-4 py-3 flex items-start justify-between gap-3 text-xs ${
            lastFeedback.type === 'success'
              ? 'bg-[#b5ff00]/15 border-[#b5ff00]/50 text-white'
              : 'bg-rose-950/40 border-rose-500/40 text-rose-100'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {lastFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[#b5ff00] shrink-0 mt-0.5" />
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {activePendingOffers.map((offer) => (
              <div
                key={offer.id}
                className="bg-[#0b0c10] border border-white/[0.08] rounded-2xl p-3.5 space-y-3"
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ClubBadge
                      clubId={offer.fromClubId}
                      abbr={offer.fromClubAbbr}
                      name={offer.fromClubName}
                      primaryColor={offer.fromClubPrimaryColor}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">
                        {offer.fromClubName} quer {offer.playerName}
                      </div>
                      <div className="text-[11px] font-mono text-zinc-400">
                        {offer.playerPosition} · OVR {offer.playerOvr} ·{' '}
                        {offer.playerAge}a · {offer.playerPotentialStars}★ ·{' '}
                        {offer.dealType === 'LOAN' ? 'Empréstimo' : 'Compra'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono font-extrabold text-sm text-[#b5ff00] tabular-nums">
                      {formatCompactBRL(offer.offeredFee)}
                    </div>
                    <div className="text-[10px] font-mono text-zinc-400">
                      {offer.createdAtDate}
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-zinc-300 leading-snug">
                  {offer.rationale}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => onResolveIncomingOffer(offer.id, 'ACCEPT')}
                    className="py-1.5 px-2.5 rounded-xl bg-[#b5ff00] hover:bg-[#c8ff33] text-[#090a0f] text-[11px] font-extrabold transition-colors"
                  >
                    Aceitar
                  </button>
                  <button
                    type="button"
                    onClick={() => onResolveIncomingOffer(offer.id, 'COUNTER_15')}
                    className="py-1.5 px-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-white text-[11px] font-bold transition-colors"
                  >
                    Pedir +15%
                  </button>
                  <button
                    type="button"
                    onClick={() => onResolveIncomingOffer(offer.id, 'COUNTER_30')}
                    className="py-1.5 px-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-amber-300 text-[11px] font-bold transition-colors"
                  >
                    Pedir +30%
                  </button>
                  <button
                    type="button"
                    onClick={() => onResolveIncomingOffer(offer.id, 'REJECT')}
                    className="py-1.5 px-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-[11px] font-bold transition-colors"
                  >
                    Recusar
                  </button>
                </div>
              </div>
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
                    <th className="py-3 px-4 font-medium">Atleta</th>
                    <th className="py-3 px-2 font-medium">Pos</th>
                    <th className="py-3 px-2 font-medium text-right">OVR</th>
                    <th className="py-3 px-3 font-medium">Vínculo</th>
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
                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                type="button"
                                onClick={() => onInspectPlayer(player)}
                                className="font-semibold text-white hover:text-[#b5ff00] text-left"
                              >
                                #{player.number} {player.name}
                              </button>
                              <StarRating
                                player={player}
                                ovr={ovr}
                                clubReputation={userClub.reputation}
                                size="xs"
                              />
                            </div>
                            <div className="text-[11px] text-zinc-400">
                              {player.age} anos ·{' '}
                              {player.isStarter ? 'Titular' : 'Reserva'}
                            </div>
                          </td>
                          <td className="py-3 px-2 font-mono font-bold text-white">
                            {player.position}
                          </td>
                          <td className="py-3 px-2 text-right font-mono tabular-nums font-bold text-[#b5ff00]">
                            {ovr}
                          </td>
                          <td className="py-3 px-3 text-zinc-300">
                            {player.contractType === 'EMPRESTADO'
                              ? `Empréstimo (${player.loanOriginClubName || 'Clube'})`
                              : 'Definitivo'}
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
                                disabled={!ev.canReturnLoan}
                                title={ev.blockReason || undefined}
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
                                  disabled={!ev.canLoanOut}
                                  title={
                                    ev.blockReason ||
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
                                  disabled={!ev.canSell}
                                  title={ev.blockReason || undefined}
                                  onClick={() =>
                                    onOutgoingTransfer({
                                      player,
                                      action: 'VENDA',
                                    })
                                  }
                                  className="px-3 py-1.5 rounded-full bg-[#b5ff00] hover:bg-[#c8ff33] disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-[#090a0f] text-[11px] font-extrabold whitespace-nowrap"
                                >
                                  Vender
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
                              ? 'R$ 0 (Livre)'
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

      {/* INCOMING MARKET WORKSPACE */}
      {subTab !== 'MEU_ELENCO' && subTab !== 'HISTORICO' && (
        <div className="space-y-4">
          {/* Primary & Advanced Filter Panel */}
          <div className="bg-[#14171f] border border-white/[0.08] rounded-[24px] p-4 space-y-3.5">
            {/* Top Search & Sector Row */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
                  <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar atleta, clube ou país..."
                    aria-label="Buscar no mercado de transferências"
                    className="w-full bg-[#0b0c10] border border-white/[0.08] rounded-full pl-9 pr-4 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#b5ff00]"
                  />
                </div>

                {subTab === 'NACIONAL_LIB' && (
                  <select
                    aria-label="Filtrar competição"
                    value={domesticScope}
                    onChange={(e) =>
                      setDomesticScope(e.target.value as DomesticScopeFilter)
                    }
                    className="bg-[#0b0c10] border border-white/[0.08] rounded-full px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#b5ff00]"
                  >
                    <option value="ALL">Todas Ligas (A / B / Lib)</option>
                    <option value="SERIE_A">Brasileirão Série A</option>
                    <option value="SERIE_B">Brasileirão Série B</option>
                    <option value="LIBERTADORES">
                      Libertadores (CONMEBOL)
                    </option>
                  </select>
                )}

                <div className="flex items-center gap-1 bg-[#0b0c10] p-1 rounded-full border border-white/[0.07]">
                  {(['ALL', 'GOL', 'DEF', 'MEI', 'ATA'] as const).map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => {
                        setSectorFilter(sec);
                        if (sec !== 'ALL') setPositionFilter('ALL');
                      }}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors ${
                        sectorFilter === sec
                          ? 'bg-[#b5ff00] text-[#090a0f]'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {sec === 'ALL' ? 'Todos' : sec}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdvancedFilters((v) => !v)}
                  className={`px-3.5 py-2 rounded-full text-xs font-bold border transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                    showAdvancedFilters || activeAdvancedFilterCount > 0
                      ? 'bg-[#b5ff00]/15 border-[#b5ff00] text-[#b5ff00]'
                      : 'bg-[#0b0c10] border-white/[0.08] text-zinc-300 hover:text-white'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>
                    Filtros Avançados
                    {activeAdvancedFilterCount > 0
                      ? ` (${activeAdvancedFilterCount})`
                      : ''}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setOnlyAffordable((v) => !v)}
                  className={`px-3.5 py-2 rounded-full text-xs font-bold border transition-colors whitespace-nowrap ${
                    onlyAffordable
                      ? 'bg-[#b5ff00] border-[#b5ff00] text-[#090a0f]'
                      : 'bg-[#0b0c10] border-white/[0.08] text-zinc-300 hover:text-white'
                  }`}
                >
                  {onlyAffordable
                    ? '✓ Dentro do Orçamento'
                    : 'Filtrar Acessíveis'}
                </button>

                <select
                  aria-label="Ordenar mercado"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortKey)}
                  className="bg-[#0b0c10] border border-white/[0.08] rounded-full px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#b5ff00]"
                >
                  <option value="OVR_DESC">Maior Nível (OVR)</option>
                  <option value="EASIEST">Menor Dificuldade</option>
                  <option value="FEE_ASC">Menor Preço / Taxa</option>
                  <option value="FEE_DESC">Maior Preço / Taxa</option>
                  <option value="SALARY_ASC">Menor Salário Mensal</option>
                  <option value="AGE_ASC">Mais Jovens Primeiro</option>
                  <option value="OVR_ASC">Menor OVR</option>
                </select>
              </div>
            </div>

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
                      <option value="UP_TO_10M">Até R$ 10M</option>
                      <option value="10M_TO_25M">R$ 10M a R$ 25M</option>
                      <option value="25M_TO_50M">R$ 25M a R$ 50M</option>
                      <option value="OVER_50M">Acima de R$ 50M</option>
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
                      <option value={300000}>Até R$ 300 mil/mês</option>
                      <option value={500000}>Até R$ 500 mil/mês</option>
                      <option value={800000}>Até R$ 800 mil/mês</option>
                      <option value={1200000}>Até R$ 1,2M/mês</option>
                      <option value={1800000}>Até R$ 1,8M/mês</option>
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
                        <option value={99}>Máx: 99</option>
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
                    const feeDisplay =
                      item.scope === 'LIVRES'
                        ? 'Livre'
                        : subTab === 'EMPRESTIMOS'
                        ? formatCompactBRL(item.loanFee)
                        : formatCompactBRL(item.buyFee);

                    return (
                      <button
                        key={item.player.id}
                        type="button"
                        onClick={() => handleSelectListing(item)}
                        className={`w-full text-left px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 transition-colors ${
                          isSelected
                            ? 'bg-[#b5ff00]/10 border-l-2 border-l-[#b5ff00]'
                            : 'hover:bg-white/[0.03]'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-[#0b0c10] border border-white/[0.08] flex flex-col items-center justify-center shrink-0">
                            <span className="font-mono tabular-nums text-sm font-extrabold text-[#b5ff00] leading-none">
                              {item.ovr}
                            </span>
                            <span className="text-[9px] font-mono text-zinc-400 mt-0.5 leading-none">
                              {item.player.position}
                            </span>
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-sm text-white truncate">
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
                              {ev.isBlocked && (
                                <span
                                  title={ev.blockReason || undefined}
                                  className="text-[10px] font-mono text-rose-400 shrink-0"
                                >
                                  · Acima teto
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-zinc-400 truncate mt-0.5 flex items-center gap-1.5">
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
                                {item.player.age} anos ·{' '}
                                {item.originClub
                                  ? `${item.originClub.shortName} · ${item.originClub.country}`
                                  : `${item.player.nationality} · Agente Livre`}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0 flex items-center gap-3">
                          <div>
                            <div className="font-mono tabular-nums text-xs font-bold text-white">
                              {feeDisplay}
                            </div>
                            <div className="text-[11px] font-mono tabular-nums text-zinc-400">
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

                          <ArrowUpRight className="w-4 h-4 text-zinc-500 shrink-0" />
                        </div>
                      </button>
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

          {/* Inline Recent Transfer History Strip (Always accessible while scouting) */}
          <div className="bg-[#14171f] border border-white/[0.07] rounded-[24px] p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[#b5ff00]" />
                <h3 className="font-display text-lg font-extrabold uppercase tracking-tight text-white">
                  Histórico de Transferências da Temporada ({transferHistory.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSubTab('HISTORICO')}
                className="text-xs font-bold text-[#b5ff00] hover:underline flex items-center gap-1"
              >
                <span>Abrir Histórico Completo & Balanço</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {transferHistory.length === 0 ? (
              <div className="text-xs text-zinc-400 bg-[#0b0c10] border border-white/[0.05] rounded-2xl p-3.5">
                Nenhuma transferência registrada ainda em {seasonYear}. Assim que
                você ou clubes da IA contratarem, venderem ou emprestarem
                jogadores, o histórico aparecerá aqui.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {transferHistory.slice(0, 6).map((rec) => {
                  const badge = formatTransferRecordBadge(rec);
                  return (
                    <div
                      key={rec.id}
                      className="bg-[#0b0c10] border border-white/[0.07] rounded-2xl p-3 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <ArrowDownLeft className="w-3 h-3 text-[#b5ff00] shrink-0" />
                          <span
                            className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </div>
                        <div className="font-bold text-white truncate mt-1">
                          {rec.playerName} ({rec.position} · OVR {rec.ovr})
                        </div>
                        <div className="text-[10px] text-zinc-400 truncate">
                          {rec.counterpartyClubName} · {rec.date}
                        </div>
                      </div>
                      <div className="text-right font-mono tabular-nums shrink-0">
                        <div className="font-bold text-white">
                          {rec.feeAmount === 0
                            ? 'Livre'
                            : formatCompactBRL(rec.feeAmount)}
                        </div>
                        <div className="text-[10px] text-zinc-400">
                          {rec.monthlySalaryImpact >= 0 ? '+' : ''}
                          {formatCompactBRL(rec.monthlySalaryImpact)}/mês
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {renderNegotiationDesk(true)}
          </div>
        </div>
      )}
    </div>
  );
};
