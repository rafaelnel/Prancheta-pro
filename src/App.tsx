import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Save,
  Check,
  FolderOpen,
} from 'lucide-react';
import {
  ALL_WORLD_CLUBS,
  INITIAL_INBOX_MESSAGES,
  INITIAL_STANDINGS,
  INITIAL_USER_SQUAD,
  USER_CLUB_ID,
  generateLeagueSchedule,
  getInitialStandingsForDivision,
} from './data/initialDatabase';
import {
  SEASON_CALENDAR,
  advanceCopaDoBrasilStage,
  advanceLibertadoresGroupRound,
  advanceLibertadoresKnockoutStage,
  createInitialCopaDoBrasil,
  createInitialLibertadores,
  findUserFixtureForStep,
  getCupPrizeMoney,
} from './data/cupFactory';
import { createNewCareerSave } from './data/careerFactory';
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
  CareerSaveData,
  CareerSlotIndex,
  Club,
  CopaDoBrasilState,
  FormationType,
  InboxMessage,
  LibertadoresState,
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
  getContrastTextColor,
} from './utils/formatters';
import {
  deleteCareerSlot,
  getLatestCareerSave,
  loadAllCareerSlots,
  loadCareerSlot,
  saveCareerToSlot,
} from './utils/saveManager';
import { CareerHubScreen } from './components/CareerHubScreen';
import { DashboardInbox } from './components/DashboardInbox';
import { SquadView } from './components/SquadView';
import { TacticalBoard } from './components/TacticalBoard';
import { MatchEngineView } from './components/MatchEngineView';
import { AnnualCalendarView } from './components/AnnualCalendarView';
import { CompetitionsView } from './components/CompetitionsView';
import { FinancesView } from './components/FinancesView';
import { PlayerProfileModal } from './components/PlayerProfileModal';

function shouldAutostart(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('autostart') === '1';
}

