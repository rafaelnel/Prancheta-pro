import React, { useEffect, useMemo, useState } from 'react';
import {
  Inbox,
  Users,
  Sliders,
  PlayCircle,
  Trophy,
  Wallet,
  Calendar,
  ShieldCheck,
  ChevronRight,
  Play,
  Activity,
} from 'lucide-react';
import {
  INITIAL_CLUBS,
  INITIAL_INBOX_MESSAGES,
  INITIAL_STANDINGS,
  INITIAL_USER_SQUAD,
  USER_CLUB_ID,
  generateLeagueSchedule,
} from './data/initialDatabase';
import { FORMATIONS, getRoleById } from './data/tacticsData';
import {
  buildPitchTokens,
  calculatePlayerOverall,
  createInitialMatchState,
  simulateRoundFixtures,
  stepMatchMinute,
  updateStandingsWithRound,
} from './engine/matchEngine';
import {
  Club,
  FormationType,
  InboxMessage,
  LiveMatchState,
  MentalityType,
  NavigationTab,
  Player,
  RoundFixture,
  StandingsRow,
  TacticalDuty,
  TeamInstructions,
} from './types/football';
import {
  formatCalendarDate,
  formatCompactBRL,
} from './utils/formatters';
import { DashboardInbox } from './components/DashboardInbox';
import { SquadView } from './components/SquadView';
import { TacticalBoard } from './components/TacticalBoard';
import { MatchEngineView } from './components/MatchEngineView';
import { CompetitionsView } from './components/CompetitionsView';
import { FinancesView } from './components/FinancesView';
import { PlayerProfileModal } from './components/PlayerProfileModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavigationTab>('inbox');
  const [clubs, setClubs] = useState<Club[]>(INITIAL_CLUBS);
  const [squad, setSquad] = useState<Player[]>(INITIAL_USER_SQUAD);
  const [standings, setStandings] =
    useState<StandingsRow[]>(INITIAL_STANDINGS);
  const [fixtures, setFixtures] = useState<RoundFixture[]>(() =>
    generateLeagueSchedule()
  );
  const [messages, setMessages] = useState<InboxMessage[]>(
    INITIAL_INBOX_MESSAGES
  );

  // Calendar & Round Progression
  const [currentRound, setCurrentRound] = useState<number>(6);
  const [dayOffset, setDayOffset] = useState<number>(0); // 0 = Sáb 16 Mai (Véspera), 1 = Dom 17 Mai (Dia de Jogo)
  const [isMatchDay, setIsMatchDay] = useState<boolean>(false);

  // Modal state for inspecting 18 attributes of any player
  const [inspectedPlayerId, setInspectedPlayerId] = useState<string | null>(
    null
  );

  const userClub = useMemo(
    () => clubs.find((c) => c.id === USER_CLUB_ID) || clubs[0],
    [clubs]
  );

  const currentUserFixture = useMemo(
    () =>
      fixtures.find(
        (f) => f.roundNumber === currentRound && f.isUserMatch
      ) || fixtures[0],
    [fixtures, currentRound]
  );

  const homeClub = useMemo(
    () =>
      clubs.find((c) => c.id === currentUserFixture.homeClubId) || clubs[0],
    [clubs, currentUserFixture]
  );

  const awayClub = useMemo(
    () =>
      clubs.find((c) => c.id === currentUserFixture.awayClubId) || clubs[1],
    [clubs, currentUserFixture]
  );

  const opponentClub = useMemo(
    () =>
      currentUserFixture.homeClubId === USER_CLUB_ID ? awayClub : homeClub,
    [currentUserFixture, homeClub, awayClub]
  );

  const [matchState, setMatchState] = useState<LiveMatchState>(() =>
    createInitialMatchState(
      6,
      currentUserFixture,
      homeClub,
      awayClub,
      INITIAL_USER_SQUAD
    )
  );

  // Sync body dataset state for testing & accessibility
  useEffect(() => {
    if (activeTab === 'match') {
      if (matchState.phase === 'FULL_TIME') {
        document.body.dataset.state = 'gameover';
      } else if (matchState.isRunning) {
        document.body.dataset.state = 'playing';
      } else {
        document.body.dataset.state = 'paused';
      }
    } else {
      document.body.dataset.state = 'playing';
    }
  }, [activeTab, matchState.phase, matchState.isRunning]);

  // Process automatic round simulation & standings update when match reaches 90' FULL_TIME
  useEffect(() => {
    if (matchState.phase === 'FULL_TIME' && !matchState.roundProcessed) {
      const updatedFixtures = simulateRoundFixtures(
        fixtures,
        matchState.roundNumber,
        {
          fixtureId: matchState.fixtureId,
          homeGoals: matchState.homeGoals,
          awayGoals: matchState.awayGoals,
          homeXG: matchState.homeXG,
          awayXG: matchState.awayXG,
        },
        clubs
      );

      const roundCompletedFixtures = updatedFixtures.filter(
        (f) => f.roundNumber === matchState.roundNumber
      );

      const newStandings = updateStandingsWithRound(
        standings,
        roundCompletedFixtures
      );

      const userGoals = matchState.isUserHome
        ? matchState.homeGoals
        : matchState.awayGoals;
      const oppGoals = matchState.isUserHome
        ? matchState.awayGoals
        : matchState.homeGoals;
      const userWon = userGoals > oppGoals;
      const userDrew = userGoals === oppGoals;

      // Update club cash balance (gate receipts) and board confidence
      const gateRevenue = matchState.isUserHome ? 3800000 : 950000;
      const confidenceDelta = userWon ? 4 : userDrew ? 1 : -4;

      setClubs((prev) =>
        prev.map((c) =>
          c.id === USER_CLUB_ID
            ? {
                ...c,
                cashBalance: c.cashBalance + gateRevenue,
                boardConfidence: Math.min(
                  100,
                  Math.max(30, c.boardConfidence + confidenceDelta)
                ),
              }
            : c
        )
      );

      // Update player condition & season stats from match tokens
      const userTokens = matchState.isUserHome
        ? matchState.homeTokens
        : matchState.awayTokens;
      const tokenMap = new Map(userTokens.map((t) => [t.id, t]));

      setSquad((prev) =>
        prev.map((p) => {
          const tok = tokenMap.get(p.id);
          if (!tok) return p;
          return {
            ...p,
            condition: Math.max(55, Math.round(tok.condition)),
            seasonStats: {
              ...p.seasonStats,
              matches: p.seasonStats.matches + 1,
            },
          };
        })
      );

      // Add post-match report to Inbox
      const userPos =
        newStandings.findIndex((s) => s.clubId === USER_CLUB_ID) + 1;
      const resultLabel = userWon
        ? 'Vitória maiúscula'
        : userDrew
        ? 'Empate disputado'
        : 'Revés doloroso';

      const postMatchMsg: InboxMessage = {
        id: `msg-post-r${matchState.roundNumber}`,
        date: `${formatCalendarDate(dayOffset)} · 20:15`,
        sender: 'Ricardo Valentim',
        senderRole: 'Auxiliar Técnico',
        subject: `Relatório Pós-Jogo (${matchState.roundNumber}ª Rodada): ${homeClub.shortName} ${matchState.homeGoals} x ${matchState.awayGoals} ${awayClub.shortName}`,
        category: 'Pós-Jogo',
        priority: userWon ? 'positive' : userDrew ? 'normal' : 'warning',
        read: false,
        body: [
          `${resultLabel} na ${matchState.roundNumber}ª Rodada da Liga Nacional! O placar final de ${homeClub.shortName} ${matchState.homeGoals} x ${matchState.awayGoals} ${awayClub.shortName} refletiu um índice de Gols Esperados (xG) de ${matchState.homeXG.toFixed(2)} contra ${matchState.awayXG.toFixed(2)}.`,
          `Com os outros 9 jogos da rodada concluídos, o ${userClub.name} ocupa agora a ${userPos}ª colocação na tabela geral. A receita de bilheteria e matchday adicionou ${formatCompactBRL(gateRevenue)} aos cofres do clube.`,
        ],
        bulletPoints: [
          `Placar Final: ${homeClub.shortName} ${matchState.homeGoals} x ${matchState.awayGoals} ${awayClub.shortName}`,
          `Finalizações: ${matchState.homeShots} (${matchState.homeShotsOnTarget} no alvo) vs ${matchState.awayShots} (${matchState.awayShotsOnTarget} no alvo)`,
          `Posição Atual na Liga Nacional: ${userPos}º lugar`,
        ],
        actionLabel: 'Conferir Tabela Atualizada (20 Clubes)',
        actionTargetTab: 'competitions',
      };

      setFixtures(updatedFixtures);
      setStandings(newStandings);
      setMessages((prev) => [postMatchMsg, ...prev]);
      setMatchState((prev) => ({ ...prev, roundProcessed: true }));
    }
  }, [
    matchState.phase,
    matchState.roundProcessed,
    matchState.roundNumber,
    matchState.fixtureId,
    matchState.homeGoals,
    matchState.awayGoals,
    matchState.homeXG,
    matchState.awayXG,
    matchState.homeShots,
    matchState.awayShots,
    matchState.homeShotsOnTarget,
    matchState.awayShotsOnTarget,
    matchState.isUserHome,
    matchState.homeTokens,
    matchState.awayTokens,
    fixtures,
    clubs,
    standings,
    dayOffset,
    homeClub.shortName,
    awayClub.shortName,
    userClub.name,
  ]);

  // Live Match Simulation Timer
  useEffect(() => {
    if (!matchState.isRunning || matchState.phase === 'FULL_TIME') return;

    const intervalMs =
      matchState.speed === 4 ? 75 : matchState.speed === 2 ? 165 : 320;

    const timer = window.setInterval(() => {
      setMatchState((prev) => {
        if (!prev.isRunning || prev.phase === 'FULL_TIME') return prev;
        return stepMatchMinute(prev, homeClub, awayClub, squad);
      });
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [
    matchState.isRunning,
    matchState.speed,
    matchState.phase,
    homeClub,
    awayClub,
    squad,
  ]);

  // Handlers
  const handleMarkMessageRead = (id: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, read: true } : m))
    );
  };

  const handleUpdateRoleDuty = (
    playerId: string,
    roleId: string,
    duty: TacticalDuty
  ) => {
    setSquad((prev) =>
      prev.map((p) =>
        p.id === playerId
          ? { ...p, assignedRole: roleId, assignedDuty: duty }
          : p
      )
    );
  };

  const handleSwapPlayers = (playerAId: string, playerBId: string) => {
    setSquad((prev) => {
      const playerA = prev.find((p) => p.id === playerAId);
      const playerB = prev.find((p) => p.id === playerBId);
      if (!playerA || !playerB) return prev;

      const updated = prev.map((p) => {
        if (p.id === playerAId) {
          return {
            ...p,
            isStarter: playerB.isStarter,
            slotIndex: playerB.slotIndex,
          };
        }
        if (p.id === playerBId) {
          return {
            ...p,
            isStarter: playerA.isStarter,
            slotIndex: playerA.slotIndex,
          };
        }
        return p;
      });

      // If match hasn't started yet, sync pitch tokens
      if (matchState.phase === 'PRE_MATCH') {
        const { homeTokens, awayTokens } = buildPitchTokens(
          homeClub,
          awayClub,
          updated,
          matchState.isUserHome
        );
        setMatchState((m) => ({ ...m, homeTokens, awayTokens }));
      }

      return updated;
    });
  };

  const handleQuickSwapFatiguedPlayer = () => {
    // Swap Caio Vinícius (p6) with Aníbal Moreno (p17)
    const caio = squad.find((p) => p.id === 'p6');
    const anibal = squad.find((p) => p.id === 'p17');
    if (caio && anibal && caio.isStarter && !anibal.isStarter) {
      handleSwapPlayers('p6', 'p17');
    }
  };

  const handleAutoPickBestXI = () => {
    const slots = FORMATIONS[userClub.formation];
    const pool = [...squad].filter((p) => !p.injured);
    const chosenIds = new Set<string>();
    const slotAssignments = new Map<string, number>();

    slots.forEach((slot) => {
      const candidates = pool
        .filter((p) => !chosenIds.has(p.id))
        .sort((a, b) => {
          const aMatch =
            a.position === slot.label
              ? 3
              : a.sector === slot.sector
              ? 1.5
              : 0;
          const bMatch =
            b.position === slot.label
              ? 3
              : b.sector === slot.sector
              ? 1.5
              : 0;
          const aScore =
            calculatePlayerOverall(a.attributes, a.position) +
            aMatch +
            a.condition * 0.05;
          const bScore =
            calculatePlayerOverall(b.attributes, b.position) +
            bMatch +
            b.condition * 0.05;
          return bScore - aScore;
        });

      if (candidates[0]) {
        chosenIds.add(candidates[0].id);
        slotAssignments.set(candidates[0].id, slot.slotIndex);
      }
    });

    setSquad((prev) =>
      prev.map((p) => {
        if (slotAssignments.has(p.id)) {
          const sIdx = slotAssignments.get(p.id)!;
          const slotDef = slots[sIdx];
          return {
            ...p,
            isStarter: true,
            slotIndex: sIdx,
            assignedRole: slotDef.defaultRole,
            assignedDuty: slotDef.defaultDuty,
          };
        }
        return {
          ...p,
          isStarter: false,
          slotIndex: null,
        };
      })
    );
  };

  const handleChangeFormation = (formation: FormationType) => {
    const slots = FORMATIONS[formation];
    setClubs((prev) =>
      prev.map((c) => (c.id === USER_CLUB_ID ? { ...c, formation } : c))
    );

    setSquad((prev) => {
      const starters = [...prev]
        .filter((p) => p.isStarter)
        .sort((a, b) => (a.slotIndex ?? 0) - (b.slotIndex ?? 0));

      const starterSlotMap = new Map<string, number>();
      starters.forEach((st, idx) => {
        starterSlotMap.set(st.id, idx);
      });

      const updated = prev.map((p) => {
        if (!p.isStarter) return p;
        const sIdx = starterSlotMap.get(p.id) ?? 0;
        const slot = slots[sIdx] || slots[0];
        return {
          ...p,
          slotIndex: sIdx,
          assignedRole: slot.defaultRole,
          assignedDuty: slot.defaultDuty,
        };
      });

      if (matchState.phase === 'PRE_MATCH') {
        const updatedUserClub = { ...userClub, formation };
        const nextHome = matchState.isUserHome ? updatedUserClub : homeClub;
        const nextAway = !matchState.isUserHome ? updatedUserClub : awayClub;
        const { homeTokens, awayTokens } = buildPitchTokens(
          nextHome,
          nextAway,
          updated,
          matchState.isUserHome
        );
        setMatchState((m) => ({ ...m, homeTokens, awayTokens }));
      }

      return updated;
    });
  };

  const handleChangeInstructions = (instructions: TeamInstructions) => {
    setClubs((prev) =>
      prev.map((c) => (c.id === USER_CLUB_ID ? { ...c, instructions } : c))
    );
  };

  const handleChangeLiveMentality = (mentality: MentalityType) => {
    handleChangeInstructions({
      ...userClub.instructions,
      mentality,
    });
  };

  const handleMakeLiveSubstitution = (
    starterOutId: string,
    reserveInId: string
  ) => {
    const starterOut = squad.find((p) => p.id === starterOutId);
    const reserveIn = squad.find((p) => p.id === reserveInId);
    if (!starterOut || !reserveIn) return;

    handleSwapPlayers(starterOutId, reserveInId);

    const role = getRoleById(reserveIn.assignedRole);
    const parts = reserveIn.name.split(' ');
    const shortName = parts[parts.length - 1];

    setMatchState((prev) => {
      const replaceToken = (tokens: typeof prev.homeTokens) =>
        tokens.map((t) =>
          t.id === starterOut.id
            ? {
                ...t,
                id: reserveIn.id,
                number: reserveIn.number,
                name: reserveIn.name,
                shortName,
                sector: reserveIn.sector,
                roleCode: role.shortCode,
                condition: reserveIn.condition,
                rating: 6.8,
              }
            : t
        );

      const subEventText = `${prev.minute}' — Substituição no ${userClub.shortName}: Sai #${starterOut.number} ${starterOut.name} (${Math.round(starterOut.condition)}%) e entra #${reserveIn.number} ${reserveIn.name} (${Math.round(reserveIn.condition)}%).`;

      return {
        ...prev,
        substitutionsMade: prev.substitutionsMade + 1,
        homeTokens: prev.isUserHome
          ? replaceToken(prev.homeTokens)
          : prev.homeTokens,
        awayTokens: !prev.isUserHome
          ? replaceToken(prev.awayTokens)
          : prev.awayTokens,
        lastActionLabel: subEventText,
        events: [
          {
            id: `evt-sub-${prev.minute}-${Date.now()}`,
            minute: prev.minute,
            type: 'SUBSTITUICAO',
            team: prev.isUserHome ? 'HOME' : 'AWAY',
            text: subEventText,
          },
          ...prev.events,
        ],
      };
    });
  };

  const handleStartOrResumeMatch = () => {
    setMatchState((prev) => ({
      ...prev,
      phase:
        prev.phase === 'PRE_MATCH'
          ? 'FIRST_HALF'
          : prev.phase === 'HALF_TIME'
          ? 'SECOND_HALF'
          : prev.phase,
      isRunning: true,
    }));
  };

  const handlePauseMatch = () => {
    setMatchState((prev) => ({
      ...prev,
      isRunning: false,
    }));
  };

  const handleInstantFinishMatch = () => {
    setMatchState((prev) => {
      let current: LiveMatchState = {
        ...prev,
        phase:
          prev.phase === 'PRE_MATCH'
            ? 'FIRST_HALF'
            : prev.phase === 'HALF_TIME'
            ? 'SECOND_HALF'
            : prev.phase,
        isRunning: true,
      };

      let guard = 0;
      while (current.phase !== 'FULL_TIME' && guard < 120) {
        guard++;
        if (current.phase === 'HALF_TIME') {
          current = { ...current, phase: 'SECOND_HALF', isRunning: true };
        }
        current = stepMatchMinute(current, homeClub, awayClub, squad);
      }
      return current;
    });
  };

  const handleAdvanceToNextRound = () => {
    const nextRound = Math.min(19, currentRound + 1);
    const nextRoundFixture =
      fixtures.find((f) => f.roundNumber === nextRound && f.isUserMatch) ||
      fixtures[0];
    const nextHome =
      clubs.find((c) => c.id === nextRoundFixture.homeClubId) || clubs[0];
    const nextAway =
      clubs.find((c) => c.id === nextRoundFixture.awayClubId) || clubs[1];

    // Recover squad condition between rounds
    const recoveredSquad = squad.map((p) => ({
      ...p,
      condition: Math.min(99, p.condition + 14),
    }));
    setSquad(recoveredSquad);
    setCurrentRound(nextRound);
    setDayOffset((d) => d + 6);
    setIsMatchDay(false);
    setMatchState(
      createInitialMatchState(
        nextRound,
        nextRoundFixture,
        nextHome,
        nextAway,
        recoveredSquad
      )
    );
    setActiveTab('competitions');
  };

  const handlePrimaryHeaderAction = () => {
    if (activeTab === 'match') {
      if (matchState.phase === 'FULL_TIME') {
        handleAdvanceToNextRound();
      } else if (!matchState.isRunning) {
        handleStartOrResumeMatch();
      } else {
        handlePauseMatch();
      }
      return;
    }

    if (!isMatchDay) {
      // Advance calendar to Matchday!
      setDayOffset((d) => d + 1);
      setIsMatchDay(true);
      setSquad((prev) =>
        prev.map((p) => ({
          ...p,
          condition: Math.min(99, p.condition + 3),
        }))
      );
      return;
    }

    // It is Matchday -> Go to live 2D Match Engine!
    setActiveTab('match');
  };

  const inspectedPlayer = useMemo(
    () => squad.find((p) => p.id === inspectedPlayerId) || null,
    [squad, inspectedPlayerId]
  );

  const unreadInboxCount = messages.filter((m) => !m.read).length;
  const userRank =
    standings.findIndex((s) => s.clubId === USER_CLUB_ID) + 1;

  const primaryActionLabel =
    activeTab === 'match'
      ? matchState.phase === 'FULL_TIME'
        ? 'Concluir Rodada e Ver Tabela'
        : matchState.isRunning
        ? `Em Jogo (${matchState.minute}') · Pausar`
        : matchState.phase === 'HALF_TIME'
        ? 'Iniciar 2º Tempo'
        : 'Apito Inicial (0\')'
      : isMatchDay
      ? `Ir para o Jogo (${currentRound}ª Rodada)`
      : 'Continuar Calendário';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Fixed Sidebar Navigation */}
      <aside className="w-60 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0 select-none">
        <div>
          {/* Brand Lockup */}
          <div className="h-16 px-5 border-b border-slate-800 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center font-mono font-bold text-slate-950 text-sm">
              FM
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-slate-100 leading-none">
                Prancheta Pro
              </div>
              <div className="text-[11px] text-emerald-400 font-mono mt-1 leading-none">
                Edição Brasil 2026
              </div>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav
            className="p-3 space-y-1"
            aria-label="Navegação principal do clube"
          >
            {(
              [
                {
                  id: 'inbox',
                  label: 'Início / Inbox',
                  icon: Inbox,
                  badge: unreadInboxCount > 0 ? String(unreadInboxCount) : null,
                },
                {
                  id: 'squad',
                  label: 'Elenco',
                  icon: Users,
                  badge: `${squad.length}`,
                },
                {
                  id: 'tactics',
                  label: 'Táticas',
                  icon: Sliders,
                  badge: userClub.formation,
                },
                {
                  id: 'match',
                  label: 'Motor de Partida 2D',
                  icon: PlayCircle,
                  badge:
                    matchState.phase === 'FIRST_HALF' ||
                    matchState.phase === 'SECOND_HALF'
                      ? `${matchState.minute}'`
                      : `R${currentRound}`,
                },
                {
                  id: 'competitions',
                  label: 'Competições',
                  icon: Trophy,
                  badge: `${userRank}º`,
                },
                {
                  id: 'finances',
                  label: 'Finanças',
                  icon: Wallet,
                  badge: null,
                },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-emerald-600 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/70'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="whitespace-nowrap">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`font-mono tabular-nums text-[11px] ${
                        isActive ? 'text-emerald-100' : 'text-slate-400'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Bottom Next Match Summary */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Próximo Compromisso</span>
            <span className="font-mono text-emerald-400">
              {currentRound}ª Rodada
            </span>
          </div>
          <div className="text-xs font-semibold text-slate-200 truncate">
            {homeClub.shortName} vs {awayClub.shortName}
          </div>
          <div className="text-[11px] text-slate-400 truncate">
            {homeClub.stadium}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Persistent Top Header Bar */}
        <header className="h-16 bg-slate-900/95 border-b border-slate-800 px-6 flex items-center justify-between gap-4 shrink-0">
          {/* Left: Club Name & League Status */}
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center font-mono font-bold text-xs text-slate-950 shrink-0"
              style={{ backgroundColor: userClub.primaryColor }}
            >
              {userClub.abbr}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-100 truncate">
                  {userClub.name}
                </h1>
                <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                  · {userRank}º na Liga Nacional
                </span>
              </div>
              <div className="text-xs text-slate-400 truncate">
                {userClub.stadium} · Esquema {userClub.formation} (
                {userClub.instructions.mentality})
              </div>
            </div>
          </div>

          {/* Right: Calendar Date, Cash Balance, Board Confidence (%) & Dynamic Action Button */}
          <div className="flex items-center gap-5 shrink-0">
            {/* Data atual do calendário */}
            <div className="hidden md:flex items-center gap-2 text-xs">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <div>
                <div className="text-[10px] text-slate-400 leading-none">
                  Calendário Oficial
                </div>
                <div className="font-mono tabular-nums font-semibold text-slate-100 mt-0.5">
                  {formatCalendarDate(dayOffset)}
                </div>
              </div>
            </div>

            {/* Saldo em Caixa */}
            <div className="hidden lg:flex items-center gap-2 text-xs border-l border-slate-800 pl-4">
              <Wallet className="w-4 h-4 text-emerald-400" />
              <div>
                <div className="text-[10px] text-slate-400 leading-none">
                  Saldo em Caixa
                </div>
                <div className="font-mono tabular-nums font-semibold text-emerald-400 mt-0.5">
                  {formatCompactBRL(userClub.cashBalance)}
                </div>
              </div>
            </div>

            {/* Confiança da Diretoria (%) */}
            <div className="hidden sm:flex items-center gap-2 text-xs border-l border-slate-800 pl-4">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <div>
                <div className="text-[10px] text-slate-400 leading-none">
                  Confiança da Diretoria
                </div>
                <div className="font-mono tabular-nums font-semibold text-slate-100 mt-0.5">
                  {userClub.boardConfidence}%
                </div>
              </div>
            </div>

            {/* Dynamic Primary Action Button ("Continuar" / "Ir para o Jogo") */}
            <button
              onClick={handlePrimaryHeaderAction}
              className={`px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 whitespace-nowrap shadow-sm ${
                isMatchDay || activeTab === 'match'
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold'
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{primaryActionLabel}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {/* Active Module Viewport */}
        <main className="flex-1 p-6 overflow-y-auto">
          {activeTab === 'inbox' && (
            <DashboardInbox
              messages={messages}
              onMarkMessageRead={handleMarkMessageRead}
              onNavigate={setActiveTab}
              onInspectPlayer={(p) => setInspectedPlayerId(p.id)}
              onQuickSwapFatiguedPlayer={handleQuickSwapFatiguedPlayer}
              userClub={userClub}
              nextFixture={currentUserFixture}
              opponentClub={opponentClub}
              standings={standings}
              clubs={clubs}
              squad={squad}
              currentRound={currentRound}
              isMatchDay={isMatchDay}
              onGoToMatch={() => {
                setIsMatchDay(true);
                setActiveTab('match');
              }}
            />
          )}

          {activeTab === 'squad' && (
            <SquadView
              squad={squad}
              onInspectPlayer={(p) => setInspectedPlayerId(p.id)}
              onSwapPlayers={handleSwapPlayers}
              onAutoPickBestXI={handleAutoPickBestXI}
            />
          )}

          {activeTab === 'tactics' && (
            <TacticalBoard
              squad={squad}
              formation={userClub.formation}
              instructions={userClub.instructions}
              onChangeFormation={handleChangeFormation}
              onChangeInstructions={handleChangeInstructions}
              onUpdateRoleDuty={handleUpdateRoleDuty}
              onSwapPlayers={handleSwapPlayers}
              onInspectPlayer={(p) => setInspectedPlayerId(p.id)}
            />
          )}

          {activeTab === 'match' && (
            <MatchEngineView
              match={matchState}
              homeClub={homeClub}
              awayClub={awayClub}
              squad={squad}
              roundFixtures={fixtures}
              clubs={clubs}
              userMentality={userClub.instructions.mentality}
              onStartOrResume={handleStartOrResumeMatch}
              onPause={handlePauseMatch}
              onSetSpeed={(speed) =>
                setMatchState((prev) => ({ ...prev, speed }))
              }
              onChangeLiveMentality={handleChangeLiveMentality}
              onMakeSubstitution={handleMakeLiveSubstitution}
              onInstantFinishMatch={handleInstantFinishMatch}
              onProceedAfterFullTime={handleAdvanceToNextRound}
            />
          )}

          {activeTab === 'competitions' && (
            <CompetitionsView
              standings={standings}
              clubs={clubs}
              fixtures={fixtures}
              currentRound={currentRound}
            />
          )}

          {activeTab === 'finances' && (
            <FinancesView club={userClub} squad={squad} />
          )}
        </main>
      </div>

      {/* Detailed 18-Attribute Player Profile Modal */}
      <PlayerProfileModal
        player={inspectedPlayer}
        onClose={() => setInspectedPlayerId(null)}
        onUpdateRoleDuty={handleUpdateRoleDuty}
      />
    </div>
  );
}
