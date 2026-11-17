import { FORMATIONS, getRoleById } from '../data/tacticsData';
import { USER_CLUB_ID } from '../data/initialDatabase';
import {
  Club,
  FormationType,
  LiveMatchState,
  MatchEvent,
  MatchPhase,
  NaturalPosition,
  PitchTokenState,
  Player,
  PlayerAttributes,
  RoundFixture,
  StandingsRow,
  TacticalRoleDefinition,
  TeamInstructions,
} from '../types/football';

/**
 * Calculates a player's overall rating (1.0 to 20.0) weighted by their natural position.
 */
export function calculatePlayerOverall(
  attr: PlayerAttributes,
  position: NaturalPosition
): number {
  let weights: Partial<Record<keyof PlayerAttributes, number>> = {};

  switch (position) {
    case 'GOL':
      weights = {
        posicionamento: 3,
        agilidade: 3,
        impulsao: 2.5,
        compostura: 2,
        decisoes: 2,
        passe: 1.5,
        forca: 1.5,
      };
      break;
    case 'ZAG':
      weights = {
        desarme: 3,
        posicionamento: 3,
        forca: 2.5,
        impulsao: 2.5,
        decisoes: 2,
        compostura: 1.5,
        passe: 1.5,
        velocidade: 1,
      };
      break;
    case 'LD':
    case 'LE':
      weights = {
        velocidade: 2.5,
        aceleracao: 2,
        resistencia: 2.5,
        cruzamento: 2.5,
        desarme: 2,
        posicionamento: 1.5,
        indiceDeTrabalho: 2,
        passe: 1.5,
        drible: 1.5,
      };
      break;
    case 'VOL':
      weights = {
        desarme: 3,
        posicionamento: 3,
        indiceDeTrabalho: 2.5,
        resistencia: 2,
        passe: 2,
        decisoes: 2,
        forca: 1.5,
        compostura: 1.5,
      };
      break;
    case 'MC':
      weights = {
        passe: 3,
        visaoDeJogo: 2.5,
        primeiroToque: 2,
        decisoes: 2,
        resistencia: 2,
        indiceDeTrabalho: 2,
        compostura: 1.5,
        desarme: 1.5,
        semBola: 1.5,
      };
      break;
    case 'MEI':
      weights = {
        passe: 3,
        visaoDeJogo: 3,
        primeiroToque: 2.5,
        drible: 2.5,
        decisoes: 2,
        semBola: 2,
        agilidade: 1.5,
        finalizacao: 1.5,
      };
      break;
    case 'PD':
    case 'PE':
      weights = {
        velocidade: 2.5,
        aceleracao: 2.5,
        drible: 3,
        agilidade: 2,
        primeiroToque: 2,
        semBola: 2,
        finalizacao: 1.5,
        cruzamento: 2,
        passe: 1.5,
      };
      break;
    case 'ATA':
      weights = {
        finalizacao: 3.5,
        semBola: 3,
        compostura: 2.5,
        primeiroToque: 2,
        decisoes: 1.5,
        aceleracao: 1.5,
        forca: 1.5,
        impulsao: 1.5,
      };
      break;
  }

  let totalWeight = 0;
  let weightedSum = 0;

  for (const [key, weight] of Object.entries(weights)) {
    const val = attr[key as keyof PlayerAttributes] ?? 10;
    weightedSum += val * (weight ?? 1);
    totalWeight += weight ?? 1;
  }

  if (totalWeight === 0) return 12.0;
  return Number((weightedSum / totalWeight).toFixed(1));
}

/**
 * Calculates how well a player fits a specific Tactical Role (0 to 100%).
 */
export function calculateRoleSuitability(
  player: Player,
  role: TacticalRoleDefinition
): { score: number; avgAttribute: number } {
  let sum = 0;
  let weightSum = 0;

  for (const key of role.keyAttributes) {
    sum += player.attributes[key] * 2.2;
    weightSum += 2.2;
  }

  for (const key of role.secondaryAttributes) {
    sum += player.attributes[key] * 1.0;
    weightSum += 1.0;
  }

  const avgAttr = weightSum > 0 ? sum / weightSum : 12;
  // Penalty if player's natural sector differs from role sector
  const sectorPenalty = player.sector === role.sector ? 0 : 12;
  const rawPct = Math.min(100, Math.max(35, Math.round((avgAttr / 17.5) * 100) - sectorPenalty));

  return {
    score: rawPct,
    avgAttribute: Number(avgAttr.toFixed(1)),
  };
}

