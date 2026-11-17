import React, { useState } from 'react';
import {
  Play,
  Pause,
  FastForward,
  RefreshCw,
  Sliders,
  Trophy,
  ArrowRight,
  UserCheck,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { USER_CLUB_ID } from '../data/initialDatabase';
import {
  Club,
  LiveMatchState,
  MentalityType,
  Player,
  RoundFixture,
} from '../types/football';
import { getConditionColor } from '../utils/formatters';

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
    () => squad.find((p) => p.isStarter && p.condition < 80)?.id || squad.find((p) => p.isStarter)?.id || ''
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

  const handleConfirmSub = () => {
    if (!selectedStarterOutId || !selectedReserveInId) return;
    if (match.substitutionsMade >= match.maxSubstitutions) return;
    onMakeSubstitution(selectedStarterOutId, selectedReserveInId);
    // Pick next candidates
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
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="font-mono tabular-nums font-semibold text-slate-100">
            {homeValue}
          </span>
          <span className="text-slate-400 text-[11px]">{label}</span>
          <span className="font-mono tabular-nums font-semibold text-slate-100">
            {awayValue}
          </span>
        </div>
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${homePct}%`,
              backgroundColor: homeClub.primaryColor,
            }}
          />
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${100 - homePct}%`,
              backgroundColor: awayClub.primaryColor,
            }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Live Scoreboard & Match Controls Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        {/* Scoreboard */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center font-mono font-bold text-xs text-slate-950 shrink-0"
              style={{ backgroundColor: homeClub.primaryColor }}
            >
              {homeClub.abbr}
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-slate-100">
                {homeClub.shortName}
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                xG: {match.homeXG.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-center min-w-[120px]">
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-100 tracking-tight">
              {match.homeGoals} <span className="text-slate-600">:</span>{' '}
              {match.awayGoals}
            </div>
            <div className="text-[11px] font-mono tabular-nums text-emerald-400 font-semibold">
              {match.phase === 'PRE_MATCH'
                ? 'Pré-Jogo (0\')'
                : match.phase === 'HALF_TIME'
                ? 'Intervalo (45\')'
                : match.phase === 'FULL_TIME'
                ? 'Encerrado (90\')'
                : `${match.minute}' min`}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div>
              <div className="text-sm font-bold text-slate-100">
                {awayClub.shortName}
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                xG: {match.awayXG.toFixed(2)}
              </div>
            </div>
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center font-mono font-bold text-xs text-white shrink-0"
              style={{ backgroundColor: awayClub.primaryColor }}
            >
              {awayClub.abbr}
            </div>
          </div>
        </div>

        {/* Speed & Simulation Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {match.phase !== 'FULL_TIME' && (
            <>
              {match.isRunning ? (
                <button
                  onClick={onPause}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Pause className="w-3.5 h-3.5" />
                  Pausar Jogo
                </button>
              ) : (
                <button
                  onClick={onStartOrResume}
                  data-start="true"
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Play className="w-3.5 h-3.5" />
                  {match.phase === 'PRE_MATCH'
                    ? 'Iniciar Partida (Apito Inicial)'
                    : match.phase === 'HALF_TIME'
                    ? 'Iniciar 2º Tempo'
                    : 'Retomar Simulação'}
                </button>
              )}

              {/* 1x, 2x, 4x Speed Selector */}
              <div
                className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-1"
                role="group"
                aria-label="Velocidade da partida"
              >
                {([1, 2, 4] as const).map((spd) => (
                  <button
                    key={spd}
                    onClick={() => onSetSpeed(spd)}
                    className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition-colors ${
                      match.speed === spd
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>

              <button
                onClick={onInstantFinishMatch}
                className="px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-1.5 whitespace-nowrap"
                title="Simular rapidamente até os 90 minutos"
              >
                <FastForward className="w-3.5 h-3.5 text-emerald-400" />
                Simular até 90&apos;
              </button>
            </>
          )}

          {/* Live Mentality & Substitutions Toggle */}
          <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800">
            {(
              ['Cautelosa', 'Equilibrada', 'Ofensiva'] as MentalityType[]
            ).map((ment) => (
              <button
                key={ment}
                onClick={() => onChangeLiveMentality(ment)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  userMentality === ment
                    ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/50'
                    : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                }`}
              >
                {ment}
              </button>
            ))}

            <button
              onClick={() => {
                if (match.isRunning) onPause();
                setShowSubsPanel((prev) => !prev);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                showSubsPanel
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-100'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Substituições ({match.substitutionsMade}/{match.maxSubstitutions})
            </button>
          </div>
        </div>
      </div>

      {/* Full-Time Round Summary & Other 9 Matches Results (Promoted above the fold at 90') */}
      {match.phase === 'FULL_TIME' && (
        <div className="bg-slate-900 border border-emerald-500/50 rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
            <div>
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  Fim de Jogo (90&apos;) — Os outros 9 jogos da {match.roundNumber}ª
                  Rodada foram simulados e a tabela de 20 clubes foi atualizada!
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-100 mt-0.5">
                Placar Final dos 10 Jogos da {match.roundNumber}ª Rodada da Liga Nacional
              </h3>
            </div>

            <button
              onClick={onProceedAfterFullTime}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <Trophy className="w-4 h-4" />
              <span>Ver Tabela Atualizada (20 Clubes)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {roundFixtures
              .filter((f) => f.roundNumber === match.roundNumber)
              .map((fix) => {
                const hClub = clubMap.get(fix.homeClubId);
                const aClub = clubMap.get(fix.awayClubId);
                return (
                  <div
                    key={fix.id}
                    className={`px-3 py-2 rounded-lg border text-xs font-mono tabular-nums ${
                      fix.isUserMatch
                        ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                        : 'bg-slate-950/70 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-sans font-medium truncate max-w-[75px]">
                        {hClub?.shortName}
                      </span>
                      <span className="font-bold text-slate-100 whitespace-nowrap">
                        {fix.homeGoals ?? 0} - {fix.awayGoals ?? 0}
                      </span>
                      <span className="font-sans font-medium truncate max-w-[75px] text-right">
                        {aClub?.shortName}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Collapsible Live Substitution Drawer */}
      {showSubsPanel && (
        <div className="bg-slate-900 border border-emerald-500/40 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-emerald-400 flex items-center gap-2">
              <UserCheck className="w-4 h-4" />
              <span>
                Painel de Substituição Tática ao Vivo ({match.substitutionsMade}
                /{match.maxSubstitutions} utilizadas)
              </span>
            </div>
            <button
              onClick={() => setShowSubsPanel(false)}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Fechar painel
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div>
              <label
                htmlFor="sub-out-select"
                className="block text-xs text-slate-400 mb-1"
              >
                Sai de Campo (Titular em Jogo)
              </label>
              <select
                id="sub-out-select"
                value={selectedStarterOutId}
                onChange={(e) => setSelectedStarterOutId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
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
                className="block text-xs text-slate-400 mb-1"
              >
                Entra em Campo (Banco de Reservas)
              </label>
              <select
                id="sub-in-select"
                value={selectedReserveInId}
                onChange={(e) => setSelectedReserveInId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
              >
                {reserves.map((res) => (
                  <option
                    key={res.id}
                    value={res.id}
                    disabled={res.injured}
                  >
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
              className="py-2 px-4 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white transition-colors"
            >
              Confirmar Substituição Agora
            </button>
          </div>
        </div>
      )}

      {/* Main Split: 2D Live Pitch (Left 7 cols) + Live Stats & Play-by-Play Feed (Right 5 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Left: 2D Match Engine Pitch */}
        <div className="xl:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 font-semibold text-slate-200">
                <span
                  className="w-3 h-3 rounded-full inline-block"
                  style={{ backgroundColor: homeClub.primaryColor }}
                />
                {homeClub.shortName} (Ataca →)
              </span>
              <span className="text-slate-600">|</span>
              <span className="flex items-center gap-1.5 font-semibold text-slate-200">
                <span
                  className="w-3 h-3 rounded-full inline-block"
                  style={{ backgroundColor: awayClub.primaryColor }}
                />
                {awayClub.shortName} (← Ataca)
              </span>
            </div>

            <span className="font-mono text-slate-400">
              Posse atual:{' '}
              <strong className="text-emerald-400">
                #{match.ballCarrierNumber} {match.ballCarrierName}
              </strong>
            </span>
          </div>

          {/* 2D SVG Pitch with 22 Numbered Dots & Coherent Ball Trajectory */}
          <div
            data-testid="match-pitch-2d"
            className="relative w-full aspect-[16/10] bg-emerald-950 rounded-xl overflow-hidden border border-emerald-500/30 select-none"
          >
            <svg
              viewBox="0 0 1000 625"
              className="w-full h-full block"
              aria-label="Visão 2D da partida ao vivo com 22 jogadores e bola"
            >
              {/* Mowed Grass Stripes */}
              {Array.from({ length: 10 }).map((_, i) => (
                <rect
                  key={i}
                  x={i * 100}
                  y={0}
                  width={100}
                  height={625}
                  fill={i % 2 === 0 ? '#064e3b' : '#065f46'}
                  opacity={0.85}
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
                fill="rgba(16, 185, 129, 0.06)"
              />

              {/* Pitch Lines */}
              <rect
                x="25"
                y="25"
                width="950"
                height="575"
                fill="none"
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="2.5"
              />
              <line
                x1="500"
                y1="25"
                x2="500"
                y2="600"
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="2"
              />
              <circle
                cx="500"
                cy="312.5"
                r="72"
                fill="none"
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="2"
              />
              <circle cx="500" cy="312.5" r="4" fill="rgba(255,255,255,0.6)" />

              {/* Left Penalty Box & Goal */}
              <rect
                x="25"
                y="145"
                width="145"
                height="335"
                fill="none"
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="2"
              />
              <rect
                x="25"
                y="225"
                width="55"
                height="175"
                fill="none"
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="2"
              />
              <rect
                x="10"
                y="265"
                width="15"
                height="95"
                fill="rgba(255,255,255,0.18)"
                stroke="rgba(255,255,255,0.6)"
                strokeWidth="2"
              />

              {/* Right Penalty Box & Goal */}
              <rect
                x="830"
                y="145"
                width="145"
                height="335"
                fill="none"
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="2"
              />
              <rect
                x="920"
                y="225"
                width="55"
                height="175"
                fill="none"
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="2"
              />
              <rect
                x="975"
                y="265"
                width="15"
                height="95"
                fill="rgba(255,255,255,0.18)"
                stroke="rgba(255,255,255,0.6)"
                strokeWidth="2"
              />

              {/* Away Team 11 Numbered Dots */}
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
                        stroke="#fbbf24"
                        strokeWidth="2.5"
                        strokeDasharray="4 3"
                      />
                    )}
                    <circle
                      r="14"
                      fill={awayClub.primaryColor}
                      stroke="#0f172a"
                      strokeWidth="2.5"
                    />
                    <text
                      textAnchor="middle"
                      dy="4"
                      fill="#ffffff"
                      fontSize="11"
                      fontFamily="JetBrains Mono, monospace"
                      fontWeight="700"
                    >
                      {token.number}
                    </text>
                    <text
                      textAnchor="middle"
                      dy="26"
                      fill="rgba(241,245,249,0.88)"
                      fontSize="10"
                      fontWeight="600"
                    >
                      {token.shortName}
                    </text>
                  </g>
                );
              })}

              {/* Home Team 11 Numbered Dots */}
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
                        stroke="#fbbf24"
                        strokeWidth="2.5"
                        strokeDasharray="4 3"
                      />
                    )}
                    <circle
                      r="14"
                      fill={homeClub.primaryColor}
                      stroke="#022c22"
                      strokeWidth="2.5"
                    />
                    <text
                      textAnchor="middle"
                      dy="4"
                      fill="#022c22"
                      fontSize="11"
                      fontFamily="JetBrains Mono, monospace"
                      fontWeight="700"
                    >
                      {token.number}
                    </text>
                    <text
                      textAnchor="middle"
                      dy="26"
                      fill="#a7f3d0"
                      fontSize="10"
                      fontWeight="600"
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
                  stroke="#0f172a"
                  strokeWidth="2"
                />
                <circle cx="6" cy="-6" r="2.5" fill="#0f172a" />
              </g>
            </svg>
          </div>

          {/* Live Pitch Action Caption Bar */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-200">
              <span className="font-mono font-bold text-emerald-400">
                [{match.minute}&apos;]
              </span>
              <span>{match.lastActionLabel}</span>
            </div>
            <span className="text-[11px] font-mono text-slate-400 shrink-0">
              22 Jogadores em Campo
            </span>
          </div>
        </div>

        {/* Right: Real-time Stats & Play-by-Play Narration (5 cols) */}
        <div className="xl:col-span-5 space-y-4 flex flex-col">
          {/* Live Telemetry & xG Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h3 className="text-xs font-semibold text-slate-100">
                Estatísticas em Tempo Real
              </h3>
              <span className="text-[11px] font-mono text-slate-400">
                {homeClub.abbr} vs {awayClub.abbr}
              </span>
            </div>

            <div className="space-y-2.5">
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
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex-1 flex flex-col min-h-[250px]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
              <h3 className="text-xs font-semibold text-slate-100">
                Narração Minuto a Minuto
              </h3>
              <span className="text-[11px] font-mono text-slate-400">
                {match.events.length} eventos registrados
              </span>
            </div>

            <div className="space-y-2 overflow-y-auto max-h-[250px] pr-1">
              {match.events.map((evt) => (
                <div
                  key={evt.id}
                  className={`p-2.5 rounded-lg text-xs border transition-colors ${
                    evt.type === 'GOL'
                      ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-100 font-semibold'
                      : evt.type === 'TRAVE' || evt.type === 'DEFESA'
                      ? 'bg-slate-950/80 border-amber-500/30 text-slate-200'
                      : evt.type === 'CARTAO_AMARELO'
                      ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                      : evt.type === 'SUBSTITUICAO'
                      ? 'bg-sky-950/40 border-sky-500/40 text-sky-200'
                      : 'bg-slate-950/50 border-slate-800/80 text-slate-300'
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
