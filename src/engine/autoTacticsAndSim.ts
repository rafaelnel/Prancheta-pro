import { FORMATIONS, TACTICAL_ROLES, getRoleById } from '../data/tacticsData';
import {
  SEASON_CALENDAR,
  advanceCopaDoBrasilStage,
  advanceLibertadoresGroupRound,
  advanceLibertadoresKnockoutStage,
  findUserFixtureForStep,
  getCupPrizeMoney,
} from '../data/cupFactory';
import {
  calculatePlayerOverall,
  calculateRoleSuitability,
  calculateTeamTacticalRatings,
  createInitialMatchState,
  simulateRoundFixtures,
  stepMatchMinute,
  updateStandingsWithRound,
} from './matchEngine';
import { generateSubstitutionSuggestions } from './substitutionAdvisor';
import { formatCalendarDate, formatCompactBRL } from '../utils/formatters';
import {
  calculateMatchGateRevenue,
  createInitialFinanceLedger,
  processMidSeasonEvolution,
} from './economyAndEvolution';
import { evolveYouthAcademyRoster } from './youthAcademyEngine';
import {
  createOfferInboxMessage,
  maybeGenerateIncomingOfferForUser,
  simulateAiTransferWindowTick,
} from './aiMarketEngine';
import { isTransferWindowOpen } from './transferEngine';
import { attributeAiRoundPlayerStats } from './seasonLifecycle';
import { createMatchHistoryRecordFromLiveMatch } from './headToHead';
import {
  Club,
  ClubFinanceLedger,
  CopaDoBrasilState,
  FormationType,
  InboxMessage,
  IncomingTransferOffer,
  LibertadoresState,
  LiveMatchState,
  MatchHistoryRecord,
  MentalityType,
  NaturalPosition,
  Player,
  RoundFixture,
  StandingsRow,
  TacticalDuty,
  TacticalRoleDefinition,
  TeamInstructions,
  TransferRecord,
  YouthAcademyState,
} from '../types/football';

export const SEASON_START_UTC = Date.UTC(2026, 0, 28); // 28 Jan 2026
export const MAX_SEASON_DAY_OFFSET = 337; // 31 Dez 2026

export function getSeasonStartUtc(seasonYear: number = 2026): number {
  return Date.UTC(seasonYear, 0, 28);
}

export function getMaxSeasonDayOffset(seasonYear: number = 2026): number {
  return Math.round(
    (Date.UTC(seasonYear, 11, 31) - getSeasonStartUtc(seasonYear)) / 86_400_000
  );
}

export function dayOffsetToDate(offset: number, seasonYear: number = 2026): Date {
  const utc = getSeasonStartUtc(seasonYear) + offset * 86_400_000;
  const d = new Date(utc);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function dayOffsetToIsoDate(
  offset: number,
  seasonYear: number = 2026
): string {
  const utc = getSeasonStartUtc(seasonYear) + offset * 86_400_000;
  const d = new Date(utc);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isoDateToDayOffset(
  iso: string,
  seasonYear: number = 2026
): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const targetUtc = Date.UTC(year, month, day);
  if (Number.isNaN(targetUtc)) return null;
  return Math.round((targetUtc - getSeasonStartUtc(seasonYear)) / 86_400_000);
}

export function addMonthsToDayOffset(
  currentOffset: number,
  months: number,
  seasonYear: number = 2026
): number {
  const startUtc = getSeasonStartUtc(seasonYear);
  const maxOffset = getMaxSeasonDayOffset(seasonYear);
  const curUtc = new Date(startUtc + currentOffset * 86_400_000);
  const targetYear = curUtc.getUTCFullYear();
  const targetMonth = curUtc.getUTCMonth() + months;
  const day = curUtc.getUTCDate();

  // Clamp day to end of target month (e.g. Jan 31 + 1m -> Feb 28/29)
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, lastDayOfTargetMonth);
  const targetUtc = Date.UTC(targetYear, targetMonth, clampedDay);
  const nextOffset = Math.round((targetUtc - startUtc) / 86_400_000);
  return Math.min(maxOffset, Math.max(currentOffset + 1, nextOffset));
}

export interface OptimalTacticsSelection {
  formation: FormationType;
  instructions: TeamInstructions;
  updatedSquad: Player[];
  projectedRatings: {
    attack: number;
    midfield: number;
    defense: number;
    synergy: number;
  };
  tacticalRationale: string;
}

function getSlotPositionCompatibilityScore(
  playerPos: NaturalPosition,
  playerSector: Player['sector'],
  slotLabel: NaturalPosition,
  slotSector: Player['sector']
): number {
  if (slotLabel === 'GOL' || playerPos === 'GOL') {
    return slotLabel === 'GOL' && playerPos === 'GOL' ? 14 : -80;
  }
  if (playerPos === slotLabel) return 11;

  // Symmetric flank compatibility
  if (
    (playerPos === 'LD' && slotLabel === 'LE') ||
    (playerPos === 'LE' && slotLabel === 'LD') ||
    (playerPos === 'PD' && slotLabel === 'PE') ||
    (playerPos === 'PE' && slotLabel === 'PD')
  ) {
    return 7.5;
  }

  // Natural hybrid mid/att wingers or midfielders
  if (
    (playerPos === 'MEI' && (slotLabel === 'PD' || slotLabel === 'PE' || slotLabel === 'MC')) ||
    ((playerPos === 'PD' || playerPos === 'PE') && (slotLabel === 'MEI' || slotLabel === 'ATA')) ||
    (playerPos === 'VOL' && slotLabel === 'MC') ||
    (playerPos === 'MC' && (slotLabel === 'VOL' || slotLabel === 'MEI'))
  ) {
    return 5.5;
  }

  if (playerSector === slotSector) return 4.5;

  // Adjacent sectors are playable with mild penalty
  if (
    (playerSector === 'DEF' && slotSector === 'MEI') ||
    (playerSector === 'MEI' && slotSector === 'DEF') ||
    (playerSector === 'MEI' && slotSector === 'ATA') ||
    (playerSector === 'ATA' && slotSector === 'MEI')
  ) {
    return -1.5;
  }

  return -12;
}

function pickBestRoleForPlayerAndSlot(
  player: Player,
  slotSector: Player['sector'],
  defaultRole: string,
  defaultDuty: TacticalDuty
): { role: TacticalRoleDefinition; duty: TacticalDuty; suitability: number } {
  const sectorRoles = TACTICAL_ROLES.filter((r) => r.sector === slotSector);
  let bestRole = getRoleById(defaultRole);
  let bestSuitability = calculateRoleSuitability(player, bestRole).score;

  for (const role of sectorRoles) {
    const suit = calculateRoleSuitability(player, role).score;
    if (suit > bestSuitability) {
      bestSuitability = suit;
      bestRole = role;
    }
  }

  const duty: TacticalDuty = bestRole.allowedDuties.includes(defaultDuty)
    ? defaultDuty
    : bestRole.allowedDuties[0];

  return { role: bestRole, duty, suitability: bestSuitability };
}

