import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutDashboard,
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
  ArrowLeftRight,
  FastForward,
  GraduationCap,
  Cloud,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  X,
} from 'lucide-react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebase';
import {
  deleteCareerSlotFromCloud,
  saveCareerSlotToCloud,
  syncAllCareerSlotsWithCloud,
} from './utils/cloudSaveSync';
import { AccountAuthModal } from './components/AccountAuthModal';
import { YouthAcademyView } from './components/YouthAcademyView';
import {
  YOUTH_TIERS,
  createInitialYouthAcademy,
  evolveYouthAcademyRoster,
  promoteYouthPlayerToSeniorSquad,
  releaseYouthPlayerFromAcademy,
} from './engine/youthAcademyEngine';
import {
  ALL_WORLD_CLUBS,
  INITIAL_INBOX_MESSAGES,
  INITIAL_STANDINGS,
  INITIAL_USER_SQUAD,
  USER_CLUB_ID,
  generateLeagueSchedule,
  getInitialStandingsForDivision,
  getPlayableDivisionForClub,
  getPlayableLeagueLabel,
  getPlayableLeagueShortLabel,
  isEuropeanPlayableDivision,
} from './data/initialDatabase';
import {
  SEASON_CALENDAR,
  advanceChampionsLeagueStage,
  advanceCopaDoBrasilStage,
  advanceLibertadoresGroupRound,
  advanceLibertadoresKnockoutStage,
  advanceMundialStage,
  advanceSuperMundialGroupRound,
  advanceSuperMundialKnockoutStage,
  createInitialChampionsLeague,
  createInitialCopaDoBrasil,
  createInitialLibertadores,
  createInitialMundial,
  createInitialSuperMundial,
  findUserFixtureForStep,
  getCupPrizeMoney,
  seedMundialBracket,
  syncSuperMundialWithChampionsResults,
} from './data/cupFactory';
import { createNewCareerSave } from './data/careerFactory';
import { createInitialFreeAgents } from './data/transferCatalog';
import { FORMATIONS, getRoleById } from './data/tacticsData';
import {
  buildPitchTokens,
  calculatePlayerOverall,
  createInitialMatchState,
  pickBestLineupForFormation,
  simulateRoundFixtures,
  stepMatchMinute,
  updateStandingsWithRound,
} from './engine/matchEngine';
import {
  advanceSquadRecoveryByDays,
  applyInjuryToPlayer,
  createInjuryInboxMessage,
  ensureHealthyStartingLineup,
  formatInjuryDurationShort,
} from './engine/injuryEngine';
import {
  LoanWageShare,
  acceptTransferCounterOffer,
  evaluateTransferNegotiation,
  executeIncomingTransfer,
  executeOutgoingTransfer,
  getEffectivePayroll,
  getPlayerNegotiationBlockInfo,
  getTransferWindowStatus,
  isTransferWindowOpen,
  recordTransferNegotiationAttempt,
} from './engine/transferEngine';
import {
  getPlayerContractRemainingYears,
  negotiateContractRenewal,
  setContractNonRenewalDecision,
} from './engine/contractEngine';
import {
  CareerSaveData,
  CareerSlotIndex,
  ChampionsLeagueState,
  Club,
  ClubFinanceLedger,
  ContractRenewalOutcome,
  CopaDoBrasilState,
  FormationType,
  InboxMessage,
  IncomingTransferOffer,
  LibertadoresState,
  LiveMatchState,
  MarketPlayerListing,
  MatchHistoryRecord,
  MentalityType,
  MundialState,
  NavigationTab,
  NewSeasonEvolutionReport,
  Player,
  PlayerNegotiationState,
  RoundFixture,
  SeasonArchiveEntry,
  SeasonEndReport,
  StandingsRow,
  SuperMundialState,
  TacticalDuty,
  TeamInstructions,
  TransferAttemptResult,
  TransferDealMode,
  TransferOfferTier,
  TransferRecord,
  WatchedPlayerEntry,
  YouthAcademyState,
  YouthInvestmentTier,
  YouthFocusSector,
} from './types/football';
import {
  formatCalendarDate,
  formatCompactBRL,
} from './utils/formatters';
import { CurrencyToggle, useCurrency } from './utils/CurrencyContext';
import { ClubBadge } from './components/ClubBadge';
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
import { MarketFeedback, MarketView } from './components/MarketView';
import { AnnualCalendarView } from './components/AnnualCalendarView';
import { AutoSimModal } from './components/AutoSimModal';
import { CompetitionsView } from './components/CompetitionsView';
import { FinancesView } from './components/FinancesView';
import { PlayerProfileModal } from './components/PlayerProfileModal';
import { SeasonEndModal } from './components/SeasonEndModal';
import { NewSeasonEvolutionModal } from './components/NewSeasonEvolutionModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import {
  AutoSimCareerSnapshot,
  AutoSimMatchLogEntry,
  countStepsUntilDayOffset,
  dayOffsetToDate,
  isSeasonCompleted as checkSeasonCompleted,
  simulateNextAutoStep,
} from './engine/autoTacticsAndSim';
import {
  GLOBAL_SCALE_VERSION,
  HomeGateSettlementItem,
  applyAiHomeGateRevenues,
  applyAiMonthlyEconomyTick,
  applyPostMatchProbabilisticEvolution,
  calculateMatchGateRevenue,
  calculateOperationalCost,
  createInitialFinanceLedger,
  processMidSeasonEvolution,
} from './engine/economyAndEvolution';
import {
  IncomingOfferAction,
  buildInitialAiSquads,
  createOfferInboxMessage,
  maybeGenerateIncomingOfferForUser,
  resolveIncomingOfferAction,
  simulateAiTransferWindowTick,
} from './engine/aiMarketEngine';
import {
  attributeAiRoundPlayerStats,
  buildSeasonEndSummary,
  executeNewSeasonRollover,
} from './engine/seasonLifecycle';
import {
  createMatchHistoryRecordFromLiveMatch,
  getHeadToHeadSummary,
} from './engine/headToHead';

function shouldAutostart(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('autostart') === '1';
}

