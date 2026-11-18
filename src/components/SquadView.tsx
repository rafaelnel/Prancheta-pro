import React, { useState } from 'react';
import {
  Search,
  ArrowLeftRight,
  Eye,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import { getRoleById } from '../data/tacticsData';
import {
  calculatePlayerOverall,
  calculateRoleSuitability,
} from '../engine/matchEngine';
import { Player, PositionSector } from '../types/football';
import {
  formatCompactBRL,
  getAttributeColorClass,
  getConditionColor,
  getMoraleColor,
} from '../utils/formatters';
import { StarRating } from './StarRating';

interface SquadViewProps {
  squad: Player[];
  onInspectPlayer: (player: Player) => void;
  onSwapPlayers: (playerAId: string, playerBId: string) => void;
  onAutoPickBestXI: () => void;
  onTogglePlayerMarketListing?: (
    playerId: string,
    mode: 'TRANSFER' | 'LOAN'
  ) => void;
  onSimulateMidSeasonEvolution?: () => void;
}

export const SquadView: React.FC<SquadViewProps> = ({
  squad,
  onInspectPlayer,
  onSwapPlayers,
  onAutoPickBestXI,
  onTogglePlayerMarketListing,
  onSimulateMidSeasonEvolution,
}) => {
  const [sectorFilter, setSectorFilter] = useState<
    'ALL' | 'STARTERS' | 'RESERVES' | 'LISTED' | PositionSector
  >('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedForSwapId, setSelectedForSwapId] = useState<string | null>(
    null
  );

  const listedCount = squad.filter(
    (p) => p.isTransferListed || p.isLoanListed
  ).length;

  const filteredPlayers = squad
    .filter((p) => {
      if (sectorFilter === 'STARTERS') return p.isStarter;
      if (sectorFilter === 'RESERVES') return !p.isStarter;
      if (sectorFilter === 'LISTED')
        return Boolean(p.isTransferListed || p.isLoanListed);
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
            onClick={onAutoPickBestXI}
            className="px-4 py-2 rounded-full text-xs font-extrabold bg-[#b5ff00] hover:bg-[#c8ff33] text-[#090a0f] transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Escalar 11 Ideais (Físico + Nota)
          </button>
        </div>
      </div>

      {/* Segmented Filter Pill Strip (Reference Screen 1 style) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {(
          [
            { id: 'ALL', label: `Todos (${squad.length})` },
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
        {onSimulateMidSeasonEvolution && (
          <button
            onClick={onSimulateMidSeasonEvolution}
            className="px-3 py-1.5 rounded-full text-[11px] font-bold bg-[#14171f] hover:bg-white/[0.08] text-[#b5ff00] border border-[#b5ff00]/40 hover:border-[#b5ff00] transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shadow-sm"
            title="Recalcula a evolução semestral dos jogadores com base no desempenho e minutagem no 1º turno"
          >
            <RefreshCw className="w-3 h-3" />
            Recalcular Evolução
          </button>
        )}
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

      {/* Mobile Compact Player List (< md) — Zero Horizontal Scroll */}
      <div className="md:hidden space-y-2">
        {filteredPlayers.map((player) => {
          const role = getRoleById(player.assignedRole);
          const ovr = calculatePlayerOverall(player.attributes, player.position);
          const cond = getConditionColor(player.condition);
          const isSelectedSwap = selectedForSwapId === player.id;

          return (
            <div
              key={player.id}
              className={`rounded-2xl border p-3 transition-colors ${
                isSelectedSwap
                  ? 'bg-[#b5ff00]/15 border-[#b5ff00]/60'
                  : player.isStarter
                  ? 'bg-[#14171f] border-white/[0.08]'
                  : 'bg-[#0b0c10]/70 border-white/[0.05]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-extrabold ${
                        player.isStarter
                          ? 'bg-[#b5ff00] text-[#090a0f]'
                          : 'bg-white/[0.07] text-zinc-400'
                      }`}
                    >
                      {player.isStarter ? 'TIT' : 'RES'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-white/[0.06] text-white font-mono text-[10px] font-bold">
                      {player.position}
                    </span>
                    <button
                      type="button"
                      onClick={() => onInspectPlayer(player)}
                      className="font-bold text-sm text-white hover:text-[#b5ff00] truncate text-left"
                    >
                      #{player.number} {player.name}
                    </button>
                    {player.injured && (
                      <span className="text-rose-400 flex items-center gap-0.5 text-[10px] font-mono font-bold">
                        <AlertTriangle className="w-3 h-3" />
                        DM
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-zinc-400 mt-1">
                    <span>{player.age}a</span>
                    <StarRating player={player} ovr={ovr} size="xs" />
                    <span className="text-zinc-500">·</span>
                    <span className="truncate">
                      {role.name} ({player.assignedDuty})
                    </span>
                  </div>
                </div>

                {/* Right OVR + Evolution Badge */}
                <div className="text-right shrink-0 font-mono tabular-nums">
                  <div className="inline-flex items-center gap-1">
                    <span className="text-base font-extrabold text-[#b5ff00]">
                      {ovr}
                    </span>
                    {player.exceededExpectations ? (
                      <span className="px-1 py-0.5 rounded bg-amber-400/25 text-amber-300 text-[10px] font-extrabold border border-amber-400/50">
                        ⚡+{player.recentOvrDelta ?? 0}
                      </span>
                    ) : player.recentOvrDelta !== undefined &&
                      player.recentOvrDelta > 0 ? (
                      <span className="px-1 py-0.5 rounded bg-emerald-500/20 text-[#b5ff00] text-[10px] font-extrabold border border-[#b5ff00]/40">
                        ▲+{player.recentOvrDelta}
                      </span>
                    ) : player.recentOvrDelta !== undefined &&
                      player.recentOvrDelta < 0 ? (
                      <span className="px-1 py-0.5 rounded bg-rose-500/20 text-rose-400 text-[10px] font-extrabold border border-rose-500/40">
                        ▼{player.recentOvrDelta}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">
                    {formatCompactBRL(player.marketValue)}
                  </div>
                </div>
              </div>

              <div className="mt-2.5 pt-2 border-t border-white/[0.06] flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-3 font-mono text-[11px]">
                  <span className={cond.text}>
                    Fís: {Math.round(player.condition)}%
                  </span>
                  <span className={getMoraleColor(player.morale)}>
                    {player.morale}
                  </span>
                  {player.isTransferListed && (
                    <span className="text-sky-300 font-bold text-[10px]">
                      [À Venda]
                    </span>
                  )}
                  {player.isLoanListed && (
                    <span className="text-indigo-300 font-bold text-[10px]">
                      [Emprést.]
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onInspectPlayer(player)}
                    className="px-3 py-1.5 rounded-full bg-white/[0.08] text-white text-[11px] font-semibold flex items-center gap-1"
                  >
                    <Eye className="w-3 h-3 text-[#b5ff00]" />
                    <span>Ficha</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwapClick(player.id)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1 ${
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
                        ? 'Selecionado'
                        : selectedForSwapId
                        ? 'Confirmar'
                        : 'Trocar'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* High-Density Analytical Table (Desktop & Tablet md+) */}
      <div className="hidden md:block bg-[#14171f] border border-white/[0.07] rounded-[28px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/[0.07] bg-[#0b0c10]/60 text-[11px] text-zinc-400">
                <th className="py-3.5 px-3 font-medium">Status</th>
                <th className="py-3.5 px-2 font-medium">Nº</th>
                <th className="py-3.5 px-3 font-medium">Jogador</th>
                <th className="py-3.5 px-2 font-medium">Pos</th>
                <th className="py-3.5 px-3 font-medium">Função & Tarefa</th>
                <th className="py-3.5 px-3 font-medium">Condição</th>
                <th className="py-3.5 px-2 font-medium">Moral</th>
                <th className="py-3.5 px-2 font-medium text-right" title="Passe">
                  PAS
                </th>
                <th
                  className="py-3.5 px-2 font-medium text-right"
                  title="Finalização"
                >
                  FIN
                </th>
                <th
                  className="py-3.5 px-2 font-medium text-right"
                  title="Drible"
                >
                  DRI
                </th>
                <th
                  className="py-3.5 px-2 font-medium text-right"
                  title="Desarme"
                >
                  DES
                </th>
                <th
                  className="py-3.5 px-2 font-medium text-right"
                  title="Visão de Jogo"
                >
                  VIS
                </th>
                <th
                  className="py-3.5 px-2 font-medium text-right"
                  title="Velocidade"
                >
                  VEL
                </th>
                <th
                  className="py-3.5 px-3 font-medium text-right"
                  title="Overall (60-99) e Evolução Semestral (▲ verde / ▼ vermelha)"
                >
                  OVR / EVOL
                </th>
                <th className="py-3.5 px-3 font-medium text-right">Valor</th>
                <th className="py-3.5 px-3 font-medium text-right">Salário</th>
                <th className="py-3.5 px-3 font-medium text-right">Ações</th>
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
                    <td className="py-2.5 px-3 font-mono">
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
                    <td className="py-2.5 px-2 font-mono tabular-nums text-zinc-400">
                      {player.number}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onInspectPlayer(player)}
                          className="font-semibold text-white hover:text-[#b5ff00] transition-colors text-left"
                        >
                          {player.name}
                        </button>
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
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-zinc-400 mt-0.5">
                        <span>
                          {player.age} anos · {player.nationality}
                        </span>
                        <StarRating player={player} ovr={ovr} size="xs" />
                        {player.contractType === 'EMPRESTADO' && (
                          <span className="text-amber-300 font-medium">
                            · Empréstimo ({player.loanOriginClubName || 'Clube'})
                          </span>
                        )}
                        {player.isRegen && (
                          <span className="text-[#b5ff00] font-mono text-[10px]">
                            · Revelado na Base
                          </span>
                        )}
                        {player.isTransferListed && (
                          <span className="text-sky-300 font-mono font-bold text-[10px]">
                            · [DISP. VENDA]
                          </span>
                        )}
                        {player.isLoanListed && (
                          <span className="text-indigo-300 font-mono font-bold text-[10px]">
                            · [DISP. EMPRÉSTIMO]
                          </span>
                        )}
                        {player.exceededExpectations && (
                          <span
                            className="text-amber-300 font-mono font-bold text-[10px]"
                            title="Superou o teto de potencial inicial graças a estatísticas de alto impacto"
                          >
                            · ⚡ Superou Teto
                          </span>
                        )}
                        {player.developmentStatus === 'ESTAGNADO' && player.age <= 22 && (
                          <span
                            className="text-zinc-500 font-mono text-[10px]"
                            title="Sem minutagem suficiente para converter potencial em OVR"
                          >
                            · [Pouca Minutagem]
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-2 font-mono font-bold text-white">
                      {player.position}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="text-zinc-200">
                        {role.name} ·{' '}
                        <span className="text-[#b5ff00] font-medium">
                          {player.assignedDuty}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-400 font-mono tabular-nums">
                        Adequação: {fit.score}%
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-1.5 bg-[#0b0c10] rounded-full overflow-hidden">
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
                      className={`py-2.5 px-2 font-medium whitespace-nowrap ${getMoraleColor(
                        player.morale
                      )}`}
                    >
                      {player.morale}
                    </td>
                    <td
                      className={`py-2.5 px-2 text-right font-mono tabular-nums ${getAttributeColorClass(
                        player.attributes.passe
                      )}`}
                    >
                      {player.attributes.passe}
                    </td>
                    <td
                      className={`py-2.5 px-2 text-right font-mono tabular-nums ${getAttributeColorClass(
                        player.attributes.finalizacao
                      )}`}
                    >
                      {player.attributes.finalizacao}
                    </td>
                    <td
                      className={`py-2.5 px-2 text-right font-mono tabular-nums ${getAttributeColorClass(
                        player.attributes.drible
                      )}`}
                    >
                      {player.attributes.drible}
                    </td>
                    <td
                      className={`py-2.5 px-2 text-right font-mono tabular-nums ${getAttributeColorClass(
                        player.attributes.desarme
                      )}`}
                    >
                      {player.attributes.desarme}
                    </td>
                    <td
                      className={`py-2.5 px-2 text-right font-mono tabular-nums ${getAttributeColorClass(
                        player.attributes.visaoDeJogo
                      )}`}
                    >
                      {player.attributes.visaoDeJogo}
                    </td>
                    <td
                      className={`py-2.5 px-2 text-right font-mono tabular-nums ${getAttributeColorClass(
                        player.attributes.velocidade
                      )}`}
                    >
                      {player.attributes.velocidade}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <span className="font-bold text-[#b5ff00] text-xs sm:text-sm">
                          {ovr}
                        </span>
                        {player.exceededExpectations ? (
                          <span
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-400/25 text-amber-300 font-mono text-[11px] font-extrabold border border-amber-400/50 shadow-sm"
                            title={`⚡ Superou expectativas! Rompeu o teto de potencial teórico (+${player.recentOvrDelta ?? 0} OVR)`}
                          >
                            ⚡+{player.recentOvrDelta ?? 0}
                          </span>
                        ) : player.recentOvrDelta !== undefined && player.recentOvrDelta > 0 ? (
                          <span
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-500/20 text-[#b5ff00] font-mono text-[11px] font-extrabold border border-[#b5ff00]/40 shadow-sm"
                            title={`Evolução semestral: +${player.recentOvrDelta} OVR`}
                          >
                            ▲+{player.recentOvrDelta}
                          </span>
                        ) : player.recentOvrDelta !== undefined && player.recentOvrDelta < 0 ? (
                          <span
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 font-mono text-[11px] font-extrabold border border-rose-500/40 shadow-sm"
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
                            className="inline-flex items-center px-1.5 py-0.5 rounded bg-white/[0.04] text-zinc-500 font-mono text-[10px] border border-white/[0.06]"
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
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-zinc-300 whitespace-nowrap">
                      {formatCompactBRL(player.marketValue)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-zinc-400 whitespace-nowrap">
                      {formatCompactBRL(player.salary)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {onTogglePlayerMarketListing &&
                          player.contractType !== 'EMPRESTADO' && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  onTogglePlayerMarketListing(
                                    player.id,
                                    'TRANSFER'
                                  )
                                }
                                title="Disponibilizar jogador para transferência (aumenta procura de clubes da IA e facilita venda)"
                                className={`px-2.5 py-1.5 rounded-full text-[10px] font-bold transition-colors whitespace-nowrap border ${
                                  player.isTransferListed
                                    ? 'bg-sky-400 text-[#090a0f] border-sky-400'
                                    : 'bg-[#0b0c10] hover:bg-white/[0.08] text-zinc-400 hover:text-white border-white/10'
                                }`}
                              >
                                {player.isTransferListed
                                  ? '✓ À Venda'
                                  : 'Listar Venda'}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onTogglePlayerMarketListing(player.id, 'LOAN')
                                }
                                title="Disponibilizar jogador para empréstimo (atrai propostas de clubes que precisam da posição)"
                                className={`px-2.5 py-1.5 rounded-full text-[10px] font-bold transition-colors whitespace-nowrap border ${
                                  player.isLoanListed
                                    ? 'bg-indigo-400 text-[#090a0f] border-indigo-400'
                                    : 'bg-[#0b0c10] hover:bg-white/[0.08] text-zinc-400 hover:text-white border-white/10'
                                }`}
                              >
                                {player.isLoanListed ? '✓ P/ Emp.' : 'Listar Emp.'}
                              </button>
                            </>
                          )}
                        <button
                          onClick={() => onInspectPlayer(player)}
                          aria-label={`Ver 18 atributos de ${player.name}`}
                          className="px-3 py-1.5 rounded-full bg-white/[0.08] hover:bg-white/[0.14] text-white text-[11px] font-semibold transition-colors flex items-center gap-1 whitespace-nowrap"
                        >
                          <Eye className="w-3 h-3 text-[#b5ff00]" />
                          Atributos
                        </button>
                        <button
                          onClick={() => handleSwapClick(player.id)}
                          aria-label={`Trocar escalação de ${player.name}`}
                          className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors flex items-center gap-1 whitespace-nowrap ${
                            isSelectedSwap
                              ? 'bg-[#b5ff00] text-[#090a0f]'
                              : selectedForSwapId
                              ? 'bg-amber-400 text-[#090a0f]'
                              : 'bg-[#0b0c10] hover:bg-white/[0.08] text-zinc-300 border border-white/10'
                          }`}
                        >
                          <ArrowLeftRight className="w-3 h-3" />
                          {isSelectedSwap
                            ? 'Selecionado'
                            : selectedForSwapId
                            ? 'Confirmar'
                            : 'Trocar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
