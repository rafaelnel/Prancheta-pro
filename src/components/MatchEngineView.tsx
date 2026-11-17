import React, { useState } from 'react';
import {
  Play,
  Pause,
  FastForward,
  RefreshCw,
  Trophy,
  ArrowRight,
  UserCheck,
  CheckCircle2,
  Eye,
} from 'lucide-react';
import {
  Club,
  LiveMatchState,
  MentalityType,
  Player,
  RoundFixture,
} from '../types/football';

interface MatchEngineViewProps {
  match: LiveMatchState;
  homeClub: Club;
  awayClub: Club;
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
}

export const MatchEngineView: React.FC<MatchEngineViewProps> = ({
  match,
  homeClub,
  awayClub,
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
}) => {
  const [showSubsPanel, setShowSubsPanel] = useState(false);
  const [selectedStarterOutId, setSelectedStarterOutId] = useState<string>(
    () =>
      squad.find((p) => p.isStarter && p.condition < 80)?.id ||
      squad.find((p) => p.isStarter)?.id ||
      ''
  );
  const [selectedReserveInId, setSelectedReserveInId] = useState<string>(
    () => squad.find((p) => !p.isStarter && !p.injured)?.id || ''
  );

  const starters = squad.filter((p) => p.isStarter);
  const reserves = squad.filter((p) => !p.isStarter);
  const clubMap = new Map(clubs.map((c) => [c.id, c]));

  const totalPossessionTicks =
    match.homePossessionTicks + match.awayPossessionTicks;
  const homePossessionPct = Math.round(
    (match.homePossessionTicks / Math.max(1, totalPossessionTicks)) * 100
  );
  const awayPossessionPct = 100 - homePossessionPct;

  // Compute live win/draw/loss probability strip (Reference Screen 2 motif)
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

  const handleConfirmSub = () => {
    if (!selectedStarterOutId || !selectedReserveInId) return;
    if (match.substitutionsMade >= match.maxSubstitutions) return;
    onMakeSubstitution(selectedStarterOutId, selectedReserveInId);
    const remainingStarters = squad.filter(
      (p) => p.isStarter && p.id !== selectedStarterOutId
    );
    const remainingReserves = squad.filter(
      (p) => !p.isStarter && p.id !== selectedReserveInId && !p.injured
    );
    if (remainingStarters[0]) setSelectedStarterOutId(remainingStarters[0].id);
    if (remainingReserves[0]) setSelectedReserveInId(remainingReserves[0].id);
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
      {/* Reference Screen 2 Inspired Live Scoreboard Hero Banner */}
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
                  <span>Simular até 90&apos;</span>
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

        {/* Center Scoreboard Lockup (Exact Reference Screen 2 Typography: Giant Condensed Score 1:2) */}
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
            <div
              className="order-1 sm:order-2 w-11 h-11 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center font-display font-extrabold text-base sm:text-xl text-[#090a0f] shrink-0 shadow-lg"
              style={{ backgroundColor: '#b5ff00' }}
            >
              {homeClub.abbr}
            </div>
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
            <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center font-display font-extrabold text-base sm:text-xl text-[#090a0f] bg-white shrink-0 shadow-lg">
              {awayClub.abbr}
            </div>
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

          {/* Reference Screen 2 3-Tile Live Win Probability */}
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
              <span>Continuar e Ver Competições</span>
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

      {/* Collapsible Live Substitution Drawer */}
      {showSubsPanel && (
        <div className="bg-[#14171f] border border-[#b5ff00]/40 rounded-[24px] p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-[#b5ff00] flex items-center gap-2">
              <UserCheck className="w-4 h-4" />
              <span>
                Painel de Substituição Tática ao Vivo ({match.substitutionsMade}
                /{match.maxSubstitutions} utilizadas)
              </span>
            </div>
            <button
              onClick={() => setShowSubsPanel(false)}
              className="text-xs text-zinc-400 hover:text-white"
            >
              Fechar painel
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div>
              <label
                htmlFor="sub-out-select"
                className="block text-xs text-zinc-400 mb-1"
              >
                Sai de Campo (Titular em Jogo)
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
                  return (
                    <option key={st.id} value={st.id}>
                      #{st.number} {st.name} ({st.position}) — Condição:{' '}
                      {liveCond}%
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
                Entra em Campo (Banco de Reservas)
              </label>
              <select
                id="sub-in-select"
                value={selectedReserveInId}
                onChange={(e) => setSelectedReserveInId(e.target.value)}
                className="w-full bg-[#0b0c10] border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
              >
                {reserves.map((res) => (
                  <option key={res.id} value={res.id} disabled={res.injured}>
                    #{res.number} {res.name} ({res.position}) — Condição:{' '}
                    {Math.round(res.condition)}%{' '}
                    {res.injured ? '[Transição]' : ''}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleConfirmSub}
              disabled={match.substitutionsMade >= match.maxSubstitutions}
              className="py-2.5 px-4 rounded-full text-xs font-extrabold bg-[#b5ff00] hover:bg-[#c8ff33] disabled:bg-zinc-800 disabled:text-zinc-500 text-[#090a0f] transition-colors"
            >
              Confirmar Substituição Agora
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
                <span className="w-2.5 h-2.5 rounded-full bg-[#b5ff00] inline-block shrink-0" />
                {homeClub.shortName} (→)
              </span>
              <span className="text-zinc-600">·</span>
              <span className="flex items-center gap-1.5 font-bold text-white whitespace-nowrap">
                <span className="w-2.5 h-2.5 rounded-full bg-white inline-block shrink-0" />
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

              {/* Away Team 11 Numbered Dots (Crisp White Tokens) */}
              {match.awayTokens.map((token) => {
                const cx = (token.x / 100) * 950 + 25;
                const cy = (token.y / 100) * 575 + 25;
                return (
                  <g
                    key={token.id}
                    style={{
                      transform: `translate(${cx}px, ${cy}px)`,
                      transition: 'transform 220ms linear',
                    }}
                  >
                    {token.hasBall && (
                      <circle
                        r="21"
                        fill="none"
                        stroke="#b5ff00"
                        strokeWidth="2.5"
                        strokeDasharray="4 3"
                      />
                    )}
                    <circle
                      r="14"
                      fill="#ffffff"
                      stroke="#090a0f"
                      strokeWidth="2.5"
                    />
                    <text
                      textAnchor="middle"
                      dy="4"
                      fill="#090a0f"
                      fontSize="11"
                      fontFamily="JetBrains Mono, monospace"
                      fontWeight="800"
                    >
                      {token.number}
                    </text>
                    <text
                      textAnchor="middle"
                      dy="26"
                      fill="rgba(255,255,255,0.88)"
                      fontSize="10"
                      fontWeight="600"
                    >
                      {token.shortName}
                    </text>
                  </g>
                );
              })}

              {/* Home Team 11 Numbered Dots (Electric Lime #b5ff00 Tokens) */}
              {match.homeTokens.map((token) => {
                const cx = (token.x / 100) * 950 + 25;
                const cy = (token.y / 100) * 575 + 25;
                return (
                  <g
                    key={token.id}
                    style={{
                      transform: `translate(${cx}px, ${cy}px)`,
                      transition: 'transform 220ms linear',
                    }}
                  >
                    {token.hasBall && (
                      <circle
                        r="21"
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth="2.5"
                        strokeDasharray="4 3"
                      />
                    )}
                    <circle
                      r="14"
                      fill="#b5ff00"
                      stroke="#090a0f"
                      strokeWidth="2.5"
                    />
                    <text
                      textAnchor="middle"
                      dy="4"
                      fill="#090a0f"
                      fontSize="11"
                      fontFamily="JetBrains Mono, monospace"
                      fontWeight="800"
                    >
                      {token.number}
                    </text>
                    <text
                      textAnchor="middle"
                      dy="26"
                      fill="#b5ff00"
                      fontSize="10"
                      fontWeight="700"
                    >
                      {token.shortName}
                    </text>
                  </g>
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
