import {
  INITIAL_CLUBS,
  generateLeagueSchedule,
  getInitialStandingsForDivision,
  getRealSquadForClub,
} from './initialDatabase';
import { createInitialMatchState } from '../engine/matchEngine';
import {
  CareerSaveData,
  CareerSlotIndex,
  Club,
  InboxMessage,
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
  const r6Fix = fixtures.find((f) => f.roundNumber === 6 && f.isUserMatch);
  const isHome = r6Fix ? r6Fix.homeClubId === club.id : true;
  const userRank = standings.findIndex((s) => s.clubId === club.id) + 1;
  const userRow = standings.find((s) => s.clubId === club.id);
  const oppRank = standings.findIndex((s) => s.clubId === opponentClub.id) + 1;
  const divLabel = club.division === 'B' ? 'Série B' : 'Série A';

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
    ? Math.round((club.capacity * 0.8 * 85) / 100000) * 100000
    : 850000;

  return [
    {
      id: `${club.id}-msg-1`,
      date: '16 Mai 2026 · 09:15',
      sender: 'Comissão Técnica',
      senderRole: 'Auxiliar Técnico',
      subject: `Dossiê 6ª Rodada (${divLabel}): ${club.shortName} vs ${opponentClub.shortName}`,
      category: 'Tática',
      priority: 'positive',
      read: false,
      body: [
        `Bem-vindo ao ${club.name}, ${managerName}. O próximo duelo pela ${divLabel} será contra o ${opponentClub.name} (${oppRank}º lugar, esquema ${opponentClub.formation}).`,
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
      date: '16 Mai 2026 · 08:40',
      sender: 'Departamento Médico',
      senderRole: 'Fisiologia',
      subject: `Fadiga: ${fatiguedStarter.name} (${fatiguedStarter.condition}%)`,
      category: 'Departamento Médico',
      priority: 'warning',
      read: false,
      relatedPlayerId: fatiguedStarter.id,
      body: [
        `${fatiguedStarter.name} (${fatiguedStarter.position}) apresenta desgaste físico (${fatiguedStarter.condition}%). ${healthyBackup.name} (${healthyBackup.condition}%) está pronto no banco.`,
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
      date: '15 Mai 2026 · 18:10',
      sender: 'Diretoria',
      senderRole: club.shortName,
      subject: `Objetivos na ${divLabel} e Finanças`,
      category: 'Diretoria',
      priority: 'normal',
      read: false,
      body: [
        `Posição atual: ${userRank}º lugar (${userRow?.points ?? 0} pts). Caixa disponível: ${formatCompactBRL(club.cashBalance)} | Bilheteria prevista: ${formatCompactBRL(gateEstimate)}.`,
      ],
      bulletPoints: [
        club.division === 'B'
          ? club.reputation >= 74
            ? 'Meta: Acesso direto no G-4 da Série B.'
            : 'Meta: Campanha segura na Série B.'
          : club.reputation >= 85
          ? 'Meta: Título e vaga no G-4.'
          : 'Meta: Permanência e vaga continental.',
        `Folha mensal: ${formatCompactBRL(club.wageBudget)}.`,
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
  const clubs: Club[] = INITIAL_CLUBS.map((c) => ({
    ...c,
    instructions: { ...c.instructions },
    starPlayers: c.starPlayers.map((s) => ({ ...s })),
  }));

  const userClub = clubs.find((c) => c.id === clubId) || clubs[0];
  const division = userClub.division;
  const otherDivision: 'A' | 'B' = division === 'A' ? 'B' : 'A';

  const standings = getInitialStandingsForDivision(division);
  const fixtures = generateLeagueSchedule(userClub.id, division);
  const secondaryStandings = getInitialStandingsForDivision(otherDivision);
  const secondaryFixtures = generateLeagueSchedule('__none__', otherDivision);

  const squad = createSquadForClub(userClub);

  const r6Fixture =
    fixtures.find((f) => f.roundNumber === 6 && f.isUserMatch) || fixtures[0];
  const homeClub = clubs.find((c) => c.id === r6Fixture.homeClubId) || clubs[0];
  const awayClub = clubs.find((c) => c.id === r6Fixture.awayClubId) || clubs[1];
  const opponentClub =
    r6Fixture.homeClubId === userClub.id ? awayClub : homeClub;

  const messages = createInitialInboxForCareer(
    userClub,
    opponentClub,
    squad,
    standings,
    fixtures,
    cleanManagerName
  );

  const matchState = createInitialMatchState(
    6,
    r6Fixture,
    homeClub,
    awayClub,
    squad,
    userClub.id
  );

  const userRank = standings.findIndex((s) => s.clubId === userClub.id) + 1;

  return {
    version: 2,
    slotIndex,
    managerName: cleanManagerName,
    userClubId: userClub.id,
    division,
    clubName: userClub.name,
    clubShortName: userClub.shortName,
    clubAbbr: userClub.abbr,
    clubPrimaryColor: userClub.primaryColor,
    currentRound: 6,
    dayOffset: 0,
    isMatchDay: false,
    userRank,
    cashBalance: userClub.cashBalance,
    boardConfidence: userClub.boardConfidence,
    savedAt: new Date().toISOString(),
    clubs,
    squad,
    standings,
    fixtures,
    secondaryStandings,
    secondaryFixtures,
    messages,
    matchState,
  };
}
