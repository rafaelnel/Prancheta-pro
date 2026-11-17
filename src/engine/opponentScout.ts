import {
  Club,
  CompetitionType,
  CopaDoBrasilState,
  LibertadoresState,
  Player,
  RoundFixture,
  StandingsRow,
} from '../types/football';
import { calculateTeamTacticalRatings } from './matchEngine';

export interface OpponentWeaknessPoint {
  id: string;
  title: string;
  evidence: string;
  exploitationTip: string;
  severity: 'alta' | 'media';
}

export interface OpponentScoutReport {
  opponentId: string;
  opponentName: string;
  tableLabel: string;
  position: number;
  totalTeams: number;
  played: number;
  points: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  recentForm: ('V' | 'E' | 'D')[];
  standingsBadge: string;
  summary: string;
  tacticalRecommendation: string;
  weaknesses: OpponentWeaknessPoint[];
}

export function resolveOpponentStandingsContext(params: {
  opponentClub: Club;
  userClub: Club;
  activeCompetition: CompetitionType;
  standings: StandingsRow[];
  secondaryStandings?: StandingsRow[];
  libertadores?: LibertadoresState;
}): { table: StandingsRow[]; label: string } {
  const {
    opponentClub,
    userClub,
    activeCompetition,
    standings,
    secondaryStandings,
    libertadores,
  } = params;

  if (activeCompetition === 'LIBERTADORES' && libertadores) {
    const oppGroup = libertadores.groups.find((g) =>
      g.clubIds.includes(opponentClub.id)
    );
    if (oppGroup) {
      return {
        table: oppGroup.standings,
        label: `Libertadores · Grupo ${oppGroup.name}`,
      };
    }
  }

  if (opponentClub.division === 'LIB' && libertadores) {
    const oppGroup = libertadores.groups.find((g) =>
      g.clubIds.includes(opponentClub.id)
    );
    if (oppGroup) {
      return {
        table: oppGroup.standings,
        label: `Libertadores · Grupo ${oppGroup.name}`,
      };
    }
  }

  if (
    opponentClub.division !== userClub.division &&
    secondaryStandings &&
    secondaryStandings.length > 0
  ) {
    return {
      table: secondaryStandings,
      label: `Brasileirão Série ${opponentClub.division}`,
    };
  }

  return {
    table: standings,
    label:
      opponentClub.division === 'B'
        ? 'Brasileirão Série B'
        : 'Brasileirão Série A',
  };
}

