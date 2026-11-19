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
  CHAMPIONS_STAGES,
  COPA_DO_BRASIL_STAGES,
  LIBERTADORES_KNOCKOUT_STAGES,
  MUNDIAL_STAGES,
  SUPER_MUNDIAL_KNOCKOUT_STAGES,
} from '../data/cupFactory';
import {
  ChampionsKnockoutStage,
  ChampionsLeagueState,
  Club,
  CompetitionType,
  CopaDoBrasilStage,
  CopaDoBrasilState,
  LibertadoresGroupName,
  LibertadoresKnockoutStage,
  LibertadoresState,
  MundialStage,
  MundialState,
  RoundFixture,
  SeasonArchiveEntry,
  StandingsRow,
  SuperMundialGroupName,
  SuperMundialKnockoutStage,
  SuperMundialState,
} from '../types/football';
import { ClubBadge } from './ClubBadge';

type CompTab =
  | 'A'
  | 'B'
  | 'COPA_DO_BRASIL'
  | 'LIBERTADORES'
  | 'CHAMPIONS'
  | 'MUNDIAL'
  | 'SUPER_MUNDIAL'
  | 'HALL';

interface CompetitionsViewProps {
  standings: StandingsRow[];
  clubs: Club[];
  fixtures: RoundFixture[];
  currentRound: number;
  seasonYear?: number;
  seasonHistory?: SeasonArchiveEntry[];
  userClubId?: string;
  userDivision?: 'A' | 'B';
  secondaryStandings?: StandingsRow[];
  secondaryFixtures?: RoundFixture[];
  copaDoBrasil?: CopaDoBrasilState;
  libertadores?: LibertadoresState;
  championsLeague?: ChampionsLeagueState;
  mundial?: MundialState;
  superMundial?: SuperMundialState;
  activeCompetition?: CompetitionType;
}

