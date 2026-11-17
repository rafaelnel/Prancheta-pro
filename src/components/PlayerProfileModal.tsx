import React from 'react';
import { X, Shield, Activity, Award, TrendingUp, AlertTriangle } from 'lucide-react';
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
    <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3.5">
      <h4 className="text-xs font-semibold text-slate-400 tracking-wide mb-2.5 pb-1.5 border-b border-slate-800/80">
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
              className={`flex items-center justify-between px-2 py-1 rounded text-xs transition-colors ${
                isKey
                  ? 'bg-emerald-950/60 border border-emerald-500/40'
                  : isSecondary
                  ? 'bg-amber-950/40 border border-amber-500/30'
                  : 'border border-transparent'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={
                    isKey
                      ? 'text-emerald-300 font-medium'
                      : isSecondary
                      ? 'text-amber-200 font-medium'
                      : 'text-slate-300'
                  }
                >
                  {ATTRIBUTE_LABELS[key]}
                </span>
                {isKey && (
                  <span className="text-[10px] text-emerald-400 font-mono">
                    · Chave
                  </span>
                )}
                {isSecondary && (
                  <span className="text-[10px] text-amber-400 font-mono">
                    · Apoio
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      val >= 16
                        ? 'bg-emerald-500'
                        : val >= 13
                        ? 'bg-emerald-400/75'
                        : val >= 10
                        ? 'bg-amber-400'
                        : 'bg-slate-500'
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-2.5 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="player-modal-title"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Top Header */}
        <div className="flex flex-wrap sm:flex-nowrap items-start justify-between gap-3 sm:gap-4 p-3.5 sm:p-5 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-emerald-950 border border-emerald-500/40 flex flex-col items-center justify-center shrink-0">
              <span className="text-xs text-emerald-400 font-mono leading-none">
                #{player.number}
              </span>
              <span className="text-base sm:text-lg font-bold font-mono text-emerald-300 leading-tight mt-0.5">
                {player.position}
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                <h2
                  id="player-modal-title"
                  className="text-base sm:text-xl font-bold text-slate-100 truncate"
                >
                  {player.name}
                </h2>
                <span className="text-xs text-slate-400 font-mono tabular-nums">
                  {player.age} anos · {player.nationality} ·{' '}
                  {player.isStarter ? 'Titular' : 'Reserva'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] sm:text-xs text-slate-400">
                <span>
                  Valor:{' '}
                  <strong className="text-slate-200 font-mono tabular-nums">
                    {formatCompactBRL(player.marketValue)}
                  </strong>
                </span>
                <span>·</span>
                <span>
                  Salário:{' '}
                  <strong className="text-slate-200 font-mono tabular-nums">
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

          <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-auto">
            <div className="text-right pr-2.5 sm:pr-3 border-r border-slate-800 whitespace-nowrap">
              <div className="text-[10px] sm:text-[11px] text-slate-400 whitespace-nowrap">
                Nível Geral (1-20)
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-emerald-400">
                {overall.toFixed(1)}
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Fechar perfil do jogador"
              className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {player.injured && player.injuryNote && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-xs text-rose-200">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>
                <strong>Boletim Médico:</strong> {player.injuryNote} — Risco de agravamento se utilizado por 90 minutos.
              </span>
            </div>
          )}

          {/* Tactical Role & Duty Configuration Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-lg bg-slate-950/60 border border-slate-800">
            <div>
              <label
                htmlFor="modal-role-select"
                className="block text-xs text-slate-400 mb-1"
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
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                {TACTICAL_ROLES.map((r) => (
                  <option key={r.id} value={r.id}>
                    [{r.sector}] {r.name} ({r.shortCode})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="block text-xs text-slate-400 mb-1">
                Tarefa Tática (Duty)
              </span>
              <div className="flex items-center gap-1.5">
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
                        className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                          active
                            ? 'bg-emerald-600 text-white'
                            : allowed
                            ? 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
                            : 'bg-slate-950 text-slate-600 border border-slate-900 cursor-not-allowed'
                        }`}
                      >
                        {duty}
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            <div className="flex flex-col justify-between bg-slate-900/90 border border-slate-800 rounded-lg px-3.5 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-400 whitespace-nowrap">
                  Adequação na Função
                </span>
                <span className="text-xs font-bold font-mono tabular-nums text-emerald-400 whitespace-nowrap">
                  {suitability.score}% (Média {suitability.avgAttribute})
                </span>
              </div>
              <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">
                {currentRole.description}
              </p>
            </div>
          </div>

          {/* Legend for highlighted attributes */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <div className="flex items-center gap-4">
              <span className="text-slate-300 font-medium">
                18 Atributos (Escala 1 a 20):
              </span>
              <span className="text-emerald-400">
                ■ Verde = Exigência Chave para {currentRole.name}
              </span>
              <span className="text-amber-300">
                ■ Âmbar = Atributo Secundário para {currentRole.name}
              </span>
            </div>
            <div className="font-mono tabular-nums text-slate-400">
              Temporada: {player.seasonStats.matches}J · {player.seasonStats.goals}G ·{' '}
              {player.seasonStats.assists}A · Nota {player.seasonStats.avgRating.toFixed(2)}
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
