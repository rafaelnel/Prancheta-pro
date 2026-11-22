import React, { useEffect, useState } from 'react';
import {
  FastForward,
  Pause,
  Play,
  CheckCircle2,
  Trophy,
  Calendar,
  X,
  Wallet,
  Handshake,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { AutoSimMatchLogEntry } from '../engine/autoTacticsAndSim';
import { IncomingOfferAction } from '../engine/aiMarketEngine';
import { Club, IncomingTransferOffer, Player } from '../types/football';
import { formatCalendarDate, formatCompactBRL } from '../utils/formatters';
import { ClubBadge } from './ClubBadge';
import { IncomingOfferCard } from './IncomingOfferCard';

interface AutoSimModalProps {
  isOpen: boolean;
  isRunning: boolean;
  isPaused?: boolean;
  isDone: boolean;
  wasStoppedEarly: boolean;
  targetLabel: string;
  seasonYear?: number;
  startDayOffset: number;
  currentDayOffset: number;
  targetDayOffset: number;
  plannedUserMatches: number;
  logs: AutoSimMatchLogEntry[];
  userClub: Club;
  squad: Player[];
  clubs: Club[];
  userRank: number;
  pausedOffer?: IncomingTransferOffer | null;
  offerResolutionNote?: string | null;
  onResolveOffer?: (offerId: string, action: IncomingOfferAction) => void;
  onInspectPlayer?: (player: Player) => void;
  onPause?: () => void;
  onResume?: () => void;
  onPauseOrStop: () => void;
  onFinishInstant: () => void;
  onClose: () => void;
  onOpenCompetitions: () => void;
}

export const AutoSimModal: React.FC<AutoSimModalProps> = ({
  isOpen,
  isRunning,
  isPaused = false,
  isDone,
  wasStoppedEarly,
  targetLabel,
  seasonYear = 2026,
  startDayOffset,
  currentDayOffset,
  targetDayOffset,
  plannedUserMatches,
  logs,
  userClub,
  squad,
  clubs,
  userRank,
  pausedOffer = null,
  offerResolutionNote = null,
  onResolveOffer,
  onInspectPlayer,
  onPause,
  onResume,
  onPauseOrStop,
  onFinishInstant,
  onClose,
  onOpenCompetitions,
}) => {
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);

  // Automatically close the proposal modal whenever the offer is resolved or cleared
  useEffect(() => {
    if (!pausedOffer) {
      setIsOfferModalOpen(false);
    }
  }, [pausedOffer?.id, pausedOffer]);

  if (!isOpen) return null;

  const handleResolveFromModal = (
    offerId: string,
    action: IncomingOfferAction
  ) => {
    setIsOfferModalOpen(false);
    onResolveOffer?.(offerId, action);
  };

  // Dedicated full-focus modal showing ONLY the incoming proposal; returns to simulation when finished
  if (isOfferModalOpen && pausedOffer && onResolveOffer) {
    return (
      <div
        data-testid="autosim-offer-detail-modal"
        className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"
        role="dialog"
        aria-modal="true"
        aria-label="Detalhes da Proposta de Mercado"
      >
        <div className="w-full max-w-2xl bg-[#111319] border border-amber-400/40 rounded-[24px] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
          <div className="shrink-0 px-4 sm:px-5 py-3.5 border-b border-white/[0.08] bg-[#0b0c10] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Handshake className="w-4 h-4 text-amber-300 shrink-0" />
              <div className="min-w-0">
                <h3 className="font-display text-base sm:text-lg font-extrabold uppercase tracking-tight text-white truncate leading-tight">
                  Proposta de Mercado
                </h3>
                <p className="text-[11px] font-mono text-amber-200/85 truncate">
                  Ao decidir, a simulação volta automaticamente
                </p>
              </div>
            </div>

            <button
              type="button"
              data-testid="autosim-back-to-sim-btn"
              onClick={() => setIsOfferModalOpen(false)}
              className="px-3 py-1.5 rounded-full bg-[#14171f] hover:bg-white/10 border border-white/15 text-xs font-bold text-zinc-200 flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            <IncomingOfferCard
              offer={pausedOffer}
              userClub={userClub}
              squad={squad}
              seasonYear={seasonYear}
              variant="default"
              onResolve={handleResolveFromModal}
              onInspectPlayer={onInspectPlayer}
            />
          </div>
        </div>
      </div>
    );
  }

  const clubMap = new Map(clubs.map((c) => [c.id, c]));
  const userMatchLogs = logs.filter((l) => l.outcome !== 'BYE');
  const wins = userMatchLogs.filter((l) => l.outcome === 'V').length;
  const draws = userMatchLogs.filter((l) => l.outcome === 'E').length;
  const losses = userMatchLogs.filter((l) => l.outcome === 'D').length;

  const totalSpan = Math.max(1, targetDayOffset - startDayOffset);
  const progressPct = isDone
    ? 100
    : Math.min(
        99,
        Math.max(
          0,
          Math.round(((currentDayOffset - startDayOffset) / totalSpan) * 100)
        )
      );

  const latestUserMatch =
    [...userMatchLogs].reverse()[0] || [...logs].reverse()[0] || null;
  const reversedLogs = [...logs].reverse();

  const liveOfferPlayer = pausedOffer
    ? squad.find((p) => p.id === pausedOffer.playerId) || null
    : null;
  const offerMarketValue =
    liveOfferPlayer?.marketValue ?? pausedOffer?.playerMarketValue ?? 0;
  const offerDiffPct =
    pausedOffer && pausedOffer.dealType === 'BUY' && offerMarketValue > 0
      ? Math.round(
          ((pausedOffer.offeredFee - offerMarketValue) / offerMarketValue) * 100
        )
      : null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Simulação Automática de Calendário"
    >
      <div className="w-full max-w-3xl bg-[#111319] border border-white/15 rounded-[24px] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Compact Header */}
        <div className="shrink-0 px-4 sm:px-5 py-3 border-b border-white/[0.08] bg-[#0b0c10] flex items-center justify-between gap-2.5">
          <div className="min-w-0 flex items-center flex-wrap gap-x-2.5 gap-y-1">
            {pausedOffer ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400 text-[#090a0f] text-[10px] font-mono font-extrabold uppercase">
                <Pause className="w-3 h-3" />
                Nova Proposta
              </span>
            ) : isRunning ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#b5ff00] text-[#090a0f] text-[10px] font-mono font-extrabold uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-[#090a0f] animate-ping" />
                Simulando
              </span>
            ) : isPaused && !wasStoppedEarly && !isDone ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400 text-[#090a0f] text-[10px] font-mono font-extrabold uppercase">
                <Pause className="w-3 h-3" />
                Pausada
              </span>
            ) : wasStoppedEarly ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-mono font-extrabold uppercase">
                Interrompida
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#b5ff00]/20 text-[#b5ff00] border border-[#b5ff00]/30 text-[10px] font-mono font-extrabold uppercase">
                <CheckCircle2 className="w-3 h-3" />
                Concluído
              </span>
            )}

            <h3 className="font-display text-base sm:text-lg font-extrabold uppercase tracking-tight text-white truncate leading-none">
              {formatCalendarDate(currentDayOffset, seasonYear)}
            </h3>
            <span className="text-[11px] font-mono text-zinc-400 truncate">
              · {targetLabel}
            </span>
          </div>

          {!isRunning && !pausedOffer && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar resumo da simulação"
              className="w-7 h-7 rounded-full bg-[#14171f] hover:bg-white/10 border border-white/10 flex items-center justify-center text-zinc-300 shrink-0 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Slim Progress & Single-Row Summary Bar */}
        <div className="shrink-0 px-4 sm:px-5 py-2.5 bg-[#14171f] border-b border-white/[0.07] space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full bg-[#0b0c10] overflow-hidden border border-white/[0.06]">
              <div
                className="h-full bg-[#b5ff00] transition-all duration-200"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-[11px] font-mono text-zinc-300 tabular-nums shrink-0">
              {userMatchLogs.length}
              {plannedUserMatches > 0 ? `/${plannedUserMatches}` : ''} J ·{' '}
              <strong className="text-[#b5ff00]">{progressPct}%</strong>
            </span>
          </div>

          <div className="bg-[#0b0c10] border border-white/[0.06] rounded-xl px-3 py-1.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs font-mono tabular-nums">
            <div className="flex items-center gap-2">
              <span className="text-[#b5ff00] font-extrabold">{wins}V</span>
              <span className="text-zinc-600">·</span>
              <span className="text-zinc-200 font-bold">{draws}E</span>
              <span className="text-zinc-600">·</span>
              <span className="text-rose-400 font-extrabold">{losses}D</span>
            </div>

            <div className="flex items-center gap-3.5">
              <span className="inline-flex items-center gap-1 text-white font-bold">
                <Trophy className="w-3.5 h-3.5 text-[#b5ff00]" />
                {userRank}º
              </span>
              <span
                className={`inline-flex items-center gap-1 font-bold ${
                  userClub.cashBalance < 0 ? 'text-rose-400' : 'text-[#b5ff00]'
                }`}
              >
                <Wallet className="w-3.5 h-3.5" />
                {formatCompactBRL(userClub.cashBalance)}
              </span>
            </div>
          </div>
        </div>

        {/* Compact Incoming Proposal Trigger Banner — strictly OUTSIDE match history scroll */}
        {pausedOffer && onResolveOffer && (
          <div
            data-testid="autosim-paused-offer"
            className="shrink-0 px-4 sm:px-5 py-3 bg-[#171923] border-b-2 border-amber-400/55"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <ClubBadge
                  clubId={pausedOffer.fromClubId}
                  abbr={pausedOffer.fromClubAbbr}
                  name={pausedOffer.fromClubName}
                  primaryColor={pausedOffer.fromClubPrimaryColor}
                  size="sm"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-mono font-extrabold uppercase text-amber-300">
                      {pausedOffer.dealType === 'LOAN'
                        ? 'Proposta de Empréstimo'
                        : 'Proposta de Compra'}
                    </span>
                    <span className="text-zinc-600">·</span>
                    <span className="text-[11px] font-semibold text-zinc-200 truncate">
                      {pausedOffer.fromClubName}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 flex-wrap mt-0.5">
                    <span className="font-display text-sm sm:text-base font-extrabold uppercase text-white truncate">
                      {pausedOffer.playerName}
                    </span>
                    <span className="text-[11px] font-mono text-zinc-400">
                      {pausedOffer.playerPosition} · OVR {pausedOffer.playerOvr}
                    </span>
                    <span className="font-mono text-sm font-extrabold text-[#b5ff00] tabular-nums">
                      {formatCompactBRL(pausedOffer.offeredFee)}
                    </span>
                    {offerDiffPct !== null && (
                      <span
                        className={`text-[10px] font-mono font-bold tabular-nums ${
                          offerDiffPct >= 0 ? 'text-emerald-300' : 'text-amber-300'
                        }`}
                      >
                        ({offerDiffPct >= 0 ? `+${offerDiffPct}%` : `${offerDiffPct}%`})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  data-testid="autosim-reject-offer-btn"
                  onClick={() => onResolveOffer(pausedOffer.id, 'REJECT')}
                  className="px-3.5 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/45 text-rose-200 text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Negar</span>
                </button>
                <button
                  type="button"
                  data-testid="autosim-open-offer-modal-btn"
                  onClick={() => setIsOfferModalOpen(true)}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-[#b5ff00] hover:bg-[#c8ff33] text-[#090a0f] text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors shadow cursor-pointer"
                >
                  <Handshake className="w-3.5 h-3.5" />
                  <span>Ver Proposta</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {offerResolutionNote && !pausedOffer && (
          <div className="shrink-0 px-4 sm:px-5 py-2 bg-[#101610] border-b border-[#b5ff00]/30 text-xs text-zinc-200 flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#b5ff00] shrink-0" />
            <span className="truncate">{offerResolutionNote}</span>
          </div>
        )}

        {/* Latest Match Spotlight + Match-by-Match Chronological Log (Independent Scroll) */}
        <div
          data-testid="autosim-match-history-scroll"
          className="flex-1 min-h-[160px] overflow-y-auto p-4 sm:p-5 space-y-3"
        >
          {latestUserMatch && latestUserMatch.outcome !== 'BYE' && (
            <div className="bg-[#0b0c10] border border-[#b5ff00]/30 rounded-2xl px-3.5 py-3 space-y-2">
              <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
                <span className="text-[#b5ff00] font-bold uppercase truncate">
                  Último · {latestUserMatch.competitionLabel}
                </span>
                <span className="text-zinc-400 shrink-0">
                  {latestUserMatch.dateLabel}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  {clubMap.get(latestUserMatch.homeClubId) && (
                    <ClubBadge
                      clubId={latestUserMatch.homeClubId}
                      abbr={clubMap.get(latestUserMatch.homeClubId)!.abbr}
                      name={clubMap.get(latestUserMatch.homeClubId)!.name}
                      primaryColor={
                        clubMap.get(latestUserMatch.homeClubId)!.primaryColor
                      }
                      size="xs"
                    />
                  )}
                  <span className="font-display text-sm sm:text-base font-extrabold uppercase text-white truncate">
                    {latestUserMatch.homeClubName}
                  </span>
                </div>

                <div className="px-3 py-1 rounded-lg bg-[#14171f] border border-white/10 text-center shrink-0">
                  <div className="font-mono text-base sm:text-lg font-extrabold text-white tabular-nums leading-none">
                    {latestUserMatch.homeGoals} × {latestUserMatch.awayGoals}
                  </div>
                  {latestUserMatch.homePenalties !== null &&
                    latestUserMatch.homePenalties !== undefined &&
                    latestUserMatch.awayPenalties !== null &&
                    latestUserMatch.awayPenalties !== undefined && (
                      <div className="text-[9px] font-mono text-[#b5ff00] mt-0.5">
                        Pên. {latestUserMatch.homePenalties}:
                        {latestUserMatch.awayPenalties}
                      </div>
                    )}
                </div>

                <div className="flex items-center justify-end gap-1.5 min-w-0 flex-1">
                  <span className="font-display text-sm sm:text-base font-extrabold uppercase text-white truncate text-right">
                    {latestUserMatch.awayClubName}
                  </span>
                  {clubMap.get(latestUserMatch.awayClubId) && (
                    <ClubBadge
                      clubId={latestUserMatch.awayClubId}
                      abbr={clubMap.get(latestUserMatch.awayClubId)!.abbr}
                      name={clubMap.get(latestUserMatch.awayClubId)!.name}
                      primaryColor={
                        clubMap.get(latestUserMatch.awayClubId)!.primaryColor
                      }
                      size="xs"
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <span className="font-bold uppercase tracking-wider">
                Jogos Simulados
              </span>
              <span className="font-mono tabular-nums">
                {logs.length} etapa(s)
              </span>
            </div>

            {reversedLogs.length === 0 ? (
              <div className="py-7 text-center text-xs text-zinc-400 bg-[#0b0c10] rounded-2xl border border-white/[0.06]">
                {isRunning
                  ? 'Preparando a próxima partida...'
                  : 'Nenhuma partida agendada neste intervalo.'}
              </div>
            ) : (
              <div className="space-y-1.5">
                {reversedLogs.map((entry) => (
                  <div
                    key={entry.id}
                    className="bg-[#0b0c10] border border-white/[0.07] rounded-xl px-3 py-2 flex items-center justify-between gap-2.5"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-400">
                        <span className="font-mono">{entry.dateLabel}</span>
                        <span className="text-zinc-600">·</span>
                        <span className="font-semibold text-zinc-300 truncate">
                          {entry.competitionLabel}
                        </span>
                      </div>

                      {entry.outcome === 'BYE' ? (
                        <div className="text-xs text-zinc-400 truncate">
                          {entry.tacticalSummary}
                        </div>
                      ) : (
                        <>
                          <div className="font-display text-sm font-extrabold uppercase text-white truncate">
                            {entry.homeClubName}{' '}
                            <span className="font-mono text-[#b5ff00] mx-1">
                              {entry.homeGoals} × {entry.awayGoals}
                            </span>{' '}
                            {entry.awayClubName}
                            {entry.homePenalties !== null &&
                              entry.homePenalties !== undefined &&
                              entry.awayPenalties !== null &&
                              entry.awayPenalties !== undefined && (
                                <span className="ml-1.5 text-[11px] font-mono text-amber-300 font-normal">
                                  (Pên. {entry.homePenalties}:
                                  {entry.awayPenalties})
                                </span>
                              )}
                          </div>
                          {entry.goalScorers.length > 0 && (
                            <div className="text-[10px] text-zinc-500 truncate">
                              Gols: {entry.goalScorers.join(', ')}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <div className="shrink-0 flex items-center justify-end">
                      {entry.outcome === 'BYE' ? (
                        <span className="px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/10 text-[10px] font-mono text-zinc-400">
                          Folga
                        </span>
                      ) : (
                        <span
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-extrabold ${
                            entry.outcome === 'V'
                              ? 'bg-[#b5ff00] text-[#090a0f]'
                              : entry.outcome === 'E'
                              ? 'bg-zinc-600 text-white'
                              : 'bg-rose-500/85 text-white'
                          }`}
                        >
                          {entry.outcome}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Compact Footer Controls */}
        <div className="shrink-0 px-4 sm:px-5 py-3 border-t border-white/[0.08] bg-[#0b0c10] flex flex-wrap items-center justify-between gap-2">
          {pausedOffer ? (
            <>
              <button
                type="button"
                onClick={onPauseOrStop}
                className="px-3.5 py-2 rounded-full bg-[#14171f] hover:bg-white/10 border border-white/15 text-xs font-bold text-zinc-300 transition-colors cursor-pointer"
              >
                Encerrar Aqui
              </button>
              <div className="flex items-center gap-2">
                {onResolveOffer && (
                  <button
                    type="button"
                    onClick={() => onResolveOffer(pausedOffer.id, 'REJECT')}
                    className="px-3.5 py-2 rounded-full bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/45 text-xs font-bold text-rose-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Negar</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOfferModalOpen(true)}
                  className="px-4 py-2 rounded-full bg-[#b5ff00] hover:bg-[#c8ff33] text-[#090a0f] text-xs font-extrabold flex items-center gap-1.5 transition-colors shadow cursor-pointer"
                >
                  <Handshake className="w-3.5 h-3.5" />
                  <span>Ver Proposta</span>
                </button>
              </div>
            </>
          ) : isRunning ? (
            <>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="autosim-pause-btn"
                  onClick={onPause || onPauseOrStop}
                  className="px-3.5 py-2 rounded-full bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/40 text-xs font-bold text-amber-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Pause className="w-3.5 h-3.5 text-amber-300" />
                  <span>Pausar</span>
                </button>
                <button
                  type="button"
                  data-testid="autosim-stop-btn"
                  onClick={onPauseOrStop}
                  className="px-3.5 py-2 rounded-full bg-[#14171f] hover:bg-white/10 border border-white/15 text-xs font-bold text-zinc-300 transition-colors cursor-pointer"
                >
                  Encerrar
                </button>
              </div>
              <button
                type="button"
                onClick={onFinishInstant}
                className="px-4 py-2 rounded-full bg-[#b5ff00] hover:bg-[#c8ff33] text-[#090a0f] text-xs font-extrabold flex items-center gap-1.5 transition-colors shadow cursor-pointer"
              >
                <FastForward className="w-3.5 h-3.5" />
                <span>Instantâneo</span>
              </button>
            </>
          ) : isPaused && !isDone && !wasStoppedEarly ? (
            <>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="autosim-stop-btn"
                  onClick={onPauseOrStop}
                  className="px-3.5 py-2 rounded-full bg-[#14171f] hover:bg-white/10 border border-white/15 text-xs font-bold text-zinc-300 transition-colors cursor-pointer"
                >
                  Encerrar
                </button>
                <button
                  type="button"
                  onClick={onFinishInstant}
                  className="px-3.5 py-2 rounded-full bg-[#14171f] hover:bg-white/10 border border-white/15 text-xs font-bold text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FastForward className="w-3.5 h-3.5 text-[#b5ff00]" />
                  <span>Instantâneo</span>
                </button>
              </div>
              <button
                type="button"
                data-testid="autosim-resume-btn"
                onClick={onResume}
                className="px-4 py-2 rounded-full bg-[#b5ff00] hover:bg-[#c8ff33] text-[#090a0f] text-xs font-extrabold flex items-center gap-1.5 transition-colors shadow cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Retomar</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-full bg-[#14171f] hover:bg-white/10 border border-white/15 text-xs font-bold text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5 text-[#b5ff00]" />
                <span>Calendário</span>
              </button>
              <button
                type="button"
                onClick={onOpenCompetitions}
                className="px-4 py-2 rounded-full bg-[#b5ff00] hover:bg-[#c8ff33] text-[#090a0f] text-xs font-extrabold flex items-center gap-1.5 transition-colors shadow cursor-pointer"
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>Classificação & Copas</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
