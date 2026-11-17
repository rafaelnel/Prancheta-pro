import React from 'react';
import { X, AlertTriangle } from 'lucide-react';
import {
  ATTRIBUTE_LABELS,
  MENTAL_KEYS,
  PHYSICAL_KEYS,
  TACTICAL_ROLES,
  TECHNICAL_KEYS,
  getRoleById,
} from '../data/tacticsData';
import {
  calculatePlayerOverall,
  calculateRoleSuitability,
} from '../engine/matchEngine';
import { AttributeKey, Player, TacticalDuty } from '../types/football';
import {
  formatCompactBRL,
  getAttributeColorClass,
  getConditionColor,
  getMoraleColor,
} from '../utils/formatters';

interface PlayerProfileModalProps {
  player: Player | null;
  onClose: () => void;
  onUpdateRoleDuty: (
    playerId: string,
    roleId: string,
    duty: TacticalDuty
  ) => void;
}

export const PlayerProfileModal: React.FC<PlayerProfileModalProps> = ({
  player,
  onClose,
  onUpdateRoleDuty,
}) => {
  if (!player) return null;

  const currentRole = getRoleById(player.assignedRole);
  const suitability = calculateRoleSuitability(player, currentRole);
  const overall = calculatePlayerOverall(player.attributes, player.position);
  const condStyle = getConditionColor(player.condition);

  const renderAttributeGroup = (title: string, keys: AttributeKey[]) => (
    <div className="bg-[#0b0c10] border border-white/[0.07] rounded-2xl p-4">
      <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2.5 pb-1.5 border-b border-white/[0.07]">
        {title}
      </h4>
      <div className="space-y-2">
        {keys.map((key) => {
          const val = player.attributes[key];
          const isKey = currentRole.keyAttributes.includes(key);
          const isSecondary = currentRole.secondaryAttributes.includes(key);

          return (
            <div
              key={key}
              className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-colors ${
                isKey
                  ? 'bg-[#b5ff00]/15 border border-[#b5ff00]/50'
                  : isSecondary
                  ? 'bg-white/[0.06] border border-white/20'
                  : 'border border-transparent'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={
                    isKey
                      ? 'text-white font-semibold'
                      : isSecondary
                      ? 'text-zinc-200 font-medium'
                      : 'text-zinc-400'
                  }
                >
                  {ATTRIBUTE_LABELS[key]}
                </span>
                {isKey && (
                  <span className="text-[10px] text-[#b5ff00] font-mono font-bold">
                    · Chave
                  </span>
                )}
                {isSecondary && (
                  <span className="text-[10px] text-white font-mono">
                    · Apoio
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 bg-[#14171f] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      val >= 16
                        ? 'bg-[#b5ff00]'
                        : val >= 13
                        ? 'bg-[#d9ff7a]'
                        : val >= 10
                        ? 'bg-amber-400'
                        : 'bg-zinc-600'
                    }`}
                    style={{ width: `${(val / 20) * 100}%` }}
                  />
                </div>
                <span
                  className={`font-mono tabular-nums w-5 text-right ${getAttributeColorClass(
                    val
                  )}`}
                >
                  {val}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2.5 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="player-modal-title"
    >
      <div className="bg-[#14171f] border border-white/10 rounded-[28px] max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Top Header */}
        <div className="flex flex-wrap sm:flex-nowrap items-start justify-between gap-3 sm:gap-4 p-4 sm:p-6 border-b border-white/[0.07] bg-[#0b0c10]/60">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-[#b5ff00] text-[#090a0f] flex flex-col items-center justify-center shrink-0 shadow-md">
              <span className="text-xs font-mono font-bold leading-none opacity-80">
                #{player.number}
              </span>
              <span className="font-display text-xl font-extrabold leading-tight">
                {player.position}
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                <h2
                  id="player-modal-title"
                  className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-white truncate"
                >
                  {player.name}
                </h2>
                <span className="text-xs text-zinc-400 font-mono tabular-nums">
                  {player.age} anos · {player.nationality} ·{' '}
                  {player.isStarter ? 'Titular' : 'Reserva'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] sm:text-xs text-zinc-400">
                <span>
                  Valor:{' '}
                  <strong className="text-white font-mono tabular-nums">
                    {formatCompactBRL(player.marketValue)}
                  </strong>
                </span>
                <span>·</span>
                <span>
                  Salário:{' '}
                  <strong className="text-white font-mono tabular-nums">
                    {formatCompactBRL(player.salary)}/mês
                  </strong>
                </span>
                <span>·</span>
                <span>
                  Condição:{' '}
                  <strong className={`font-mono tabular-nums ${condStyle.text}`}>
                    {Math.round(player.condition)}% ({condStyle.label})
                  </strong>
                </span>
                <span>·</span>
                <span>
                  Moral:{' '}
                  <strong className={getMoraleColor(player.morale)}>
                    {player.morale}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 ml-auto">
            <div className="text-right pr-3 border-r border-white/[0.08] whitespace-nowrap">
              <div className="text-[10px] sm:text-[11px] text-zinc-400 whitespace-nowrap">
                Nível Geral (1-20)
              </div>
              <div className="font-display text-2xl sm:text-3xl font-extrabold tabular-nums text-[#b5ff00]">
                {overall.toFixed(1)}
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Fechar perfil do jogador"
              className="p-2.5 rounded-full bg-white/[0.08] text-zinc-300 hover:text-white hover:bg-white/[0.14] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          {player.injured && player.injuryNote && (
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-200">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>
                <strong>Boletim Médico:</strong> {player.injuryNote} — Risco de
                agravamento se utilizado por 90 minutos.
              </span>
            </div>
          )}

          {/* Tactical Role & Duty Configuration Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-2xl bg-[#0b0c10] border border-white/[0.07]">
            <div>
              <label
                htmlFor="modal-role-select"
                className="block text-xs text-zinc-400 mb-1.5"
              >
                Função Tática (Role)
              </label>
              <select
                id="modal-role-select"
                value={player.assignedRole}
                onChange={(e) => {
                  const newRole = getRoleById(e.target.value);
                  const validDuty = newRole.allowedDuties.includes(
                    player.assignedDuty
                  )
                    ? player.assignedDuty
                    : newRole.allowedDuties[0];
                  onUpdateRoleDuty(player.id, newRole.id, validDuty);
                }}
                className="w-full bg-[#14171f] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#b5ff00]"
              >
                {TACTICAL_ROLES.map((r) => (
                  <option key={r.id} value={r.id}>
                    [{r.sector}] {r.name} ({r.shortCode})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="block text-xs text-zinc-400 mb-1.5">
                Tarefa Tática (Duty)
              </span>
              <div className="flex items-center gap-1 bg-[#14171f] p-1 rounded-full border border-white/[0.07]">
                {(['Defender', 'Apoiar', 'Atacar'] as TacticalDuty[]).map(
                  (duty) => {
                    const allowed = currentRole.allowedDuties.includes(duty);
                    const active = player.assignedDuty === duty;
                    return (
                      <button
                        key={duty}
                        disabled={!allowed}
                        onClick={() =>
                          onUpdateRoleDuty(player.id, currentRole.id, duty)
                        }
                        className={`flex-1 py-1.5 px-2.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${
                          active
                            ? 'bg-[#b5ff00] text-[#090a0f]'
                            : allowed
                            ? 'text-zinc-300 hover:text-white'
                            : 'text-zinc-600 cursor-not-allowed'
                        }`}
                      >
                        {duty}
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            <div className="flex flex-col justify-between bg-[#14171f] border border-white/[0.07] rounded-2xl px-3.5 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-zinc-400 whitespace-nowrap">
                  Adequação na Função
                </span>
                <span className="text-xs font-bold font-mono tabular-nums text-[#b5ff00] whitespace-nowrap">
                  {suitability.score}% (Média {suitability.avgAttribute})
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 line-clamp-2 mt-1">
                {currentRole.description}
              </p>
            </div>
          </div>

          {/* Legend for highlighted attributes */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
            <div className="flex items-center gap-4">
              <span className="text-white font-semibold">
                18 Atributos (Escala 1 a 20):
              </span>
              <span className="text-[#b5ff00] font-bold">
                ■ Lima = Exigência Chave para {currentRole.name}
              </span>
              <span className="text-white font-semibold">
                ■ Branco = Atributo Secundário
              </span>
            </div>
            <div className="font-mono tabular-nums text-zinc-400">
              Temporada: {player.seasonStats.matches}J ·{' '}
              {player.seasonStats.goals}G · {player.seasonStats.assists}A · Nota{' '}
              {player.seasonStats.avgRating.toFixed(2)}
            </div>
          </div>

          {/* 18 Attributes in 3 Columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {renderAttributeGroup('Atributos Técnicos', TECHNICAL_KEYS)}
            {renderAttributeGroup('Atributos Mentais', MENTAL_KEYS)}
            {renderAttributeGroup('Atributos Físicos', PHYSICAL_KEYS)}
          </div>
        </div>
      </div>
    </div>
  );
};