/**
 * Computes collective Attack, Midfield, Defense, and Synergy ratings for the user's squad.
 */
export function calculateTeamTacticalRatings(
  squad: Player[],
  formation: FormationType,
  instructions: TeamInstructions
): {
  attack: number;
  midfield: number;
  defense: number;
  synergy: number;
} {
  const starters = squad.filter((p) => p.isStarter);
  if (starters.length === 0) {
    return { attack: 14, midfield: 14, defense: 14, synergy: 75 };
  }

  const defPlayers = starters.filter((p) => p.sector === 'DEF' || p.sector === 'GOL');
  const midPlayers = starters.filter((p) => p.sector === 'MEI');
  const attPlayers = starters.filter((p) => p.sector === 'ATA');

  const avgSectorRating = (players: Player[]) => {
    if (players.length === 0) return 14.0;
    const total = players.reduce((acc, p) => {
      const base = calculatePlayerOverall(p.attributes, p.position);
      const condFactor = 0.75 + (p.condition / 100) * 0.25;
      const dutyBonus =
        p.assignedDuty === 'Atacar' && p.sector === 'ATA'
          ? 0.3
          : p.assignedDuty === 'Defender' && p.sector === 'DEF'
          ? 0.3
          : 0.15;
      return acc + base * condFactor + dutyBonus;
    }, 0);
    return total / players.length;
  };

  let attack = avgSectorRating(attPlayers);
  let midfield = avgSectorRating(midPlayers);
  let defense = avgSectorRating(defPlayers);

  // Apply Collective Instructions modifiers
  if (instructions.mentality === 'Ofensiva') {
    attack += 0.6;
    midfield += 0.2;
    defense -= 0.4;
  } else if (instructions.mentality === 'Cautelosa') {
    defense += 0.6;
    midfield += 0.1;
    attack -= 0.4;
  }

  if (instructions.defensiveLine === 'Alta') {
    midfield += 0.3;
    defense -= 0.15;
  } else if (instructions.defensiveLine === 'Baixa') {
    defense += 0.3;
    attack -= 0.2;
  }

  if (instructions.pressingIntensity === 'Extrema') {
    midfield += 0.35;
    attack += 0.2;
  }

  const suitabilityTotal = starters.reduce((acc, p) => {
    const role = getRoleById(p.assignedRole);
    return acc + calculateRoleSuitability(p, role).score;
  }, 0);

  const synergy = Math.min(
    99,
    Math.max(50, Math.round(suitabilityTotal / starters.length))
  );

  return {
    attack: Number(Math.min(19.5, Math.max(10, attack)).toFixed(1)),
    midfield: Number(Math.min(19.5, Math.max(10, midfield)).toFixed(1)),
    defense: Number(Math.min(19.5, Math.max(10, defense)).toFixed(1)),
    synergy,
  };
}

const OPPONENT_DEFAULT_NAMES: Record<number, { name: string; pos: NaturalPosition; sector: 'GOL' | 'DEF' | 'MEI' | 'ATA' }> = {
  0: { name: 'Rossi', pos: 'GOL', sector: 'GOL' },
  1: { name: 'Wesley', pos: 'LD', sector: 'DEF' },
  2: { name: 'Léo Ortiz', pos: 'ZAG', sector: 'DEF' },
  3: { name: 'Léo Pereira', pos: 'ZAG', sector: 'DEF' },
  4: { name: 'Ayrton Lucas', pos: 'LE', sector: 'DEF' },
  5: { name: 'Pulgar', pos: 'VOL', sector: 'MEI' },
  6: { name: 'Gerson', pos: 'MC', sector: 'MEI' },
  7: { name: 'De La Cruz', pos: 'MEI', sector: 'MEI' },
  8: { name: 'Luiz Araújo', pos: 'PD', sector: 'ATA' },
  9: { name: 'Bruno Henrique', pos: 'PE', sector: 'ATA' },
  10: { name: 'Pedro Silva', pos: 'ATA', sector: 'ATA' },
};

