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
} from 'lucide-react';
import { getRoleById } from '../data/tacticsData';
import {
  calculatePlayerOverall,
  calculateRoleSuitability,
} from '../engine/matchEngine';
import { evaluatePlayerRetirementProbability } from '../engine/economyAndEvolution';
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
    'ALL' | 'STARTERS' | 'RESERVES' | 'RENEWALS' | 'LISTED' | PositionSector
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

  const filteredPlayers = squad
    .filter((p) => {
      if (sectorFilter === 'STARTERS') return p.isStarter;
      if (sectorFilter === 'RESERVES') return !p.isStarter;
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
      if (a.isStarter && !b.isStarter) return -1;
      if (!a.isStarter && b.isStarter) return 1;
      return (a.slotIndex ?? 99) - (b.slotIndex ?? 99);
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

  return (
    <div className="space-y-5">
      {/* Editorial Header + Filter Pills */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-2 border-b border-white/[0.07]">
        <div>
          <span className="block text-xs sm:text-sm font-normal text-zinc-400 tracking-wide">
            Explorar plantel profissional
          </span>
          <h2 className="font-display text-3xl sm:text-5xl font-extrabold uppercase tracking-tight text-white leading-[0.95] mt-0.5">
            ELENCO ({squad.length})
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar jogador..."
              aria-label="Buscar jogador pelo nome"
              className="bg-[#151821] border border-white/[0.08] rounded-full pl-9 pr-4 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#b5ff00] w-full sm:w-52"
            />
          </div>

          <button
            type="button"
            onClick={onAutoPickBestXI}
            className="px-4 py-2 rounded-full text-xs font-extrabold bg-[#b5ff00] hover:bg-[#c8ff33] active:scale-95 text-[#090a0f] transition-all flex items-center justify-center gap-1.5 whitespace-nowrap shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Melhor Escalação
          </button>
        </div>
      </div>

      {/* Segmented Filter Pill Strip (Reference Screen 1 style) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {(
          [
            { id: 'ALL', label: `Todos (${squad.length})` },
            {
              id: 'RENEWALS',
              label: `Renovações (${pendingRenewalsCount})`,
            },
            {
              id: 'STARTERS',
              label: `Titulares (${squad.filter((p) => p.isStarter).length})`,
            },
            {
              id: 'RESERVES',
              label: `Reservas (${squad.filter((p) => !p.isStarter).length})`,
            },
            {
              id: 'LISTED',
              label: `Disponíveis no Mercado (${listedCount})`,
            },
            { id: 'GOL', label: 'Goleiros' },
            { id: 'DEF', label: 'Defensores' },
            { id: 'MEI', label: 'Meio-Campo' },
            { id: 'ATA', label: 'Atacantes' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSectorFilter(tab.id)}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${
              sectorFilter === tab.id
                ? 'bg-[#b5ff00] text-[#090a0f] shadow-sm'
                : tab.id === 'RENEWALS' && expiringThisYearCount > 0
                ? 'bg-amber-950/40 text-amber-300 border border-amber-400/45 hover:bg-amber-950/60'
                : 'bg-[#151821] text-zinc-400 hover:text-white border border-white/[0.07]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Visual Legend & Semiannual Evolution Guide */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-3.5 py-2.5 bg-[#0b0c10]/80 border border-white/[0.08] rounded-2xl text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-bold text-white flex items-center gap-1.5 whitespace-nowrap">
            <TrendingUp className="w-3.5 h-3.5 text-[#b5ff00]" />
            Evolução:
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 font-mono text-[11px] font-bold border border-amber-400/40">
            ⚡ Superou Teto
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/20 text-[#b5ff00] font-mono text-[11px] font-bold border border-[#b5ff00]/40">
            ▲ +OVR
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 font-mono text-[11px] font-bold border border-rose-500/40">
            ▼ -OVR
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/[0.05] text-zinc-400 font-mono text-[11px] border border-white/10">
            ▬ Estável
          </span>
        </div>
      </div>

      {selectedSwapPlayer && (
        <div className="bg-[#b5ff00]/15 border border-[#b5ff00]/50 rounded-2xl px-4 py-3 flex items-center justify-between text-xs text-white">
          <span>
            Selecionado para troca:{' '}
            <strong className="text-[#b5ff00]">
              #{selectedSwapPlayer.number} {selectedSwapPlayer.name} (
              {selectedSwapPlayer.position})
            </strong>
            . Toque em &quot;Confirmar&quot; em outro atleta para alternar a vaga.
          </span>
          <button
            onClick={() => setSelectedForSwapId(null)}
            className="text-xs font-bold text-[#b5ff00] hover:underline ml-2 shrink-0"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Annual Contract Renewal Panel */}
      {sectorFilter === 'RENEWALS' && (
        <div className="space-y-4">
          <div className="bg-[#14171f] border border-white/[0.08] rounded-[24px] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <FileSignature className="w-4 h-4 text-[#b5ff00]" />
                <span>
                  Lista Anual de Renovações — Temporada {currentYear}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                Inclui contratos que vencem ao fim de {currentYear} (1 ano) e vínculos elegíveis no ano anterior ao vencimento (até {currentYear + 1}). Jogadores que evoluíram pedem mais; os que caíram aceitam redução. Veteranos valorizam experiência na pedida.
              </p>
            </div>
            <div className="text-right shrink-0 font-mono text-xs">
              <div className="text-zinc-400">Folha Mensal / Teto</div>
              <div className="text-white font-bold">
                {formatCompactBRL(currentPayroll)} /{' '}
                {formatCompactBRL(club.wageBudget)}
              </div>
            </div>
          </div>

          {renewalCandidates.length === 0 ? (
            <div className="bg-[#14171f] border border-white/[0.07] rounded-[24px] p-8 text-center text-xs text-zinc-400">
              Todos os contratos definitivos do elenco têm 3 ou mais anos de duração restante.
            </div>
          ) : (
            <div className="space-y-3">
              {renewalCandidates
                .filter((item) =>
                  item.player.name
                    .toLowerCase()
                    .includes(searchQuery.trim().toLowerCase())
                )
                .map(({ player, remainingYears, endYear, expectation }) => {
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

                  const flexBadgeStyle =
                    expectation.flexibility === 'Alta'
                      ? 'bg-emerald-500/15 text-[#b5ff00] border-[#b5ff00]/40'
                      : expectation.flexibility === 'Média'
                      ? 'bg-amber-500/15 text-amber-300 border-amber-400/40'
                      : 'bg-rose-500/15 text-rose-300 border-rose-500/40';

                  const round5k = (val: number) =>
                    Math.min(
                      Math.max(3_500_000, Math.round(expectation.desiredSalary * 1.4)),
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
                      className={`bg-[#14171f] border rounded-[24px] p-4 sm:p-5 space-y-3.5 ${
                        isMarkedDoNotRenew
                          ? 'border-rose-500/35 opacity-85'
                          : 'border-white/[0.08]'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <PlayerJersey
                            number={player.number}
                            variant={player.isStarter ? 'lime' : 'white'}
                            size="sm"
                          />
                          <PlayerOvrBadge
                            ovr={expectation.currentOvr}
                            position={player.position}
                            size="md"
                          />
                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => onInspectPlayer(player)}
                                className="font-bold text-base text-white hover:text-[#b5ff00] transition-colors text-left"
                              >
                                {player.name}
                              </button>
                              <span className="font-mono text-xs font-bold text-white tabular-nums">
                                {player.age} anos
                              </span>
                              {expectation.recentOvrDelta !== 0 && (
                                <span
                                  className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-extrabold border ${
                                    expectation.recentOvrDelta > 0
                                      ? 'bg-emerald-500/20 text-[#b5ff00] border-[#b5ff00]/40'
                                      : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                  }`}
                                >
                                  {expectation.recentOvrDelta > 0
                                    ? `▲ +${expectation.recentOvrDelta} OVR`
                                    : `▼ ${expectation.recentOvrDelta} OVR`}
                                </span>
                              )}
                              {isRenewed ? (
                                <span className="px-2 py-0.5 rounded-full bg-[#b5ff00]/20 border border-[#b5ff00]/50 text-[#b5ff00] text-[10px] font-mono font-bold">
                                  ✓ Renovado até {endYear}
                                </span>
                              ) : isMarkedDoNotRenew ? (
                                <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/50 text-rose-200 text-[10px] font-mono font-extrabold">
                                  ✕ Decisão: Não Renovar (Sai fim de {endYear})
                                </span>
                              ) : remainingYears <= 1 ? (
                                <span className="px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/40 text-rose-300 text-[10px] font-mono font-bold">
                                  Expira fim de {endYear} (Último Ano)
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-400/40 text-sky-300 text-[10px] font-mono font-bold">
                                  Antecipada (vence fim de {endYear})
                                </span>
                              )}
                              <span
                                className={`px-2 py-0.5 rounded-full border text-[10px] font-mono font-bold ${flexBadgeStyle}`}
                              >
                                Flexibilidade: {expectation.flexibility}
                              </span>
                            </div>

                            <p className="text-xs text-zinc-400 leading-relaxed">
                              {expectation.demandReason}
                            </p>
                          </div>
                        </div>

                        {/* Wage & Valuation Snapshot */}
                        <div className="grid grid-cols-3 gap-2 sm:gap-3 shrink-0 bg-[#0b0c10] border border-white/[0.07] rounded-2xl px-3.5 py-2.5 text-xs font-mono tabular-nums">
                          <div>
                            <div className="text-[10px] text-zinc-400">
                              Valor Atual
                            </div>
                            <div className="font-bold text-white mt-0.5">
                              {formatCompactBRL(player.marketValue)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-zinc-400">
                              Salário Atual
                            </div>
                            <div className="font-bold text-zinc-200 mt-0.5">
                              {formatCompactBRL(player.salary)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-zinc-400">
                              Pedida Mensal
                            </div>
                            <div className="font-bold text-[#b5ff00] mt-0.5">
                              {formatCompactBRL(expectation.desiredSalary)}{' '}
                              <span
                                className={`text-[10px] ${
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
                        <div className="pt-3 border-t border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                          <span className="text-rose-200">
                            Você optou por <strong>não renovar</strong> com {player.name}. O atleta ficará disponível para venda e deixará o clube sem custos ao fim de {endYear}.
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
                              className="px-3.5 py-2 rounded-full text-xs font-bold bg-white/[0.08] hover:bg-white/[0.14] text-white border border-white/15 transition-colors whitespace-nowrap shrink-0"
                            >
                              Reabrir Conversas
                            </button>
                          )}
                        </div>
                      )}

                      {onRenewContract && !isRenewed && !isMarkedDoNotRenew && (
                        <div className="pt-3 border-t border-white/[0.06] flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <div>
                              <div className="text-[10px] text-zinc-400 font-mono mb-1">
                                Oferta Salarial ({formatCompactBRL(chosenSalary)}
                                /mês)
                              </div>
                              <div className="flex items-center gap-1.5">
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
                                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-mono font-bold border transition-colors ${
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

                            <div>
                              <div className="text-[10px] text-zinc-400 font-mono mb-1">
                                Extensão (Sugestão: +{expectation.desiredAddYears}{' '}
                                {expectation.desiredAddYears === 1
                                  ? 'ano'
                                  : 'anos'}
                                )
                              </div>
                              <div className="flex items-center gap-1.5">
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
                                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-mono font-bold border transition-colors ${
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

                          <div className="flex flex-wrap items-center gap-2">
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
                                className="px-3.5 py-2.5 rounded-full text-xs font-bold bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/35 transition-colors whitespace-nowrap"
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
                              className="px-4 py-2.5 rounded-full text-xs font-extrabold bg-[#b5ff00] hover:bg-[#c8ff33] text-[#090a0f] transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shadow-sm"
                            >
                              <FileSignature className="w-3.5 h-3.5" />
                              Propor Renovação
                            </button>
                          </div>
                        </div>
                      )}

                      {result && (
                        <div
                          className={`rounded-2xl border p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                            result.outcome === 'ACEITA'
                              ? 'bg-[#b5ff00]/10 border-[#b5ff00]/45 text-white'
                              : result.outcome === 'CONTRAPROPOSTA'
                              ? 'bg-amber-950/35 border-amber-400/45 text-amber-100'
                              : 'bg-rose-950/35 border-rose-500/40 text-rose-100'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            {result.outcome === 'ACEITA' ? (
                              <CheckCircle2 className="w-4 h-4 text-[#b5ff00] shrink-0 mt-0.5" />
                            ) : result.outcome === 'CONTRAPROPOSTA' ? (
                              <Handshake className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                            )}
                            <div>
                              <div className="font-bold">{result.headline}</div>
                              <div className="text-zinc-300 mt-0.5">
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
                                className="px-3.5 py-2 rounded-full text-xs font-extrabold bg-amber-400 hover:bg-amber-300 text-[#090a0f] transition-colors whitespace-nowrap shrink-0"
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
                })}
            </div>
          )}
        </div>
      )}

      {/* Mobile Compact Player List (< md) — High Density & Tactile Feedback */}
      {sectorFilter !== 'RENEWALS' && (
      <div className="md:hidden space-y-1.5">
        {filteredPlayers.map((player) => {
          const role = getRoleById(player.assignedRole);
          const ovr = calculatePlayerOverall(player.attributes, player.position);
          const cond = getConditionColor(player.condition);
          const isSelectedSwap = selectedForSwapId === player.id;
          const retirementEval = evaluatePlayerRetirementProbability(player, ovr);

          return (
            <div
              key={player.id}
              className={`rounded-xl border px-2.5 py-2.5 transition-all ${
                isSelectedSwap
                  ? 'bg-[#b5ff00]/15 border-[#b5ff00]/60'
                  : player.isStarter
                  ? 'bg-[#14171f] border-white/[0.08]'
                  : 'bg-[#0b0c10]/70 border-white/[0.05]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <PlayerJersey
                    number={player.number}
                    variant={player.isStarter ? 'lime' : 'white'}
                    size="xs"
                  />
                  <PlayerOvrBadge
                    ovr={ovr}
                    position={player.position}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-extrabold shrink-0 ${
                          player.isStarter
                            ? 'bg-[#b5ff00] text-[#090a0f]'
                            : 'bg-white/[0.07] text-zinc-400'
                        }`}
                      >
                        {player.isStarter ? 'TIT' : 'RES'}
                      </span>
                      <button
                        type="button"
                        onClick={() => onInspectPlayer(player)}
                        className="font-bold text-xs text-white hover:text-[#b5ff00] truncate text-left"
                      >
                        {player.name}
                      </button>
                      <span className="text-[11px] font-mono font-bold text-zinc-200 tabular-nums shrink-0">
                        · {player.age}a
                      </span>
                      {player.injured && (
                        <span className="text-rose-400 flex items-center gap-0.5 text-[10px] font-mono font-bold shrink-0">
                          <AlertTriangle className="w-3 h-3" />
                          DM
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-[11px] font-mono tabular-nums text-zinc-300 font-bold shrink-0">
                  {formatCompactBRL(player.marketValue)}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-white/[0.06]">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-zinc-400 min-w-0">
                  <span
                    className={`px-1 py-0.2 rounded font-mono text-[9px] font-bold ${
                      player.contractType === 'EMPRESTADO'
                        ? 'bg-amber-500/15 text-amber-300'
                        : getPlayerContractRemainingYears(player) <= 1
                        ? 'bg-rose-500/15 text-rose-300'
                        : 'bg-white/[0.06] text-zinc-300'
                    }`}
                  >
                    {player.contractType === 'EMPRESTADO' ? 'Emp.' : 'Contr.'}{' '}
                    {getPlayerContractRemainingYears(player)}a
                  </span>
                  <span className={cond.text}>
                    Fís {Math.round(player.condition)}%
                  </span>
                  {player.exceededExpectations ? (
                    <span className="px-1 py-0.2 rounded bg-amber-400/25 text-amber-300 text-[9px] font-extrabold border border-amber-400/50">
                      ⚡+{player.recentOvrDelta ?? 0}
                    </span>
                  ) : player.recentOvrDelta !== undefined &&
                    player.recentOvrDelta > 0 ? (
                    <span className="px-1 py-0.2 rounded bg-emerald-500/20 text-[#b5ff00] text-[9px] font-extrabold border border-[#b5ff00]/40">
                      ▲+{player.recentOvrDelta}
                    </span>
                  ) : player.recentOvrDelta !== undefined &&
                    player.recentOvrDelta < 0 ? (
                    <span className="px-1 py-0.2 rounded bg-rose-500/20 text-rose-400 text-[9px] font-extrabold border border-rose-500/40">
                      ▼{player.recentOvrDelta}
                    </span>
                  ) : null}
                  {retirementEval.isConsideringRetirement && (
                    <span
                      className="px-1 py-0.2 rounded font-mono text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/40"
                      title={retirementEval.factorNote}
                    >
                      Aposent. ~{retirementEval.annualProbabilityPct}%
                    </span>
                  )}
                  <span className="text-zinc-500">·</span>
                  <span>{role.shortCode}</span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onInspectPlayer(player)}
                    className="px-2 py-1 rounded-full bg-white/[0.08] active:scale-95 text-white text-[10px] font-semibold flex items-center gap-1 transition-transform"
                  >
                    <Eye className="w-3 h-3 text-[#b5ff00]" />
                    <span>Ficha</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwapClick(player.id)}
                    className={`px-2 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 active:scale-95 transition-transform ${
                      isSelectedSwap
                        ? 'bg-[#b5ff00] text-[#090a0f]'
                        : selectedForSwapId
                        ? 'bg-amber-400 text-[#090a0f]'
                        : 'bg-[#0b0c10] text-zinc-200 border border-white/10'
                    }`}
                  >
                    <ArrowLeftRight className="w-3 h-3" />
                    <span>
                      {isSelectedSwap
                        ? 'Sel.'
                        : selectedForSwapId
                        ? 'Trocar!'
                        : 'Trocar'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* High-Density Analytical Table (Desktop & Tablet md+) */}
      {sectorFilter !== 'RENEWALS' && (
      <div className="hidden md:block bg-[#14171f] border border-white/[0.07] rounded-[28px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/[0.07] bg-[#0b0c10]/60 text-[11px] text-zinc-400">
                <th className="py-3 px-2 font-medium">Status</th>
                <th className="py-3 px-2.5 font-medium">Jogador · OVR & Posição</th>
                <th className="py-3 px-2 font-medium">Função & Tarefa</th>
                <th className="py-3 px-2 font-medium">Condição</th>
                <th className="py-3 px-1.5 font-medium">Moral</th>
                <th className="py-3 px-1.5 font-medium text-right" title="Passe">
                  PAS
                </th>
                <th
                  className="py-3 px-1.5 font-medium text-right"
                  title="Finalização"
                >
                  FIN
                </th>
                <th
                  className="py-3 px-1.5 font-medium text-right"
                  title="Drible"
                >
                  DRI
                </th>
                <th
                  className="py-3 px-1.5 font-medium text-right"
                  title="Desarme"
                >
                  DES
                </th>
                <th
                  className="py-3 px-1.5 font-medium text-right"
                  title="Visão de Jogo"
                >
                  VIS
                </th>
                <th
                  className="py-3 px-1.5 font-medium text-right"
                  title="Velocidade"
                >
                  VEL
                </th>
                <th
                  className="py-3 px-2 font-medium text-right"
                  title="Overall (60-95) e Evolução Semestral (▲ verde / ▼ vermelha)"
                >
                  OVR / EVOL
                </th>
                <th className="py-3 px-2 font-medium text-right">Valor</th>
                <th className="py-3 px-2 font-medium text-right">Salário</th>
                <th className="py-3 px-2.5 font-medium text-right">Ações</th>
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
                const retirementEval = evaluatePlayerRetirementProbability(player, ovr);

                return (
                  <tr
                    key={player.id}
                    className={`transition-colors ${
                      isSelectedSwap
                        ? 'bg-[#b5ff00]/15'
                        : player.isStarter
                        ? 'bg-[#14171f] hover:bg-white/[0.04]'
                        : 'bg-[#0b0c10]/40 hover:bg-white/[0.03] text-zinc-300'
                    }`}
                  >
                    <td className="py-2.5 px-2 font-mono">
                      <span
                        className={
                          player.isStarter
                            ? 'text-[#b5ff00] font-bold'
                            : 'text-zinc-500'
                        }
                      >
                        {player.isStarter ? 'TIT' : 'RES'}
                      </span>
                    </td>
                    <td className="py-2.5 px-2.5 min-w-[220px]">
                      <div className="flex items-center gap-2">
                        <PlayerJersey
                          number={player.number}
                          variant={player.isStarter ? 'lime' : 'white'}
                          size="sm"
                        />
                        <PlayerOvrBadge
                          ovr={ovr}
                          position={player.position}
                          size="md"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              onClick={() => onInspectPlayer(player)}
                              className="font-bold text-sm text-white hover:text-[#b5ff00] transition-colors text-left whitespace-nowrap"
                            >
                              {player.name}
                            </button>
                            <span className="font-mono font-bold text-xs text-white tabular-nums whitespace-nowrap">
                              {player.age} anos
                            </span>
                            {player.injured && (
                              <span
                                title={player.injuryNote}
                                className="text-rose-400 flex items-center gap-0.5 text-[10px] font-mono"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                                DM
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-zinc-400 mt-0.5">
                            <span>{player.nationality}</span>
                            <span
                              className={`px-1.5 py-0.2 rounded font-mono text-[10px] font-bold whitespace-nowrap ${
                                player.contractType === 'EMPRESTADO'
                                  ? 'bg-amber-500/15 text-amber-300'
                                  : getPlayerContractRemainingYears(player) <= 1
                                  ? 'bg-rose-500/15 text-rose-300'
                                  : getPlayerContractRemainingYears(player) === 2
                                  ? 'bg-sky-500/15 text-sky-300'
                                  : 'bg-white/[0.06] text-zinc-400'
                              }`}
                            >
                              {player.contractType === 'EMPRESTADO'
                                ? `Emp. ${getPlayerContractRemainingYears(player)}a (${getPlayerContractEndYear(player, currentYear)})`
                                : `Contrato ${getPlayerContractRemainingYears(player)}a (${getPlayerContractEndYear(player, currentYear)})`}
                            </span>
                            <StarRating player={player} ovr={ovr} size="xs" />
                            {player.contractType === 'EMPRESTADO' && (
                              <span className="text-amber-300 font-medium">
                                · Origem: {player.loanOriginClubName || 'Clube'}
                              </span>
                            )}
                            {player.isRegen && (
                              <span className="text-[#b5ff00] font-mono text-[10px]">
                                · Base
                              </span>
                            )}
                            {player.isTransferListed && (
                              <span className="text-sky-300 font-mono font-bold text-[10px]">
                                · [VENDA]
                              </span>
                            )}
                            {player.isLoanListed && (
                              <span className="text-indigo-300 font-mono font-bold text-[10px]">
                                · [EMP.]
                              </span>
                            )}
                            {player.exceededExpectations && (
                              <span
                                className="text-amber-300 font-mono font-bold text-[10px]"
                                title="Superou o teto de potencial inicial graças a estatísticas de alto impacto"
                              >
                                · ⚡ Teto
                              </span>
                            )}
                            {player.developmentStatus === 'ESTAGNADO' && player.age <= 22 && (
                              <span
                                className="text-zinc-500 font-mono text-[10px]"
                                title="Sem minutagem suficiente para converter potencial em OVR"
                              >
                                · [Minutagem]
                              </span>
                            )}
                            {retirementEval.isConsideringRetirement && (
                              <span
                                className="px-1.5 py-0.2 rounded font-mono text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-400/35"
                                title={retirementEval.factorNote}
                              >
                                ⏳ Aposent. ~{retirementEval.annualProbabilityPct}%
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 min-w-[125px] max-w-[155px]">
                      <div className="text-zinc-200 leading-snug">
                        {role.name} ·{' '}
                        <span className="text-[#b5ff00] font-medium">
                          {player.assignedDuty}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-400 font-mono tabular-nums">
                        Adeq.: {fit.score}%
                      </div>
                    </td>
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-1.5">
                        <div className="w-8 h-1.5 bg-[#0b0c10] rounded-full overflow-hidden shrink-0">
                          <div
                            className={`h-full ${cond.bar}`}
                            style={{ width: `${player.condition}%` }}
                          />
                        </div>
                        <span className={`font-mono tabular-nums ${cond.text}`}>
                          {Math.round(player.condition)}%
                        </span>
                      </div>
                    </td>
                    <td
                      className={`py-2.5 px-1.5 font-medium whitespace-nowrap ${getMoraleColor(
                        player.morale
                      )}`}
                    >
                      {player.morale}
                    </td>
                    <td
                      className={`py-2.5 px-1.5 text-right font-mono tabular-nums ${getAttributeColorClass(
                        player.attributes.passe
                      )}`}
                    >
                      {player.attributes.passe}
                    </td>
                    <td
                      className={`py-2.5 px-1.5 text-right font-mono tabular-nums ${getAttributeColorClass(
                        player.attributes.finalizacao
                      )}`}
                    >
                      {player.attributes.finalizacao}
                    </td>
                    <td
                      className={`py-2.5 px-1.5 text-right font-mono tabular-nums ${getAttributeColorClass(
                        player.attributes.drible
                      )}`}
                    >
                      {player.attributes.drible}
                    </td>
                    <td
                      className={`py-2.5 px-1.5 text-right font-mono tabular-nums ${getAttributeColorClass(
                        player.attributes.desarme
                      )}`}
                    >
                      {player.attributes.desarme}
                    </td>
                    <td
                      className={`py-2.5 px-1.5 text-right font-mono tabular-nums ${getAttributeColorClass(
                        player.attributes.visaoDeJogo
                      )}`}
                    >
                      {player.attributes.visaoDeJogo}
                    </td>
                    <td
                      className={`py-2.5 px-1.5 text-right font-mono tabular-nums ${getAttributeColorClass(
                        player.attributes.velocidade
                      )}`}
                    >
                      {player.attributes.velocidade}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono tabular-nums whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1">
                        <span className="font-bold text-[#b5ff00] text-xs sm:text-sm">
                          {ovr}
                        </span>
                        {player.exceededExpectations ? (
                          <span
                            className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-amber-400/25 text-amber-300 font-mono text-[10px] font-extrabold border border-amber-400/50 shadow-sm"
                            title={`⚡ Superou expectativas! Rompeu o teto de potencial teórico (+${player.recentOvrDelta ?? 0} OVR)`}
                          >
                            ⚡+{player.recentOvrDelta ?? 0}
                          </span>
                        ) : player.recentOvrDelta !== undefined && player.recentOvrDelta > 0 ? (
                          <span
                            className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-emerald-500/20 text-[#b5ff00] font-mono text-[10px] font-extrabold border border-[#b5ff00]/40 shadow-sm"
                            title={`Evolução semestral: +${player.recentOvrDelta} OVR`}
                          >
                            ▲+{player.recentOvrDelta}
                          </span>
                        ) : player.recentOvrDelta !== undefined && player.recentOvrDelta < 0 ? (
                          <span
                            className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-rose-500/20 text-rose-400 font-mono text-[10px] font-extrabold border border-rose-500/40 shadow-sm"
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
                            className="inline-flex items-center px-1 py-0.5 rounded bg-white/[0.04] text-zinc-500 font-mono text-[10px] border border-white/[0.06]"
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
                    <td className="py-2.5 px-2 text-right font-mono tabular-nums text-zinc-300 whitespace-nowrap">
                      {formatCompactBRL(player.marketValue)}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono tabular-nums text-zinc-400 whitespace-nowrap">
                      {formatCompactBRL(player.salary)}
                    </td>
                    <td className="py-2.5 px-2.5 text-right">
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
                                title="Disponibilizar jogador para transferência (aumenta procura de clubes da IA e facilita venda)"
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors whitespace-nowrap border ${
                                  player.isTransferListed
                                    ? 'bg-sky-400 text-[#090a0f] border-sky-400'
                                    : 'bg-[#0b0c10] hover:bg-white/[0.08] text-zinc-400 hover:text-white border-white/10'
                                }`}
                              >
                                {player.isTransferListed
                                  ? '✓ À Venda'
                                  : 'Venda'}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onTogglePlayerMarketListing(player.id, 'LOAN')
                                }
                                title="Disponibilizar jogador para empréstimo (atrai propostas de clubes que precisam da posição)"
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors whitespace-nowrap border ${
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
                            onClick={() => onInspectPlayer(player)}
                            aria-label={`Ver 18 atributos de ${player.name}`}
                            className="px-2.5 py-1 rounded-full bg-white/[0.08] hover:bg-white/[0.14] text-white text-[10px] font-semibold transition-colors flex items-center gap-1 whitespace-nowrap"
                          >
                            <Eye className="w-3 h-3 text-[#b5ff00]" />
                            Atributos
                          </button>
                          <button
                            onClick={() => handleSwapClick(player.id)}
                            aria-label={`Trocar escalação de ${player.name}`}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-colors flex items-center gap-1 whitespace-nowrap ${
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
