import React, { useEffect, useMemo, useState } from 'react';
import {
  Play,
  Pause,
  FastForward,
  RefreshCw,
  Trophy,
  ArrowRight,
  ArrowLeft,
  UserCheck,
  CheckCircle2,
  Eye,
  Sparkles,
  Zap,
  ShieldAlert,
  History,
  Swords,
} from 'lucide-react';
import {
  Club,
  LiveMatchState,
  MentalityType,
  Player,
  RoundFixture,
} from '../types/football';
import {
  generateSubstitutionSuggestions,
  SubstitutionSuggestion,
} from '../engine/substitutionAdvisor';
import { calculatePlayerOverall } from '../engine/playerOverall';
import { HeadToHeadSummary } from '../engine/headToHead';
import { ClubBadge } from './ClubBadge';
import {
  PitchJerseySvg,
  PlayerJersey,
  PlayerOvrBadge,
} from './PlayerJersey';

interface MatchEngineViewProps {
  match: LiveMatchState;
  homeClub: Club;
  awayClub: Club;
  userClubId?: string;
  headToHead?: HeadToHeadSummary;
  squad: Player[];
  roundFixtures: RoundFixture[];
  clubs: Club[];
  userMentality: MentalityType;
  onStartOrResume: () => void;
  onPause: () => void;
  onSetSpeed: (speed: 1 | 2 | 4) => void;
  onChangeLiveMentality: (mentality: MentalityType) => void;
  onMakeSubstitution: (starterOutId: string, reserveInId: string) => void;
  onInstantFinishMatch: () => void;
  onProceedAfterFullTime: () => void;
  onExitPreMatch?: () => void;
}