export function generateOpponentScoutingSummary(params: {
  opponentClub: Club;
  userClub: Club;
  opponentTable: StandingsRow[];
  tableLabel: string;
  userSquad: Player[];
  nextFixture?: RoundFixture;
  copaDoBrasil?: CopaDoBrasilState;
}): OpponentScoutReport {
  const {
    opponentClub,
    userClub,
    opponentTable,
    tableLabel,
    userSquad,
    nextFixture,
  } = params;

  const userRatings = calculateTeamTacticalRatings(
    userSquad,
    userClub.formation,
    userClub.instructions
  );

  const posIndex = opponentTable.findIndex((r) => r.clubId === opponentClub.id);
  const position = posIndex >= 0 ? posIndex + 1 : 1;
  const totalTeams = Math.max(1, opponentTable.length);
  const row: StandingsRow =
    posIndex >= 0
      ? opponentTable[posIndex]
      : {
          clubId: opponentClub.id,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDifference: 0,
          points: 0,
          form: [],
        };

  const isUserHome = nextFixture ? nextFixture.homeClubId === userClub.id : true;
  const playedRows = opponentTable.filter((r) => r.played > 0);
  const totalPlayedInTable = playedRows.reduce((s, r) => s + r.played, 0);
  const avgGF =
    totalPlayedInTable > 0
      ? playedRows.reduce((s, r) => s + r.goalsFor, 0) / totalPlayedInTable
      : 1.25;
  const avgGA =
    totalPlayedInTable > 0
      ? playedRows.reduce((s, r) => s + r.goalsAgainst, 0) / totalPlayedInTable
      : 1.25;

  const oppGFPerMatch = row.played > 0 ? row.goalsFor / row.played : 0;
  const oppGAPerMatch = row.played > 0 ? row.goalsAgainst / row.played : 0;

  // Defensive rank (1 = fewest goals conceded, totalTeams = most goals conceded)
  const sortedByMostConceded = [...opponentTable].sort(
    (a, b) => b.goalsAgainst - a.goalsAgainst
  );
  const mostConcededIndex = sortedByMostConceded.findIndex(
    (r) => r.clubId === opponentClub.id
  );
  const isLeakyDefenseRank =
    row.played > 0 && mostConcededIndex >= 0 && mostConcededIndex < Math.ceil(totalTeams * 0.4);

  const recentForm = row.form.slice(-3);
  const recentLosses = recentForm.filter((r) => r === 'D').length;
  const recentDraws = recentForm.filter((r) => r === 'E').length;
  const recentWins = recentForm.filter((r) => r === 'V').length;

  const weaknesses: OpponentWeaknessPoint[] = [];

  if (row.played > 0) {
    // 1. Defensive vulnerability from standings
    if (
      oppGAPerMatch >= Math.max(1.15, avgGA * 1.05) ||
      isLeakyDefenseRank ||
      row.goalDifference < 0
    ) {
      weaknesses.push({
        id: 'leaky-defense',
        title: 'Fragilidade defensiva na tabela',
        evidence: `${row.goalsAgainst} gol(s) sofrido(s) em ${row.played} jogo(s) (${oppGAPerMatch.toFixed(
          2
        )}/jogo) e saldo de ${
          row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference
        }.`,
        exploitationTip:
          opponentClub.instructions.defensiveLine === 'Alta'
            ? 'Aposte em passes verticais e velocidade pelas pontas nas costas da zaga.'
            : 'Pressione o bloco defensivo com mentalidade Ofensiva e infiltrações pelo meio.',
        severity: oppGAPerMatch >= 1.5 || row.goalDifference <= -3 ? 'alta' : 'media',
      });
    }

    // 2. Low scoring output / offensive drought
    if (oppGFPerMatch <= Math.min(1.0, avgGF * 0.9) || row.goalsFor < row.played) {
      weaknesses.push({
        id: 'low-attack',
        title: 'Baixa produção ofensiva',
        evidence: `Marcou apenas ${row.goalsFor} gol(s) em ${row.played} rodada(s) (${oppGFPerMatch.toFixed(
          2
        )}/jogo) na ${tableLabel}.`,
        exploitationTip:
          'Suba a linha de marcação e adote pressão intensa para neutralizar a criação adversária.',
        severity: oppGFPerMatch < 0.8 ? 'alta' : 'media',
      });
    }

    // 3. Recent form slump or lower-table pressure
    if (recentLosses >= 2 || (recentForm.length >= 2 && recentWins === 0)) {
      weaknesses.push({
        id: 'poor-form',
        title: 'Momento instável na sequência recente',
        evidence: `Soma ${recentWins}V-${recentDraws}E-${recentLosses}D nos últimos ${recentForm.length} jogos e ocupa o ${position}º lugar.`,
        exploitationTip:
          'Busque intensidade nos primeiros 20 minutos para ampliar o desgaste psicológico do rival.',
        severity: recentLosses >= 2 ? 'alta' : 'media',
      });
    }

    // 4. Lower half / relegation or group elimination pressure
    if (position >= Math.ceil(totalTeams * 0.65) && weaknesses.length < 3) {
      weaknesses.push({
        id: 'table-pressure',
        title: 'Pressão na parte inferior da classificação',
        evidence: `Em ${position}º de ${totalTeams} no(a) ${tableLabel} com ${row.points} ponto(s) (${row.lost} derrota(s)).`,
        exploitationTip:
          isUserHome
            ? 'Controle a posse em casa para forçar o adversário a se expor nos contra-ataques.'
            : 'Explore a impaciência do mandante bloqueando a saída curta.',
        severity: position > totalTeams - 4 ? 'alta' : 'media',
      });
    }
  }

  // Sector & tactical match-up weaknesses (used as complement or in Round 1 when played === 0)
  const minOppSector = Math.min(
    opponentClub.overallAttack,
    opponentClub.overallMidfield,
    opponentClub.overallDefense
  );

  if (weaknesses.length < 2) {
    if (
      opponentClub.overallDefense <= opponentClub.overallAttack ||
      userRatings.attack >= opponentClub.overallDefense + 2
    ) {
      weaknesses.push({
        id: 'sector-defense',
        title: 'Setor defensivo inferior ao seu ataque',
        evidence: `Defesa cotada em ${opponentClub.overallDefense} OVR contra ${Math.round(
          userRatings.attack
        )} OVR do seu setor ofensivo.`,
        exploitationTip:
          'Direcione jogadas pelos lados e explore finalizações dentro da área.',
        severity:
          userRatings.attack >= opponentClub.overallDefense + 5 ? 'alta' : 'media',
      });
    }
  }

  if (weaknesses.length < 2) {
    if (
      opponentClub.overallMidfield === minOppSector ||
      userRatings.midfield >= opponentClub.overallMidfield + 2
    ) {
      weaknesses.push({
        id: 'sector-midfield',
        title: 'Menor controle de meio-campo',
        evidence: `Meio-campo do ${opponentClub.shortName} (${opponentClub.overallMidfield} OVR) abaixo da média de criação (${Math.round(
          userRatings.midfield
        )} OVR seu).`,
        exploitationTip:
          'Use passe curto e apoiado para dominar a posse e vencer a segunda bola.',
        severity: 'media',
      });
    } else {
      weaknesses.push({
        id: 'tactical-style',
        title:
          opponentClub.instructions.defensiveLine === 'Alta'
            ? 'Exposição às costas da linha alta'
            : 'Tendência a recuar em bloco baixo',
        evidence: `O técnico rival utiliza esquema ${opponentClub.formation} com linha ${opponentClub.instructions.defensiveLine.toLowerCase()} e pressão ${opponentClub.instructions.pressingIntensity.toLowerCase()}.`,
        exploitationTip:
          opponentClub.instructions.defensiveLine === 'Alta'
            ? 'Priorize lançamentos rápidos para os pontas e atacantes em profundidade.'
            : 'Movimente a bola de lado a lado com paciência para abrir espaços na entrada da área.',
        severity: 'media',
      });
    }
  }

  if (weaknesses.length < 3 && row.played === 0) {
    weaknesses.push({
      id: 'opening-table-tier',
      title: `Projeção inicial na tabela (${position}º lugar)`,
      evidence: `${opponentClub.shortName} inicia em ${position}º na ${tableLabel} (0 jogos) sob mentalidade ${opponentClub.instructions.mentality}.`,
      exploitationTip:
        opponentClub.instructions.mentality === 'Ofensiva'
          ? 'Aproveite os espaços deixados na transição defensiva ao recuperar a bola.'
          : 'Mantenha ritmo alto desde o apito inicial para evitar jogo travado.',
      severity: 'media',
    });
  }

  const finalWeaknesses = weaknesses.slice(0, 3);

  const sgFormatted =
    row.goalDifference > 0 ? `+${row.goalDifference}` : `${row.goalDifference}`;
  const standingsBadge =
    row.played > 0
      ? `${position}º no(a) ${tableLabel} · ${row.points} pts · SG ${sgFormatted}`
      : `${position}º na tabela inicial (${tableLabel}) · 0 jogos`;

  let summary = '';
  if (row.played === 0) {
    summary = `Na abertura da ${tableLabel}, o ${opponentClub.shortName} aparece em ${position}º na tabela inicial com força ofensiva ${opponentClub.overallAttack} e defensiva ${opponentClub.overallDefense} (${opponentClub.formation}). Como ainda não há jogos disputados, o principal caminho é explorar o setor de ${
      opponentClub.overallDefense <= opponentClub.overallMidfield
        ? `defesa (${opponentClub.overallDefense} OVR)`
        : `meio-campo (${opponentClub.overallMidfield} OVR)`
    } diante da postura ${opponentClub.instructions.mentality.toLowerCase()} do adversário.`;
  } else {
    const formStr = recentForm.length > 0 ? recentForm.join('-') : 'sem sequência';
    summary = `Ocupando o ${position}º lugar no(a) ${tableLabel} com ${row.points} ponto(s) em ${row.played} jogo(s) (${row.won}V, ${row.drawn}E, ${row.lost}D; ${row.goalsFor} GP e ${row.goalsAgainst} GC, forma ${formStr}), o ${opponentClub.shortName} apresenta ${
      row.goalsAgainst > row.goalsFor
        ? 'vulnerabilidade no sistema defensivo'
        : oppGFPerMatch < 1.1
        ? 'baixa eficiência ofensiva'
        : 'oscilações entre ataque e recomposição'
    } que pode ser explorada ${isUserHome ? 'diante da sua torcida' : 'mesmo atuando fora de casa'}.`;
  }

  const tacticalRecommendation =
    finalWeaknesses[0]?.exploitationTip ||
    'Ajuste a prancheta tática para maximizar a superioridade nos duelos individuais.';

  return {
    opponentId: opponentClub.id,
    opponentName: opponentClub.shortName,
    tableLabel,
    position,
    totalTeams,
    played: row.played,
    points: row.points,
    won: row.won,
    drawn: row.drawn,
    lost: row.lost,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
    goalDifference: row.goalDifference,
    recentForm,
    standingsBadge,
    summary,
    tacticalRecommendation,
    weaknesses: finalWeaknesses,
  };
}