/**
 * Evaluates all 4 tactical formations against the available squad's attributes, positions,
 * and physical condition, and tunes collective team instructions for the specific opponent & venue.
 */
export function selectOptimalTacticsForMatch(params: {
  squad: Player[];
  userClub: Club;
  opponentClub: Club;
  isUserHome: boolean;
  isKnockout?: boolean;
}): OptimalTacticsSelection {
  const { squad, opponentClub, isUserHome, isKnockout = false } = params;
  const formations: FormationType[] = ['4-3-3', '4-2-3-1', '4-4-2', '3-5-2'];

  const opponentStrength =
    (opponentClub.overallAttack +
      opponentClub.overallMidfield +
      opponentClub.overallDefense) /
    3;

  // Priority order for filling formation slots (scarce specialized positions first)
  const slotFillPriority = (label: NaturalPosition): number => {
    if (label === 'GOL') return 0;
    if (label === 'LD' || label === 'LE') return 1;
    if (label === 'ATA') return 2;
    if (label === 'PD' || label === 'PE') return 3;
    if (label === 'ZAG') return 4;
    if (label === 'VOL' || label === 'MEI') return 5;
    return 6;
  };

  let bestOption: {
    score: number;
    formation: FormationType;
    instructions: TeamInstructions;
    updatedSquad: Player[];
    projectedRatings: OptimalTacticsSelection['projectedRatings'];
  } | null = null;

  const healthyPool = squad.filter((p) => !p.injured);
  const selectionPool = healthyPool.length >= 11 ? healthyPool : squad;

  for (const formation of formations) {
    const slots = FORMATIONS[formation];
    const orderedSlots = [...slots].sort(
      (a, b) => slotFillPriority(a.label) - slotFillPriority(b.label)
    );

    const chosenIds = new Set<string>();
    const assignments = new Map<
      string,
      { slotIndex: number; roleId: string; duty: TacticalDuty; suitability: number; fitBonus: number }
    >();

    for (const slot of orderedSlots) {
      const candidates = selectionPool
        .filter((p) => !chosenIds.has(p.id))
        .map((p) => {
          const ovr = calculatePlayerOverall(p.attributes, p.position);
          const fitBonus = getSlotPositionCompatibilityScore(
            p.position,
            p.sector,
            slot.label,
            slot.sector
          );
          const injuryPenalty = p.injured ? -55 : 0;
          // Encourage rotating heavily fatigued starters (<70%) if a fresh backup is available
          const condModifier =
            p.condition < 68
              ? -12 - (68 - p.condition) * 0.4
              : p.condition < 78
              ? (p.condition - 78) * 0.25
              : (p.condition - 78) * 0.14;
          const roleChoice = pickBestRoleForPlayerAndSlot(
            p,
            slot.sector,
            slot.defaultRole,
            slot.defaultDuty
          );
          const score =
            ovr +
            fitBonus +
            condModifier +
            injuryPenalty +
            (roleChoice.suitability - 70) * 0.12;
          return { p, score, fitBonus, roleChoice };
        })
        .sort((a, b) => b.score - a.score);

      const winner = candidates[0];
      if (winner) {
        chosenIds.add(winner.p.id);
        assignments.set(winner.p.id, {
          slotIndex: slot.slotIndex,
          roleId: winner.roleChoice.role.id,
          duty: winner.roleChoice.duty,
          suitability: winner.roleChoice.suitability,
          fitBonus: winner.fitBonus,
        });
      }
    }

    const candidateSquad = squad.map((p) => {
      const assigned = assignments.get(p.id);
      if (assigned) {
        return {
          ...p,
          isStarter: true,
          slotIndex: assigned.slotIndex,
          assignedRole: assigned.roleId,
          assignedDuty: assigned.duty,
        };
      }
      return {
        ...p,
        isStarter: false,
        slotIndex: null,
      };
    });

    const baseRatings = calculateTeamTacticalRatings(candidateSquad, formation, {
      mentality: 'Equilibrada',
      defensiveLine: 'Padrão',
      pressingIntensity: 'Moderada',
      passingStyle: 'Misto',
    });

    const userBaseStrength =
      (baseRatings.attack + baseRatings.midfield + baseRatings.defense) / 3;
    const venueBonus = isUserHome ? 2.4 : -1.8;
    const powerGap = userBaseStrength + venueBonus - opponentStrength;

    const starters = candidateSquad.filter((p) => p.isStarter);
    const avgCondition =
      starters.reduce((sum, p) => sum + p.condition, 0) / Math.max(1, starters.length);

    let mentality: MentalityType = 'Equilibrada';
    if (powerGap >= 3.5 || (isUserHome && powerGap >= 0.5)) {
      mentality = 'Ofensiva';
    } else if (powerGap <= -3.5 || (!isUserHome && isKnockout && powerGap < 0)) {
      mentality = 'Cautelosa';
    }

    const defensiveLine: TeamInstructions['defensiveLine'] =
      mentality === 'Ofensiva' && opponentClub.overallAttack <= baseRatings.defense + 2
        ? 'Alta'
        : mentality === 'Cautelosa'
        ? 'Baixa'
        : 'Padrão';

    const pressingIntensity: TeamInstructions['pressingIntensity'] =
      avgCondition < 74
        ? 'Contida'
        : mentality === 'Ofensiva' || opponentClub.overallMidfield <= baseRatings.midfield
        ? 'Extrema'
        : 'Moderada';

    const passingStyle: TeamInstructions['passingStyle'] =
      opponentClub.instructions.defensiveLine === 'Alta' || mentality === 'Cautelosa'
        ? 'Direto Vertical'
        : baseRatings.midfield >= opponentClub.overallMidfield
        ? 'Curto e Apoiado'
        : 'Misto';

    const instructions: TeamInstructions = {
      mentality,
      defensiveLine,
      pressingIntensity,
      passingStyle,
    };

    const projectedRatings = calculateTeamTacticalRatings(
      candidateSquad,
      formation,
      instructions
    );

    const avgFit =
      Array.from(assignments.values()).reduce((s, a) => s + a.fitBonus, 0) /
      Math.max(1, assignments.size);

    const compositeScore =
      (projectedRatings.attack + projectedRatings.midfield + projectedRatings.defense) / 3 +
      projectedRatings.synergy * 0.14 +
      avgFit * 0.45 +
      (avgCondition - 80) * 0.12;

    if (!bestOption || compositeScore > bestOption.score) {
      bestOption = {
        score: compositeScore,
        formation,
        instructions,
        updatedSquad: candidateSquad,
        projectedRatings,
      };
    }
  }

  const chosen = bestOption!;
  const tacticalRationale = `${chosen.formation} · ${chosen.instructions.mentality} (${
    isUserHome ? 'Mandante' : 'Visitante'
  } vs ${opponentClub.shortName} · ATQ ${chosen.projectedRatings.attack} / MEI ${
    chosen.projectedRatings.midfield
  } / DEF ${chosen.projectedRatings.defense})`;

  return {
    formation: chosen.formation,
    instructions: chosen.instructions,
    updatedSquad: chosen.updatedSquad,
    projectedRatings: chosen.projectedRatings,
    tacticalRationale,
  };
}