export function buildPitchTokens(
  homeClub: Club,
  awayClub: Club,
  userSquad: Player[],
  isUserHome: boolean
): { homeTokens: PitchTokenState[]; awayTokens: PitchTokenState[] } {
  const homeFormationSlots = FORMATIONS[homeClub.formation] || FORMATIONS['4-3-3'];
  const awayFormationSlots = FORMATIONS[awayClub.formation] || FORMATIONS['4-2-3-1'];

  const starters = [...userSquad]
    .filter((p) => p.isStarter)
    .sort((a, b) => (a.slotIndex ?? 0) - (b.slotIndex ?? 0));

  const buildSideTokens = (
    team: 'HOME' | 'AWAY',
    isUserTeam: boolean,
    slots: typeof homeFormationSlots,
    club: Club
  ): PitchTokenState[] => {
    return slots.map((slot, idx) => {
      // Home attacks from Left (x: 6..48) to Right (x: 52..94)
      // Base coordinates when ball is at midfield
      const rawX = slot.x * 0.52 + 4; // maps 8..86 -> ~8..49
      const baseX = team === 'HOME' ? rawX : 100 - rawX;
      const baseY = team === 'HOME' ? slot.y : 100 - slot.y;

      if (isUserTeam && starters[idx]) {
        const p = starters[idx];
        const role = getRoleById(p.assignedRole);
        const parts = p.name.split(' ');
        const shortName = parts.length > 1 ? parts[parts.length - 1] : p.name;
        return {
          id: p.id,
          number: p.number,
          name: p.name,
          shortName,
          team,
          sector: p.sector,
          baseX,
          baseY,
          x: baseX,
          y: baseY,
          hasBall: team === 'HOME' && idx === 5,
          roleCode: role.shortCode,
          condition: p.condition,
          rating: 6.8,
        };
      } else {
        const starMatch = club.starPlayers[idx % Math.max(1, club.starPlayers.length)];
        const fallback = OPPONENT_DEFAULT_NAMES[idx] || {
          name: `Jogador ${idx + 1}`,
          pos: slot.label,
          sector: slot.sector,
        };
        const displayName =
          idx >= 7 && starMatch ? starMatch.name : fallback.name;
        const parts = displayName.split(' ');
        const shortName = parts[parts.length - 1];
        const jerseyNumbers = [1, 2, 3, 4, 6, 5, 8, 10, 7, 11, 9];
        return {
          id: `${club.id}-p${idx + 1}`,
          number: jerseyNumbers[idx] || idx + 1,
          name: displayName,
          shortName,
          team,
          sector: slot.sector,
          baseX,
          baseY,
          x: baseX,
          y: baseY,
          hasBall: false,
          roleCode: slot.label,
          condition: 94,
          rating: 6.8,
        };
      }
    });
  };

  const homeTokens = buildSideTokens('HOME', isUserHome, homeFormationSlots, homeClub);
  const awayTokens = buildSideTokens('AWAY', !isUserHome, awayFormationSlots, awayClub);

  return { homeTokens, awayTokens };
}

export function createInitialMatchState(
  roundNumber: number,
  fixture: RoundFixture,
  homeClub: Club,
  awayClub: Club,
  userSquad: Player[]
): LiveMatchState {
  const isUserHome = fixture.homeClubId === USER_CLUB_ID;
  const { homeTokens, awayTokens } = buildPitchTokens(
    homeClub,
    awayClub,
    userSquad,
    isUserHome
  );

  const initialCarrier = homeTokens[5] || homeTokens[0];

  return {
    roundNumber,
    fixtureId: fixture.id,
    minute: 0,
    subTick: 0,
    isRunning: false,
    speed: 1,
    phase: 'PRE_MATCH',
    homeClubId: homeClub.id,
    awayClubId: awayClub.id,
    isUserHome,
    homeGoals: 0,
    awayGoals: 0,
    homePossessionTicks: 1,
    awayPossessionTicks: 1,
    homeShots: 0,
    awayShots: 0,
    homeShotsOnTarget: 0,
    awayShotsOnTarget: 0,
    homeXG: 0,
    awayXG: 0,
    homeCorners: 0,
    awayCorners: 0,
    homePasses: 0,
    awayPasses: 0,
    homeFouls: 0,
    awayFouls: 0,
    ballX: 50,
    ballY: 50,
    ballTargetX: 50,
    ballTargetY: 50,
    ballCarrierTeam: 'HOME',
    ballCarrierNumber: initialCarrier.number,
    ballCarrierName: initialCarrier.name,
    activeZone: 'MIDFIELD',
    lastActionLabel: 'Equipes perfiladas no gramado aguardando o apito inicial.',
    events: [
      {
        id: 'evt-pre',
        minute: 0,
        type: 'INICIO',
        team: 'NEUTRAL',
        text: `Tudo pronto no ${homeClub.stadium}! ${homeClub.name} e ${awayClub.name} perfilados para a ${roundNumber}ª Rodada da Liga Nacional.`,
      },
    ],
    homeTokens,
    awayTokens,
    substitutionsMade: 0,
    maxSubstitutions: 5,
    roundProcessed: false,
  };
}

