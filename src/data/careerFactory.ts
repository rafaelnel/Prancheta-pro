import {
  ALL_WORLD_CLUBS,
  CONMEBOL_FOREIGN_CLUBS,
  LIBERTADORES_BR_CLUB_IDS,
  generateLeagueSchedule,
  getInitialStandingsForDivision,
  getLeagueTotalRounds,
  getPlayableDivisionForClub,
  getPlayableLeagueLabel,
  getPlayableLeagueShortLabel,
  getRealSquadForClub,
  getSecondaryPlayableDivision,
  isEuropeanPlayableDivision,
} from './initialDatabase';
import {
  createInitialChampionsLeague,
  createInitialCopaDoBrasil,
  createInitialLibertadores,
  createInitialMundial,
  createInitialSuperMundial,
} from './cupFactory';
import { createInitialFreeAgents } from './transferCatalog';
import { createInitialMatchState } from '../engine/matchEngine';
import { buildInitialAiSquads } from '../engine/aiMarketEngine';
import {
  GLOBAL_SCALE_VERSION,
  createInitialFinanceLedger,
} from '../engine/economyAndEvolution';
import { createInitialYouthAcademy } from '../engine/youthAcademyEngine';
import {
  CareerSaveData,
  CareerSlotIndex,
  Club,
  InboxMessage,
  PlayableDivision,
  Player,
  RoundFixture,
  StandingsRow,
} from '../types/football';
import { formatCompactBRL } from '../utils/formatters';

export function createSquadForClub(club: Club): Player[] {
  return getRealSquadForClub(club);
}

