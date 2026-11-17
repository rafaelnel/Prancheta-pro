import React, { useMemo, useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Trophy,
  Globe2,
  Award,
  Play,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  FastForward,
  Sparkles,
  CalendarClock,
} from 'lucide-react';
import { SEASON_CALENDAR } from '../data/cupFactory';
import {
  addMonthsToDayOffset,
  dayOffsetToDate,
  dayOffsetToIsoDate,
  getMaxSeasonDayOffset,
  isoDateToDayOffset,
} from '../engine/autoTacticsAndSim';
import { formatCalendarDate } from '../utils/formatters';
import {
  Club,
  CompetitionType,
  CopaDoBrasilState,
  LibertadoresState,
  RoundFixture,
  SeasonCalendarStep,
} from '../types/football';
import { ClubBadge } from './ClubBadge';

interface AnnualCalendarViewProps {
  userClub: Club;
  clubs: Club[];
  fixtures: RoundFixture[];
  copaDoBrasil: CopaDoBrasilState;
  libertadores: LibertadoresState;
  seasonStepIndex: number;
  dayOffset: number;
  seasonYear?: number;
  isMatchDay: boolean;
  isSeasonCompleted: boolean;
  onGoToMatch: () => void;
  onOpenCompetitions: () => void;
  onStartAutoSimulation: (targetDayOffset: number, targetLabel: string) => void;
}

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const MONTH_SHORT = [
  'JAN',
  'FEV',
  'MAR',
  'ABR',
  'MAI',
  'JUN',
  'JUL',
  'AGO',
  'SET',
  'OUT',
  'NOV',
  'DEZ',
];

const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

type CalendarFilterComp = 'ALL' | CompetitionType;

interface CalendarEntry {
  step: SeasonCalendarStep;
  date: Date;
  monthIndex: number;
  dayOfMonth: number;
  weekdayShort: string;
  fixture: RoundFixture | null;
  opponentClub: Club | null;
  isUserHome: boolean;
  stadium: string;
  kickoffTime: string;
  status:
    | 'PLAYED'
    | 'NEXT'
    | 'SCHEDULED'
    | 'TBD'
    | 'ELIMINATED'
    | 'NOT_PARTICIPATING';
  outcome: 'V' | 'E' | 'D' | null;
  scoreLabel: string | null;
  penaltiesLabel: string | null;
}