/**
 * Advances the live match by 1 minute with coherent 2D spatial token movement,
 * tactical possession calculation, xG accumulation, and play-by-play events.
 */
export function stepMatchMinute(
  state: LiveMatchState,
  homeClub: Club,
  awayClub: Club,
  userSquad: Player[],
  rng: () => number = Math.random
): LiveMatchState {
  if (state.phase === 'FULL_TIME') {
    return { ...state, isRunning: false };
  }

  const nextMinute = state.minute + 1;

  // Handle Half-Time transition at minute 45
  if (state.minute === 45 && state.phase === 'FIRST_HALF') {
    return {
      ...state,
      phase: 'HALF_TIME',
      isRunning: false,
      ballX: 50,
      ballY: 50,
      activeZone: 'MIDFIELD',
      lastActionLabel: 'Intervalo de jogo! O árbitro encerra o primeiro tempo.',
      events: [
        {
          id: `evt-ht-${nextMinute}`,
          minute: 45,
          type: 'INTERVALO',
          team: 'NEUTRAL',
          text: `45' — Fim do 1º Tempo: ${homeClub.shortName} ${state.homeGoals} x ${state.awayGoals} ${awayClub.shortName}. Momento para ajustes táticos no vestiário.`,
        },
        ...state.events,
      ],
    };
  }

  // Compute live tactical ratings for user vs opponent
  const userTactics = calculateTeamTacticalRatings(
    userSquad,
    state.isUserHome ? homeClub.formation : awayClub.formation,
    state.isUserHome ? homeClub.instructions : awayClub.instructions
  );

  const homeAtt = state.isUserHome ? userTactics.attack : homeClub.overallAttack;
  const homeMid = state.isUserHome ? userTactics.midfield : homeClub.overallMidfield;
  const homeDef = state.isUserHome ? userTactics.defense : homeClub.overallDefense;

  const awayAtt = !state.isUserHome ? userTactics.attack : awayClub.overallAttack;
  const awayMid = !state.isUserHome ? userTactics.midfield : awayClub.overallMidfield;
  const awayDef = !state.isUserHome ? userTactics.defense : awayClub.overallDefense;

  // Possession check with slight home advantage (+0.35)
  const homeMidStrength = homeMid + 0.35;
  const awayMidStrength = awayMid;
  const homePossessionProb =
    0.5 + (homeMidStrength - awayMidStrength) * 0.045;
  const homeHasBall = rng() < Math.min(0.72, Math.max(0.28, homePossessionProb));
  const possessingTeam: 'HOME' | 'AWAY' = homeHasBall ? 'HOME' : 'AWAY';

  const homePossessionTicks =
    state.homePossessionTicks + (homeHasBall ? 1 : 0);
  const awayPossessionTicks =
    state.awayPossessionTicks + (homeHasBall ? 0 : 1);

  const homePasses = state.homePasses + (homeHasBall ? Math.floor(rng() * 5) + 4 : Math.floor(rng() * 2) + 1);
  const awayPasses = state.awayPasses + (!homeHasBall ? Math.floor(rng() * 5) + 4 : Math.floor(rng() * 2) + 1);

  // Determine active pitch zone based on possession and attacking vs defensive ratings
  let activeZone: 'DEF_HOME' | 'MIDFIELD' | 'DEF_AWAY' = 'MIDFIELD';
  const zoneRoll = rng();
  if (homeHasBall) {
    const attackPushProb = 0.42 + (homeAtt - awayDef) * 0.03;
    activeZone =
      zoneRoll < attackPushProb
        ? 'DEF_AWAY'
        : zoneRoll < 0.82
        ? 'MIDFIELD'
        : 'DEF_HOME';
  } else {
    const awayPushProb = 0.40 + (awayAtt - homeDef) * 0.03;
    activeZone =
      zoneRoll < awayPushProb
        ? 'DEF_HOME'
        : zoneRoll < 0.82
        ? 'MIDFIELD'
        : 'DEF_AWAY';
  }

  // Move tokens coherently according to activeZone and possession
  const zoneShiftX =
    activeZone === 'DEF_AWAY' ? 24 : activeZone === 'MIDFIELD' ? 8 : -10;
  const awayZoneShiftX =
    activeZone === 'DEF_HOME' ? -24 : activeZone === 'MIDFIELD' ? -8 : 10;

  const moveTokens = (
    tokens: PitchTokenState[],
    isHome: boolean
  ): PitchTokenState[] => {
    return tokens.map((t, idx) => {
      if (idx === 0) {
        // Goalkeeper stays near goal line
        const gkX = isHome
          ? activeZone === 'DEF_AWAY'
            ? 11
            : 6
          : activeZone === 'DEF_HOME'
          ? 89
          : 94;
        const gkY = 50 + (rng() - 0.5) * 6;
        return {
          ...t,
          x: gkX,
          y: gkY,
          hasBall: false,
          condition: Math.max(45, Number((t.condition - 0.08).toFixed(2))),
        };
      }

      const sectorMultiplier =
        t.sector === 'ATA' ? 1.35 : t.sector === 'MEI' ? 1.1 : 0.75;
      const shift = (isHome ? zoneShiftX : awayZoneShiftX) * sectorMultiplier;
      const jitterX = (rng() - 0.5) * 6;
      const jitterY = (rng() - 0.5) * 9;

      const rawX = t.baseX + shift + jitterX;
      const clampedX = Math.min(93, Math.max(7, rawX));
      const clampedY = Math.min(92, Math.max(8, t.baseY + jitterY));

      const drain =
        t.sector === 'MEI' ? 0.24 : t.sector === 'ATA' ? 0.21 : 0.18;

      return {
        ...t,
        x: Number(clampedX.toFixed(1)),
        y: Number(clampedY.toFixed(1)),
        hasBall: false,
        condition: Math.max(40, Number((t.condition - drain).toFixed(2))),
      };
    });
  };

  let homeTokens = moveTokens(state.homeTokens, true);
  let awayTokens = moveTokens(state.awayTokens, false);

  // Prevent visual overlap between the 22 tokens on the 2D pitch
  const allTokens = [...homeTokens, ...awayTokens];
  const minDistance = 5.2;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < allTokens.length; i++) {
      for (let j = i + 1; j < allTokens.length; j++) {
        const dx = allTokens[j].x - allTokens[i].x;
        const dy = allTokens[j].y - allTokens[i].y;
        const dist = Math.hypot(dx, dy);
        if (dist < minDistance && dist > 0.001) {
          const push = (minDistance - dist) * 0.5;
          const nx = dx / dist;
          const ny = dy / dist;
          if (allTokens[i].sector !== 'GOL') {
            allTokens[i].x = Number(
              Math.min(93, Math.max(7, allTokens[i].x - nx * push)).toFixed(1)
            );
            allTokens[i].y = Number(
              Math.min(92, Math.max(8, allTokens[i].y - ny * push)).toFixed(1)
            );
          }
          if (allTokens[j].sector !== 'GOL') {
            allTokens[j].x = Number(
              Math.min(93, Math.max(7, allTokens[j].x + nx * push)).toFixed(1)
            );
            allTokens[j].y = Number(
              Math.min(92, Math.max(8, allTokens[j].y + ny * push)).toFixed(1)
            );
          }
        }
      }
    }
  }

  // Pick ball carrier based on zone
  const activeTokens = homeHasBall ? homeTokens : awayTokens;
  const candidatePool =
    (homeHasBall && activeZone === 'DEF_AWAY') ||
    (!homeHasBall && activeZone === 'DEF_HOME')
      ? activeTokens.filter((t) => t.sector === 'ATA' || t.sector === 'MEI')
      : activeTokens.filter((t) => t.sector !== 'GOL');

  const chosenCarrier =
    candidatePool[Math.floor(rng() * candidatePool.length)] ||
    activeTokens[5] ||
    activeTokens[0];

  // Mark carrier
  if (homeHasBall) {
    homeTokens = homeTokens.map((t) =>
      t.id === chosenCarrier.id ? { ...t, hasBall: true } : t
    );
  } else {
    awayTokens = awayTokens.map((t) =>
      t.id === chosenCarrier.id ? { ...t, hasBall: true } : t
    );
  }

  let ballX = chosenCarrier.x;
  let ballY = chosenCarrier.y;

  let homeGoals = state.homeGoals;
  let awayGoals = state.awayGoals;
  let homeShots = state.homeShots;
  let awayShots = state.awayShots;
  let homeShotsOnTarget = state.homeShotsOnTarget;
  let awayShotsOnTarget = state.awayShotsOnTarget;
  let homeXG = state.homeXG;
  let awayXG = state.awayXG;
  let homeCorners = state.homeCorners;
  let awayCorners = state.awayCorners;
  let homeFouls = state.homeFouls;
  let awayFouls = state.awayFouls;

  const newEvents: MatchEvent[] = [];
  const attackingClub = homeHasBall ? homeClub : awayClub;
  const defendingClub = homeHasBall ? awayClub : homeClub;
  const defendingGk = homeHasBall ? awayTokens[0] : homeTokens[0];

  let lastActionLabel = `${chosenCarrier.name} (${attackingClub.abbr}) controla a posse e organiza a jogada no setor ${
    activeZone === 'MIDFIELD' ? 'central' : 'ofensivo'
  }.`;

  // Event generation when in attacking third or midfield buildup
  const eventRoll = rng();
  const isAttackingThird =
    (homeHasBall && activeZone === 'DEF_AWAY') ||
    (!homeHasBall && activeZone === 'DEF_HOME');

  const shotThreshold = isAttackingThird
    ? 0.34 + ((homeHasBall ? homeAtt - awayDef : awayAtt - homeDef) * 0.015)
    : 0.08;

  if (eventRoll < shotThreshold) {
    // A shot occurs!
    const shooterPool = activeTokens.filter(
      (t) => t.sector === 'ATA' || t.sector === 'MEI'
    );
    const shooter =
      shooterPool[Math.floor(rng() * shooterPool.length)] || chosenCarrier;
    const assisterPool = activeTokens.filter(
      (t) => t.id !== shooter.id && t.sector !== 'GOL'
    );
    const assister =
      assisterPool[Math.floor(rng() * assisterPool.length)] || chosenCarrier;

    const shotXG = Number((0.06 + rng() * (isAttackingThird ? 0.28 : 0.09)).toFixed(2));
    if (homeHasBall) {
      homeShots += 1;
      homeXG = Number((homeXG + shotXG).toFixed(2));
    } else {
      awayShots += 1;
      awayXG = Number((awayXG + shotXG).toFixed(2));
    }

    const outcomeRoll = rng();
    const goalProb =
      shotXG * 0.92 +
      ((homeHasBall ? homeAtt - awayDef : awayAtt - homeDef) * 0.012);

    if (outcomeRoll < Math.min(0.42, Math.max(0.09, goalProb))) {
      // GOAL!
      if (homeHasBall) {
        homeGoals += 1;
        homeShotsOnTarget += 1;
        ballX = 98;
        ballY = 50;
        homeTokens = homeTokens.map((t) =>
          t.id === shooter.id
            ? { ...t, rating: Math.min(10, Number((t.rating + 0.9).toFixed(1))) }
            : t
        );
      } else {
        awayGoals += 1;
        awayShotsOnTarget += 1;
        ballX = 2;
        ballY = 50;
        awayTokens = awayTokens.map((t) =>
          t.id === shooter.id
            ? { ...t, rating: Math.min(10, Number((t.rating + 0.9).toFixed(1))) }
            : t
        );
      }

      const goalText = `${nextMinute}' — GOOOL DO ${attackingClub.shortName.toUpperCase()}! ${shooter.name} recebe passe infiltrado de ${assister.name} e finaliza com precisão cirúrgica! (xG: +${shotXG.toFixed(2)})`;
      lastActionLabel = goalText;
      newEvents.push({
        id: `evt-goal-${nextMinute}-${rng()}`,
        minute: nextMinute,
        type: 'GOL',
        team: possessingTeam,
        text: goalText,
        scorerName: shooter.name,
        assistName: assister.name,
        xGAdded: shotXG,
      });
    } else if (outcomeRoll < 0.62) {
      // Saved by Goalkeeper!
      if (homeHasBall) {
        homeShotsOnTarget += 1;
        if (rng() < 0.45) homeCorners += 1;
        ballX = 94;
        ballY = 48 + (rng() - 0.5) * 10;
      } else {
        awayShotsOnTarget += 1;
        if (rng() < 0.45) awayCorners += 1;
        ballX = 6;
        ballY = 48 + (rng() - 0.5) * 10;
      }
      const saveText = `${nextMinute}' — Defesa espetacular de ${defendingGk.name}! ${shooter.name} (${attackingClub.abbr}) bateu forte no canto, mas o goleiro salvou!`;
      lastActionLabel = saveText;
      newEvents.push({
        id: `evt-save-${nextMinute}-${rng()}`,
        minute: nextMinute,
        type: 'DEFESA',
        team: possessingTeam,
        text: saveText,
        xGAdded: shotXG,
      });
    } else if (outcomeRoll < 0.70) {
      // Hit the post!
      ballX = homeHasBall ? 96 : 4;
      ballY = 43;
      const postText = `${nextMinute}' — NA TRAVE! ${shooter.name} (${attackingClub.abbr}) solta uma bomba da entrada da área e carimba o travessão de ${defendingGk.name}!`;
      lastActionLabel = postText;
      newEvents.push({
        id: `evt-post-${nextMinute}-${rng()}`,
        minute: nextMinute,
        type: 'TRAVE',
        team: possessingTeam,
        text: postText,
        xGAdded: shotXG,
      });
    } else {
      // Shot wide
      ballX = homeHasBall ? 97 : 3;
      ballY = rng() > 0.5 ? 32 : 68;
      const wideText = `${nextMinute}' — Pra fora! ${shooter.name} (${attackingClub.abbr}) encontra espaço após passe de ${assister.name}, mas finaliza sobre o travessão.`;
      lastActionLabel = wideText;
      if (shotXG >= 0.14 || nextMinute % 4 === 0) {
        newEvents.push({
          id: `evt-wide-${nextMinute}-${rng()}`,
          minute: nextMinute,
          type: 'CHUTE_FORA',
          team: possessingTeam,
          text: wideText,
          xGAdded: shotXG,
        });
      }
    }
  } else if (eventRoll < shotThreshold + 0.12) {
    // Key tackle or interception
    const defTokens = homeHasBall ? awayTokens : homeTokens;
    const defenders = defTokens.filter(
      (t) => t.sector === 'DEF' || t.sector === 'MEI'
    );
    const tackler =
      defenders[Math.floor(rng() * defenders.length)] || defTokens[2];
    const tackleText = `${nextMinute}' — Desarme preciso de ${tackler.name} (${defendingClub.abbr}), interrompendo a progressão de ${chosenCarrier.name}.`;
    lastActionLabel = tackleText;
    if (nextMinute % 5 === 0) {
      newEvents.push({
        id: `evt-tackle-${nextMinute}-${rng()}`,
        minute: nextMinute,
        type: 'DESARME',
        team: homeHasBall ? 'AWAY' : 'HOME',
        text: tackleText,
      });
    }
  } else if (eventRoll > 0.965) {
    // Yellow card / tactical foul
    const defTokens = homeHasBall ? awayTokens : homeTokens;
    const fouler =
      defTokens[Math.floor(rng() * (defTokens.length - 1)) + 1] || defTokens[2];
    if (homeHasBall) {
      awayFouls += 1;
    } else {
      homeFouls += 1;
    }
    const cardText = `${nextMinute}' — Cartão Amarelo para ${fouler.name} (${defendingClub.abbr}) por falta tática parando o contra-ataque puxado por ${chosenCarrier.name}.`;
    lastActionLabel = cardText;
    newEvents.push({
      id: `evt-yc-${nextMinute}-${rng()}`,
      minute: nextMinute,
      type: 'CARTAO_AMARELO',
      team: homeHasBall ? 'AWAY' : 'HOME',
      text: cardText,
    });
  }

  // Check Full Time at minute 90
  let phase: MatchPhase =
    state.phase === 'PRE_MATCH' ? 'FIRST_HALF' : state.phase;
  let isRunning = state.isRunning;

  if (nextMinute >= 90) {
    phase = 'FULL_TIME';
    isRunning = false;
    newEvents.unshift({
      id: `evt-ft-90`,
      minute: 90,
      type: 'FIM',
      team: 'NEUTRAL',
      text: `90' — Apito Final! Placar encerrado: ${homeClub.name} ${homeGoals} x ${awayGoals} ${awayClub.name}.`,
    });
    lastActionLabel = `Partida encerrada! ${homeClub.shortName} ${homeGoals} x ${awayGoals} ${awayClub.shortName}.`;
  }

  return {
    ...state,
    minute: Math.min(90, nextMinute),
    phase,
    isRunning,
    homeGoals,
    awayGoals,
    homePossessionTicks,
    awayPossessionTicks,
    homeShots,
    awayShots,
    homeShotsOnTarget,
    awayShotsOnTarget,
    homeXG,
    awayXG,
    homeCorners,
    awayCorners,
    homePasses,
    awayPasses,
    homeFouls,
    awayFouls,
    ballX,
    ballY,
    ballCarrierTeam: possessingTeam,
    ballCarrierNumber: chosenCarrier.number,
    ballCarrierName: chosenCarrier.name,
    activeZone,
    lastActionLabel,
    events: [...newEvents, ...state.events].slice(0, 60),
    homeTokens,
    awayTokens,
  };
}