export default function App() {
  const [slots, setSlots] = useState<Array<CareerSaveData | null>>(() =>
    loadAllCareerSlots()
  );

  const initialAutostartSave = useMemo(() => {
    if (!shouldAutostart()) return null;
    return (
      getLatestCareerSave() ||
      createNewCareerSave(1, USER_CLUB_ID, 'Treinador Silva')
    );
  }, []);

  const [screen, setScreen] = useState<'hub' | 'club'>(() =>
    shouldAutostart() ? 'club' : 'hub'
  );
  const [activeSlot, setActiveSlot] = useState<CareerSlotIndex | null>(() =>
    initialAutostartSave ? initialAutostartSave.slotIndex : null
  );
  const [managerName, setManagerName] = useState<string>(
    initialAutostartSave?.managerName || 'Treinador Silva'
  );
  const [userClubId, setUserClubId] = useState<string>(
    initialAutostartSave?.userClubId || USER_CLUB_ID
  );

  const [activeTab, setActiveTab] = useState<NavigationTab>('inbox');
  const [clubs, setClubs] = useState<Club[]>(
    () => initialAutostartSave?.clubs || ALL_WORLD_CLUBS
  );
  const [squad, setSquad] = useState<Player[]>(
    () => initialAutostartSave?.squad || INITIAL_USER_SQUAD
  );
  const [standings, setStandings] = useState<StandingsRow[]>(
    () => initialAutostartSave?.standings || INITIAL_STANDINGS
  );
  const [fixtures, setFixtures] = useState<RoundFixture[]>(
    () => initialAutostartSave?.fixtures || generateLeagueSchedule(USER_CLUB_ID, 'A')
  );
  const [secondaryStandings, setSecondaryStandings] = useState<StandingsRow[]>(
    () =>
      initialAutostartSave?.secondaryStandings ||
      getInitialStandingsForDivision('B')
  );
  const [secondaryFixtures, setSecondaryFixtures] = useState<RoundFixture[]>(
    () =>
      initialAutostartSave?.secondaryFixtures ||
      generateLeagueSchedule('__none__', 'B')
  );
  const [copaDoBrasil, setCopaDoBrasil] = useState<CopaDoBrasilState>(
    () =>
      initialAutostartSave?.copaDoBrasil ||
      createInitialCopaDoBrasil(initialAutostartSave?.userClubId || USER_CLUB_ID)
  );
  const [libertadores, setLibertadores] = useState<LibertadoresState>(
    () =>
      initialAutostartSave?.libertadores ||
      createInitialLibertadores(initialAutostartSave?.userClubId || USER_CLUB_ID)
  );
  const [messages, setMessages] = useState<InboxMessage[]>(
    () => initialAutostartSave?.messages || INITIAL_INBOX_MESSAGES
  );

  // Calendar & Multi-Competition Progression
  const [seasonStepIndex, setSeasonStepIndex] = useState<number>(
    initialAutostartSave?.seasonStepIndex || 0
  );
  const [currentRound, setCurrentRound] = useState<number>(
    initialAutostartSave?.currentRound || 1
  );
  const [dayOffset, setDayOffset] = useState<number>(
    initialAutostartSave?.dayOffset || 0
  );
  const [isMatchDay, setIsMatchDay] = useState<boolean>(
    initialAutostartSave?.isMatchDay || false
  );

  // Save Status UI feedback
  const [saveSuccessFlash, setSaveSuccessFlash] = useState<boolean>(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const saveTimerRef = useRef<number | null>(null);

  // Modal state for inspecting 18 attributes of any player
  const [inspectedPlayerId, setInspectedPlayerId] = useState<string | null>(
    null
  );

  const userClub = useMemo(
    () => clubs.find((c) => c.id === userClubId) || clubs[0],
    [clubs, userClubId]
  );

  const currentCalendarStep = useMemo(
    () =>
      SEASON_CALENDAR[seasonStepIndex] ||
      SEASON_CALENDAR[SEASON_CALENDAR.length - 1],
    [seasonStepIndex]
  );

  const currentUserFixture = useMemo(
    () =>
      findUserFixtureForStep(
        currentCalendarStep,
        userClubId,
        fixtures,
        copaDoBrasil,
        libertadores
      ) ||
      fixtures.find(
        (f) => f.roundNumber === currentRound && f.isUserMatch
      ) ||
      fixtures[0],
    [
      currentCalendarStep,
      userClubId,
      fixtures,
      copaDoBrasil,
      libertadores,
      currentRound,
    ]
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
      currentUserFixture.homeClubId === userClubId ? awayClub : homeClub,
    [currentUserFixture, homeClub, awayClub, userClubId]
  );

  const [matchState, setMatchState] = useState<LiveMatchState>(() =>
    initialAutostartSave?.matchState ||
    createInitialMatchState(
      1,
      currentUserFixture,
      homeClub,
      awayClub,
      INITIAL_USER_SQUAD,
      USER_CLUB_ID
    )
  );

  const userRank = useMemo(
    () => standings.findIndex((s) => s.clubId === userClubId) + 1,
    [standings, userClubId]
  );

  const persistCareer = useCallback(
    (override?: Partial<CareerSaveData>) => {
      const targetSlot = override?.slotIndex ?? activeSlot;
      if (!targetSlot) return;

      const nextClubs = override?.clubs ?? clubs;
      const nextStandings = override?.standings ?? standings;
      const nextUserClubId = override?.userClubId ?? userClubId;
      const nextClub =
        nextClubs.find((c) => c.id === nextUserClubId) || userClub;
      const nextRank =
        nextStandings.findIndex((s) => s.clubId === nextUserClubId) + 1;

      const payload: CareerSaveData = {
        version: 3,
        slotIndex: targetSlot,
        managerName: override?.managerName ?? managerName,
        userClubId: nextUserClubId,
        division: nextClub.division === 'B' ? 'B' : 'A',
        clubName: nextClub.name,
        clubShortName: nextClub.shortName,
        clubAbbr: nextClub.abbr,
        clubPrimaryColor: nextClub.primaryColor,
        currentRound: override?.currentRound ?? currentRound,
        seasonStepIndex: override?.seasonStepIndex ?? seasonStepIndex,
        activeCompetition:
          override?.activeCompetition ?? currentCalendarStep.competition,
        dayOffset: override?.dayOffset ?? dayOffset,
        isMatchDay: override?.isMatchDay ?? isMatchDay,
        userRank: nextRank > 0 ? nextRank : 1,
        cashBalance: nextClub.cashBalance,
        boardConfidence: nextClub.boardConfidence,
        savedAt: new Date().toISOString(),
        clubs: nextClubs,
        squad: override?.squad ?? squad,
        standings: nextStandings,
        fixtures: override?.fixtures ?? fixtures,
        secondaryStandings:
          override?.secondaryStandings ?? secondaryStandings,
        secondaryFixtures: override?.secondaryFixtures ?? secondaryFixtures,
        copaDoBrasil: override?.copaDoBrasil ?? copaDoBrasil,
        libertadores: override?.libertadores ?? libertadores,
        messages: override?.messages ?? messages,
        matchState: override?.matchState ?? matchState,
      };

      saveCareerToSlot(payload);
      setSlots(loadAllCareerSlots());
      setHasUnsavedChanges(false);
    },
    [
      activeSlot,
      clubs,
      standings,
      userClubId,
      userClub,
      managerName,
      currentRound,
      seasonStepIndex,
      currentCalendarStep.competition,
      dayOffset,
      isMatchDay,
      squad,
      fixtures,
      secondaryStandings,
      secondaryFixtures,
      copaDoBrasil,
      libertadores,
      messages,
      matchState,
    ]
  );

  const applyCareerSaveToState = (save: CareerSaveData) => {
    const otherDivision: 'A' | 'B' = save.division === 'B' ? 'A' : 'B';
    setActiveSlot(save.slotIndex);
    setManagerName(save.managerName);
    setUserClubId(save.userClubId);
    setClubs(save.clubs);
    setSquad(save.squad);
    setStandings(save.standings);
    setFixtures(save.fixtures);
    setSecondaryStandings(
      save.secondaryStandings || getInitialStandingsForDivision(otherDivision)
    );
    setSecondaryFixtures(
      save.secondaryFixtures || generateLeagueSchedule('__none__', otherDivision)
    );
    setCopaDoBrasil(
      save.copaDoBrasil || createInitialCopaDoBrasil(save.userClubId)
    );
    setLibertadores(
      save.libertadores || createInitialLibertadores(save.userClubId)
    );
    setMessages(save.messages);
    setCurrentRound(save.currentRound);
    setSeasonStepIndex(save.seasonStepIndex ?? 0);
    setDayOffset(save.dayOffset);
    setIsMatchDay(save.isMatchDay);
    setMatchState({ ...save.matchState, isRunning: false });
    setInspectedPlayerId(null);
    setActiveTab('inbox');
    setHasUnsavedChanges(false);
    setScreen('club');
  };

  const handleStartNewCareer = (
    slotIndex: CareerSlotIndex,
    clubId: string,
    newManagerName: string
  ) => {
    const newSave = createNewCareerSave(slotIndex, clubId, newManagerName);
    const stored = saveCareerToSlot(newSave);
    setSlots(loadAllCareerSlots());
    applyCareerSaveToState(stored);
  };

  const handleLoadCareer = (slotIndex: CareerSlotIndex) => {
    const loaded = loadCareerSlot(slotIndex);
    if (!loaded) return;
    applyCareerSaveToState(loaded);
  };

  const handleDeleteCareer = (slotIndex: CareerSlotIndex) => {
    deleteCareerSlot(slotIndex);
    setSlots(loadAllCareerSlots());
    if (activeSlot === slotIndex) {
      setActiveSlot(null);
    }
  };

  const handleImportCareer = (saveData: CareerSaveData) => {
    saveCareerToSlot(saveData);
    setSlots(loadAllCareerSlots());
  };

  const handleManualSave = () => {
    if (!activeSlot) return;
    persistCareer();
    setSaveSuccessFlash(true);
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      setSaveSuccessFlash(false);
    }, 2400);
  };

  const handleReturnToHub = () => {
    if (activeSlot) {
      setMatchState((prev) => ({ ...prev, isRunning: false }));
      persistCareer({
        matchState: { ...matchState, isRunning: false },
      });
    }
    setSlots(loadAllCareerSlots());
    setScreen('hub');
  };

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  // Sync body dataset state for testing & accessibility
  useEffect(() => {
    if (screen === 'hub') {
      document.body.dataset.state = 'title';
      return;
    }
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
  }, [screen, activeTab, matchState.phase, matchState.isRunning]);

  // Process automatic round/cup simulation & standings update when match reaches 90' FULL_TIME
  useEffect(() => {
    if (matchState.phase === 'FULL_TIME' && !matchState.roundProcessed) {
      const comp = matchState.competition || 'BRASILEIRAO';
      const userGoals = matchState.isUserHome
        ? matchState.homeGoals
        : matchState.awayGoals;
      const oppGoals = matchState.isUserHome
        ? matchState.awayGoals
        : matchState.homeGoals;
      const userWon90 = userGoals > oppGoals;
      const userDrew90 = userGoals === oppGoals;
      const userAdvanced = matchState.winnerClubId
        ? matchState.winnerClubId === userClubId
        : userWon90;

      const gateRevenue = matchState.isUserHome
        ? Math.round((userClub.capacity * 0.85 * 90) / 100000) * 100000
        : 950000;

      let updatedFixtures = fixtures;
      let newStandings = standings;
      let updatedSecondaryFixtures = secondaryFixtures;
      let newSecondaryStandings = secondaryStandings;
      let updatedCopaDoBrasil = copaDoBrasil;
      let updatedLibertadores = libertadores;
      let prizeMoney = 0;

      const userMatchPayload = {
        fixtureId: matchState.fixtureId,
        homeGoals: matchState.homeGoals,
        awayGoals: matchState.awayGoals,
        homeXG: matchState.homeXG,
        awayXG: matchState.awayXG,
        homePenalties: matchState.homePenalties,
        awayPenalties: matchState.awayPenalties,
        winnerClubId: matchState.winnerClubId,
      };

      if (comp === 'COPA_DO_BRASIL' && currentCalendarStep.copaStage) {
        updatedCopaDoBrasil = advanceCopaDoBrasilStage(
          copaDoBrasil,
          currentCalendarStep.copaStage,
          userMatchPayload,
          clubs,
          userClubId
        );
        prizeMoney = getCupPrizeMoney(
          'COPA_DO_BRASIL',
          currentCalendarStep.copaStage,
          userAdvanced,
          currentCalendarStep.copaStage === 'Final' && userAdvanced
        );
      } else if (comp === 'LIBERTADORES') {
        if (
          currentCalendarStep.libStage === 'Grupos' &&
          currentCalendarStep.libGroupRound
        ) {
          updatedLibertadores = advanceLibertadoresGroupRound(
            libertadores,
            currentCalendarStep.libGroupRound,
            userMatchPayload,
            clubs,
            userClubId
          );
          prizeMoney = getCupPrizeMoney(
            'LIBERTADORES',
            'Grupo',
            userWon90,
            false
          );
        } else if (
          currentCalendarStep.libStage &&
          currentCalendarStep.libStage !== 'Grupos'
        ) {
          updatedLibertadores = advanceLibertadoresKnockoutStage(
            libertadores,
            currentCalendarStep.libStage,
            userMatchPayload,
            clubs,
            userClubId
          );
          prizeMoney = getCupPrizeMoney(
            'LIBERTADORES',
            currentCalendarStep.libStage,
            userAdvanced,
            currentCalendarStep.libStage === 'Final' && userAdvanced
          );
        }
      } else {
        updatedFixtures = simulateRoundFixtures(
          fixtures,
          matchState.roundNumber,
          userMatchPayload,
          clubs
        );
        const roundCompletedFixtures = updatedFixtures.filter(
          (f) => f.roundNumber === matchState.roundNumber
        );
        newStandings = updateStandingsWithRound(
          standings,
          roundCompletedFixtures
        );

        updatedSecondaryFixtures = simulateRoundFixtures(
          secondaryFixtures,
          matchState.roundNumber,
          {
            fixtureId: '__none__',
            homeGoals: 0,
            awayGoals: 0,
            homeXG: 0,
            awayXG: 0,
          },
          clubs
        );
        const secondaryRoundCompleted = updatedSecondaryFixtures.filter(
          (f) => f.roundNumber === matchState.roundNumber
        );
        newSecondaryStandings = updateStandingsWithRound(
          secondaryStandings,
          secondaryRoundCompleted
        );
      }

      const confidenceDelta = userAdvanced
        ? 4
        : userDrew90 && !matchState.isKnockout
        ? 1
        : -4;
      const totalRevenue = gateRevenue + prizeMoney;

      const updatedClubs = clubs.map((c) =>
        c.id === userClubId
          ? {
              ...c,
              cashBalance: c.cashBalance + totalRevenue,
              boardConfidence: Math.min(
                100,
                Math.max(30, c.boardConfidence + confidenceDelta)
              ),
            }
          : c
      );

      // Update player condition & season stats from match tokens
      const userTokens = matchState.isUserHome
        ? matchState.homeTokens
        : matchState.awayTokens;
      const tokenMap = new Map(userTokens.map((t) => [t.id, t]));

      const updatedSquad = squad.map((p) => {
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
      });

      const userPos =
        newStandings.findIndex((s) => s.clubId === userClubId) + 1;
      const penDetail =
        matchState.homePenalties !== null &&
        matchState.homePenalties !== undefined &&
        matchState.awayPenalties !== null &&
        matchState.awayPenalties !== undefined
          ? ` (Pênaltis: ${matchState.homePenalties} x ${matchState.awayPenalties})`
          : '';
      const resultLabel = userAdvanced
        ? 'Vitória maiúscula'
        : userDrew90 && !matchState.isKnockout
        ? 'Empate disputado'
        : 'Revés duro';

      const compDisplay =
        matchState.competitionLabel ||
        `${matchState.roundNumber}ª Rodada · Série ${userClub.division === 'B' ? 'B' : 'A'}`;

      const postMatchMsg: InboxMessage = {
        id: `msg-post-${comp}-${Date.now()}`,
        date: `${formatCalendarDate(dayOffset)} · 22:15`,
        sender: 'Comissão Técnica',
        senderRole: 'Auxiliar Técnico',
        subject: `Relatório (${compDisplay}): ${homeClub.shortName} ${matchState.homeGoals} x ${matchState.awayGoals} ${awayClub.shortName}`,
        category: 'Pós-Jogo',
        priority: userAdvanced
          ? 'positive'
          : userDrew90 && !matchState.isKnockout
          ? 'normal'
          : 'warning',
        read: false,
        body: [
          `${resultLabel} pela ${compDisplay}. Placar: ${homeClub.shortName} ${matchState.homeGoals} x ${matchState.awayGoals} ${awayClub.shortName}${penDetail} (xG: ${matchState.homeXG.toFixed(2)} vs ${matchState.awayXG.toFixed(2)}).`,
          `Receita da partida (bilheteria + premiação): ${formatCompactBRL(totalRevenue)}.`,
        ],
        bulletPoints: [
          `Placar: ${homeClub.shortName} ${matchState.homeGoals} x ${matchState.awayGoals} ${awayClub.shortName}${penDetail}`,
          `Finalizações: ${matchState.homeShots} (${matchState.homeShotsOnTarget} no gol) vs ${matchState.awayShots} (${matchState.awayShotsOnTarget} no gol)`,
          comp === 'BRASILEIRAO'
            ? `Posição na Série ${userClub.division}: ${userPos}º lugar`
            : userAdvanced
            ? `Classificação / resultado positivo garantido em ${compDisplay}`
            : `Fim da linha ou tropeço em ${compDisplay}`,
        ],
        actionLabel: 'Ver Competições',
        actionTargetTab: 'competitions',
      };

      const updatedMessages = [postMatchMsg, ...messages];
      const processedMatchState = { ...matchState, roundProcessed: true };

      setClubs(updatedClubs);
      setSquad(updatedSquad);
      setFixtures(updatedFixtures);
      setStandings(newStandings);
      setSecondaryFixtures(updatedSecondaryFixtures);
      setSecondaryStandings(newSecondaryStandings);
      setCopaDoBrasil(updatedCopaDoBrasil);
      setLibertadores(updatedLibertadores);
      setMessages(updatedMessages);
      setMatchState(processedMatchState);

      persistCareer({
        clubs: updatedClubs,
        squad: updatedSquad,
        fixtures: updatedFixtures,
        standings: newStandings,
        secondaryFixtures: updatedSecondaryFixtures,
        secondaryStandings: newSecondaryStandings,
        copaDoBrasil: updatedCopaDoBrasil,
        libertadores: updatedLibertadores,
        messages: updatedMessages,
        matchState: processedMatchState,
      });
    }
  }, [
    matchState,
    fixtures,
    clubs,
    standings,
    secondaryFixtures,
    secondaryStandings,
    copaDoBrasil,
    libertadores,
    currentCalendarStep,
    squad,
    messages,
    dayOffset,
    homeClub.shortName,
    awayClub.shortName,
    userClub.name,
    userClub.division,
    userClub.capacity,
    userClubId,
    persistCareer,
  ]);

  // Live Match Simulation Timer
  useEffect(() => {
    if (screen !== 'club' || !matchState.isRunning || matchState.phase === 'FULL_TIME') return;

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
    screen,
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
    setHasUnsavedChanges(true);
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
    setHasUnsavedChanges(true);
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
    setHasUnsavedChanges(true);
  };

  const handleQuickSwapFatiguedPlayer = () => {
    const medicalMsg = messages.find((m) => m.relatedPlayerId);
    const fatiguedStarter =
      (medicalMsg?.relatedPlayerId
        ? squad.find((p) => p.id === medicalMsg.relatedPlayerId)
        : undefined) ||
      [...squad]
        .filter((p) => p.isStarter)
        .sort((a, b) => a.condition - b.condition)[0];

    if (!fatiguedStarter || !fatiguedStarter.isStarter) return;

    const preferredBackup =
      squad.find(
        (p) =>
          !p.isStarter &&
          !p.injured &&
          p.sector === fatiguedStarter.sector &&
          p.condition >= 85
      ) ||
      squad.find((p) => !p.isStarter && !p.injured);

    if (preferredBackup) {
      handleSwapPlayers(fatiguedStarter.id, preferredBackup.id);
    }
  };

  const handleAutoPickBestXI = () => {
    const slotsDef = FORMATIONS[userClub.formation];
    const pool = [...squad].filter((p) => !p.injured);
    const chosenIds = new Set<string>();
    const slotAssignments = new Map<string, number>();

    slotsDef.forEach((slot) => {
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
          const slotDef = slotsDef[sIdx];
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
    setHasUnsavedChanges(true);
  };

  const handleChangeFormation = (formation: FormationType) => {
    const slotsDef = FORMATIONS[formation];
    setClubs((prev) =>
      prev.map((c) => (c.id === userClubId ? { ...c, formation } : c))
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
        const slot = slotsDef[sIdx] || slotsDef[0];
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
    setHasUnsavedChanges(true);
  };

  const handleChangeInstructions = (instructions: TeamInstructions) => {
    setClubs((prev) =>
      prev.map((c) => (c.id === userClubId ? { ...c, instructions } : c))
    );
    setHasUnsavedChanges(true);
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
    let nextIdx = Math.min(SEASON_CALENDAR.length - 1, seasonStepIndex + 1);
    let nextCdb = copaDoBrasil;
    let nextLib = libertadores;
    let nextLeagueRound = currentRound;

    // Auto-simulate any cup rounds where user does not participate or was eliminated
    while (nextIdx < SEASON_CALENDAR.length - 1) {
      const candidateStep = SEASON_CALENDAR[nextIdx];
      if (candidateStep.leagueRound) {
        nextLeagueRound = candidateStep.leagueRound;
        break;
      }

      const candidateUserFix = findUserFixtureForStep(
        candidateStep,
        userClubId,
        fixtures,
        nextCdb,
        nextLib
      );
      if (candidateUserFix) {
        break;
      }

      if (
        candidateStep.competition === 'COPA_DO_BRASIL' &&
        candidateStep.copaStage
      ) {
        nextCdb = advanceCopaDoBrasilStage(
          nextCdb,
          candidateStep.copaStage,
          null,
          clubs,
          userClubId
        );
      } else if (candidateStep.competition === 'LIBERTADORES') {
        if (
          candidateStep.libStage === 'Grupos' &&
          candidateStep.libGroupRound
        ) {
          nextLib = advanceLibertadoresGroupRound(
            nextLib,
            candidateStep.libGroupRound,
            null,
            clubs,
            userClubId
          );
        } else if (
          candidateStep.libStage &&
          candidateStep.libStage !== 'Grupos'
        ) {
          nextLib = advanceLibertadoresKnockoutStage(
            nextLib,
            candidateStep.libStage,
            null,
            clubs,
            userClubId
          );
        }
      }
      nextIdx += 1;
    }

    const targetStep =
      SEASON_CALENDAR[nextIdx] || SEASON_CALENDAR[SEASON_CALENDAR.length - 1];
    if (targetStep.leagueRound) {
      nextLeagueRound = targetStep.leagueRound;
    }

    const nextFixture =
      findUserFixtureForStep(
        targetStep,
        userClubId,
        fixtures,
        nextCdb,
        nextLib
      ) ||
      fixtures.find(
        (f) => f.roundNumber === nextLeagueRound && f.isUserMatch
      ) ||
      fixtures[0];

    const nextHome =
      clubs.find((c) => c.id === nextFixture.homeClubId) || clubs[0];
    const nextAway =
      clubs.find((c) => c.id === nextFixture.awayClubId) || clubs[1];

    // Recover squad condition between matches
    const recoveredSquad = squad.map((p) => ({
      ...p,
      condition: Math.min(99, p.condition + 14),
    }));
    const nextDayOffset = Math.max(
      dayOffset + 1,
      (targetStep.dayOffset ?? dayOffset + 4) - 1
    );
    const nextMatch = createInitialMatchState(
      nextLeagueRound,
      nextFixture,
      nextHome,
      nextAway,
      recoveredSquad,
      userClubId
    );

    setSquad(recoveredSquad);
    setCopaDoBrasil(nextCdb);
    setLibertadores(nextLib);
    setSeasonStepIndex(nextIdx);
    setCurrentRound(nextLeagueRound);
    setDayOffset(nextDayOffset);
    setIsMatchDay(false);
    setMatchState(nextMatch);
    setActiveTab('competitions');

    persistCareer({
      squad: recoveredSquad,
      copaDoBrasil: nextCdb,
      libertadores: nextLib,
      seasonStepIndex: nextIdx,
      activeCompetition: targetStep.competition,
      currentRound: nextLeagueRound,
      dayOffset: nextDayOffset,
      isMatchDay: false,
      matchState: nextMatch,
    });
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
      setDayOffset((d) => d + 1);
      setIsMatchDay(true);
      setSquad((prev) =>
        prev.map((p) => ({
          ...p,
          condition: Math.min(99, p.condition + 3),
        }))
      );
      setHasUnsavedChanges(true);
      return;
    }

    setActiveTab('match');
  };

  const inspectedPlayer = useMemo(
    () => squad.find((p) => p.id === inspectedPlayerId) || null,
    [squad, inspectedPlayerId]
  );

  const activeRoundFixturesForMatchView = useMemo(() => {
    if (
      currentCalendarStep.competition === 'COPA_DO_BRASIL' &&
      currentCalendarStep.copaStage
    ) {
      return copaDoBrasil.fixturesByStage[currentCalendarStep.copaStage] || [];
    }
    if (currentCalendarStep.competition === 'LIBERTADORES') {
      if (
        currentCalendarStep.libStage === 'Grupos' &&
        currentCalendarStep.libGroupRound
      ) {
        const grpRound = currentCalendarStep.libGroupRound;
        const all = libertadores.groups.flatMap((g) =>
          g.fixtures.filter((f) => f.roundNumber === grpRound)
        );
        return all.sort((a, b) => Number(b.isUserMatch) - Number(a.isUserMatch));
      }
      if (
        currentCalendarStep.libStage &&
        currentCalendarStep.libStage !== 'Grupos'
      ) {
        return libertadores.knockoutFixtures[currentCalendarStep.libStage] || [];
      }
    }
    return fixtures.filter((f) => f.roundNumber === matchState.roundNumber);
  }, [
    currentCalendarStep,
    copaDoBrasil,
    libertadores,
    fixtures,
    matchState.roundNumber,
  ]);

  // Render Entry / Career Slot Selection Screen when on 'hub'
  if (screen === 'hub') {
    return (
      <CareerHubScreen
        slots={slots}
        onStartNewCareer={handleStartNewCareer}
        onLoadCareer={handleLoadCareer}
        onDeleteCareer={handleDeleteCareer}
        onImportCareer={handleImportCareer}
        activeCareerSlot={activeSlot}
        onReturnToActiveCareer={
          activeSlot ? () => setScreen('club') : undefined
        }
      />
    );
  }

  const unreadInboxCount = messages.filter((m) => !m.read).length;

  const primaryActionLabel =
    activeTab === 'match'
      ? matchState.phase === 'FULL_TIME'
        ? 'Concluir Jogo e Avançar'
        : matchState.isRunning
        ? `Em Jogo (${matchState.minute}') · Pausar`
        : matchState.phase === 'HALF_TIME'
        ? 'Iniciar 2º Tempo'
        : "Apito Inicial (0')"
      : isMatchDay
      ? `Ir para o Jogo`
      : 'Continuar Calendário';

  const mobilePrimaryActionLabel =
    activeTab === 'match'
      ? matchState.phase === 'FULL_TIME'
        ? 'Ver Tabela'
        : matchState.isRunning
        ? `Pausar (${matchState.minute}')`
        : matchState.phase === 'HALF_TIME'
        ? '2º Tempo'
        : 'Iniciar'
      : isMatchDay
      ? 'Ir p/ Jogo'
      : 'Continuar';

  const navItems = [
    {
      id: 'inbox' as const,
      label: 'Início / Inbox',
      mobileLabel: 'Início',
      icon: Inbox,
      badge: unreadInboxCount > 0 ? String(unreadInboxCount) : null,
    },
    {
      id: 'squad' as const,
      label: 'Elenco',
      mobileLabel: 'Elenco',
      icon: Users,
      badge: `${squad.length}`,
    },
    {
      id: 'tactics' as const,
      label: 'Táticas',
      mobileLabel: 'Táticas',
      icon: Sliders,
      badge: userClub.formation,
    },
    {
      id: 'match' as const,
      label: 'Motor de Partida 2D',
      mobileLabel: 'Jogo 2D',
      icon: PlayCircle,
      badge:
        matchState.phase === 'FIRST_HALF' ||
        matchState.phase === 'SECOND_HALF'
          ? `${matchState.minute}'`
          : `R${currentRound}`,
    },
    {
      id: 'calendar' as const,
      label: 'Calendário Anual',
      mobileLabel: 'Agenda',
      icon: Calendar,
      badge: '2026',
    },
    {
      id: 'competitions' as const,
      label: 'Competições',
      mobileLabel: 'Liga',
      icon: Trophy,
      badge: `${userRank}º`,
    },
    {
      id: 'finances' as const,
      label: 'Finanças',
      mobileLabel: 'Caixa',
      icon: Wallet,
      badge: null,
    },
  ];

  return (
    <div className="min-h-screen bg-[#0b0c10] text-zinc-100 flex flex-col lg:flex-row">
      {/* Fixed Sidebar Navigation (Desktop lg+) */}
      <aside className="hidden lg:flex w-64 bg-[#111319] border-r border-white/[0.07] flex-col justify-between shrink-0 select-none">
        <div>
          {/* Brand Lockup */}
          <div className="h-16 px-5 border-b border-white/[0.07] flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#b5ff00] flex items-center justify-center font-display font-extrabold text-[#090a0f] text-base shadow-md">
              FM
            </div>
            <div className="min-w-0">
              <div className="font-display text-lg font-extrabold uppercase tracking-tight text-white leading-none truncate">
                Prancheta Pro
              </div>
              <div className="text-[11px] text-[#b5ff00] font-mono mt-0.5 leading-none truncate">
                Slot 0{activeSlot || 1} · {managerName}
              </div>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav
            className="p-3.5 space-y-1.5"
            aria-label="Navegação principal do clube"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-full text-xs transition-all ${
                    isActive
                      ? 'bg-[#b5ff00] text-[#090a0f] font-extrabold shadow-md'
                      : 'text-zinc-400 hover:text-white hover:bg-white/[0.05] font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="whitespace-nowrap">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`font-mono tabular-nums text-[11px] px-2 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-[#090a0f] text-[#b5ff00] font-bold'
                          : 'text-zinc-400 bg-white/[0.05]'
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

        {/* Sidebar Bottom Next Match Card + Career Save / Menu Controls */}
        <div className="p-3.5 space-y-2.5">
          <div className="p-4 rounded-2xl border border-white/[0.07] bg-[#0b0c10] space-y-2">
            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <span>Próximo Jogo</span>
              <span className="font-mono font-bold text-[#b5ff00] truncate max-w-[130px]">
                {currentCalendarStep.competition === 'COPA_DO_BRASIL'
                  ? `CdB · ${currentCalendarStep.copaStage}`
                  : currentCalendarStep.competition === 'LIBERTADORES'
                  ? `Lib · ${currentCalendarStep.libStage === 'Grupos' ? `G${currentCalendarStep.libGroupRound}` : currentCalendarStep.libStage}`
                  : `${currentRound}ª Rodada`}
              </span>
            </div>
            <div className="font-display text-base font-extrabold uppercase tracking-tight text-white truncate">
              {homeClub.shortName} vs {awayClub.shortName}
            </div>
            <div className="text-[11px] text-zinc-400 truncate">
              {homeClub.stadium}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleManualSave}
              className={`py-2.5 px-3 rounded-full text-xs font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                saveSuccessFlash
                  ? 'bg-[#b5ff00] text-[#090a0f] border-[#b5ff00]'
                  : 'bg-[#14171f] hover:bg-white/[0.08] text-white border-white/10'
              }`}
            >
              {saveSuccessFlash ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Save className="w-3.5 h-3.5 text-[#b5ff00]" />
              )}
              <span>{saveSuccessFlash ? 'Salvo!' : 'Salvar'}</span>
            </button>

            <button
              type="button"
              onClick={handleReturnToHub}
              className="py-2.5 px-3 rounded-full text-xs font-bold bg-[#14171f] hover:bg-white/[0.08] text-zinc-300 hover:text-white border border-white/10 transition-colors flex items-center justify-center gap-1.5"
            >
              <FolderOpen className="w-3.5 h-3.5 text-[#b5ff00]" />
              <span>Saves</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Persistent Top Header Bar */}
        <header className="sticky top-0 z-30 h-12 lg:h-16 bg-[#0b0c10]/95 border-b border-white/[0.07] px-3 sm:px-5 lg:px-6 flex items-center justify-between gap-2 sm:gap-4 shrink-0">
          {/* Left: Club Name & League Status */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div
              className="w-7 h-7 lg:w-9 lg:h-9 rounded-full flex items-center justify-center font-display font-extrabold text-xs lg:text-sm shrink-0 shadow border border-white/20"
              style={{
                backgroundColor: userClub.primaryColor,
                color: getContrastTextColor(userClub.primaryColor),
              }}
            >
              {userClub.abbr}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="font-display text-sm sm:text-base lg:text-xl font-extrabold uppercase tracking-tight text-white truncate">
                  {userClub.name}
                </h1>
                <span className="text-xs text-zinc-400 font-mono hidden sm:inline whitespace-nowrap">
                  · {userRank}º na Série {userClub.division}
                </span>
              </div>
              {/* Mobile compact status line */}
              <div className="text-[10px] text-zinc-400 font-mono tabular-nums truncate md:hidden">
                {formatCalendarDate(dayOffset).split(',')[1]?.trim()} ·{' '}
                <span className="text-[#b5ff00] font-bold">
                  {formatCompactBRL(userClub.cashBalance)}
                </span>{' '}
                · Conf. {userClub.boardConfidence}%
              </div>
              {/* Desktop status line */}
              <div className="hidden md:block text-xs text-zinc-400 truncate">
                {userClub.stadium} · Esquema {userClub.formation} (
                {userClub.instructions.mentality})
              </div>
            </div>
          </div>

          {/* Right: Calendar Date, Cash Balance, Board Confidence, Save/Hub Actions & Primary Pill */}
          <div className="flex items-center gap-1.5 sm:gap-3 lg:gap-4 shrink-0">
            {/* Data atual do calendário (atalho para o Calendário Anual) */}
            <button
              type="button"
              onClick={() => setActiveTab('calendar')}
              title="Abrir Calendário Anual 2026"
              className="hidden md:flex items-center gap-2 text-xs text-left hover:bg-white/[0.05] px-2.5 py-1.5 rounded-xl transition-colors"
            >
              <Calendar className="w-4 h-4 text-[#b5ff00]" />
              <div>
                <div className="text-[10px] text-zinc-400 leading-none">
                  Calendário Oficial
                </div>
                <div className="font-mono tabular-nums font-semibold text-white mt-0.5">
                  {formatCalendarDate(dayOffset)}
                </div>
              </div>
            </button>

            {/* Saldo em Caixa */}
            <div className="hidden xl:flex items-center gap-2 text-xs border-l border-white/[0.08] pl-4">
              <Wallet className="w-4 h-4 text-[#b5ff00]" />
              <div>
                <div className="text-[10px] text-zinc-400 leading-none">
                  Saldo em Caixa
                </div>
                <div className="font-mono tabular-nums font-bold text-[#b5ff00] mt-0.5">
                  {formatCompactBRL(userClub.cashBalance)}
                </div>
              </div>
            </div>

            {/* Confiança da Diretoria (%) */}
            <div className="hidden lg:flex items-center gap-2 text-xs border-l border-white/[0.08] pl-4">
              <ShieldCheck className="w-4 h-4 text-[#b5ff00]" />
              <div>
                <div className="text-[10px] text-zinc-400 leading-none">
                  Confiança da Diretoria
                </div>
                <div className="font-mono tabular-nums font-semibold text-white mt-0.5">
                  {userClub.boardConfidence}%
                </div>
              </div>
            </div>

            {/* Quick Save Pill */}
            <button
              type="button"
              onClick={handleManualSave}
              aria-label="Salvar carreira"
              title={
                hasUnsavedChanges
                  ? 'Salvar alterações da carreira'
                  : 'Salvar carreira'
              }
              className={`px-2.5 py-1.5 lg:px-3.5 lg:py-2 rounded-full text-xs font-bold border transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                saveSuccessFlash
                  ? 'bg-[#b5ff00] text-[#090a0f] border-[#b5ff00]'
                  : 'bg-[#14171f] hover:bg-white/[0.08] text-white border-white/10'
              }`}
            >
              {saveSuccessFlash ? (
                <Check className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <Save className="w-3.5 h-3.5 text-[#b5ff00] shrink-0" />
              )}
              <span className="hidden sm:inline">
                {saveSuccessFlash ? 'Salvo ✓' : 'Salvar'}
              </span>
              {hasUnsavedChanges && !saveSuccessFlash && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              )}
            </button>

            {/* Mobile/Compact Return to Career Hub Button */}
            <button
              type="button"
              onClick={handleReturnToHub}
              aria-label="Voltar aos slots e saves"
              title="Voltar ao menu de saves"
              className="lg:hidden p-1.5 rounded-full bg-[#14171f] hover:bg-white/[0.08] text-zinc-300 border border-white/10 transition-colors"
            >
              <FolderOpen className="w-3.5 h-3.5 text-[#b5ff00]" />
            </button>

            {/* Dynamic Primary Action Button */}
            <button
              onClick={handlePrimaryHeaderAction}
              className="px-3 py-1.5 lg:px-5 lg:py-2.5 rounded-full text-xs font-extrabold bg-[#b5ff00] hover:bg-[#c8ff33] text-[#090a0f] transition-colors flex items-center gap-1.5 lg:gap-2 whitespace-nowrap shadow-md"
            >
              <Play className="w-3 h-3 lg:w-3.5 lg:h-3.5 fill-current shrink-0" />
              <span className="hidden sm:inline">{primaryActionLabel}</span>
              <span className="sm:hidden">{mobilePrimaryActionLabel}</span>
              <ChevronRight className="w-3.5 h-3.5 hidden sm:inline" />
            </button>
          </div>
        </header>

        {/* Active Module Viewport */}
        <main className="flex-1 p-3.5 sm:p-5 lg:p-6 pb-20 lg:pb-6 overflow-y-auto overflow-x-hidden">
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
              activeCompetition={currentCalendarStep.competition}
              competitionLabel={currentCalendarStep.label}
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
              roundFixtures={activeRoundFixturesForMatchView}
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

          {activeTab === 'calendar' && (
            <AnnualCalendarView
              userClub={userClub}
              clubs={clubs}
              fixtures={fixtures}
              copaDoBrasil={copaDoBrasil}
              libertadores={libertadores}
              seasonStepIndex={seasonStepIndex}
              dayOffset={dayOffset}
              isMatchDay={isMatchDay}
              onGoToMatch={() => {
                setIsMatchDay(true);
                setActiveTab('match');
              }}
              onOpenCompetitions={() => setActiveTab('competitions')}
            />
          )}

          {activeTab === 'competitions' && (
            <CompetitionsView
              standings={standings}
              clubs={clubs}
              fixtures={fixtures}
              currentRound={currentRound}
              userClubId={userClubId}
              userDivision={userClub.division === 'B' ? 'B' : 'A'}
              secondaryStandings={secondaryStandings}
              secondaryFixtures={secondaryFixtures}
              copaDoBrasil={copaDoBrasil}
              libertadores={libertadores}
              activeCompetition={currentCalendarStep.competition}
            />
          )}

          {activeTab === 'finances' && (
            <FinancesView club={userClub} squad={squad} />
          )}
        </main>
      </div>

      {/* Mobile Bottom Capsule Navigation Bar (< lg) */}
      <nav
        aria-label="Navegação mobile"
        className="lg:hidden fixed bottom-2 left-2 right-2 z-40 h-14 bg-[#14171f]/95 border border-white/10 rounded-full grid grid-cols-7 items-center px-1 shadow-2xl select-none"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`h-10 rounded-full flex flex-col items-center justify-center gap-0.5 transition-all ${
                isActive
                  ? 'bg-[#b5ff00] text-[#090a0f] font-extrabold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <div className="relative flex items-center justify-center">
                <Icon className="w-4 h-4" />
                {item.id === 'inbox' && unreadInboxCount > 0 && !isActive && (
                  <span className="absolute -top-1 -right-2.5 text-[9px] font-mono font-bold text-[#b5ff00]">
                    {unreadInboxCount}
                  </span>
                )}
              </div>
              <span className="text-[9px] leading-none tracking-tight whitespace-nowrap">
                {item.mobileLabel}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Detailed 18-Attribute Player Profile Modal */}
      <PlayerProfileModal
        player={inspectedPlayer}
        onClose={() => setInspectedPlayerId(null)}
        onUpdateRoleDuty={handleUpdateRoleDuty}
      />
    </div>
  );
}
