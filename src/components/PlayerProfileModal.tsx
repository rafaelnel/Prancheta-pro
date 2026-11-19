import React from 'react';
import { X, AlertTriangle, Zap, AlertCircle, TrendingDown, Bookmark, BookmarkCheck } from 'lucide-react';
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
import { StarRating, resolvePlayerStars } from './StarRating';
import {
  evaluatePlayerRetirementProbability,
  getDynamicPotentialProfile,
} from '../engine/economyAndEvolution';
import { PlayerJersey, PlayerOvrBadge } from './PlayerJersey';

interface PlayerProfileModalProps {
  player: Player | null;
  readOnly?: boolean;
  currentYear?: number;
  onClose: () => void;
  onUpdateRoleDuty: (
    playerId: string,
    roleId: string,
    duty: TacticalDuty
  ) => void;
  onTogglePlayerMarketListing?: (
    playerId: string,
    mode: 'TRANSFER' | 'LOAN'
  ) => void;
  onToggleDoNotRenewContract?: (player: Player, doNotRenew: boolean) => void;
  isYouthAcademyPlayer?: boolean;
  onPromoteYouthPlayer?: (playerId: string) => void;
  onReleaseYouthPlayer?: (playerId: string) => void;
  isWatched?: boolean;
  onToggleWatch?: () => void;
}