export function createInitialInboxForCareer(
  club: Club,
  opponentClub: Club,
  squad: Player[],
  standings: StandingsRow[],
  fixtures: RoundFixture[],
  managerName: string
): InboxMessage[] {
  const r1Fix = fixtures.find((f) => f.roundNumber === 1 && f.isUserMatch);
  const isHome = r1Fix ? r1Fix.homeClubId === club.id : true;
  const userRank = standings.findIndex((s) => s.clubId === club.id) + 1;
  const userRow = standings.find((s) => s.clubId === club.id);
  const playableDiv = getPlayableDivisionForClub(club);
  const divLabel = getPlayableLeagueShortLabel(playableDiv);
  const fullLeagueLabel = getPlayableLeagueLabel(playableDiv);
  const isEuro = isEuropeanPlayableDivision(playableDiv);

  const fatiguedStarter =
    [...squad]
      .filter((p) => p.isStarter)
      .sort((a, b) => a.condition - b.condition)[0] || squad[5];
  const healthyBackup =
    squad.find(
      (p) =>
        !p.isStarter &&
        !p.injured &&
        p.sector === fatiguedStarter.sector &&
        p.condition >= 90
    ) ||
    squad.find((p) => !p.isStarter && !p.injured) ||
    squad[16];

  const injuredReserve = squad.find((p) => p.injured);
  const oppStar = opponentClub.starPlayers[0];

  const gateEstimate = isHome
    ? Math.round((club.capacity * 0.8 * (isEuro ? 260 : 85)) / 100000) * 100000
    : isEuro
    ? 2_400_000
    : 850000;

  const boardGoalBullet = isEuro
    ? club.reputation >= 87
      ? `Meta 2026: Disputar o título da ${fullLeagueLabel} e avançar forte na UEFA Champions League.`
      : club.reputation >= 80
      ? `Meta 2026: Brigar pelo G-4 da ${fullLeagueLabel} e vaga na UEFA Champions League.`
      : `Meta 2026: Permanência segura na ${fullLeagueLabel} e valorização do elenco.`
    : playableDiv === 'B'
    ? club.reputation >= 74
      ? 'Meta 2026: Acesso direto no G-4 da Série B e avanço na Copa do Brasil.'
      : 'Meta 2026: Campanha segura na Série B e Copa do Brasil.'
    : LIBERTADORES_BR_CLUB_IDS.includes(club.id)
    ? 'Meta 2026: Título da Série A, Copa do Brasil e Copa Libertadores.'
    : 'Meta 2026: Permanência, Copa do Brasil e vaga na Libertadores.';

  return [
    {
      id: `${club.id}-msg-1`,
      date: '28 Jan 2026 · 09:15',
      sender: 'Comissão Técnica',
      senderRole: 'Auxiliar Técnico',
      subject: `Estreia 2026 — 1ª Rodada (${divLabel}): ${club.shortName} vs ${opponentClub.shortName}`,
      category: 'Tática',
      priority: 'positive',
      read: false,
      body: [
        `Bem-vindo ao ${club.name} para a temporada 2026, ${managerName}. A estreia oficial na ${fullLeagueLabel} 2026 será contra o ${opponentClub.name} (esquema ${opponentClub.formation}).`,
        oppStar
          ? `Principal atenção no adversário: ${oppStar.name} (${oppStar.position}, ${oppStar.highlightAttribute}).`
          : `Ajuste a prancheta antes do apito inicial.`,
      ],
      bulletPoints: [
        `Mando: ${isHome ? `${club.stadium} (Casa)` : `${opponentClub.stadium} (Fora)`}.`,
        `Esquema base: ${club.formation} (${club.instructions.mentality}).`,
      ],
      actionLabel: 'Abrir Prancheta Tática',
      actionTargetTab: 'tactics',
    },
    {
      id: `${club.id}-msg-2`,
      date: '28 Jan 2026 · 08:40',
      sender: 'Departamento Médico',
      senderRole: 'Fisiologia',
      subject: `Carga de Pré-Temporada: ${fatiguedStarter.name} (${fatiguedStarter.condition}%)`,
      category: 'Departamento Médico',
      priority: 'warning',
      read: false,
      relatedPlayerId: fatiguedStarter.id,
      body: [
        `${fatiguedStarter.name} (${fatiguedStarter.position}) apresenta desgaste de pré-temporada (${fatiguedStarter.condition}%). ${healthyBackup.name} (${healthyBackup.condition}%) está pronto no banco.`,
      ],
      bulletPoints: [
        `${fatiguedStarter.name}: ${fatiguedStarter.condition}% de condição.`,
        `${healthyBackup.name}: ${healthyBackup.condition}% — Opção imediata.`,
        injuredReserve
          ? `${injuredReserve.name}: ${injuredReserve.condition}% — Transição física.`
          : 'Demais atletas liberados.',
      ],
      actionLabel: 'Ver Elenco',
      actionTargetTab: 'squad',
    },
    {
      id: `${club.id}-msg-3`,
      date: '27 Jan 2026 · 18:10',
      sender: 'Diretoria',
      senderRole: club.shortName,
      subject: `Objetivos 2026 na ${divLabel} e Finanças`,
      category: 'Diretoria',
      priority: 'normal',
      read: false,
      body: [
        `Início da temporada 2026 (${userRank}º na listagem inicial, ${userRow?.points ?? 0} pts). Caixa disponível: ${formatCompactBRL(club.cashBalance)} | Bilheteria prevista na estreia: ${formatCompactBRL(gateEstimate)}.`,
      ],
      bulletPoints: [
        boardGoalBullet,
        isEuro
          ? `Folha mensal: ${formatCompactBRL(club.wageBudget)} · ${standings.length} clubes na ${fullLeagueLabel} (${getLeagueTotalRounds(playableDiv)} rodadas).`
          : `Folha mensal: ${formatCompactBRL(club.wageBudget)} · ${CONMEBOL_FOREIGN_CLUBS.length + LIBERTADORES_BR_CLUB_IDS.length} clubes na Libertadores.`,
      ],
      actionLabel: 'Ver Finanças',
      actionTargetTab: 'finances',
    },
  ];
}