/**
 * Simulates the remaining 9 matches of the round and includes the user's finished match result.
 */
export function simulateRoundFixtures(
  fixtures: RoundFixture[],
  roundNumber: number,
  userMatchResult: {
    fixtureId: string;
    homeGoals: number;
    awayGoals: number;
    homeXG: number;
    awayXG: number;
  },
  clubs: Club[],
  rng: () => number = Math.random
): RoundFixture[] {
  const clubMap = new Map(clubs.map((c) => [c.id, c]));

  return fixtures.map((f) => {
    if (f.roundNumber !== roundNumber) return f;

    if (f.id === userMatchResult.fixtureId) {
      return {
        ...f,
        homeGoals: userMatchResult.homeGoals,
        awayGoals: userMatchResult.awayGoals,
        homeXG: userMatchResult.homeXG,
        awayXG: userMatchResult.awayXG,
        played: true,
      };
    }

    if (f.played) return f;

    const home = clubMap.get(f.homeClubId);
    const away = clubMap.get(f.awayClubId);

    const homePower = home
      ? (home.overallAttack + home.overallMidfield + home.overallDefense) / 3 + 0.45
      : 14.5;
    const awayPower = away
      ? (away.overallAttack + away.overallMidfield + away.overallDefense) / 3
      : 14.2;

    const diff = homePower - awayPower;
    const expectedHome = Math.max(0.4, 1.35 + diff * 0.35);
    const expectedAway = Math.max(0.3, 1.05 - diff * 0.3);

    // Sample goals around expected values
    const sampleGoals = (lambda: number) => {
      let goals = 0;
      const steps = 6;
      const p = Math.min(0.55, lambda / steps);
      for (let i = 0; i < steps; i++) {
        if (rng() < p) goals++;
      }
      return goals;
    };

    const homeGoals = sampleGoals(expectedHome);
    const awayGoals = sampleGoals(expectedAway);

    return {
      ...f,
      homeGoals,
      awayGoals,
      homeXG: Number((expectedHome + (rng() - 0.5) * 0.4).toFixed(2)),
      awayXG: Number((expectedAway + (rng() - 0.5) * 0.4).toFixed(2)),
      played: true,
    };
  });
}