export const AnnualCalendarView: React.FC<AnnualCalendarViewProps> = ({
  userClub,
  clubs,
  fixtures,
  copaDoBrasil,
  libertadores,
  seasonStepIndex,
  dayOffset,
  seasonYear = 2026,
  isMatchDay,
  isSeasonCompleted,
  onGoToMatch,
  onOpenCompetitions,
  onStartAutoSimulation,
}) => {
  const maxSeasonDayOffset = useMemo(
    () => getMaxSeasonDayOffset(seasonYear),
    [seasonYear]
  );
  const currentDate = useMemo(
    () => dayOffsetToDate(dayOffset, seasonYear),
    [dayOffset, seasonYear]
  );
  const currentMonthIndex =
    currentDate.getFullYear() === seasonYear ? currentDate.getMonth() : 0;

  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonthIndex);
  const [scopeMode, setScopeMode] = useState<'MONTH' | 'ALL_YEAR'>('MONTH');
  const [compFilter, setCompFilter] = useState<CalendarFilterComp>('ALL');
  const [customTargetDayOffset, setCustomTargetDayOffset] = useState<number>(() =>
    addMonthsToDayOffset(dayOffset, 1, seasonYear)
  );

  // Keep chosen date >= current dayOffset if calendar advances
  const effectiveCustomTarget = Math.min(
    maxSeasonDayOffset,
    Math.max(dayOffset, customTargetDayOffset)
  );

  const oneMonthTarget = useMemo(
    () => addMonthsToDayOffset(dayOffset, 1, seasonYear),
    [dayOffset, seasonYear]
  );
  const sixMonthsTarget = useMemo(
    () => addMonthsToDayOffset(dayOffset, 6, seasonYear),
    [dayOffset, seasonYear]
  );

  const clubMap = useMemo(() => new Map(clubs.map((c) => [c.id, c])), [clubs]);

  const participatesInLib = libertadores.participantIds.includes(userClub.id);
  const participatesInCdb = copaDoBrasil.participantIds.includes(userClub.id);

  const entries: CalendarEntry[] = useMemo(() => {
    return SEASON_CALENDAR.map((step) => {
      const offset = step.dayOffset ?? step.index * 6;
      const date = dayOffsetToDate(offset, seasonYear);
      const monthIndex = date.getMonth();
      const dayOfMonth = date.getDate();
      const weekdayShort = WEEKDAYS_SHORT[date.getDay()];

      let fixture: RoundFixture | null = null;
      if (step.competition === 'BRASILEIRAO' && step.leagueRound) {
        fixture =
          fixtures.find(
            (f) => f.roundNumber === step.leagueRound && f.isUserMatch
          ) || null;
      } else if (step.competition === 'COPA_DO_BRASIL' && step.copaStage) {
        fixture =
          (copaDoBrasil.fixturesByStage[step.copaStage] || []).find(
            (f) => f.homeClubId === userClub.id || f.awayClubId === userClub.id
          ) || null;
      } else if (step.competition === 'LIBERTADORES') {
        if (step.libStage === 'Grupos' && step.libGroupRound) {
          for (const grp of libertadores.groups) {
            const found = grp.fixtures.find(
              (f) =>
                f.roundNumber === step.libGroupRound &&
                (f.homeClubId === userClub.id || f.awayClubId === userClub.id)
            );
            if (found) {
              fixture = found;
              break;
            }
          }
        } else if (step.libStage && step.libStage !== 'Grupos') {
          fixture =
            (libertadores.knockoutFixtures[step.libStage] || []).find(
              (f) =>
                f.homeClubId === userClub.id || f.awayClubId === userClub.id
            ) || null;
        }
      }

      const isUserHome = fixture ? fixture.homeClubId === userClub.id : true;
      const oppId = fixture
        ? isUserHome
          ? fixture.awayClubId
          : fixture.homeClubId
        : null;
      const opponentClub = oppId ? clubMap.get(oppId) || null : null;
      const homeClubObj = fixture
        ? clubMap.get(fixture.homeClubId)
        : undefined;
      const stadium = homeClubObj?.stadium || userClub.stadium;
      const kickoffTime =
        step.competition === 'BRASILEIRAO' ? '16:00' : '21:30';

      let status: CalendarEntry['status'] = 'TBD';
      let outcome: CalendarEntry['outcome'] = null;
      let scoreLabel: string | null = null;
      let penaltiesLabel: string | null = null;

      if (fixture?.played && fixture.homeGoals !== null && fixture.awayGoals !== null) {
        status = 'PLAYED';
        scoreLabel = `${fixture.homeGoals} × ${fixture.awayGoals}`;
        if (
          fixture.homePenalties !== null &&
          fixture.homePenalties !== undefined &&
          fixture.awayPenalties !== null &&
          fixture.awayPenalties !== undefined
        ) {
          penaltiesLabel = `Pên. ${fixture.homePenalties}:${fixture.awayPenalties}`;
        }

        const userGoals = isUserHome ? fixture.homeGoals : fixture.awayGoals;
        const oppGoals = isUserHome ? fixture.awayGoals : fixture.homeGoals;
        if (userGoals > oppGoals) {
          outcome = 'V';
        } else if (userGoals < oppGoals) {
          outcome = 'D';
        } else if (fixture.winnerClubId) {
          outcome = fixture.winnerClubId === userClub.id ? 'V' : 'D';
        } else {
          outcome = 'E';
        }
      } else if (fixture) {
        status = step.index === seasonStepIndex ? 'NEXT' : 'SCHEDULED';
      } else if (step.competition === 'LIBERTADORES' && !participatesInLib) {
        status = 'NOT_PARTICIPATING';
      } else if (
        (step.competition === 'LIBERTADORES' &&
          libertadores.eliminatedIds.includes(userClub.id)) ||
        (step.competition === 'COPA_DO_BRASIL' &&
          (!participatesInCdb ||
            copaDoBrasil.eliminatedIds.includes(userClub.id)))
      ) {
        status = 'ELIMINATED';
      } else if (step.index < seasonStepIndex) {
        status = 'ELIMINATED';
      } else {
        status = 'TBD';
      }

      return {
        step,
        date,
        monthIndex,
        dayOfMonth,
        weekdayShort,
        fixture,
        opponentClub,
        isUserHome,
        stadium,
        kickoffTime,
        status,
        outcome,
        scoreLabel,
        penaltiesLabel,
      };
    });
  }, [
    clubMap,
    copaDoBrasil,
    fixtures,
    libertadores,
    participatesInCdb,
    participatesInLib,
    seasonStepIndex,
    seasonYear,
    userClub.id,
    userClub.stadium,
  ]);

  const summaryStats = useMemo(() => {
    const activeEntries = entries.filter(
      (e) => e.status !== 'NOT_PARTICIPATING'
    );
    const played = activeEntries.filter((e) => e.status === 'PLAYED');
    const wins = played.filter((e) => e.outcome === 'V').length;
    const nextEntry =
      activeEntries.find((e) => e.status === 'NEXT') ||
      activeEntries.find((e) => e.status === 'SCHEDULED') ||
      null;
    const remaining = activeEntries.filter(
      (e) => e.status === 'NEXT' || e.status === 'SCHEDULED' || e.status === 'TBD'
    ).length;

    return {
      totalCount: activeEntries.length,
      playedCount: played.length,
      wins,
      remaining,
      nextEntry: isSeasonCompleted ? null : nextEntry,
    };
  }, [entries, isSeasonCompleted]);

  const countUpcomingMatchesUntil = (targetOffset: number) =>
    entries.filter((e) => {
      const stepOffset = e.step.dayOffset ?? e.step.index * 9;
      return (
        stepOffset <= targetOffset &&
        (e.status === 'NEXT' || e.status === 'SCHEDULED' || e.status === 'TBD')
      );
    }).length;

  const oneMonthMatches = countUpcomingMatchesUntil(oneMonthTarget);
  const sixMonthsMatches = countUpcomingMatchesUntil(sixMonthsTarget);
  const fullSeasonMatches = countUpcomingMatchesUntil(maxSeasonDayOffset);
  const customTargetMatches = countUpcomingMatchesUntil(effectiveCustomTarget);

  const monthSummaries = useMemo(() => {
    return MONTH_NAMES.map((name, idx) => {
      const monthEntries = entries.filter(
        (e) =>
          e.monthIndex === idx &&
          (compFilter === 'ALL' || e.step.competition === compFilter)
      );
      const brCount = monthEntries.filter(
        (e) => e.step.competition === 'BRASILEIRAO'
      ).length;
      const cdbCount = monthEntries.filter(
        (e) =>
          e.step.competition === 'COPA_DO_BRASIL' &&
          e.status !== 'NOT_PARTICIPATING'
      ).length;
      const libCount = monthEntries.filter(
        (e) =>
          e.step.competition === 'LIBERTADORES' &&
          e.status !== 'NOT_PARTICIPATING'
      ).length;

      return {
        idx,
        name,
        short: MONTH_SHORT[idx],
        entries: monthEntries,
        brCount,
        cdbCount,
        libCount,
        totalMatches: monthEntries.filter(
          (e) => e.status !== 'NOT_PARTICIPATING'
        ).length,
      };
    });
  }, [entries, compFilter]);

  const visibleEntries = useMemo(() => {
    return entries.filter((e) => {
      if (compFilter !== 'ALL' && e.step.competition !== compFilter) {
        return false;
      }
      if (scopeMode === 'MONTH' && e.monthIndex !== selectedMonth) {
        return false;
      }
      return true;
    });
  }, [entries, compFilter, scopeMode, selectedMonth]);

  // Build 7-column calendar cells for selectedMonth in seasonYear
  const calendarMonthCells = useMemo(() => {
    const firstDay = new Date(seasonYear, selectedMonth, 1);
    const startWeekday = firstDay.getDay(); // 0..6
    const daysInMonth = new Date(seasonYear, selectedMonth + 1, 0).getDate();

    const cells: Array<{
      day: number | null;
      cellOffset: number | null;
      isToday: boolean;
      isPast: boolean;
      isSelectedTarget: boolean;
      entry: CalendarEntry | null;
    }> = [];

    for (let i = 0; i < startWeekday; i++) {
      cells.push({
        day: null,
        cellOffset: null,
        isToday: false,
        isPast: true,
        isSelectedTarget: false,
        entry: null,
      });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const cellOffset = isoDateToDayOffset(
        `${seasonYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        seasonYear
      );
      const isToday =
        currentDate.getFullYear() === seasonYear &&
        currentDate.getMonth() === selectedMonth &&
        currentDate.getDate() === day;
      const isPast = cellOffset !== null ? cellOffset < dayOffset : true;
      const isSelectedTarget =
        cellOffset !== null && cellOffset === effectiveCustomTarget && !isSeasonCompleted;
      const matchingEntry =
        entries.find(
          (e) =>
            e.monthIndex === selectedMonth &&
            e.dayOfMonth === day &&
            (compFilter === 'ALL' || e.step.competition === compFilter)
        ) || null;
      cells.push({
        day,
        cellOffset,
        isToday,
        isPast,
        isSelectedTarget,
        entry: matchingEntry,
      });
    }

    return cells;
  }, [
    seasonYear,
    selectedMonth,
    currentDate,
    entries,
    compFilter,
    dayOffset,
    effectiveCustomTarget,
    isSeasonCompleted,
  ]);

  const getCompBadge = (comp: CompetitionType) => {
    if (comp === 'COPA_DO_BRASIL') {
      return {
        label: 'Copa do Brasil',
        short: 'CdB',
        pillClass: 'bg-amber-400/15 text-amber-300 border-amber-400/30',
        dotClass: 'bg-amber-400',
        Icon: Award,
      };
    }
    if (comp === 'LIBERTADORES') {
      return {
        label: 'Libertadores',
        short: 'LIB',
        pillClass: 'bg-sky-400/15 text-sky-300 border-sky-400/30',
        dotClass: 'bg-sky-400',
        Icon: Globe2,
      };
    }
    return {
      label: `Série ${userClub.division === 'B' ? 'B' : 'A'}`,
      short: userClub.division === 'B' ? 'SÉRIE B' : 'SÉRIE A',
      pillClass: 'bg-[#b5ff00]/15 text-[#b5ff00] border-[#b5ff00]/30',
      dotClass: 'bg-[#b5ff00]',
      Icon: Trophy,
    };
  };

  return (
    <div className="space-y-5">
      {/* Header & Competition Filters */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
        <div>
          <span className="text-xs text-zinc-400 block mb-0.5">
            Temporada {seasonYear} · Brasileirão (38 rodadas), Copa do Brasil e Libertadores
          </span>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold uppercase tracking-tight text-white leading-none">
            CALENDÁRIO ANUAL {seasonYear}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 bg-[#14171f] border border-white/[0.08] rounded-2xl sm:rounded-full p-1.5 sm:p-1">
          {(
            [
              { id: 'ALL', label: `Todos (${SEASON_CALENDAR.length})` },
              { id: 'BRASILEIRAO', label: 'Brasileirão (38)' },
              { id: 'COPA_DO_BRASIL', label: 'Copa do Brasil (5)' },
              { id: 'LIBERTADORES', label: 'Libertadores (10)' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setCompFilter(f.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                compFilter === f.id
                  ? 'bg-[#b5ff00] text-[#090a0f] shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Season Progress Summary Strip */}
      <div className="grid grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-[#14171f] border border-white/[0.08] rounded-2xl p-3 sm:p-4 flex items-center justify-between gap-1">
          <div className="min-w-0">
            <div className="text-[10px] sm:text-[11px] text-zinc-400 uppercase tracking-wider truncate">
              Disputados
            </div>
            <div className="font-display text-xl sm:text-2xl font-extrabold text-white mt-0.5 tabular-nums">
              {summaryStats.playedCount}
              <span className="text-xs sm:text-sm text-zinc-500 font-mono font-normal">
                /{summaryStats.totalCount}
              </span>
            </div>
          </div>
          <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-[#b5ff00] shrink-0 hidden sm:block" />
        </div>

        <div className="bg-[#14171f] border border-white/[0.08] rounded-2xl p-3 sm:p-4 flex items-center justify-between gap-1">
          <div className="min-w-0">
            <div className="text-[10px] sm:text-[11px] text-zinc-400 uppercase tracking-wider truncate">
              Vitórias
            </div>
            <div className="font-display text-xl sm:text-2xl font-extrabold text-[#b5ff00] mt-0.5 tabular-nums">
              {summaryStats.wins}
            </div>
          </div>
          <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-[#b5ff00] shrink-0 hidden sm:block" />
        </div>

        <div className="bg-[#14171f] border border-white/[0.08] rounded-2xl p-3 sm:p-4 flex items-center justify-between gap-1">
          <div className="min-w-0">
            <div className="text-[10px] sm:text-[11px] text-zinc-400 uppercase tracking-wider truncate">
              Restantes
            </div>
            <div className="font-display text-xl sm:text-2xl font-extrabold text-white mt-0.5 tabular-nums">
              {summaryStats.remaining}
            </div>
          </div>
          <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-400 shrink-0 hidden sm:block" />
        </div>

        <div className="col-span-3 lg:col-span-1 bg-[#14171f] border border-[#b5ff00]/30 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] text-[#b5ff00] uppercase tracking-wider font-bold">
              Próximo Compromisso
            </div>
            <div className="font-display text-base sm:text-lg font-extrabold text-white truncate mt-0.5">
              {summaryStats.nextEntry?.opponentClub
                ? `vs ${summaryStats.nextEntry.opponentClub.shortName}`
                : summaryStats.nextEntry?.step.label || 'Temporada Concluída'}
            </div>
          </div>
          {!isSeasonCompleted && (
            <button
              type="button"
              onClick={isMatchDay ? onGoToMatch : onOpenCompetitions}
              className="shrink-0 px-3.5 py-1.5 rounded-full bg-[#b5ff00] hover:bg-[#c8ff33] text-[#090a0f] text-[11px] font-extrabold transition-colors"
            >
              {isMatchDay ? 'Jogar' : 'Tabelas'}
            </button>
          )}
        </div>
      </div>

      {/* Automatic Calendar Simulation Controls (IA Tática + Partida por Partida) */}
      <div className="bg-[#14171f] border border-[#b5ff00]/25 rounded-[24px] p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#b5ff00]" />
              <h3 className="font-display text-lg sm:text-xl font-extrabold uppercase tracking-tight text-white">
                Simulação Automática · Comissão Técnica IA
              </h3>
            </div>
            <p className="text-xs text-zinc-400">
              {isSeasonCompleted
                ? `Todos os compromissos da temporada ${seasonYear} foram concluídos. Confira os campeões, prêmios individuais e avance para ${seasonYear + 1}.`
                : 'O jogo escolhe automaticamente a melhor formação, escalação e tática para cada adversário e simula partida por partida até a data combinada.'}
            </p>
          </div>

          <div className="text-xs font-mono text-zinc-400 shrink-0 bg-[#0b0c10] border border-white/[0.07] px-3 py-1.5 rounded-full">
            Data Atual:{' '}
            <span className="text-[#b5ff00] font-bold">
              {formatCalendarDate(dayOffset, seasonYear)}
            </span>
          </div>
        </div>

        {!isSeasonCompleted && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
            {/* Quick Presets: 1 Month / 6 Months / Full Season */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() =>
                  onStartAutoSimulation(oneMonthTarget, '1 Mês')
                }
                className="text-left p-3.5 rounded-2xl bg-[#0b0c10] hover:bg-white/[0.04] border border-white/10 hover:border-[#b5ff00]/60 transition-all flex flex-col justify-between gap-1.5 group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-base font-extrabold uppercase text-white group-hover:text-[#b5ff00] transition-colors">
                    Simular 1 Mês
                  </span>
                  <FastForward className="w-4 h-4 text-[#b5ff00]" />
                </div>
                <div className="text-[11px] font-mono text-zinc-400">
                  Até {formatCalendarDate(oneMonthTarget, seasonYear).replace(/^[A-Za-zÀ-ÿ]+,\s*/, '')}
                </div>
                <div className="text-[10px] font-mono text-[#b5ff00]/90 font-bold">
                  ~{oneMonthMatches} jogo(s) no período
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  onStartAutoSimulation(sixMonthsTarget, '6 Meses')
                }
                className="text-left p-3.5 rounded-2xl bg-[#0b0c10] hover:bg-white/[0.04] border border-white/10 hover:border-[#b5ff00]/60 transition-all flex flex-col justify-between gap-1.5 group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-base font-extrabold uppercase text-white group-hover:text-[#b5ff00] transition-colors">
                    Simular 6 Meses
                  </span>
                  <FastForward className="w-4 h-4 text-[#b5ff00]" />
                </div>
                <div className="text-[11px] font-mono text-zinc-400">
                  Até {formatCalendarDate(sixMonthsTarget, seasonYear).replace(/^[A-Za-zÀ-ÿ]+,\s*/, '')}
                </div>
                <div className="text-[10px] font-mono text-[#b5ff00]/90 font-bold">
                  ~{sixMonthsMatches} jogo(s) no período
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  onStartAutoSimulation(
                    maxSeasonDayOffset,
                    `Temporada Inteira ${seasonYear}`
                  )
                }
                className="text-left p-3.5 rounded-2xl bg-[#0b0c10] hover:bg-white/[0.04] border border-[#b5ff00]/30 hover:border-[#b5ff00] transition-all flex flex-col justify-between gap-1.5 group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-base font-extrabold uppercase text-[#b5ff00]">
                    Temporada Inteira
                  </span>
                  <Trophy className="w-4 h-4 text-[#b5ff00]" />
                </div>
                <div className="text-[11px] font-mono text-zinc-400">
                  Até 31 Dez {seasonYear} (Final)
                </div>
                <div className="text-[10px] font-mono text-white font-bold">
                  {fullSeasonMatches} compromisso(s) restante(s)
                </div>
              </button>
            </div>

            {/* Custom Date Picker ("Até data de escolha no calendário") */}
            <div className="lg:col-span-5 p-3.5 rounded-2xl bg-[#0b0c10] border border-white/10 flex flex-col justify-between gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <CalendarClock className="w-4 h-4 text-[#b5ff00]" />
                  <span>Até Data Escolhida no Calendário</span>
                </span>
                <span className="text-[10px] font-mono text-zinc-400">
                  ~{customTargetMatches} jogo(s)
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="date"
                  aria-label="Escolher data limite da simulação"
                  min={dayOffsetToIsoDate(dayOffset, seasonYear)}
                  max={dayOffsetToIsoDate(maxSeasonDayOffset, seasonYear)}
                  value={dayOffsetToIsoDate(effectiveCustomTarget, seasonYear)}
                  onChange={(e) => {
                    const parsed = isoDateToDayOffset(e.target.value, seasonYear);
                    if (parsed !== null) {
                      const clamped = Math.min(
                        maxSeasonDayOffset,
                        Math.max(dayOffset, parsed)
                      );
                      setCustomTargetDayOffset(clamped);
                      const targetD = dayOffsetToDate(clamped, seasonYear);
                      setSelectedMonth(targetD.getMonth());
                      setScopeMode('MONTH');
                    }
                  }}
                  className="flex-1 bg-[#14171f] border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#b5ff00]"
                />
                <button
                  type="button"
                  onClick={() =>
                    onStartAutoSimulation(
                      effectiveCustomTarget,
                      formatCalendarDate(effectiveCustomTarget, seasonYear)
                    )
                  }
                  className="px-4 py-2 rounded-xl bg-[#b5ff00] hover:bg-[#c8ff33] text-[#090a0f] text-xs font-extrabold whitespace-nowrap flex items-center justify-center gap-1.5 shadow transition-colors"
                >
                  <FastForward className="w-3.5 h-3.5" />
                  <span>
                    Simular até{' '}
                    {formatCalendarDate(effectiveCustomTarget, seasonYear)
                      .replace(/^[A-Za-zÀ-ÿ]+,\s*/, '')
                      .replace(new RegExp(`\\s*${seasonYear}$`), '')}
                  </span>
                </button>
              </div>
              <div className="text-[10px] text-zinc-500">
                Dica: clique em qualquer dia futuro na grade mensal abaixo ou em uma partida para definir a data.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 12-Month Annual Overview Grid */}
      <div className="bg-[#14171f] border border-white/[0.08] rounded-[24px] p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#b5ff00]" />
            <h3 className="font-display text-base font-extrabold uppercase tracking-tight text-white">
              VISÃO DOS 12 MESES DE {seasonYear}
            </h3>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-zinc-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#b5ff00]" />
              Brasileirão
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Copa do Brasil
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-400" />
              Libertadores
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
          {monthSummaries.map((m) => {
            const isSelected = scopeMode === 'MONTH' && selectedMonth === m.idx;
            const isCurrent = currentMonthIndex === m.idx;

            return (
              <button
                key={m.idx}
                type="button"
                onClick={() => {
                  setSelectedMonth(m.idx);
                  setScopeMode('MONTH');
                }}
                className={`text-left p-3 rounded-2xl border transition-all flex flex-col justify-between min-h-[104px] ${
                  isSelected
                    ? 'bg-[#b5ff00] text-[#090a0f] border-[#b5ff00] shadow-lg'
                    : isCurrent
                    ? 'bg-[#0b0c10] text-white border-[#b5ff00]/50 hover:border-[#b5ff00]'
                    : 'bg-[#0b0c10] text-zinc-200 border-white/[0.07] hover:border-white/25'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-display text-base font-extrabold uppercase tracking-tight">
                    {m.short}
                  </span>
                  {isCurrent && (
                    <span
                      className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full ${
                        isSelected
                          ? 'bg-[#090a0f] text-[#b5ff00]'
                          : 'bg-[#b5ff00]/20 text-[#b5ff00]'
                      }`}
                    >
                      Atual
                    </span>
                  )}
                </div>

                <div className="my-1.5 space-y-0.5">
                  {m.entries.slice(0, 2).map((entry) => (
                    <div
                      key={entry.step.index}
                      className={`text-[10px] font-mono truncate flex items-center gap-1 ${
                        isSelected ? 'text-[#090a0f]/90 font-semibold' : 'text-zinc-400'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          isSelected
                            ? 'bg-[#090a0f]'
                            : getCompBadge(entry.step.competition).dotClass
                        }`}
                      />
                      <span className="truncate">
                        {String(entry.dayOfMonth).padStart(2, '0')}{' '}
                        {entry.opponentClub
                          ? entry.opponentClub.abbr
                          : entry.step.competition === 'COPA_DO_BRASIL'
                          ? 'CdB'
                          : 'LIB'}
                      </span>
                    </div>
                  ))}
                  {m.entries.length > 2 && (
                    <div
                      className={`text-[10px] font-mono ${
                        isSelected ? 'text-[#090a0f]/75 font-bold' : 'text-zinc-500'
                      }`}
                    >
                      +{m.entries.length - 2} jogo(s)
                    </div>
                  )}
                  {m.entries.length === 0 && (
                    <div
                      className={`text-[10px] ${
                        isSelected ? 'text-[#090a0f]/75' : 'text-zinc-600'
                      }`}
                    >
                      Sem jogos no filtro
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono pt-1 border-t border-current/10">
                  <span>
                    {m.totalMatches === 1 ? '1 jogo' : `${m.totalMatches} jogos`}
                  </span>
                  <div className="flex items-center gap-1">
                    {m.brCount > 0 && (
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isSelected ? 'bg-[#090a0f]' : 'bg-[#b5ff00]'
                        }`}
                      />
                    )}
                    {m.cdbCount > 0 && (
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isSelected ? 'bg-[#090a0f]/70' : 'bg-amber-400'
                        }`}
                      />
                    )}
                    {m.libCount > 0 && (
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isSelected ? 'bg-[#090a0f]/50' : 'bg-sky-400'
                        }`}
                      />
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Monthly Day Grid + Detailed Match Schedule */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left: 7-Column Visual Monthly Calendar */}
        <div className="xl:col-span-5 bg-[#14171f] border border-white/[0.08] rounded-[24px] p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-mono text-zinc-400 uppercase">
                Grade Mensal · {seasonYear}
              </span>
              <h3 className="font-display text-2xl font-extrabold uppercase tracking-tight text-white">
                {MONTH_NAMES[selectedMonth]} {seasonYear}
              </h3>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Mês anterior"
                onClick={() => {
                  setSelectedMonth((prev) => (prev === 0 ? 11 : prev - 1));
                  setScopeMode('MONTH');
                }}
                className="w-8 h-8 rounded-full bg-[#0b0c10] border border-white/10 hover:border-white/25 flex items-center justify-center text-zinc-300"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-label="Próximo mês"
                onClick={() => {
                  setSelectedMonth((prev) => (prev === 11 ? 0 : prev + 1));
                  setScopeMode('MONTH');
                }}
                className="w-8 h-8 rounded-full bg-[#0b0c10] border border-white/10 hover:border-white/25 flex items-center justify-center text-zinc-300"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1.5 text-center">
            {WEEKDAYS_SHORT.map((wd) => (
              <div
                key={wd}
                className="text-[10px] font-mono font-bold text-zinc-500 uppercase py-1"
              >
                {wd}
              </div>
            ))}

            {calendarMonthCells.map((cell, idx) => {
              if (cell.day === null) {
                return <div key={`empty-${idx}`} className="h-14 sm:h-16" />;
              }

              const entry = cell.entry;
              const badge = entry ? getCompBadge(entry.step.competition) : null;
              const isNextMatch = entry?.status === 'NEXT';
              const canSelectAsTarget =
                !isSeasonCompleted && cell.cellOffset !== null && !cell.isPast;

              return (
                <button
                  key={`day-${cell.day}`}
                  type="button"
                  disabled={!canSelectAsTarget}
                  onClick={() => {
                    if (canSelectAsTarget && cell.cellOffset !== null) {
                      setCustomTargetDayOffset(cell.cellOffset);
                    }
                  }}
                  title={
                    canSelectAsTarget && cell.cellOffset !== null
                      ? `Selecionar ${formatCalendarDate(cell.cellOffset, seasonYear)} como data limite da simulação`
                      : undefined
                  }
                  className={`h-14 sm:h-16 rounded-xl p-1 sm:p-1.5 border flex flex-col justify-between text-left transition-all ${
                    isNextMatch
                      ? 'bg-[#b5ff00] text-[#090a0f] border-[#b5ff00] shadow-md'
                      : cell.isSelectedTarget
                      ? 'bg-[#b5ff00]/15 text-white border-[#b5ff00] ring-1 ring-[#b5ff00]'
                      : entry
                      ? 'bg-[#0b0c10] text-white border-white/15 hover:border-white/35'
                      : cell.isToday
                      ? 'bg-[#0b0c10] text-white border-[#b5ff00]/60'
                      : canSelectAsTarget
                      ? 'bg-[#0b0c10]/60 text-zinc-400 border-white/[0.06] hover:border-[#b5ff00]/40 hover:text-zinc-200'
                      : 'bg-[#0b0c10]/40 text-zinc-600 border-white/[0.03] cursor-default'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span
                      className={`text-[11px] font-mono tabular-nums font-bold leading-none ${
                        cell.isToday && !isNextMatch ? 'text-[#b5ff00]' : ''
                      }`}
                    >
                      {cell.day}
                    </span>
                    {cell.isSelectedTarget && !isNextMatch ? (
                      <span
                        className="text-[8px] font-mono font-extrabold uppercase px-1 rounded bg-[#b5ff00] text-[#090a0f]"
                        title="Data limite selecionada"
                      >
                        Meta
                      </span>
                    ) : (
                      cell.isToday && (
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isNextMatch ? 'bg-[#090a0f]' : 'bg-[#b5ff00]'
                          }`}
                          title="Data Atual"
                        />
                      )
                    )}
                  </div>

                  {entry && badge && (
                    <div className="min-w-0 w-full">
                      <div className="flex items-center gap-1">
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            isNextMatch ? 'bg-[#090a0f]' : badge.dotClass
                          }`}
                        />
                        <span className="text-[9px] font-mono font-extrabold truncate leading-tight">
                          {entry.opponentClub
                            ? entry.opponentClub.abbr
                            : badge.short}
                        </span>
                      </div>
                      <div
                        className={`text-[8px] font-mono truncate leading-none mt-0.5 ${
                          isNextMatch ? 'text-[#090a0f]/80 font-bold' : 'text-zinc-400'
                        }`}
                      >
                        {entry.scoreLabel
                          ? entry.scoreLabel.replace(/\s+/g, '')
                          : badge.short}
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Chronological Fixtures List */}
        <div className="xl:col-span-7 bg-[#14171f] border border-white/[0.08] rounded-[24px] p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/[0.07]">
            <div>
              <h3 className="font-display text-xl font-extrabold uppercase tracking-tight text-white">
                {scopeMode === 'ALL_YEAR'
                  ? `CRONOGRAMA COMPLETO · ${seasonYear}`
                  : `AGENDA DE ${MONTH_NAMES[selectedMonth].toUpperCase()} ${seasonYear}`}
              </h3>
              <span className="text-xs text-zinc-400">
                {visibleEntries.length === 1
                  ? '1 data exibida no calendário'
                  : `${visibleEntries.length} datas exibidas no calendário`}
              </span>
            </div>

            <div className="flex items-center gap-1 bg-[#0b0c10] border border-white/[0.08] rounded-full p-1">
              <button
                type="button"
                onClick={() => setScopeMode('MONTH')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                  scopeMode === 'MONTH'
                    ? 'bg-[#b5ff00] text-[#090a0f]'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Mês ({MONTH_SHORT[selectedMonth]})
              </button>
              <button
                type="button"
                onClick={() => setScopeMode('ALL_YEAR')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                  scopeMode === 'ALL_YEAR'
                    ? 'bg-[#b5ff00] text-[#090a0f]'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Ano Inteiro ({SEASON_CALENDAR.length})
              </button>
            </div>
          </div>

          <div className="space-y-2.5 max-h-[640px] overflow-y-auto pr-1">
            {visibleEntries.length === 0 ? (
              <div className="py-10 text-center text-sm text-zinc-400 bg-[#0b0c10] rounded-2xl border border-white/[0.06]">
                Nenhuma partida encontrada para {MONTH_NAMES[selectedMonth]} neste filtro.
              </div>
            ) : (
              visibleEntries.map((entry) => {
                const badge = getCompBadge(entry.step.competition);
                const CompIcon = badge.Icon;
                const isNext = entry.status === 'NEXT';
                const dateTag = `${String(entry.dayOfMonth).padStart(2, '0')} ${
                  MONTH_SHORT[entry.monthIndex]
                }`;

                return (
                  <div
                    key={entry.step.index}
                    className={`rounded-2xl p-3.5 sm:p-4 border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isNext
                        ? 'bg-[#b5ff00] text-[#090a0f] border-[#b5ff00] shadow-xl'
                        : 'bg-[#0b0c10] text-white border-white/[0.07]'
                    }`}
                  >
                    {/* Left: Date + Competition + Matchup */}
                    <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                      <div
                        className={`w-14 shrink-0 rounded-xl py-2 px-1 text-center border ${
                          isNext
                            ? 'bg-[#090a0f] text-[#b5ff00] border-[#090a0f]'
                            : 'bg-[#14171f] text-zinc-200 border-white/[0.07]'
                        }`}
                      >
                        <div className="font-mono text-xs font-extrabold leading-none">
                          {dateTag}
                        </div>
                        <div className="text-[10px] font-mono opacity-75 mt-1 uppercase">
                          {entry.weekdayShort} · {entry.kickoffTime}
                        </div>
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              isNext
                                ? 'bg-[#090a0f]/15 text-[#090a0f] border-[#090a0f]/25'
                                : badge.pillClass
                            }`}
                          >
                            <CompIcon className="w-3 h-3" />
                            <span>{badge.label}</span>
                          </span>
                          <span
                            className={`text-[11px] font-mono ${
                              isNext ? 'text-[#090a0f]/80 font-bold' : 'text-zinc-400'
                            }`}
                          >
                            {entry.step.label.split('·')[1]?.trim() || entry.step.label}
                          </span>
                        </div>

                        {entry.opponentClub ? (
                          <div className="flex items-center gap-2 min-w-0">
                            <ClubBadge
                              clubId={entry.opponentClub.id}
                              abbr={entry.opponentClub.abbr}
                              name={entry.opponentClub.name}
                              primaryColor={entry.opponentClub.primaryColor}
                              size="sm"
                              surface={isNext ? 'light' : 'dark'}
                            />
                            <div className="min-w-0">
                              <div className="font-display text-base font-extrabold uppercase tracking-tight truncate">
                                {entry.isUserHome ? 'Casa · ' : 'Fora · '}
                                {entry.opponentClub.shortName}
                                {entry.opponentClub.countryCode && (
                                  <span className="ml-1.5 text-[11px] font-mono font-normal opacity-75">
                                    ({entry.opponentClub.countryCode})
                                  </span>
                                )}
                              </div>
                              <div
                                className={`text-[11px] flex items-center gap-1 truncate ${
                                  isNext ? 'text-[#090a0f]/80' : 'text-zinc-500'
                                }`}
                              >
                                <MapPin className="w-3 h-3 shrink-0" />
                                <span className="truncate">{entry.stadium}</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs font-medium text-zinc-400">
                            {entry.status === 'NOT_PARTICIPATING'
                              ? 'Clube não classificado para esta competição'
                              : entry.status === 'ELIMINATED'
                              ? 'Clube eliminado em fase anterior'
                              : 'Adversário a definir conforme chaveamento'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Status / Score / CTA */}
                    <div className="flex items-center justify-end gap-2 shrink-0">
                      {entry.status === 'PLAYED' && entry.scoreLabel && (
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <div className="font-mono text-sm font-extrabold tabular-nums text-white">
                              {entry.scoreLabel}
                            </div>
                            {entry.penaltiesLabel && (
                              <div className="text-[10px] font-mono text-[#b5ff00]">
                                {entry.penaltiesLabel}
                              </div>
                            )}
                          </div>
                          <span
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold ${
                              entry.outcome === 'V'
                                ? 'bg-[#b5ff00] text-[#090a0f]'
                                : entry.outcome === 'E'
                                ? 'bg-zinc-600 text-white'
                                : 'bg-rose-500/80 text-white'
                            }`}
                          >
                            {entry.outcome}
                          </span>
                        </div>
                      )}

                      {isNext && (
                        <button
                          type="button"
                          onClick={onGoToMatch}
                          className="px-3.5 py-2 rounded-full bg-[#090a0f] hover:bg-zinc-900 text-[#b5ff00] text-xs font-extrabold flex items-center gap-1.5 shadow"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Jogar</span>
                        </button>
                      )}

                      {entry.status === 'SCHEDULED' && (
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#14171f] border border-white/[0.08] text-[11px] font-mono text-zinc-300">
                            <CheckCircle2 className="w-3 h-3 text-[#b5ff00]" />
                            Confirmado
                          </span>
                          {!isSeasonCompleted && (
                            <button
                              type="button"
                              onClick={() => {
                                const targetOff =
                                  entry.step.dayOffset ?? entry.step.index * 9;
                                onStartAutoSimulation(
                                  targetOff,
                                  `Até ${dateTag} (${entry.opponentClub?.shortName || badge.short})`
                                );
                              }}
                              title={`Simular partida por partida até ${dateTag}`}
                              className="px-2.5 py-1 rounded-full bg-[#b5ff00]/15 hover:bg-[#b5ff00] text-[#b5ff00] hover:text-[#090a0f] border border-[#b5ff00]/30 text-[10px] font-extrabold transition-colors flex items-center gap-1"
                            >
                              <FastForward className="w-3 h-3" />
                              <span className="hidden sm:inline">Simular até aqui</span>
                            </button>
                          )}
                        </div>
                      )}

                      {entry.status === 'TBD' && (
                        <div className="flex items-center gap-1.5">
                          <span className="px-2.5 py-1 rounded-full bg-[#14171f] border border-white/[0.08] text-[11px] font-mono text-zinc-400">
                            A definir
                          </span>
                          {!isSeasonCompleted && (
                            <button
                              type="button"
                              onClick={() => {
                                const targetOff =
                                  entry.step.dayOffset ?? entry.step.index * 9;
                                onStartAutoSimulation(
                                  targetOff,
                                  `Até ${dateTag}`
                                );
                              }}
                              title={`Simular até ${dateTag}`}
                              className="px-2.5 py-1 rounded-full bg-white/[0.05] hover:bg-[#b5ff00] text-zinc-300 hover:text-[#090a0f] border border-white/10 text-[10px] font-bold transition-colors flex items-center gap-1"
                            >
                              <FastForward className="w-3 h-3" />
                              <span className="hidden sm:inline">Simular até aqui</span>
                            </button>
                          )}
                        </div>
                      )}

                      {(entry.status === 'ELIMINATED' ||
                        entry.status === 'NOT_PARTICIPATING') && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/[0.06] text-[11px] text-zinc-500">
                          <XCircle className="w-3 h-3" />
                          {entry.status === 'NOT_PARTICIPATING'
                            ? 'Fora'
                            : 'Eliminado'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