export interface AutoSimCareerSnapshot {
  clubs: Club[];
  userClubId: string;
  squad: Player[];
  aiSquads?: Record<string, Player[]>;
  standings: StandingsRow[];
  fixtures: RoundFixture[];
  secondaryStandings: StandingsRow[];
  secondaryFixtures: RoundFixture[];
  copaDoBrasil: CopaDoBrasilState;
  libertadores: LibertadoresState;
  messages: InboxMessage[];
  matchState: LiveMatchState;
  matchHistory?: MatchHistoryRecord[];
  seasonYear?: number;
  seasonStepIndex: number;
  currentRound: number;
  dayOffset: number;
  isMatchDay: boolean;
  transferredOutClubPlayerIds: string[];
  pendingOffers?: IncomingTransferOffer[];
  transferHistory?: TransferRecord[];
  financeLedger?: ClubFinanceLedger;
  youthAcademy?: YouthAcademyState;
  midSeasonEvolutionProcessedYear?: number;
}

export interface AutoSimMatchLogEntry {
  id: string;
  stepIndex: number;
  dateLabel: string;
  competitionLabel: string;
  homeClubId: string;
  awayClubId: string;
  homeClubName: string;
  awayClubName: string;
  homeGoals: number;
  awayGoals: number;
  homePenalties?: number | null;
  awayPenalties?: number | null;
  isUserHome: boolean;
  outcome: 'V' | 'E' | 'D' | 'BYE';
  chosenFormation: FormationType;
  chosenMentality: MentalityType;
  tacticalSummary: string;
  goalScorers: string[];
}

export function isSeasonCompleted(snapshot: AutoSimCareerSnapshot): boolean {
  const lastStep = SEASON_CALENDAR[SEASON_CALENDAR.length - 1];
  if (snapshot.seasonStepIndex < SEASON_CALENDAR.length - 1) {
    return false;
  }
  const finalFix = snapshot.fixtures.find(
    (f) => f.roundNumber === (lastStep.leagueRound || 38) && f.isUserMatch
  );
  return Boolean(finalFix?.played);
}

function isStepAlreadyPlayedForUser(
  stepIdx: number,
  snapshot: AutoSimCareerSnapshot
): boolean {
  const step = SEASON_CALENDAR[stepIdx];
  if (!step) return true;

  if (step.competition === 'BRASILEIRAO' && step.leagueRound) {
    const fix = snapshot.fixtures.find(
      (f) => f.roundNumber === step.leagueRound && f.isUserMatch
    );
    return Boolean(fix?.played);
  }

  if (step.competition === 'COPA_DO_BRASIL' && step.copaStage) {
    const list = snapshot.copaDoBrasil.fixturesByStage[step.copaStage] || [];
    if (list.length === 0) return false;
    return list.every((f) => f.played);
  }

  if (step.competition === 'LIBERTADORES') {
    if (step.libStage === 'Grupos' && step.libGroupRound) {
      return snapshot.libertadores.groups.every((g) =>
        g.fixtures
          .filter((f) => f.roundNumber === step.libGroupRound)
          .every((f) => f.played)
      );
    }
    if (step.libStage && step.libStage !== 'Grupos') {
      const list = snapshot.libertadores.knockoutFixtures[step.libStage] || [];
      if (list.length === 0) return false;
      return list.every((f) => f.played);
    }
  }

  return false;
}

function applySquadAutoSubstitutionInSim(
  match: LiveMatchState,
  squad: Player[],
  userClub: Club
): { match: LiveMatchState; squad: Player[] } {
  if (match.substitutionsMade >= match.maxSubstitutions) {
    return { match, squad };
  }

  const suggestions = generateSubstitutionSuggestions(squad, match);
  const top = suggestions[0];
  if (!top) return { match, squad };

  const shouldSub =
    top.starterLiveCondition <= 79 ||
    top.starterHasYellowCard ||
    (match.minute >= 66 && top.reserveCondition >= 82 && top.score >= 30);

  if (!shouldSub) {
    return { match, squad };
  }

  const starterOut = top.starterOut;
  const reserveIn = top.reserveIn;

  const updatedSquad = squad.map((p) => {
    if (p.id === starterOut.id) {
      return { ...p, isStarter: false, slotIndex: null };
    }
    if (p.id === reserveIn.id) {
      return {
        ...p,
        isStarter: true,
        slotIndex: starterOut.slotIndex,
        assignedRole: starterOut.assignedRole,
        assignedDuty: starterOut.assignedDuty,
      };
    }
    return p;
  });

  const role = getRoleById(reserveIn.assignedRole);
  const parts = reserveIn.name.split(' ');
  const shortName = parts[parts.length - 1];
  const reserveOvr = calculatePlayerOverall(reserveIn.attributes, reserveIn.position);

  const replaceToken = (tokens: typeof match.homeTokens) =>
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
          }
        : t
    );

  const subText = `${match.minute}' — Substituição automática (${userClub.shortName}): Sai ${starterOut.name} (${Math.round(
    top.starterLiveCondition
  )}%) e entra ${reserveIn.name}.`;

  const nextMatch: LiveMatchState = {
    ...match,
    substitutionsMade: match.substitutionsMade + 1,
    homeTokens: match.isUserHome ? replaceToken(match.homeTokens) : match.homeTokens,
    awayTokens: !match.isUserHome ? replaceToken(match.awayTokens) : match.awayTokens,
    lastActionLabel: subText,
    events: [
      {
        id: `evt-autosub-${match.minute}-${starterOut.id}`,
        minute: match.minute,
        type: 'SUBSTITUICAO',
        team: match.isUserHome ? 'HOME' : 'AWAY',
        text: subText,
      },
      ...match.events,
    ],
  };

  return { match: nextMatch, squad: updatedSquad };
}

