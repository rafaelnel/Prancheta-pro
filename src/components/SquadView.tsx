import React, { useState } from 'react';
import {
  Users,
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
    <div className="space-y-4">
      {/* Filter & Actions Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
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
              { id: 'GOL', label: 'GOL' },
              { id: 'DEF', label: 'DEF' },
              { id: 'MEI', label: 'MEI' },
              { id: 'ATA', label: 'ATA' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSectorFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                sectorFilter === tab.id
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar jogador..."
              aria-label="Buscar jogador pelo nome"
              className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 w-full sm:w-48"
            />
          </div>

          <button
            onClick={onAutoPickBestXI}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap w-full sm:w-auto"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Escalar 11 Ideais (Físico + Nota)
          </button>
        </div>
      </div>

      {selectedSwapPlayer && (
        <div className="bg-emerald-950/50 border border-emerald-500/40 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-emerald-200">
          <span>
            Selecionado para troca:{' '}
            <strong>
              #{selectedSwapPlayer.number} {selectedSwapPlayer.name} (
              {selectedSwapPlayer.position})
            </strong>
            . Clique no botão &quot;Trocar&quot; de outro jogador para alternar a vaga.
          </span>
          <button
            onClick={() => setSelectedForSwapId(null)}
            className="text-xs font-semibold text-emerald-400 hover:underline"
          >
            Cancelar troca
          </button>
        </div>
      )}

      {/* High-Density Analytical Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] text-slate-400">
                <th className="py-3 px-3 font-medium">Status</th>
                <th className="py-3 px-2 font-medium">Nº</th>
                <th className="py-3 px-3 font-medium">Jogador</th>
                <th className="py-3 px-2 font-medium">Pos</th>
                <th className="py-3 px-3 font-medium">Função & Tarefa</th>
                <th className="py-3 px-3 font-medium">Condição</th>
                <th className="py-3 px-2 font-medium">Moral</th>
                <th
                  className="py-3 px-2 font-medium text-right"
                  title="Passe"
                >
                  PAS
                </th>
                <th
                  className="py-3 px-2 font-medium text-right"
                  title="Finalização"
                >
                  FIN
                </th>
                <th
                  className="py-3 px-2 font-medium text-right"
                  title="Drible"
                >
                  DRI
                </th>
                <th
                  className="py-3 px-2 font-medium text-right"
                  title="Desarme"
                >
                  DES
                </th>
                <th
                  className="py-3 px-2 font-medium text-right"
                  title="Visão de Jogo"
                >
                  VIS
                </th>
                <th
                  className="py-3 px-2 font-medium text-right"
                  title="Velocidade"
                >
                  VEL
                </th>
                <th className="py-3 px-2 font-medium text-right">Geral</th>
                <th className="py-3 px-3 font-medium text-right">Valor</th>
                <th className="py-3 px-3 font-medium text-right">Salário</th>
                <th className="py-3 px-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
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
                        ? 'bg-emerald-950/60'
                        : player.isStarter
                        ? 'bg-slate-900 hover:bg-slate-800/60'
                        : 'bg-slate-950/35 hover:bg-slate-800/40 text-slate-300'
                    }`}
                  >
                    <td className="py-2.5 px-3 font-mono">
                      <span
                        className={
                          player.isStarter
                            ? 'text-emerald-400 font-bold'
                            : 'text-slate-500'
                        }
                      >
                        {player.isStarter ? 'TIT' : 'RES'}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 font-mono tabular-nums text-slate-400">
                      {player.number}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onInspectPlayer(player)}
                          className="font-semibold text-slate-100 hover:text-emerald-400 transition-colors text-left"
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
                      <div className="text-[11px] text-slate-400">
                        {player.age} anos · {player.nationality}
                      </div>
                    </td>
                    <td className="py-2.5 px-2 font-mono font-semibold text-slate-200">
                      {player.position}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="text-slate-200">
                        {role.name} ·{' '}
                        <span className="text-emerald-400">
                          {player.assignedDuty}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                        Adequação: {fit.score}%
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${cond.bar}`}
                            style={{ width: `${player.condition}%` }}
                          />
                        </div>
                        <span
                          className={`font-mono tabular-nums ${cond.text}`}
                        >
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
                    <td className="py-2.5 px-2 text-right font-mono tabular-nums font-bold text-emerald-400 whitespace-nowrap">
                      {ovr.toFixed(1)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300 whitespace-nowrap">
                      {formatCompactBRL(player.marketValue)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-400 whitespace-nowrap">
                      {formatCompactBRL(player.salary)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onInspectPlayer(player)}
                          aria-label={`Ver 18 atributos de ${player.name}`}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition-colors flex items-center gap-1 whitespace-nowrap"
                        >
                          <Eye className="w-3 h-3" />
                          Atributos
                        </button>
                        <button
                          onClick={() => handleSwapClick(player.id)}
                          aria-label={`Trocar escalação de ${player.name}`}
                          className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors flex items-center gap-1 whitespace-nowrap ${
                            isSelectedSwap
                              ? 'bg-emerald-600 text-white'
                              : selectedForSwapId
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
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