/**
 * Updates the 20-club league table with the completed fixtures of a round and sorts by official criteria:
 * Points DESC -> Wins DESC -> Goal Difference DESC -> Goals For DESC.
 */
export function updateStandingsWithRound(
  currentStandings: StandingsRow[],
  roundFixtures: RoundFixture[]
): StandingsRow[] {
  const map = new Map<string, StandingsRow>();
  for (const row of currentStandings) {
    map.set(row.clubId, {
      ...row,
      form: [...row.form],
    });
  }

  for (const fix of roundFixtures) {
    if (!fix.played || fix.homeGoals === null || fix.awayGoals === null) continue;

    const homeRow = map.get(fix.homeClubId);
    const awayRow = map.get(fix.awayClubId);
    if (!homeRow || !awayRow) continue;

    homeRow.played += 1;
    awayRow.played += 1;
    homeRow.goalsFor += fix.homeGoals;
    homeRow.goalsAgainst += fix.awayGoals;
    homeRow.goalDifference = homeRow.goalsFor - homeRow.goalsAgainst;

    awayRow.goalsFor += fix.awayGoals;
    awayRow.goalsAgainst += fix.homeGoals;
    awayRow.goalDifference = awayRow.goalsFor - awayRow.goalsAgainst;

    if (fix.homeGoals > fix.awayGoals) {
      homeRow.won += 1;
      homeRow.points += 3;
      homeRow.form = [...homeRow.form.slice(-4), 'V'];

      awayRow.lost += 1;
      awayRow.form = [...awayRow.form.slice(-4), 'D'];
    } else if (fix.homeGoals < fix.awayGoals) {
      awayRow.won += 1;
      awayRow.points += 3;
      awayRow.form = [...awayRow.form.slice(-4), 'V'];

      homeRow.lost += 1;
      homeRow.form = [...homeRow.form.slice(-4), 'D'];
    } else {
      homeRow.drawn += 1;
      awayRow.drawn += 1;
      homeRow.points += 1;
      awayRow.points += 1;
      homeRow.form = [...homeRow.form.slice(-4), 'E'];
      awayRow.form = [...awayRow.form.slice(-4), 'E'];
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.won !== a.won) return b.won - a.won;
    if (b.goalDifference !== a.goalDifference)
      return b.goalDifference - a.goalDifference;
    return b.goalsFor - a.goalsFor;
  });
}