export const CompetitionsView: React.FC<CompetitionsViewProps> = ({
  standings,
  clubs,
  fixtures,
  currentRound,
  seasonYear = 2026,
  seasonHistory = [],
  userClubId = USER_CLUB_ID,
  userDivision = 'A',
  secondaryStandings,
  secondaryFixtures,
  copaDoBrasil,
  libertadores,
  championsLeague,
  mundial,
  superMundial,
  activeCompetition = 'BRASILEIRAO',
}) => {
  const defaultTab: CompTab =
    activeCompetition === 'COPA_DO_BRASIL'
      ? 'COPA_DO_BRASIL'
      : activeCompetition === 'LIBERTADORES'
      ? 'LIBERTADORES'
      : activeCompetition === 'CHAMPIONS_LEAGUE'
      ? 'CHAMPIONS'
      : activeCompetition === 'MUNDIAL'
      ? 'MUNDIAL'
      : activeCompetition === 'SUPER_MUNDIAL'
      ? 'SUPER_MUNDIAL'
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

  // Champions League UI state
  const [uclStage, setUclStage] = useState<ChampionsKnockoutStage>(
    championsLeague?.currentStage || 'Oitavas'
  );

  // Mundial de Clubes UI state
  const [mundialStage, setMundialStage] = useState<MundialStage>(
    mundial?.currentStage || 'Semifinal'
  );

  // Super Mundial de Clubes UI state
  const userSmGroup = superMundial?.groups.find((g) =>
    g.clubIds.includes(userClubId)
  );
  const [smSubView, setSmSubView] = useState<'GRUPOS' | 'MATA_MATA'>(
    superMundial && superMundial.currentPhase !== 'Grupos'
      ? 'MATA_MATA'
      : 'GRUPOS'
  );
  const [selectedSmGroupName, setSelectedSmGroupName] =
    useState<SuperMundialGroupName>(userSmGroup?.name || 'A');
  const [selectedSmGroupRound, setSelectedSmGroupRound] = useState<number>(
    superMundial?.groupRound || 1
  );
  const [smKnockoutStage, setSmKnockoutStage] =
    useState<SuperMundialKnockoutStage>(
      superMundial && superMundial.currentPhase !== 'Grupos'
        ? superMundial.currentPhase
        : 'Quartas'
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

  useEffect(() => {
    if (championsLeague?.currentStage) {
      setUclStage(championsLeague.currentStage);
    }
  }, [championsLeague?.currentStage]);

  useEffect(() => {
    if (mundial?.currentStage) {
      setMundialStage(mundial.currentStage);
    }
  }, [mundial?.currentStage]);

  useEffect(() => {
    if (superMundial) {
      setSelectedSmGroupRound(superMundial.groupRound);
      if (superMundial.currentPhase !== 'Grupos') {
        setSmKnockoutStage(superMundial.currentPhase);
        setSmSubView('MATA_MATA');
      }
    }
  }, [superMundial]);

  const clubMap = new Map(clubs.map((c) => [c.id, c]));

  const viewedDivision: 'A' | 'B' =
    viewedTab === 'B' ? 'B' : 'A';
  const isViewingUserDivision = viewedDivision === userDivision;
  const activeStandings = isViewingUserDivision
    ? standings
    : secondaryStandings && secondaryStandings.length > 0
    ? secondaryStandings
    : getInitialStandingsForDivision(viewedDivision, clubs);
  const activeFixtures = isViewingUserDivision
    ? fixtures
    : secondaryFixtures && secondaryFixtures.length > 0
    ? secondaryFixtures
    : generateLeagueSchedule('__none__', viewedDivision, clubs);

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
            <ClubBadge
              clubId={home?.id || fix.homeClubId}
              abbr={home?.abbr || 'HOM'}
              name={home?.name}
              primaryColor={home?.primaryColor}
              size="sm"
              surface={isUser ? 'light' : 'dark'}
            />
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
            <ClubBadge
              clubId={away?.id || fix.awayClubId}
              abbr={away?.abbr || 'AWY'}
              name={away?.name}
              primaryColor={away?.primaryColor}
              size="sm"
              surface={isUser ? 'light' : 'dark'}
            />
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
  const userParticipatesMundial =
    mundial?.participantIds.includes(userClubId) ?? false;
  const userParticipatesSuperMundial =
    (superMundial?.isActiveThisSeason &&
      superMundial?.participantIds.includes(userClubId)) ??
    false;

  const headerTitle =
    viewedTab === 'HALL'
      ? 'HALL DE CAMPEÕES'
      : viewedTab === 'COPA_DO_BRASIL'
      ? 'COPA DO BRASIL'
      : viewedTab === 'LIBERTADORES'
      ? 'LIBERTADORES'
      : viewedTab === 'CHAMPIONS'
      ? 'CHAMPIONS LEAGUE'
      : viewedTab === 'MUNDIAL'
      ? 'MUNDIAL DE CLUBES'
      : viewedTab === 'SUPER_MUNDIAL'
      ? 'SUPER MUNDIAL FIFA'
      : `SÉRIE ${viewedDivision}`;

  const headerSubtitle =
    viewedTab === 'HALL'
      ? `Histórico Contínuo da Carreira · ${seasonHistory.length} temporada(s) arquivada(s)`
      : viewedTab === 'COPA_DO_BRASIL'
      ? `Copa do Brasil ${seasonYear} · 32 Clubes (Série A & B)`
      : viewedTab === 'LIBERTADORES'
      ? `Copa Libertadores ${seasonYear} · 32 Clubes · 10 Países CONMEBOL`
      : viewedTab === 'CHAMPIONS'
      ? `UEFA Champions League ${seasonYear} · 16 Gigantes Europeus · Classificatória para Mundial & Super Mundial`
      : viewedTab === 'MUNDIAL'
      ? `Mundial de Clubes ${seasonYear} · Campeão da Libertadores vs Campeão da Champions + Convidados Globais`
      : viewedTab === 'SUPER_MUNDIAL'
      ? superMundial?.isActiveThisSeason
        ? `Super Mundial de Clubes ${seasonYear} · 16 Clubes (6 UEFA · 6 CONMEBOL · 4 Globais) · Quadrienal`
        : `Super Mundial de Clubes · Próxima Edição em ${superMundial?.nextEditionYear ?? seasonYear + 1} (Quadrienal)`
      : `Brasileirão ${seasonYear} · 38 Rodadas (Turno & Returno)`;

  return (
    <div className="space-y-5">
      {/* Header + Competition Tabs */}
      <div className="flex flex-col gap-4 pb-2 border-b border-white/[0.07]">
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
          <div className="flex flex-wrap items-center gap-1 bg-[#14171f] p-1 rounded-2xl sm:rounded-full border border-white/[0.08]">
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
                {
                  id: 'CHAMPIONS',
                  label: 'Champions',
                },
                {
                  id: 'MUNDIAL',
                  label: `Mundial ${userParticipatesMundial ? '★' : ''}`,
                },
                {
                  id: 'SUPER_MUNDIAL',
                  label: `Super Mundial ${userParticipatesSuperMundial ? '★' : ''}`,
                },
                {
                  id: 'HALL',
                  label:
                    seasonHistory.length > 0
                      ? `Hall (${seasonHistory.length})`
                      : 'Hall',
                },
              ] as Array<{ id: CompTab; label: string }>
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setViewedTab(tab.id);
                  setZoneFilter('ALL');
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-extrabold transition-colors whitespace-nowrap ${
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
                              <ClubBadge
                                clubId={club?.id || row.clubId}
                                abbr={club?.abbr}
                                name={club?.name}
                                primaryColor={club?.primaryColor}
                                size="xs"
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
                    type="button"
                    onClick={() => setSelectedRound((r) => Math.max(1, r - 1))}
                    disabled={selectedRound <= 1}
                    aria-label="Rodada anterior"
                    className="p-1.5 rounded-full hover:bg-white/10 disabled:opacity-40 text-white transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs font-mono font-bold px-2 text-[#b5ff00] tabular-nums">
                    R{selectedRound}/38
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedRound((r) => Math.min(38, r + 1))}
                    disabled={selectedRound >= 38}
                    aria-label="Próxima rodada"
                    className="p-1.5 rounded-full hover:bg-white/10 disabled:opacity-40 text-white transition-colors"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="px-4 pt-3 flex items-center justify-between gap-2 text-[11px]">
                <span className="font-mono text-zinc-400">
                  {selectedRound <= 19 ? '1º Turno (Ida)' : '2º Turno (Volta)'}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedRound((r) => (r > 19 ? r - 19 : 1))
                    }
                    className={`px-2 py-0.5 rounded-full font-mono font-bold transition-colors ${
                      selectedRound <= 19
                        ? 'bg-[#b5ff00]/15 text-[#b5ff00]'
                        : 'bg-[#0b0c10] text-zinc-400 hover:text-white'
                    }`}
                  >
                    1º Turno
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedRound((r) => (r <= 19 ? r + 19 : 38))
                    }
                    className={`px-2 py-0.5 rounded-full font-mono font-bold transition-colors ${
                      selectedRound > 19
                        ? 'bg-[#b5ff00]/15 text-[#b5ff00]'
                        : 'bg-[#0b0c10] text-zinc-400 hover:text-white'
                    }`}
                  >
                    2º Turno
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
                        <div className="col-span-3 flex items-center gap-1.5 min-w-0 font-bold">
                          <ClubBadge
                            clubId={home?.id || fix.homeClubId}
                            abbr={home?.abbr}
                            name={home?.name}
                            primaryColor={home?.primaryColor}
                            size="xs"
                            surface={fix.isUserMatch ? 'light' : 'dark'}
                          />
                          <span className="truncate">{home?.shortName}</span>
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
                        <div className="col-span-3 flex items-center justify-end gap-1.5 min-w-0 font-bold text-right">
                          <span className="truncate">{away?.shortName}</span>
                          <ClubBadge
                            clubId={away?.id || fix.awayClubId}
                            abbr={away?.abbr}
                            name={away?.name}
                            primaryColor={away?.primaryColor}
                            size="xs"
                            surface={fix.isUserMatch ? 'light' : 'dark'}
                          />
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
                                    <ClubBadge
                                      clubId={c?.id || row.clubId}
                                      abbr={c?.abbr}
                                      name={c?.name}
                                      primaryColor={c?.primaryColor}
                                      size="xs"
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

      {/* VIEW: UEFA CHAMPIONS LEAGUE */}
      {viewedTab === 'CHAMPIONS' && championsLeague && (
        <div className="space-y-5">
          <div className="bg-[#14171f] border border-indigo-400/25 rounded-[28px] p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-indigo-500 text-white flex items-center justify-center shrink-0">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-indigo-300 font-mono uppercase">
                  Simulação Europeia · Fase Atual: {championsLeague.currentStage}
                </div>
                <div className="font-display text-2xl font-extrabold uppercase text-white">
                  {championsLeague.championClubId
                    ? `Campeão Europeu: ${clubMap.get(championsLeague.championClubId)?.name}`
                    : '16 Clubes da Elite Europeia na Disputa'}
                </div>
                <div className="text-[11px] text-zinc-400 mt-0.5">
                  Torneio simulado automaticamente para definir o representante UEFA no Mundial de Clubes e as vagas no Super Mundial.
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {CHAMPIONS_STAGES.map((stage) => {
                const count = championsLeague.fixturesByStage[stage]?.length || 0;
                return (
                  <button
                    key={stage}
                    onClick={() => setUclStage(stage)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${
                      uclStage === stage
                        ? 'bg-indigo-400 text-[#090a0f]'
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

          <div className="bg-[#14171f] border border-white/[0.07] rounded-[28px] p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.07] pb-3">
              <div className="flex items-center gap-2">
                <Globe2 className="w-4 h-4 text-indigo-400" />
                <h3 className="font-display text-xl font-extrabold uppercase tracking-tight text-white">
                  Chaveamento UEFA — {uclStage}
                </h3>
              </div>
              <span className="text-xs font-mono text-zinc-400">
                Jogo único · Define vagas no Mundial & Super Mundial
              </span>
            </div>

            {(championsLeague.fixturesByStage[uclStage]?.length || 0) > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                {championsLeague.fixturesByStage[uclStage].map((fix) =>
                  renderKnockoutMatchCard(fix)
                )}
              </div>
            ) : (
              <div className="py-12 text-center text-sm text-zinc-400">
                Os confrontos desta fase da Champions serão definidos automaticamente ao avançar o calendário europeu.
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW: MUNDIAL DE CLUBES */}
      {viewedTab === 'MUNDIAL' && mundial && (
        <div className="space-y-5">
          <div className="bg-[#14171f] border border-amber-400/25 rounded-[28px] p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-400 text-[#090a0f] flex items-center justify-center shrink-0">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-amber-300 font-mono uppercase">
                  Torneio Intercontinental · Dezembro {seasonYear}
                </div>
                <div className="font-display text-2xl font-extrabold uppercase text-white">
                  {mundial.championClubId
                    ? `Campeão Mundial: ${clubMap.get(mundial.championClubId)?.name}`
                    : mundial.isSeeded
                    ? userParticipatesMundial
                      ? `${clubMap.get(userClubId)?.shortName} na disputa do título mundial!`
                      : 'Semifinais e Final definidas'
                    : 'Aguardando Campeões da Libertadores e da Champions'}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {MUNDIAL_STAGES.map((stage) => {
                const count = mundial.fixturesByStage[stage]?.length || 0;
                return (
                  <button
                    key={stage}
                    onClick={() => setMundialStage(stage)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${
                      mundialStage === stage
                        ? 'bg-amber-400 text-[#090a0f]'
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

          {!mundial.isSeeded ? (
            <div className="bg-[#14171f] border border-white/[0.07] rounded-[28px] p-5 space-y-4">
              <div className="border-b border-white/[0.07] pb-3">
                <h3 className="font-display text-xl font-extrabold uppercase text-white">
                  Vagas do Mundial de Clubes {seasonYear}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Vença a Copa Libertadores para representar a América do Sul e enfrentar o Campeão da Champions League e os representantes globais em dezembro.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  {
                    role: 'Campeão Champions (UEFA)',
                    clubId: championsLeague?.championClubId || null,
                    accent: 'border-indigo-400/35 text-indigo-300',
                  },
                  {
                    role: 'Campeão Libertadores (CONMEBOL)',
                    clubId: libertadores?.championClubId || null,
                    accent: 'border-sky-400/35 text-sky-300',
                  },
                  {
                    role: 'Representante Ásia / África',
                    clubId: clubs.find((c) => c.division === 'WORLD')?.id || null,
                    accent: 'border-amber-400/35 text-amber-300',
                  },
                  {
                    role: 'Representante CONCACAF / MLS',
                    clubId: clubs.filter((c) => c.division === 'WORLD')[1]?.id || null,
                    accent: 'border-emerald-400/35 text-emerald-300',
                  },
                ].map((slot) => {
                  const c = slot.clubId ? clubMap.get(slot.clubId) : null;
                  return (
                    <div
                      key={slot.role}
                      className={`bg-[#0b0c10] border rounded-2xl p-4 space-y-2 ${slot.accent}`}
                    >
                      <div className="text-[10px] font-mono uppercase">{slot.role}</div>
                      {c ? (
                        <div className="flex items-center gap-2.5">
                          <ClubBadge
                            clubId={c.id}
                            abbr={c.abbr}
                            name={c.name}
                            primaryColor={c.primaryColor}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <div className="font-display text-base font-extrabold text-white truncate">
                              {c.shortName}
                            </div>
                            <div className="text-[10px] font-mono text-zinc-400">
                              {c.countryCode || 'BRA'}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs font-semibold text-zinc-500 py-1.5">
                          A definir na temporada
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-[#14171f] border border-white/[0.07] rounded-[28px] p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-white/[0.07] pb-3">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <h3 className="font-display text-xl font-extrabold uppercase tracking-tight text-white">
                    Chaveamento Mundial — {mundialStage}
                  </h3>
                </div>
                <span className="text-xs font-mono text-zinc-400">
                  Jogo único · Prorrogação/Pênaltis em caso de empate
                </span>
              </div>

              {(mundial.fixturesByStage[mundialStage]?.length || 0) > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {mundial.fixturesByStage[mundialStage].map((fix) =>
                    renderKnockoutMatchCard(fix)
                  )}
                </div>
              ) : (
                <div className="py-12 text-center text-sm text-zinc-400">
                  A Final será definida após o encerramento das Semifinais.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* VIEW: SUPER MUNDIAL DE CLUBES (QUADRENNIAL) */}
      {viewedTab === 'SUPER_MUNDIAL' && superMundial && (
        <div className="space-y-5">
          <div className="bg-[#14171f] border border-purple-400/25 rounded-[28px] p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-purple-500 text-white flex items-center justify-center shrink-0">
                <Globe2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-purple-300 font-mono uppercase">
                  {superMundial.isActiveThisSeason
                    ? `Edição ${seasonYear} Ativa · ${
                        superMundial.currentPhase === 'Grupos'
                          ? `Fase de Grupos · ${superMundial.groupRound}ª Rodada`
                          : superMundial.currentPhase
                      }`
                    : `Ciclo Quadrienal · Próxima Edição em ${superMundial.nextEditionYear}`}
                </div>
                <div className="font-display text-2xl font-extrabold uppercase text-white">
                  {superMundial.championClubId
                    ? `Campeão do Super Mundial: ${clubMap.get(superMundial.championClubId)?.name}`
                    : superMundial.isActiveThisSeason
                    ? userParticipatesSuperMundial
                      ? `${clubMap.get(userClubId)?.shortName} · Grupo ${userSmGroup?.name || ''}`
                      : '16 Clubes · 6 UEFA · 6 CONMEBOL · 4 Globais'
                    : `Corrida de Classificação para ${superMundial.nextEditionYear}`}
                </div>
              </div>
            </div>

            {superMundial.isActiveThisSeason && (
              <div className="flex items-center gap-1.5 bg-[#0b0c10] p-1 rounded-full border border-white/[0.08]">
                <button
                  onClick={() => setSmSubView('GRUPOS')}
                  className={`px-4 py-1.5 rounded-full text-xs font-extrabold transition-colors ${
                    smSubView === 'GRUPOS'
                      ? 'bg-purple-400 text-[#090a0f]'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Fase de Grupos (A–D)
                </button>
                <button
                  onClick={() => setSmSubView('MATA_MATA')}
                  className={`px-4 py-1.5 rounded-full text-xs font-extrabold transition-colors ${
                    smSubView === 'MATA_MATA'
                      ? 'bg-purple-400 text-[#090a0f]'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Mata-Mata (Quartas → Final)
                </button>
              </div>
            )}
          </div>

          {!superMundial.isActiveThisSeason ? (
            <div className="bg-[#14171f] border border-white/[0.07] rounded-[28px] p-5 space-y-5">
              <div className="border-b border-white/[0.07] pb-3">
                <h3 className="font-display text-xl font-extrabold uppercase text-white">
                  Classificados Atuais para o Super Mundial {superMundial.nextEditionYear}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Disputado a cada 4 anos (2026, 2030, 2034...) com 6 clubes da Champions League, 6 da Libertadores e 4 representantes globais. Campeões da Libertadores e da Champions garantem vaga direta!
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  {
                    title: 'UEFA Champions League (6)',
                    ids: superMundial.uefaQualifiedIds,
                    color: 'text-indigo-300 border-indigo-400/25',
                  },
                  {
                    title: 'CONMEBOL Libertadores (6)',
                    ids: superMundial.conmebolQualifiedIds,
                    color: 'text-sky-300 border-sky-400/25',
                  },
                  {
                    title: 'Convidados Globais FIFA (4)',
                    ids: superMundial.globalQualifiedIds,
                    color: 'text-amber-300 border-amber-400/25',
                  },
                ].map((group) => (
                  <div
                    key={group.title}
                    className={`bg-[#0b0c10] border rounded-2xl p-4 space-y-2.5 ${group.color}`}
                  >
                    <div className="text-xs font-mono font-bold uppercase">
                      {group.title}
                    </div>
                    <div className="space-y-1.5">
                      {group.ids.map((cid) => {
                        const c = clubMap.get(cid);
                        const isUser = cid === userClubId;
                        return (
                          <div
                            key={cid}
                            className={`flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs ${
                              isUser
                                ? 'bg-[#b5ff00]/15 text-[#b5ff00] font-bold border border-[#b5ff00]/40'
                                : 'bg-[#14171f] text-white'
                            }`}
                          >
                            {c && (
                              <ClubBadge
                                clubId={c.id}
                                abbr={c.abbr}
                                name={c.name}
                                primaryColor={c.primaryColor}
                                size="xs"
                              />
                            )}
                            <span className="truncate font-semibold">
                              {c?.shortName || cid}
                            </span>
                            <span className="ml-auto text-[10px] font-mono text-zinc-400">
                              {c?.countryCode || 'BRA'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : smSubView === 'GRUPOS' ? (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              <div className="xl:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                {superMundial.groups.map((grp) => {
                  const isSelected = grp.name === selectedSmGroupName;
                  const hasUser = grp.clubIds.includes(userClubId);
                  return (
                    <div
                      key={grp.name}
                      onClick={() => setSelectedSmGroupName(grp.name)}
                      className={`cursor-pointer rounded-[24px] border overflow-hidden transition-all ${
                        isSelected
                          ? 'bg-[#14171f] border-purple-400 shadow-lg'
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
                          1º–2º Quartas
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
                                    idx < 2 ? 'text-purple-300' : 'text-zinc-500'
                                  }`}
                                >
                                  {idx + 1}º
                                </td>
                                <td className="py-2 px-2 font-sans">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <ClubBadge
                                      clubId={c?.id || row.clubId}
                                      abbr={c?.abbr}
                                      name={c?.name}
                                      primaryColor={c?.primaryColor}
                                      size="xs"
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

              <div className="xl:col-span-4 bg-[#14171f] border border-white/[0.07] rounded-[28px] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-purple-400" />
                    <h3 className="font-display text-xl font-extrabold uppercase tracking-tight text-white">
                      Grupo {selectedSmGroupName} · {selectedSmGroupRound}ªR
                    </h3>
                  </div>

                  <div className="flex items-center gap-1 bg-[#0b0c10] p-1 rounded-full border border-white/[0.07]">
                    <button
                      onClick={() =>
                        setSelectedSmGroupRound((r) => Math.max(1, r - 1))
                      }
                      disabled={selectedSmGroupRound <= 1}
                      aria-label="Rodada anterior Super Mundial"
                      className="p-1.5 rounded-full hover:bg-white/10 disabled:opacity-40 text-white transition-colors"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs font-mono font-bold px-2.5 text-purple-300">
                      R{selectedSmGroupRound}/3
                    </span>
                    <button
                      onClick={() =>
                        setSelectedSmGroupRound((r) => Math.min(3, r + 1))
                      }
                      disabled={selectedSmGroupRound >= 3}
                      aria-label="Próxima rodada Super Mundial"
                      className="p-1.5 rounded-full hover:bg-white/10 disabled:opacity-40 text-white transition-colors"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="px-4 pt-3 flex flex-wrap gap-1">
                  {superMundial.groups.map((g) => (
                    <button
                      key={g.name}
                      onClick={() => setSelectedSmGroupName(g.name)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-bold transition-colors ${
                        selectedSmGroupName === g.name
                          ? 'bg-purple-400 text-[#090a0f]'
                          : 'bg-[#0b0c10] text-zinc-400 hover:text-white'
                      }`}
                    >
                      Grupo {g.name}
                    </button>
                  ))}
                </div>

                <div className="p-4 space-y-2.5">
                  {(
                    superMundial.groups.find(
                      (g) => g.name === selectedSmGroupName
                    )?.fixtures || []
                  )
                    .filter((f) => f.roundNumber === selectedSmGroupRound)
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
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#14171f] border border-white/[0.07] rounded-[28px] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] pb-3">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-purple-400" />
                  <h3 className="font-display text-xl font-extrabold uppercase tracking-tight text-white">
                    Mata-Mata Super Mundial — {smKnockoutStage}
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {SUPER_MUNDIAL_KNOCKOUT_STAGES.map((stage) => {
                    const count =
                      superMundial.knockoutFixtures[stage]?.length || 0;
                    return (
                      <button
                        key={stage}
                        onClick={() => setSmKnockoutStage(stage)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                          smKnockoutStage === stage
                            ? 'bg-purple-400 text-[#090a0f]'
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

              {(superMundial.knockoutFixtures[smKnockoutStage]?.length || 0) > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                  {superMundial.knockoutFixtures[smKnockoutStage].map((fix) =>
                    renderKnockoutMatchCard(fix)
                  )}
                </div>
              ) : (
                <div className="py-12 text-center text-sm text-zinc-400">
                  O chaveamento das {smKnockoutStage} será definido após o fim da Fase de Grupos (3ª Rodada).
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* VIEW: HALL DE CAMPEÕES */}
      {viewedTab === 'HALL' && (
        <div className="space-y-4">
          {seasonHistory.length === 0 ? (
            <div className="bg-[#14171f] border border-white/[0.08] rounded-[28px] p-8 text-center space-y-2">
              <Trophy className="w-8 h-8 text-[#b5ff00] mx-auto" />
              <h3 className="font-display text-xl font-extrabold uppercase text-white">
                Temporada {seasonYear} em Andamento
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 max-w-xl mx-auto">
                Os campeões da Série A, Série B, Copa do Brasil, Libertadores,
                Champions League, Mundial de Clubes e Super Mundial serão
                eternizados aqui após a virada de ano.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {seasonHistory.map((entry) => (
                <div
                  key={entry.year}
                  className="bg-[#14171f] border border-white/[0.08] rounded-[28px] p-5 space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/[0.07]">
                    <div className="flex items-center gap-2.5">
                      <span className="px-3 py-1 rounded-full bg-[#b5ff00] text-[#090a0f] font-display font-extrabold text-sm">
                        {entry.year}
                      </span>
                      <h3 className="font-display text-xl font-extrabold uppercase text-white">
                        Campeões & Premiações da Temporada {entry.year}
                      </h3>
                    </div>
                    <span className="text-xs font-mono text-zinc-300">
                      {entry.userClubName}: {entry.userRank}º na Série{' '}
                      {entry.userDivision} ({entry.userPoints} pts)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    <div className="bg-[#0b0c10] border border-[#b5ff00]/30 rounded-2xl p-3.5">
                      <div className="text-[10px] font-mono uppercase text-[#b5ff00]">
                        Brasileirão Série A
                      </div>
                      <div className="font-display text-lg font-extrabold text-white mt-1 truncate">
                        {entry.serieAChampionName}
                      </div>
                    </div>
                    <div className="bg-[#0b0c10] border border-white/10 rounded-2xl p-3.5">
                      <div className="text-[10px] font-mono uppercase text-zinc-400">
                        Brasileirão Série B
                      </div>
                      <div className="font-display text-lg font-extrabold text-white mt-1 truncate">
                        {entry.serieBChampionName}
                      </div>
                    </div>
                    <div className="bg-[#0b0c10] border border-amber-400/30 rounded-2xl p-3.5">
                      <div className="text-[10px] font-mono uppercase text-amber-300">
                        Copa do Brasil
                      </div>
                      <div className="font-display text-lg font-extrabold text-white mt-1 truncate">
                        {entry.cdbChampionName || '—'}
                      </div>
                    </div>
                    <div className="bg-[#0b0c10] border border-sky-400/30 rounded-2xl p-3.5">
                      <div className="text-[10px] font-mono uppercase text-sky-300">
                        Copa Libertadores
                      </div>
                      <div className="font-display text-lg font-extrabold text-white mt-1 truncate">
                        {entry.libChampionName || '—'}
                      </div>
                    </div>
                    {entry.uclChampionName && (
                      <div className="bg-[#0b0c10] border border-indigo-400/30 rounded-2xl p-3.5">
                        <div className="text-[10px] font-mono uppercase text-indigo-300">
                          Champions League
                        </div>
                        <div className="font-display text-lg font-extrabold text-white mt-1 truncate">
                          {entry.uclChampionName}
                        </div>
                      </div>
                    )}
                    {entry.mundialChampionName && (
                      <div className="bg-[#0b0c10] border border-yellow-400/30 rounded-2xl p-3.5">
                        <div className="text-[10px] font-mono uppercase text-yellow-300">
                          Mundial de Clubes
                        </div>
                        <div className="font-display text-lg font-extrabold text-white mt-1 truncate">
                          {entry.mundialChampionName}
                        </div>
                      </div>
                    )}
                    {entry.superMundialChampionName && (
                      <div className="bg-[#0b0c10] border border-purple-400/30 rounded-2xl p-3.5">
                        <div className="text-[10px] font-mono uppercase text-purple-300">
                          Super Mundial FIFA
                        </div>
                        <div className="font-display text-lg font-extrabold text-white mt-1 truncate">
                          {entry.superMundialChampionName}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div className="bg-[#0b0c10]/80 border border-white/[0.06] rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-mono uppercase text-zinc-400">
                          Artilheiro
                        </div>
                        <div className="font-bold text-white">
                          {entry.topScorerName}
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          {entry.topScorerClubName}
                        </div>
                      </div>
                      <span className="font-mono font-extrabold text-sm text-[#b5ff00] tabular-nums">
                        {entry.topScorerGoals}G
                      </span>
                    </div>

                    <div className="bg-[#0b0c10]/80 border border-white/[0.06] rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-mono uppercase text-zinc-400">
                          Líder de Assistências
                        </div>
                        <div className="font-bold text-white">
                          {entry.topAssistName}
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          {entry.topAssistClubName}
                        </div>
                      </div>
                      <span className="font-mono font-extrabold text-sm text-[#b5ff00] tabular-nums">
                        {entry.topAssistCount}A
                      </span>
                    </div>

                    <div className="bg-[#0b0c10]/80 border border-white/[0.06] rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-mono uppercase text-zinc-400">
                          Melhor Jogador (Nota)
                        </div>
                        <div className="font-bold text-white">
                          {entry.bestPlayerName}
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          {entry.bestPlayerClubName}
                        </div>
                      </div>
                      <span className="font-mono font-extrabold text-sm text-[#b5ff00] tabular-nums">
                        {entry.bestPlayerRating.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