export function createNewCareerSave(
  slotIndex: CareerSlotIndex,
  clubId: string,
  managerName: string
): CareerSaveData {
  const cleanManagerName = managerName.trim() || 'Treinador Silva';
  const clubs: Club[] = ALL_WORLD_CLUBS.map((c) => ({
    ...c,
    instructions: { ...c.instructions },
    starPlayers: c.starPlayers.map((s) => ({ ...s })),
    recentTitles: [],
  }));

  const userClub = clubs.find((c) => c.id === clubId) || clubs[0];
  const division: PlayableDivision = getPlayableDivisionForClub(userClub);
  const otherDivision: PlayableDivision = getSecondaryPlayableDivision(division);

  const standings = getInitialStandingsForDivision(division, clubs);
  const fixtures = generateLeagueSchedule(userClub.id, division, clubs);
  const secondaryStandings = getInitialStandingsForDivision(otherDivision, clubs);
  const secondaryFixtures = generateLeagueSchedule('__none__', otherDivision, clubs);

  const copaDoBrasil = createInitialCopaDoBrasil(userClub.id, clubs);
  const libertadores = createInitialLibertadores(userClub.id);
  const championsLeague = createInitialChampionsLeague(
    2026,
    clubs,
    isEuropeanPlayableDivision(division) ? userClub.id : undefined
  );
  const mundial = createInitialMundial(2026);
  const superMundial = createInitialSuperMundial({
    seasonYear: 2026,
    userClubId: userClub.id,
    clubsPool: clubs,
  });

  const squad = createSquadForClub(userClub);
  const aiSquads = buildInitialAiSquads(clubs, userClub.id);
  const financeLedger = createInitialFinanceLedger(userClub, squad, 2026);

  const r1Fixture =
    fixtures.find((f) => f.roundNumber === 1 && f.isUserMatch) || fixtures[0];
  const homeClub = clubs.find((c) => c.id === r1Fixture.homeClubId) || clubs[0];
  const awayClub = clubs.find((c) => c.id === r1Fixture.awayClubId) || clubs[1];
  const opponentClub =
    r1Fixture.homeClubId === userClub.id ? awayClub : homeClub;

  const messages = createInitialInboxForCareer(
    userClub,
    opponentClub,
    squad,
    standings,
    fixtures,
    cleanManagerName
  );

  const matchState = createInitialMatchState(
    1,
    r1Fixture,
    homeClub,
    awayClub,
    squad,
    userClub.id,
    [],
    aiSquads
  );

  const userRank = standings.findIndex((s) => s.clubId === userClub.id) + 1;

  return {
    version: 3,
    slotIndex,
    managerName: cleanManagerName,
    userClubId: userClub.id,
    division,
    clubName: userClub.name,
    clubShortName: userClub.shortName,
    clubAbbr: userClub.abbr,
    clubPrimaryColor: userClub.primaryColor,
    currentYear: 2026,
    currentRound: 1,
    seasonStepIndex: 0,
    activeCompetition: 'BRASILEIRAO',
    dayOffset: 0,
    isMatchDay: false,
    userRank,
    cashBalance: userClub.cashBalance,
    boardConfidence: userClub.boardConfidence,
    savedAt: new Date().toISOString(),
    clubs,
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
    accumulatedUclChampions: [],
    accumulatedLibChampions: [],
    globalScaleVersion: GLOBAL_SCALE_VERSION,
    messages,
    matchState,
    matchHistory: [],
    freeAgents: createInitialFreeAgents(),
    loanedOutPlayers: [],
    transferHistory: [],
    transferredOutClubPlayerIds: [],
    watchedPlayers: [],
    pendingOffers: [],
    financeLedger,
    seasonHistory: [],
    seasonEndReport: null,
    youthAcademy: createInitialYouthAcademy(
      userClub.id,
      userClub.reputation,
      userClub.division,
      2026
    ),
  };
}
