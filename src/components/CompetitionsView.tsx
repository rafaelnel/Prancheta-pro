import React, { useEffect, useState } from 'react';
import {
  Trophy,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Globe2,
  Award,
  Shield,
} from 'lucide-react';
import {
  USER_CLUB_ID,
  generateLeagueSchedule,
  getInitialStandingsForDivision,
} from '../data/initialDatabase';
import {
  COPA_DO_BRASIL_STAGES,
  LIBERTADORES_KNOCKOUT_STAGES,
} from '../data/cupFactory';
import {
  Club,
  CompetitionType,
  CopaDoBrasilStage,
  CopaDoBrasilState,
  LibertadoresGroupName,
  LibertadoresKnockoutStage,
  LibertadoresState,
  RoundFixture,
  StandingsRow,
} from '../types/football';
import { getContrastTextColor } from '../utils/formatters';

type CompTab = 'A' | 'B' | 'COPA_DO_BRASIL' | 'LIBERTADORES';

interface CompetitionsViewProps {
  standings: StandingsRow[];
  clubs: Club[];
  fixtures: RoundFixture[];
  currentRound: number;
  userClubId?: string;
  userDivision?: 'A' | 'B';
  secondaryStandings?: StandingsRow[];
  secondaryFixtures?: RoundFixture[];
  copaDoBrasil?: CopaDoBrasilState;
  libertadores?: LibertadoresState;
  activeCompetition?: CompetitionType;
}

