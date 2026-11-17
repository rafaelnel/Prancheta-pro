import React, { useState } from 'react';
import {
  Search,
  ArrowLeftRight,
  Eye,
  AlertTriangle,
  Sparkles,
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
}

export const SquadView: React.FC<SquadViewProps> = ({
  squad,
  onInspectPlayer,
  onSwapPlayers,
  onAutoPickBestXI,
}) => {
  const [sectorFilter, setSectorFilter] = useState<
    'ALL' | 'STARTERS' | 'RESERVES' | PositionSector
  >('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedForSwapId, setSelectedForSwapId] = useState<string | null>(
    null
  );

  const filteredPlayers = squad
    .filter((p) => {
      if (sectorFilter === 'STARTERS') return p.isStarter;
      if (sectorFilter === 'RESERVES') return !p.isStarter;
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

      {selectedSwapPlayer && (
        <div className="bg-[#b5ff00]/15 border border-[#b5ff00]/50 rounded-2xl px-4 py-3 flex items-center justify-between text-xs text-white">
          <span>
            Selecionado para troca:{' '}
            <strong className="text-[#b5ff00]">
              #{selectedSwapPlayer.number} {selectedSwapPlayer.name} (
              {selectedSwapPlayer.position})
            </strong>
            . Clique em &quot;Confirmar&quot; em outro atleta para alternar a vaga.
          </span>
          <button
            onClick={() => setSelectedForSwapId(null)}
            className="text-xs font-bold text-[#b5ff00] hover:underline"
          >
            Cancelar troca
          </button>
        </div>
      )}

      {/* High-Density Analytical Table */}
      <div className="bg-[#14171f] border border-white/[0.07] rounded-[28px] overflow-hidden">
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
                <th className="py-3.5 px-2 font-medium text-right" title="Overall (60-99 · 99 = Auge Histórico)">OVR</th>
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
                    <td className="py-2.5 px-2 text-right font-mono tabular-nums font-bold text-[#b5ff00] whitespace-nowrap">
                      {ovr}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-zinc-300 whitespace-nowrap">
                      {formatCompactBRL(player.marketValue)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-zinc-400 whitespace-nowrap">
                      {formatCompactBRL(player.salary)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
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
