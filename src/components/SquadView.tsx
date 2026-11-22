import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  ArrowLeftRight,
  Eye,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  FileSignature,
  CheckCircle2,
  Handshake,
  X,
} from 'lucide-react';
import { getRoleById } from '../data/tacticsData';
import {
  calculatePlayerOverall,
  calculateRoleSuitability,
} from '../engine/matchEngine';
import { evaluatePlayerRetirementProbability } from '../engine/economyAndEvolution';
import {
  evaluatePlayerInjuryRisk,
  formatInjuryDurationShort,
} from '../engine/injuryEngine';
import {
  getPlayerContractEndYear,
  getPlayerContractRemainingYears,
  getRenewalEligiblePlayers,
} from '../engine/contractEngine';
import {
  Club,
  ContractRenewalOutcome,
  Player,
  PositionSector,
} from '../types/football';
import {
  formatCompactBRL,
  getAttributeColorClass,
  getConditionColor,
  getMoraleColor,
} from '../utils/formatters';
import { StarRating } from './StarRating';
import { PlayerJersey, PlayerOvrBadge } from './PlayerJersey';

interface SquadViewProps {
  club: Club;
  squad: Player[];
  loanedOutPlayers?: Player[];
  currentYear: number;
  focusRenewalsSignal?: number;
  onInspectPlayer: (player: Player) => void;
  onSwapPlayers: (playerAId: string, playerBId: string) => void;
  onAutoPickBestXI: () => void;
  onTogglePlayerMarketListing?: (
    playerId: string,
    mode: 'TRANSFER' | 'LOAN'
  ) => void;
  onRenewContract?: (
    player: Player,
    offeredSalary: number,
    addYears: 1 | 2 | 3
  ) => ContractRenewalOutcome;
  onToggleDoNotRenewContract?: (player: Player, doNotRenew: boolean) => void;
}