export default function App() {
  const { currency } = useCurrency();
  const [slots, setSlots] = useState<Array<CareerSaveData | null>>(() =>
    loadAllCareerSlots()
  );

  // Firebase Auth & Cross-Device Cloud Sync State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<
    'idle' | 'syncing' | 'synced' | 'error'
  >('idle');
  const [lastSyncMessage, setLastSyncMessage] = useState<string | null>(null);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState<boolean>(false);

  // Global Viewport-Fixed Action Feedback Toast (always visible in mobile field of view)
  const [actionToast, setActionToast] = useState<{
    id: number;
    message: string;
    tone: 'emerald' | 'amber' | 'rose' | 'cyan';
  } | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showActionToast = useCallback(
    (
      message: string,
      tone: 'emerald' | 'amber' | 'rose' | 'cyan' = 'emerald'
    ) => {
      setActionToast({ id: Date.now(), message, tone });
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      toastTimerRef.current = window.setTimeout(() => {
        setActionToast(null);
      }, 3800);
    },
    []
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
  const [championsLeague, setChampionsLeague] = useState<ChampionsLeagueState>(
    () =>
      initialAutostartSave?.championsLeague ||
      createInitialChampionsLeague(
        initialAutostartSave?.currentYear || 2026,
        initialAutostartSave?.clubs || ALL_WORLD_CLUBS
      )
  );
  const [mundial, setMundial] = useState<MundialState>(
    () =>
      initialAutostartSave?.mundial ||
      createInitialMundial(initialAutostartSave?.currentYear || 2026)
  );
  const [superMundial, setSuperMundial] = useState<SuperMundialState>(
    () =>
      initialAutostartSave?.superMundial ||
      createInitialSuperMundial({
        userClubId: initialAutostartSave?.userClubId || USER_CLUB_ID,
        seasonYear: initialAutostartSave?.currentYear || 2026,
        clubsPool: initialAutostartSave?.clubs || ALL_WORLD_CLUBS,
        accumulatedUclChampions: initialAutostartSave?.accumulatedUclChampions,
        accumulatedLibChampions: initialAutostartSave?.accumulatedLibChampions,
      })
  );
  const [accumulatedUclChampions, setAccumulatedUclChampions] = useState<
    string[]
  >(() => initialAutostartSave?.accumulatedUclChampions || []);
  const [accumulatedLibChampions, setAccumulatedLibChampions] = useState<
    string[]
  >(() => initialAutostartSave?.accumulatedLibChampions || []);
  const [messages, setMessages] = useState<InboxMessage[]>(
    () => initialAutostartSave?.messages || INITIAL_INBOX_MESSAGES
  );
  const [freeAgents, setFreeAgents] = useState<Player[]>(
    () => initialAutostartSave?.freeAgents || createInitialFreeAgents()
  );
  const [loanedOutPlayers, setLoanedOutPlayers] = useState<Player[]>(
    () => initialAutostartSave?.loanedOutPlayers || []
  );
  const [transferHistory, setTransferHistory] = useState<TransferRecord[]>(
    () => initialAutostartSave?.transferHistory || []
  );
  const [transferredOutClubPlayerIds, setTransferredOutClubPlayerIds] =
    useState<string[]>(
      () => initialAutostartSave?.transferredOutClubPlayerIds || []
    );
  const [watchedPlayers, setWatchedPlayers] = useState<WatchedPlayerEntry[]>(
    () => initialAutostartSave?.watchedPlayers || []
  );
  const [matchHistory, setMatchHistory] = useState<MatchHistoryRecord[]>(
    () => initialAutostartSave?.matchHistory || []
  );
  const [marketFeedback, setMarketFeedback] = useState<MarketFeedback>(null);
  const [transferAttemptResult, setTransferAttemptResult] =
    useState<TransferAttemptResult | null>(null);
  const [negotiationStates, setNegotiationStates] = useState<
    Record<string, PlayerNegotiationState>
  >(() => initialAutostartSave?.negotiationStates || {});
  const [focusRenewalsSignal, setFocusRenewalsSignal] = useState<number>(0);

  // Continuous Multi-Season Career, Living AI Market & Economy Ledger State
  const [currentYear, setCurrentYear] = useState<number>(
    initialAutostartSave?.currentYear ?? 2026
  );
  const [aiSquads, setAiSquads] = useState<Record<string, Player[]>>(
    () =>
      initialAutostartSave?.aiSquads ||
      buildInitialAiSquads(
        initialAutostartSave?.clubs || ALL_WORLD_CLUBS,
        initialAutostartSave?.userClubId || USER_CLUB_ID
      )
  );
  const [pendingOffers, setPendingOffers] = useState<IncomingTransferOffer[]>(
    () => initialAutostartSave?.pendingOffers || []
  );
  const [financeLedger, setFinanceLedger] = useState<ClubFinanceLedger>(() => {
    if (initialAutostartSave?.financeLedger) {
      return initialAutostartSave.financeLedger;
    }
    const initClubs = initialAutostartSave?.clubs || ALL_WORLD_CLUBS;
    const initCid = initialAutostartSave?.userClubId || USER_CLUB_ID;
    const initClub = initClubs.find((c) => c.id === initCid) || initClubs[0];
    const initSquad = initialAutostartSave?.squad || INITIAL_USER_SQUAD;
    return createInitialFinanceLedger(
      initClub,
      initSquad,
      initialAutostartSave?.currentYear ?? 2026
    );
  });
  const [seasonHistory, setSeasonHistory] = useState<SeasonArchiveEntry[]>(
    () => initialAutostartSave?.seasonHistory || []
  );
  const [seasonEndReport, setSeasonEndReport] = useState<SeasonEndReport | null>(
    () => initialAutostartSave?.seasonEndReport || null
  );
  const [isSeasonEndModalOpen, setIsSeasonEndModalOpen] = useState<boolean>(
    () => Boolean(initialAutostartSave?.seasonEndReport)
  );
  const [newSeasonEvolutionReport, setNewSeasonEvolutionReport] =
    useState<NewSeasonEvolutionReport | null>(
      () => initialAutostartSave?.newSeasonEvolutionReport || null
    );
  const [isNewSeasonEvolutionModalOpen, setIsNewSeasonEvolutionModalOpen] =
    useState<boolean>(false);
  const [midSeasonEvolutionProcessedYear, setMidSeasonEvolutionProcessedYear] =
    useState<number | undefined>(
      initialAutostartSave?.midSeasonEvolutionProcessedYear
    );

  const [youthAcademy, setYouthAcademy] = useState<YouthAcademyState>(() => {
    if (initialAutostartSave?.youthAcademy) {
      return initialAutostartSave.youthAcademy;
    }
    const initClubs = initialAutostartSave?.clubs || ALL_WORLD_CLUBS;
    const initCid = initialAutostartSave?.userClubId || USER_CLUB_ID;
    const initClub = initClubs.find((c) => c.id === initCid) || initClubs[0];
    return createInitialYouthAcademy(
      initClub.id,
      initClub.reputation,
      initClub.division,
      initialAutostartSave?.currentYear ?? 2026
    );
  });

  const handleUpdateYouthAcademySettings = (
    tier: YouthInvestmentTier,
    focus: YouthFocusSector
  ) => {
    const tierObj = YOUTH_TIERS.find((t) => t.tier === tier) || YOUTH_TIERS[1];
    const nextState: YouthAcademyState = {
      ...youthAcademy,
      investmentTier: tier,
      focusSector: focus,
      monthlyCost: tierObj.monthlyCost,
    };
    setYouthAcademy(nextState);
    setHasUnsavedChanges(true);
    persistCareer({ youthAcademy: nextState });
    showActionToast(
      `Base Sub-20 atualizada: Nível ${tierObj.label} (${focus})`,
      'cyan'
    );
  };

  const handlePromoteYouthPlayer = (playerId: string) => {
    const res = promoteYouthPlayerToSeniorSquad({
      academy: youthAcademy,
      seniorSquad: squad,
      playerId,
    });
    if (!res.promotedPlayer) return;

    const ovr = calculatePlayerOverall(
      res.promotedPlayer.attributes,
      res.promotedPlayer.position
    );
    const dateLabel = formatCalendarDate(dayOffset, currentYear);
    const promoMsg: InboxMessage = {
      id: `msg-youth-promo-${res.promotedPlayer.id}-${Date.now()}`,
      date: `${dateLabel} · Base Sub-20`,
      sender: 'Coordenação das Categorias de Base',
      senderRole: 'Transição Base → Profissional',
      subject: `Promovido ao Profissional: ${res.promotedPlayer.name} (${res.promotedPlayer.position} · ${res.promotedPlayer.age}a · OVR ${ovr})`,
      category: 'Diretoria',
      priority: 'positive',
      read: false,
      relatedPlayerId: res.promotedPlayer.id,
      body: [
        `O jovem ${res.promotedPlayer.name} (${res.promotedPlayer.age} anos, Potencial ${res.promotedPlayer.potentialStars || 3}★) subiu oficialmente da base para o elenco profissional do ${userClub.shortName} com a camisa #${res.promotedPlayer.number}.`,
        `Salário inicial de transição: ${formatCompactBRL(res.promotedPlayer.salary)}/mês.`,
      ],
      actionLabel: 'Ver no Elenco',
      actionTargetTab: 'squad',
    };

    const nextMessages = [promoMsg, ...messages].slice(0, 80);
    setYouthAcademy(res.updatedAcademy);
    setSquad(res.updatedSeniorSquad);
    setMessages(nextMessages);
    setHasUnsavedChanges(true);

    persistCareer({
      youthAcademy: res.updatedAcademy,
      squad: res.updatedSeniorSquad,
      messages: nextMessages,
    });
    showActionToast(
      `✓ ${res.promotedPlayer.name} (OVR ${ovr}) promovido ao elenco profissional!`,
      'emerald'
    );
  };

  const handleReleaseYouthPlayer = (playerId: string) => {
    const released = youthAcademy.youthRoster?.find((p) => p.id === playerId);
    const nextAcademy = releaseYouthPlayerFromAcademy({
      academy: youthAcademy,
      playerId,
    });
    setYouthAcademy(nextAcademy);
    setHasUnsavedChanges(true);
    persistCareer({ youthAcademy: nextAcademy });
    if (released) {
      showActionToast(`${released.name} dispensado da base Sub-20.`, 'amber');
    }
  };

  const handleTogglePlayerMarketListing = (
    playerId: string,
    mode: 'TRANSFER' | 'LOAN'
  ) => {
    const updatedSquad = squad.map((p) => {
      if (p.id !== playerId || p.contractType === 'EMPRESTADO') return p;
      if (mode === 'TRANSFER') {
        return { ...p, isTransferListed: !p.isTransferListed };
      }
      return { ...p, isLoanListed: !p.isLoanListed };
    });

    const target = updatedSquad.find((p) => p.id === playerId);
    setSquad(updatedSquad);
    setHasUnsavedChanges(true);

    if (target) {
      const statusParts: string[] = [];
      if (target.isTransferListed) statusParts.push('Venda');
      if (target.isLoanListed) statusParts.push('Empréstimo');
      const titleMsg =
        statusParts.length > 0
          ? `${target.name} disponibilizado para ${statusParts.join(' e ')}`
          : `${target.name} retirado da lista de transferências`;
      setMarketFeedback({
        type: 'success',
        title: titleMsg,
        detail:
          statusParts.length > 0
            ? 'Clubes da IA que precisam desta posição enviarão propostas com maior frequência e melhores condições.'
            : 'O atleta voltou ao status normal de permanência no elenco.',
      });
      showActionToast(titleMsg, statusParts.length > 0 ? 'emerald' : 'amber');
    }

    persistCareer({ squad: updatedSquad });
  };

  const handleSolicitOfferForPlayer = (playerId: string) => {
    if (!isTransferWindowOpen(dayOffset)) {
      const windowStatus = getTransferWindowStatus(dayOffset, currentYear);
      setMarketFeedback({
        type: 'error',
        title: 'Janela de Transferências Fechada',
        detail: windowStatus.description,
      });
      return;
    }
    const targetPlayer = squad.find((p) => p.id === playerId);
    if (!targetPlayer) return;

    const existingOffer = pendingOffers.find(
      (o) => o.playerId === playerId && o.status === 'PENDING'
    );
    if (existingOffer) {
      setMarketFeedback({
        type: 'error',
        title: `Já existe proposta ativa por ${targetPlayer.name}`,
        detail: `Confira a oferta de ${existingOffer.fromClubName} no topo da tela de Mercado.`,
      });
      return;
    }

    const newOffer = maybeGenerateIncomingOfferForUser({
      clubs,
      userClub,
      userSquad: squad,
      pendingOffers,
      dayOffset,
      seasonYear: currentYear,
      aiSquads,
      specificPlayerId: playerId,
    });

    if (!newOffer) {
      setMarketFeedback({
        type: 'rejected',
        title: `Nenhuma proposta imediata por ${targetPlayer.name}`,
        detail:
          'Os clubes sondados não têm orçamento disponível neste momento. O atleta segue listado para a próxima rodada.',
      });
      return;
    }

    const updatedPendingOffers = [newOffer, ...pendingOffers].slice(0, 15);
    const offerMsg = createOfferInboxMessage(newOffer, userClub);
    const updatedMessages = [offerMsg, ...messages].slice(0, 80);

    setPendingOffers(updatedPendingOffers);
    setMessages(updatedMessages);
    setMarketFeedback({
      type: 'success',
      title: `Nova proposta recebida de ${newOffer.fromClubName}!`,
      detail: `${newOffer.fromClubName} enviou proposta de ${
        newOffer.dealType === 'BUY' ? 'Compra Definitiva' : 'Empréstimo'
      } (${formatCompactBRL(newOffer.offeredFee)}) por ${targetPlayer.name}.`,
    });

    persistCareer({
      pendingOffers: updatedPendingOffers,
      messages: updatedMessages,
    });
  };

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

  // Modal state for inspecting 18 attributes of any squad or market player
  const [inspectedPlayerId, setInspectedPlayerId] = useState<string | null>(
    null
  );
  const [inspectedExternalPlayer, setInspectedExternalPlayer] =
    useState<Player | null>(null);
  const [inspectedExternalListing, setInspectedExternalListing] =
    useState<MarketPlayerListing | null>(null);

  const userClub = useMemo(
    () => clubs.find((c) => c.id === userClubId) || clubs[0],
    [clubs, userClubId]
  );

  const userPlayableDivision = useMemo(
    () => getPlayableDivisionForClub(userClub),
    [userClub]
  );
  const userLeagueShort = useMemo(
    () => getPlayableLeagueShortLabel(userPlayableDivision),
    [userPlayableDivision]
  );
  const userLeagueFull = useMemo(
    () => getPlayableLeagueLabel(userPlayableDivision),
    [userPlayableDivision]
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
        libertadores,
        mundial,
        superMundial,
        championsLeague
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
      mundial,
      superMundial,
      championsLeague,
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
      USER_CLUB_ID,
      [],
      aiSquads
    )
  );

  const preMatchHeadToHead = useMemo(
    () =>
      getHeadToHeadSummary({
        userClubId,
        opponentClubId: opponentClub.id,
        matchHistory,
        fixtures,
        copaDoBrasil,
        libertadores,
        currentYear,
      }),
    [
      userClubId,
      opponentClub.id,
      matchHistory,
      fixtures,
      copaDoBrasil,
      libertadores,
      currentYear,
    ]
  );

  const userRank = useMemo(
    () => standings.findIndex((s) => s.clubId === userClubId) + 1,
    [standings, userClubId]
  );

  const isSeasonFinished = useMemo(
    () =>
      checkSeasonCompleted({
        clubs,
        userClubId,
        squad,
        aiSquads,
        standings,
        fixtures,
        secondaryStandings,
        secondaryFixtures,
        copaDoBrasil,
        libertadores,
        championsLeague,
        mundial,
        superMundial,
        messages,
        matchState,
        seasonYear: currentYear,
        seasonStepIndex,
        currentRound,
        dayOffset,
        isMatchDay,
        transferredOutClubPlayerIds,
        pendingOffers,
        transferHistory,
        financeLedger,
      }),
    [
      clubs,
      userClubId,
      squad,
      aiSquads,
      standings,
      fixtures,
      secondaryStandings,
      secondaryFixtures,
      copaDoBrasil,
      libertadores,
      championsLeague,
      mundial,
      superMundial,
      messages,
      matchState,
      currentYear,
      seasonStepIndex,
      currentRound,
      dayOffset,
      isMatchDay,
      transferredOutClubPlayerIds,
      pendingOffers,
      transferHistory,
      financeLedger,
    ]
  );

  // Auto-Simulation State & Ref
  const autoSimSnapshotRef = useRef<AutoSimCareerSnapshot | null>(null);
  const [autoSimUi, setAutoSimUi] = useState<{
    isOpen: boolean;
    isRunning: boolean;
    isPaused: boolean;
    isDone: boolean;
    wasStoppedEarly: boolean;
    targetLabel: string;
    startDayOffset: number;
    currentDayOffset: number;
    targetDayOffset: number;
    plannedUserMatches: number;
    logs: AutoSimMatchLogEntry[];
    pausedOffer: IncomingTransferOffer | null;
    pendingDoneAfterOffer: boolean;
    resumeInstantMode: boolean;
    offerResolutionNote: string | null;
  }>({
    isOpen: false,
    isRunning: false,
    isPaused: false,
    isDone: false,
    wasStoppedEarly: false,
    targetLabel: '',
    startDayOffset: 0,
    currentDayOffset: 0,
    targetDayOffset: 0,
    plannedUserMatches: 0,
    logs: [],
    pausedOffer: null,
    pendingDoneAfterOffer: false,
    resumeInstantMode: false,
    offerResolutionNote: null,
  });

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
        division: getPlayableDivisionForClub(nextClub),
        clubName: nextClub.name,
        clubShortName: nextClub.shortName,
        clubAbbr: nextClub.abbr,
        clubPrimaryColor: nextClub.primaryColor,
        currentYear: override?.currentYear ?? currentYear,
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
        aiSquads: override?.aiSquads ?? aiSquads,
        standings: nextStandings,
        fixtures: override?.fixtures ?? fixtures,
        secondaryStandings:
          override?.secondaryStandings ?? secondaryStandings,
        secondaryFixtures: override?.secondaryFixtures ?? secondaryFixtures,
        copaDoBrasil: override?.copaDoBrasil ?? copaDoBrasil,
        libertadores: override?.libertadores ?? libertadores,
        championsLeague: override?.championsLeague ?? championsLeague,
        mundial: override?.mundial ?? mundial,
        superMundial: override?.superMundial ?? superMundial,
        accumulatedUclChampions:
          override?.accumulatedUclChampions ?? accumulatedUclChampions,
        accumulatedLibChampions:
          override?.accumulatedLibChampions ?? accumulatedLibChampions,
        globalScaleVersion: GLOBAL_SCALE_VERSION,
        messages: override?.messages ?? messages,
        matchState: override?.matchState ?? matchState,
        matchHistory: override?.matchHistory ?? matchHistory,
        freeAgents: override?.freeAgents ?? freeAgents,
        loanedOutPlayers: override?.loanedOutPlayers ?? loanedOutPlayers,
        transferHistory: override?.transferHistory ?? transferHistory,
        transferredOutClubPlayerIds:
          override?.transferredOutClubPlayerIds ?? transferredOutClubPlayerIds,
        watchedPlayers: override?.watchedPlayers ?? watchedPlayers,
        pendingOffers: override?.pendingOffers ?? pendingOffers,
        financeLedger: override?.financeLedger ?? financeLedger,
        seasonHistory: override?.seasonHistory ?? seasonHistory,
        seasonEndReport:
          override?.seasonEndReport !== undefined
            ? override.seasonEndReport
            : seasonEndReport,
        newSeasonEvolutionReport:
          override?.newSeasonEvolutionReport !== undefined
            ? override.newSeasonEvolutionReport
            : newSeasonEvolutionReport,
        youthAcademy: override?.youthAcademy ?? youthAcademy,
        midSeasonEvolutionProcessedYear:
          override?.midSeasonEvolutionProcessedYear !== undefined
            ? override.midSeasonEvolutionProcessedYear
            : midSeasonEvolutionProcessedYear,
        negotiationStates: override?.negotiationStates ?? negotiationStates,
      };

      const stamped = saveCareerToSlot(payload);
      setSlots(loadAllCareerSlots());
      setHasUnsavedChanges(false);

      if (auth?.currentUser) {
        setCloudSyncStatus('syncing');
        saveCareerSlotToCloud(auth.currentUser, stamped, currency)
          .then(() => {
            setCloudSyncStatus('synced');
            setLastSyncMessage(`Slot 0${stamped.slotIndex} salvo na nuvem`);
          })
          .catch(() => {
            setCloudSyncStatus('error');
          });
      }
    },
    [
      activeSlot,
      clubs,
      standings,
      userClubId,
      userClub,
      managerName,
      currentYear,
      currentRound,
      seasonStepIndex,
      currentCalendarStep.competition,
      dayOffset,
      isMatchDay,
      squad,
      aiSquads,
      fixtures,
      secondaryStandings,
      secondaryFixtures,
      copaDoBrasil,
      libertadores,
      championsLeague,
      mundial,
      superMundial,
      accumulatedUclChampions,
      accumulatedLibChampions,
      messages,
      matchState,
      matchHistory,
      freeAgents,
      loanedOutPlayers,
      transferHistory,
      transferredOutClubPlayerIds,
      watchedPlayers,
      pendingOffers,
      financeLedger,
      seasonHistory,
      seasonEndReport,
      newSeasonEvolutionReport,
      youthAcademy,
      midSeasonEvolutionProcessedYear,
      negotiationStates,
      currency,
    ]
  );

  const handleManualCloudSync = useCallback(async () => {
    const user = auth?.currentUser ?? null;
    if (!user) {
      setIsAccountModalOpen(true);
      return;
    }
    setCloudSyncStatus('syncing');
    try {
      const summary = await syncAllCareerSlotsWithCloud(
        user,
        currency,
        activeSlot || 1
      );
      setSlots(summary.slots);
      if (activeSlot && summary.slots[activeSlot - 1] && summary.downloadedCount > 0) {
        applyCareerSaveToState(summary.slots[activeSlot - 1]!);
      }
      setCloudSyncStatus('synced');
      const msg =
        summary.downloadedCount > 0 || summary.uploadedCount > 0
          ? `Nuvem sincronizada (${summary.downloadedCount} baixado(s), ${summary.uploadedCount} enviado(s))`
          : 'Todos os slots já estão atualizados na nuvem';
      setLastSyncMessage(msg);
      showActionToast(`✓ ${msg}`, 'cyan');
    } catch {
      setCloudSyncStatus('error');
      showActionToast(
        'Não foi possível sincronizar com a nuvem agora. Seus saves locais estão seguros.',
        'amber'
      );
    }
  }, [currency, activeSlot, showActionToast]);

  // Listen to Firebase Auth state changes and auto-sync career slots across devices
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (!user) {
        setCloudSyncStatus('idle');
        setLastSyncMessage(null);
        return;
      }
      setCloudSyncStatus('syncing');
      try {
        const summary = await syncAllCareerSlotsWithCloud(
          user,
          currency,
          activeSlot || 1
        );
        setSlots(summary.slots);
        setCloudSyncStatus('synced');
        const msg =
          summary.downloadedCount > 0
            ? `${summary.downloadedCount} carreira(s) carregada(s) da sua conta na nuvem!`
            : `${summary.slots.filter(Boolean).length}/4 slots sincronizados na nuvem`;
        setLastSyncMessage(msg);
        if (summary.downloadedCount > 0) {
          showActionToast(`✓ ${msg}`, 'emerald');
        }
      } catch {
        setCloudSyncStatus('error');
      }
    });
    return () => unsubscribe();
  }, []);

  const applyCareerSaveToState = (save: CareerSaveData) => {
    const otherDivision: 'A' | 'B' = save.division === 'B' ? 'A' : 'B';
    const year = save.currentYear ?? 2026;
    const restoredAiSquads =
      save.aiSquads || buildInitialAiSquads(save.clubs, save.userClubId);
    const saveClub =
      save.clubs.find((c) => c.id === save.userClubId) || save.clubs[0];
    setActiveSlot(save.slotIndex);
    setManagerName(save.managerName);
    setUserClubId(save.userClubId);
    setCurrentYear(year);
    setClubs(save.clubs);
    setSquad(save.squad);
    setAiSquads(restoredAiSquads);
    setStandings(save.standings);
    setFixtures(save.fixtures);
    setSecondaryStandings(
      save.secondaryStandings ||
        getInitialStandingsForDivision(otherDivision, save.clubs)
    );
    setSecondaryFixtures(
      save.secondaryFixtures ||
        generateLeagueSchedule('__none__', otherDivision, save.clubs)
    );
    setCopaDoBrasil(
      save.copaDoBrasil || createInitialCopaDoBrasil(save.userClubId, save.clubs)
    );
    setLibertadores(
      save.libertadores || createInitialLibertadores(save.userClubId, undefined, year)
    );
    setChampionsLeague(
      save.championsLeague || createInitialChampionsLeague(year, save.clubs)
    );
    setMundial(save.mundial || createInitialMundial(year));
    setSuperMundial(
      save.superMundial ||
        createInitialSuperMundial({
          userClubId: save.userClubId,
          seasonYear: year,
          clubsPool: save.clubs,
          accumulatedUclChampions: save.accumulatedUclChampions,
          accumulatedLibChampions: save.accumulatedLibChampions,
        })
    );
    setAccumulatedUclChampions(save.accumulatedUclChampions || []);
    setAccumulatedLibChampions(save.accumulatedLibChampions || []);
    setMessages(save.messages);
    setFreeAgents(save.freeAgents || createInitialFreeAgents());
    setLoanedOutPlayers(save.loanedOutPlayers || []);
    setTransferHistory(save.transferHistory || []);
    setTransferredOutClubPlayerIds(save.transferredOutClubPlayerIds || []);
    setWatchedPlayers(save.watchedPlayers || []);
    setPendingOffers(save.pendingOffers || []);
    setFinanceLedger(
      save.financeLedger || createInitialFinanceLedger(saveClub, save.squad, year)
    );
    setYouthAcademy(
      save.youthAcademy ||
        createInitialYouthAcademy(
          saveClub.id,
          saveClub.reputation,
          saveClub.division,
          year
        )
    );
    setSeasonHistory(save.seasonHistory || []);
    setSeasonEndReport(save.seasonEndReport || null);
    setIsSeasonEndModalOpen(Boolean(save.seasonEndReport));
    setNewSeasonEvolutionReport(save.newSeasonEvolutionReport || null);
    setIsNewSeasonEvolutionModalOpen(false);
    setMidSeasonEvolutionProcessedYear(save.midSeasonEvolutionProcessedYear);
    setNegotiationStates(save.negotiationStates || {});
    setMarketFeedback(null);
    setCurrentRound(save.currentRound);
    setSeasonStepIndex(save.seasonStepIndex ?? 0);
    setDayOffset(save.dayOffset);
    setIsMatchDay(save.isMatchDay);
    setMatchState({ ...save.matchState, isRunning: false });
    setMatchHistory(save.matchHistory || []);
    setInspectedPlayerId(null);
    setInspectedExternalPlayer(null);
    setInspectedExternalListing(null);
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
    showActionToast(
      `✓ Carreira iniciada no ${stored.clubShortName} (Slot 0${slotIndex})!`,
      'emerald'
    );
    if (auth?.currentUser) {
      setCloudSyncStatus('syncing');
      saveCareerSlotToCloud(auth.currentUser, stored, currency)
        .then(() => {
          setCloudSyncStatus('synced');
          setLastSyncMessage(`Slot 0${slotIndex} sincronizado na nuvem`);
        })
        .catch(() => setCloudSyncStatus('error'));
    }
  };

  const handleLoadCareer = (slotIndex: CareerSlotIndex) => {
    const loaded = loadCareerSlot(slotIndex);
    if (!loaded) return;
    applyCareerSaveToState(loaded);
    showActionToast(
      `✓ Carreira do ${loaded.clubShortName} (Slot 0${slotIndex}) carregada!`,
      'emerald'
    );
  };

  const handleDeleteCareer = (slotIndex: CareerSlotIndex) => {
    deleteCareerSlot(slotIndex);
    setSlots(loadAllCareerSlots());
    if (activeSlot === slotIndex) {
      setActiveSlot(null);
    }
    showActionToast(`Slot 0${slotIndex} removido.`, 'amber');
    if (auth?.currentUser) {
      void deleteCareerSlotFromCloud(auth.currentUser, slotIndex).catch(() => {
        setCloudSyncStatus('error');
      });
    }
  };

  const handleImportCareer = (saveData: CareerSaveData) => {
    const stored = saveCareerToSlot(saveData);
    setSlots(loadAllCareerSlots());
    showActionToast(
      `✓ Backup de ${stored.clubShortName} importado no Slot 0${stored.slotIndex}!`,
      'emerald'
    );
    if (auth?.currentUser) {
      void saveCareerSlotToCloud(auth.currentUser, stored, currency).catch(() => {
        setCloudSyncStatus('error');
      });
    }
  };

  const handleManualSave = () => {
    if (!activeSlot) return;
    persistCareer();
    setSaveSuccessFlash(true);
    showActionToast(
      auth?.currentUser
        ? `✓ Carreira salva no Slot 0${activeSlot} e sincronizada na nuvem!`
        : `✓ Carreira salva localmente no Slot 0${activeSlot}!`,
      'emerald'
    );
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

      const userRankNow = Math.max(
        1,
        standings.findIndex((s) => s.clubId === userClubId) + 1
      );
      const { gateRevenue, attendance } = calculateMatchGateRevenue({
        club: userClub,
        rank: userRankNow,
        totalTeams: standings.length || 20,
        competition: comp,
        stageLabel:
          currentCalendarStep.copaStage ||
          currentCalendarStep.libStage ||
          currentCalendarStep.mundialStage ||
          currentCalendarStep.superMundialStage,
        isHome: matchState.isUserHome,
      });

      let updatedFixtures = fixtures;
      let newStandings = standings;
      let updatedSecondaryFixtures = secondaryFixtures;
      let newSecondaryStandings = secondaryStandings;
      let updatedCopaDoBrasil = copaDoBrasil;
      let updatedLibertadores = libertadores;
      let updatedChampionsLeague = championsLeague;
      let updatedMundial = mundial;
      let updatedSuperMundial = superMundial;
      let updatedAiSquads = aiSquads;
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

      const aiHomeMatches: HomeGateSettlementItem[] = [];

      if (comp === 'COPA_DO_BRASIL' && currentCalendarStep.copaStage) {
        updatedCopaDoBrasil = advanceCopaDoBrasilStage(
          copaDoBrasil,
          currentCalendarStep.copaStage,
          userMatchPayload,
          clubs,
          userClubId
        );
        const cdbFixes =
          updatedCopaDoBrasil.fixturesByStage[currentCalendarStep.copaStage] || [];
        updatedAiSquads = attributeAiRoundPlayerStats(
          updatedAiSquads,
          cdbFixes,
          userClubId
        );
        for (const fx of cdbFixes) {
          aiHomeMatches.push({
            clubId: fx.homeClubId,
            rank: 6,
            competition: 'COPA_DO_BRASIL',
            stageLabel: currentCalendarStep.copaStage,
          });
        }
        prizeMoney = getCupPrizeMoney(
          'COPA_DO_BRASIL',
          currentCalendarStep.copaStage,
          userAdvanced,
          currentCalendarStep.copaStage === 'Final' && userAdvanced,
          { isUserHome: matchState.isUserHome, clubDivision: userClub.division }
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
          const libGrpFixes = updatedLibertadores.groups.flatMap((g) =>
            g.fixtures.filter(
              (f) => f.roundNumber === currentCalendarStep.libGroupRound
            )
          );
          updatedAiSquads = attributeAiRoundPlayerStats(
            updatedAiSquads,
            libGrpFixes,
            userClubId
          );
          for (const fx of libGrpFixes) {
            aiHomeMatches.push({
              clubId: fx.homeClubId,
              rank: 4,
              competition: 'LIBERTADORES',
              stageLabel: 'Grupos',
            });
          }
          prizeMoney = getCupPrizeMoney(
            'LIBERTADORES',
            'Grupo',
            userWon90,
            false,
            { isUserHome: matchState.isUserHome, clubDivision: userClub.division }
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
          const libKoFixes =
            updatedLibertadores.knockoutFixtures[currentCalendarStep.libStage] || [];
          updatedAiSquads = attributeAiRoundPlayerStats(
            updatedAiSquads,
            libKoFixes,
            userClubId
          );
          for (const fx of libKoFixes) {
            aiHomeMatches.push({
              clubId: fx.homeClubId,
              rank: 4,
              competition: 'LIBERTADORES',
              stageLabel: currentCalendarStep.libStage,
            });
          }
          prizeMoney = getCupPrizeMoney(
            'LIBERTADORES',
            currentCalendarStep.libStage,
            userAdvanced,
            currentCalendarStep.libStage === 'Final' && userAdvanced,
            { isUserHome: matchState.isUserHome, clubDivision: userClub.division }
          );
          if (
            currentCalendarStep.libStage === 'Final' &&
            updatedLibertadores.championClubId &&
            updatedChampionsLeague.championClubId &&
            !updatedMundial.isSeeded
          ) {
            updatedMundial = seedMundialBracket(
              updatedMundial,
              updatedChampionsLeague.championClubId,
              updatedLibertadores.championClubId,
              clubs,
              userClubId
            );
          }
        }
      } else if (comp === 'CHAMPIONS_LEAGUE' && currentCalendarStep.uclStage) {
        updatedChampionsLeague = advanceChampionsLeagueStage(
          championsLeague,
          currentCalendarStep.uclStage,
          clubs,
          Math.random,
          userMatchPayload,
          userClubId
        );
        const uclFixes =
          updatedChampionsLeague.fixturesByStage[currentCalendarStep.uclStage] || [];
        updatedAiSquads = attributeAiRoundPlayerStats(
          updatedAiSquads,
          uclFixes,
          userClubId
        );
        for (const fx of uclFixes) {
          aiHomeMatches.push({
            clubId: fx.homeClubId,
            rank: 3,
            competition: 'CHAMPIONS_LEAGUE',
            stageLabel: currentCalendarStep.uclStage,
          });
        }
        prizeMoney = getCupPrizeMoney(
          'CHAMPIONS_LEAGUE',
          currentCalendarStep.uclStage,
          userAdvanced,
          currentCalendarStep.uclStage === 'Final' && userAdvanced
        );
        if (
          currentCalendarStep.uclStage === 'Final' &&
          updatedChampionsLeague.championClubId
        ) {
          updatedSuperMundial = syncSuperMundialWithChampionsResults(
            updatedSuperMundial,
            updatedChampionsLeague,
            clubs,
            userClubId
          );
          if (updatedLibertadores.championClubId && !updatedMundial.isSeeded) {
            updatedMundial = seedMundialBracket(
              updatedMundial,
              updatedChampionsLeague.championClubId,
              updatedLibertadores.championClubId,
              clubs,
              userClubId
            );
          }
        }
      } else if (comp === 'MUNDIAL' && currentCalendarStep.mundialStage) {
        updatedMundial = advanceMundialStage(
          mundial,
          currentCalendarStep.mundialStage,
          userMatchPayload,
          clubs,
          userClubId
        );
        const munFixes =
          updatedMundial.fixturesByStage[currentCalendarStep.mundialStage] || [];
        updatedAiSquads = attributeAiRoundPlayerStats(
          updatedAiSquads,
          munFixes,
          userClubId
        );
        for (const fx of munFixes) {
          aiHomeMatches.push({
            clubId: fx.homeClubId,
            rank: 2,
            competition: 'MUNDIAL',
            stageLabel: currentCalendarStep.mundialStage,
          });
        }
        prizeMoney = getCupPrizeMoney(
          'MUNDIAL',
          currentCalendarStep.mundialStage,
          userAdvanced,
          currentCalendarStep.mundialStage === 'Final' && userAdvanced
        );
      } else if (comp === 'SUPER_MUNDIAL' && superMundial.isActiveThisSeason) {
        if (
          currentCalendarStep.superMundialStage === 'Grupos' &&
          currentCalendarStep.superMundialGroupRound
        ) {
          updatedSuperMundial = advanceSuperMundialGroupRound(
            superMundial,
            currentCalendarStep.superMundialGroupRound,
            userMatchPayload,
            clubs,
            userClubId
          );
          const smGrpFixes = updatedSuperMundial.groups.flatMap((g) =>
            g.fixtures.filter(
              (f) => f.roundNumber === currentCalendarStep.superMundialGroupRound
            )
          );
          updatedAiSquads = attributeAiRoundPlayerStats(
            updatedAiSquads,
            smGrpFixes,
            userClubId
          );
          for (const fx of smGrpFixes) {
            aiHomeMatches.push({
              clubId: fx.homeClubId,
              rank: 3,
              competition: 'SUPER_MUNDIAL',
              stageLabel: 'Grupos',
            });
          }
          prizeMoney = getCupPrizeMoney(
            'SUPER_MUNDIAL',
            'Grupo',
            userWon90,
            false
          );
        } else if (
          currentCalendarStep.superMundialStage &&
          currentCalendarStep.superMundialStage !== 'Grupos'
        ) {
          updatedSuperMundial = advanceSuperMundialKnockoutStage(
            superMundial,
            currentCalendarStep.superMundialStage,
            userMatchPayload,
            clubs,
            userClubId
          );
          const smKoFixes =
            updatedSuperMundial.knockoutFixtures[
              currentCalendarStep.superMundialStage
            ] || [];
          updatedAiSquads = attributeAiRoundPlayerStats(
            updatedAiSquads,
            smKoFixes,
            userClubId
          );
          for (const fx of smKoFixes) {
            aiHomeMatches.push({
              clubId: fx.homeClubId,
              rank: 2,
              competition: 'SUPER_MUNDIAL',
              stageLabel: currentCalendarStep.superMundialStage,
            });
          }
          prizeMoney = getCupPrizeMoney(
            'SUPER_MUNDIAL',
            currentCalendarStep.superMundialStage,
            userAdvanced,
            currentCalendarStep.superMundialStage === 'Final' && userAdvanced
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
        updatedAiSquads = attributeAiRoundPlayerStats(
          updatedAiSquads,
          roundCompletedFixtures,
          userClubId
        );
        for (const fx of roundCompletedFixtures) {
          const rankIdx = newStandings.findIndex((s) => s.clubId === fx.homeClubId);
          aiHomeMatches.push({
            clubId: fx.homeClubId,
            rank: rankIdx >= 0 ? rankIdx + 1 : 10,
            totalTeams: newStandings.length || 20,
            competition: 'BRASILEIRAO',
          });
        }

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
        updatedAiSquads = attributeAiRoundPlayerStats(
          updatedAiSquads,
          secondaryRoundCompleted,
          userClubId
        );
        for (const fx of secondaryRoundCompleted) {
          const rankIdx = newSecondaryStandings.findIndex(
            (s) => s.clubId === fx.homeClubId
          );
          aiHomeMatches.push({
            clubId: fx.homeClubId,
            rank: rankIdx >= 0 ? rankIdx + 1 : 10,
            totalTeams: newSecondaryStandings.length || 20,
            competition: 'BRASILEIRAO',
          });
        }
      }

      const isCupAdvance =
        (comp === 'COPA_DO_BRASIL' ||
          comp === 'LIBERTADORES' ||
          comp === 'CHAMPIONS_LEAGUE' ||
          comp === 'MUNDIAL' ||
          comp === 'SUPER_MUNDIAL') &&
        userAdvanced;
      const confidenceDelta = isCupAdvance
        ? 8
        : userAdvanced
        ? 4
        : userDrew90 && !matchState.isKnockout
        ? 1
        : -4;
      const gateOperationalCost = calculateOperationalCost(gateRevenue);
      const totalRevenue = gateRevenue - gateOperationalCost + prizeMoney;

      let updatedClubs = clubs.map((c) =>
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
      updatedClubs = applyAiHomeGateRevenues({
        clubs: updatedClubs,
        userClubId,
        homeMatches: aiHomeMatches,
      }).updatedClubs;

      // Update player condition & season stats (goals, assists, avgRating) from match
      const userTokens = matchState.isUserHome
        ? matchState.homeTokens
        : matchState.awayTokens;
      const tokenMap = new Map(userTokens.map((t) => [t.id, t]));
      const goalCounts = new Map<string, number>();
      for (const evt of matchState.events) {
        if (evt.type === 'GOL' && evt.playerId) {
          goalCounts.set(evt.playerId, (goalCounts.get(evt.playerId) || 0) + 1);
        }
      }
      const userGoalsForAssistPool = goalCounts.size;
      let remainingAssists = Math.max(0, Math.round(userGoalsForAssistPool * 0.75));

      const userTeamTag = matchState.isUserHome ? 'HOME' : 'AWAY';
      const userYellowEvents = matchState.events.filter(
        (e) => e.type === 'CARTAO_AMARELO' && e.team === userTeamTag
      );

      const userInjuriesThisMatch = (matchState.inMatchInjuries || []).filter(
        (rec) => rec.team === userTeamTag
      );
      const injuryByPlayerId = new Map(
        userInjuriesThisMatch.map((rec) => [rec.playerId, rec])
      );

      const updatedSquadRaw = squad.map((p) => {
        const tok = tokenMap.get(p.id);
        const matchInjury = injuryByPlayerId.get(p.id);
        if (!tok && !matchInjury) {
          // Rested player: reset consecutive workload streak and recover freshness
          return p.injured
            ? p
            : {
                ...p,
                condition: Math.min(99, p.condition + 4),
                consecutiveMatches: 0,
              };
        }
        const gScored = goalCounts.get(p.id) || 0;
        let aCredited = 0;
        const matchScore = tok?.rating || 6.6;
        if (remainingAssists > 0 && p.position !== 'GOL' && matchScore >= 6.8 && gScored === 0) {
          aCredited = 1;
          remainingAssists -= 1;
        }
        const ycCount = userYellowEvents.filter(
          (e) => e.playerId === p.id || e.text.includes(p.name)
        ).length;
        const prevM = p.seasonStats.matches;
        const nextM = prevM + 1;
        const liveCond = tok?.condition ?? p.condition;
        const nextAvg = Number(
          ((p.seasonStats.avgRating * prevM + matchScore) / nextM).toFixed(2)
        );
        const condAfterMatch = isCupAdvance
          ? Math.min(100, Math.round(liveCond) + 5)
          : Math.max(35, Math.round(liveCond));
        const moraleAfterMatch = isCupAdvance
          ? (p.morale === 'Exuberante' ? 'Exuberante' : 'Muito Alta')
          : p.morale;

        let withStats: Player = {
          ...p,
          morale: moraleAfterMatch as Player['morale'],
          condition: condAfterMatch,
          consecutiveMatches: (p.consecutiveMatches ?? 0) + 1,
          seasonStats: {
            ...p.seasonStats,
            matches: nextM,
            goals: p.seasonStats.goals + gScored,
            assists: p.seasonStats.assists + aCredited,
            yellowCards: p.seasonStats.yellowCards + ycCount,
            avgRating: nextAvg,
          },
        };

        if (matchInjury) {
          withStats = applyInjuryToPlayer(withStats, {
            injuryType: matchInjury.injuryType,
            severity: matchInjury.severity,
            days: matchInjury.days,
          });
        }

        return applyPostMatchProbabilisticEvolution({
          player: withStats,
          matchRating: matchScore,
          goals: gScored,
          assists: aCredited,
          redCard: ycCount >= 2,
          clubReputation: userClub.reputation,
          division: userClub.division,
        });
      });

      const updatedSquad = ensureHealthyStartingLineup(updatedSquadRaw).updatedSquad;

      const updatedFinanceLedger: ClubFinanceLedger = {
        ...financeLedger,
        seasonGateRevenue: financeLedger.seasonGateRevenue + gateRevenue,
        seasonPrizeRevenue: financeLedger.seasonPrizeRevenue + prizeMoney,
        seasonOperationalExpense:
          financeLedger.seasonOperationalExpense + gateOperationalCost,
        lastMatchGateRevenue: gateRevenue,
        lastMatchAttendance: attendance,
      };

      // Living AI Transfer Market & Incoming User Offer Ticks (ONLY when window is open)
      let updatedTransferHistory = transferHistory;
      let updatedPendingOffers = pendingOffers;
      let extraMessages: InboxMessage[] = [];

      if (userInjuriesThisMatch.length > 0) {
        extraMessages.push(
          createInjuryInboxMessage({
            injuries: userInjuriesThisMatch,
            dateLabel: formatCalendarDate(dayOffset, currentYear),
            competitionLabel: matchState.competitionLabel,
          })
        );
      }

      if (isTransferWindowOpen(dayOffset)) {
        if (seasonStepIndex % 3 === 1) {
          const aiTick = simulateAiTransferWindowTick({
            clubs: updatedClubs,
            aiSquads: updatedAiSquads,
            userClubId,
            dayOffset,
            seasonYear: currentYear,
            maxDeals: 2,
          });
          updatedClubs = aiTick.updatedClubs;
          updatedAiSquads = aiTick.updatedAiSquads;
          if (aiTick.newRecords.length > 0) {
            updatedTransferHistory = [
              ...aiTick.newRecords,
              ...updatedTransferHistory,
            ].slice(0, 120);
          }
        }

        const hasListedPlayers = updatedSquad.some(
          (p) => p.isTransferListed || p.isLoanListed
        );
        const shouldCheckOffer =
          updatedPendingOffers.filter((o) => o.status === 'PENDING').length < 4 &&
          (hasListedPlayers ? seasonStepIndex % 2 === 0 : seasonStepIndex % 4 === 2);

        if (shouldCheckOffer) {
          const freshOffer = maybeGenerateIncomingOfferForUser({
            clubs: updatedClubs,
            userClub: updatedClubs.find((c) => c.id === userClubId) || userClub,
            userSquad: updatedSquad,
            pendingOffers: updatedPendingOffers,
            dayOffset,
            seasonYear: currentYear,
            aiSquads: updatedAiSquads,
          });
          if (freshOffer) {
            updatedPendingOffers = [freshOffer, ...updatedPendingOffers].slice(0, 15);
            extraMessages = [
              createOfferInboxMessage(
                freshOffer,
                updatedClubs.find((c) => c.id === userClubId) || userClub
              ),
            ];
          }
        }
      } else if (updatedPendingOffers.some((o) => o.status === 'PENDING')) {
        updatedPendingOffers = updatedPendingOffers.map((o) =>
          o.status === 'PENDING' ? { ...o, status: 'EXPIRED' } : o
        );
      }

      // Semiannual evolution check around July 1st (dayOffset >= 154)
      let finalSquad = updatedSquad;
      let finalClubs = updatedClubs;
      let finalAiSquads = updatedAiSquads;
      let finalYouthAcademy = youthAcademy;
      let newMidSeasonProcessedYear = midSeasonEvolutionProcessedYear;

      if (dayOffset >= 154 && midSeasonEvolutionProcessedYear !== currentYear) {
        const midRes = processMidSeasonEvolution({
          clubs: finalClubs,
          userClubId,
          userSquad: finalSquad,
          aiSquads: finalAiSquads,
          loanedOutPlayers,
          currentYear,
        });
        finalClubs = midRes.updatedClubs;
        finalSquad = midRes.updatedUserSquad;
        finalAiSquads = midRes.updatedAiSquads;
        const evolvedUserClub =
          finalClubs.find((c) => c.id === userClubId) || userClub;
        finalYouthAcademy = evolveYouthAcademyRoster({
          academy: finalYouthAcademy,
          clubReputation: evolvedUserClub.reputation,
          division: evolvedUserClub.division,
          phase: 'MID_SEASON',
        }).updatedAcademy;
        newMidSeasonProcessedYear = currentYear;
        setMidSeasonEvolutionProcessedYear(currentYear);
        extraMessages.push(midRes.inboxMessage);
      }

      const userPos =
        newStandings.findIndex((s) => s.clubId === userClubId) + 1;
      const penDetail =
        matchState.homePenalties !== null &&
        matchState.homePenalties !== undefined &&
        matchState.awayPenalties !== null &&
        matchState.awayPenalties !== undefined
          ? ` (Pênaltis: ${matchState.homePenalties} x ${matchState.awayPenalties})`
          : '';
      const resultLabel = isCupAdvance
        ? 'Classificação Conquistada!'
        : userAdvanced
        ? 'Vitória maiúscula'
        : userDrew90 && !matchState.isKnockout
        ? 'Empate disputado'
        : 'Revés duro';

      const compDisplay =
        matchState.competitionLabel ||
        `${matchState.roundNumber}ª Rodada · ${userLeagueShort}`;

      const postMatchMsg: InboxMessage = {
        id: `msg-post-${comp}-${Date.now()}`,
        date: `${formatCalendarDate(dayOffset, currentYear)} · 22:15`,
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
          matchState.isUserHome
            ? `Bilheteria em ${userClub.stadium} (${attendance.toLocaleString('pt-BR')} pagantes): ${formatCompactBRL(gateRevenue)}${prizeMoney > 0 ? ` + Premiação: ${formatCompactBRL(prizeMoney)}` : ''}.`
            : `Jogo como visitante (bilheteria destinada ao mandante)${prizeMoney > 0 ? ` · Premiação esportiva: ${formatCompactBRL(prizeMoney)}` : ''}.`,
        ],
        bulletPoints: [
          `Placar: ${homeClub.shortName} ${matchState.homeGoals} x ${matchState.awayGoals} ${awayClub.shortName}${penDetail}`,
          `Finalizações: ${matchState.homeShots} (${matchState.homeShotsOnTarget} no gol) vs ${matchState.awayShots} (${matchState.awayShotsOnTarget} no gol)`,
          isCupAdvance
            ? `★ DIREITO & RECOMPENSA DE COPA: Classificação na ${
                comp === 'COPA_DO_BRASIL'
                  ? 'Copa do Brasil'
                  : comp === 'CHAMPIONS_LEAGUE'
                  ? 'UEFA Champions League'
                  : comp === 'MUNDIAL'
                  ? 'Mundial de Clubes'
                  : comp === 'SUPER_MUNDIAL'
                  ? 'Super Mundial FIFA'
                  : 'Copa Libertadores'
              }! Bônus de premiação (${formatCompactBRL(prizeMoney)}), +8% confiança e moral elevado!`
            : comp === 'BRASILEIRAO'
            ? `Posição (${userLeagueShort}): ${userPos}º lugar`
            : userAdvanced
            ? `Classificação / resultado positivo garantido em ${compDisplay}`
            : `Fim da linha ou tropeço em ${compDisplay}`,
        ],
        actionLabel: 'Ver Competições',
        actionTargetTab: 'competitions',
      };

      const updatedMessages = [postMatchMsg, ...extraMessages, ...messages].slice(
        0,
        80
      );
      const processedMatchState = { ...matchState, roundProcessed: true };
      const newMatchRecord = createMatchHistoryRecordFromLiveMatch({
        match: processedMatchState,
        seasonYear: currentYear,
        dateLabel: formatCalendarDate(dayOffset, currentYear),
        fallbackDivision: userPlayableDivision,
      });
      const updatedMatchHistory = [
        newMatchRecord,
        ...matchHistory.filter((m) => m.id !== newMatchRecord.id),
      ];

      setClubs(finalClubs);
      setSquad(finalSquad);
      setAiSquads(finalAiSquads);
      setFixtures(updatedFixtures);
      setStandings(newStandings);
      setSecondaryFixtures(updatedSecondaryFixtures);
      setSecondaryStandings(newSecondaryStandings);
      setCopaDoBrasil(updatedCopaDoBrasil);
      setLibertadores(updatedLibertadores);
      setChampionsLeague(updatedChampionsLeague);
      setMundial(updatedMundial);
      setSuperMundial(updatedSuperMundial);
      setFinanceLedger(updatedFinanceLedger);
      setYouthAcademy(finalYouthAcademy);
      setTransferHistory(updatedTransferHistory);
      setPendingOffers(updatedPendingOffers);
      setMessages(updatedMessages);
      setMatchState(processedMatchState);
      setMatchHistory(updatedMatchHistory);

      persistCareer({
        clubs: finalClubs,
        squad: finalSquad,
        aiSquads: finalAiSquads,
        fixtures: updatedFixtures,
        standings: newStandings,
        secondaryFixtures: updatedSecondaryFixtures,
        secondaryStandings: newSecondaryStandings,
        copaDoBrasil: updatedCopaDoBrasil,
        libertadores: updatedLibertadores,
        championsLeague: updatedChampionsLeague,
        mundial: updatedMundial,
        superMundial: updatedSuperMundial,
        financeLedger: updatedFinanceLedger,
        youthAcademy: finalYouthAcademy,
        transferHistory: updatedTransferHistory,
        pendingOffers: updatedPendingOffers,
        messages: updatedMessages,
        matchState: processedMatchState,
        matchHistory: updatedMatchHistory,
        midSeasonEvolutionProcessedYear: newMidSeasonProcessedYear,
      });
    }
  }, [
    matchState,
    matchHistory,
    fixtures,
    clubs,
    standings,
    secondaryFixtures,
    secondaryStandings,
    copaDoBrasil,
    libertadores,
    championsLeague,
    mundial,
    superMundial,
    aiSquads,
    financeLedger,
    transferHistory,
    pendingOffers,
    currentCalendarStep,
    seasonStepIndex,
    currentYear,
    squad,
    messages,
    dayOffset,
    homeClub.shortName,
    awayClub.shortName,
    userClub,
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
        const userTeamSide = prev.isUserHome ? 'HOME' : 'AWAY';
        const prevUserInjuries = (prev.inMatchInjuries || []).filter(
          (rec) => rec.team === userTeamSide
        ).length;
        const next = stepMatchMinute(prev, homeClub, awayClub, squad);
        const nextUserInjuries = (next.inMatchInjuries || []).filter(
          (rec) => rec.team === userTeamSide
        );
        // Auto-pause live match if a user player just suffered an injury so the manager can substitute immediately
        if (nextUserInjuries.length > prevUserInjuries && next.phase !== 'FULL_TIME') {
          const newest = nextUserInjuries[nextUserInjuries.length - 1];
          showActionToast(
            `⚠ Lesão em campo: ${newest.playerName} (${newest.injuryType} · ~${formatInjuryDurationShort(newest.days)}). Substitua agora!`,
            'amber'
          );
          return { ...next, isRunning: false };
        }
        return next;
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
    showActionToast,
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
    const targetPlayer = squad.find((p) => p.id === playerId);
    const roleDef = getRoleById(roleId);
    setSquad((prev) =>
      prev.map((p) =>
        p.id === playerId
          ? { ...p, assignedRole: roleId, assignedDuty: duty }
          : p
      )
    );
    setHasUnsavedChanges(true);
    if (targetPlayer) {
      showActionToast(
        `✓ ${targetPlayer.name}: ${roleDef.name} (${duty})`,
        'cyan'
      );
    }
  };

  const handleSwapPlayers = (playerAId: string, playerBId: string) => {
    const playerA = squad.find((p) => p.id === playerAId);
    const playerB = squad.find((p) => p.id === playerBId);
    if (playerA && playerB) {
      showActionToast(
        `⇄ Troca realizada: ${playerA.name} ⇄ ${playerB.name}`,
        'emerald'
      );
    }
    setSquad((prev) => {
      const pA = prev.find((p) => p.id === playerAId);
      const pB = prev.find((p) => p.id === playerBId);
      if (!pA || !pB) return prev;

      const updated = prev.map((p) => {
        if (p.id === playerAId) {
          return {
            ...p,
            isStarter: pB.isStarter,
            slotIndex: pB.slotIndex,
          };
        }
        if (p.id === playerBId) {
          return {
            ...p,
            isStarter: pA.isStarter,
            slotIndex: pA.slotIndex,
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
          matchState.isUserHome,
          transferredOutClubPlayerIds,
          aiSquads
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
    setSquad((prev) => {
      const updated = pickBestLineupForFormation(prev, userClub.formation);
      if (matchState.phase === 'PRE_MATCH') {
        const { homeTokens, awayTokens } = buildPitchTokens(
          homeClub,
          awayClub,
          updated,
          matchState.isUserHome,
          transferredOutClubPlayerIds,
          aiSquads
        );
        setMatchState((m) => ({ ...m, homeTokens, awayTokens }));
      }
      return updated;
    });
    setHasUnsavedChanges(true);
    showActionToast(
      `✓ Melhor Escalação aplicada (${userClub.formation})!`,
      'emerald'
    );
  };

  const handleRenewContract = (
    player: Player,
    offeredSalary: number,
    addYears: 1 | 2 | 3
  ): ContractRenewalOutcome => {
    const res = negotiateContractRenewal({
      player,
      club: userClub,
      userSquad: squad,
      loanedOutPlayers,
      currentYear,
      offeredSalary,
      addYears,
    });

    if (res.outcome === 'ACEITA' && res.updatedPlayer) {
      const updatedSquad = squad.map((p) =>
        p.id === player.id ? res.updatedPlayer! : p
      );
      const renewalMsg: InboxMessage = {
        id: `msg-renew-${player.id}-${Date.now()}`,
        date: `${formatCalendarDate(dayOffset, currentYear)} · 16:00`,
        sender: 'Departamento Jurídico',
        senderRole: 'Renovação Contratual',
        subject: `Contrato Renovado: ${player.name} até ${res.updatedPlayer.contractEndYear}`,
        category: 'Diretoria',
        priority: 'positive',
        read: false,
        relatedPlayerId: player.id,
        body: [
          `${player.name} assinou novo vínculo com o ${userClub.shortName} (+${addYears} ano(s), válido até fim de ${res.updatedPlayer.contractEndYear}).`,
          `Novo salário mensal: ${formatCompactBRL(offeredSalary)}/mês.`,
        ],
        actionLabel: 'Ver Elenco',
        actionTargetTab: 'squad',
      };
      const nextMsgs = [renewalMsg, ...messages];
      setSquad(updatedSquad);
      setMessages(nextMsgs);
      setHasUnsavedChanges(true);
      persistCareer({
        squad: updatedSquad,
        messages: nextMsgs,
      });
      showActionToast(`✓ ${res.headline}`, 'emerald');
    } else if (res.outcome === 'CONTRAPROPOSTA') {
      showActionToast(`⇄ ${res.headline}`, 'amber');
    } else {
      showActionToast(`✕ ${res.headline}`, 'rose');
    }

    return res;
  };

  const handleToggleDoNotRenewContract = (
    player: Player,
    doNotRenew: boolean
  ) => {
    const updatedPlayer = setContractNonRenewalDecision(player, doNotRenew);
    const updatedSquad = squad.map((p) =>
      p.id === player.id ? updatedPlayer : p
    );
    setSquad(updatedSquad);
    setHasUnsavedChanges(true);
    persistCareer({ squad: updatedSquad });
    if (doNotRenew) {
      showActionToast(
        `✕ Definido: ${player.name} não terá contrato renovado e sairá livre ao fim do vínculo.`,
        'amber'
      );
    } else {
      showActionToast(
        `✓ Conversas de renovação reabertas com ${player.name}.`,
        'cyan'
      );
    }
  };

  const handleChangeFormation = (formation: FormationType) => {
    showActionToast(`✓ Esquema tático alterado para ${formation}`, 'cyan');
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
          matchState.isUserHome,
          transferredOutClubPlayerIds,
          aiSquads
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
    showActionToast(
      `✓ Instrução tática atualizada (${instructions.mentality})`,
      'cyan'
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
    const reserveOvr = calculatePlayerOverall(
      reserveIn.attributes,
      reserveIn.position
    );

    setMatchState((prev) => {
      const replaceToken = (tokens: typeof prev.homeTokens) =>
        tokens.map((t) =>
          t.id === starterOut.id
            ? {
                ...t,
                id: reserveIn.id,
                number: reserveIn.number,
                ovr: reserveOvr,
                name: reserveIn.name,
                shortName,
                sector: reserveIn.sector,
                roleCode: role.shortCode,
                condition: reserveIn.condition,
                rating: 6.8,
                injuredInMatch: false,
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
    if (matchState.phase === 'PRE_MATCH') {
      const { updatedSquad, replacedStarters } = ensureHealthyStartingLineup(squad);
      if (replacedStarters.length > 0) {
        setSquad(updatedSquad);
        const swappedNote = replacedStarters
          .map((s) => `${s.injuredOut.name} (DM) → ${s.replacementIn.name}`)
          .join(', ');
        showActionToast(
          `Ajuste médico antes do apito: ${swappedNote}`,
          'amber'
        );
        setMatchState((prev) => {
          const rebuilt = buildPitchTokens(
            homeClub,
            awayClub,
            updatedSquad,
            prev.isUserHome,
            transferredOutClubPlayerIds,
            aiSquads
          );
          return {
            ...prev,
            homeTokens: prev.isUserHome ? rebuilt.homeTokens : prev.homeTokens,
            awayTokens: !prev.isUserHome ? rebuilt.awayTokens : prev.awayTokens,
            phase: 'FIRST_HALF',
            isRunning: true,
          };
        });
        return;
      }
    }

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

  const handleEnterMatchMoment = () => {
    setIsMatchDay(true);
    setActiveTab('match');
  };

  const handleQuickSimulateFromOutside = () => {
    setIsMatchDay(true);
    setActiveTab('match');
    handleInstantFinishMatch();
  };

  const applyAutoSimSnapshotToState = useCallback((snap: AutoSimCareerSnapshot) => {
    setClubs(snap.clubs);
    setSquad(snap.squad);
    if (snap.aiSquads) setAiSquads(snap.aiSquads);
    setStandings(snap.standings);
    setFixtures(snap.fixtures);
    setSecondaryStandings(snap.secondaryStandings);
    setSecondaryFixtures(snap.secondaryFixtures);
    setCopaDoBrasil(snap.copaDoBrasil);
    setLibertadores(snap.libertadores);
    if (snap.championsLeague) setChampionsLeague(snap.championsLeague);
    if (snap.mundial) setMundial(snap.mundial);
    if (snap.superMundial) setSuperMundial(snap.superMundial);
    setMessages(snap.messages);
    setMatchState(snap.matchState);
    if (snap.matchHistory) setMatchHistory(snap.matchHistory);
    if (snap.seasonYear) setCurrentYear(snap.seasonYear);
    setSeasonStepIndex(snap.seasonStepIndex);
    setCurrentRound(snap.currentRound);
    setDayOffset(snap.dayOffset);
    setIsMatchDay(snap.isMatchDay);
    if (snap.pendingOffers) setPendingOffers(snap.pendingOffers);
    if (snap.transferHistory) setTransferHistory(snap.transferHistory);
    if (snap.financeLedger) setFinanceLedger(snap.financeLedger);
    if (snap.youthAcademy) setYouthAcademy(snap.youthAcademy);
    if (snap.midSeasonEvolutionProcessedYear !== undefined) {
      setMidSeasonEvolutionProcessedYear(snap.midSeasonEvolutionProcessedYear);
    }
  }, []);

  const finalizeAutoSimSummary = useCallback(
    (
      finalSnap: AutoSimCareerSnapshot,
      finalLogs: AutoSimMatchLogEntry[],
      targetLabel: string,
      wasStoppedEarly: boolean
    ) => {
      const yr = finalSnap.seasonYear ?? currentYear;
      const userLogs = finalLogs.filter((l) => l.outcome !== 'BYE');
      const wins = userLogs.filter((l) => l.outcome === 'V').length;
      const draws = userLogs.filter((l) => l.outcome === 'E').length;
      const losses = userLogs.filter((l) => l.outcome === 'D').length;
      const rank =
        finalSnap.standings.findIndex((s) => s.clubId === finalSnap.userClubId) + 1;
      const club =
        finalSnap.clubs.find((c) => c.id === finalSnap.userClubId) || userClub;

      const summaryMsg: InboxMessage = {
        id: `msg-autosim-summary-${Date.now()}`,
        date: formatCalendarDate(finalSnap.dayOffset, yr),
        sender: 'Comissão Técnica (IA)',
        senderRole: 'Relatório de Simulação Automática',
        subject: `${
          wasStoppedEarly ? 'Simulação Interrompida' : 'Simulação Concluída'
        } (${targetLabel}): ${wins}V-${draws}E-${losses}D`,
        category: 'Tática',
        priority: wins >= losses ? 'positive' : 'warning',
        read: false,
        body: [
          `Período simulado partida por partida até ${formatCalendarDate(
            finalSnap.dayOffset,
            yr
          )} com formações e táticas otimizadas automaticamente a cada jogo.`,
          `Desempenho no período: ${userLogs.length} partida(s) (${wins}V, ${draws}E, ${losses}D). Posição atual: ${rank}º lugar · Saldo em caixa: ${formatCompactBRL(
            club.cashBalance
          )}.`,
        ],
        actionLabel: 'Ver Competições',
        actionTargetTab: 'competitions',
      };

      const withSummary: AutoSimCareerSnapshot = {
        ...finalSnap,
        messages: [summaryMsg, ...finalSnap.messages].slice(0, 80),
      };

      const finishedAfterAuto = checkSeasonCompleted(withSummary);
      const generatedReport = finishedAfterAuto
        ? buildSeasonEndSummary({
            seasonYear: yr,
            clubs: withSummary.clubs,
            userClubId: withSummary.userClubId,
            userSquad: withSummary.squad,
            aiSquads: withSummary.aiSquads || aiSquads,
            standings: withSummary.standings,
            secondaryStandings: withSummary.secondaryStandings,
            copaDoBrasil: withSummary.copaDoBrasil,
            libertadores: withSummary.libertadores,
            championsLeague: withSummary.championsLeague,
            mundial: withSummary.mundial,
            superMundial: withSummary.superMundial,
          })
        : null;

      applyAutoSimSnapshotToState(withSummary);
      if (generatedReport) {
        setSeasonEndReport(generatedReport);
      }

      const stepComp =
        SEASON_CALENDAR[withSummary.seasonStepIndex]?.competition || 'BRASILEIRAO';
      persistCareer({
        clubs: withSummary.clubs,
        squad: withSummary.squad,
        aiSquads: withSummary.aiSquads,
        standings: withSummary.standings,
        fixtures: withSummary.fixtures,
        secondaryStandings: withSummary.secondaryStandings,
        secondaryFixtures: withSummary.secondaryFixtures,
        copaDoBrasil: withSummary.copaDoBrasil,
        libertadores: withSummary.libertadores,
        championsLeague: withSummary.championsLeague,
        mundial: withSummary.mundial,
        superMundial: withSummary.superMundial,
        messages: withSummary.messages,
        matchState: withSummary.matchState,
        matchHistory: withSummary.matchHistory,
        currentYear: yr,
        seasonStepIndex: withSummary.seasonStepIndex,
        activeCompetition: stepComp,
        currentRound: withSummary.currentRound,
        dayOffset: withSummary.dayOffset,
        isMatchDay: withSummary.isMatchDay,
        pendingOffers: withSummary.pendingOffers,
        transferHistory: withSummary.transferHistory,
        financeLedger: withSummary.financeLedger,
        youthAcademy: withSummary.youthAcademy,
        seasonEndReport: generatedReport,
      });
    },
    [applyAutoSimSnapshotToState, persistCareer, userClub, currentYear, aiSquads]
  );

  const handleStartAutoSimulation = (
    targetDayOffset: number,
    targetLabel: string
  ) => {
    if (isSeasonFinished) {
      if (seasonEndReport) setIsSeasonEndModalOpen(true);
      return;
    }

    const initialSnapshot: AutoSimCareerSnapshot = {
      clubs,
      userClubId,
      squad,
      loanedOutPlayers,
      aiSquads,
      standings,
      fixtures,
      secondaryStandings,
      secondaryFixtures,
      copaDoBrasil,
      libertadores,
      championsLeague,
      mundial,
      superMundial,
      messages,
      matchState,
      matchHistory,
      seasonYear: currentYear,
      seasonStepIndex,
      currentRound,
      dayOffset,
      isMatchDay,
      transferredOutClubPlayerIds,
      pendingOffers,
      transferHistory,
      financeLedger,
      youthAcademy,
      midSeasonEvolutionProcessedYear,
    };

    const { userMatchSteps } = countStepsUntilDayOffset(
      initialSnapshot,
      targetDayOffset
    );

    autoSimSnapshotRef.current = initialSnapshot;
    setAutoSimUi({
      isOpen: true,
      isRunning: true,
      isPaused: false,
      isDone: false,
      wasStoppedEarly: false,
      targetLabel,
      startDayOffset: dayOffset,
      currentDayOffset: dayOffset,
      targetDayOffset,
      plannedUserMatches: userMatchSteps,
      logs: [],
      pausedOffer: null,
      pendingDoneAfterOffer: false,
      resumeInstantMode: false,
      offerResolutionNote: null,
    });
  };

  const handlePauseAutoSimulation = () => {
    if (!autoSimUi.isRunning || autoSimUi.pausedOffer) return;
    setAutoSimUi((prev) => ({
      ...prev,
      isRunning: false,
      isPaused: true,
      wasStoppedEarly: false,
    }));
  };

  const handleResumeAutoSimulation = () => {
    if (!autoSimUi.isPaused || autoSimUi.pausedOffer || autoSimUi.isDone || autoSimUi.wasStoppedEarly) {
      return;
    }
    setAutoSimUi((prev) => ({
      ...prev,
      isRunning: true,
      isPaused: false,
      wasStoppedEarly: false,
    }));
  };

  const handleStopAutoSimulation = () => {
    if (!autoSimUi.isRunning && !autoSimUi.isPaused && !autoSimUi.pausedOffer) return;
    const snap = autoSimSnapshotRef.current;
    if (snap) {
      finalizeAutoSimSummary(snap, autoSimUi.logs, autoSimUi.targetLabel, true);
    }
    setAutoSimUi((prev) => ({
      ...prev,
      isRunning: false,
      isPaused: false,
      isDone: false,
      wasStoppedEarly: true,
      pausedOffer: null,
      pendingDoneAfterOffer: false,
      resumeInstantMode: false,
    }));
  };

  const runInstantAutoSimFromSnapshot = useCallback(
    (
      startSnap: AutoSimCareerSnapshot,
      startLogs: AutoSimMatchLogEntry[],
      targetDayOffset: number,
      targetLabel: string
    ) => {
      let working = startSnap;
      const collectedLogs = [...startLogs];
      let guard = 0;
      let done = false;
      let pausedOffer: IncomingTransferOffer | null = null;

      while (!done && guard < 120) {
        guard++;
        const stepRes = simulateNextAutoStep(working, targetDayOffset);
        working = stepRes.snapshot;
        if (stepRes.logEntry) {
          collectedLogs.push(stepRes.logEntry);
        }
        done = stepRes.done;
        if (stepRes.newOffer) {
          pausedOffer = stepRes.newOffer;
          break;
        }
      }

      autoSimSnapshotRef.current = working;
      applyAutoSimSnapshotToState(working);

      if (pausedOffer) {
        setAutoSimUi((prev) => ({
          ...prev,
          isRunning: false,
          isPaused: false,
          isDone: false,
          wasStoppedEarly: false,
          currentDayOffset: working.dayOffset,
          logs: collectedLogs,
          pausedOffer,
          pendingDoneAfterOffer: done,
          resumeInstantMode: true,
        }));
        return;
      }

      finalizeAutoSimSummary(working, collectedLogs, targetLabel, false);
      setAutoSimUi((prev) => ({
        ...prev,
        isRunning: false,
        isPaused: false,
        isDone: true,
        wasStoppedEarly: false,
        currentDayOffset: working.dayOffset,
        logs: collectedLogs,
        pausedOffer: null,
        pendingDoneAfterOffer: false,
        resumeInstantMode: false,
      }));
    },
    [applyAutoSimSnapshotToState, finalizeAutoSimSummary]
  );

  const handleFinishAutoSimulationInstant = () => {
    if (!autoSimSnapshotRef.current) return;
    runInstantAutoSimFromSnapshot(
      autoSimSnapshotRef.current,
      autoSimUi.logs,
      autoSimUi.targetDayOffset,
      autoSimUi.targetLabel
    );
  };

  const handleResolveAutoSimOffer = (
    offerId: string,
    action: IncomingOfferAction
  ) => {
    const snap = autoSimSnapshotRef.current;
    if (!snap) return;

    const snapPending = snap.pendingOffers || [];
    const targetOffer =
      snapPending.find((o) => o.id === offerId) || autoSimUi.pausedOffer;
    if (!targetOffer || targetOffer.status !== 'PENDING') return;

    const snapUserClub =
      snap.clubs.find((c) => c.id === snap.userClubId) || userClub;
    const snapYear = snap.seasonYear ?? currentYear;

    const res = resolveIncomingOfferAction({
      offer: targetOffer,
      action,
      userClub: snapUserClub,
      userSquad: snap.squad,
      aiSquads: snap.aiSquads || aiSquads,
      loanedOutPlayers,
      clubs: snap.clubs,
      dayOffset: snap.dayOffset,
      seasonYear: snapYear,
    });

    const updatedPendingOffers = snapPending.map((o) =>
      o.id === offerId ? res.updatedOffer : o
    );
    const nextHistory = res.transferRecord
      ? [res.transferRecord, ...(snap.transferHistory || [])].slice(0, 120)
      : snap.transferHistory || [];
    const nextLedger: ClubFinanceLedger | undefined =
      res.outcome === 'ACCEPTED' && snap.financeLedger
        ? {
            ...snap.financeLedger,
            seasonTransferIncome:
              snap.financeLedger.seasonTransferIncome + res.finalFee,
          }
        : snap.financeLedger;

    let nextMatchState = snap.matchState;
    if (res.outcome === 'ACCEPTED' && snap.matchState.phase === 'PRE_MATCH') {
      const snapHome =
        res.updatedClubs.find((c) => c.id === snap.matchState.homeClubId) ||
        homeClub;
      const snapAway =
        res.updatedClubs.find((c) => c.id === snap.matchState.awayClubId) ||
        awayClub;
      const { homeTokens, awayTokens } = buildPitchTokens(
        snapHome,
        snapAway,
        res.updatedUserSquad,
        snap.matchState.isUserHome,
        snap.transferredOutClubPlayerIds || transferredOutClubPlayerIds,
        res.updatedAiSquads
      );
      nextMatchState = { ...snap.matchState, homeTokens, awayTokens };
    }

    const updatedSnap: AutoSimCareerSnapshot = {
      ...snap,
      clubs: res.updatedClubs,
      squad: res.updatedUserSquad,
      aiSquads: res.updatedAiSquads,
      pendingOffers: updatedPendingOffers,
      transferHistory: nextHistory,
      financeLedger: nextLedger,
      matchState: nextMatchState,
    };

    autoSimSnapshotRef.current = updatedSnap;
    setLoanedOutPlayers(res.updatedLoanedOutPlayers);
    applyAutoSimSnapshotToState(updatedSnap);

    const resolutionNote =
      res.outcome === 'ACCEPTED'
        ? `Proposta aceita: ${targetOffer.playerName} vendido para ${
            targetOffer.fromClubName
          } por ${formatCompactBRL(res.finalFee)}.${
            res.promotedStarterName
              ? ` ${res.promotedStarterName} assumiu a titularidade.`
              : ''
          }`
        : res.outcome === 'COUNTER_REJECTED'
        ? `${targetOffer.fromClubName} não aceitou a contraproposta de ${formatCompactBRL(
            res.finalFee
          )} por ${targetOffer.playerName}.`
        : `Proposta de ${targetOffer.fromClubName} por ${targetOffer.playerName} recusada. O atleta permanece no elenco.`;

    if (autoSimUi.pendingDoneAfterOffer) {
      finalizeAutoSimSummary(
        updatedSnap,
        autoSimUi.logs,
        autoSimUi.targetLabel,
        false
      );
      setAutoSimUi((prev) => ({
        ...prev,
        isRunning: false,
        isPaused: false,
        isDone: true,
        wasStoppedEarly: false,
        pausedOffer: null,
        pendingDoneAfterOffer: false,
        resumeInstantMode: false,
        offerResolutionNote: resolutionNote,
      }));
      return;
    }

    if (autoSimUi.resumeInstantMode) {
      setAutoSimUi((prev) => ({
        ...prev,
        pausedOffer: null,
        pendingDoneAfterOffer: false,
        offerResolutionNote: resolutionNote,
      }));
      runInstantAutoSimFromSnapshot(
        updatedSnap,
        autoSimUi.logs,
        autoSimUi.targetDayOffset,
        autoSimUi.targetLabel
      );
      return;
    }

    setAutoSimUi((prev) => ({
      ...prev,
      isRunning: true,
      isPaused: false,
      pausedOffer: null,
      pendingDoneAfterOffer: false,
      offerResolutionNote: resolutionNote,
    }));
  };

  useEffect(() => {
    if (!autoSimUi.isOpen || !autoSimUi.isRunning) return;

    const timer = window.setInterval(() => {
      const currentSnap = autoSimSnapshotRef.current;
      if (!currentSnap) return;

      const stepRes = simulateNextAutoStep(currentSnap, autoSimUi.targetDayOffset);
      autoSimSnapshotRef.current = stepRes.snapshot;
      applyAutoSimSnapshotToState(stepRes.snapshot);

      setAutoSimUi((prev) => {
        const nextLogs = stepRes.logEntry
          ? [...prev.logs, stepRes.logEntry]
          : prev.logs;

        if (stepRes.newOffer) {
          return {
            ...prev,
            isRunning: false,
            isPaused: false,
            isDone: false,
            wasStoppedEarly: false,
            currentDayOffset: stepRes.snapshot.dayOffset,
            logs: nextLogs,
            pausedOffer: stepRes.newOffer,
            pendingDoneAfterOffer: stepRes.done,
            resumeInstantMode: false,
          };
        }

        if (stepRes.done) {
          finalizeAutoSimSummary(
            stepRes.snapshot,
            nextLogs,
            prev.targetLabel,
            false
          );
          return {
            ...prev,
            isRunning: false,
            isPaused: false,
            isDone: true,
            wasStoppedEarly: false,
            currentDayOffset: stepRes.snapshot.dayOffset,
            logs: nextLogs,
            pausedOffer: null,
            pendingDoneAfterOffer: false,
            resumeInstantMode: false,
          };
        }

        return {
          ...prev,
          currentDayOffset: stepRes.snapshot.dayOffset,
          logs: nextLogs,
        };
      });
    }, 150);

    return () => window.clearInterval(timer);
  }, [
    autoSimUi.isOpen,
    autoSimUi.isRunning,
    autoSimUi.targetDayOffset,
    applyAutoSimSnapshotToState,
    finalizeAutoSimSummary,
  ]);

  const handleOpenSeasonEndModal = useCallback(() => {
    const report =
      seasonEndReport ||
      buildSeasonEndSummary({
        seasonYear: currentYear,
        clubs,
        userClubId,
        userSquad: squad,
        aiSquads,
        standings,
        secondaryStandings,
        copaDoBrasil,
        libertadores,
        championsLeague,
        mundial,
        superMundial,
      });
    setSeasonEndReport(report);
    setIsSeasonEndModalOpen(true);
    persistCareer({ seasonEndReport: report });
  }, [
    seasonEndReport,
    currentYear,
    clubs,
    userClubId,
    squad,
    aiSquads,
    standings,
    secondaryStandings,
    copaDoBrasil,
    libertadores,
    championsLeague,
    mundial,
    superMundial,
    persistCareer,
  ]);

  const handleStartNextSeason = () => {
    const rollover = executeNewSeasonRollover({
      currentYear,
      clubs,
      userClubId,
      userSquad: squad,
      aiSquads,
      freeAgents,
      loanedOutPlayers,
      standings,
      secondaryStandings,
      copaDoBrasil,
      libertadores,
      championsLeague,
      mundial,
      superMundial,
      accumulatedUclChampions,
      accumulatedLibChampions,
      seasonHistory,
      managerName,
      youthAcademy,
    });

    const nextHistory = [
      rollover.archiveEntry,
      ...seasonHistory.filter((h) => h.year !== rollover.archiveEntry.year),
    ];

    setCurrentYear(rollover.nextYear);
    setClubs(rollover.updatedClubs);
    setSquad(rollover.updatedUserSquad);
    setAiSquads(rollover.updatedAiSquads);
    setFreeAgents(rollover.updatedFreeAgents);
    setLoanedOutPlayers(rollover.updatedLoanedOut);
    setStandings(rollover.nextStandings);
    setFixtures(rollover.nextFixtures);
    setSecondaryStandings(rollover.nextSecondaryStandings);
    setSecondaryFixtures(rollover.nextSecondaryFixtures);
    setCopaDoBrasil(rollover.nextCopaDoBrasil);
    setLibertadores(rollover.nextLibertadores);
    setChampionsLeague(rollover.nextChampionsLeague);
    setMundial(rollover.nextMundial);
    setSuperMundial(rollover.nextSuperMundial);
    setAccumulatedUclChampions(rollover.nextAccumulatedUclChampions);
    setAccumulatedLibChampions(rollover.nextAccumulatedLibChampions);
    setFinanceLedger(rollover.nextFinanceLedger);
    setYouthAcademy(rollover.nextYouthAcademy);
    setMatchState(rollover.nextMatchState);
    setMessages(rollover.nextMessages);
    setSeasonHistory(nextHistory);
    setTransferredOutClubPlayerIds([]);
    setPendingOffers([]);
    setSeasonStepIndex(0);
    setCurrentRound(1);
    setDayOffset(0);
    setIsMatchDay(false);
    setSeasonEndReport(null);
    setIsSeasonEndModalOpen(false);
    setNewSeasonEvolutionReport(rollover.newSeasonEvolutionReport);
    setIsNewSeasonEvolutionModalOpen(true);
    setMarketFeedback(null);
    setActiveTab('inbox');

    persistCareer({
      currentYear: rollover.nextYear,
      division: rollover.nextDivision,
      clubs: rollover.updatedClubs,
      squad: rollover.updatedUserSquad,
      aiSquads: rollover.updatedAiSquads,
      freeAgents: rollover.updatedFreeAgents,
      loanedOutPlayers: rollover.updatedLoanedOut,
      standings: rollover.nextStandings,
      fixtures: rollover.nextFixtures,
      secondaryStandings: rollover.nextSecondaryStandings,
      secondaryFixtures: rollover.nextSecondaryFixtures,
      copaDoBrasil: rollover.nextCopaDoBrasil,
      libertadores: rollover.nextLibertadores,
      championsLeague: rollover.nextChampionsLeague,
      mundial: rollover.nextMundial,
      superMundial: rollover.nextSuperMundial,
      accumulatedUclChampions: rollover.nextAccumulatedUclChampions,
      accumulatedLibChampions: rollover.nextAccumulatedLibChampions,
      financeLedger: rollover.nextFinanceLedger,
      youthAcademy: rollover.nextYouthAcademy,
      matchState: rollover.nextMatchState,
      messages: rollover.nextMessages,
      seasonHistory: nextHistory,
      transferredOutClubPlayerIds: [],
      pendingOffers: [],
      seasonStepIndex: 0,
      activeCompetition: 'BRASILEIRAO',
      currentRound: 1,
      dayOffset: 0,
      isMatchDay: false,
      seasonEndReport: null,
      newSeasonEvolutionReport: rollover.newSeasonEvolutionReport,
    });
  };

  const handleAdvanceToNextRound = () => {
    if (isSeasonFinished) {
      setIsMatchDay(false);
      handleOpenSeasonEndModal();
      return;
    }

    let nextIdx = Math.min(SEASON_CALENDAR.length - 1, seasonStepIndex + 1);
    let nextCdb = copaDoBrasil;
    let nextLib = libertadores;
    let nextUcl = championsLeague;
    let nextMundial = mundial;
    let nextSuperMundial = superMundial;
    let nextAiSquads = aiSquads;
    let nextLeagueRound = currentRound;
    const extraInboxMessages: InboxMessage[] = [];
    const skippedAiHomeMatchesAll: HomeGateSettlementItem[] = [];
    let seasonEndedDuringSkip = false;

    // Auto-simulate any cup/European rounds where user does not participate or was eliminated
    while (nextIdx < SEASON_CALENDAR.length) {
      const candidateStep = SEASON_CALENDAR[nextIdx];
      if (candidateStep.leagueRound) {
        nextLeagueRound = candidateStep.leagueRound;
        break;
      }

      if (
        candidateStep.competition === 'SUPER_MUNDIAL' &&
        !nextSuperMundial.isActiveThisSeason
      ) {
        if (nextIdx >= SEASON_CALENDAR.length - 1) {
          seasonEndedDuringSkip = true;
          break;
        }
        nextIdx += 1;
        continue;
      }

      if (
        candidateStep.competition === 'MUNDIAL' &&
        !nextMundial.isSeeded
      ) {
        nextMundial = seedMundialBracket(
          nextMundial,
          nextUcl.championClubId,
          nextLib.championClubId,
          clubs,
          userClubId
        );
      }

      const candidateUserFix = findUserFixtureForStep(
        candidateStep,
        userClubId,
        fixtures,
        nextCdb,
        nextLib,
        nextMundial,
        nextSuperMundial,
        nextUcl
      );
      if (candidateUserFix) {
        break;
      }

      const skippedStepAiHomeMatches: HomeGateSettlementItem[] = [];
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
        const cdbFixes = nextCdb.fixturesByStage[candidateStep.copaStage] || [];
        nextAiSquads = attributeAiRoundPlayerStats(
          nextAiSquads,
          cdbFixes,
          userClubId
        );
        for (const fx of cdbFixes) {
          skippedStepAiHomeMatches.push({
            clubId: fx.homeClubId,
            rank: 6,
            competition: 'COPA_DO_BRASIL',
            stageLabel: candidateStep.copaStage,
          });
        }
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
          const libFixes = nextLib.groups.flatMap((g) =>
            g.fixtures.filter(
              (f) => f.roundNumber === candidateStep.libGroupRound
            )
          );
          nextAiSquads = attributeAiRoundPlayerStats(
            nextAiSquads,
            libFixes,
            userClubId
          );
          for (const fx of libFixes) {
            skippedStepAiHomeMatches.push({
              clubId: fx.homeClubId,
              rank: 4,
              competition: 'LIBERTADORES',
              stageLabel: 'Grupos',
            });
          }
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
          const libKoFixes =
            nextLib.knockoutFixtures[candidateStep.libStage] || [];
          nextAiSquads = attributeAiRoundPlayerStats(
            nextAiSquads,
            libKoFixes,
            userClubId
          );
          for (const fx of libKoFixes) {
            skippedStepAiHomeMatches.push({
              clubId: fx.homeClubId,
              rank: 4,
              competition: 'LIBERTADORES',
              stageLabel: candidateStep.libStage,
            });
          }
        }
      } else if (
        candidateStep.competition === 'CHAMPIONS_LEAGUE' &&
        candidateStep.uclStage
      ) {
        nextUcl = advanceChampionsLeagueStage(
          nextUcl,
          candidateStep.uclStage,
          clubs,
          Math.random,
          null,
          isEuropeanPlayableDivision(userPlayableDivision) ? userClubId : undefined
        );
        const uclFixes = nextUcl.fixturesByStage[candidateStep.uclStage] || [];
        nextAiSquads = attributeAiRoundPlayerStats(
          nextAiSquads,
          uclFixes,
          userClubId
        );
        for (const fx of uclFixes) {
          skippedStepAiHomeMatches.push({
            clubId: fx.homeClubId,
            rank: 3,
            competition: 'CHAMPIONS_LEAGUE',
            stageLabel: candidateStep.uclStage,
          });
        }
        if (
          candidateStep.uclStage === 'Final' &&
          nextUcl.championClubId
        ) {
          nextSuperMundial = syncSuperMundialWithChampionsResults(
            nextSuperMundial,
            nextUcl,
            clubs,
            userClubId
          );
          const uclChamp = clubs.find((c) => c.id === nextUcl.championClubId);
          extraInboxMessages.push({
            id: `msg-ucl-champ-${currentYear}-${Date.now()}`,
            date: formatCalendarDate(
              candidateStep.dayOffset ?? dayOffset,
              currentYear
            ),
            sender: 'Central UEFA',
            senderRole: 'Competição Europeia',
            subject: `${uclChamp?.shortName || 'Campeão'} vence a Champions League ${currentYear}!`,
            category: 'Imprensa',
            priority: 'normal',
            read: false,
            body: [
              `${uclChamp?.name || 'O campeão europeu'} conquistou a UEFA Champions League ${currentYear} e garantiu vaga oficial no Mundial de Clubes de dezembro e no ciclo do Super Mundial.`,
            ],
            actionLabel: 'Ver Champions',
            actionTargetTab: 'competitions',
          });
        }
      } else if (
        candidateStep.competition === 'MUNDIAL' &&
        candidateStep.mundialStage
      ) {
        nextMundial = advanceMundialStage(
          nextMundial,
          candidateStep.mundialStage,
          null,
          clubs,
          userClubId
        );
        const munFixes =
          nextMundial.fixturesByStage[candidateStep.mundialStage] || [];
        nextAiSquads = attributeAiRoundPlayerStats(
          nextAiSquads,
          munFixes,
          userClubId
        );
        for (const fx of munFixes) {
          skippedStepAiHomeMatches.push({
            clubId: fx.homeClubId,
            rank: 2,
            competition: 'MUNDIAL',
            stageLabel: candidateStep.mundialStage,
          });
        }
      } else if (
        candidateStep.competition === 'SUPER_MUNDIAL' &&
        nextSuperMundial.isActiveThisSeason
      ) {
        if (
          candidateStep.superMundialStage === 'Grupos' &&
          candidateStep.superMundialGroupRound
        ) {
          nextSuperMundial = advanceSuperMundialGroupRound(
            nextSuperMundial,
            candidateStep.superMundialGroupRound,
            null,
            clubs,
            userClubId
          );
          const smFixes = nextSuperMundial.groups.flatMap((g) =>
            g.fixtures.filter(
              (f) => f.roundNumber === candidateStep.superMundialGroupRound
            )
          );
          nextAiSquads = attributeAiRoundPlayerStats(
            nextAiSquads,
            smFixes,
            userClubId
          );
          for (const fx of smFixes) {
            skippedStepAiHomeMatches.push({
              clubId: fx.homeClubId,
              rank: 3,
              competition: 'SUPER_MUNDIAL',
              stageLabel: 'Grupos',
            });
          }
        } else if (
          candidateStep.superMundialStage &&
          candidateStep.superMundialStage !== 'Grupos'
        ) {
          nextSuperMundial = advanceSuperMundialKnockoutStage(
            nextSuperMundial,
            candidateStep.superMundialStage,
            null,
            clubs,
            userClubId
          );
          const smKoFixes =
            nextSuperMundial.knockoutFixtures[candidateStep.superMundialStage] || [];
          nextAiSquads = attributeAiRoundPlayerStats(
            nextAiSquads,
            smKoFixes,
            userClubId
          );
          for (const fx of smKoFixes) {
            skippedStepAiHomeMatches.push({
              clubId: fx.homeClubId,
              rank: 2,
              competition: 'SUPER_MUNDIAL',
              stageLabel: candidateStep.superMundialStage,
            });
          }
        }
      }

      if (skippedStepAiHomeMatches.length > 0) {
        skippedAiHomeMatchesAll.push(...skippedStepAiHomeMatches);
      }

      if (nextIdx >= SEASON_CALENDAR.length - 1) {
        seasonEndedDuringSkip = true;
        break;
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
        nextLib,
        nextMundial,
        nextSuperMundial,
        nextUcl
      ) ||
      fixtures.find(
        (f) => f.roundNumber === nextLeagueRound && f.isUserMatch
      ) ||
      fixtures[0];

    const nextHome =
      clubs.find((c) => c.id === nextFixture.homeClubId) || clubs[0];
    const nextAway =
      clubs.find((c) => c.id === nextFixture.awayClubId) || clubs[1];

    const nextDayOffset = Math.max(
      dayOffset + 1,
      (targetStep.dayOffset ?? dayOffset + 4) - 1
    );
    const daysElapsed = Math.max(1, nextDayOffset - dayOffset);

    // Recover squad condition & advance injury rehabilitation for exact days elapsed
    const recoveryResult = advanceSquadRecoveryByDays(
      squad,
      daysElapsed,
      formatCalendarDate(nextDayOffset, currentYear)
    );
    const recoveredSquad = recoveryResult.updatedSquad;
    if (recoveryResult.clearanceMessages.length > 0) {
      extraInboxMessages.unshift(...recoveryResult.clearanceMessages);
    }

    // Check monthly sponsorship payout (-30% operational cost) & youth academy deduction if month advanced
    const prevMonth = dayOffsetToDate(dayOffset, currentYear).getMonth();
    const newMonth = dayOffsetToDate(nextDayOffset, currentYear).getMonth();
    let updatedClubs = applyAiHomeGateRevenues({
      clubs,
      userClubId,
      homeMatches: skippedAiHomeMatchesAll,
    }).updatedClubs;
    let updatedLedger = financeLedger;
    let updatedYouthAcademy = youthAcademy;
    if (newMonth > prevMonth) {
      const monthsElapsed = Math.max(1, newMonth - prevMonth);
      const installment =
        financeLedger.sponsorshipContract.monthlyInstallment * monthsElapsed;
      const sponsorOperationalCost = calculateOperationalCost(installment);
      const monthlyPayrollSpend =
        getEffectivePayroll(recoveredSquad, loanedOutPlayers) * monthsElapsed;
      const youthMonthlySpend = youthAcademy.monthlyCost * monthsElapsed;
      updatedClubs = updatedClubs.map((c) => {
        if (c.id !== userClubId) return c;
        const nextCash =
          c.cashBalance +
          installment -
          sponsorOperationalCost -
          monthlyPayrollSpend -
          youthMonthlySpend;
        const debtConfidencePenalty = nextCash < 0 ? 2 : 0;
        return {
          ...c,
          cashBalance: nextCash,
          boardConfidence: Math.max(
            20,
            c.boardConfidence - debtConfidencePenalty
          ),
        };
      });
      updatedClubs = applyAiMonthlyEconomyTick({
        clubs: updatedClubs,
        aiSquads: nextAiSquads,
        userClubId,
        monthsElapsed,
        seasonYear: currentYear,
      }).updatedClubs;
      updatedLedger = {
        ...financeLedger,
        seasonSponsorshipRevenue:
          financeLedger.seasonSponsorshipRevenue + installment,
        seasonOperationalExpense:
          financeLedger.seasonOperationalExpense + sponsorOperationalCost,
        seasonPayrollExpense:
          (financeLedger.seasonPayrollExpense || 0) + monthlyPayrollSpend,
        seasonYouthAcademySpend:
          (financeLedger.seasonYouthAcademySpend || 0) + youthMonthlySpend,
      };
      updatedYouthAcademy = {
        ...youthAcademy,
        accumulatedSeasonInvestment:
          youthAcademy.accumulatedSeasonInvestment + youthMonthlySpend,
        monthsInvestedThisSeason: Math.min(
          12,
          youthAcademy.monthsInvestedThisSeason + monthsElapsed
        ),
      };
    }

    let finalSquad = recoveredSquad;
    let finalClubs = updatedClubs;
    let finalAiSquads = nextAiSquads;
    let nextMessagesList =
      extraInboxMessages.length > 0
        ? [...extraInboxMessages, ...messages].slice(0, 80)
        : messages;
    let newMidSeasonProcessedYear = midSeasonEvolutionProcessedYear;

    if (nextDayOffset >= 154 && midSeasonEvolutionProcessedYear !== currentYear) {
      const midRes = processMidSeasonEvolution({
        clubs: finalClubs,
        userClubId,
        userSquad: finalSquad,
        aiSquads: finalAiSquads,
        loanedOutPlayers,
        currentYear,
      });
      finalClubs = midRes.updatedClubs;
      finalSquad = midRes.updatedUserSquad;
      finalAiSquads = midRes.updatedAiSquads;
      const evolvedUserClub =
        finalClubs.find((c) => c.id === userClubId) || userClub;
      updatedYouthAcademy = evolveYouthAcademyRoster({
        academy: updatedYouthAcademy,
        clubReputation: evolvedUserClub.reputation,
        division: evolvedUserClub.division === 'B' ? 'B' : 'A',
        phase: 'MID_SEASON',
      }).updatedAcademy;
      newMidSeasonProcessedYear = currentYear;
      setMidSeasonEvolutionProcessedYear(currentYear);
      nextMessagesList = [midRes.inboxMessage, ...nextMessagesList];
    }

    if (nextMessagesList !== messages) {
      setMessages(nextMessagesList);
    }

    const nextMatch = createInitialMatchState(
      nextLeagueRound,
      nextFixture,
      nextHome,
      nextAway,
      finalSquad,
      userClubId,
      transferredOutClubPlayerIds,
      finalAiSquads
    );

    const nextPendingOffers = isTransferWindowOpen(nextDayOffset)
      ? pendingOffers
      : pendingOffers.map((o) =>
          o.status === 'PENDING' ? { ...o, status: 'EXPIRED' as const } : o
        );

    const endReportIfFinished = seasonEndedDuringSkip
      ? buildSeasonEndSummary({
          seasonYear: currentYear,
          clubs: finalClubs,
          userClubId,
          userSquad: finalSquad,
          aiSquads: finalAiSquads,
          standings,
          secondaryStandings,
          copaDoBrasil: nextCdb,
          libertadores: nextLib,
          championsLeague: nextUcl,
          mundial: nextMundial,
          superMundial: nextSuperMundial,
        })
      : null;

    setClubs(finalClubs);
    setFinanceLedger(updatedLedger);
    setYouthAcademy(updatedYouthAcademy);
    setSquad(finalSquad);
    setAiSquads(finalAiSquads);
    setCopaDoBrasil(nextCdb);
    setLibertadores(nextLib);
    setChampionsLeague(nextUcl);
    setMundial(nextMundial);
    setSuperMundial(nextSuperMundial);
    setPendingOffers(nextPendingOffers);
    setSeasonStepIndex(nextIdx);
    setCurrentRound(nextLeagueRound);
    setDayOffset(nextDayOffset);
    setIsMatchDay(false);
    setMatchState(nextMatch);
    if (endReportIfFinished) {
      setSeasonEndReport(endReportIfFinished);
      setIsSeasonEndModalOpen(true);
    }
    setActiveTab('competitions');

    persistCareer({
      clubs: finalClubs,
      financeLedger: updatedLedger,
      youthAcademy: updatedYouthAcademy,
      squad: finalSquad,
      aiSquads: finalAiSquads,
      copaDoBrasil: nextCdb,
      libertadores: nextLib,
      championsLeague: nextUcl,
      mundial: nextMundial,
      superMundial: nextSuperMundial,
      pendingOffers: nextPendingOffers,
      messages: nextMessagesList,
      seasonStepIndex: nextIdx,
      activeCompetition: targetStep.competition,
      currentRound: nextLeagueRound,
      dayOffset: nextDayOffset,
      isMatchDay: false,
      matchState: nextMatch,
      midSeasonEvolutionProcessedYear: newMidSeasonProcessedYear,
      ...(endReportIfFinished ? { seasonEndReport: endReportIfFinished } : {}),
    });
  };

  const commitAcceptedIncomingTransfer = (params: {
    listing: MarketPlayerListing;
    dealMode: TransferDealMode;
    offerTier: TransferOfferTier;
    salaryOfferMult: number;
    loanWageShare: LoanWageShare;
    loanDurationYears?: 1 | 2;
    contractYears?: 2 | 3 | 4;
    feePaid: number;
    monthlySalary: number;
    evaluation: ReturnType<typeof evaluateTransferNegotiation>;
    updatedClub: Club;
    updatedSquad: Player[];
    updatedFreeAgents: Player[];
    updatedTransferredOutIds: string[];
    signedPlayer: Player;
    headline?: string;
    summary?: string;
    factors?: string[];
  }) => {
    const {
      listing,
      dealMode,
      offerTier,
      salaryOfferMult,
      loanWageShare,
      loanDurationYears = 1,
      contractYears = 3,
      feePaid,
      monthlySalary,
      evaluation,
      updatedClub,
      updatedSquad,
      updatedFreeAgents,
      updatedTransferredOutIds,
      signedPlayer,
      headline,
      summary,
      factors,
    } = params;

    const dateLabel = formatCalendarDate(dayOffset, currentYear);
    const counterpartyName = listing.originClub?.shortName || 'Passe Livre';
    const recordType: TransferRecord['type'] =
      dealMode === 'FREE'
        ? 'LIVRE'
        : dealMode === 'LOAN'
        ? 'EMPRESTIMO_IN'
        : 'COMPRA';

    const updatedClubs = clubs.map((c) => {
      if (c.id === userClubId) return updatedClub;
      if (
        dealMode !== 'FREE' &&
        listing.originClub &&
        c.id === listing.originClub.id
      ) {
        return { ...c, cashBalance: c.cashBalance + feePaid };
      }
      return c;
    });

    const nextAiSquads = { ...aiSquads };
    if (listing.originClub && nextAiSquads[listing.originClub.id]) {
      nextAiSquads[listing.originClub.id] = nextAiSquads[
        listing.originClub.id
      ].filter((p) => p.id !== listing.player.id);
    }

    const nextFinanceLedger: ClubFinanceLedger = {
      ...financeLedger,
      seasonTransferSpend: financeLedger.seasonTransferSpend + feePaid,
    };

    const durationYears = dealMode === 'LOAN' ? loanDurationYears : contractYears;
    const endYear = signedPlayer.contractEndYear ?? currentYear + durationYears - 1;

    const acceptedRec: TransferRecord = {
      id: `tr-acc-${Date.now()}`,
      date: dateLabel,
      type: recordType,
      status: 'CONCLUIDA',
      playerName: signedPlayer.name,
      position: signedPlayer.position,
      ovr: listing.ovr,
      counterpartyClubName: counterpartyName,
      fromClubName: counterpartyName,
      toClubName: userClub.shortName,
      feeAmount: feePaid,
      monthlySalaryImpact: monthlySalary,
      durationYears,
      note:
        dealMode === 'LOAN'
          ? `Empréstimo de ${loanDurationYears} ${loanDurationYears === 1 ? 'temporada' : 'temporadas'} (até ${endYear}, ${Math.round(loanWageShare * 100)}% salário).`
          : dealMode === 'FREE'
          ? `Contrato sem custo de ${contractYears} anos (até ${endYear}).`
          : `Compra definitiva · contrato de ${contractYears} anos (até ${endYear}).`,
    };

    const nextHistory = [acceptedRec, ...transferHistory];
    const transferMsg: InboxMessage = {
      id: `msg-tr-${Date.now()}`,
      date: `${dateLabel} · 14:30`,
      sender: 'Departamento de Futebol',
      senderRole: 'Mercado & Contratações',
      subject: `Reforço Oficializado: ${signedPlayer.name} (${signedPlayer.position} · OVR ${listing.ovr})`,
      category: 'Mercado',
      priority: 'positive',
      read: false,
      relatedPlayerId: signedPlayer.id,
      body: [
        `${signedPlayer.name} fechou com o ${userClub.shortName} (${acceptedRec.note}) vindo de ${counterpartyName}.`,
        `Investimento imediato: ${
          feePaid === 0
            ? `${formatCompactBRL(0)} (Passe Livre)`
            : formatCompactBRL(feePaid)
        } · Folha adicional: +${formatCompactBRL(monthlySalary)}/mês.`,
      ],
      actionLabel: 'Ver Elenco',
      actionTargetTab: 'squad',
    };
    const nextMessages = [transferMsg, ...messages];

    let nextMatchState = matchState;
    if (matchState.phase === 'PRE_MATCH') {
      const { homeTokens, awayTokens } = buildPitchTokens(
        homeClub,
        awayClub,
        updatedSquad,
        matchState.isUserHome,
        updatedTransferredOutIds,
        nextAiSquads
      );
      nextMatchState = { ...matchState, homeTokens, awayTokens };
      setMatchState(nextMatchState);
    }

    setClubs(updatedClubs);
    setSquad(updatedSquad);
    setAiSquads(nextAiSquads);
    setFinanceLedger(nextFinanceLedger);
    setFreeAgents(updatedFreeAgents);
    setTransferredOutClubPlayerIds(updatedTransferredOutIds);
    setTransferHistory(nextHistory);
    setMessages(nextMessages);
    const successHeadline =
      headline ||
      (dealMode === 'LOAN'
        ? `Empréstimo fechado! ${signedPlayer.name} no ${userClub.shortName}`
        : `${signedPlayer.name} contratado com sucesso!`);
    setMarketFeedback({
      type: 'success',
      title: successHeadline,
      detail: `${acceptedRec.note} Já integrado ao elenco com camisa #${signedPlayer.number}.`,
    });
    showActionToast(`✓ ${successHeadline}`, 'emerald');
    setTransferAttemptResult({
      id: `attempt-${Date.now()}`,
      listing,
      dealMode,
      offerTier,
      salaryOfferMult,
      loanWageShare,
      contractYears,
      loanDurationYears,
      outcome: 'ACEITA',
      headline:
        headline || `${signedPlayer.name} acertou com o ${userClub.shortName}!`,
      summary:
        summary ||
        `${acceptedRec.note} Já integrado ao elenco com a camisa #${signedPlayer.number}.`,
      factors: factors || [
        `Atleta: ${listing.player.age} anos · OVR ${listing.ovr} (${listing.player.position})`,
        evaluation.playerAmbitionNote,
      ],
      offeredFee: feePaid,
      offeredSalary: monthlySalary,
      evaluation,
      signedPlayer,
    });

    const clearedNeg = recordTransferNegotiationAttempt({
      states: negotiationStates,
      player: listing.player,
      listing,
      outcome: 'ACEITA',
      seasonYear: currentYear,
      dayOffset,
    });
    setNegotiationStates(clearedNeg.nextStates);

    persistCareer({
      clubs: updatedClubs,
      squad: updatedSquad,
      aiSquads: nextAiSquads,
      financeLedger: nextFinanceLedger,
      freeAgents: updatedFreeAgents,
      transferredOutClubPlayerIds: updatedTransferredOutIds,
      transferHistory: nextHistory,
      messages: nextMessages,
      matchState: nextMatchState,
      negotiationStates: clearedNeg.nextStates,
    });
  };

  const handleProposeTransfer = (params: {
    listing: MarketPlayerListing;
    dealMode: TransferDealMode;
    offerTier: TransferOfferTier;
    offerMultiplier?: number;
    salaryOfferMult?: number;
    loanWageShare: LoanWageShare;
    loanDurationYears?: 1 | 2;
    contractYears?: 2 | 3 | 4;
  }) => {
    if (!isTransferWindowOpen(dayOffset)) {
      const windowStatus = getTransferWindowStatus(dayOffset, currentYear);
      setMarketFeedback({
        type: 'error',
        title: 'Janela de Transferências Fechada',
        detail: windowStatus.description,
      });
      showActionToast('✕ Janela de Transferências Fechada', 'rose');
      return;
    }
    const {
      listing,
      dealMode,
      offerTier,
      offerMultiplier,
      salaryOfferMult = 1.0,
      loanWageShare,
      loanDurationYears = 1,
      contractYears = 3,
    } = params;

    const blockInfo = getPlayerNegotiationBlockInfo(
      negotiationStates[listing.player.id],
      currentYear,
      dayOffset
    );
    if (blockInfo.isBlocked) {
      const untilLabel = blockInfo.blockedUntilDateLabel || 'o próximo ano';
      setMarketFeedback({
        type: 'error',
        title: `${listing.player.name} não aceita novas negociações`,
        detail: `O atleta encerrou as conversas com o ${userClub.shortName}. Nova tentativa liberada em ${untilLabel} (${blockInfo.remainingDays} dias restantes).`,
      });
      showActionToast(
        `✕ ${listing.player.name} bloqueado até ${untilLabel}`,
        'rose'
      );
      return;
    }

    const evaluation = evaluateTransferNegotiation({
      userClub,
      userSquad: squad,
      loanedOutPlayers,
      listing,
      dealMode,
      offerTier,
      offerMultiplier,
      salaryOfferMult,
      loanWageShare,
      loanDurationYears,
      contractYears,
    });

    if (evaluation.isBlocked) {
      setMarketFeedback({
        type: 'error',
        title: 'Operação bloqueada pelos limites financeiros',
        detail: evaluation.blockReason || 'Saldo ou folha insuficiente.',
      });
      showActionToast(
        `✕ Operação bloqueada pelo orçamento (${listing.player.name})`,
        'rose'
      );
      setTransferAttemptResult({
        id: `attempt-${Date.now()}`,
        listing,
        dealMode,
        offerTier,
        offerMultiplier,
        salaryOfferMult,
        loanWageShare,
        contractYears,
        loanDurationYears,
        outcome: 'RECUSADA',
        rejectedBy: 'ORCAMENTO',
        headline: 'Operação bloqueada pelo orçamento',
        summary: evaluation.blockReason || 'Saldo ou folha insuficiente.',
        factors: [evaluation.playerAmbitionNote, evaluation.moneyInfluenceNote],
        offeredFee: evaluation.effectiveFee,
        offeredSalary: evaluation.effectiveSalary,
        evaluation,
      });
      return;
    }

    const result = executeIncomingTransfer({
      userClub,
      userSquad: squad,
      freeAgents,
      transferredOutClubPlayerIds,
      listing,
      dealMode,
      evaluation,
      loanWageShare,
      loanDurationYears,
      contractYears,
      seasonYear: currentYear,
    });

    const dateLabel = formatCalendarDate(dayOffset, currentYear);
    const counterpartyName = listing.originClub?.shortName || 'Passe Livre';
    const recordType: TransferRecord['type'] =
      dealMode === 'FREE'
        ? 'LIVRE'
        : dealMode === 'LOAN'
        ? 'EMPRESTIMO_IN'
        : 'COMPRA';

    if (result.outcome === 'CONTRAPROPOSTA' && result.counterOffer) {
      const negUpdate = recordTransferNegotiationAttempt({
        states: negotiationStates,
        player: listing.player,
        listing,
        outcome: 'CONTRAPROPOSTA',
        seasonYear: currentYear,
        dayOffset,
      });
      setNegotiationStates(negUpdate.nextStates);

      const counterNote = negUpdate.justBlocked
        ? `${result.counterOffer.summary} Última chance: se não aceitar agora, o atleta encerrará negociações por 1 ano (até ${negUpdate.blockedUntilDateLabel}).`
        : result.counterOffer.summary;

      const counterRec: TransferRecord = {
        id: `tr-cnt-${Date.now()}`,
        date: dateLabel,
        type: recordType,
        status: 'CONTRAPROPOSTA',
        playerName: listing.player.name,
        position: listing.player.position,
        ovr: listing.ovr,
        counterpartyClubName: counterpartyName,
        feeAmount: result.counterOffer.counterFee,
        monthlySalaryImpact: result.counterOffer.counterSalary,
        note: counterNote,
      };
      const nextHistory = [counterRec, ...transferHistory];
      setTransferHistory(nextHistory);
      setMarketFeedback({
        type: 'counter',
        title: negUpdate.justBlocked
          ? `Última contraproposta por ${listing.player.name}`
          : result.headline,
        detail: `${counterNote} Pedida: ${formatCompactBRL(result.counterOffer.counterFee)} + ${formatCompactBRL(result.counterOffer.counterSalary)}/mês.`,
      });
      showActionToast(
        negUpdate.justBlocked
          ? `⇄ Última chance: contraproposta de ${listing.player.name}`
          : `⇄ ${result.headline}`,
        'amber'
      );
      setTransferAttemptResult({
        id: `attempt-${Date.now()}`,
        listing,
        dealMode,
        offerTier,
        offerMultiplier,
        salaryOfferMult,
        loanWageShare,
        contractYears,
        loanDurationYears,
        outcome: 'CONTRAPROPOSTA',
        headline: negUpdate.justBlocked
          ? `Última contraproposta por ${listing.player.name}`
          : result.headline,
        summary: negUpdate.justBlocked
          ? `${result.summary} Esta é a oferta final: novas propostas serão bloqueadas por 1 ano (até ${negUpdate.blockedUntilDateLabel}).`
          : result.summary,
        factors: negUpdate.justBlocked
          ? [
              ...result.factors,
              `Limite de paciência atingido (${negUpdate.playerState?.attemptsCount} propostas) — novas negociações bloqueadas até ${negUpdate.blockedUntilDateLabel}.`,
            ]
          : result.factors,
        offeredFee: evaluation.effectiveFee,
        offeredSalary: evaluation.effectiveSalary,
        evaluation,
        counterOffer: result.counterOffer,
        negotiationBlockedUntilLabel: negUpdate.blockedUntilDateLabel,
        negotiationAttemptsCount: negUpdate.playerState?.attemptsCount,
        negotiationMaxAttempts: negUpdate.playerState?.maxAttempts,
      });
      persistCareer({
        transferHistory: nextHistory,
        negotiationStates: negUpdate.nextStates,
      });
      return;
    }

    if (!result.accepted || !result.signedPlayer) {
      const negUpdate = recordTransferNegotiationAttempt({
        states: negotiationStates,
        player: listing.player,
        listing,
        outcome: 'RECUSADA',
        seasonYear: currentYear,
        dayOffset,
      });
      setNegotiationStates(negUpdate.nextStates);

      const finalHeadline = negUpdate.justBlocked
        ? `${listing.player.name} encerrou as negociações por 1 ano`
        : result.headline;
      const finalSummary = negUpdate.justBlocked
        ? `${result.summary} Sem acordo após ${negUpdate.playerState?.attemptsCount} propostas, o estafe de ${listing.player.name} não aceita novas negociações com o ${userClub.shortName} até ${negUpdate.blockedUntilDateLabel}.`
        : result.summary;
      const finalFactors = negUpdate.justBlocked
        ? [
            ...result.factors,
            `Bloqueio de 1 ano ativado: novas propostas liberadas somente em ${negUpdate.blockedUntilDateLabel}.`,
          ]
        : result.factors;

      const rejectedRec: TransferRecord = {
        id: `tr-rej-${Date.now()}`,
        date: dateLabel,
        type: recordType,
        status: 'RECUSADA',
        playerName: listing.player.name,
        position: listing.player.position,
        ovr: listing.ovr,
        counterpartyClubName: counterpartyName,
        feeAmount: evaluation.effectiveFee,
        monthlySalaryImpact: evaluation.effectiveSalary,
        note: `${result.rejectedBy === 'JOGADOR' ? 'Recusa do atleta' : 'Recusa do clube'} · ${finalSummary}`,
      };
      const nextHistory = [rejectedRec, ...transferHistory];
      setTransferHistory(nextHistory);
      setMarketFeedback({
        type: 'rejected',
        title: finalHeadline,
        detail: finalSummary,
      });
      showActionToast(`✕ ${finalHeadline}`, 'rose');
      setTransferAttemptResult({
        id: `attempt-${Date.now()}`,
        listing,
        dealMode,
        offerTier,
        offerMultiplier,
        salaryOfferMult,
        loanWageShare,
        contractYears,
        loanDurationYears,
        outcome: 'RECUSADA',
        rejectedBy: result.rejectedBy,
        headline: finalHeadline,
        summary: finalSummary,
        factors: finalFactors,
        offeredFee: evaluation.effectiveFee,
        offeredSalary: evaluation.effectiveSalary,
        evaluation,
        negotiationBlockedUntilLabel: negUpdate.blockedUntilDateLabel,
        negotiationAttemptsCount: negUpdate.playerState?.attemptsCount,
        negotiationMaxAttempts: negUpdate.playerState?.maxAttempts,
      });
      persistCareer({
        transferHistory: nextHistory,
        negotiationStates: negUpdate.nextStates,
      });
      return;
    }

    commitAcceptedIncomingTransfer({
      listing,
      dealMode,
      offerTier,
      salaryOfferMult,
      loanWageShare,
      loanDurationYears,
      contractYears,
      feePaid: evaluation.effectiveFee,
      monthlySalary: evaluation.effectiveSalary,
      evaluation,
      updatedClub: result.updatedClub,
      updatedSquad: result.updatedSquad,
      updatedFreeAgents: result.updatedFreeAgents,
      updatedTransferredOutIds: result.updatedTransferredOutIds,
      signedPlayer: result.signedPlayer,
      headline: result.headline,
      summary: result.summary,
      factors: result.factors,
    });
  };

  const handleAcceptCounterOffer = (attempt: TransferAttemptResult) => {
    if (!attempt.counterOffer) return;
    if (!isTransferWindowOpen(dayOffset)) {
      const windowStatus = getTransferWindowStatus(dayOffset, currentYear);
      setMarketFeedback({
        type: 'error',
        title: 'Janela de Transferências Fechada',
        detail: windowStatus.description,
      });
      showActionToast('✕ Janela de Transferências Fechada', 'rose');
      return;
    }

    const res = acceptTransferCounterOffer({
      userClub,
      userSquad: squad,
      loanedOutPlayers,
      freeAgents,
      transferredOutClubPlayerIds,
      listing: attempt.listing,
      dealMode: attempt.dealMode,
      counterOffer: attempt.counterOffer,
      loanWageShare: attempt.loanWageShare,
      loanDurationYears: attempt.loanDurationYears ?? 1,
      contractYears: attempt.contractYears ?? 3,
      seasonYear: currentYear,
    });

    if (!res.accepted || !res.signedPlayer) {
      setMarketFeedback({
        type: 'error',
        title: 'Contraproposta acima do orçamento atual',
        detail:
          res.blockReason ||
          'Saldo em caixa ou folha salarial insuficiente para aceitar a contraproposta.',
      });
      showActionToast('✕ Contraproposta acima do orçamento atual', 'rose');
      return;
    }

    const effectiveShare =
      attempt.counterOffer.counterLoanWageShare ?? attempt.loanWageShare;

    commitAcceptedIncomingTransfer({
      listing: attempt.listing,
      dealMode: attempt.dealMode,
      offerTier: attempt.offerTier,
      salaryOfferMult: attempt.salaryOfferMult,
      loanWageShare: effectiveShare,
      loanDurationYears: attempt.loanDurationYears ?? 1,
      contractYears: attempt.contractYears ?? 3,
      feePaid: attempt.counterOffer.counterFee,
      monthlySalary: attempt.counterOffer.counterSalary,
      evaluation: attempt.evaluation,
      updatedClub: res.updatedClub,
      updatedSquad: res.updatedSquad,
      updatedFreeAgents: res.updatedFreeAgents,
      updatedTransferredOutIds: res.updatedTransferredOutIds,
      signedPlayer: res.signedPlayer,
      headline: `Contraproposta aceita! ${res.signedPlayer.name} contratado`,
      summary: `Você aceitou os termos finais (${formatCompactBRL(attempt.counterOffer.counterFee)} + ${formatCompactBRL(attempt.counterOffer.counterSalary)}/mês) e fechou com ${res.signedPlayer.name}.`,
      factors: attempt.factors,
    });
  };

  const handleOutgoingTransfer = (params: {
    player: Player;
    action: 'VENDA' | 'EMPRESTIMO_OUT' | 'DEVOLVER_EMPRESTIMO';
  }) => {
    if (!isTransferWindowOpen(dayOffset)) {
      const windowStatus = getTransferWindowStatus(dayOffset, currentYear);
      setMarketFeedback({
        type: 'error',
        title: 'Janela de Transferências Fechada',
        detail: windowStatus.description,
      });
      showActionToast('✕ Janela de Transferências Fechada', 'rose');
      return;
    }
    const { player, action } = params;
    const result = executeOutgoingTransfer({
      userClub,
      userSquad: squad,
      loanedOutPlayers,
      player,
      action,
      destinationClubName:
        action === 'EMPRESTIMO_OUT' ? `Clube Parceiro ${currentYear}` : undefined,
    });

    if (!result.success) {
      setMarketFeedback({
        type: 'error',
        title: 'Não foi possível concluir a saída',
        detail: 'Verifique os limites mínimos do elenco.',
      });
      showActionToast('✕ Limite mínimo do elenco atingido', 'rose');
      return;
    }

    const updatedClubs = clubs.map((c) =>
      c.id === userClubId ? result.updatedClub : c
    );
    const nextFinanceLedger: ClubFinanceLedger = {
      ...financeLedger,
      seasonTransferIncome:
        financeLedger.seasonTransferIncome + result.feeReceived,
    };

    const ovr = calculatePlayerOverall(player.attributes, player.position);
    const dateLabel = formatCalendarDate(dayOffset, currentYear);
    const record: TransferRecord = {
      id: `tr-out-${Date.now()}`,
      date: dateLabel,
      type: action === 'EMPRESTIMO_OUT' ? 'EMPRESTIMO_OUT' : 'VENDA',
      status: 'CONCLUIDA',
      playerName: player.name,
      position: player.position,
      ovr,
      counterpartyClubName:
        action === 'DEVOLVER_EMPRESTIMO'
          ? player.loanOriginClubName || 'Clube de Origem'
          : action === 'EMPRESTIMO_OUT'
          ? `Clube Parceiro ${currentYear}`
          : 'Mercado Nacional/Ext.',
      feeAmount: result.feeReceived,
      monthlySalaryImpact: -result.monthlyWageRelief,
      note:
        action === 'DEVOLVER_EMPRESTIMO'
          ? 'Devolução antecipada de empréstimo.'
          : action === 'EMPRESTIMO_OUT'
          ? 'Emprestado para alívio de 90% da folha.'
          : 'Venda definitiva concluída.',
    };

    const nextHistory = [record, ...transferHistory];
    let nextMatchState = matchState;
    if (matchState.phase === 'PRE_MATCH') {
      const { homeTokens, awayTokens } = buildPitchTokens(
        homeClub,
        awayClub,
        result.updatedSquad,
        matchState.isUserHome,
        transferredOutClubPlayerIds,
        aiSquads
      );
      nextMatchState = { ...matchState, homeTokens, awayTokens };
      setMatchState(nextMatchState);
    }

    setClubs(updatedClubs);
    setFinanceLedger(nextFinanceLedger);
    setSquad(result.updatedSquad);
    setLoanedOutPlayers(result.updatedLoanedOutPlayers);
    setTransferHistory(nextHistory);
    const outgoingTitle =
      action === 'VENDA'
        ? `${player.name} vendido por ${formatCompactBRL(result.feeReceived)}`
        : action === 'EMPRESTIMO_OUT'
        ? `${player.name} emprestado com alívio de ${formatCompactBRL(result.monthlyWageRelief)}/mês`
        : `${player.name} devolvido ao clube de origem`;
    setMarketFeedback({
      type: 'success',
      title: outgoingTitle,
      detail: result.promotedStarterName
        ? `${result.promotedStarterName} assumiu automaticamente a vaga titular.`
        : `Folha mensal reduzida em ${formatCompactBRL(result.monthlyWageRelief)}.`,
    });
    showActionToast(`✓ ${outgoingTitle}`, 'emerald');

    persistCareer({
      clubs: updatedClubs,
      financeLedger: nextFinanceLedger,
      squad: result.updatedSquad,
      loanedOutPlayers: result.updatedLoanedOutPlayers,
      transferHistory: nextHistory,
      matchState: nextMatchState,
    });
  };

  const handleResolveIncomingOffer = (
    offerId: string,
    action: IncomingOfferAction
  ) => {
    if (!isTransferWindowOpen(dayOffset)) {
      const windowStatus = getTransferWindowStatus(dayOffset, currentYear);
      setMarketFeedback({
        type: 'error',
        title: 'Janela de Transferências Fechada',
        detail: windowStatus.description,
      });
      showActionToast('✕ Janela de Transferências Fechada', 'rose');
      return;
    }
    const targetOffer = pendingOffers.find((o) => o.id === offerId);
    if (!targetOffer || targetOffer.status !== 'PENDING') return;

    const res = resolveIncomingOfferAction({
      offer: targetOffer,
      action,
      userClub,
      userSquad: squad,
      aiSquads,
      loanedOutPlayers,
      clubs,
      dayOffset,
      seasonYear: currentYear,
    });

    const updatedPendingOffers = pendingOffers.map((o) =>
      o.id === offerId ? res.updatedOffer : o
    );
    const nextHistory = res.transferRecord
      ? [res.transferRecord, ...transferHistory]
      : transferHistory;
    const nextLedger: ClubFinanceLedger =
      res.outcome === 'ACCEPTED'
        ? {
            ...financeLedger,
            seasonTransferIncome:
              financeLedger.seasonTransferIncome + res.finalFee,
          }
        : financeLedger;

    let nextMatchState = matchState;
    if (res.outcome === 'ACCEPTED' && matchState.phase === 'PRE_MATCH') {
      const { homeTokens, awayTokens } = buildPitchTokens(
        homeClub,
        awayClub,
        res.updatedUserSquad,
        matchState.isUserHome,
        transferredOutClubPlayerIds,
        res.updatedAiSquads
      );
      nextMatchState = { ...matchState, homeTokens, awayTokens };
      setMatchState(nextMatchState);
    }

    setClubs(res.updatedClubs);
    setSquad(res.updatedUserSquad);
    setAiSquads(res.updatedAiSquads);
    setLoanedOutPlayers(res.updatedLoanedOutPlayers);
    setPendingOffers(updatedPendingOffers);
    setTransferHistory(nextHistory);
    setFinanceLedger(nextLedger);

    if (res.outcome === 'ACCEPTED') {
      const title = `Negócio fechado com ${targetOffer.fromClubName}!`;
      setMarketFeedback({
        type: 'success',
        title,
        detail: `${targetOffer.playerName} transferido por ${formatCompactBRL(
          res.finalFee
        )}.${res.promotedStarterName ? ` ${res.promotedStarterName} assumiu a titularidade.` : ''}`,
      });
      showActionToast(
        `✓ ${targetOffer.playerName} negociado com ${targetOffer.fromClubName} (${formatCompactBRL(res.finalFee)})`,
        'emerald'
      );
    } else if (res.outcome === 'COUNTER_REJECTED') {
      setMarketFeedback({
        type: 'rejected',
        title: `${targetOffer.fromClubName} encerrou as conversas`,
        detail: `O clube comprador não aceitou a contraproposta de ${formatCompactBRL(
          res.finalFee
        )}.`,
      });
      showActionToast(
        `✕ ${targetOffer.fromClubName} recusou sua contraproposta`,
        'rose'
      );
    } else {
      setMarketFeedback({
        type: 'rejected',
        title: `Proposta de ${targetOffer.fromClubName} recusada`,
        detail: `${targetOffer.playerName} permanece no elenco do ${userClub.shortName}.`,
      });
      showActionToast(
        `Proposta de ${targetOffer.fromClubName} por ${targetOffer.playerName} recusada`,
        'amber'
      );
    }

    persistCareer({
      clubs: res.updatedClubs,
      squad: res.updatedUserSquad,
      aiSquads: res.updatedAiSquads,
      loanedOutPlayers: res.updatedLoanedOutPlayers,
      pendingOffers: updatedPendingOffers,
      transferHistory: nextHistory,
      financeLedger: nextLedger,
      matchState: nextMatchState,
    });
  };

  const handleToggleWatchPlayer = (listing: MarketPlayerListing) => {
    const exists = watchedPlayers.some((w) => w.playerId === listing.player.id);
    const nextWatched: WatchedPlayerEntry[] = exists
      ? watchedPlayers.filter((w) => w.playerId !== listing.player.id)
      : [
          {
            playerId: listing.player.id,
            playerName: listing.player.name,
            position: listing.player.position,
            addedAtDate: formatCalendarDate(dayOffset, currentYear),
            addedYear: currentYear,
            addedOvr: listing.ovr,
            addedMarketValue: listing.player.marketValue,
            addedSalary: listing.player.salary,
            addedAge: listing.player.age,
            addedClubName: listing.originClub?.shortName || 'Passe Livre',
            addedScope: listing.scope,
          },
          ...watchedPlayers,
        ];
    setWatchedPlayers(nextWatched);
    persistCareer({ watchedPlayers: nextWatched });
    showActionToast(
      exists
        ? `${listing.player.name} removido da lista de observação`
        : `✓ ${listing.player.name} adicionado aos Observados`,
      exists ? 'amber' : 'cyan'
    );
  };

  const handleRemoveWatchedPlayer = (playerId: string) => {
    const target = watchedPlayers.find((w) => w.playerId === playerId);
    const nextWatched = watchedPlayers.filter((w) => w.playerId !== playerId);
    setWatchedPlayers(nextWatched);
    persistCareer({ watchedPlayers: nextWatched });
    if (target) {
      showActionToast(`${target.playerName} removido dos Observados`, 'amber');
    }
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

    if (isSeasonFinished) {
      handleOpenSeasonEndModal();
      return;
    }

    if (!isMatchDay) {
      const nextDay = dayOffset + 1;
      const recovery = advanceSquadRecoveryByDays(
        squad,
        1,
        formatCalendarDate(nextDay, currentYear)
      );
      setDayOffset(nextDay);
      setIsMatchDay(true);
      setSquad(recovery.updatedSquad);
      if (recovery.clearanceMessages.length > 0) {
        setMessages((prev) =>
          [...recovery.clearanceMessages, ...prev].slice(0, 80)
        );
        showActionToast(
          `✓ Alta médica: ${recovery.recoveredPlayers.map((p) => p.name).join(', ')}`,
          'emerald'
        );
      }
      setHasUnsavedChanges(true);
      return;
    }

    setActiveTab('match');
  };

  const inspectedSquadPlayer = useMemo(
    () => squad.find((p) => p.id === inspectedPlayerId) || null,
    [squad, inspectedPlayerId]
  );
  const inspectedPlayer = inspectedExternalPlayer || inspectedSquadPlayer;

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
    if (
      currentCalendarStep.competition === 'MUNDIAL' &&
      currentCalendarStep.mundialStage
    ) {
      return mundial.fixturesByStage[currentCalendarStep.mundialStage] || [];
    }
    if (
      currentCalendarStep.competition === 'SUPER_MUNDIAL' &&
      superMundial.isActiveThisSeason
    ) {
      if (
        currentCalendarStep.superMundialStage === 'Grupos' &&
        currentCalendarStep.superMundialGroupRound
      ) {
        const grpRound = currentCalendarStep.superMundialGroupRound;
        const all = superMundial.groups.flatMap((g) =>
          g.fixtures.filter((f) => f.roundNumber === grpRound)
        );
        return all.sort((a, b) => Number(b.isUserMatch) - Number(a.isUserMatch));
      }
      if (
        currentCalendarStep.superMundialStage &&
        currentCalendarStep.superMundialStage !== 'Grupos'
      ) {
        return (
          superMundial.knockoutFixtures[currentCalendarStep.superMundialStage] ||
          []
        );
      }
    }
    return fixtures.filter((f) => f.roundNumber === matchState.roundNumber);
  }, [
    currentCalendarStep,
    copaDoBrasil,
    libertadores,
    mundial,
    superMundial,
    fixtures,
    matchState.roundNumber,
  ]);

  const globalOverlayNodes = (
    <>
      <OfflineIndicator />
      {actionToast && (
        <div
          data-testid="global-action-toast"
          role="status"
          aria-live="polite"
          className="fixed top-14 left-1/2 -translate-x-1/2 z-[85] max-w-[92vw] sm:max-w-md pointer-events-auto"
        >
          <div
            className={`px-3.5 py-2 rounded-2xl border shadow-2xl backdrop-blur-md flex items-center gap-2 text-xs font-extrabold tracking-tight ${
              actionToast.tone === 'emerald'
                ? 'bg-[#091811]/95 border-[#b5ff00]/50 text-[#b5ff00]'
                : actionToast.tone === 'amber'
                ? 'bg-[#1c1507]/95 border-amber-400/50 text-amber-300'
                : actionToast.tone === 'rose'
                ? 'bg-[#1f0b10]/95 border-rose-500/50 text-rose-200'
                : 'bg-[#08171e]/95 border-cyan-400/50 text-cyan-200'
            }`}
          >
            {actionToast.tone === 'emerald' ? (
              <CheckCircle2 className="w-4 h-4 text-[#b5ff00] shrink-0" />
            ) : actionToast.tone === 'rose' || actionToast.tone === 'amber' ? (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            ) : (
              <Check className="w-4 h-4 shrink-0" />
            )}
            <span className="truncate">{actionToast.message}</span>
            <button
              type="button"
              onClick={() => setActionToast(null)}
              aria-label="Fechar aviso"
              className="ml-1 p-0.5 rounded-full hover:bg-white/10 text-current/70 hover:text-current shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <AccountAuthModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        currentUser={currentUser}
        cloudSyncStatus={cloudSyncStatus}
        lastSyncMessage={lastSyncMessage}
        careerSlots={slots}
        onManualSync={handleManualCloudSync}
        onNotify={showActionToast}
      />
    </>
  );

  // Render Entry / Career Slot Selection Screen when on 'hub'
  if (screen === 'hub') {
    return (
      <>
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
          currentUser={currentUser}
          cloudSyncStatus={cloudSyncStatus}
          onOpenAccountModal={() => setIsAccountModalOpen(true)}
        />
        {globalOverlayNodes}
      </>
    );
  }

  const activeOffersCount = pendingOffers.filter(
    (o) => o.status === 'PENDING'
  ).length;

  const primaryActionLabel =
    activeTab === 'match'
      ? matchState.phase === 'FULL_TIME'
        ? 'Concluir Jogo e Avançar'
        : matchState.isRunning
        ? `Em Jogo (${matchState.minute}') · Pausar`
        : matchState.phase === 'HALF_TIME'
        ? 'Iniciar 2º Tempo'
        : "Apito Inicial (0')"
      : isSeasonFinished
      ? `Encerrar ${currentYear} → ${currentYear + 1}`
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
      : isSeasonFinished
      ? `Final ${currentYear}`
      : isMatchDay
      ? 'Ir p/ Jogo'
      : 'Continuar';

  const youthReadyCount =
    youthAcademy.youthRoster?.filter((p) => p.age >= 16).length || 0;
  const isFootballHubActive =
    activeTab === 'squad' || activeTab === 'tactics' || activeTab === 'youth';
  const isSeasonHubActive =
    activeTab === 'competitions' || activeTab === 'calendar';

  const navHubs = [
    {
      id: 'inbox' as const,
      targetTab: 'inbox' as NavigationTab,
      isActive: activeTab === 'inbox',
      label: 'Central',
      mobileLabel: 'Início',
      icon: LayoutDashboard,
      badge: null,
      subItems: undefined,
    },
    {
      id: 'football' as const,
      targetTab: (isFootballHubActive ? activeTab : 'squad') as NavigationTab,
      isActive: isFootballHubActive,
      label: 'Elenco & Tática',
      mobileLabel: 'Elenco',
      icon: Users,
      badge: `${squad.length}`,
      subItems: [
        {
          id: 'squad' as NavigationTab,
          label: 'Plantel Profissional',
          shortLabel: 'Plantel',
          icon: Users,
          badge: `${squad.length}`,
        },
        {
          id: 'tactics' as NavigationTab,
          label: 'Prancheta Tática',
          shortLabel: 'Táticas',
          icon: Sliders,
          badge: userClub.formation,
        },
        {
          id: 'youth' as NavigationTab,
          label: 'Base & Sub-20',
          shortLabel: 'Base Sub-20',
          icon: GraduationCap,
          badge: youthReadyCount > 0 ? String(youthReadyCount) : null,
        },
      ],
    },
    {
      id: 'market' as const,
      targetTab: 'market' as NavigationTab,
      isActive: activeTab === 'market',
      label: 'Mercado',
      mobileLabel: 'Mercado',
      icon: ArrowLeftRight,
      badge:
        activeOffersCount > 0
          ? `${activeOffersCount}!`
          : watchedPlayers.length > 0
          ? String(watchedPlayers.length)
          : null,
      subItems: undefined,
    },
    {
      id: 'season' as const,
      targetTab: (isSeasonHubActive
        ? activeTab
        : 'competitions') as NavigationTab,
      isActive: isSeasonHubActive,
      label: 'Temporada',
      mobileLabel: 'Temporada',
      icon: Trophy,
      badge: `${userRank}º`,
      subItems: [
        {
          id: 'competitions' as NavigationTab,
          label: 'Ligas & Copas',
          shortLabel: 'Ligas & Copas',
          icon: Trophy,
          badge: `${userRank}º`,
        },
        {
          id: 'calendar' as NavigationTab,
          label: 'Calendário & Simulação',
          shortLabel: 'Calendário',
          icon: Calendar,
          badge: String(currentYear),
        },
      ],
    },
    {
      id: 'finances' as const,
      targetTab: 'finances' as NavigationTab,
      isActive: activeTab === 'finances',
      label: 'Finanças',
      mobileLabel: 'Finanças',
      icon: Wallet,
      badge: null,
      subItems: undefined,
    },
  ];

  // Exclusive Match Moment Full-Screen View (Separate from out-of-match management settings)
  if (activeTab === 'match') {
    return (
      <div className="min-h-screen bg-[#0b0c10] text-zinc-100 flex flex-col">
        <header className="sticky top-0 z-30 h-14 lg:h-16 bg-[#0b0c10]/95 border-b border-white/[0.08] px-4 sm:px-6 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <ClubBadge
              clubId={userClub.id}
              abbr={userClub.abbr}
              name={userClub.name}
              primaryColor={userClub.primaryColor}
              size="header"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-[#b5ff00] text-[#090a0f] text-[10px] font-mono font-extrabold uppercase tracking-wider">
                  Dia de Jogo
                </span>
                <h1 className="font-display text-base sm:text-xl font-extrabold uppercase tracking-tight text-white truncate">
                  {homeClub.shortName} vs {awayClub.shortName}
                </h1>
              </div>
              <div className="text-[11px] text-zinc-400 font-mono truncate">
                {formatCalendarDate(dayOffset, currentYear)} · {homeClub.stadium}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handlePrimaryHeaderAction}
              className="px-4 py-2 rounded-full text-xs font-extrabold bg-[#b5ff00] hover:bg-[#c8ff33] text-[#090a0f] transition-colors flex items-center gap-1.5 whitespace-nowrap shadow-md"
            >
              <Play className="w-3.5 h-3.5 fill-current shrink-0" />
              <span className="hidden sm:inline">{primaryActionLabel}</span>
              <span className="sm:hidden">{mobilePrimaryActionLabel}</span>
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto p-3.5 sm:p-5 lg:p-6 overflow-y-auto overflow-x-hidden">
          <MatchEngineView
            match={matchState}
            homeClub={homeClub}
            awayClub={awayClub}
            userClubId={userClubId}
            headToHead={preMatchHeadToHead}
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
            onExitPreMatch={
              matchState.phase === 'PRE_MATCH'
                ? () => setActiveTab('inbox')
                : undefined
            }
          />
        </main>
        {globalOverlayNodes}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0c10] text-zinc-100 flex flex-col lg:flex-row">
      {/* Fixed Sidebar Navigation (Desktop lg+) */}
      <aside className="hidden lg:flex w-64 bg-[#111319] border-r border-white/[0.07] flex-col justify-between shrink-0 select-none">
        <div>
          {/* Brand Lockup */}
          <div className="h-16 px-5 border-b border-white/[0.07] flex items-center gap-3">
            <img
              src="/pwa-192x192.png"
              alt="Prancheta Pro"
              className="w-9 h-9 rounded-xl shadow-md shrink-0"
            />
            <div className="min-w-0">
              <div className="font-display text-lg font-extrabold uppercase tracking-tight text-white leading-none truncate">
                Prancheta Pro
              </div>
              <div className="text-[11px] text-[#b5ff00] font-mono mt-0.5 leading-none truncate">
                Slot 0{activeSlot || 1} · {managerName}
              </div>
            </div>
          </div>

          {/* Consolidated 5-Pillar Navigation Menu with Sub-items */}
          <nav
            className="p-3.5 space-y-1.5"
            aria-label="Navegação principal do clube"
          >
            {navHubs.map((hub) => {
              const Icon = hub.icon;
              return (
                <div key={hub.id} className="space-y-1">
                  <button
                    onClick={() => setActiveTab(hub.targetTab)}
                    className={`w-full flex items-center justify-between px-4 py-2.5 rounded-full text-xs transition-all ${
                      hub.isActive
                        ? 'bg-[#b5ff00] text-[#090a0f] font-extrabold shadow-md'
                        : 'text-zinc-400 hover:text-white hover:bg-white/[0.05] font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="whitespace-nowrap">{hub.label}</span>
                    </div>
                    {hub.badge && (
                      <span
                        className={`font-mono tabular-nums text-[11px] px-2 py-0.5 rounded-full ${
                          hub.isActive
                            ? 'bg-[#090a0f] text-[#b5ff00] font-bold'
                            : 'text-zinc-400 bg-white/[0.05]'
                        }`}
                      >
                        {hub.badge}
                      </span>
                    )}
                  </button>

                  {hub.subItems && hub.isActive && (
                    <div className="pl-4 pr-1 py-0.5 space-y-1">
                      {hub.subItems.map((sub) => {
                        const SubIcon = sub.icon;
                        const isSubActive = activeTab === sub.id;
                        return (
                          <button
                            key={sub.id}
                            onClick={() => setActiveTab(sub.id)}
                            className={`w-full flex items-center justify-between px-3 py-1.5 rounded-full text-[11px] transition-colors ${
                              isSubActive
                                ? 'bg-white/[0.1] text-white font-bold border border-[#b5ff00]/35'
                                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                            }`}
                          >
                            <span className="flex items-center gap-2 truncate">
                              <SubIcon className="w-3.5 h-3.5 text-[#b5ff00] shrink-0" />
                              <span className="truncate">{sub.label}</span>
                            </span>
                            {sub.badge && (
                              <span className="font-mono text-[10px] text-zinc-400 ml-1">
                                {sub.badge}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Bottom Next Match Card + Career Save / Menu Controls */}
        <div className="p-3.5 space-y-2.5">
          <div className="p-4 rounded-2xl border border-[#b5ff00]/25 bg-[#0b0c10] space-y-2.5">
            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <span>{isSeasonFinished ? `Temporada ${currentYear}` : 'Momento de Partida'}</span>
              <span className="font-mono font-bold text-[#b5ff00] truncate max-w-[130px]">
                {isSeasonFinished
                  ? 'Concluída'
                  : currentCalendarStep.competition === 'COPA_DO_BRASIL'
                  ? `CdB · ${currentCalendarStep.copaStage}`
                  : currentCalendarStep.competition === 'LIBERTADORES'
                  ? `Lib · ${currentCalendarStep.libStage === 'Grupos' ? `G${currentCalendarStep.libGroupRound}` : currentCalendarStep.libStage}`
                  : currentCalendarStep.competition === 'CHAMPIONS_LEAGUE'
                  ? `UCL · ${currentCalendarStep.uclStage}`
                  : `${currentRound}ª Rodada`}
              </span>
            </div>
            <div className="font-display text-base font-extrabold uppercase tracking-tight text-white truncate">
              {isSeasonFinished
                ? `${userRank}º · ${userLeagueShort}`
                : `${homeClub.shortName} vs ${awayClub.shortName}`}
            </div>
            <div className="text-[11px] text-zinc-400 truncate">
              {isSeasonFinished
                ? 'Todas as competições encerradas'
                : homeClub.stadium}
            </div>
            {isSeasonFinished ? (
              <button
                type="button"
                onClick={handleOpenSeasonEndModal}
                className="w-full py-2 px-2.5 rounded-xl text-[11px] font-extrabold bg-[#b5ff00] hover:bg-[#c8ff33] text-[#090a0f] transition-colors flex items-center justify-center gap-1"
              >
                <Trophy className="w-3 h-3 shrink-0" />
                <span>Resumo {currentYear} / Novo Ano</span>
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={handleEnterMatchMoment}
                  className="py-2 px-2.5 rounded-xl text-[11px] font-extrabold bg-[#b5ff00] hover:bg-[#c8ff33] text-[#090a0f] transition-colors flex items-center justify-center gap-1"
                >
                  <Play className="w-3 h-3 fill-current shrink-0" />
                  <span>Ver Jogo</span>
                </button>
                <button
                  type="button"
                  onClick={handleQuickSimulateFromOutside}
                  className="py-2 px-2.5 rounded-xl text-[11px] font-extrabold bg-white hover:bg-zinc-200 text-[#090a0f] transition-colors flex items-center justify-center gap-1"
                >
                  <FastForward className="w-3 h-3 shrink-0" />
                  <span>Simular</span>
                </button>
              </div>
            )}
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
        <header className="sticky top-0 z-30 h-13 lg:h-16 bg-[#0b0c10]/95 border-b border-white/[0.07] px-3 sm:px-5 lg:px-6 flex items-center justify-between gap-2 sm:gap-4 shrink-0">
          {/* Left: Club Name & League Status */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 overflow-hidden">
            <ClubBadge
              clubId={userClub.id}
              abbr={userClub.abbr}
              name={userClub.name}
              primaryColor={userClub.primaryColor}
              size="header"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <h1 className="font-display text-sm sm:text-base lg:text-lg font-extrabold uppercase tracking-tight text-white truncate">
                  {userClub.name}
                </h1>
                <span className="text-xs text-zinc-400 font-mono hidden xl:inline whitespace-nowrap shrink-0">
                  · {userRank}º {userLeagueShort}
                </span>
              </div>
              {/* Mobile compact status line */}
              <div className="text-[10px] text-zinc-400 font-mono tabular-nums truncate md:hidden">
                {formatCalendarDate(dayOffset, currentYear).split(',')[1]?.trim()} ·{' '}
                <span className="text-[#b5ff00] font-bold">
                  {formatCompactBRL(userClub.cashBalance)}
                </span>{' '}
                · {userRank}º {userLeagueShort}
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
              title={`Abrir Calendário Anual ${currentYear}`}
              className="hidden md:flex items-center gap-2 text-xs text-left hover:bg-white/[0.05] px-2.5 py-1.5 rounded-xl transition-colors"
            >
              <Calendar className="w-4 h-4 text-[#b5ff00]" />
              <div>
                <div className="text-[10px] text-zinc-400 leading-none">
                  Calendário Oficial
                </div>
                <div className="font-mono tabular-nums font-semibold text-white mt-0.5">
                  {formatCalendarDate(dayOffset, currentYear)}
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

            {/* Alternador de Moeda (Real R$ / Euro €) - Visível em telas sm+ no topo; no mobile fica integrado em Mercado/Finanças */}
            <div className="hidden sm:flex items-center">
              <CurrencyToggle />
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
              className={`p-2 sm:px-3 sm:py-1.5 lg:px-3.5 lg:py-2 rounded-full text-xs font-bold border transition-colors flex items-center gap-1.5 whitespace-nowrap ${
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

            {/* Cloud Account & Multi-Device Sync Button */}
            <button
              type="button"
              onClick={() => setIsAccountModalOpen(true)}
              data-testid="open-account-modal-header-btn"
              aria-label="Conta e sincronização na nuvem"
              title={
                currentUser
                  ? `Conectado: ${currentUser.displayName || currentUser.email}`
                  : 'Entrar ou Criar Conta para sincronizar em múltiplos dispositivos'
              }
              className={`p-2 sm:px-3 sm:py-1.5 rounded-full text-xs font-bold border transition-colors flex items-center gap-1.5 whitespace-nowrap active:scale-95 ${
                currentUser
                  ? 'bg-[#b5ff00]/10 hover:bg-[#b5ff00]/20 text-[#b5ff00] border-[#b5ff00]/35'
                  : 'bg-[#14171f] hover:bg-white/[0.08] text-zinc-200 border-white/10'
              }`}
            >
              {currentUser ? (
                <UserCheck className="w-3.5 h-3.5 text-[#b5ff00] shrink-0" />
              ) : (
                <Cloud className="w-3.5 h-3.5 text-[#b5ff00] shrink-0" />
              )}
              <span className="hidden md:inline max-w-[96px] truncate">
                {currentUser
                  ? currentUser.displayName?.split(' ')[0] || 'Nuvem ✓'
                  : 'Conta'}
              </span>
            </button>

            {/* PWA Install Button (hidden automatically when already in standalone mode) */}
            <PWAInstallButton variant="header" />

            {/* Mobile/Compact Return to Career Hub Button */}
            <button
              type="button"
              onClick={handleReturnToHub}
              aria-label="Voltar aos slots e saves"
              title="Voltar ao menu de saves"
              className="lg:hidden p-2 rounded-full bg-[#14171f] hover:bg-white/[0.08] text-zinc-300 border border-white/10 transition-colors"
            >
              <FolderOpen className="w-3.5 h-3.5 text-[#b5ff00]" />
            </button>

            {/* Dynamic Primary Action Button */}
            <button
              onClick={handlePrimaryHeaderAction}
              className="px-3.5 py-2 lg:px-5 lg:py-2.5 rounded-full text-xs font-extrabold bg-[#b5ff00] hover:bg-[#c8ff33] text-[#090a0f] transition-colors flex items-center gap-1.5 lg:gap-2 whitespace-nowrap shadow-md"
            >
              <Play className="w-3 h-3 lg:w-3.5 lg:h-3.5 fill-current shrink-0" />
              <span className="hidden sm:inline">{primaryActionLabel}</span>
              <span className="sm:hidden">{mobilePrimaryActionLabel}</span>
              <ChevronRight className="w-3.5 h-3.5 hidden sm:inline" />
            </button>
          </div>
        </header>

        {/* Active Module Viewport */}
        <main className="flex-1 p-3.5 sm:p-5 lg:p-6 pb-24 lg:pb-6 overflow-y-auto overflow-x-hidden">
          {/* Unified Sub-Navigation Bar for Football Department Hub (Elenco | Táticas | Base) */}
          {isFootballHubActive && (
            <div
              data-testid="football-subnav"
              className="mb-4 bg-[#14171f] border border-white/[0.08] p-1.5 rounded-2xl shadow-lg"
            >
              <div className="grid grid-cols-3 gap-1.5 w-full">
                {(
                  [
                    {
                      id: 'squad' as NavigationTab,
                      label: 'Plantel Profissional',
                      mobileLabel: 'Plantel',
                      badge: `${squad.length}`,
                      icon: Users,
                    },
                    {
                      id: 'tactics' as NavigationTab,
                      label: 'Prancheta Tática',
                      mobileLabel: 'Táticas',
                      badge: userClub.formation,
                      icon: Sliders,
                    },
                    {
                      id: 'youth' as NavigationTab,
                      label: 'Base & Sub-20',
                      mobileLabel: 'Base',
                      badge:
                        youthReadyCount > 0 ? `${youthReadyCount}` : undefined,
                      icon: GraduationCap,
                    },
                  ] as const
                ).map((sub) => {
                  const SubIcon = sub.icon;
                  const active = activeTab === sub.id;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setActiveTab(sub.id)}
                      className={`min-w-0 min-h-[44px] sm:min-h-[42px] px-2 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 overflow-hidden cursor-pointer ${
                        active
                          ? 'bg-[#b5ff00] text-[#090a0f] font-extrabold shadow-sm'
                          : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                      }`}
                    >
                      <span className="flex items-center justify-center gap-1 sm:gap-1.5 min-w-0 max-w-full">
                        <SubIcon className="w-3.5 h-3.5 shrink-0" />
                        <span className="hidden sm:inline truncate">
                          {sub.label}
                        </span>
                        <span className="sm:hidden truncate">
                          {sub.mobileLabel}
                        </span>
                      </span>
                      {sub.badge && (
                        <span
                          className={`font-mono text-[10px] leading-none px-1.5 py-0.5 rounded-full shrink-0 ${
                            active
                              ? 'bg-[#090a0f]/15 text-[#090a0f] font-extrabold'
                              : 'bg-white/[0.07] text-zinc-400'
                          }`}
                        >
                          {sub.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Unified Sub-Navigation Bar for Season Hub (Competições | Calendário Anual) */}
          {isSeasonHubActive && (
            <div
              data-testid="season-subnav"
              className="mb-4 bg-[#14171f] border border-white/[0.08] p-1.5 rounded-2xl shadow-lg"
            >
              <div className="grid grid-cols-2 gap-1.5 w-full">
                {(
                  [
                    {
                      id: 'competitions' as NavigationTab,
                      label: 'Ligas, Copas & Tabelas',
                      mobileLabel: 'Ligas & Copas',
                      badge: `${userRank}º · ${userLeagueShort}`,
                      mobileBadge: `${userRank}º · ${userLeagueShort}`,
                      icon: Trophy,
                    },
                    {
                      id: 'calendar' as NavigationTab,
                      label: 'Calendário & Simulação Rápida',
                      mobileLabel: 'Calendário',
                      badge: formatCalendarDate(dayOffset, currentYear)
                        .split(',')[1]
                        ?.trim(),
                      mobileBadge: `Simular · ${currentYear}`,
                      icon: Calendar,
                    },
                  ] as const
                ).map((sub) => {
                  const SubIcon = sub.icon;
                  const active = activeTab === sub.id;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setActiveTab(sub.id)}
                      className={`min-w-0 min-h-[44px] sm:min-h-[42px] px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 overflow-hidden cursor-pointer ${
                        active
                          ? 'bg-[#b5ff00] text-[#090a0f] font-extrabold shadow-sm'
                          : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                      }`}
                    >
                      <span className="flex items-center justify-center gap-1.5 min-w-0 max-w-full">
                        <SubIcon className="w-3.5 h-3.5 shrink-0" />
                        <span className="hidden sm:inline truncate">
                          {sub.label}
                        </span>
                        <span className="sm:hidden truncate">
                          {sub.mobileLabel}
                        </span>
                      </span>
                      <span
                        className={`font-mono text-[10px] leading-none px-1.5 py-0.5 rounded-full shrink-0 ${
                          active
                            ? 'bg-[#090a0f]/15 text-[#090a0f] font-extrabold'
                            : 'bg-white/[0.07] text-zinc-400'
                        }`}
                      >
                        <span className="hidden sm:inline">{sub.badge}</span>
                        <span className="sm:hidden">{sub.mobileBadge}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Mobile Currency Bar inside Finances view */}
          {activeTab === 'finances' && (
            <div className="sm:hidden mb-3 flex items-center justify-between bg-[#14171f] border border-white/[0.08] px-3.5 py-2 rounded-2xl">
              <span className="text-xs font-semibold text-zinc-300">
                Moeda de exibição financeira
              </span>
              <CurrencyToggle compact />
            </div>
          )}

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
              secondaryStandings={secondaryStandings}
              libertadores={libertadores}
              clubs={clubs}
              squad={squad}
              currentRound={currentRound}
              activeCompetition={currentCalendarStep.competition}
              competitionLabel={
                currentCalendarStep.competition === 'BRASILEIRAO'
                  ? `${userLeagueFull} · ${currentRound}ª Rodada`
                  : currentCalendarStep.label
              }
              isMatchDay={isMatchDay}
              onGoToMatch={handleEnterMatchMoment}
              onQuickSimulateMatch={handleQuickSimulateFromOutside}
              pendingOffers={pendingOffers}
              dayOffset={dayOffset}
              seasonYear={currentYear}
              onResolveIncomingOffer={handleResolveIncomingOffer}
              hasNewSeasonEvolutionReport={Boolean(newSeasonEvolutionReport)}
              onOpenNewSeasonEvolutionReport={() =>
                setIsNewSeasonEvolutionModalOpen(true)
              }
            />
          )}

          {activeTab === 'squad' && (
            <SquadView
              club={userClub}
              squad={squad}
              loanedOutPlayers={loanedOutPlayers}
              currentYear={currentYear}
              focusRenewalsSignal={focusRenewalsSignal}
              onInspectPlayer={(p) => setInspectedPlayerId(p.id)}
              onSwapPlayers={handleSwapPlayers}
              onAutoPickBestXI={handleAutoPickBestXI}
              onTogglePlayerMarketListing={handleTogglePlayerMarketListing}
              onRenewContract={handleRenewContract}
              onToggleDoNotRenewContract={handleToggleDoNotRenewContract}
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
              onAutoPickBestXI={handleAutoPickBestXI}
            />
          )}

          {activeTab === 'market' && (
            <MarketView
              userClub={userClub}
              clubs={clubs}
              squad={squad}
              freeAgents={freeAgents}
              loanedOutPlayers={loanedOutPlayers}
              transferHistory={transferHistory}
              transferredOutClubPlayerIds={transferredOutClubPlayerIds}
              watchedPlayers={watchedPlayers}
              negotiationStates={negotiationStates}
              seasonYear={currentYear}
              dayOffset={dayOffset}
              aiSquads={aiSquads}
              pendingOffers={pendingOffers}
              onResolveIncomingOffer={handleResolveIncomingOffer}
              lastFeedback={marketFeedback}
              onClearFeedback={() => setMarketFeedback(null)}
              lastAttemptResult={transferAttemptResult}
              onClearAttemptResult={() => setTransferAttemptResult(null)}
              onAcceptCounterOffer={handleAcceptCounterOffer}
              onInspectPlayer={(p, listing) => {
                setInspectedPlayerId(null);
                setInspectedExternalPlayer(p);
                setInspectedExternalListing(listing || null);
              }}
              onToggleWatchPlayer={handleToggleWatchPlayer}
              onRemoveWatchedPlayer={handleRemoveWatchedPlayer}
              onProposeTransfer={handleProposeTransfer}
              onOutgoingTransfer={handleOutgoingTransfer}
              onTogglePlayerMarketListing={handleTogglePlayerMarketListing}
              onSolicitOfferForPlayer={handleSolicitOfferForPlayer}
            />
          )}

          {activeTab === 'youth' && (
            <YouthAcademyView
              club={userClub}
              seasonYear={currentYear}
              academy={youthAcademy}
              onUpdateAcademySettings={handleUpdateYouthAcademySettings}
              onInspectPlayer={(p) => {
                setInspectedPlayerId(null);
                setInspectedExternalPlayer(p);
                setInspectedExternalListing(null);
              }}
              onPromoteYouthPlayer={handlePromoteYouthPlayer}
              onReleaseYouthPlayer={handleReleaseYouthPlayer}
            />
          )}

          {activeTab === 'calendar' && (
            <AnnualCalendarView
              userClub={userClub}
              clubs={clubs}
              fixtures={fixtures}
              copaDoBrasil={copaDoBrasil}
              libertadores={libertadores}
              championsLeague={championsLeague}
              mundial={mundial}
              superMundial={superMundial}
              seasonStepIndex={seasonStepIndex}
              dayOffset={dayOffset}
              seasonYear={currentYear}
              isMatchDay={isMatchDay}
              isSeasonCompleted={isSeasonFinished}
              onGoToMatch={() => {
                setIsMatchDay(true);
                setActiveTab('match');
              }}
              onOpenCompetitions={() => setActiveTab('competitions')}
              onStartAutoSimulation={handleStartAutoSimulation}
            />
          )}

          {activeTab === 'competitions' && (
            <CompetitionsView
              standings={standings}
              clubs={clubs}
              fixtures={fixtures}
              currentRound={currentRound}
              seasonYear={currentYear}
              seasonHistory={seasonHistory}
              userClubId={userClubId}
              userDivision={userPlayableDivision}
              secondaryStandings={secondaryStandings}
              secondaryFixtures={secondaryFixtures}
              copaDoBrasil={copaDoBrasil}
              libertadores={libertadores}
              championsLeague={championsLeague}
              mundial={mundial}
              superMundial={superMundial}
              activeCompetition={currentCalendarStep.competition}
            />
          )}

          {activeTab === 'finances' && (
            <FinancesView
              club={userClub}
              squad={squad}
              loanedOutPlayers={loanedOutPlayers}
              financeLedger={financeLedger}
              seasonYear={currentYear}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom 5-Hub Navigation Bar (< lg) */}
      <nav
        aria-label="Navegação mobile"
        className="lg:hidden fixed bottom-2 left-2 right-2 z-40 h-16 bg-[#14171f]/95 backdrop-blur-md border border-white/10 rounded-2xl grid grid-cols-5 items-center px-1.5 shadow-2xl select-none"
      >
        {navHubs.map((hub) => {
          const Icon = hub.icon;
          const isActive = hub.isActive;
          return (
            <button
              key={hub.id}
              onClick={() => setActiveTab(hub.targetTab)}
              className={`h-12 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
                isActive
                  ? 'bg-[#b5ff00] text-[#090a0f] font-extrabold shadow-sm'
                  : 'text-zinc-400 hover:text-white font-semibold'
              }`}
            >
              <div className="relative flex items-center justify-center">
                <Icon className="w-4 h-4" />
                {hub.id === 'market' && activeOffersCount > 0 && !isActive && (
                  <span className="absolute -top-1.5 -right-3 px-1 rounded-full bg-[#b5ff00] text-[#090a0f] text-[9px] font-mono font-extrabold leading-tight">
                    {activeOffersCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] sm:text-[11px] leading-none tracking-tight whitespace-nowrap">
                {hub.mobileLabel}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Detailed 18-Attribute Player Profile Modal */}
      {(() => {
        const isInspectedYouthPlayer = Boolean(
          inspectedPlayer &&
            (youthAcademy.youthRoster || []).some(
              (y) => y.id === inspectedPlayer.id
            )
        );
        return (
          <PlayerProfileModal
            player={inspectedPlayer}
            readOnly={Boolean(inspectedExternalPlayer)}
            currentYear={currentYear}
            isWatched={
              inspectedExternalListing
                ? watchedPlayers.some(
                    (w) => w.playerId === inspectedExternalListing.player.id
                  )
                : false
            }
            onToggleWatch={
              inspectedExternalListing
                ? () => handleToggleWatchPlayer(inspectedExternalListing)
                : undefined
            }
            onClose={() => {
              setInspectedPlayerId(null);
              setInspectedExternalPlayer(null);
              setInspectedExternalListing(null);
            }}
            onUpdateRoleDuty={handleUpdateRoleDuty}
            onTogglePlayerMarketListing={
              inspectedExternalPlayer
                ? undefined
                : handleTogglePlayerMarketListing
            }
            onToggleDoNotRenewContract={
              inspectedExternalPlayer
                ? undefined
                : handleToggleDoNotRenewContract
            }
            isYouthAcademyPlayer={isInspectedYouthPlayer}
            onPromoteYouthPlayer={
              isInspectedYouthPlayer ? handlePromoteYouthPlayer : undefined
            }
            onReleaseYouthPlayer={
              isInspectedYouthPlayer ? handleReleaseYouthPlayer : undefined
            }
          />
        );
      })()}

      {/* Match-by-Match Calendar Auto-Simulation Modal */}
      <AutoSimModal
        isOpen={autoSimUi.isOpen}
        isRunning={autoSimUi.isRunning}
        isPaused={autoSimUi.isPaused}
        isDone={autoSimUi.isDone}
        wasStoppedEarly={autoSimUi.wasStoppedEarly}
        targetLabel={autoSimUi.targetLabel}
        startDayOffset={autoSimUi.startDayOffset}
        currentDayOffset={autoSimUi.currentDayOffset}
        targetDayOffset={autoSimUi.targetDayOffset}
        plannedUserMatches={autoSimUi.plannedUserMatches}
        logs={autoSimUi.logs}
        userClub={userClub}
        squad={squad}
        clubs={clubs}
        userRank={userRank}
        seasonYear={currentYear}
        pausedOffer={autoSimUi.pausedOffer}
        offerResolutionNote={autoSimUi.offerResolutionNote}
        onResolveOffer={handleResolveAutoSimOffer}
        onInspectPlayer={(p) => setInspectedPlayerId(p.id)}
        onPause={handlePauseAutoSimulation}
        onResume={handleResumeAutoSimulation}
        onPauseOrStop={handleStopAutoSimulation}
        onFinishInstant={handleFinishAutoSimulationInstant}
        onClose={() => {
          setAutoSimUi((prev) => ({ ...prev, isOpen: false }));
          if (seasonEndReport) {
            setIsSeasonEndModalOpen(true);
          }
        }}
        onOpenCompetitions={() => {
          setAutoSimUi((prev) => ({ ...prev, isOpen: false }));
          if (seasonEndReport) {
            setIsSeasonEndModalOpen(true);
          } else {
            setActiveTab('competitions');
          }
        }}
      />

      {/* End of Season Summary, Champions, Awards & Continuous Year Rollover Modal */}
      <SeasonEndModal
        isOpen={isSeasonEndModalOpen}
        report={seasonEndReport}
        userClub={userClub}
        clubs={clubs}
        expiringContracts={squad.filter(
          (p) =>
            p.contractType !== 'EMPRESTADO' &&
            getPlayerContractRemainingYears(p) <= 1 &&
            p.contractRenewalStatus !== 'RENOVADO' &&
            p.contractRenewalStatus !== 'RECUSADO'
        )}
        onGoToContracts={() => {
          setIsSeasonEndModalOpen(false);
          setFocusRenewalsSignal((s) => s + 1);
          setActiveTab('squad');
        }}
        onClose={() => setIsSeasonEndModalOpen(false)}
        onStartNextSeason={handleStartNextSeason}
      />

      {/* New Season Player Evolution & Regression Report Modal */}
      <NewSeasonEvolutionModal
        isOpen={isNewSeasonEvolutionModalOpen}
        report={newSeasonEvolutionReport}
        userClub={userClub}
        squad={squad}
        onInspectPlayer={(p) => setInspectedPlayerId(p.id)}
        onGoToSquad={() => {
          setIsNewSeasonEvolutionModalOpen(false);
          setActiveTab('squad');
        }}
        onClose={() => setIsNewSeasonEvolutionModalOpen(false)}
      />

      {globalOverlayNodes}
    </div>
  );
}