export const CompetitionsView: React.FC<CompetitionsViewProps> = ({
  standings,
  clubs,
  fixtures,
  currentRound,
  userClubId = USER_CLUB_ID,
  userDivision = 'A',
  secondaryStandings,
  secondaryFixtures,
  copaDoBrasil,
  libertadores,
  activeCompetition = 'BRASILEIRAO',
}) => {
  const defaultTab: CompTab =
    activeCompetition === 'COPA_DO_BRASIL'
      ? 'COPA_DO_BRASIL'
      : activeCompetition === 'LIBERTADORES'
      ? 'LIBERTADORES'
      : userDivision;

  const [viewedTab, setViewedTab] = useState<CompTab>(defaultTab);
  const [selectedRound, setSelectedRound] = useState<number>(currentRound);
  const [zoneFilter, setZoneFilter] = useState<'ALL' | 'TOP4' | 'MID' | 'Z4'>(
    'ALL'
  );

  // Copa do Brasil UI state
  const [cdbStage, setCdbStage] = useState<CopaDoBrasilStage>(
    copaDoBrasil?.currentStage || '3ª Fase'
  );

  // Libertadores UI state
  const userLibGroup = libertadores?.groups.find((g) =>
    g.clubIds.includes(userClubId)
  );
  const [libSubView, setLibSubView] = useState<'GRUPOS' | 'MATA_MATA'>(
    libertadores && libertadores.currentPhase !== 'Grupos'
      ? 'MATA_MATA'
      : 'GRUPOS'
  );
  const [selectedGroupName, setSelectedGroupName] =
    useState<LibertadoresGroupName>(userLibGroup?.name || 'A');
  const [selectedLibGroupRound, setSelectedLibGroupRound] = useState<number>(
    libertadores?.groupRound || 1
  );
  const [libKnockoutStage, setLibKnockoutStage] =
    useState<LibertadoresKnockoutStage>(
      libertadores && libertadores.currentPhase !== 'Grupos'
        ? libertadores.currentPhase
        : 'Oitavas'
    );

  useEffect(() => {
    setViewedTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    setSelectedRound(currentRound);
  }, [currentRound]);

  useEffect(() => {
    if (copaDoBrasil?.currentStage) {
      setCdbStage(copaDoBrasil.currentStage);
    }
  }, [copaDoBrasil?.currentStage]);

  useEffect(() => {
    if (libertadores) {
      setSelectedLibGroupRound(libertadores.groupRound);
      if (libertadores.currentPhase !== 'Grupos') {
        setLibKnockoutStage(libertadores.currentPhase);
        setLibSubView('MATA_MATA');
      }
    }
  }, [libertadores]);

  const clubMap = new Map(clubs.map((c) => [c.id, c]));

  const viewedDivision: 'A' | 'B' =
    viewedTab === 'B' ? 'B' : 'A';
  const isViewingUserDivision = viewedDivision === userDivision;
  const activeStandings = isViewingUserDivision
    ? standings
    : secondaryStandings && secondaryStandings.length > 0
    ? secondaryStandings
    : getInitialStandingsForDivision(viewedDivision);
  const activeFixtures = isViewingUserDivision
    ? fixtures
    : secondaryFixtures && secondaryFixtures.length > 0
    ? secondaryFixtures
    : generateLeagueSchedule('__none__', viewedDivision);

  const roundMatches = activeFixtures.filter(
    (f) => f.roundNumber === selectedRound
  );

  const filteredStandings = activeStandings
    .map((row, idx) => ({ row, pos: idx + 1 }))
    .filter(({ pos }) => {
      if (zoneFilter === 'TOP4') return pos <= 4;
      if (zoneFilter === 'MID') return pos >= 5 && pos <= 12;
      if (zoneFilter === 'Z4') return pos >= 17;
      return true;
    });

  const renderKnockoutMatchCard = (fix: RoundFixture) => {
    const home = clubMap.get(fix.homeClubId);
    const away = clubMap.get(fix.awayClubId);
    const isUser = fix.homeClubId === userClubId || fix.awayClubId === userClubId;
    const hasPenalties =
      fix.homePenalties !== null &&
      fix.homePenalties !== undefined &&
      fix.awayPenalties !== null &&
      fix.awayPenalties !== undefined;
    const winner = fix.winnerClubId ? clubMap.get(fix.winnerClubId) : null;

    return (
      <div
        key={fix.id}
        className={`rounded-2xl p-4 border transition-colors ${
          isUser
            ? 'bg-gradient-to-r from-[#b5ff00] to-[#98db00] text-[#090a0f] border-[#b5ff00] shadow-md'
            : 'bg-[#0b0c10] border-white/[0.07] text-zinc-200'
        }`}
      >
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center font-display font-extrabold text-[10px] shrink-0 border border-white/15"
              style={{
                backgroundColor: home?.primaryColor || '#27272a',
                color: getContrastTextColor(home?.primaryColor || '#27272a'),
              }}
            >
              {home?.abbr || 'HOM'}
            </div>
            <div className="min-w-0">
              <div className="font-bold truncate">
                {home?.shortName || fix.homeClubId}
              </div>
              <div
                className={`text-[10px] font-mono ${
                  isUser ? 'text-[#090a0f]/75' : 'text-zinc-500'
                }`}
              >
                {home?.countryCode || (home?.division ? `Série ${home.division}` : 'BRA')}
              </div>
            </div>
          </div>

          <div className="shrink-0 text-center px-2">
            <div
              className={`font-mono tabular-nums font-extrabold px-2.5 py-1 rounded-full text-xs ${
                isUser
                  ? 'bg-[#090a0f] text-white'
                  : 'bg-white/[0.08] text-white'
              }`}
            >
              {fix.played ? `${fix.homeGoals} : ${fix.awayGoals}` : 'VS'}
            </div>
            {hasPenalties && (
              <div
                className={`text-[10px] font-mono font-bold mt-1 ${
                  isUser ? 'text-[#090a0f]' : 'text-[#b5ff00]'
                }`}
              >
                Pen: {fix.homePenalties}–{fix.awayPenalties}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 min-w-0 flex-1 text-right">
            <div className="min-w-0">
              <div className="font-bold truncate">
                {away?.shortName || fix.awayClubId}
              </div>
              <div
                className={`text-[10px] font-mono ${
                  isUser ? 'text-[#090a0f]/75' : 'text-zinc-500'
                }`}
              >
                {away?.countryCode || (away?.division ? `Série ${away.division}` : 'BRA')}
              </div>
            </div>
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center font-display font-extrabold text-[10px] shrink-0 border border-white/15"
              style={{
                backgroundColor: away?.primaryColor || '#27272a',
                color: getContrastTextColor(away?.primaryColor || '#27272a'),
              }}
            >
              {away?.abbr || 'AWY'}
            </div>
          </div>
        </div>

        <div
          className={`flex items-center justify-between text-[10px] mt-2.5 pt-2 border-t font-mono ${
            isUser
              ? 'border-[#090a0f]/15 text-[#090a0f]/80 font-semibold'
              : 'border-white/[0.06] text-zinc-400'
          }`}
        >
          <span className="truncate">{home?.stadium || 'Estádio'}</span>
          <span>
            {winner
              ? `Avança: ${winner.shortName}`
              : fix.stageLabel || 'Jogo Único'}
          </span>
        </div>
      </div>
    );
  };

  const userParticipatesLib =
    libertadores?.participantIds.includes(userClubId) ?? false;
  const userParticipatesCdb =
    copaDoBrasil?.participantIds.includes(userClubId) ?? false;

  const headerTitle =
    viewedTab === 'COPA_DO_BRASIL'
      ? 'COPA DO BRASIL'
      : viewedTab === 'LIBERTADORES'
      ? 'LIBERTADORES'
      : `SÉRIE ${viewedDivision}`;

  const headerSubtitle =
    viewedTab === 'COPA_DO_BRASIL'
      ? 'Copa do Brasil 2026 · 32 Clubes (Série A & B)'
      : viewedTab === 'LIBERTADORES'
      ? 'Copa Libertadores 2026 · 32 Clubes · 10 Países CONMEBOL'
      : 'Brasileirão 2026';

  return (
    <div className="space-y-5">
      {/* Header + 4 Competition Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-2 border-b border-white/[0.07]">
        <div>
          <span className="block text-xs sm:text-sm font-normal text-zinc-400 tracking-wide">
            {headerSubtitle}
          </span>
          <h2 className="font-display text-3xl sm:text-5xl font-extrabold uppercase tracking-tight text-white leading-[0.95] mt-0.5">
            {headerTitle}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Competition Selector */}
          <div className="flex flex-wrap items-center gap-1 bg-[#14171f] p-1 rounded-full border border-white/[0.08]">
            {(
              [
                { id: 'A', label: `Série A ${userDivision === 'A' ? '★' : ''}` },
                { id: 'B', label: `Série B ${userDivision === 'B' ? '★' : ''}` },
                {
                  id: 'COPA_DO_BRASIL',
                  label: `Copa do Brasil ${userParticipatesCdb ? '★' : ''}`,
                },
                {
                  id: 'LIBERTADORES',
                  label: `Libertadores ${userParticipatesLib ? '★' : ''}`,
                },
              ] as Array<{ id: CompTab; label: string }>
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setViewedTab(tab.id);
                  setZoneFilter('ALL');
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold transition-colors whitespace-nowrap ${
                  viewedTab === tab.id
                    ? 'bg-[#b5ff00] text-[#090a0f]'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {tab.label.trim()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* VIEW: SÉRIE A or SÉRIE B */}
      {(viewedTab === 'A' || viewedTab === 'B') && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'ALL', label: 'Todos (20)' },
                {
                  id: 'TOP4',
                  label:
                    viewedDivision === 'A' ? 'G-4 Libertadores' : 'G-4 Acesso',
                },
                ...(viewedDivision === 'A'
                  ? [{ id: 'MID' as const, label: 'Sul-Americana' }]
                  : []),
                { id: 'Z4', label: 'Zona Z-4' },
              ] as const
            ).map((pill) => (
              <button
                key={pill.id}
                onClick={() => setZoneFilter(pill.id)}
                className={`px-3.5 py-2 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${
                  zoneFilter === pill.id
                    ? 'bg-white text-[#090a0f] shadow-sm'
                    : 'bg-[#151821] text-zinc-400 hover:text-white border border-white/[0.07]'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Left: Complete 20-Club Standings Table (8 cols) */}
            <div className="xl:col-span-8 bg-[#14171f] border border-white/[0.07] rounded-[28px] overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-white/[0.07]">
                <div className="flex items-center gap-2.5">
                  <Trophy className="w-4 h-4 text-[#b5ff00]" />
                  <h3 className="font-display text-xl font-extrabold uppercase tracking-tight text-white">
                    Classificação — Série {viewedDivision}
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-[11px] text-zinc-400">
                  <span className="text-[#b5ff00] font-semibold">
                    {viewedDivision === 'A'
                      ? '■ 1º–4º Libertadores'
                      : '■ 1º–4º Acesso à Série A'}
                  </span>
                  {viewedDivision === 'A' && (
                    <span className="text-white font-semibold">
                      ■ 5º–8º Sul-Americana
                    </span>
                  )}
                  <span className="text-rose-400 font-semibold">
                    {viewedDivision === 'A'
                      ? '■ 17º–20º Rebaixamento'
                      : '■ 17º–20º Série C'}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.07] bg-[#0b0c10]/60 text-[11px] text-zinc-400">
                      <th className="py-3 px-3 font-medium">Pos</th>
                      <th className="py-3 px-3 font-medium">Clube</th>
                      <th className="py-3 px-2.5 font-medium text-right">P</th>
                      <th className="py-3 px-2.5 font-medium text-right">J</th>
                      <th className="py-3 px-2.5 font-medium text-right">V</th>
                      <th className="py-3 px-2.5 font-medium text-right">E</th>
                      <th className="py-3 px-2.5 font-medium text-right">D</th>
                      <th className="py-3 px-2.5 font-medium text-right">GP</th>
                      <th className="py-3 px-2.5 font-medium text-right">GC</th>
                      <th className="py-3 px-2.5 font-medium text-right">SG</th>
                      <th className="py-3 px-2.5 font-medium text-right">%</th>
                      <th className="py-3 px-3 font-medium text-right">
                        Últimos 5
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05] font-mono tabular-nums">
                    {filteredStandings.map(({ row, pos }) => {
                      const club = clubMap.get(row.clubId);
                      const isUser = row.clubId === userClubId;
                      const pct =
                        row.played > 0
                          ? Math.round((row.points / (row.played * 3)) * 100)
                          : 0;

                      const posColor =
                        pos <= 4
                          ? 'text-[#b5ff00] font-bold'
                          : viewedDivision === 'A' && pos <= 8
                          ? 'text-white font-semibold'
                          : pos >= 17
                          ? 'text-rose-400 font-semibold'
                          : 'text-zinc-400';

                      return (
                        <tr
                          key={row.clubId}
                          className={
                            isUser
                              ? 'bg-[#b5ff00]/12 text-[#b5ff00] font-semibold'
                              : 'hover:bg-white/[0.03] text-zinc-300'
                          }
                        >
                          <td className={`py-2.5 px-3 ${posColor}`}>{pos}º</td>
                          <td className="py-2.5 px-3 font-sans">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/15"
                                style={{
                                  backgroundColor:
                                    club?.primaryColor || '#b5ff00',
                                }}
                              />
                              <span className="truncate max-w-[180px] text-white font-medium">
                                {club?.name || row.clubId}
                              </span>
                              <span className="text-[10px] text-zinc-500 font-mono">
                                {club?.state}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-2.5 text-right font-bold text-white">
                            {row.points}
                          </td>
                          <td className="py-2.5 px-2.5 text-right text-zinc-400">
                            {row.played}
                          </td>
                          <td className="py-2.5 px-2.5 text-right text-zinc-300">
                            {row.won}
                          </td>
                          <td className="py-2.5 px-2.5 text-right text-zinc-400">
                            {row.drawn}
                          </td>
                          <td className="py-2.5 px-2.5 text-right text-zinc-400">
                            {row.lost}
                          </td>
                          <td className="py-2.5 px-2.5 text-right text-zinc-300">
                            {row.goalsFor}
                          </td>
                          <td className="py-2.5 px-2.5 text-right text-zinc-400">
                            {row.goalsAgainst}
                          </td>
                          <td
                            className={`py-2.5 px-2.5 text-right font-semibold ${
                              row.goalDifference > 0
                                ? 'text-[#b5ff00]'
                                : row.goalDifference < 0
                                ? 'text-rose-400'
                                : 'text-zinc-400'
                            }`}
                          >
                            {row.goalDifference > 0
                              ? `+${row.goalDifference}`
                              : row.goalDifference}
                          </td>
                          <td className="py-2.5 px-2.5 text-right text-zinc-400">
                            {pct}%
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              {row.form.map((res, fIdx) => (
                                <span
                                  key={fIdx}
                                  className={`text-[10px] font-bold ${
                                    res === 'V'
                                      ? 'text-[#b5ff00]'
                                      : res === 'E'
                                      ? 'text-amber-400'
                                      : 'text-rose-400'
                                  }`}
                                >
                                  {res}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: Round Fixtures & Results Browser (4 cols) */}
            <div className="xl:col-span-4 bg-[#14171f] border border-white/[0.07] rounded-[28px] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#b5ff00]" />
                  <h3 className="font-display text-xl font-extrabold uppercase tracking-tight text-white">
                    {selectedRound}ª Rodada · Série {viewedDivision}
                  </h3>
                </div>

                <div className="flex items-center gap-1 bg-[#0b0c10] p-1 rounded-full border border-white/[0.07]">
                  <button
                    onClick={() => setSelectedRound((r) => Math.max(1, r - 1))}
                    disabled={selectedRound <= 1}
                    aria-label="Rodada anterior"
                    className="p-1.5 rounded-full hover:bg-white/10 disabled:opacity-40 text-white transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs font-mono font-bold px-2.5 text-[#b5ff00]">
                    R{selectedRound}
                  </span>
                  <button
                    onClick={() => setSelectedRound((r) => Math.min(19, r + 1))}
                    disabled={selectedRound >= 19}
                    aria-label="Próxima rodada"
                    className="p-1.5 rounded-full hover:bg-white/10 disabled:opacity-40 text-white transition-colors"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-2.5">
                {roundMatches.map((fix) => {
                  const home = clubMap.get(fix.homeClubId);
                  const away = clubMap.get(fix.awayClubId);

                  return (
                    <div
                      key={fix.id}
                      className={`rounded-2xl p-3.5 transition-colors ${
                        fix.isUserMatch
                          ? 'bg-gradient-to-r from-[#b5ff00] to-[#98db00] text-[#090a0f] shadow-md'
                          : 'bg-[#0b0c10] border border-white/[0.06] text-zinc-200'
                      }`}
                    >
                      <div className="grid grid-cols-7 items-center text-xs">
                        <div className="col-span-3 font-bold truncate">
                          {home?.shortName}
                        </div>
                        <div
                          className={`col-span-1 text-center font-mono tabular-nums font-extrabold py-0.5 rounded-full text-[11px] ${
                            fix.isUserMatch
                              ? 'bg-[#090a0f] text-white'
                              : 'bg-white/[0.08] text-white'
                          }`}
                        >
                          {fix.played
                            ? `${fix.homeGoals}:${fix.awayGoals}`
                            : 'VS'}
                        </div>
                        <div className="col-span-3 font-bold text-right truncate">
                          {away?.shortName}
                        </div>
                      </div>
                      <div
                        className={`flex items-center justify-between text-[10px] mt-1.5 font-mono ${
                          fix.isUserMatch
                            ? 'text-[#090a0f]/75 font-semibold'
                            : 'text-zinc-400'
                        }`}
                      >
                        <span className="truncate">{home?.stadium}</span>
                        <span>
                          {fix.played &&
                          fix.homeXG !== undefined &&
                          fix.awayXG !== undefined
                            ? `xG: ${fix.homeXG.toFixed(2)} - ${fix.awayXG.toFixed(2)}`
                            : '16:00'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: COPA DO BRASIL 2026 */}
      {viewedTab === 'COPA_DO_BRASIL' && copaDoBrasil && (
        <div className="space-y-5">
          {/* Status / Champion Banner */}
          <div className="bg-[#14171f] border border-white/[0.08] rounded-[28px] p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#b5ff00] text-[#090a0f] flex items-center justify-center shrink-0">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-zinc-400 font-mono uppercase">
                  Fase Atual: {copaDoBrasil.currentStage}
                </div>
                <div className="font-display text-2xl font-extrabold uppercase text-white">
                  {copaDoBrasil.championClubId
                    ? `Campeão: ${clubMap.get(copaDoBrasil.championClubId)?.name}`
                    : copaDoBrasil.eliminatedIds.includes(userClubId)
                    ? `${clubMap.get(userClubId)?.shortName} eliminado do torneio`
                    : `${clubMap.get(userClubId)?.shortName} vivo na disputa`}
                </div>
              </div>
            </div>

            {/* Stage Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {COPA_DO_BRASIL_STAGES.map((stage) => {
                const count = copaDoBrasil.fixturesByStage[stage]?.length || 0;
                return (
                  <button
                    key={stage}
                    onClick={() => setCdbStage(stage)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${
                      cdbStage === stage
                        ? 'bg-[#b5ff00] text-[#090a0f]'
                        : count > 0
                        ? 'bg-[#0b0c10] text-zinc-200 border border-white/10 hover:border-white/25'
                        : 'bg-[#0b0c10]/60 text-zinc-500 border border-white/[0.05]'
                    }`}
                  >
                    {stage} {count > 0 ? `(${count})` : ''}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stage Fixtures Grid */}
          <div className="bg-[#14171f] border border-white/[0.07] rounded-[28px] p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.07] pb-3">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-[#b5ff00]" />
                <h3 className="font-display text-xl font-extrabold uppercase tracking-tight text-white">
                  Chaveamento — {cdbStage}
                </h3>
              </div>
              <span className="text-xs font-mono text-zinc-400">
                Jogo único · Empate vai aos pênaltis
              </span>
            </div>

            {(copaDoBrasil.fixturesByStage[cdbStage]?.length || 0) > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                {copaDoBrasil.fixturesByStage[cdbStage].map((fix) =>
                  renderKnockoutMatchCard(fix)
                )}
              </div>
            ) : (
              <div className="py-12 text-center text-sm text-zinc-400">
                Os confrontos desta fase serão sorteados automaticamente após a
                conclusão da etapa anterior.
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW: COPA LIBERTADORES 2026 */}
      {viewedTab === 'LIBERTADORES' && libertadores && (
        <div className="space-y-5">
          {/* Top Sub-Navigation Bar */}
          <div className="bg-[#14171f] border border-white/[0.08] rounded-[28px] p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#b5ff00] text-[#090a0f] flex items-center justify-center shrink-0">
                <Globe2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-zinc-400 font-mono uppercase">
                  Fase Atual:{' '}
                  {libertadores.currentPhase === 'Grupos'
                    ? `Fase de Grupos · ${libertadores.groupRound}ª Rodada`
                    : libertadores.currentPhase}
                </div>
                <div className="font-display text-2xl font-extrabold uppercase text-white">
                  {libertadores.championClubId
                    ? `Campeão da América: ${clubMap.get(libertadores.championClubId)?.name}`
                    : userParticipatesLib
                    ? libertadores.eliminatedIds.includes(userClubId)
                      ? `${clubMap.get(userClubId)?.shortName} eliminado`
                      : `${clubMap.get(userClubId)?.shortName} · Grupo ${userLibGroup?.name || ''}`
                    : '32 Clubes · Todos os 10 Países da CONMEBOL'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 bg-[#0b0c10] p-1 rounded-full border border-white/[0.08]">
              <button
                onClick={() => setLibSubView('GRUPOS')}
                className={`px-4 py-1.5 rounded-full text-xs font-extrabold transition-colors ${
                  libSubView === 'GRUPOS'
                    ? 'bg-[#b5ff00] text-[#090a0f]'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Fase de Grupos (A–H)
              </button>
              <button
                onClick={() => setLibSubView('MATA_MATA')}
                className={`px-4 py-1.5 rounded-full text-xs font-extrabold transition-colors ${
                  libSubView === 'MATA_MATA'
                    ? 'bg-[#b5ff00] text-[#090a0f]'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Mata-Mata (Oitavas → Final)
              </button>
            </div>
          </div>

          {/* SUB-VIEW: FASE DE GRUPOS (ALL 8 GROUPS + ROUND FIXTURES) */}
          {libSubView === 'GRUPOS' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              {/* Left 8 Cols: All 8 Groups Grid */}
              <div className="xl:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                {libertadores.groups.map((grp) => {
                  const isSelected = grp.name === selectedGroupName;
                  const hasUser = grp.clubIds.includes(userClubId);

                  return (
                    <div
                      key={grp.name}
                      onClick={() => setSelectedGroupName(grp.name)}
                      className={`cursor-pointer rounded-[24px] border overflow-hidden transition-all ${
                        isSelected
                          ? 'bg-[#14171f] border-[#b5ff00] shadow-lg'
                          : 'bg-[#14171f] border-white/[0.07] hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07] bg-[#0b0c10]/50">
                        <div className="flex items-center gap-2">
                          <span className="font-display text-lg font-extrabold uppercase text-white">
                            Grupo {grp.name}
                          </span>
                          {hasUser && (
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#b5ff00] text-[#090a0f]">
                              Seu Clube
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-zinc-400">
                          1º–2º Oitavas
                        </span>
                      </div>

                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-white/[0.05] text-[10px] text-zinc-400">
                            <th className="py-2 px-3">#</th>
                            <th className="py-2 px-2">Clube</th>
                            <th className="py-2 px-2 text-right">P</th>
                            <th className="py-2 px-2 text-right">J</th>
                            <th className="py-2 px-3 text-right">SG</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04] font-mono tabular-nums">
                          {grp.standings.map((row, idx) => {
                            const c = clubMap.get(row.clubId);
                            const isUser = row.clubId === userClubId;
                            return (
                              <tr
                                key={row.clubId}
                                className={
                                  isUser
                                    ? 'bg-[#b5ff00]/12 text-[#b5ff00] font-bold'
                                    : 'text-zinc-200'
                                }
                              >
                                <td
                                  className={`py-2 px-3 font-bold ${
                                    idx < 2 ? 'text-[#b5ff00]' : 'text-zinc-500'
                                  }`}
                                >
                                  {idx + 1}º
                                </td>
                                <td className="py-2 px-2 font-sans">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span
                                      className="w-2 h-2 rounded-full shrink-0"
                                      style={{
                                        backgroundColor:
                                          c?.primaryColor || '#b5ff00',
                                      }}
                                    />
                                    <span className="truncate max-w-[125px] text-white font-medium">
                                      {c?.shortName || row.clubId}
                                    </span>
                                    <span className="text-[9px] font-mono text-zinc-500 shrink-0">
                                      {c?.countryCode || 'BRA'}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-2 px-2 text-right font-bold text-white">
                                  {row.points}
                                </td>
                                <td className="py-2 px-2 text-right text-zinc-400">
                                  {row.played}
                                </td>
                                <td className="py-2 px-3 text-right text-zinc-300">
                                  {row.goalDifference > 0
                                    ? `+${row.goalDifference}`
                                    : row.goalDifference}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>

              {/* Right 4 Cols: Selected Group Fixtures Browser */}
              <div className="xl:col-span-4 bg-[#14171f] border border-white/[0.07] rounded-[28px] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#b5ff00]" />
                    <h3 className="font-display text-xl font-extrabold uppercase tracking-tight text-white">
                      Grupo {selectedGroupName} · {selectedLibGroupRound}ªR
                    </h3>
                  </div>

                  <div className="flex items-center gap-1 bg-[#0b0c10] p-1 rounded-full border border-white/[0.07]">
                    <button
                      onClick={() =>
                        setSelectedLibGroupRound((r) => Math.max(1, r - 1))
                      }
                      disabled={selectedLibGroupRound <= 1}
                      aria-label="Rodada anterior Libertadores"
                      className="p-1.5 rounded-full hover:bg-white/10 disabled:opacity-40 text-white transition-colors"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs font-mono font-bold px-2.5 text-[#b5ff00]">
                      R{selectedLibGroupRound}
                    </span>
                    <button
                      onClick={() =>
                        setSelectedLibGroupRound((r) => Math.min(6, r + 1))
                      }
                      disabled={selectedLibGroupRound >= 6}
                      aria-label="Próxima rodada Libertadores"
                      className="p-1.5 rounded-full hover:bg-white/10 disabled:opacity-40 text-white transition-colors"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Group Quick Pills */}
                <div className="px-4 pt-3 flex flex-wrap gap-1">
                  {libertadores.groups.map((g) => (
                    <button
                      key={g.name}
                      onClick={() => setSelectedGroupName(g.name)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-bold transition-colors ${
                        selectedGroupName === g.name
                          ? 'bg-[#b5ff00] text-[#090a0f]'
                          : 'bg-[#0b0c10] text-zinc-400 hover:text-white'
                      }`}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>

                <div className="p-4 space-y-2.5">
                  {(
                    libertadores.groups.find(
                      (g) => g.name === selectedGroupName
                    )?.fixtures || []
                  )
                    .filter((f) => f.roundNumber === selectedLibGroupRound)
                    .map((fix) => {
                      const home = clubMap.get(fix.homeClubId);
                      const away = clubMap.get(fix.awayClubId);
                      const isUser =
                        fix.homeClubId === userClubId ||
                        fix.awayClubId === userClubId;

                      return (
                        <div
                          key={fix.id}
                          className={`rounded-2xl p-3.5 ${
                            isUser
                              ? 'bg-gradient-to-r from-[#b5ff00] to-[#98db00] text-[#090a0f]'
                              : 'bg-[#0b0c10] border border-white/[0.06] text-zinc-200'
                          }`}
                        >
                          <div className="grid grid-cols-7 items-center text-xs">
                            <div className="col-span-3 truncate font-bold">
                              {home?.shortName}{' '}
                              <span className="text-[10px] opacity-70 font-mono">
                                ({home?.countryCode || 'BRA'})
                              </span>
                            </div>
                            <div
                              className={`col-span-1 text-center font-mono tabular-nums font-extrabold py-0.5 rounded-full text-[11px] ${
                                isUser
                                  ? 'bg-[#090a0f] text-white'
                                  : 'bg-white/[0.08] text-white'
                              }`}
                            >
                              {fix.played
                                ? `${fix.homeGoals}:${fix.awayGoals}`
                                : 'VS'}
                            </div>
                            <div className="col-span-3 truncate font-bold text-right">
                              <span className="text-[10px] opacity-70 font-mono">
                                ({away?.countryCode || 'BRA'}){' '}
                              </span>
                              {away?.shortName}
                            </div>
                          </div>
                          <div
                            className={`flex items-center justify-between text-[10px] mt-1.5 font-mono ${
                              isUser
                                ? 'text-[#090a0f]/75 font-semibold'
                                : 'text-zinc-400'
                            }`}
                          >
                            <span className="truncate">
                              {home?.stadium}, {home?.city}
                            </span>
                            <span>21:30</span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}

          {/* SUB-VIEW: LIBERTADORES MATA-MATA */}
          {libSubView === 'MATA_MATA' && (
            <div className="bg-[#14171f] border border-white/[0.07] rounded-[28px] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] pb-3">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-[#b5ff00]" />
                  <h3 className="font-display text-xl font-extrabold uppercase tracking-tight text-white">
                    Mata-Mata Libertadores — {libKnockoutStage}
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {LIBERTADORES_KNOCKOUT_STAGES.map((stage) => {
                    const count =
                      libertadores.knockoutFixtures[stage]?.length || 0;
                    return (
                      <button
                        key={stage}
                        onClick={() => setLibKnockoutStage(stage)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                          libKnockoutStage === stage
                            ? 'bg-[#b5ff00] text-[#090a0f]'
                            : count > 0
                            ? 'bg-[#0b0c10] text-zinc-200 border border-white/10'
                            : 'bg-[#0b0c10]/60 text-zinc-500 border border-white/[0.05]'
                        }`}
                      >
                        {stage} {count > 0 ? `(${count})` : ''}
                      </button>
                    );
                  })}
                </div>
              </div>

              {(libertadores.knockoutFixtures[libKnockoutStage]?.length || 0) >
              0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                  {libertadores.knockoutFixtures[libKnockoutStage].map((fix) =>
                    renderKnockoutMatchCard(fix)
                  )}
                </div>
              ) : (
                <div className="py-12 text-center text-sm text-zinc-400">
                  O chaveamento das {libKnockoutStage} será definido após o fim
                  da Fase de Grupos (6ª Rodada).
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
