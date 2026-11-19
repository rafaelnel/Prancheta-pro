import React from 'react';
import {
  FastForward,
  Pause,
  Play,
  CheckCircle2,
  Trophy,
  Sliders,
  Calendar,
  X,
  Wallet,
  Handshake,
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
  if (!isOpen) return null;

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
        Math.max(0, Math.round(((currentDayOffset - startDayOffset) / totalSpan) * 100))
      );

  const latestUserMatch =
    [...userMatchLogs].reverse()[0] || [...logs].reverse()[0] || null;
  const reversedLogs = [...logs].reverse();

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Simulação Automática de Calendário"
    >
      <div className="w-full max-w-4xl bg-[#111319] border border-white/15 rounded-[26px] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="shrink-0 px-5 py-3.5 border-b border-white/[0.08] bg-[#0b0c10] flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              {pausedOffer ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400 text-[#090a0f] text-[10px] font-mono font-extrabold uppercase">
                  <Pause className="w-3 h-3" />
                  Simulação Pausada · Proposta de Mercado
                </span>
              ) : isRunning ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#b5ff00] text-[#090a0f] text-[10px] font-mono font-extrabold uppercase">
                  <span className="w-2 h-2 rounded-full bg-[#090a0f] animate-ping" />
                  Simulando Partida a Partida
                </span>
              ) : isPaused && !wasStoppedEarly && !isDone ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400 text-[#090a0f] text-[10px] font-mono font-extrabold uppercase">
                  <Pause className="w-3 h-3" />
                  Simulação Pausada
                </span>
              ) : wasStoppedEarly ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-mono font-extrabold uppercase">
                  Simulação Interrompida
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#b5ff00]/20 text-[#b5ff00] border border-[#b5ff00]/30 text-[10px] font-mono font-extrabold uppercase">
                  <CheckCircle2 className="w-3 h-3" />
                  Período Concluído
                </span>
              )}
              <span className="text-[11px] font-mono text-zinc-400">
                Meta: {targetLabel}
              </span>
            </div>

            <h3 className="font-display text-xl sm:text-2xl font-extrabold uppercase tracking-tight text-white truncate">
              Comissão Técnica IA · {formatCalendarDate(currentDayOffset, seasonYear)}
            </h3>
            <p className="text-xs text-zinc-400 font-mono mt-0.5">
              De {formatCalendarDate(startDayOffset, seasonYear)} até{' '}
              {formatCalendarDate(targetDayOffset, seasonYear)} · Formações e
              táticas otimizadas por adversário
            </p>
          </div>

          {!isRunning && !pausedOffer && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar resumo da simulação"
              className="w-8 h-8 rounded-full bg-[#14171f] hover:bg-white/10 border border-white/10 flex items-center justify-center text-zinc-300 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Progress Bar & Summary Strip */}
        <div className="shrink-0 px-5 py-3 bg-[#14171f] border-b border-white/[0.07] space-y-2.5">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-zinc-400">
                Progresso do período ({userMatchLogs.length}
                {plannedUserMatches > 0 ? `/${plannedUserMatches}` : ''} jogos do clube)
              </span>
              <span className="text-[#b5ff00] font-bold tabular-nums">
                {progressPct}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-[#0b0c10] overflow-hidden border border-white/[0.06]">
              <div
                className="h-full bg-[#b5ff00] transition-all duration-200"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            <div className="bg-[#0b0c10] border border-white/[0.06] rounded-xl px-2.5 py-2 text-center">
              <div className="text-[10px] text-zinc-500 uppercase">Jogos</div>
              <div className="font-mono text-sm font-extrabold text-white tabular-nums">
                {userMatchLogs.length}
              </div>
            </div>
            <div className="bg-[#0b0c10] border border-white/[0.06] rounded-xl px-2.5 py-2 text-center">
              <div className="text-[10px] text-zinc-500 uppercase">Vitórias</div>
              <div className="font-mono text-sm font-extrabold text-[#b5ff00] tabular-nums">
                {wins}
              </div>
            </div>
            <div className="bg-[#0b0c10] border border-white/[0.06] rounded-xl px-2.5 py-2 text-center">
              <div className="text-[10px] text-zinc-500 uppercase">Empates</div>
              <div className="font-mono text-sm font-extrabold text-zinc-200 tabular-nums">
                {draws}
              </div>
            </div>
            <div className="bg-[#0b0c10] border border-white/[0.06] rounded-xl px-2.5 py-2 text-center">
              <div className="text-[10px] text-zinc-500 uppercase">Derrotas</div>
              <div className="font-mono text-sm font-extrabold text-rose-400 tabular-nums">
                {losses}
              </div>
            </div>
            <div className="bg-[#0b0c10] border border-white/[0.06] rounded-xl px-2.5 py-2 text-center">
              <div className="text-[10px] text-zinc-500 uppercase flex items-center justify-center gap-1">
                <Trophy className="w-3 h-3 text-[#b5ff00]" />
                <span>Tabela</span>
              </div>
              <div className="font-mono text-sm font-extrabold text-white tabular-nums">
                {userRank}º
              </div>
            </div>
            <div className="bg-[#0b0c10] border border-white/[0.06] rounded-xl px-2.5 py-2 text-center">
              <div className="text-[10px] text-zinc-500 uppercase flex items-center justify-center gap-1">
                <Wallet className="w-3 h-3 text-[#b5ff00]" />
                <span>Caixa</span>
              </div>
              <div className="font-mono text-xs font-extrabold text-[#b5ff00] tabular-nums truncate">
                {formatCompactBRL(userClub.cashBalance)}
              </div>
            </div>
          </div>
        </div>

        {/* Pinned Incoming Proposal Area — strictly OUTSIDE the match history scroll */}
        {pausedOffer && onResolveOffer && (
          <div
            data-testid="autosim-paused-offer"
            className="shrink-0 px-4 sm:px-5 py-3.5 bg-[#151822] border-b-2 border-amber-400/55 space-y-2.5 max-h-[54vh] overflow-y-auto"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Handshake className="w-4 h-4 text-amber-300" />
                <span className="font-display text-sm sm:text-base font-extrabold uppercase tracking-tight text-amber-300">
                  Proposta Recebida Durante a Simulação
                </span>
              </div>
              <span className="text-[11px] font-mono text-amber-200/90">
                Decida para retomar automaticamente
              </span>
            </div>

            <IncomingOfferCard
              offer={pausedOffer}
              userClub={userClub}
              squad={squad}
              seasonYear={seasonYear}
              variant="autosim"
              onResolve={onResolveOffer}
              onInspectPlayer={onInspectPlayer}
            />
          </div>
        )}

        {offerResolutionNote && !pausedOffer && (
          <div className="shrink-0 px-4 sm:px-5 py-2.5 bg-[#101610] border-b border-[#b5ff00]/30 text-xs text-zinc-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#b5ff00] shrink-0" />
            <span>{offerResolutionNote}</span>
          </div>
        )}

        {/* Latest Match Spotlight + Match-by-Match Chronological Log (Independent Scroll) */}
        <div
          data-testid="autosim-match-history-scroll"
          className="flex-1 min-h-[140px] overflow-y-auto p-4 sm:p-5 space-y-4"
        >

          {latestUserMatch && latestUserMatch.outcome !== 'BYE' && (
            <div className="bg-[#0b0c10] border border-[#b5ff00]/30 rounded-2xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                <span className="text-[#b5ff00] font-bold uppercase">
                  Último Jogo · {latestUserMatch.competitionLabel}
                </span>
                <span className="text-zinc-400">{latestUserMatch.dateLabel}</span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {clubMap.get(latestUserMatch.homeClubId) && (
                    <ClubBadge
                      clubId={latestUserMatch.homeClubId}
                      abbr={clubMap.get(latestUserMatch.homeClubId)!.abbr}
                      name={clubMap.get(latestUserMatch.homeClubId)!.name}
                      primaryColor={clubMap.get(latestUserMatch.homeClubId)!.primaryColor}
                      size="sm"
                    />
                  )}
                  <span className="font-display text-base sm:text-lg font-extrabold uppercase text-white truncate">
                    {latestUserMatch.homeClubName}
                  </span>
                </div>

                <div className="px-3.5 py-1.5 rounded-xl bg-[#14171f] border border-white/10 text-center shrink-0">
                  <div className="font-mono text-lg sm:text-xl font-extrabold text-white tabular-nums leading-none">
                    {latestUserMatch.homeGoals} × {latestUserMatch.awayGoals}
                  </div>
                  {latestUserMatch.homePenalties !== null &&
                    latestUserMatch.homePenalties !== undefined &&
                    latestUserMatch.awayPenalties !== null &&
                    latestUserMatch.awayPenalties !== undefined && (
                      <div className="text-[10px] font-mono text-[#b5ff00] mt-0.5">
                        Pên. {latestUserMatch.homePenalties}:{latestUserMatch.awayPenalties}
                      </div>
                    )}
                </div>

                <div className="flex items-center justify-end gap-2 min-w-0 flex-1">
                  <span className="font-display text-base sm:text-lg font-extrabold uppercase text-white truncate text-right">
                    {latestUserMatch.awayClubName}
                  </span>
                  {clubMap.get(latestUserMatch.awayClubId) && (
                    <ClubBadge
                      clubId={latestUserMatch.awayClubId}
                      abbr={clubMap.get(latestUserMatch.awayClubId)!.abbr}
                      name={clubMap.get(latestUserMatch.awayClubId)!.name}
                      primaryColor={clubMap.get(latestUserMatch.awayClubId)!.primaryColor}
                      size="sm"
                    />
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/[0.06] text-[11px]">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#b5ff00]/15 text-[#b5ff00] border border-[#b5ff00]/30 font-mono font-bold">
                  <Sliders className="w-3 h-3" />
                  IA Tática: {latestUserMatch.tacticalSummary}
                </span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="font-bold uppercase tracking-wider text-[11px]">
                Registro Partida por Partida
              </span>
              <span className="font-mono text-[11px]">
                {logs.length} etapa(s) processada(s)
              </span>
            </div>

            {reversedLogs.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-400 bg-[#0b0c10] rounded-2xl border border-white/[0.06]">
                {isRunning
                  ? 'Preparando escalação e tática ideal para a próxima partida...'
                  : 'Nenhuma partida agendada neste intervalo de datas. O elenco descansou e recuperou o físico até a data escolhida.'}
              </div>
            ) : (
              <div className="space-y-2">
                {reversedLogs.map((entry) => (
                  <div
                    key={entry.id}
                    className="bg-[#0b0c10] border border-white/[0.07] rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="font-mono text-zinc-400">
                          {entry.dateLabel}
                        </span>
                        <span className="text-zinc-600">·</span>
                        <span className="font-semibold text-zinc-300">
                          {entry.competitionLabel}
                        </span>
                        {entry.outcome !== 'BYE' && (
                          <span className="px-2 py-0.5 rounded-full bg-white/[0.05] text-[#b5ff00] font-mono text-[10px]">
                            {entry.chosenFormation} · {entry.chosenMentality}
                          </span>
                        )}
                      </div>

                      {entry.outcome === 'BYE' ? (
                        <div className="text-xs text-zinc-400">
                          {entry.tacticalSummary}
                        </div>
                      ) : (
                        <>
                          <div className="font-display text-sm sm:text-base font-extrabold uppercase text-white">
                            {entry.homeClubName}{' '}
                            <span className="font-mono text-[#b5ff00] mx-1">
                              {entry.homeGoals} × {entry.awayGoals}
                            </span>{' '}
                            {entry.awayClubName}
                            {entry.homePenalties !== null &&
                              entry.homePenalties !== undefined &&
                              entry.awayPenalties !== null &&
                              entry.awayPenalties !== undefined && (
                                <span className="ml-2 text-xs font-mono text-amber-300 font-normal">
                                  (Pên. {entry.homePenalties}:{entry.awayPenalties})
                                </span>
                              )}
                          </div>
                          {entry.goalScorers.length > 0 && (
                            <div className="text-[11px] text-zinc-500 truncate">
                              Gols: {entry.goalScorers.join(', ')}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <div className="shrink-0 flex items-center justify-end">
                      {entry.outcome === 'BYE' ? (
                        <span className="px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/10 text-[10px] font-mono text-zinc-400">
                          Sem Jogo
                        </span>
                      ) : (
                        <span
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-extrabold ${
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

        {/* Footer Controls */}
        <div className="shrink-0 px-5 py-3.5 border-t border-white/[0.08] bg-[#0b0c10] flex flex-wrap items-center justify-between gap-2.5">
          {pausedOffer ? (
            <div className="w-full flex flex-wrap items-center justify-between gap-2 text-xs text-amber-200 font-mono">
              <span>
                ⏸ Simulação aguardando sua decisão na proposta acima para retomar.
              </span>
              <button
                type="button"
                onClick={onPauseOrStop}
                className="px-3.5 py-1.5 rounded-full bg-[#14171f] hover:bg-white/10 border border-white/15 text-[11px] font-bold text-zinc-300 transition-colors"
              >
                Encerrar Simulação Aqui
              </button>
            </div>
          ) : isRunning ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid="autosim-pause-btn"
                  onClick={onPause || onPauseOrStop}
                  className="px-4 py-2 rounded-full bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/40 text-xs font-bold text-amber-200 flex items-center gap-1.5 transition-colors"
                >
                  <Pause className="w-3.5 h-3.5 text-amber-300" />
                  <span>Pausar</span>
                </button>
                <button
                  type="button"
                  data-testid="autosim-stop-btn"
                  onClick={onPauseOrStop}
                  className="px-3.5 py-2 rounded-full bg-[#14171f] hover:bg-white/10 border border-white/15 text-xs font-bold text-zinc-300 flex items-center gap-1.5 transition-colors"
                >
                  <span>Encerrar Aqui</span>
                </button>
              </div>
              <button
                type="button"
                onClick={onFinishInstant}
                className="px-4 py-2 rounded-full bg-[#b5ff00] hover:bg-[#c8ff33] text-[#090a0f] text-xs font-extrabold flex items-center gap-1.5 transition-colors shadow"
              >
                <FastForward className="w-3.5 h-3.5" />
                <span>Concluir Instantaneamente</span>
              </button>
            </>
          ) : isPaused && !isDone && !wasStoppedEarly ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid="autosim-stop-btn"
                  onClick={onPauseOrStop}
                  className="px-3.5 py-2 rounded-full bg-[#14171f] hover:bg-white/10 border border-white/15 text-xs font-bold text-zinc-300 flex items-center gap-1.5 transition-colors"
                >
                  <span>Encerrar Aqui</span>
                </button>
                <button
                  type="button"
                  onClick={onFinishInstant}
                  className="px-3.5 py-2 rounded-full bg-[#14171f] hover:bg-white/10 border border-white/15 text-xs font-bold text-zinc-200 flex items-center gap-1.5 transition-colors"
                >
                  <FastForward className="w-3.5 h-3.5 text-[#b5ff00]" />
                  <span>Concluir Instantaneamente</span>
                </button>
              </div>
              <button
                type="button"
                data-testid="autosim-resume-btn"
                onClick={onResume}
                className="px-4 py-2 rounded-full bg-[#b5ff00] hover:bg-[#c8ff33] text-[#090a0f] text-xs font-extrabold flex items-center gap-1.5 transition-colors shadow"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Retomar Simulação</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-full bg-[#14171f] hover:bg-white/10 border border-white/15 text-xs font-bold text-zinc-200 flex items-center gap-1.5 transition-colors"
              >
                <Calendar className="w-3.5 h-3.5 text-[#b5ff00]" />
                <span>Voltar ao Calendário</span>
              </button>
              <button
                type="button"
                onClick={onOpenCompetitions}
                className="px-4 py-2 rounded-full bg-[#b5ff00] hover:bg-[#c8ff33] text-[#090a0f] text-xs font-extrabold flex items-center gap-1.5 transition-colors shadow"
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>Ver Classificação & Copas</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