/**
 * Simulates exactly ONE calendar step (a user match with AI-chosen formation & tactics,
 * or a CPU-only cup stage) up to `targetDayOffset`.
 * Returns `done: true` once no remaining calendar steps fall on or before `targetDayOffset`.
 */
export function simulateNextAutoStep(
  snapshot: AutoSimCareerSnapshot,
  targetDayOffset: number,
  rng: () => number = Math.random
): {
  done: boolean;
  snapshot: AutoSimCareerSnapshot;
  logEntry: AutoSimMatchLogEntry | null;
  newOffer?: IncomingTransferOffer | null;
} {
  let working = { ...snapshot };

  const seasonYear = working.seasonYear ?? 2026;

  // Find the next unplayed step index starting from working.seasonStepIndex
  let idx = working.seasonStepIndex;
  while (idx < SEASON_CALENDAR.length && isStepAlreadyPlayedForUser(idx, working)) {
    idx += 1;
  }

  if (idx >= SEASON_CALENDAR.length) {
    const restDays = Math.max(0, targetDayOffset - working.dayOffset);
    const restedSquad =
      restDays > 0
        ? working.squad.map((p) => ({
            ...p,
            condition: Math.min(99, p.condition + restDays * 4),
          }))
        : working.squad;

    return {
      done: true,
      snapshot: {
        ...working,
        seasonStepIndex: SEASON_CALENDAR.length - 1,
        dayOffset: Math.max(working.dayOffset, targetDayOffset),
        isMatchDay: false,
        squad: restedSquad,
      },
      logEntry: null,
      newOffer: null,
    };
  }

  const targetStep = SEASON_CALENDAR[idx];
  const stepDayOffset = targetStep.dayOffset ?? idx * 6;

  // If the next unplayed step is strictly after targetDayOffset, advance calendar to targetDayOffset & finish
  if (stepDayOffset > targetDayOffset) {
    const restDays = Math.max(0, targetDayOffset - working.dayOffset);
    const restedSquad =
      restDays > 0
        ? working.squad.map((p) => ({
            ...p,
            condition: Math.min(99, p.condition + restDays * 4),
          }))
        : working.squad;

    const nextLeagueRound = targetStep.leagueRound ?? working.currentRound;
    const nextFixture =
      findUserFixtureForStep(
        targetStep,
        working.userClubId,
        working.fixtures,
        working.copaDoBrasil,
        working.libertadores
      ) ||
      working.fixtures.find(
        (f) => f.roundNumber === nextLeagueRound && f.isUserMatch
      ) ||
      working.fixtures[0];

    const nextHome =
      working.clubs.find((c) => c.id === nextFixture.homeClubId) || working.clubs[0];
    const nextAway =
      working.clubs.find((c) => c.id === nextFixture.awayClubId) || working.clubs[1];

    const nextMatch =
      working.matchState.fixtureId === nextFixture.id &&
      working.matchState.phase === 'PRE_MATCH'
        ? working.matchState
        : createInitialMatchState(
            nextLeagueRound,
            nextFixture,
            nextHome,
            nextAway,
            restedSquad,
            working.userClubId,
            working.transferredOutClubPlayerIds,
            working.aiSquads
          );

    return {
      done: true,
      snapshot: {
        ...working,
        seasonStepIndex: idx,
        currentRound: nextLeagueRound,
        dayOffset: Math.max(working.dayOffset, targetDayOffset),
        isMatchDay: false,
        squad: restedSquad,
        matchState: nextMatch,
      },
      logEntry: null,
      newOffer: null,
    };
  }

  // Recover condition for days elapsed since current dayOffset up to this step
  const daysToStep = Math.max(0, stepDayOffset - working.dayOffset);
  let recoveredSquad =
    daysToStep > 0
      ? working.squad.map((p) => ({
          ...p,
          condition: Math.min(99, p.condition + daysToStep * 4),
        }))
      : [...working.squad];

  const userFixture = findUserFixtureForStep(
    targetStep,
    working.userClubId,
    working.fixtures,
    working.copaDoBrasil,
    working.libertadores
  );

  // Case A: CPU-only cup round (user eliminated or not participating)
  if (!userFixture) {
    let nextCdb = working.copaDoBrasil;
    let nextLib = working.libertadores;
    let nextAiSquads = working.aiSquads || {};

    if (targetStep.competition === 'COPA_DO_BRASIL' && targetStep.copaStage) {
      nextCdb = advanceCopaDoBrasilStage(
        working.copaDoBrasil,
        targetStep.copaStage,
        null,
        working.clubs,
        working.userClubId,
        rng
      );
      nextAiSquads = attributeAiRoundPlayerStats(
        nextAiSquads,
        nextCdb.fixturesByStage[targetStep.copaStage] || [],
        working.userClubId,
        rng
      );
    } else if (targetStep.competition === 'LIBERTADORES') {
      if (targetStep.libStage === 'Grupos' && targetStep.libGroupRound) {
        nextLib = advanceLibertadoresGroupRound(
          working.libertadores,
          targetStep.libGroupRound,
          null,
          working.clubs,
          working.userClubId,
          rng
        );
        const grpFixes = nextLib.groups.flatMap((g) =>
          g.fixtures.filter((f) => f.roundNumber === targetStep.libGroupRound)
        );
        nextAiSquads = attributeAiRoundPlayerStats(
          nextAiSquads,
          grpFixes,
          working.userClubId,
          rng
        );
      } else if (targetStep.libStage && targetStep.libStage !== 'Grupos') {
        nextLib = advanceLibertadoresKnockoutStage(
          working.libertadores,
          targetStep.libStage,
          null,
          working.clubs,
          working.userClubId,
          rng
        );
        nextAiSquads = attributeAiRoundPlayerStats(
          nextAiSquads,
          nextLib.knockoutFixtures[targetStep.libStage] || [],
          working.userClubId,
          rng
        );
      }
    }

    const userClub =
      working.clubs.find((c) => c.id === working.userClubId) || working.clubs[0];

    const nextIdx = Math.min(SEASON_CALENDAR.length - 1, idx + 1);
    const byeLog: AutoSimMatchLogEntry = {
      id: `autosim-bye-${idx}-${stepDayOffset}`,
      stepIndex: idx,
      dateLabel: formatCalendarDate(stepDayOffset, seasonYear),
      competitionLabel: targetStep.label,
      homeClubId: userClub.id,
      awayClubId: userClub.id,
      homeClubName: userClub.shortName,
      awayClubName: 'Rodada sem jogo do clube',
      homeGoals: 0,
      awayGoals: 0,
      isUserHome: true,
      outcome: 'BYE',
      chosenFormation: userClub.formation,
      chosenMentality: userClub.instructions.mentality,
      tacticalSummary: 'Sem compromisso do clube nesta fase (demais chaves simuladas).',
      goalScorers: [],
    };

    let byeClubs = working.clubs;
    let byeTransferHistory = working.transferHistory || [];
    let byePendingOffers = working.pendingOffers || [];
    let byeMessages = working.messages;
    let byeOffer: IncomingTransferOffer | null = null;

    if (isTransferWindowOpen(stepDayOffset)) {
      if (Object.keys(nextAiSquads).length > 0 && idx % 2 === 0) {
        const aiTick = simulateAiTransferWindowTick({
          clubs: byeClubs,
          aiSquads: nextAiSquads,
          userClubId: working.userClubId,
          dayOffset: stepDayOffset,
          seasonYear,
          maxDeals: 1,
          rng,
        });
        byeClubs = aiTick.updatedClubs;
        nextAiSquads = aiTick.updatedAiSquads;
        if (aiTick.newRecords.length > 0) {
          byeTransferHistory = [...aiTick.newRecords, ...byeTransferHistory].slice(0, 80);
        }
      }

      const hasListed = recoveredSquad.some(
        (p) => p.isTransferListed || p.isLoanListed
      );
      const shouldTryByeOffer = hasListed ? rng() < 0.72 : idx % 2 === 0 && rng() < 0.48;
      if (shouldTryByeOffer) {
        const latestClub =
          byeClubs.find((c) => c.id === working.userClubId) || userClub;
        const freshOffer = maybeGenerateIncomingOfferForUser({
          clubs: byeClubs,
          userClub: latestClub,
          userSquad: recoveredSquad,
          pendingOffers: byePendingOffers,
          dayOffset: stepDayOffset,
          seasonYear,
          aiSquads: nextAiSquads,
          rng,
        });
        if (freshOffer) {
          byeOffer = freshOffer;
          byePendingOffers = [freshOffer, ...byePendingOffers];
          byeMessages = [
            createOfferInboxMessage(freshOffer, latestClub),
            ...byeMessages,
          ].slice(0, 60);
        }
      }
    } else if (byePendingOffers.some((o) => o.status === 'PENDING')) {
      byePendingOffers = byePendingOffers.map((o) =>
        o.status === 'PENDING' ? { ...o, status: 'EXPIRED' } : o
      );
    }

    return {
      done: false,
      snapshot: {
        ...working,
        clubs: byeClubs,
        aiSquads: nextAiSquads,
        copaDoBrasil: nextCdb,
        libertadores: nextLib,
        squad: recoveredSquad,
        messages: byeMessages,
        pendingOffers: byePendingOffers,
        transferHistory: byeTransferHistory,
        seasonStepIndex: nextIdx,
        dayOffset: Math.max(working.dayOffset, stepDayOffset),
        isMatchDay: false,
      },
      logEntry: byeLog,
      newOffer: byeOffer,
    };
  }

  // Case B: User match! Auto-pick best formation, starting XI, roles, and team instructions
  const currentUserClub =
    working.clubs.find((c) => c.id === working.userClubId) || working.clubs[0];
  const isUserHome = userFixture.homeClubId === working.userClubId;
  const oppClubId = isUserHome ? userFixture.awayClubId : userFixture.homeClubId;
  const opponentClub =
    working.clubs.find((c) => c.id === oppClubId) || working.clubs[0];

  const isKnockout =
    targetStep.competition === 'COPA_DO_BRASIL' ||
    (targetStep.competition === 'LIBERTADORES' &&
      Boolean(targetStep.libStage && targetStep.libStage !== 'Grupos'));

  const tacticsChoice = selectOptimalTacticsForMatch({
    squad: recoveredSquad,
    userClub: currentUserClub,
    opponentClub,
    isUserHome,
    isKnockout,
  });

  recoveredSquad = tacticsChoice.updatedSquad;
  const updatedUserClubWithTactics: Club = {
    ...currentUserClub,
    formation: tacticsChoice.formation,
    instructions: tacticsChoice.instructions,
  };

  let nextClubs = working.clubs.map((c) =>
    c.id === working.userClubId ? updatedUserClubWithTactics : c
  );

  const homeClub = nextClubs.find((c) => c.id === userFixture.homeClubId) || nextClubs[0];
  const awayClub = nextClubs.find((c) => c.id === userFixture.awayClubId) || nextClubs[1];
  const roundNum = targetStep.leagueRound ?? userFixture.roundNumber;

  let simMatch = createInitialMatchState(
    roundNum,
    userFixture,
    homeClub,
    awayClub,
    recoveredSquad,
    working.userClubId,
    working.transferredOutClubPlayerIds,
    working.aiSquads
  );

  simMatch = { ...simMatch, phase: 'FIRST_HALF', isRunning: true };

  let guard = 0;
  let subDoneAt62 = false;
  let subDoneAt76 = false;

  while (simMatch.phase !== 'FULL_TIME' && guard < 120) {
    guard++;
    if (simMatch.phase === 'HALF_TIME') {
      const htSub = applySquadAutoSubstitutionInSim(
        simMatch,
        recoveredSquad,
        updatedUserClubWithTactics
      );
      simMatch = { ...htSub.match, phase: 'SECOND_HALF', isRunning: true };
      recoveredSquad = htSub.squad;
    }

    if (simMatch.minute >= 62 && !subDoneAt62) {
      subDoneAt62 = true;
      const subRes = applySquadAutoSubstitutionInSim(
        simMatch,
        recoveredSquad,
        updatedUserClubWithTactics
      );
      simMatch = subRes.match;
      recoveredSquad = subRes.squad;
    }

    if (simMatch.minute >= 76 && !subDoneAt76) {
      subDoneAt76 = true;
      const subRes = applySquadAutoSubstitutionInSim(
        simMatch,
        recoveredSquad,
        updatedUserClubWithTactics
      );
      simMatch = subRes.match;
      recoveredSquad = subRes.squad;
    }

    simMatch = stepMatchMinute(simMatch, homeClub, awayClub, recoveredSquad, rng);
  }

  // Apply match result to competitions, standings, finances, and stats
  const comp = simMatch.competition || targetStep.competition;
  const userGoals = isUserHome ? simMatch.homeGoals : simMatch.awayGoals;
  const oppGoals = isUserHome ? simMatch.awayGoals : simMatch.homeGoals;
  const userWon90 = userGoals > oppGoals;
  const userDrew90 = userGoals === oppGoals;
  const userAdvanced = simMatch.winnerClubId
    ? simMatch.winnerClubId === working.userClubId
    : userWon90;

  const userStandingRank =
    Math.max(1, working.standings.findIndex((s) => s.clubId === working.userClubId) + 1);
  const { gateRevenue, attendance } = calculateMatchGateRevenue({
    club: updatedUserClubWithTactics,
    rank: userStandingRank,
    totalTeams: working.standings.length || 20,
    competition: comp,
    stageLabel: targetStep.copaStage || targetStep.libStage,
    isHome: isUserHome,
  });

  let nextFixtures = working.fixtures;
  let nextStandings = working.standings;
  let nextSecondaryFixtures = working.secondaryFixtures;
  let nextSecondaryStandings = working.secondaryStandings;
  let nextCdb = working.copaDoBrasil;
  let nextLib = working.libertadores;
  let nextAiSquads = working.aiSquads || {};
  let prizeMoney = 0;

  const userMatchPayload = {
    fixtureId: simMatch.fixtureId,
    homeGoals: simMatch.homeGoals,
    awayGoals: simMatch.awayGoals,
    homeXG: simMatch.homeXG,
    awayXG: simMatch.awayXG,
    homePenalties: simMatch.homePenalties,
    awayPenalties: simMatch.awayPenalties,
    winnerClubId: simMatch.winnerClubId,
  };

  if (comp === 'COPA_DO_BRASIL' && targetStep.copaStage) {
    nextCdb = advanceCopaDoBrasilStage(
      working.copaDoBrasil,
      targetStep.copaStage,
      userMatchPayload,
      nextClubs,
      working.userClubId,
      rng
    );
    nextAiSquads = attributeAiRoundPlayerStats(
      nextAiSquads,
      nextCdb.fixturesByStage[targetStep.copaStage] || [],
      working.userClubId,
      rng
    );
    prizeMoney = getCupPrizeMoney(
      'COPA_DO_BRASIL',
      targetStep.copaStage,
      userAdvanced,
      targetStep.copaStage === 'Final' && userAdvanced
    );
  } else if (comp === 'LIBERTADORES') {
    if (targetStep.libStage === 'Grupos' && targetStep.libGroupRound) {
      nextLib = advanceLibertadoresGroupRound(
        working.libertadores,
        targetStep.libGroupRound,
        userMatchPayload,
        nextClubs,
        working.userClubId,
        rng
      );
      const grpFixes = nextLib.groups.flatMap((g) =>
        g.fixtures.filter((f) => f.roundNumber === targetStep.libGroupRound)
      );
      nextAiSquads = attributeAiRoundPlayerStats(
        nextAiSquads,
        grpFixes,
        working.userClubId,
        rng
      );
      prizeMoney = getCupPrizeMoney('LIBERTADORES', 'Grupo', userWon90, false);
    } else if (targetStep.libStage && targetStep.libStage !== 'Grupos') {
      nextLib = advanceLibertadoresKnockoutStage(
        working.libertadores,
        targetStep.libStage,
        userMatchPayload,
        nextClubs,
        working.userClubId,
        rng
      );
      nextAiSquads = attributeAiRoundPlayerStats(
        nextAiSquads,
        nextLib.knockoutFixtures[targetStep.libStage] || [],
        working.userClubId,
        rng
      );
      prizeMoney = getCupPrizeMoney(
        'LIBERTADORES',
        targetStep.libStage,
        userAdvanced,
        targetStep.libStage === 'Final' && userAdvanced
      );
    }
  } else {
    nextFixtures = simulateRoundFixtures(
      working.fixtures,
      roundNum,
      userMatchPayload,
      nextClubs,
      rng
    );
    const roundCompleted = nextFixtures.filter((f) => f.roundNumber === roundNum);
    nextStandings = updateStandingsWithRound(working.standings, roundCompleted);
    nextAiSquads = attributeAiRoundPlayerStats(
      nextAiSquads,
      roundCompleted,
      working.userClubId,
      rng
    );

    nextSecondaryFixtures = simulateRoundFixtures(
      working.secondaryFixtures,
      roundNum,
      {
        fixtureId: '__none__',
        homeGoals: 0,
        awayGoals: 0,
        homeXG: 0,
        awayXG: 0,
      },
      nextClubs,
      rng
    );
    const secCompleted = nextSecondaryFixtures.filter((f) => f.roundNumber === roundNum);
    nextSecondaryStandings = updateStandingsWithRound(
      working.secondaryStandings,
      secCompleted
    );
    nextAiSquads = attributeAiRoundPlayerStats(
      nextAiSquads,
      secCompleted,
      working.userClubId,
      rng
    );
  }

  // Monthly sponsorship installment & youth academy deduction if month boundary crossed
  const prevMonth = dayOffsetToDate(working.dayOffset, seasonYear).getMonth();
  const nextMonth = dayOffsetToDate(stepDayOffset, seasonYear).getMonth();
  const baseLedger =
    working.financeLedger ||
    createInitialFinanceLedger(updatedUserClubWithTactics, recoveredSquad, seasonYear);
  const monthsCrossed =
    nextMonth > prevMonth ? Math.max(1, nextMonth - prevMonth) : 0;
  const monthlySponsorInstallment =
    monthsCrossed > 0
      ? baseLedger.sponsorshipContract.monthlyInstallment * monthsCrossed
      : 0;
  const monthlyYouthSpend =
    monthsCrossed > 0 && working.youthAcademy
      ? working.youthAcademy.monthlyCost * monthsCrossed
      : 0;

  const isCupAdvance =
    (comp === 'COPA_DO_BRASIL' || comp === 'LIBERTADORES') && userAdvanced;
  const confidenceDelta = isCupAdvance
    ? 8
    : userAdvanced
    ? 4
    : userDrew90 && !simMatch.isKnockout
    ? 1
    : -4;
  const totalNetCashDelta =
    gateRevenue + prizeMoney + monthlySponsorInstallment - monthlyYouthSpend;

  nextClubs = nextClubs.map((c) =>
    c.id === working.userClubId
      ? {
          ...c,
          cashBalance: Math.max(0, c.cashBalance + totalNetCashDelta),
          boardConfidence: Math.min(100, Math.max(30, c.boardConfidence + confidenceDelta)),
        }
      : c
  );

  const nextLedger: ClubFinanceLedger = {
    ...baseLedger,
    seasonGateRevenue: baseLedger.seasonGateRevenue + gateRevenue,
    seasonPrizeRevenue: baseLedger.seasonPrizeRevenue + prizeMoney,
    seasonSponsorshipRevenue:
      baseLedger.seasonSponsorshipRevenue + monthlySponsorInstallment,
    seasonYouthAcademySpend:
      (baseLedger.seasonYouthAcademySpend || 0) + monthlyYouthSpend,
    lastMatchGateRevenue: isUserHome ? gateRevenue : baseLedger.lastMatchGateRevenue,
    lastMatchAttendance: isUserHome ? attendance : baseLedger.lastMatchAttendance,
  };

  let nextYouthAcademy: YouthAcademyState | undefined = working.youthAcademy
    ? {
        ...working.youthAcademy,
        accumulatedSeasonInvestment:
          working.youthAcademy.accumulatedSeasonInvestment + monthlyYouthSpend,
        monthsInvestedThisSeason: Math.min(
          12,
          working.youthAcademy.monthsInvestedThisSeason + monthsCrossed
        ),
      }
    : undefined;

  // Update player condition & detailed season stats (matches, goals, assists, cards, avgRating)
  const userTokens = isUserHome ? simMatch.homeTokens : simMatch.awayTokens;
  const tokenMap = new Map(userTokens.map((t) => [t.id, t]));
  const userTeamTag = isUserHome ? 'HOME' : 'AWAY';
  const userGoalEvents = simMatch.events.filter(
    (e) => e.type === 'GOL' && e.team === userTeamTag
  );
  const userYellowEvents = simMatch.events.filter(
    (e) => e.type === 'CARTAO_AMARELO' && e.team === userTeamTag
  );

  const squadAfterStats = recoveredSquad.map((p) => {
    const tok = tokenMap.get(p.id);
    if (!tok) return p;

    const scoredCount = userGoalEvents.filter((e) => e.scorerName === p.name).length;
    const assistCount = userGoalEvents.filter(
      (e) => e.assistName === p.name && e.scorerName !== p.name
    ).length;
    const ycCount = userYellowEvents.filter((e) => e.text.includes(p.name)).length;

    const prevMatches = p.seasonStats.matches;
    const newMatches = prevMatches + 1;
    const nextAvgRating = Number(
      ((p.seasonStats.avgRating * prevMatches + tok.rating) / newMatches).toFixed(2)
    );

    const finalCond = isCupAdvance
      ? Math.min(100, Math.round(tok.condition) + 8)
      : Math.max(55, Math.round(tok.condition));
    const finalMorale = isCupAdvance
      ? (p.morale === 'Exuberante' ? 'Exuberante' : 'Muito Alta')
      : p.morale;

    return {
      ...p,
      morale: finalMorale as Player['morale'],
      condition: finalCond,
      seasonStats: {
        matches: newMatches,
        goals: p.seasonStats.goals + scoredCount,
        assists: p.seasonStats.assists + assistCount,
        yellowCards: p.seasonStats.yellowCards + ycCount,
        avgRating: nextAvgRating,
      },
    };
  });

  // Mid-season evolution check around July 1st (dayOffset >= 154)
  let finalSquadAfterMatch = squadAfterStats;
  let midSeasonProcessedYear = working.midSeasonEvolutionProcessedYear;
  let extraMsgs: InboxMessage[] = [];

  if (stepDayOffset >= 154 && midSeasonProcessedYear !== seasonYear) {
    const midRes = processMidSeasonEvolution({
      clubs: nextClubs,
      userClubId: working.userClubId,
      userSquad: squadAfterStats,
      aiSquads: nextAiSquads,
      loanedOutPlayers: [],
      currentYear: seasonYear,
      rng,
    });
    nextClubs = midRes.updatedClubs;
    finalSquadAfterMatch = midRes.updatedUserSquad;
    nextAiSquads = midRes.updatedAiSquads;
    if (nextYouthAcademy) {
      const evolvedClub =
        nextClubs.find((c) => c.id === working.userClubId) || updatedUserClubWithTactics;
      const youthMidRes = evolveYouthAcademyRoster({
        academy: nextYouthAcademy,
        clubReputation: evolvedClub.reputation,
        division: evolvedClub.division === 'B' ? 'B' : 'A',
        phase: 'MID_SEASON',
        rng,
      });
      nextYouthAcademy = youthMidRes.updatedAcademy;
    }
    midSeasonProcessedYear = seasonYear;
    extraMsgs.push(midRes.inboxMessage);
  }

  // Periodic AI Transfer Market activity & incoming user offers during auto-sim (ONLY while transfer window is open)
  let nextTransferHistory = working.transferHistory || [];
  let nextPendingOffers = working.pendingOffers || [];
  let generatedOffer: IncomingTransferOffer | null = null;

  if (isTransferWindowOpen(stepDayOffset)) {
    if (Object.keys(nextAiSquads).length > 0 && idx % 2 === 0) {
      const aiTick = simulateAiTransferWindowTick({
        clubs: nextClubs,
        aiSquads: nextAiSquads,
        userClubId: working.userClubId,
        dayOffset: stepDayOffset,
        seasonYear,
        maxDeals: 1,
        rng,
      });
      nextClubs = aiTick.updatedClubs;
      nextAiSquads = aiTick.updatedAiSquads;
      if (aiTick.newRecords.length > 0) {
        nextTransferHistory = [...aiTick.newRecords, ...nextTransferHistory].slice(0, 80);
      }
    }

    const hasListedPlayers = finalSquadAfterMatch.some(
      (p) => p.isTransferListed || p.isLoanListed
    );
    const shouldTryOffer = hasListedPlayers
      ? rng() < 0.78
      : idx % 2 === 0 && rng() < 0.55;

    if (shouldTryOffer) {
      const latestUserClub =
        nextClubs.find((c) => c.id === working.userClubId) || updatedUserClubWithTactics;
      const newOffer = maybeGenerateIncomingOfferForUser({
        clubs: nextClubs,
        userClub: latestUserClub,
        userSquad: finalSquadAfterMatch,
        pendingOffers: nextPendingOffers,
        dayOffset: stepDayOffset,
        seasonYear,
        aiSquads: nextAiSquads,
        rng,
      });
      if (newOffer) {
        generatedOffer = newOffer;
        nextPendingOffers = [newOffer, ...nextPendingOffers];
        extraMsgs = [createOfferInboxMessage(newOffer, latestUserClub)];
      }
    }
  } else if (nextPendingOffers.some((o) => o.status === 'PENDING')) {
    // Janela fechada: expira propostas pendentes anteriores
    nextPendingOffers = nextPendingOffers.map((o) =>
      o.status === 'PENDING' ? { ...o, status: 'EXPIRED' } : o
    );
  }

  const outcome: 'V' | 'E' | 'D' = userAdvanced
    ? 'V'
    : userDrew90 && !simMatch.isKnockout
    ? 'E'
    : 'D';

  const dateLabel = formatCalendarDate(stepDayOffset, seasonYear);
  const penDetail =
    simMatch.homePenalties !== null &&
    simMatch.homePenalties !== undefined &&
    simMatch.awayPenalties !== null &&
    simMatch.awayPenalties !== undefined
      ? ` (Pên. ${simMatch.homePenalties}x${simMatch.awayPenalties})`
      : '';

  const goalScorers = simMatch.events
    .filter((e) => e.type === 'GOL' && e.scorerName)
    .reverse()
    .map((e) => `${e.scorerName} (${e.minute}')`);

  const postMsg: InboxMessage = {
    id: `msg-autosim-${idx}-${stepDayOffset}-${Math.round(rng() * 10000)}`,
    date: `${dateLabel} · Sim. Auto`,
    sender: 'Comissão Técnica (IA)',
    senderRole: 'Simulação Automática',
    subject: `[${outcome}] ${homeClub.shortName} ${simMatch.homeGoals} x ${simMatch.awayGoals} ${awayClub.shortName} · ${targetStep.label}`,
    category: 'Pós-Jogo',
    priority: outcome === 'V' ? 'positive' : outcome === 'E' ? 'normal' : 'warning',
    read: false,
    body: [
      `Partida simulada automaticamente em ${tacticsChoice.tacticalRationale}. Placar: ${homeClub.shortName} ${simMatch.homeGoals} x ${simMatch.awayGoals} ${awayClub.shortName}${penDetail}.`,
      isUserHome
        ? `Bilheteria (${attendance.toLocaleString('pt-BR')} pagantes): ${formatCompactBRL(gateRevenue)}${prizeMoney > 0 ? ` · Premiação: ${formatCompactBRL(prizeMoney)}` : ''}.`
        : `Jogo como visitante${prizeMoney > 0 ? ` · Premiação: ${formatCompactBRL(prizeMoney)}` : ' · Sem renda de bilheteria (mando adversário)'}.`,
    ],
    actionLabel: 'Ver Competições',
    actionTargetTab: 'competitions',
  };

  const nextMessages = [...extraMsgs, postMsg, ...working.messages].slice(0, 60);
  const processedMatch: LiveMatchState = { ...simMatch, roundProcessed: true };

  // Advance pointer to next step if any remain, otherwise keep at final step with roundProcessed = true
  const hasNextStep = idx < SEASON_CALENDAR.length - 1;
  const nextStepIdx = hasNextStep ? idx + 1 : idx;
  const nextStepObj = SEASON_CALENDAR[nextStepIdx];
  const nextRound = nextStepObj.leagueRound ?? roundNum;

  let nextPreMatchState = processedMatch;
  if (hasNextStep) {
    const nextFix =
      findUserFixtureForStep(
        nextStepObj,
        working.userClubId,
        nextFixtures,
        nextCdb,
        nextLib
      ) ||
      nextFixtures.find((f) => f.roundNumber === nextRound && f.isUserMatch) ||
      nextFixtures[0];

    const nh = nextClubs.find((c) => c.id === nextFix.homeClubId) || nextClubs[0];
    const na = nextClubs.find((c) => c.id === nextFix.awayClubId) || nextClubs[1];

    nextPreMatchState = createInitialMatchState(
      nextRound,
      nextFix,
      nh,
      na,
      finalSquadAfterMatch,
      working.userClubId,
      working.transferredOutClubPlayerIds,
      nextAiSquads
    );
  }

  const logEntry: AutoSimMatchLogEntry = {
    id: `autosim-${idx}-${stepDayOffset}`,
    stepIndex: idx,
    dateLabel,
    competitionLabel: targetStep.label,
    homeClubId: homeClub.id,
    awayClubId: awayClub.id,
    homeClubName: homeClub.shortName,
    awayClubName: awayClub.shortName,
    homeGoals: simMatch.homeGoals,
    awayGoals: simMatch.awayGoals,
    homePenalties: simMatch.homePenalties,
    awayPenalties: simMatch.awayPenalties,
    isUserHome,
    outcome,
    chosenFormation: tacticsChoice.formation,
    chosenMentality: tacticsChoice.instructions.mentality,
    tacticalSummary: tacticsChoice.tacticalRationale,
    goalScorers,
  };

  const newHistoryRecord = createMatchHistoryRecordFromLiveMatch({
    match: processedMatch,
    seasonYear,
    dateLabel,
    fallbackDivision: updatedUserClubWithTactics.division === 'B' ? 'B' : 'A',
  });
  const nextMatchHistory = [
    newHistoryRecord,
    ...(working.matchHistory || []).filter((m) => m.id !== newHistoryRecord.id),
  ];

  return {
    done: false,
    snapshot: {
      ...working,
      clubs: nextClubs,
      squad: finalSquadAfterMatch,
      aiSquads: nextAiSquads,
      standings: nextStandings,
      fixtures: nextFixtures,
      secondaryStandings: nextSecondaryStandings,
      secondaryFixtures: nextSecondaryFixtures,
      copaDoBrasil: nextCdb,
      libertadores: nextLib,
      messages: nextMessages,
      matchState: nextPreMatchState,
      matchHistory: nextMatchHistory,
      seasonYear,
      seasonStepIndex: nextStepIdx,
      currentRound: nextRound,
      dayOffset: Math.max(working.dayOffset, stepDayOffset),
      isMatchDay: false,
      pendingOffers: nextPendingOffers,
      transferHistory: nextTransferHistory,
      financeLedger: nextLedger,
      youthAcademy: nextYouthAcademy,
      midSeasonEvolutionProcessedYear: midSeasonProcessedYear,
    },
    logEntry,
    newOffer: generatedOffer,
  };
}

/**
 * Counts how many scheduled calendar steps (including cup steps) fall between
 * the current state and `targetDayOffset`.
 */
export function countStepsUntilDayOffset(
  snapshot: AutoSimCareerSnapshot,
  targetDayOffset: number
): { totalSteps: number; userMatchSteps: number } {
  let totalSteps = 0;
  let userMatchSteps = 0;

  for (let idx = snapshot.seasonStepIndex; idx < SEASON_CALENDAR.length; idx++) {
    const step = SEASON_CALENDAR[idx];
    const stepDay = step.dayOffset ?? idx * 9;
    if (stepDay > targetDayOffset) break;
    if (isStepAlreadyPlayedForUser(idx, snapshot)) continue;

    totalSteps += 1;
    const fix = findUserFixtureForStep(
      step,
      snapshot.userClubId,
      snapshot.fixtures,
      snapshot.copaDoBrasil,
      snapshot.libertadores
    );
    if (fix) {
      userMatchSteps += 1;
    }
  }

  return { totalSteps, userMatchSteps };
}