export const MatchEngineView: React.FC<MatchEngineViewProps> = ({
  match,
  homeClub,
  awayClub,
  userClubId,
  headToHead,
  squad,
  roundFixtures,
  clubs,
  userMentality,
  onStartOrResume,
  onPause,
  onSetSpeed,
  onChangeLiveMentality,
  onMakeSubstitution,
  onInstantFinishMatch,
  onProceedAfterFullTime,
  onExitPreMatch,
}) => {
  const [showSubsPanel, setShowSubsPanel] = useState(true);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [showAllH2H, setShowAllH2H] = useState(false);

  useEffect(() => {
    setShowAllH2H(false);
  }, [match.fixtureId]);

  const suggestions = useMemo(
    () => generateSubstitutionSuggestions(squad, match),
    [squad, match]
  );

  const activeSuggestion: SubstitutionSuggestion | null =
    suggestions.length > 0
      ? suggestions[suggestionIndex % suggestions.length]
      : null;

  const [selectedStarterOutId, setSelectedStarterOutId] = useState<string>(
    () =>
      activeSuggestion?.starterOut.id ||
      squad.find((p) => p.isStarter && p.position !== 'GOL')?.id ||
      squad.find((p) => p.isStarter)?.id ||
      ''
  );
  const [selectedReserveInId, setSelectedReserveInId] = useState<string>(
    () =>
      activeSuggestion?.reserveIn.id ||
      squad.find((p) => !p.isStarter && !p.injured && p.position !== 'GOL')?.id ||
      ''
  );

  // Keep selected players valid when squad changes (e.g. after a substitution)
  useEffect(() => {
    const starterStillOnPitch = squad.some(
      (p) => p.id === selectedStarterOutId && p.isStarter
    );
    const reserveStillOnBench = squad.some(
      (p) => p.id === selectedReserveInId && !p.isStarter && !p.injured
    );
    if (!starterStillOnPitch || !reserveStillOnBench) {
      if (activeSuggestion) {
        setSelectedStarterOutId(activeSuggestion.starterOut.id);
        setSelectedReserveInId(activeSuggestion.reserveIn.id);
      } else {
        const nextStarter = squad.find(
          (p) => p.isStarter && p.position !== 'GOL'
        );
        const nextReserve = squad.find(
          (p) => !p.isStarter && !p.injured && p.position !== 'GOL'
        );
        if (nextStarter) setSelectedStarterOutId(nextStarter.id);
        if (nextReserve) setSelectedReserveInId(nextReserve.id);
      }
    }
  }, [squad, selectedStarterOutId, selectedReserveInId, activeSuggestion]);

  const starters = squad.filter((p) => p.isStarter);
  const reserves = squad.filter((p) => !p.isStarter);
  const clubMap = new Map(clubs.map((c) => [c.id, c]));

  const totalPossessionTicks =
    match.homePossessionTicks + match.awayPossessionTicks;
  const homePossessionPct = Math.round(
    (match.homePossessionTicks / Math.max(1, totalPossessionTicks)) * 100
  );
  const awayPossessionPct = 100 - homePossessionPct;

  const goalDiff = match.homeGoals - match.awayGoals;
  const xgDiff = match.homeXG - match.awayXG;
  const homeProb = Math.min(
    88,
    Math.max(8, Math.round(42 + goalDiff * 24 + xgDiff * 10))
  );
  const drawProb = Math.min(
    55,
    Math.max(8, Math.round(28 - Math.abs(goalDiff) * 10))
  );
  const awayProb = Math.max(4, 100 - homeProb - drawProb);

  const subsRemaining = Math.max(
    0,
    match.maxSubstitutions - match.substitutionsMade
  );

  const [draggedSubPlayerId, setDraggedSubPlayerId] = useState<string | null>(
    null
  );
  const [dragOverSubPlayerId, setDragOverSubPlayerId] = useState<string | null>(
    null
  );

  const handleCycleNextSuggestion = () => {
    if (suggestions.length === 0) return;
    const nextIdx = (suggestionIndex + 1) % suggestions.length;
    setSuggestionIndex(nextIdx);
    const nextSug = suggestions[nextIdx];
    if (nextSug) {
      setSelectedStarterOutId(nextSug.starterOut.id);
      setSelectedReserveInId(nextSug.reserveIn.id);
    }
  };

  const handleApplySuggestion = (sug: SubstitutionSuggestion) => {
    if (match.substitutionsMade >= match.maxSubstitutions) return;
    onMakeSubstitution(sug.starterOut.id, sug.reserveIn.id);
    setSuggestionIndex(0);
  };

  const handleConfirmManualSub = () => {
    if (!selectedStarterOutId || !selectedReserveInId) return;
    if (match.substitutionsMade >= match.maxSubstitutions) return;
    onMakeSubstitution(selectedStarterOutId, selectedReserveInId);
    setSuggestionIndex(0);
  };

  const handleSubDragStart = (e: React.DragEvent, playerId: string) => {
    setDraggedSubPlayerId(playerId);
    e.dataTransfer.setData('text/plain', playerId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleSubDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverSubPlayerId !== targetId) {
      setDragOverSubPlayerId(targetId);
    }
  };

  const handleSubDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = draggedSubPlayerId || e.dataTransfer.getData('text/plain');
    setDraggedSubPlayerId(null);
    setDragOverSubPlayerId(null);
    if (!sourceId || sourceId === targetId) return;
    if (match.substitutionsMade >= match.maxSubstitutions) return;

    const sourcePlayer = squad.find((p) => p.id === sourceId);
    const targetPlayer = squad.find((p) => p.id === targetId);
    if (!sourcePlayer || !targetPlayer) return;

    // One must be a starter and the other an available reserve
    if (sourcePlayer.isStarter && !targetPlayer.isStarter && !targetPlayer.injured) {
      onMakeSubstitution(sourcePlayer.id, targetPlayer.id);
      setSuggestionIndex(0);
    } else if (!sourcePlayer.isStarter && !sourcePlayer.injured && targetPlayer.isStarter) {
      onMakeSubstitution(targetPlayer.id, sourcePlayer.id);
      setSuggestionIndex(0);
    }
  };

  const handleSubDragEnd = () => {
    setDraggedSubPlayerId(null);
    setDragOverSubPlayerId(null);
  };

  const renderStatComparisonRow = (
    label: string,
    homeValue: string | number,
    awayValue: string | number,
    homeRaw: number,
    awayRaw: number
  ) => {
    const total = homeRaw + awayRaw;
    const homePct = total > 0 ? (homeRaw / total) * 100 : 50;

    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-mono tabular-nums font-bold text-[#b5ff00]">
            {homeValue}
          </span>
          <span className="text-zinc-400 text-[11px]">{label}</span>
          <span className="font-mono tabular-nums font-bold text-white">
            {awayValue}
          </span>
        </div>
        <div className="w-full h-2 bg-[#0b0c10] rounded-full overflow-hidden flex gap-0.5">
          <div
            className="h-full bg-[#b5ff00] transition-all duration-300 rounded-l-full"
            style={{ width: `${homePct}%` }}
          />
          <div
            className="h-full bg-white transition-all duration-300 rounded-r-full"
            style={{ width: `${100 - homePct}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Exclusive Match Moment Context Bar */}
      <div className="bg-[#11141c] border border-white/10 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {match.phase === 'PRE_MATCH' && onExitPreMatch ? (
            <button
              type="button"
              onClick={onExitPreMatch}
              className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#0b0c10] hover:bg-white/[0.08] text-zinc-200 border border-white/10 transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#b5ff00]" />
              <span>Voltar à Preparação (Gestão & Táticas)</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 text-xs text-zinc-300 font-medium">
              <ShieldAlert className="w-4 h-4 text-[#b5ff00] shrink-0" />
              <span>
                Modo Exclusivo de Partida — Configurações externas bloqueadas até o apito final
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
          <span className="text-[#b5ff00] font-bold">
            {match.competitionLabel || `${match.roundNumber}ª Rodada`}
          </span>
          <span>·</span>
          <span>{homeClub.stadium}</span>
        </div>
      </div>

      {/* Pre-Match Exclusive Mode Decision Banner (Watch Live 2D vs Fast Simulate) */}
      {match.phase === 'PRE_MATCH' && (
        <div className="bg-gradient-to-r from-[#171c26] via-[#14171f] to-[#192212] border border-[#b5ff00]/35 rounded-[28px] p-5 sm:p-6 shadow-2xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-[#b5ff00]">
                <Zap className="w-3.5 h-3.5" />
                <span>Momento Exclusivo de Partida · Escolha Como Jogar</span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-white">
                {homeClub.shortName} vs {awayClub.shortName} pronto para o apito inicial
              </h2>
              <p className="text-xs text-zinc-300 max-w-2xl">
                Acompanhe a transmissão tática 2D em tempo real com controle de mentalidade e sugestões de substituições ao vivo, ou execute a simulação rápida para obter o resultado imediato dos 90 minutos.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={onStartOrResume}
                className="px-5 py-3 rounded-2xl text-xs font-extrabold bg-[#b5ff00] hover:bg-[#c8ff33] text-[#090a0f] transition-colors flex items-center gap-2 shadow-lg"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Assistir Partida 2D ao Vivo</span>
              </button>

              <button
                type="button"
                onClick={onInstantFinishMatch}
                className="px-5 py-3 rounded-2xl text-xs font-extrabold bg-white hover:bg-zinc-200 text-[#090a0f] transition-colors flex items-center gap-2 shadow-lg"
              >
                <FastForward className="w-4 h-4" />
                <span>Simulação Rápida (Resultado 90&apos;)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Scoreboard Hero Banner */}
      <div className="bg-[#14171f] border border-white/[0.08] rounded-[28px] p-4 sm:p-6 shadow-2xl space-y-5">
        {/* Top Row: Spectators Counter + Live Lime Status Pill + Speed & Sim Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/[0.07]">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-mono tabular-nums text-zinc-300 bg-[#0b0c10] px-3 py-1.5 rounded-full border border-white/[0.07]">
              <Eye className="w-3.5 h-3.5 text-[#b5ff00]" />
              <span>41.2k</span>
            </div>

            <div className="px-3.5 py-1.5 rounded-full bg-[#b5ff00] text-[#090a0f] text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-rose-600 inline-block" />
              <span>
                {match.phase === 'PRE_MATCH'
                  ? "PRÉ-JOGO · 0'"
                  : match.phase === 'HALF_TIME'
                  ? "INTERVALO · 45'"
                  : match.phase === 'FULL_TIME'
                  ? "ENCERRADO · 90'"
                  : `AO VIVO · ${match.minute}'`}
              </span>
            </div>
          </div>

          {/* Speed & Simulation Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {match.phase !== 'FULL_TIME' && (
              <>
                {match.isRunning ? (
                  <button
                    onClick={onPause}
                    className="px-4 py-2 rounded-full text-xs font-bold bg-amber-400 hover:bg-amber-300 text-[#090a0f] transition-colors flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Pause className="w-3.5 h-3.5 fill-current" />
                    Pausar
                  </button>
                ) : (
                  <button
                    onClick={onStartOrResume}
                    data-start="true"
                    className="px-4 py-2 rounded-full text-xs font-extrabold bg-[#b5ff00] hover:bg-[#c8ff33] text-[#090a0f] transition-colors flex items-center gap-1.5 whitespace-nowrap shadow-md"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    {match.phase === 'PRE_MATCH'
                      ? 'Iniciar Partida'
                      : match.phase === 'HALF_TIME'
                      ? 'Iniciar 2º Tempo'
                      : 'Retomar'}
                  </button>
                )}

                {/* 1x, 2x, 4x Speed Selector */}
                <div
                  className="flex items-center bg-[#0b0c10] border border-white/[0.08] rounded-full p-1"
                  role="group"
                  aria-label="Velocidade da partida"
                >
                  {([1, 2, 4] as const).map((spd) => (
                    <button
                      key={spd}
                      onClick={() => onSetSpeed(spd)}
                      className={`px-3 py-1 rounded-full text-xs font-mono font-bold transition-colors ${
                        match.speed === spd
                          ? 'bg-[#b5ff00] text-[#090a0f]'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>

                <button
                  onClick={onInstantFinishMatch}
                  className="px-3.5 py-2 rounded-full text-xs font-semibold bg-[#0b0c10] hover:bg-white/[0.08] text-zinc-200 border border-white/10 transition-colors flex items-center gap-1.5 whitespace-nowrap"
                  title="Simular rapidamente até os 90 minutos"
                >
                  <FastForward className="w-3.5 h-3.5 text-[#b5ff00]" />
                  <span>Simular Rápido (90&apos;)</span>
                </button>
              </>
            )}

            {/* Substitutions Drawer Button */}
            <button
              onClick={() => {
                if (match.isRunning) onPause();
                setShowSubsPanel((prev) => !prev);
              }}
              className={`px-3.5 py-2 rounded-full text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                showSubsPanel
                  ? 'bg-[#b5ff00] text-[#090a0f]'
                  : 'bg-white/[0.08] hover:bg-white/[0.14] text-white'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>
                Substituições ({match.substitutionsMade}/
                {match.maxSubstitutions})
              </span>
            </button>
          </div>
        </div>

        {/* Center Scoreboard Lockup */}
        <div className="grid grid-cols-3 items-center text-center py-1">
          {/* Home Team */}
          <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-end gap-2 sm:gap-3">
            <div className="order-2 sm:order-1 text-center sm:text-right">
              <div className="font-display text-base sm:text-2xl font-extrabold uppercase tracking-tight text-white leading-none">
                {homeClub.shortName}
              </div>
              <div className="text-[10px] sm:text-xs font-mono text-[#b5ff00] mt-1 whitespace-nowrap">
                xG {match.homeXG.toFixed(2)} · {homeClub.formation}
              </div>
            </div>
            <ClubBadge
              clubId={homeClub.id}
              abbr={homeClub.abbr}
              name={homeClub.name}
              primaryColor={homeClub.primaryColor}
              size="lg"
              className="order-1 sm:order-2"
            />
          </div>

          {/* Giant Condensed Score */}
          <div className="flex flex-col items-center justify-center">
            <div className="font-display text-4xl sm:text-6xl font-extrabold tabular-nums text-white tracking-tight leading-none">
              {match.homeGoals}:{match.awayGoals}
            </div>
            {match.homePenalties !== null &&
              match.homePenalties !== undefined &&
              match.awayPenalties !== null &&
              match.awayPenalties !== undefined && (
                <div className="text-[11px] font-mono font-bold text-[#b5ff00] mt-1">
                  Pênaltis: {match.homePenalties}:{match.awayPenalties}
                </div>
              )}
            <div className="text-[10px] sm:text-[11px] font-mono text-zinc-400 mt-1.5 truncate max-w-[140px] sm:max-w-none">
              {match.competitionLabel
                ? `${match.competitionLabel} · ${homeClub.stadium}`
                : homeClub.stadium}
            </div>
          </div>

          {/* Away Team */}
          <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-2 sm:gap-3">
            <ClubBadge
              clubId={awayClub.id}
              abbr={awayClub.abbr}
              name={awayClub.name}
              primaryColor={awayClub.primaryColor}
              size="lg"
            />
            <div className="text-center sm:text-left">
              <div className="font-display text-base sm:text-2xl font-extrabold uppercase tracking-tight text-white leading-none">
                {awayClub.shortName}
              </div>
              <div className="text-[10px] sm:text-xs font-mono text-zinc-300 mt-1 whitespace-nowrap">
                xG {match.awayXG.toFixed(2)} · {awayClub.formation}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Mentality Bar & Live Probability Strip */}
        <div className="pt-3 border-t border-white/[0.07] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-xs text-zinc-400 font-medium whitespace-nowrap">
              Mentalidade Tática ao Vivo:
            </span>
            <div className="grid grid-cols-3 sm:flex items-center gap-1 bg-[#0b0c10] p-1 rounded-full border border-white/[0.07]">
              {(
                ['Cautelosa', 'Equilibrada', 'Ofensiva'] as MentalityType[]
              ).map((ment) => (
                <button
                  key={ment}
                  onClick={() => onChangeLiveMentality(ment)}
                  className={`px-3 py-1.5 sm:py-1 rounded-full text-xs font-bold transition-colors whitespace-nowrap text-center ${
                    userMentality === ment
                      ? 'bg-[#b5ff00] text-[#090a0f]'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {ment}
                </button>
              ))}
            </div>
          </div>

          {/* 3-Tile Live Win Probability */}
          <div className="grid grid-cols-3 gap-2 sm:w-80">
            <div className="bg-[#b5ff00] text-[#090a0f] rounded-xl px-3 py-1.5 flex items-center justify-between">
              <span className="font-display font-extrabold text-base tabular-nums">
                {homeProb}%
              </span>
              <span className="text-[10px] font-mono font-bold">
                {homeClub.abbr}
              </span>
            </div>
            <div className="bg-white text-[#090a0f] rounded-xl px-3 py-1.5 flex items-center justify-between">
              <span className="font-display font-extrabold text-base tabular-nums">
                {drawProb}%
              </span>
              <span className="text-[10px] font-mono font-bold text-zinc-500">
                EMP
              </span>
            </div>
            <div className="bg-[#d9ff7a] text-[#090a0f] rounded-xl px-3 py-1.5 flex items-center justify-between">
              <span className="font-display font-extrabold text-base tabular-nums">
                {awayProb}%
              </span>
              <span className="text-[10px] font-mono font-bold">
                {awayClub.abbr}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Pre-Match Card: Histórico de Confrontos (Head-to-Head) */}
      {match.phase === 'PRE_MATCH' &&
        (() => {
          const userClub = match.isUserHome ? homeClub : awayClub;
          const oppClub = match.isUserHome ? awayClub : homeClub;
          const summary: HeadToHeadSummary = headToHead || {
            opponentClubId: oppClub.id,
            totalMatches: 0,
            userWins: 0,
            draws: 0,
            opponentWins: 0,
            userGoalsFor: 0,
            userGoalsAgainst: 0,
            goalDifference: 0,
            winRatePct: 0,
            recentMatches: [],
          };
          const displayedMatches = showAllH2H
            ? summary.recentMatches
            : summary.recentMatches.slice(0, 5);
          const totalForBar = Math.max(1, summary.totalMatches);
          const userWinPctBar = (summary.userWins / totalForBar) * 100;
          const drawPctBar = (summary.draws / totalForBar) * 100;
          const oppWinPctBar = (summary.opponentWins / totalForBar) * 100;

          return (
            <section
              aria-label="Histórico de Confrontos"
              data-testid="head-to-head-card"
              className="bg-[#14171f] border border-white/[0.08] rounded-[28px] p-5 space-y-4 shadow-xl"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/[0.07]">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-[#b5ff00]/15 border border-[#b5ff00]/35 flex items-center justify-center text-[#b5ff00] shrink-0">
                    <History className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg sm:text-xl font-extrabold uppercase tracking-tight text-white leading-none">
                      Histórico de Confrontos
                    </h3>
                    <p className="text-[11px] text-zinc-400 mt-1">
                      Últimas partidas entre{' '}
                      <strong className="text-zinc-200">{userClub.shortName}</strong> e{' '}
                      <strong className="text-zinc-200">{oppClub.shortName}</strong> na carreira
                    </p>
                  </div>
                </div>

                <span
                  className={`px-3 py-1 rounded-full text-[11px] font-mono font-bold border ${
                    summary.totalMatches > 0
                      ? 'bg-[#b5ff00]/15 border-[#b5ff00]/40 text-[#b5ff00]'
                      : 'bg-[#0b0c10] border-white/10 text-zinc-400'
                  }`}
                >
                  {summary.totalMatches > 0
                    ? `${summary.totalMatches} confronto${summary.totalMatches === 1 ? '' : 's'} registrado${summary.totalMatches === 1 ? '' : 's'}`
                    : 'Confronto Inédito'}
                </span>
              </div>

              {summary.totalMatches === 0 ? (
                <div className="bg-[#0b0c10] border border-white/[0.06] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <Swords className="w-5 h-5 text-zinc-500 shrink-0" />
                    <div className="text-zinc-300">
                      <div className="font-bold text-white">
                        Primeiro duelo oficial entre {userClub.shortName} e {oppClub.shortName} nesta carreira
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Assim que esta e as próximas partidas pelo Brasileirão, Copa do Brasil e Libertadores forem disputadas, os placares e o retrospecto aparecerão aqui.
                      </p>
                    </div>
                  </div>
                  <div className="font-mono text-xs font-bold text-zinc-500 shrink-0">
                    0V · 0E · 0D
                  </div>
                </div>
              ) : (
                <>
                  {/* Aggregate H2H Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="bg-[#0b0c10] border border-[#b5ff00]/25 rounded-2xl p-3">
                      <div className="text-[10px] font-mono uppercase text-zinc-400">
                        Vitórias {userClub.abbr}
                      </div>
                      <div className="font-display text-2xl font-extrabold text-[#b5ff00] tabular-nums mt-0.5">
                        {summary.userWins}
                      </div>
                    </div>
                    <div className="bg-[#0b0c10] border border-white/[0.07] rounded-2xl p-3">
                      <div className="text-[10px] font-mono uppercase text-zinc-400">
                        Empates
                      </div>
                      <div className="font-display text-2xl font-extrabold text-amber-300 tabular-nums mt-0.5">
                        {summary.draws}
                      </div>
                    </div>
                    <div className="bg-[#0b0c10] border border-white/[0.07] rounded-2xl p-3">
                      <div className="text-[10px] font-mono uppercase text-zinc-400">
                        Vitórias {oppClub.abbr}
                      </div>
                      <div className="font-display text-2xl font-extrabold text-rose-400 tabular-nums mt-0.5">
                        {summary.opponentWins}
                      </div>
                    </div>
                    <div className="bg-[#0b0c10] border border-white/[0.07] rounded-2xl p-3">
                      <div className="text-[10px] font-mono uppercase text-zinc-400">
                        Gols ({userClub.abbr} × {oppClub.abbr})
                      </div>
                      <div className="font-display text-2xl font-extrabold text-white tabular-nums mt-0.5 flex items-baseline gap-2">
                        <span>
                          {summary.userGoalsFor}–{summary.userGoalsAgainst}
                        </span>
                        <span className="text-[11px] font-mono text-zinc-400">
                          ({summary.winRatePct}% aprov.)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Proportional W/D/L Bar */}
                  <div className="w-full h-2 bg-[#0b0c10] rounded-full overflow-hidden flex gap-0.5">
                    {summary.userWins > 0 && (
                      <div
                        className="h-full bg-[#b5ff00]"
                        style={{ width: `${userWinPctBar}%` }}
                        title={`${summary.userWins} vitória(s) do ${userClub.shortName}`}
                      />
                    )}
                    {summary.draws > 0 && (
                      <div
                        className="h-full bg-amber-400"
                        style={{ width: `${drawPctBar}%` }}
                        title={`${summary.draws} empate(s)`}
                      />
                    )}
                    {summary.opponentWins > 0 && (
                      <div
                        className="h-full bg-rose-500"
                        style={{ width: `${oppWinPctBar}%` }}
                        title={`${summary.opponentWins} vitória(s) do ${oppClub.shortName}`}
                      />
                    )}
                  </div>

                  {/* Last Matches List */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                      <span>Últimas Partidas</span>
                      {summary.recentMatches.length > 5 && (
                        <button
                          type="button"
                          onClick={() => setShowAllH2H((v) => !v)}
                          className="text-[#b5ff00] hover:underline font-bold normal-case"
                        >
                          {showAllH2H
                            ? 'Mostrar apenas 5 recentes'
                            : `Ver todas (${summary.recentMatches.length})`}
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                      {displayedMatches.map((item) => {
                        const matchHomeClub =
                          clubMap.get(item.homeClubId) || homeClub;
                        const matchAwayClub =
                          clubMap.get(item.awayClubId) || awayClub;
                        const isUserItemHome = userClubId
                          ? item.homeClubId === userClubId
                          : item.isUserHome;
                        const outcomeBadge =
                          item.outcome === 'V'
                            ? {
                                label: 'V',
                                title: 'Vitória',
                                cls: 'bg-[#b5ff00] text-[#090a0f]',
                              }
                            : item.outcome === 'E'
                            ? {
                                label: 'E',
                                title: 'Empate',
                                cls: 'bg-amber-400/20 text-amber-300 border border-amber-400/40',
                              }
                            : {
                                label: 'D',
                                title: 'Derrota',
                                cls: 'bg-rose-500/20 text-rose-300 border border-rose-500/40',
                              };

                        return (
                          <div
                            key={item.id}
                            className="bg-[#0b0c10] border border-white/[0.07] rounded-2xl px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400 truncate">
                                <span className="text-[#b5ff00] font-bold">
                                  {item.seasonYear}
                                </span>
                                <span>·</span>
                                <span className="truncate">{item.competitionLabel}</span>
                                <span>·</span>
                                <span className="text-zinc-300 shrink-0">
                                  {isUserItemHome ? 'Casa' : 'Fora'}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 min-w-0">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <ClubBadge
                                    clubId={matchHomeClub.id}
                                    abbr={matchHomeClub.abbr}
                                    name={matchHomeClub.name}
                                    primaryColor={matchHomeClub.primaryColor}
                                    size="xs"
                                  />
                                  <span
                                    className={`truncate font-semibold ${
                                      isUserItemHome ? 'text-white' : 'text-zinc-300'
                                    }`}
                                  >
                                    {matchHomeClub.shortName}
                                  </span>
                                </div>

                                <span className="font-mono font-extrabold text-sm text-white tabular-nums shrink-0 px-1.5 py-0.5 rounded bg-white/[0.06]">
                                  {item.homeGoals} - {item.awayGoals}
                                </span>

                                <div className="flex items-center gap-1.5 min-w-0">
                                  <ClubBadge
                                    clubId={matchAwayClub.id}
                                    abbr={matchAwayClub.abbr}
                                    name={matchAwayClub.name}
                                    primaryColor={matchAwayClub.primaryColor}
                                    size="xs"
                                  />
                                  <span
                                    className={`truncate font-semibold ${
                                      !isUserItemHome ? 'text-white' : 'text-zinc-300'
                                    }`}
                                  >
                                    {matchAwayClub.shortName}
                                  </span>
                                </div>

                                {item.decidedOnPenalties && (
                                  <span className="text-[10px] font-mono text-amber-300 shrink-0">
                                    (Pên. {item.homePenalties}-{item.awayPenalties})
                                  </span>
                                )}
                              </div>
                            </div>

                            <span
                              title={outcomeBadge.title}
                              className={`w-7 h-7 rounded-xl font-mono text-xs font-extrabold flex items-center justify-center shrink-0 ${outcomeBadge.cls}`}
                            >
                              {outcomeBadge.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </section>
          );
        })()}

      {/* Full-Time Round Summary & Parallel Stage Results */}
      {match.phase === 'FULL_TIME' && (
        <div className="bg-[#14171f] border border-[#b5ff00]/50 rounded-[28px] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.07] pb-3.5">
            <div>
              <div className="flex items-center gap-2 text-[#b5ff00] text-xs font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  Fim de Jogo (90&apos;) —{' '}
                  {match.winnerClubId
                    ? `Classificado: ${clubMap.get(match.winnerClubId)?.name || ''}`
                    : `Jogos de ${match.competitionLabel || `${match.roundNumber}ª Rodada`} simulados e classificação atualizada!`}
                </span>
              </div>
              <h3 className="font-display text-2xl font-extrabold uppercase tracking-tight text-white mt-1">
                Resultados — {match.competitionLabel || `${match.roundNumber}ª Rodada`}
              </h3>
            </div>

            <button
              onClick={onProceedAfterFullTime}
              className="px-5 py-2.5 rounded-full text-xs font-extrabold bg-[#b5ff00] hover:bg-[#c8ff33] text-[#090a0f] transition-colors flex items-center gap-2 whitespace-nowrap shadow-md"
            >
              <Trophy className="w-4 h-4" />
              <span>Encerrar Partida e Voltar à Gestão</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
            {roundFixtures.slice(0, 16).map((fix) => {
              const hClub = clubMap.get(fix.homeClubId);
              const aClub = clubMap.get(fix.awayClubId);
              const hasPens =
                fix.homePenalties !== null &&
                fix.homePenalties !== undefined &&
                fix.awayPenalties !== null &&
                fix.awayPenalties !== undefined;
              return (
                <div
                  key={fix.id}
                  className={`px-3.5 py-2.5 rounded-2xl border text-xs font-mono tabular-nums ${
                    fix.isUserMatch
                      ? 'bg-[#b5ff00] text-[#090a0f] border-[#b5ff00] font-bold'
                      : 'bg-[#0b0c10] border-white/[0.07] text-zinc-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-sans font-semibold truncate max-w-[75px]">
                      {hClub?.shortName}
                    </span>
                    <span className="font-extrabold whitespace-nowrap">
                      {fix.homeGoals ?? 0} - {fix.awayGoals ?? 0}
                    </span>
                    <span className="font-sans font-semibold truncate max-w-[75px] text-right">
                      {aClub?.shortName}
                    </span>
                  </div>
                  {hasPens && (
                    <div className="text-[10px] text-center opacity-80 mt-0.5">
                      Pen: {fix.homePenalties} - {fix.awayPenalties}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Live Substitution Drawer with Coherent Suggestions & Reload Button */}
      {showSubsPanel && match.phase !== 'FULL_TIME' && (
        <div className="bg-[#14171f] border border-[#b5ff00]/40 rounded-[24px] p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] pb-3">
            <div className="text-xs font-bold text-[#b5ff00] flex items-center gap-2">
              <UserCheck className="w-4 h-4" />
              <span>
                Central de Substituições & Auxiliar Técnico ({match.substitutionsMade}
                /{match.maxSubstitutions} utilizadas · {subsRemaining}{' '}
                {subsRemaining === 1 ? 'restante' : 'restantes'})
              </span>
            </div>
            <button
              onClick={() => setShowSubsPanel(false)}
              className="text-xs text-zinc-400 hover:text-white"
            >
              Ocultar painel
            </button>
          </div>

          {/* Coherent Assistant Suggestion Card with Reload */}
          {activeSuggestion && subsRemaining > 0 && (
            <div className="bg-[#0b0c10] border border-[#b5ff00]/30 rounded-2xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#b5ff00] text-[#090a0f] text-[10px] font-extrabold uppercase tracking-wider">
                    <Sparkles className="w-3 h-3" />
                    {activeSuggestion.categoryLabel}
                  </span>
                  <span className="text-[11px] font-mono text-zinc-300 bg-white/[0.06] px-2.5 py-0.5 rounded-full">
                    {activeSuggestion.compatibilityLabel}
                  </span>
                  <span className="text-[11px] font-mono text-zinc-400">
                    Sugestão {(suggestionIndex % suggestions.length) + 1} de{' '}
                    {suggestions.length}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCycleNextSuggestion}
                    data-testid="reload-sub-suggestion"
                    className="px-3 py-1.5 rounded-full text-xs font-bold bg-[#14171f] hover:bg-white/[0.1] text-white border border-white/15 transition-colors flex items-center gap-1.5"
                    title="Gerar outra sugestão coerente de substituição"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-[#b5ff00]" />
                    <span>Nova Sugestão</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApplySuggestion(activeSuggestion)}
                    className="px-3.5 py-1.5 rounded-full text-xs font-extrabold bg-[#b5ff00] hover:bg-[#c8ff33] text-[#090a0f] transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Aplicar Sugestão</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-11 gap-2.5 items-center bg-[#14171f] rounded-xl p-3 border border-white/[0.06]">
                {/* Starter Out */}
                <div className="md:col-span-5 flex items-center justify-between gap-2 bg-[#0b0c10] rounded-xl px-3 py-2 border border-rose-500/25">
                  <div className="flex items-center gap-2 min-w-0">
                    <PlayerJersey
                      number={activeSuggestion.starterOut.number}
                      variant="white"
                      size="sm"
                      highlight="out"
                    />
                    <PlayerOvrBadge
                      ovr={activeSuggestion.starterOvr}
                      position={activeSuggestion.starterOut.position}
                      size="sm"
                      tone="rose"
                    />
                    <div className="min-w-0">
                      <div className="text-[10px] font-mono uppercase text-rose-400 font-bold">
                        SAI DE CAMPO
                      </div>
                      <div className="text-xs font-bold text-white truncate">
                        {activeSuggestion.starterOut.name}{' '}
                        <span className="font-mono text-zinc-300 font-semibold">
                          ({activeSuggestion.starterOut.age}a)
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 font-mono tabular-nums">
                    <div className="text-xs font-bold text-rose-300">
                      {activeSuggestion.starterLiveCondition}% fís.
                    </div>
                    <div className="text-[10px] text-zinc-400">
                      Nota {activeSuggestion.starterLiveRating.toFixed(1)}
                    </div>
                  </div>
                </div>

                <div className="md:col-span-1 flex items-center justify-center text-[#b5ff00] font-mono text-xs font-bold">
                  ➔
                </div>

                {/* Reserve In */}
                <div className="md:col-span-5 flex items-center justify-between gap-2 bg-[#0b0c10] rounded-xl px-3 py-2 border border-[#b5ff00]/35">
                  <div className="flex items-center gap-2 min-w-0">
                    <PlayerJersey
                      number={activeSuggestion.reserveIn.number}
                      variant="lime"
                      size="sm"
                      highlight="selected"
                    />
                    <PlayerOvrBadge
                      ovr={activeSuggestion.reserveOvr}
                      position={activeSuggestion.reserveIn.position}
                      size="sm"
                      tone="lime"
                    />
                    <div className="min-w-0">
                      <div className="text-[10px] font-mono uppercase text-[#b5ff00] font-bold">
                        ENTRA EM CAMPO
                      </div>
                      <div className="text-xs font-bold text-white truncate">
                        {activeSuggestion.reserveIn.name}{' '}
                        <span className="font-mono text-zinc-300 font-semibold">
                          ({activeSuggestion.reserveIn.age}a)
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 font-mono tabular-nums">
                    <div className="text-xs font-bold text-[#b5ff00]">
                      {activeSuggestion.reserveCondition}% fís.
                    </div>
                    <div className="text-[10px] text-zinc-400">
                      Adeq. {activeSuggestion.roleSuitabilityPct}%
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-xs text-zinc-300 leading-relaxed">
                <strong className="text-[#b5ff00]">Análise do Auxiliar:</strong>{' '}
                {activeSuggestion.reason}
              </p>
            </div>
          )}

          {/* Urgent banner if any user player on the pitch just got injured */}
          {(() => {
            const liveUserTokens = match.isUserHome
              ? match.homeTokens
              : match.awayTokens;
            const injuredTokens = liveUserTokens.filter((t) => t.injuredInMatch);
            if (injuredTokens.length === 0) return null;
            return (
              <div className="bg-rose-950/60 border border-rose-500/60 rounded-2xl px-4 py-3 text-xs text-rose-100 flex flex-wrap items-center justify-between gap-2">
                <div className="font-bold">
                  ⚠ LESÃO EM CAMPO:{' '}
                  {injuredTokens.map((t) => `#${t.number} ${t.name}`).join(', ')}{' '}
                  sentiu durante o jogo e está com forte queda de rendimento. Substitua imediatamente!
                </div>
              </div>
            );
          })()}

          {/* Interactive Drag-and-Drop Jersey Substitution Board (Starters in Game + Bench) */}
          <div className="bg-[#0b0c10] border border-white/[0.08] rounded-2xl p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-white">
                Substituição com Camisas (Arraste um jogador do banco sobre quem está em campo ou vice-versa):
              </span>
              {draggedSubPlayerId && (
                <span className="text-[11px] font-bold text-[#b5ff00] animate-pulse">
                  Solte sobre a camisa alvo para substituir!
                </span>
              )}
            </div>

            {/* 11 Starters on the Pitch as Jerseys */}
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                Em Campo (11 Escalados — Clique para selecionar quem sai ou solte alguém do banco aqui)
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-0.5">
                {starters.map((st) => {
                  const token = (
                    match.isUserHome ? match.homeTokens : match.awayTokens
                  ).find((t) => t.id === st.id);
                  const liveCond = token
                    ? Math.round(token.condition)
                    : Math.round(st.condition);
                  const stOvr = calculatePlayerOverall(st.attributes, st.position);
                  const isSelectedOut = selectedStarterOutId === st.id;
                  const isDragged = draggedSubPlayerId === st.id;
                  const isDropTarget =
                    dragOverSubPlayerId === st.id && draggedSubPlayerId !== st.id;
                  const lastName = st.name.split(' ').slice(-1)[0] || st.name;
                  const isLimeShirt =
                    isSelectedOut ||
                    st.assignedDuty === 'Atacar' ||
                    st.assignedDuty === 'Apoiar';

                  return (
                    <button
                      key={st.id}
                      type="button"
                      draggable={subsRemaining > 0}
                      onDragStart={(e) => handleSubDragStart(e, st.id)}
                      onDragOver={(e) => handleSubDragOver(e, st.id)}
                      onDragLeave={() => {
                        if (dragOverSubPlayerId === st.id) {
                          setDragOverSubPlayerId(null);
                        }
                      }}
                      onDrop={(e) => handleSubDrop(e, st.id)}
                      onDragEnd={handleSubDragEnd}
                      onClick={() => setSelectedStarterOutId(st.id)}
                      title={`Em campo #${st.number} ${st.name} (${st.position} · OVR ${stOvr} · ${st.age}a · Cond ${liveCond}%) — Arraste alguém do banco aqui`}
                      className={`shrink-0 flex flex-col items-center rounded-2xl px-2.5 py-2 border transition-all select-none ${
                        isDropTarget
                          ? 'bg-sky-400/20 border-sky-400 ring-2 ring-sky-400 scale-105'
                          : token?.injuredInMatch
                          ? 'bg-rose-950/60 border-rose-500 ring-2 ring-rose-500/80'
                          : isSelectedOut
                          ? 'bg-rose-500/15 border-rose-400 ring-2 ring-rose-400/70'
                          : 'bg-[#14171f] border-white/[0.07] hover:border-white/25 cursor-grab active:cursor-grabbing'
                      } ${isDragged ? 'opacity-40 scale-95' : ''}`}
                    >
                      <PlayerJersey
                        number={st.number}
                        ovr={stOvr}
                        variant={isLimeShirt ? 'lime' : 'white'}
                        size="sm"
                        highlight={
                          isDropTarget
                            ? 'dropTarget'
                            : isSelectedOut || token?.injuredInMatch
                            ? 'out'
                            : 'none'
                        }
                      />
                      <div
                        className={`mt-1.5 px-2 py-0.5 rounded-full text-[9px] font-semibold whitespace-nowrap ${
                          token?.injuredInMatch || isSelectedOut
                            ? 'bg-rose-500 text-white font-bold'
                            : 'bg-[#0b0c10] text-zinc-100 border border-white/10'
                        }`}
                      >
                        <span
                          className={`font-mono font-bold mr-1 ${
                            token?.injuredInMatch || isSelectedOut
                              ? 'text-white'
                              : 'text-[#b5ff00]'
                          }`}
                        >
                          {token?.injuredInMatch ? 'DM' : st.position}
                        </span>
                        <span>{lastName}</span>
                      </div>
                      <span className="mt-0.5 text-[9px] font-mono tabular-nums text-zinc-300">
                        {token?.injuredInMatch ? (
                          <strong className="text-rose-400">LESIONADO</strong>
                        ) : (
                          <>
                            {st.age}a ·{' '}
                            <strong
                              className={
                                liveCond >= 80
                                  ? 'text-emerald-400'
                                  : liveCond >= 65
                                  ? 'text-amber-400'
                                  : 'text-rose-400'
                              }
                            >
                              {liveCond}%
                            </strong>
                          </>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bench Reserves as Jerseys */}
            <div className="pt-2 border-t border-white/[0.06]">
              <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                No Banco ({reserves.length} Jogadores — Arraste sobre quem está em campo para substituir)
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-0.5">
                {reserves.map((res) => {
                  const resCond = Math.round(res.condition);
                  const resOvr = calculatePlayerOverall(res.attributes, res.position);
                  const isSelectedIn = selectedReserveInId === res.id;
                  const isDragged = draggedSubPlayerId === res.id;
                  const isDropTarget =
                    dragOverSubPlayerId === res.id && draggedSubPlayerId !== res.id;
                  const lastName = res.name.split(' ').slice(-1)[0] || res.name;
                  const isLimeShirt =
                    isSelectedIn ||
                    res.sector === 'ATA' ||
                    res.sector === 'MEI';

                  return (
                    <button
                      key={res.id}
                      type="button"
                      draggable={!res.injured && subsRemaining > 0}
                      onDragStart={(e) => handleSubDragStart(e, res.id)}
                      onDragOver={(e) => handleSubDragOver(e, res.id)}
                      onDragLeave={() => {
                        if (dragOverSubPlayerId === res.id) {
                          setDragOverSubPlayerId(null);
                        }
                      }}
                      onDrop={(e) => handleSubDrop(e, res.id)}
                      onDragEnd={handleSubDragEnd}
                      disabled={res.injured}
                      onClick={() => setSelectedReserveInId(res.id)}
                      title={`No banco #${res.number} ${res.name} (${res.position} · OVR ${resOvr} · ${res.age}a) — Arraste sobre quem está em campo`}
                      className={`shrink-0 flex flex-col items-center rounded-2xl px-2.5 py-2 border transition-all select-none ${
                        res.injured
                          ? 'opacity-40 cursor-not-allowed border-white/[0.04] bg-[#14171f]/50'
                          : isDropTarget
                          ? 'bg-sky-400/20 border-sky-400 ring-2 ring-sky-400 scale-105'
                          : isSelectedIn
                          ? 'bg-[#b5ff00]/15 border-[#b5ff00] ring-2 ring-[#b5ff00]/70'
                          : 'bg-[#14171f] border-white/[0.07] hover:border-[#b5ff00]/50 cursor-grab active:cursor-grabbing'
                      } ${isDragged ? 'opacity-40 scale-95' : ''}`}
                    >
                      <PlayerJersey
                        number={res.number}
                        ovr={resOvr}
                        variant={isLimeShirt ? 'lime' : 'white'}
                        size="sm"
                        highlight={
                          isDropTarget
                            ? 'dropTarget'
                            : isSelectedIn
                            ? 'selected'
                            : 'none'
                        }
                      />
                      <div
                        className={`mt-1.5 px-2 py-0.5 rounded-full text-[9px] font-semibold whitespace-nowrap ${
                          isSelectedIn
                            ? 'bg-[#b5ff00] text-[#090a0f] font-extrabold'
                            : 'bg-[#0b0c10] text-zinc-100 border border-white/10'
                        }`}
                      >
                        <span
                          className={`font-mono font-bold mr-1 ${
                            isSelectedIn ? 'text-[#090a0f]' : 'text-[#b5ff00]'
                          }`}
                        >
                          {res.position}
                        </span>
                        <span>{lastName}</span>
                      </div>
                      <span className="mt-0.5 text-[9px] font-mono tabular-nums text-zinc-300">
                        {res.age}a ·{' '}
                        <strong className="text-emerald-400">{resCond}%</strong>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Manual Override Selector */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end pt-1">
            <div>
              <label
                htmlFor="sub-out-select"
                className="block text-xs text-zinc-400 mb-1"
              >
                Escolha Manual — Sai (Em Campo)
              </label>
              <select
                id="sub-out-select"
                value={selectedStarterOutId}
                onChange={(e) => setSelectedStarterOutId(e.target.value)}
                className="w-full bg-[#0b0c10] border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
              >
                {starters.map((st) => {
                  const token = (
                    match.isUserHome ? match.homeTokens : match.awayTokens
                  ).find((t) => t.id === st.id);
                  const liveCond = token
                    ? Math.round(token.condition)
                    : Math.round(st.condition);
                  const stOvr = calculatePlayerOverall(st.attributes, st.position);
                  return (
                    <option key={st.id} value={st.id}>
                      #{st.number} {st.name} ({st.position} · OVR {stOvr} · {st.age}a) — Condição: {liveCond}%
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label
                htmlFor="sub-in-select"
                className="block text-xs text-zinc-400 mb-1"
              >
                Escolha Manual — Entra (Do Banco)
              </label>
              <select
                id="sub-in-select"
                value={selectedReserveInId}
                onChange={(e) => setSelectedReserveInId(e.target.value)}
                className="w-full bg-[#0b0c10] border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
              >
                {reserves.map((res) => {
                  const resOvr = calculatePlayerOverall(res.attributes, res.position);
                  return (
                    <option key={res.id} value={res.id} disabled={res.injured}>
                      #{res.number} {res.name} ({res.position} · OVR {resOvr} · {res.age}a) — Condição: {Math.round(res.condition)}%{' '}
                      {res.injured ? '[Transição]' : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            <button
              onClick={handleConfirmManualSub}
              disabled={match.substitutionsMade >= match.maxSubstitutions}
              className="py-2.5 px-4 rounded-full text-xs font-extrabold bg-white hover:bg-[#b5ff00] disabled:bg-zinc-800 disabled:text-zinc-500 text-[#090a0f] transition-colors"
            >
              Confirmar Seleção Manual
            </button>
          </div>
        </div>
      )}

      {/* Main Split: 2D Live Pitch (Left 7 cols) + Live Stats & Play-by-Play Feed (Right 5 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: 2D Match Engine Pitch */}
        <div className="xl:col-span-7 bg-[#14171f] border border-white/[0.07] rounded-[28px] p-4 sm:p-5 flex flex-col justify-between space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 font-bold text-[#b5ff00] whitespace-nowrap">
                <PlayerJersey variant="lime" size="xs" className="!w-5 !h-5" />
                {homeClub.shortName} (→)
              </span>
              <span className="text-zinc-600">·</span>
              <span className="flex items-center gap-1.5 font-bold text-white whitespace-nowrap">
                <PlayerJersey variant="white" size="xs" className="!w-5 !h-5" />
                {awayClub.shortName} (←)
              </span>
            </div>

            <span className="font-mono text-[11px] sm:text-xs text-zinc-400 truncate">
              Posse de bola:{' '}
              <strong className="text-[#b5ff00]">
                #{match.ballCarrierNumber} {match.ballCarrierName}
              </strong>
            </span>
          </div>

          {/* Dark Obsidian & Turf 2D SVG Pitch with 22 Numbered Tokens & Ball */}
          <div
            data-testid="match-pitch-2d"
            className="relative w-full aspect-[16/10] bg-[#101319] rounded-[24px] overflow-hidden border border-white/10 select-none"
          >
            <svg
              viewBox="0 0 1000 625"
              className="w-full h-full block"
              aria-label="Visão 2D da partida ao vivo com 22 jogadores e bola"
            >
              {/* Subtle Dark Turf Stripes */}
              {Array.from({ length: 10 }).map((_, i) => (
                <rect
                  key={i}
                  x={i * 100}
                  y={0}
                  width={100}
                  height={625}
                  fill={i % 2 === 0 ? '#11181c' : '#141e22'}
                />
              ))}

              {/* Active Third Highlight */}
              <rect
                x={
                  match.activeZone === 'DEF_HOME'
                    ? 25
                    : match.activeZone === 'MIDFIELD'
                    ? 340
                    : 665
                }
                y={25}
                width={310}
                height={575}
                fill="rgba(181, 255, 0, 0.05)"
              />

              {/* Pitch Lines */}
              <rect
                x="25"
                y="25"
                width="950"
                height="575"
                rx="16"
                fill="none"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="2"
              />
              <line
                x1="500"
                y1="25"
                x2="500"
                y2="600"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="2"
              />
              <circle
                cx="500"
                cy="312.5"
                r="72"
                fill="none"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="2"
              />
              <circle cx="500" cy="312.5" r="4" fill="#b5ff00" />

              {/* Left Penalty Box & Goal */}
              <rect
                x="25"
                y="145"
                width="145"
                height="335"
                fill="none"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="2"
              />
              <rect
                x="25"
                y="225"
                width="55"
                height="175"
                fill="none"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="2"
              />
              <rect
                x="10"
                y="265"
                width="15"
                height="95"
                fill="rgba(181,255,0,0.15)"
                stroke="#b5ff00"
                strokeWidth="2"
              />

              {/* Right Penalty Box & Goal */}
              <rect
                x="830"
                y="145"
                width="145"
                height="335"
                fill="none"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="2"
              />
              <rect
                x="920"
                y="225"
                width="55"
                height="175"
                fill="none"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="2"
              />
              <rect
                x="975"
                y="265"
                width="15"
                height="95"
                fill="rgba(255,255,255,0.18)"
                stroke="#ffffff"
                strokeWidth="2"
              />

              {/* Away Team 11 Jerseys (Crisp White Shirts) */}
              {match.awayTokens.map((token) => {
                const cx = (token.x / 100) * 950 + 25;
                const cy = (token.y / 100) * 575 + 25;
                return (
                  <PitchJerseySvg
                    key={token.id}
                    cx={cx}
                    cy={cy}
                    number={token.number}
                    ovr={token.ovr}
                    shortName={token.shortName}
                    team="AWAY"
                    hasBall={token.hasBall}
                  />
                );
              })}

              {/* Home Team 11 Jerseys (Electric Lime #b5ff00 Shirts) */}
              {match.homeTokens.map((token) => {
                const cx = (token.x / 100) * 950 + 25;
                const cy = (token.y / 100) * 575 + 25;
                return (
                  <PitchJerseySvg
                    key={token.id}
                    cx={cx}
                    cy={cy}
                    number={token.number}
                    ovr={token.ovr}
                    shortName={token.shortName}
                    team="HOME"
                    hasBall={token.hasBall}
                  />
                );
              })}

              {/* The Ball */}
              <g
                style={{
                  transform: `translate(${
                    (match.ballX / 100) * 950 + 25
                  }px, ${(match.ballY / 100) * 575 + 25}px)`,
                  transition: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                <circle
                  cx="6"
                  cy="-6"
                  r="7"
                  fill="#ffffff"
                  stroke="#090a0f"
                  strokeWidth="2"
                />
                <circle cx="6" cy="-6" r="2.5" fill="#090a0f" />
              </g>
            </svg>
          </div>

          {/* Live Pitch Action Caption Bar */}
          <div className="bg-[#0b0c10] border border-white/[0.07] rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-zinc-100">
              <span className="font-mono font-bold text-[#b5ff00]">
                [{match.minute}&apos;]
              </span>
              <span>{match.lastActionLabel}</span>
            </div>
            <span className="text-[11px] font-mono text-zinc-400 shrink-0 hidden sm:inline">
              22 Jogadores em Campo
            </span>
          </div>
        </div>

        {/* Right: Real-time Stats & Play-by-Play Narration (5 cols) */}
        <div className="xl:col-span-5 space-y-5 flex flex-col">
          {/* Live Telemetry & xG Card */}
          <div className="bg-[#14171f] border border-white/[0.07] rounded-[28px] p-5 space-y-3.5">
            <div className="flex items-center justify-between border-b border-white/[0.07] pb-3">
              <h3 className="font-display text-lg font-extrabold uppercase tracking-tight text-white">
                Estatísticas em Tempo Real
              </h3>
              <span className="text-xs font-mono text-[#b5ff00] font-bold">
                {homeClub.abbr} vs {awayClub.abbr}
              </span>
            </div>

            <div className="space-y-3">
              {renderStatComparisonRow(
                'Posse de Bola (%)',
                `${homePossessionPct}%`,
                `${awayPossessionPct}%`,
                homePossessionPct,
                awayPossessionPct
              )}
              {renderStatComparisonRow(
                'Gols Esperados (xG)',
                match.homeXG.toFixed(2),
                match.awayXG.toFixed(2),
                match.homeXG || 0.1,
                match.awayXG || 0.1
              )}
              {renderStatComparisonRow(
                'Finalizações Totais',
                match.homeShots,
                match.awayShots,
                match.homeShots,
                match.awayShots
              )}
              {renderStatComparisonRow(
                'Chutes no Gol',
                match.homeShotsOnTarget,
                match.awayShotsOnTarget,
                match.homeShotsOnTarget,
                match.awayShotsOnTarget
              )}
              {renderStatComparisonRow(
                'Passes Completos',
                match.homePasses,
                match.awayPasses,
                match.homePasses,
                match.awayPasses
              )}
              {renderStatComparisonRow(
                'Escanteios',
                match.homeCorners,
                match.awayCorners,
                match.homeCorners,
                match.awayCorners
              )}
            </div>
          </div>

          {/* Live Narration Feed */}
          <div className="bg-[#14171f] border border-white/[0.07] rounded-[28px] p-5 flex-1 flex flex-col min-h-[260px]">
            <div className="flex items-center justify-between border-b border-white/[0.07] pb-3 mb-3">
              <h3 className="font-display text-lg font-extrabold uppercase tracking-tight text-white">
                Narração Minuto a Minuto
              </h3>
              <span className="text-[11px] font-mono text-zinc-400">
                {match.events.length} lances
              </span>
            </div>

            <div className="space-y-2 overflow-y-auto max-h-[260px] pr-1">
              {match.events.map((evt) => (
                <div
                  key={evt.id}
                  className={`p-3 rounded-2xl text-xs border transition-colors ${
                    evt.type === 'GOL'
                      ? 'bg-[#b5ff00] border-[#b5ff00] text-[#090a0f] font-bold'
                      : evt.type === 'LESAO'
                      ? 'bg-rose-950/60 border-rose-500/60 text-rose-100 font-bold'
                      : evt.type === 'TRAVE' || evt.type === 'DEFESA'
                      ? 'bg-[#0b0c10] border-white/20 text-white'
                      : evt.type === 'CARTAO_AMARELO'
                      ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                      : evt.type === 'SUBSTITUICAO'
                      ? 'bg-white/[0.06] border-[#b5ff00]/40 text-[#b5ff00]'
                      : 'bg-[#0b0c10]/70 border-white/[0.06] text-zinc-300'
                  }`}
                >
                  {evt.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
