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
import {
  Club,
  MarketPlayerListing,
  Player,
  PositionSector,
  TransferDealMode,
  TransferDifficultyLevel,
  TransferOfferTier,
  TransferRecord,
} from '../types/football';
import { formatCompactBRL } from '../utils/formatters';

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
type SortKey = 'OVR_DESC' | 'FEE_ASC' | 'SALARY_ASC' | 'EASIEST';

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

export const MarketView: React.FC<MarketViewProps> = ({
  userClub,
  clubs,
  squad,
  freeAgents,
  loanedOutPlayers,
  transferHistory,
  transferredOutClubPlayerIds,
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
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyAffordable, setOnlyAffordable] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>('OVR_DESC');
  const [visibleLimit, setVisibleLimit] = useState(40);

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

  const allListings = useMemo(
    () =>
      buildAllMarketListings({
        clubs,
        userClubId: userClub.id,
        freeAgents,
        transferredOutClubPlayerIds,
      }),
    [clubs, userClub.id, freeAgents, transferredOutClubPlayerIds]
  );

  // Reset limit & filters smoothly when switching tabs
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

        if (q) {
          const hay = `${item.player.name} ${item.player.position} ${
            item.player.nationality
          } ${item.originClub?.name || ''} ${item.originClub?.country || ''} ${
            item.originClub?.leagueName || ''
          }`.toLowerCase();
          if (!hay.includes(q)) return false;
        }

        if (onlyAffordable) {
          const ev = evaluatedListMap.get(item.player.id);
          if (!ev || ev.isBlocked) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'FEE_ASC') {
          const feeA = subTab === 'EMPRESTIMOS' ? a.loanFee : a.buyFee;
          const feeB = subTab === 'EMPRESTIMOS' ? b.loanFee : b.buyFee;
          return feeA - feeB || b.ovr - a.ovr;
        }
        if (sortBy === 'SALARY_ASC') {
          return a.player.salary - b.player.salary || b.ovr - a.ovr;
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
    searchQuery,
    onlyAffordable,
    sortBy,
    evaluatedListMap,
  ]);

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
          Nenhum atleta corresponde aos filtros atuais. Ajuste a busca ou o
          filtro de orçamento.
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
              <h3 className="font-display text-2xl font-extrabold uppercase tracking-tight text-white leading-none truncate">
                {p.name}
              </h3>
              <div className="text-xs text-zinc-400 mt-1 truncate">
                {p.age} anos · {p.nationality} ·{' '}
                {selectedListing.originClub
                  ? `${selectedListing.originClub.shortName} (${selectedListing.originClub.leagueName})`
                  : 'Passe Livre 2026'}
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
                  Empréstimo 2026
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
            Janela de transferências 2026 · Nacional, Internacional & Empréstimos
          </span>
          <h2 className="font-display text-3xl sm:text-5xl font-extrabold uppercase tracking-tight text-white leading-[0.95] mt-0.5">
            MERCADO
          </h2>
        </div>

        <div className="text-xs text-zinc-400 font-mono">
          Reputação do {userClub.shortName}:{' '}
          <strong className="text-[#b5ff00]">{userClub.reputation}/100</strong>
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
            <span>Plantel & Empréstimos</span>
            <UserCheck className="w-4 h-4 text-[#b5ff00]" />
          </div>
          <div className="font-display text-3xl font-extrabold tabular-nums text-white mt-1 leading-none">
            {squad.length} Atletas
          </div>
          <div className="text-[11px] text-zinc-400 mt-2">
            {loanedInCount} emprestados no grupo · {loanedOutPlayers.length}{' '}
            cedidos a terceiros · Mínimo {MIN_SQUAD_SIZE}
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
              label: `Histórico (${transferHistory.length})`,
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
                            <button
                              type="button"
                              onClick={() => onInspectPlayer(player)}
                              className="font-semibold text-white hover:text-[#b5ff00] text-left"
                            >
                              #{player.number} {player.name}
                            </button>
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
                Atletas Cedidos por Empréstimo em 2026 ({loanedOutPlayers.length})
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

      {/* HISTORY TAB */}
      {subTab === 'HISTORICO' && (
        <div className="bg-[#14171f] border border-white/[0.07] rounded-[28px] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.07] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-[#b5ff00]" />
              <h3 className="font-display text-xl font-extrabold uppercase tracking-tight text-white">
                Registro de Negociações 2026
              </h3>
            </div>
            <span className="text-xs font-mono text-zinc-400">
              {transferHistory.length} operações registradas
            </span>
          </div>

          {transferHistory.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-400">
              Nenhuma negociação enviada nesta temporada ainda. Explore o
              mercado nacional, internacional ou empréstimos para começar.
            </div>
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {transferHistory.map((rec) => (
                <div
                  key={rec.id}
                  className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-mono font-bold ${
                          rec.status === 'RECUSADA'
                            ? 'text-rose-400'
                            : rec.type === 'VENDA' || rec.type === 'EMPRESTIMO_OUT'
                            ? 'text-sky-400'
                            : 'text-[#b5ff00]'
                        }`}
                      >
                        {rec.status === 'RECUSADA' ? 'RECUSADA' : rec.type}
                      </span>
                      <span className="font-semibold text-white">
                        {rec.playerName} ({rec.position} · OVR {rec.ovr})
                      </span>
                      <span className="text-zinc-400">
                        · {rec.counterpartyClubName}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-0.5">
                      {rec.date} · {rec.note}
                    </div>
                  </div>
                  <div className="font-mono tabular-nums text-right shrink-0">
                    <div className="font-bold text-white">
                      {rec.feeAmount === 0
                        ? 'Passe Livre'
                        : formatCompactBRL(rec.feeAmount)}
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      Folha:{' '}
                      {rec.monthlySalaryImpact >= 0 ? '+' : ''}
                      {formatCompactBRL(rec.monthlySalaryImpact)}/mês
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* INCOMING MARKET WORKSPACE */}
      {subTab !== 'MEU_ELENCO' && subTab !== 'HISTORICO' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-[#14171f] border border-white/[0.07] rounded-[24px] p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
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
                  <option value="LIBERTADORES">Libertadores (CONMEBOL)</option>
                </select>
              )}

              <div className="flex items-center gap-1 bg-[#0b0c10] p-1 rounded-full border border-white/[0.07]">
                {(['ALL', 'GOL', 'DEF', 'MEI', 'ATA'] as const).map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setSectorFilter(sec)}
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
                onClick={() => setOnlyAffordable((v) => !v)}
                className={`px-3.5 py-2 rounded-full text-xs font-bold border transition-colors whitespace-nowrap ${
                  onlyAffordable
                    ? 'bg-[#b5ff00]/15 border-[#b5ff00] text-[#b5ff00]'
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
                <option value="OVR_DESC">Maior OVR</option>
                <option value="EASIEST">Menor Dificuldade</option>
                <option value="FEE_ASC">Menor Valor</option>
                <option value="SALARY_ASC">Menor Salário</option>
              </select>
            </div>
          </div>

          {/* 2-Column Workspace */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            {/* Players List */}
            <div className="xl:col-span-7 bg-[#14171f] border border-white/[0.07] rounded-[28px] overflow-hidden">
              <div className="px-5 py-3.5 border-b border-white/[0.07] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-semibold text-white">
                  <Globe2 className="w-4 h-4 text-[#b5ff00]" />
                  <span>
                    {filteredListings.length} atletas encontrados
                  </span>
                </div>
                <span className="text-[11px] text-zinc-400">
                  Clique para abrir proposta e comparar níveis
                </span>
              </div>

              {filteredListings.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-400">
                  Nenhum atleta encontrado com os filtros atuais.
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
                              {ev.isBlocked && (
                                <span
                                  title={ev.blockReason || undefined}
                                  className="text-[10px] font-mono text-rose-400 shrink-0"
                                >
                                  · Acima teto
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                              {item.player.age} anos ·{' '}
                              {item.originClub
                                ? `${item.originClub.shortName} · ${item.originClub.country}`
                                : `${item.player.nationality} · Agente Livre`}
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