export const SquadView: React.FC<SquadViewProps> = ({
  club,
  squad,
  loanedOutPlayers = [],
  currentYear,
  focusRenewalsSignal = 0,
  onInspectPlayer,
  onSwapPlayers,
  onAutoPickBestXI,
  onTogglePlayerMarketListing,
  onRenewContract,
  onToggleDoNotRenewContract,
}) => {
  const [sectorFilter, setSectorFilter] = useState<
    'ALL' | 'LINEUP' | 'INJURED' | 'RENEWALS' | 'LISTED' | PositionSector
  >('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedForSwapId, setSelectedForSwapId] = useState<string | null>(
    null
  );
  const [salaryOfferChoices, setSalaryOfferChoices] = useState<
    Record<string, number>
  >({});
  const [yearOfferChoices, setYearOfferChoices] = useState<
    Record<string, 1 | 2 | 3>
  >({});
  const [renewalResults, setRenewalResults] = useState<
    Record<string, ContractRenewalOutcome>
  >({});

  useEffect(() => {
    if (focusRenewalsSignal > 0) {
      setSectorFilter('RENEWALS');
    }
  }, [focusRenewalsSignal]);

  const renewalCandidates = useMemo(
    () => getRenewalEligiblePlayers(squad, club, currentYear),
    [squad, club, currentYear]
  );

  const pendingRenewalsCount = renewalCandidates.filter(
    (c) =>
      c.player.contractRenewalStatus !== 'RENOVADO' &&
      c.player.contractRenewalStatus !== 'RECUSADO'
  ).length;
  const expiringThisYearCount = renewalCandidates.filter(
    (c) =>
      c.remainingYears <= 1 &&
      c.player.contractRenewalStatus !== 'RENOVADO' &&
      c.player.contractRenewalStatus !== 'RECUSADO'
  ).length;

  const currentPayroll = useMemo(() => {
    const active = squad.reduce(
      (sum, p) => sum + Math.round(p.salary * (p.wageSharePaid ?? 1)),
      0
    );
    const loaned = loanedOutPlayers.reduce(
      (sum, p) => sum + Math.round(p.salary * (p.wageSharePaid ?? 0)),
      0
    );
    return active + loaned;
  }, [squad, loanedOutPlayers]);

  const listedCount = squad.filter(
    (p) => p.isTransferListed || p.isLoanListed
  ).length;

  const injuredCount = squad.filter((p) => p.injured).length;

  const filteredPlayers = squad
    .filter((p) => {
      if (sectorFilter === 'LINEUP') return p.isStarter;
      if (sectorFilter === 'INJURED') return p.injured;
      if (sectorFilter === 'LISTED')
        return Boolean(p.isTransferListed || p.isLoanListed);
      if (sectorFilter === 'RENEWALS') return false;
      if (sectorFilter !== 'ALL') return p.sector === sectorFilter;
      return true;
    })
    .filter((p) =>
      p.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
    )
    .sort((a, b) => {
      if (sectorFilter === 'LINEUP') {
        return (a.slotIndex ?? 99) - (b.slotIndex ?? 99);
      }
      const ovrDiff =
        calculatePlayerOverall(b.attributes, b.position) -
        calculatePlayerOverall(a.attributes, a.position);
      if (ovrDiff !== 0) return ovrDiff;
      return a.name.localeCompare(b.name);
    });

  const handleSwapClick = (targetId: string) => {
    if (!selectedForSwapId) {
      setSelectedForSwapId(targetId);
      return;
    }
    if (selectedForSwapId === targetId) {
      setSelectedForSwapId(null);
      return;
    }
    onSwapPlayers(selectedForSwapId, targetId);
    setSelectedForSwapId(null);
  };

  const selectedSwapPlayer = squad.find((p) => p.id === selectedForSwapId);

  const filterTabs = [
    { id: 'ALL', label: `Todos (${squad.length})` },
    { id: 'RENEWALS', label: `Renovações (${pendingRenewalsCount})` },
    {
      id: 'LINEUP',
      label: `Escalados (${squad.filter((p) => p.isStarter).length})`,
    },
    { id: 'INJURED', label: `DM (${injuredCount})` },
    { id: 'LISTED', label: `Mercado (${listedCount})` },
    { id: 'GOL', label: 'Goleiros' },
    { id: 'DEF', label: 'Defensores' },
    { id: 'MEI', label: 'Meio-Campo' },
    { id: 'ATA', label: 'Atacantes' },
  ] as const;

  const filteredRenewalCandidates = renewalCandidates.filter((item) =>
    item.player.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  return (
    <div
      data-testid="squad-view"
      className="w-full max-w-full min-w-0 space-y-5 sm:space-y-6 overflow-x-clip"
    >
      {/* Editorial Header + Touch-Optimized Search & Primary Action */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div className="min-w-0">
          <span className="block text-xs sm:text-sm font-normal text-zinc-400 tracking-wide">
            Explorar plantel profissional
          </span>
          <h2 className="font-display text-3xl sm:text-5xl font-extrabold uppercase tracking-tight text-white leading-[0.95] mt-1">
            ELENCO ({squad.length})
          </h2>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
          <div className="relative flex-1 sm:w-60 lg:w-56 min-w-0">
            <Search
              aria-hidden="true"
              className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar jogador..."
              aria-label="Buscar jogador pelo nome"
              className="w-full min-h-[44px] bg-[#151821] border border-white/[0.09] rounded-xl pl-10 pr-10 py-2.5 text-sm sm:text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#b5ff00] transition-colors"
            />
            {searchQuery.length > 0 && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Limpar busca de jogador"
                className="absolute right-1 top-1/2 -translate-y-1/2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onAutoPickBestXI}
            className="min-h-[44px] px-5 py-2.5 rounded-xl text-xs sm:text-[13px] font-extrabold bg-[#b5ff00] hover:bg-[#c8ff33] active:scale-[0.98] text-[#090a0f] transition-all flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            Melhor Escalação
          </button>
        </div>
      </div>

      {/* Horizontal Touch Filter Strip (Contained — Zero Page Overflow) */}
      <div
        role="tablist"
        aria-label="Filtros do elenco"
        className="w-full max-w-full flex items-center gap-2 overflow-x-auto pb-1.5 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {filterTabs.map((tab) => {
          const isActive = sectorFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setSectorFilter(tab.id)}
              className={`min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 snap-start cursor-pointer ${
                isActive
                  ? 'bg-[#b5ff00] text-[#090a0f]'
                  : tab.id === 'INJURED' && injuredCount > 0
                  ? 'bg-rose-950/45 text-rose-200 border border-rose-500/40 hover:bg-rose-950/65'
                  : tab.id === 'RENEWALS' && expiringThisYearCount > 0
                  ? 'bg-amber-950/40 text-amber-200 border border-amber-400/40 hover:bg-amber-950/60'
                  : 'bg-[#151821] text-zinc-300 hover:text-white border border-white/[0.08]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Compact Unboxed Evolution Guide */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3 bg-[#10131a] border border-white/[0.07] rounded-2xl text-xs">
        <span className="font-semibold text-zinc-200 inline-flex items-center gap-1.5 whitespace-nowrap">
          <TrendingUp className="w-3.5 h-3.5 text-[#b5ff00] shrink-0" />
          Evolução:
        </span>
        <span className="font-mono text-amber-300 font-semibold whitespace-nowrap">
          ⚡ Superou Teto
        </span>
        <span className="font-mono text-[#b5ff00] font-semibold whitespace-nowrap">
          ▲ +OVR
        </span>
        <span className="font-mono text-rose-400 font-semibold whitespace-nowrap">
          ▼ -OVR
        </span>
        <span className="font-mono text-zinc-400 whitespace-nowrap">
          ▬ Estável
        </span>
      </div>

      {/* Active Swap Mode Banner */}
      {selectedSwapPlayer && (
        <div
          role="status"
          className="bg-[#b5ff00]/12 border border-[#b5ff00]/45 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm text-white"
        >
          <p className="leading-relaxed min-w-0">
            Selecionado para troca:{' '}
            <strong className="text-[#b5ff00]">
              #{selectedSwapPlayer.number} {selectedSwapPlayer.name} (
              {selectedSwapPlayer.position})
            </strong>
            . Toque em &quot;Trocar!&quot; em outro atleta para alternar a vaga.
          </p>
          <button
            type="button"
            onClick={() => setSelectedForSwapId(null)}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0b0c10] border border-[#b5ff00]/50 text-xs font-bold text-[#b5ff00] hover:bg-[#b5ff00]/15 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Cancelar troca
          </button>
        </div>
      )}

      {/* Annual Contract Renewal Panel */}
      {sectorFilter === 'RENEWALS' && (
        <div className="space-y-4">
          <div className="bg-[#14171f] border border-white/[0.08] rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-white font-bold text-sm sm:text-base">
                <FileSignature className="w-4 h-4 text-[#b5ff00] shrink-0" />
                <span>
                  Lista Anual de Renovações — Temporada {currentYear}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                Inclui contratos que vencem ao fim de {currentYear} (1 ano) e vínculos elegíveis no ano anterior ao vencimento (até {currentYear + 1}). Jogadores que evoluíram pedem mais; os que caíram aceitam redução.
              </p>
            </div>
            <div className="sm:text-right shrink-0 font-mono text-xs pt-3 sm:pt-0 border-t sm:border-t-0 border-white/[0.06] tabular-nums">
              <div className="text-zinc-400">Folha Mensal (Sem Limite)</div>
              <div className="text-white font-bold text-sm mt-0.5">
                {formatCompactBRL(currentPayroll)}/mês
              </div>
            </div>
          </div>

          {filteredRenewalCandidates.length === 0 ? (
            <div className="bg-[#14171f] border border-white/[0.07] rounded-2xl sm:rounded-3xl p-8 text-center space-y-3">
              <p className="text-sm text-zinc-400">
                {searchQuery.trim()
                  ? `Nenhum contrato em renovação encontrado para "${searchQuery.trim()}".`
                  : 'Todos os contratos definitivos do elenco têm 3 ou mais anos de duração restante.'}
              </p>
              {searchQuery.trim() && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-xs font-bold text-white transition-colors cursor-pointer"
                >
                  Limpar busca
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRenewalCandidates.map(
                ({ player, remainingYears, endYear, expectation }) => {
                  const chosenSalary =
                    salaryOfferChoices[player.id] ?? expectation.desiredSalary;
                  const chosenYears =
                    yearOfferChoices[player.id] ?? expectation.desiredAddYears;
                  const result = renewalResults[player.id];
                  const isRenewed =
                    player.contractRenewalStatus === 'RENOVADO' ||
                    remainingYears >= 3;
                  const isMarkedDoNotRenew =
                    player.contractRenewalStatus === 'RECUSADO';

                  const flexTextClass =
                    expectation.flexibility === 'Alta'
                      ? 'text-[#b5ff00]'
                      : expectation.flexibility === 'Média'
                      ? 'text-amber-300'
                      : 'text-rose-300';

                  const round5k = (val: number) =>
                    Math.min(
                      Math.max(
                        3_500_000,
                        Math.round(expectation.desiredSalary * 1.4)
                      ),
                      Math.max(20_000, Math.round(val / 5_000) * 5_000)
                    );

                  const presetSalaries = [
                    {
                      label: '-10%',
                      value: round5k(expectation.desiredSalary * 0.9),
                    },
                    {
                      label: 'Pedida',
                      value: expectation.desiredSalary,
                    },
                    {
                      label: '+10%',
                      value: round5k(expectation.desiredSalary * 1.1),
                    },
                    {
                      label: '+20%',
                      value: round5k(expectation.desiredSalary * 1.2),
                    },
                  ];

                  return (
                    <div
                      key={player.id}
                      className={`bg-[#14171f] border rounded-2xl sm:rounded-3xl p-4 sm:p-5 space-y-4 min-w-0 ${
                        isMarkedDoNotRenew
                          ? 'border-rose-500/35 opacity-85'
                          : 'border-white/[0.08]'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="flex items-center gap-2 shrink-0">
                            <PlayerJersey
                              number={player.number}
                              variant="lime"
                              size="sm"
                            />
                            <PlayerOvrBadge
                              ovr={expectation.currentOvr}
                              position={player.position}
                              size="md"
                            />
                          </div>
                          <div className="space-y-1.5 min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                              <button
                                type="button"
                                onClick={() => onInspectPlayer(player)}
                                className="font-bold text-base text-white hover:text-[#b5ff00] transition-colors text-left leading-snug cursor-pointer"
                              >
                                {player.name}
                              </button>
                              <span className="font-mono text-xs text-zinc-300 tabular-nums">
                                {player.age} anos
                              </span>
                              {expectation.recentOvrDelta !== 0 && (
                                <span
                                  className={`font-mono text-xs font-bold ${
                                    expectation.recentOvrDelta > 0
                                      ? 'text-[#b5ff00]'
                                      : 'text-rose-300'
                                  }`}
                                >
                                  {expectation.recentOvrDelta > 0
                                    ? `▲ +${expectation.recentOvrDelta} OVR`
                                    : `▼ ${expectation.recentOvrDelta} OVR`}
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-mono">
                              {isRenewed ? (
                                <span className="text-[#b5ff00] font-bold">
                                  ✓ Renovado até {endYear}
                                </span>
                              ) : isMarkedDoNotRenew ? (
                                <span className="text-rose-300 font-bold">
                                  ✕ Não renovar (sai fim de {endYear})
                                </span>
                              ) : remainingYears <= 1 ? (
                                <span className="text-rose-300 font-bold">
                                  Expira fim de {endYear} (Último Ano)
                                </span>
                              ) : (
                                <span className="text-sky-300 font-semibold">
                                  Antecipada (vence {endYear})
                                </span>
                              )}
                              <span aria-hidden="true" className="text-zinc-600">
                                ·
                              </span>
                              <span className={`font-semibold ${flexTextClass}`}>
                                Flexibilidade: {expectation.flexibility}
                              </span>
                            </div>

                            <p className="text-xs text-zinc-400 leading-relaxed">
                              {expectation.demandReason}
                            </p>
                          </div>
                        </div>

                        {/* Wage & Valuation Snapshot (2 cols on mobile, 3 cols on sm+) */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 shrink-0 bg-[#0b0c10] border border-white/[0.07] rounded-2xl p-3.5 text-xs font-mono tabular-nums">
                          <div className="min-w-0">
                            <div className="text-[11px] text-zinc-400">
                              Valor Atual
                            </div>
                            <div className="font-bold text-white mt-0.5 truncate">
                              {formatCompactBRL(player.marketValue)}
                            </div>
                          </div>
                          <div className="min-w-0">
                            <div className="text-[11px] text-zinc-400">
                              Salário Atual
                            </div>
                            <div className="font-bold text-zinc-200 mt-0.5 truncate">
                              {formatCompactBRL(player.salary)}
                            </div>
                          </div>
                          <div className="col-span-2 sm:col-span-1 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/[0.06] min-w-0">
                            <div className="text-[11px] text-zinc-400">
                              Pedida Mensal
                            </div>
                            <div className="font-bold text-[#b5ff00] mt-0.5">
                              {formatCompactBRL(expectation.desiredSalary)}{' '}
                              <span
                                className={`text-[11px] ${
                                  expectation.salaryDeltaPct > 0
                                    ? 'text-amber-300'
                                    : expectation.salaryDeltaPct < 0
                                    ? 'text-emerald-300'
                                    : 'text-zinc-400'
                                }`}
                              >
                                ({expectation.salaryDeltaPct >= 0 ? '+' : ''}
                                {expectation.salaryDeltaPct}%)
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {isMarkedDoNotRenew && !isRenewed && (
                        <div className="pt-3.5 border-t border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                          <span className="text-rose-200 leading-relaxed">
                            Você optou por <strong>não renovar</strong> com{' '}
                            {player.name}. O atleta ficará disponível para venda e deixará o clube sem custos ao fim de {endYear}.
                          </span>
                          {onToggleDoNotRenewContract && (
                            <button
                              type="button"
                              onClick={() => {
                                onToggleDoNotRenewContract(player, false);
                                setRenewalResults((prev) => {
                                  const next = { ...prev };
                                  delete next[player.id];
                                  return next;
                                });
                              }}
                              className="min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-bold bg-white/[0.08] hover:bg-white/[0.14] text-white border border-white/15 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              Reabrir Conversas
                            </button>
                          )}
                        </div>
                      )}

                      {onRenewContract && !isRenewed && !isMarkedDoNotRenew && (
                        <div className="pt-4 border-t border-white/[0.06] flex flex-col xl:flex-row xl:items-end justify-between gap-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:flex xl:flex-wrap items-start gap-4 w-full xl:w-auto">
                            <div className="min-w-0">
                              <div className="text-[11px] text-zinc-400 font-mono mb-2">
                                Oferta Salarial ({formatCompactBRL(chosenSalary)}/mês)
                              </div>
                              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
                                {presetSalaries.map((preset) => (
                                  <button
                                    key={preset.label}
                                    type="button"
                                    onClick={() =>
                                      setSalaryOfferChoices((prev) => ({
                                        ...prev,
                                        [player.id]: preset.value,
                                      }))
                                    }
                                    className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-mono font-bold border transition-colors cursor-pointer ${
                                      chosenSalary === preset.value
                                        ? 'bg-[#b5ff00]/20 border-[#b5ff00] text-[#b5ff00]'
                                        : 'bg-[#0b0c10] border-white/10 text-zinc-300 hover:text-white'
                                    }`}
                                  >
                                    {preset.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="min-w-0">
                              <div className="text-[11px] text-zinc-400 font-mono mb-2">
                                Extensão (Sugestão: +{expectation.desiredAddYears}{' '}
                                {expectation.desiredAddYears === 1
                                  ? 'ano'
                                  : 'anos'}
                                )
                              </div>
                              <div className="grid grid-cols-3 sm:flex items-center gap-2">
                                {([1, 2, 3] as const).map((yrs) => (
                                  <button
                                    key={yrs}
                                    type="button"
                                    onClick={() =>
                                      setYearOfferChoices((prev) => ({
                                        ...prev,
                                        [player.id]: yrs,
                                      }))
                                    }
                                    className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-mono font-bold border transition-colors cursor-pointer ${
                                      chosenYears === yrs
                                        ? 'bg-white text-[#090a0f] border-white'
                                        : 'bg-[#0b0c10] border-white/10 text-zinc-300 hover:text-white'
                                    }`}
                                  >
                                    +{yrs} {yrs === 1 ? 'Ano' : 'Anos'}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 xl:flex items-center gap-2.5 w-full xl:w-auto shrink-0">
                            {onToggleDoNotRenewContract && (
                              <button
                                type="button"
                                onClick={() => {
                                  onToggleDoNotRenewContract(player, true);
                                  setRenewalResults((prev) => {
                                    const next = { ...prev };
                                    delete next[player.id];
                                    return next;
                                  });
                                }}
                                className="min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-bold bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 border border-rose-500/35 transition-colors whitespace-nowrap cursor-pointer"
                              >
                                Não Renovar
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                const outcome = onRenewContract(
                                  player,
                                  chosenSalary,
                                  chosenYears
                                );
                                setRenewalResults((prev) => ({
                                  ...prev,
                                  [player.id]: outcome,
                                }));
                              }}
                              className="min-h-[44px] px-5 py-2.5 rounded-xl text-xs font-extrabold bg-[#b5ff00] hover:bg-[#c8ff33] text-[#090a0f] transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                            >
                              <FileSignature className="w-4 h-4 shrink-0" />
                              Propor Renovação
                            </button>
                          </div>
                        </div>
                      )}

                      {result && (
                        <div
                          className={`rounded-2xl border p-3.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            result.outcome === 'ACEITA'
                              ? 'bg-[#b5ff00]/10 border-[#b5ff00]/45 text-white'
                              : result.outcome === 'CONTRAPROPOSTA'
                              ? 'bg-amber-950/35 border-amber-400/45 text-amber-100'
                              : 'bg-rose-950/35 border-rose-500/40 text-rose-100'
                          }`}
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            {result.outcome === 'ACEITA' ? (
                              <CheckCircle2 className="w-4 h-4 text-[#b5ff00] shrink-0 mt-0.5" />
                            ) : result.outcome === 'CONTRAPROPOSTA' ? (
                              <Handshake className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                            )}
                            <div className="min-w-0">
                              <div className="font-bold">{result.headline}</div>
                              <div className="text-zinc-300 mt-0.5 leading-relaxed">
                                {result.summary}
                              </div>
                            </div>
                          </div>

                          {result.outcome === 'CONTRAPROPOSTA' &&
                            result.counterSalary &&
                            onRenewContract && (
                              <button
                                type="button"
                                onClick={() => {
                                  const accepted = onRenewContract(
                                    player,
                                    result.counterSalary!,
                                    result.counterAddYears ?? chosenYears
                                  );
                                  setRenewalResults((prev) => ({
                                    ...prev,
                                    [player.id]: accepted,
                                  }));
                                }}
                                className="min-h-[44px] w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-extrabold bg-amber-400 hover:bg-amber-300 text-[#090a0f] transition-colors text-center leading-snug shrink-0 cursor-pointer"
                              >
                                Aceitar Contraproposta (
                                {formatCompactBRL(result.counterSalary)}/mês · +
                                {result.counterAddYears ?? chosenYears}a)
                              </button>
                            )}
                        </div>
                      )}
                    </div>
                  );
                }
              )}
            </div>
          )}
        </div>
      )}

      {/* Empty Filter / Search State */}
      {sectorFilter !== 'RENEWALS' && filteredPlayers.length === 0 && (
        <div className="bg-[#14171f] border border-white/[0.08] rounded-2xl p-8 text-center space-y-3">
          <p className="text-sm text-zinc-400">
            Nenhum jogador encontrado para o filtro atual.
          </p>
          <button
            type="button"
            onClick={() => {
              setSectorFilter('ALL');
              setSearchQuery('');
            }}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-xs font-bold text-white transition-colors cursor-pointer"
          >
            Mostrar todos os atletas
          </button>
        </div>
      )}

      {/* Touch-Optimized Player Cards (Mobile 1-col & Tablet 2-col: < lg) */}
      {sectorFilter !== 'RENEWALS' && filteredPlayers.length > 0 && (
        <div
          data-testid="squad-touch-cards"
          className="grid grid-cols-1 sm:grid-cols-2 lg:hidden gap-3.5"
        >
          {filteredPlayers.map((player) => {
            const role = getRoleById(player.assignedRole);
            const ovr = calculatePlayerOverall(
              player.attributes,
              player.position
            );
            const cond = getConditionColor(player.condition);
            const isSelectedSwap = selectedForSwapId === player.id;
            const retirementEval = evaluatePlayerRetirementProbability(
              player,
              ovr
            );
            const injuryRisk = evaluatePlayerInjuryRisk(player);
            const remainingYears = getPlayerContractRemainingYears(player);

            return (
              <article
                key={player.id}
                data-testid="squad-player-card"
                className={`rounded-2xl border p-4 flex flex-col justify-between gap-3.5 min-w-0 transition-colors ${
                  isSelectedSwap
                    ? 'bg-[#b5ff00]/12 border-[#b5ff00]/60'
                    : 'bg-[#14171f] border-white/[0.08]'
                }`}
              >
                {/* Row 1: Player Identity + Financial Valuation */}
                <div className="flex items-start justify-between gap-3 min-w-0">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
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
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => onInspectPlayer(player)}
                        className="block w-full font-bold text-sm text-white hover:text-[#b5ff00] truncate text-left leading-snug cursor-pointer"
                      >
                        {player.name}
                      </button>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-zinc-400">
                        <span className="font-mono tabular-nums text-zinc-200">
                          {player.age}a
                        </span>
                        <span aria-hidden="true" className="text-zinc-600">
                          ·
                        </span>
                        <span
                          className={
                            player.isStarter
                              ? 'text-[#b5ff00] font-semibold'
                              : 'text-zinc-400'
                          }
                        >
                          {player.isStarter ? 'Escalado' : 'Elenco'}
                        </span>
                        <span aria-hidden="true" className="text-zinc-600">
                          ·
                        </span>
                        <span>{role.shortCode}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 font-mono tabular-nums">
                    <div className="text-xs font-bold text-white whitespace-nowrap">
                      {formatCompactBRL(player.marketValue)}
                    </div>
                    <div className="text-[11px] text-zinc-400 whitespace-nowrap mt-0.5">
                      {formatCompactBRL(player.salary)}/m
                    </div>
                  </div>
                </div>

                {/* Row 2: Condition Meter + Unboxed Status & Evolution Metadata */}
                <div className="space-y-2 pt-3 border-t border-white/[0.06]">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="w-16 h-1.5 bg-[#0b0c10] rounded-full overflow-hidden shrink-0">
                        <div
                          className={`h-full ${cond.bar}`}
                          style={{ width: `${player.condition}%` }}
                        />
                      </div>
                      <span
                        className={`font-mono font-semibold tabular-nums whitespace-nowrap ${cond.text}`}
                      >
                        Fís {Math.round(player.condition)}%
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
                      <span
                        className={
                          player.contractType === 'EMPRESTADO'
                            ? 'text-amber-300 font-semibold'
                            : remainingYears <= 1
                            ? 'text-rose-300 font-semibold'
                            : 'text-zinc-300'
                        }
                      >
                        {player.contractType === 'EMPRESTADO' ? 'Emp.' : 'Contr.'}{' '}
                        {remainingYears}a
                      </span>

                      {player.exceededExpectations ? (
                        <span className="text-amber-300 font-bold">
                          ⚡+{player.recentOvrDelta ?? 0}
                        </span>
                      ) : player.recentOvrDelta !== undefined &&
                        player.recentOvrDelta > 0 ? (
                        <span className="text-[#b5ff00] font-bold">
                          ▲+{player.recentOvrDelta}
                        </span>
                      ) : player.recentOvrDelta !== undefined &&
                        player.recentOvrDelta < 0 ? (
                        <span className="text-rose-400 font-bold">
                          ▼{player.recentOvrDelta}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {(player.injured ||
                    injuryRisk.riskLevel === 'CRITICO' ||
                    injuryRisk.riskLevel === 'ALTO' ||
                    retirementEval.isConsideringRetirement ||
                    player.isTransferListed ||
                    player.isLoanListed) && (
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                      {player.injured && (
                        <span
                          title={player.injuryNote || 'Lesionado'}
                          className="inline-flex items-center gap-1 text-rose-300 font-mono font-semibold"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          DM
                          {player.injuryDaysRemaining
                            ? ` · ${player.injuryDaysRemaining}d`
                            : ''}
                        </span>
                      )}
                      {!player.injured &&
                        (injuryRisk.riskLevel === 'CRITICO' ||
                          injuryRisk.riskLevel === 'ALTO') && (
                          <span
                            title={injuryRisk.advice}
                            className={`font-mono font-semibold ${
                              injuryRisk.riskLevel === 'CRITICO'
                                ? 'text-rose-300'
                                : 'text-amber-300'
                            }`}
                          >
                            {injuryRisk.riskLevel === 'CRITICO'
                              ? 'Sobrecarga física'
                              : 'Risco de lesão'}
                          </span>
                        )}
                      {retirementEval.isConsideringRetirement && (
                        <span
                          className="font-mono font-semibold text-amber-300"
                          title={retirementEval.factorNote}
                        >
                          Aposent. ~{retirementEval.annualProbabilityPct}%
                        </span>
                      )}
                      {player.isTransferListed && (
                        <span className="font-mono font-semibold text-sky-300">
                          À venda
                        </span>
                      )}
                      {player.isLoanListed && (
                        <span className="font-mono font-semibold text-indigo-300">
                          Para empréstimo
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Row 3: Generous >= 44px Touch Action Controls */}
                <div className="space-y-2 pt-1">
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => onInspectPlayer(player)}
                      aria-label={`Ver ficha e atributos de ${player.name}`}
                      className="min-h-[44px] px-3 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] active:scale-[0.98] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Eye className="w-4 h-4 text-[#b5ff00] shrink-0" />
                      <span>Ficha</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSwapClick(player.id)}
                      aria-label={`Trocar escalação de ${player.name}`}
                      className={`min-h-[44px] px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer ${
                        isSelectedSwap
                          ? 'bg-[#b5ff00] text-[#090a0f]'
                          : selectedForSwapId
                          ? 'bg-amber-400 text-[#090a0f]'
                          : 'bg-[#0b0c10] text-zinc-200 border border-white/12 hover:bg-white/[0.06]'
                      }`}
                    >
                      <ArrowLeftRight className="w-4 h-4 shrink-0" />
                      <span>
                        {isSelectedSwap
                          ? 'Selecionado'
                          : selectedForSwapId
                          ? 'Trocar!'
                          : 'Trocar'}
                      </span>
                    </button>
                  </div>

                  {onTogglePlayerMarketListing &&
                    player.contractType !== 'EMPRESTADO' && (
                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={() =>
                            onTogglePlayerMarketListing(player.id, 'TRANSFER')
                          }
                          aria-pressed={Boolean(player.isTransferListed)}
                          className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                            player.isTransferListed
                              ? 'bg-sky-400/20 text-sky-200 border-sky-400/60'
                              : 'bg-[#0b0c10]/70 text-zinc-400 hover:text-white border-white/[0.08]'
                          }`}
                        >
                          {player.isTransferListed ? '✓ À Venda' : 'Vender'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onTogglePlayerMarketListing(player.id, 'LOAN')
                          }
                          aria-pressed={Boolean(player.isLoanListed)}
                          className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                            player.isLoanListed
                              ? 'bg-indigo-400/20 text-indigo-200 border-indigo-400/60'
                              : 'bg-[#0b0c10]/70 text-zinc-400 hover:text-white border-white/[0.08]'
                          }`}
                        >
                          {player.isLoanListed ? '✓ Empréstimo' : 'Emprestar'}
                        </button>
                      </div>
                    )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* High-Density Analytical Table (Desktop lg+) */}
      {sectorFilter !== 'RENEWALS' && filteredPlayers.length > 0 && (
        <div className="hidden lg:block bg-[#14171f] border border-white/[0.07] rounded-[28px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/[0.07] bg-[#0b0c10]/60 text-[11px] text-zinc-400">
                  <th className="py-3 px-2 font-medium">Status</th>
                  <th className="py-3 px-2 font-medium">
                    Jogador · OVR & Pos.
                  </th>
                  <th className="py-3 px-1.5 font-medium">Função</th>
                  <th className="py-3 px-1.5 font-medium">Físico</th>
                  <th className="py-3 px-1.5 font-medium">Moral</th>
                  <th
                    className="hidden xl:table-cell py-3 px-1 font-medium text-right"
                    title="Passe"
                  >
                    PAS
                  </th>
                  <th
                    className="hidden xl:table-cell py-3 px-1 font-medium text-right"
                    title="Finalização"
                  >
                    FIN
                  </th>
                  <th
                    className="hidden xl:table-cell py-3 px-1 font-medium text-right"
                    title="Drible"
                  >
                    DRI
                  </th>
                  <th
                    className="hidden xl:table-cell py-3 px-1 font-medium text-right"
                    title="Desarme"
                  >
                    DES
                  </th>
                  <th
                    className="hidden xl:table-cell py-3 px-1 font-medium text-right"
                    title="Visão de Jogo"
                  >
                    VIS
                  </th>
                  <th
                    className="hidden xl:table-cell py-3 px-1 font-medium text-right"
                    title="Velocidade"
                  >
                    VEL
                  </th>
                  <th
                    className="py-3 px-1.5 font-medium text-right"
                    title="Overall (60-95) e Evolução Semestral (▲ verde / ▼ vermelha)"
                  >
                    OVR
                  </th>
                  <th className="py-3 px-1.5 font-medium text-right">Valor</th>
                  <th className="py-3 px-1.5 font-medium text-right">Salário</th>
                  <th className="py-3 px-2 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {filteredPlayers.map((player) => {
                  const role = getRoleById(player.assignedRole);
                  const fit = calculateRoleSuitability(player, role);
                  const ovr = calculatePlayerOverall(
                    player.attributes,
                    player.position
                  );
                  const cond = getConditionColor(player.condition);
                  const isSelectedSwap = selectedForSwapId === player.id;
                  const retirementEval = evaluatePlayerRetirementProbability(
                    player,
                    ovr
                  );
                  const injuryRisk = evaluatePlayerInjuryRisk(player);

                  return (
                    <tr
                      key={player.id}
                      className={`transition-colors ${
                        isSelectedSwap
                          ? 'bg-[#b5ff00]/15'
                          : 'bg-[#14171f] hover:bg-white/[0.04]'
                      }`}
                    >
                      <td className="py-2.5 px-2 whitespace-nowrap">
                        {player.isStarter ? (
                          <span className="font-mono font-bold text-[11px] text-[#b5ff00]">
                            Escalado
                          </span>
                        ) : (
                          <span className="text-[11px] text-zinc-400">
                            Elenco
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 min-w-[185px] max-w-[235px]">
                        <div className="flex items-center gap-2 min-w-0">
                          <PlayerJersey
                            number={player.number}
                            variant="lime"
                            size="xs"
                          />
                          <PlayerOvrBadge
                            ovr={ovr}
                            position={player.position}
                            size="sm"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <button
                                type="button"
                                onClick={() => onInspectPlayer(player)}
                                className="font-bold text-[13px] text-white hover:text-[#b5ff00] transition-colors text-left truncate cursor-pointer"
                              >
                                {player.name}
                              </button>
                              <span className="font-mono font-bold text-[11px] text-zinc-300 tabular-nums whitespace-nowrap shrink-0">
                                {player.age}a
                              </span>
                              {player.injured && (
                                <span
                                  title={
                                    player.injuryNote ||
                                    `${player.injuryType || 'Lesão'} (${formatInjuryDurationShort(
                                      player.injuryDaysRemaining ?? 7
                                    )})`
                                  }
                                  className="text-rose-300 flex items-center gap-0.5 text-[10px] font-mono font-bold whitespace-nowrap shrink-0"
                                >
                                  <AlertTriangle className="w-3 h-3" />
                                  DM
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-zinc-400 mt-0.5">
                              <span>{player.nationality}</span>
                              <span aria-hidden="true" className="text-zinc-600">
                                ·
                              </span>
                              <span
                                className={`font-mono font-bold whitespace-nowrap ${
                                  player.contractType === 'EMPRESTADO'
                                    ? 'text-amber-300'
                                    : getPlayerContractRemainingYears(player) <=
                                      1
                                    ? 'text-rose-300'
                                    : getPlayerContractRemainingYears(player) ===
                                      2
                                    ? 'text-sky-300'
                                    : 'text-zinc-400'
                                }`}
                              >
                                {player.contractType === 'EMPRESTADO'
                                  ? `Emp. ${getPlayerContractRemainingYears(
                                      player
                                    )}a`
                                  : `Contr. ${getPlayerContractRemainingYears(
                                      player
                                    )}a (${getPlayerContractEndYear(
                                      player,
                                      currentYear
                                    )})`}
                              </span>
                              <StarRating player={player} ovr={ovr} size="xs" />
                              {player.contractType === 'EMPRESTADO' && (
                                <span className="text-amber-300 font-medium">
                                  · {player.loanOriginClubName || 'Clube'}
                                </span>
                              )}
                              {player.isRegen && (
                                <span className="text-[#b5ff00] font-mono">
                                  · Base
                                </span>
                              )}
                              {player.isTransferListed && (
                                <span className="text-sky-300 font-mono font-bold">
                                  · À Venda
                                </span>
                              )}
                              {player.isLoanListed && (
                                <span className="text-indigo-300 font-mono font-bold">
                                  · Emp.
                                </span>
                              )}
                              {player.exceededExpectations && (
                                <span
                                  className="text-amber-300 font-mono font-bold"
                                  title="Superou o teto de potencial inicial graças a estatísticas de alto impacto"
                                >
                                  · ⚡ Teto
                                </span>
                              )}
                              {player.developmentStatus === 'ESTAGNADO' &&
                                player.age <= 22 && (
                                  <span
                                    className="text-zinc-500 font-mono"
                                    title="Sem minutagem suficiente para converter potencial em OVR"
                                  >
                                    · Minutagem
                                  </span>
                                )}
                              {retirementEval.isConsideringRetirement && (
                                <span
                                  className="font-mono font-bold text-amber-300"
                                  title={retirementEval.factorNote}
                                >
                                  · Apos. ~{retirementEval.annualProbabilityPct}%
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-1.5 min-w-[105px] max-w-[130px]">
                        <div className="text-zinc-200 leading-snug text-[11px]">
                          {role.name} ·{' '}
                          <span className="text-[#b5ff00] font-medium">
                            {player.assignedDuty}
                          </span>
                        </div>
                        <div className="text-[10px] text-zinc-400 font-mono tabular-nums">
                          Adeq. {fit.score}%
                        </div>
                      </td>
                      <td className="py-2.5 px-1.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <div className="w-7 h-1.5 bg-[#0b0c10] rounded-full overflow-hidden shrink-0">
                            <div
                              className={`h-full ${cond.bar}`}
                              style={{ width: `${player.condition}%` }}
                            />
                          </div>
                          <span
                            className={`font-mono text-[11px] tabular-nums ${cond.text}`}
                          >
                            {Math.round(player.condition)}%
                          </span>
                        </div>
                        {player.injured ? (
                          <div
                            className="text-[10px] text-rose-300 font-mono truncate max-w-[95px] mt-0.5"
                            title={player.injuryNote}
                          >
                            {player.injuryType || 'No DM'}
                          </div>
                        ) : injuryRisk.riskLevel === 'CRITICO' ||
                          injuryRisk.riskLevel === 'ALTO' ? (
                          <div
                            title={`${injuryRisk.advice} (Risco: ${injuryRisk.riskPctPerMatch}%/jogo · Rendimento: -${injuryRisk.performancePenaltyPct}%)`}
                            className={`text-[10px] font-mono font-bold mt-0.5 whitespace-nowrap ${
                              injuryRisk.riskLevel === 'CRITICO'
                                ? 'text-rose-400'
                                : 'text-amber-300'
                            }`}
                          >
                            {injuryRisk.riskLevel === 'CRITICO'
                              ? `Sobrec. -${injuryRisk.performancePenaltyPct}%`
                              : `Risco -${injuryRisk.performancePenaltyPct}%`}
                          </div>
                        ) : (player.consecutiveMatches ?? 0) >= 3 ? (
                          <div
                            title={injuryRisk.advice}
                            className="text-[10px] font-mono text-zinc-400 mt-0.5 whitespace-nowrap"
                          >
                            {player.consecutiveMatches}j seg.
                          </div>
                        ) : null}
                      </td>
                      <td
                        className={`py-2.5 px-1.5 text-[11px] font-medium whitespace-nowrap ${getMoraleColor(
                          player.morale
                        )}`}
                      >
                        {player.morale}
                      </td>
                      <td
                        className={`hidden xl:table-cell py-2.5 px-1 text-right font-mono tabular-nums ${getAttributeColorClass(
                          player.attributes.passe
                        )}`}
                      >
                        {player.attributes.passe}
                      </td>
                      <td
                        className={`hidden xl:table-cell py-2.5 px-1 text-right font-mono tabular-nums ${getAttributeColorClass(
                          player.attributes.finalizacao
                        )}`}
                      >
                        {player.attributes.finalizacao}
                      </td>
                      <td
                        className={`hidden xl:table-cell py-2.5 px-1 text-right font-mono tabular-nums ${getAttributeColorClass(
                          player.attributes.drible
                        )}`}
                      >
                        {player.attributes.drible}
                      </td>
                      <td
                        className={`hidden xl:table-cell py-2.5 px-1 text-right font-mono tabular-nums ${getAttributeColorClass(
                          player.attributes.desarme
                        )}`}
                      >
                        {player.attributes.desarme}
                      </td>
                      <td
                        className={`hidden xl:table-cell py-2.5 px-1 text-right font-mono tabular-nums ${getAttributeColorClass(
                          player.attributes.visaoDeJogo
                        )}`}
                      >
                        {player.attributes.visaoDeJogo}
                      </td>
                      <td
                        className={`hidden xl:table-cell py-2.5 px-1 text-right font-mono tabular-nums ${getAttributeColorClass(
                          player.attributes.velocidade
                        )}`}
                      >
                        {player.attributes.velocidade}
                      </td>
                      <td className="py-2.5 px-1.5 text-right font-mono tabular-nums whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          <span className="font-bold text-[#b5ff00] text-[13px]">
                            {ovr}
                          </span>
                          {player.exceededExpectations ? (
                            <span
                              className="text-amber-300 font-mono text-[10px] font-extrabold"
                              title={`⚡ Superou expectativas! Rompeu o teto de potencial teórico (+${player.recentOvrDelta ?? 0} OVR)`}
                            >
                              ⚡+{player.recentOvrDelta ?? 0}
                            </span>
                          ) : player.recentOvrDelta !== undefined &&
                            player.recentOvrDelta > 0 ? (
                            <span
                              className="text-[#b5ff00] font-mono text-[10px] font-extrabold"
                              title={`Evolução semestral: +${player.recentOvrDelta} OVR`}
                            >
                              ▲+{player.recentOvrDelta}
                            </span>
                          ) : player.recentOvrDelta !== undefined &&
                            player.recentOvrDelta < 0 ? (
                            <span
                              className="text-rose-400 font-mono text-[10px] font-extrabold"
                              title={
                                player.developmentStatus === 'DECLINIO_TECNICO'
                                  ? `Declínio técnico por baixo rendimento (${player.recentOvrDelta} OVR)`
                                  : `Regressão semestral: ${player.recentOvrDelta} OVR`
                              }
                            >
                              ▼{player.recentOvrDelta}
                            </span>
                          ) : (
                            <span
                              className="text-zinc-500 font-mono text-[10px]"
                              title={
                                player.developmentStatus === 'ESTAGNADO'
                                  ? 'Potencial estagnado por falta de minutagem ou rendimento regular'
                                  : 'OVR estável no semestre'
                              }
                            >
                              ▬ 0
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-1.5 text-right font-mono text-[11px] tabular-nums text-zinc-300 whitespace-nowrap">
                        {formatCompactBRL(player.marketValue)}
                      </td>
                      <td className="py-2.5 px-1.5 text-right font-mono text-[11px] tabular-nums text-zinc-400 whitespace-nowrap">
                        {formatCompactBRL(player.salary)}
                      </td>
                      <td className="py-2.5 px-2 text-right whitespace-nowrap">
                        <div className="flex flex-col items-end gap-1">
                          {onTogglePlayerMarketListing &&
                            player.contractType !== 'EMPRESTADO' && (
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    onTogglePlayerMarketListing(
                                      player.id,
                                      'TRANSFER'
                                    )
                                  }
                                  title="Disponibilizar jogador para transferência"
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors whitespace-nowrap border cursor-pointer ${
                                    player.isTransferListed
                                      ? 'bg-sky-400 text-[#090a0f] border-sky-400'
                                      : 'bg-[#0b0c10] hover:bg-white/[0.08] text-zinc-400 hover:text-white border-white/10'
                                  }`}
                                >
                                  {player.isTransferListed
                                    ? '✓ Venda'
                                    : 'Venda'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onTogglePlayerMarketListing(
                                      player.id,
                                      'LOAN'
                                    )
                                  }
                                  title="Disponibilizar jogador para empréstimo"
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors whitespace-nowrap border cursor-pointer ${
                                    player.isLoanListed
                                      ? 'bg-indigo-400 text-[#090a0f] border-indigo-400'
                                      : 'bg-[#0b0c10] hover:bg-white/[0.08] text-zinc-400 hover:text-white border-white/10'
                                  }`}
                                >
                                  {player.isLoanListed ? '✓ Emp.' : 'Emp.'}
                                </button>
                              </div>
                            )}
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => onInspectPlayer(player)}
                              aria-label={`Ver 18 atributos de ${player.name}`}
                              className="px-2 py-1 rounded-md bg-white/[0.08] hover:bg-white/[0.14] text-white text-[10px] font-semibold transition-colors flex items-center gap-1 whitespace-nowrap cursor-pointer"
                            >
                              <Eye className="w-3 h-3 text-[#b5ff00]" />
                              Ficha
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSwapClick(player.id)}
                              aria-label={`Trocar escalação de ${player.name}`}
                              className={`px-2 py-1 rounded-md text-[10px] font-bold transition-colors flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                                isSelectedSwap
                                  ? 'bg-[#b5ff00] text-[#090a0f]'
                                  : selectedForSwapId
                                  ? 'bg-amber-400 text-[#090a0f]'
                                  : 'bg-[#0b0c10] hover:bg-white/[0.08] text-zinc-300 border border-white/10'
                              }`}
                            >
                              <ArrowLeftRight className="w-3 h-3" />
                              {isSelectedSwap
                                ? 'Sel.'
                                : selectedForSwapId
                                ? 'Trocar!'
                                : 'Trocar'}
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