export const PlayerProfileModal: React.FC<PlayerProfileModalProps> = ({
  player,
  readOnly = false,
  currentYear = 2026,
  onClose,
  onUpdateRoleDuty,
  onTogglePlayerMarketListing,
  onToggleDoNotRenewContract,
  isYouthAcademyPlayer = false,
  onPromoteYouthPlayer,
  onReleaseYouthPlayer,
  isWatched = false,
  onToggleWatch,
}) => {
  if (!player) return null;

  const contractRemaining =
    player.contractYearsRemaining ??
    (player.contractType === 'EMPRESTADO' ? player.loanDurationYears ?? 1 : 2);
  const contractEndYear =
    player.contractEndYear ?? currentYear + contractRemaining - 1;

  const currentRole = getRoleById(player.assignedRole);
  const suitability = calculateRoleSuitability(player, currentRole);
  const overall = calculatePlayerOverall(player.attributes, player.position);
  const condStyle = getConditionColor(player.condition);
  const retirementEval = evaluatePlayerRetirementProbability(player, overall);

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
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-2.5 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="player-modal-title"
    >
      <div className="bg-[#14171f] border border-white/10 rounded-[28px] max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Top Header */}
        <div className="flex flex-wrap sm:flex-nowrap items-start justify-between gap-3 sm:gap-4 p-4 sm:p-6 border-b border-white/[0.07] bg-[#0b0c10]/60">
          <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
            <PlayerJersey
              number={player.number}
              variant={player.isStarter ? 'lime' : 'white'}
              size="lg"
            />
            <PlayerOvrBadge
              ovr={overall}
              position={player.position}
              size="lg"
              tone="lime"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                <h2
                  id="player-modal-title"
                  className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-white truncate"
                >
                  {player.name}
                </h2>
                <span className="text-sm text-white font-mono font-bold tabular-nums">
                  {player.age} anos
                </span>
                <span className="text-xs text-zinc-400 font-mono">
                  · {player.nationality} · {player.isStarter ? 'Titular' : 'Reserva'}
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
                <span>·</span>
                <span>
                  {player.contractType === 'EMPRESTADO' ? 'Empréstimo:' : 'Contrato:'}{' '}
                  <strong
                    className={`font-mono tabular-nums ${
                      contractRemaining <= 1
                        ? 'text-amber-300'
                        : 'text-zinc-200'
                    }`}
                  >
                    {contractRemaining}{' '}
                    {contractRemaining === 1 ? 'ano' : 'anos'} (até fim de{' '}
                    {contractEndYear})
                  </strong>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 ml-auto">
            <div className="text-right pr-3 border-r border-white/[0.08] whitespace-nowrap">
              <div
                className="text-[10px] sm:text-[11px] text-zinc-400 whitespace-nowrap"
                title="Escala 60 a 95 (95 = fora de série histórico)"
              >
                OVR (60–95)
              </div>
              <div className="flex items-center justify-end gap-2">
                <div className="font-display text-2xl sm:text-3xl font-extrabold tabular-nums text-[#b5ff00] leading-none">
                  {overall}
                </div>
                <div className="flex flex-col items-end">
                  {player.exceededExpectations ? (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-400/25 text-amber-300 border border-amber-400/60 text-xs font-mono font-extrabold shadow-sm"
                      title="Superou o teto de potencial inicial devido a atuações estelares!"
                    >
                      ⚡ +{player.recentOvrDelta ?? 0} Superou Teto
                    </span>
                  ) : player.recentOvrDelta !== undefined && player.recentOvrDelta > 0 ? (
                    <span
                      className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-emerald-500/20 text-[#b5ff00] border border-[#b5ff00]/50 text-xs font-mono font-extrabold shadow-sm"
                      title="Evolução semestral de OVR"
                    >
                      ▲ +{player.recentOvrDelta}
                    </span>
                  ) : player.recentOvrDelta !== undefined && player.recentOvrDelta < 0 ? (
                    <span
                      className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/50 text-xs font-mono font-extrabold shadow-sm"
                      title={
                        player.developmentStatus === 'DECLINIO_TECNICO'
                          ? 'Declínio técnico por baixo rendimento'
                          : 'Regressão semestral de OVR'
                      }
                    >
                      ▼ {player.recentOvrDelta}
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center px-1.5 py-0.5 rounded bg-white/[0.05] text-zinc-400 border border-white/10 text-[10px] font-mono"
                      title={
                        player.developmentStatus === 'ESTAGNADO'
                          ? 'Potencial estagnado por falta de minutagem'
                          : 'OVR estável no semestre'
                      }
                    >
                      ▬ 0 Estável
                    </span>
                  )}
                  <span className="text-[9px] text-zinc-400 font-medium">Evolução 6m</span>
                </div>
              </div>
              <div className="mt-1 flex flex-col items-end">
                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-[10px] text-zinc-500 font-mono">POT</span>
                  <StarRating
                    stars={resolvePlayerStars(player, overall, 78)}
                    size="xs"
                    showNumeric
                  />
                </div>
                {player.age <= 23 && (
                  <span
                    className={`text-[9px] font-mono mt-0.5 ${
                      player.exceededExpectations ? 'text-amber-300 font-bold' : 'text-zinc-400'
                    }`}
                    title="Potencial Base e Teto Dinâmico por desempenho em campo"
                  >
                    Base {player.basePotentialOvr ?? getDynamicPotentialProfile(resolvePlayerStars(player, overall, 78)).basePotentialOvr} · Teto {player.dynamicCeilingOvr ?? getDynamicPotentialProfile(resolvePlayerStars(player, overall, 78)).dynamicCeilingOvr}
                    {player.exceededExpectations && ' (Rompeu Teto!)'}
                  </span>
                )}
              </div>
            </div>
            {onToggleWatch && (
              <button
                type="button"
                onClick={onToggleWatch}
                className={`px-3 py-2 rounded-full text-xs font-bold border transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                  isWatched
                    ? 'bg-[#b5ff00]/20 border-[#b5ff00] text-[#b5ff00]'
                    : 'bg-white/[0.06] border-white/10 text-zinc-200 hover:bg-white/[0.12] hover:text-white'
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
              onClick={onClose}
              aria-label="Fechar perfil do jogador"
              className="p-2.5 rounded-full bg-white/[0.08] text-zinc-300 hover:text-white hover:bg-white/[0.14] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          {/* Dynamic Development & Performance Callouts */}
          {player.exceededExpectations && (
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-amber-950/30 border border-amber-400/40 text-xs text-amber-200">
              <Zap className="w-4 h-4 text-amber-300 shrink-0" />
              <div>
                <strong className="text-amber-300">⚡ Superou Expectativas:</strong> Atuações excepcionais ({player.seasonStats.matches}j, nota {player.seasonStats.avgRating.toFixed(2)}{player.growthMultiplier ? `, mult. ${player.growthMultiplier.toFixed(2)}x` : ''}{player.seasonStats.goals > 0 ? `, ${player.seasonStats.goals}g` : ''}{player.seasonStats.assists > 0 ? `, ${player.seasonStats.assists}a` : ''}) romperam o teto de potencial inicial! O jogador subiu de categoria e ganhou evolução acima do teto.
              </div>
            </div>
          )}

          {player.developmentStatus === 'ESTAGNADO' && player.age <= 22 && player.seasonStats.matches < 7 && (
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-zinc-900/60 border border-white/10 text-xs text-zinc-300">
              <AlertCircle className="w-4 h-4 text-zinc-400 shrink-0" />
              <div>
                <strong className="text-white">Potencial Estagnado por Pouca Minutagem:</strong> O atleta disputou apenas {player.seasonStats.matches} jogos. Jovens com alto potencial não evoluem OVR automaticamente se ficarem sem minutagem no time principal ou empréstimo.
              </div>
            </div>
          )}

          {player.developmentStatus === 'DECLINIO_TECNICO' && (
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-rose-950/30 border border-rose-500/30 text-xs text-rose-200">
              <TrendingDown className="w-4 h-4 text-rose-400 shrink-0" />
              <div>
                <strong className="text-rose-300">Declínio Técnico por Desempenho Fraco:</strong> O atleta registrou nota média {player.seasonStats.avgRating.toFixed(2)} em {player.seasonStats.matches} jogos. O potencial não impede quedas de OVR caso as estatísticas sejam deficientes.
              </div>
            </div>
          )}

          {retirementEval.isConsideringRetirement && (
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-amber-950/35 border border-amber-400/45 text-xs text-amber-100">
              <AlertCircle className="w-4 h-4 text-amber-300 shrink-0" />
              <div>
                <strong className="text-amber-300">
                  ⏳ {retirementEval.statusLabel} ({retirementEval.annualProbabilityPct}% ao fim do ano):
                </strong>{' '}
                {retirementEval.factorNote}
              </div>
            </div>
          )}

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
                disabled={readOnly}
                onChange={(e) => {
                  const newRole = getRoleById(e.target.value);
                  const validDuty = newRole.allowedDuties.includes(
                    player.assignedDuty
                  )
                    ? player.assignedDuty
                    : newRole.allowedDuties[0];
                  onUpdateRoleDuty(player.id, newRole.id, validDuty);
                }}
                className="w-full bg-[#14171f] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#b5ff00] disabled:opacity-60"
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
                        disabled={readOnly || !allowed}
                        onClick={() =>
                          onUpdateRoleDuty(player.id, currentRole.id, duty)
                        }
                        className={`flex-1 py-1.5 px-2.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${
                          active
                            ? 'bg-[#b5ff00] text-[#090a0f]'
                            : allowed && !readOnly
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

          {isYouthAcademyPlayer && (onPromoteYouthPlayer || onReleaseYouthPlayer) && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#0b0c10] border border-[#b5ff00]/30">
              <div>
                <div className="text-xs font-bold text-white">
                  Decisão Técnica · Categorias de Base (Sub-17 / Sub-20)
                </div>
                <div className="text-[11px] text-zinc-400">
                  {player.age >= 16
                    ? 'Atleta apto (16+ anos) para subir ao elenco profissional ou ser dispensado da base sem custos.'
                    : `Atleta Sub-17 (${player.age} anos): aguarda completar 16 anos para subir ao profissional, ou pode ser dispensado.`}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {onPromoteYouthPlayer && (
                  <button
                    type="button"
                    disabled={player.age < 16}
                    onClick={() => {
                      onPromoteYouthPlayer(player.id);
                      onClose();
                    }}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold transition-colors ${
                      player.age >= 16
                        ? 'bg-[#b5ff00] hover:bg-[#c8ff33] text-[#090a0f]'
                        : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                    }`}
                  >
                    {player.age >= 16 ? 'Subir p/ Profissional' : 'Aguardar 16 anos'}
                  </button>
                )}
                {onReleaseYouthPlayer && (
                  <button
                    type="button"
                    onClick={() => {
                      onReleaseYouthPlayer(player.id);
                      onClose();
                    }}
                    className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/35 transition-colors"
                  >
                    Dispensar da Base
                  </button>
                )}
              </div>
            </div>
          )}

          {!readOnly &&
            !isYouthAcademyPlayer &&
            onTogglePlayerMarketListing &&
            player.contractType !== 'EMPRESTADO' && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#0b0c10] border border-white/[0.07]">
                <div>
                  <div className="text-xs font-bold text-white">
                    Disponibilidade no Mercado & Decisão Contratual
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    Colocar o atleta disponível aumenta a procura por clubes da IA ({player.position}). Contratos com até 2 anos podem ser marcados para não renovação.
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      onTogglePlayerMarketListing(player.id, 'TRANSFER')
                    }
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                      player.isTransferListed
                        ? 'bg-sky-400 text-[#090a0f] border-sky-400'
                        : 'bg-[#14171f] text-zinc-300 hover:text-white border-white/10'
                    }`}
                  >
                    {player.isTransferListed
                      ? '✓ Disponível p/ Venda'
                      : 'Disponibilizar p/ Venda'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onTogglePlayerMarketListing(player.id, 'LOAN')
                    }
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                      player.isLoanListed
                        ? 'bg-indigo-400 text-[#090a0f] border-indigo-400'
                        : 'bg-[#14171f] text-zinc-300 hover:text-white border-white/10'
                    }`}
                  >
                    {player.isLoanListed
                      ? '✓ Disponível p/ Empréstimo'
                      : 'Disponibilizar p/ Empréstimo'}
                  </button>
                  {onToggleDoNotRenewContract && contractRemaining <= 2 && (
                    <button
                      type="button"
                      onClick={() =>
                        onToggleDoNotRenewContract(
                          player,
                          player.contractRenewalStatus !== 'RECUSADO'
                        )
                      }
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                        player.contractRenewalStatus === 'RECUSADO'
                          ? 'bg-rose-500 text-white border-rose-400'
                          : 'bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 border-rose-500/35'
                      }`}
                    >
                      {player.contractRenewalStatus === 'RECUSADO'
                        ? '✕ Marcado: Não Renovar'
                        : 'Não Renovar Contrato'}
                    </button>
                  )}
                </div>
              </div>
            )}

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
