import {
  InMatchInjuryRecord,
  InboxMessage,
  InjurySeverity,
  Player,
  PositionSector,
  TeamInstructions,
} from '../types/football';

export interface InjuryCatalogEntry {
  id: string;
  name: string;
  severity: InjurySeverity;
  minDays: number;
  maxDays: number;
  muscular: boolean;
  weight: number;
}

/**
 * Realistic football injury catalog spanning minor knocks (4-10 days)
 * to severe ligament/tendon ruptures (4-6+ months).
 */
export const INJURY_CATALOG: InjuryCatalogEntry[] = [
  // LEVE (4 a 10 dias)
  {
    id: 'trauma-muscular',
    name: 'Contusão / trauma muscular',
    severity: 'LEVE',
    minDays: 4,
    maxDays: 7,
    muscular: false,
    weight: 26,
  },
  {
    id: 'contratura-panturrilha',
    name: 'Contratura na panturrilha',
    severity: 'LEVE',
    minDays: 5,
    maxDays: 9,
    muscular: true,
    weight: 24,
  },
  {
    id: 'sobrecarga-adutor',
    name: 'Sobrecarga muscular no adutor',
    severity: 'LEVE',
    minDays: 6,
    maxDays: 10,
    muscular: true,
    weight: 22,
  },

  // MODERADA (14 a 32 dias)
  {
    id: 'estiramento-posterior',
    name: 'Estiramento posterior da coxa (Grau 1)',
    severity: 'MODERADA',
    minDays: 14,
    maxDays: 21,
    muscular: true,
    weight: 18,
  },
  {
    id: 'entorse-tornozelo',
    name: 'Entorse no tornozelo',
    severity: 'MODERADA',
    minDays: 16,
    maxDays: 26,
    muscular: false,
    weight: 15,
  },
  {
    id: 'lesao-quadriceps',
    name: 'Lesão muscular no quadríceps',
    severity: 'MODERADA',
    minDays: 20,
    maxDays: 32,
    muscular: true,
    weight: 13,
  },
  {
    id: 'pubalgia',
    name: 'Pubalgia / inflamação inguinal',
    severity: 'MODERADA',
    minDays: 18,
    maxDays: 28,
    muscular: true,
    weight: 10,
  },

  // GRAVE (40 a 75 dias)
  {
    id: 'ruptura-biceps-femoral',
    name: 'Ruptura parcial do bíceps femoral (Grau 2)',
    severity: 'GRAVE',
    minDays: 40,
    maxDays: 56,
    muscular: true,
    weight: 7,
  },
  {
    id: 'fissura-metatarso',
    name: 'Fratura por estresse no metatarso',
    severity: 'GRAVE',
    minDays: 45,
    maxDays: 68,
    muscular: false,
    weight: 5,
  },
  {
    id: 'lesao-menisco',
    name: 'Lesão no menisco do joelho',
    severity: 'GRAVE',
    minDays: 50,
    maxDays: 75,
    muscular: false,
    weight: 5,
  },

  // MUITO_GRAVE (110 a 195 dias)
  {
    id: 'fratura-fibula',
    name: 'Fratura na fíbula / tornozelo',
    severity: 'MUITO_GRAVE',
    minDays: 110,
    maxDays: 145,
    muscular: false,
    weight: 2.2,
  },
  {
    id: 'tendao-aquiles',
    name: 'Lesão grave no tendão de Aquiles',
    severity: 'MUITO_GRAVE',
    minDays: 125,
    maxDays: 175,
    muscular: true,
    weight: 1.6,
  },
  {
    id: 'ruptura-lca',
    name: 'Ruptura do ligamento cruzado anterior (LCA)',
    severity: 'MUITO_GRAVE',
    minDays: 140,
    maxDays: 195,
    muscular: false,
    weight: 1.5,
  },
];

export type InjuryRiskLevel = 'BAIXO' | 'MODERADO' | 'ALTO' | 'CRITICO';

export interface PlayerInjuryRiskAssessment {
  riskLevel: InjuryRiskLevel;
  riskPctPerMatch: number; // e.g., 1.2% .. 18.5%
  riskMultiplier: number;
  performanceFactor: number; // 0.62 .. 1.0
  performancePenaltyPct: number; // 0 .. 38
  consecutiveMatches: number;
  label: string;
  advice: string;
}

/**
 * Nonlinear physical performance multiplier based on player condition (0..100).
 * - >= 85%: 100% effectiveness (fresh)
 * - 75..84%: slight drop (95%..100%)
 * - 65..74%: noticeable fatigue impact (86%..95%)
 * - < 65%: severe exhaustion drop (down to 70% at 40% condition)
 * - injured: 62% effectiveness if forced on the pitch
 */
export function calculateFatiguePerformanceFactor(
  condition: number,
  injured: boolean = false
): number {
  if (injured) return 0.62;
  const c = Math.max(25, Math.min(100, condition));
  if (c >= 85) return 1.0;
  if (c >= 75) {
    // 75 -> 0.95, 85 -> 1.00
    return Number((0.95 + ((c - 75) / 10) * 0.05).toFixed(4));
  }
  if (c >= 65) {
    // 65 -> 0.86, 75 -> 0.95
    return Number((0.86 + ((c - 65) / 10) * 0.09).toFixed(4));
  }
  // 40 -> 0.70, 65 -> 0.86
  const factor = 0.7 + Math.max(0, c - 40) * (0.16 / 25);
  return Number(Math.max(0.65, factor).toFixed(4));
}

/**
 * Per-minute match condition drain based on sector, player stamina, age,
 * and team pressing intensity.
 */
export function calculateMatchMinuteDrain(
  player: Pick<Player, 'age' | 'sector' | 'attributes'> | null | undefined,
  sector: PositionSector,
  pressingIntensity?: TeamInstructions['pressingIntensity']
): number {
  if (sector === 'GOL') {
    return 0.07;
  }

  const baseSectorDrain =
    sector === 'MEI' ? 0.275 : sector === 'ATA' ? 0.245 : 0.21;

  const stamina = player?.attributes?.resistencia ?? 13;
  // Stamina 18 -> 0.84x drain, Stamina 13 -> 1.00x, Stamina 8 -> 1.18x
  const staminaFactor = Math.max(
    0.78,
    Math.min(1.26, 1 + (13 - stamina) * 0.032)
  );

  const age = player?.age ?? 25;
  const ageFactor =
    age >= 35 ? 1.18 : age >= 32 ? 1.09 : age <= 21 ? 0.96 : 1.0;

  const pressingFactor =
    pressingIntensity === 'Extrema'
      ? 1.24
      : pressingIntensity === 'Contida'
      ? 0.82
      : 1.0;

  return Number(
    (baseSectorDrain * staminaFactor * ageFactor * pressingFactor).toFixed(3)
  );
}

/**
 * Evaluates a player's injury risk and live physical performance impact.
 */
export function evaluatePlayerInjuryRisk(
  player: Pick<
    Player,
    'condition' | 'age' | 'sector' | 'attributes' | 'injured' | 'consecutiveMatches'
  >,
  liveCondition?: number,
  pressingIntensity?: TeamInstructions['pressingIntensity']
): PlayerInjuryRiskAssessment {
  const cond = liveCondition ?? player.condition;
  const consecutive = Math.max(0, player.consecutiveMatches ?? 0);
  const perfFactor = calculateFatiguePerformanceFactor(cond, player.injured);
  const performancePenaltyPct = Math.round((1 - perfFactor) * 100);

  // Condition multiplier (steep curve below 78%)
  let condMult = 1.0;
  if (cond < 55) {
    condMult = 8.5 + (55 - cond) * 0.22;
  } else if (cond < 65) {
    condMult = 4.8 + ((65 - cond) / 10) * 3.7;
  } else if (cond < 75) {
    condMult = 2.2 + ((75 - cond) / 10) * 2.6;
  } else if (cond < 85) {
    condMult = 1.15 + ((85 - cond) / 10) * 1.05;
  }

  // Consecutive match overload multiplier
  const streakMult =
    consecutive >= 3 ? 1 + Math.min(0.75, (consecutive - 2) * 0.18) : 1.0;

  // Age & stamina factors
  const ageMult =
    player.age >= 35
      ? 1.38
      : player.age >= 32
      ? 1.2
      : player.age <= 20
      ? 0.92
      : 1.0;
  const stamina = player.attributes?.resistencia ?? 13;
  const staminaMult = Math.max(0.8, Math.min(1.25, 1 + (13 - stamina) * 0.025));

  // Pressing intensity & GK protection
  const pressingMult =
    pressingIntensity === 'Extrema'
      ? 1.22
      : pressingIntensity === 'Contida'
      ? 0.85
      : 1.0;
  const sectorMult = player.sector === 'GOL' ? 0.42 : 1.0;

  const totalMult =
    condMult * streakMult * ageMult * staminaMult * pressingMult * sectorMult;

  // Baseline per-match injury probability for a fresh 25yo outfielder (~1.05%)
  const baseMatchProb = 0.0105;
  const riskProb = Math.min(0.32, baseMatchProb * totalMult);
  const riskPctPerMatch = Number((riskProb * 100).toFixed(1));

  let riskLevel: InjuryRiskLevel = 'BAIXO';
  let label = 'Carga Baixa';
  let advice = 'Condição ideal para atuar os 90 minutos.';

  if (cond < 62 || riskPctPerMatch >= 7.5) {
    riskLevel = 'CRITICO';
    label = 'Sobrecarga Crítica';
    advice =
      'Desgaste severo: forte queda de rendimento em campo e risco crítico de lesão muscular. Poupe este atleta.';
  } else if (cond < 74 || riskPctPerMatch >= 3.6) {
    riskLevel = 'ALTO';
    label = 'Risco Alto';
    advice =
      'Acúmulo físico elevado: rende menos em campo e tem risco alto de lesão. Considere rodar o elenco ou substituir cedo.';
  } else if (cond < 84 || consecutive >= 3 || riskPctPerMatch >= 1.9) {
    riskLevel = 'MODERADO';
    label = 'Desgaste Moderado';
    advice =
      'Monitorar minutagem: evite sequência longa sem descanso para manter rendimento máximo.';
  }

  return {
    riskLevel,
    riskPctPerMatch,
    riskMultiplier: Number(totalMult.toFixed(2)),
    performanceFactor: perfFactor,
    performancePenaltyPct,
    consecutiveMatches: consecutive,
    label,
    advice,
  };
}

/**
 * Picks a specific injury from INJURY_CATALOG with exact recovery duration (days).
 * Overloaded/fatigued players skew toward muscular strains & tears.
 */
export function pickWeightedInjury(
  isFatigued: boolean,
  rng: () => number = Math.random
): {
  injuryType: string;
  severity: InjurySeverity;
  days: number;
} {
  const weightedEntries = INJURY_CATALOG.map((entry) => {
    let w = entry.weight;
    if (isFatigued) {
      if (entry.muscular) w *= 1.85;
      if (entry.severity === 'MODERADA' || entry.severity === 'GRAVE') {
        w *= 1.25;
      }
    }
    return { entry, w };
  });

  const totalWeight = weightedEntries.reduce((sum, item) => sum + item.w, 0);
  let roll = rng() * totalWeight;
  let selected = weightedEntries[0].entry;

  for (const item of weightedEntries) {
    roll -= item.w;
    if (roll <= 0) {
      selected = item.entry;
      break;
    }
  }

  const span = selected.maxDays - selected.minDays + 1;
  const days = selected.minDays + Math.floor(rng() * span);

  return {
    injuryType: selected.name,
    severity: selected.severity,
    days,
  };
}

/**
 * Performs a single-minute injury roll for a player currently on the pitch.
 * Returns null if uninjured, or the specific injury rolled.
 */
export function rollMinuteInjuryCheck(params: {
  player: Pick<
    Player,
    'condition' | 'age' | 'sector' | 'attributes' | 'injured' | 'consecutiveMatches'
  >;
  liveCondition: number;
  pressingIntensity?: TeamInstructions['pressingIntensity'];
  rng?: () => number;
}): {
  injuryType: string;
  severity: InjurySeverity;
  days: number;
  wasFatigued: boolean;
} | null {
  const { player, liveCondition, pressingIntensity, rng = Math.random } = params;
  const assessment = evaluatePlayerInjuryRisk(
    player,
    liveCondition,
    pressingIntensity
  );
  // Convert per-90-minute match probability to per-minute probability
  const matchProb = assessment.riskPctPerMatch / 100;
  const minuteProb = 1 - Math.pow(1 - matchProb, 1 / 90);

  if (rng() >= minuteProb) {
    return null;
  }

  const wasFatigued =
    liveCondition < 74 || (player.consecutiveMatches ?? 0) >= 3;
  const picked = pickWeightedInjury(wasFatigued, rng);

  return {
    ...picked,
    wasFatigued,
  };
}

export function formatInjurySeverityLabel(severity?: InjurySeverity): string {
  switch (severity) {
    case 'LEVE':
      return 'Leve';
    case 'MODERADA':
      return 'Moderada';
    case 'GRAVE':
      return 'Grave';
    case 'MUITO_GRAVE':
      return 'Muito Grave';
    default:
      return 'Em tratamento';
  }
}

export function formatInjuryDurationShort(days: number): string {
  if (days <= 1) return '1 dia';
  if (days < 14) return `${days} dias`;
  if (days < 45) {
    const weeks = Math.round(days / 7);
    return `${days} dias (~${weeks} sem.)`;
  }
  const months = Number((days / 30).toFixed(1));
  return `${days} dias (~${months.toLocaleString('pt-BR')} meses)`;
}

export function applyInjuryToPlayer(
  player: Player,
  injury: {
    injuryType: string;
    severity: InjurySeverity;
    days: number;
  }
): Player {
  const days = Math.max(3, Math.round(injury.days));
  return {
    ...player,
    injured: true,
    injuryType: injury.injuryType,
    injurySeverity: injury.severity,
    injuryDaysRemaining: days,
    injuryTotalDays: days,
    injuryNote: `${injury.injuryType} (${days}d restantes)`,
    condition: Math.max(35, Math.min(player.condition, 62)),
    consecutiveMatches: 0,
  };
}

/**
 * Advances daily physical recovery AND medical injury rehabilitation for the squad.
 */
export function advanceSquadRecoveryByDays(
  squad: Player[],
  daysElapsed: number,
  dateLabel?: string
): {
  updatedSquad: Player[];
  recoveredPlayers: Player[];
  clearanceMessages: InboxMessage[];
} {
  if (daysElapsed <= 0) {
    return { updatedSquad: squad, recoveredPlayers: [], clearanceMessages: [] };
  }

  const recoveredPlayers: Player[] = [];

  const updatedSquad = squad.map((p) => {
    const stamina = p.attributes?.resistencia ?? 13;
    // Daily recovery: ~4.0 pts/day average (ranges ~3.3 for older/low stamina to ~4.9 for young/high stamina)
    const staminaBonus = (stamina - 13) * 0.1;
    const agePenalty = p.age >= 34 ? -0.45 : p.age >= 31 ? -0.2 : p.age <= 22 ? 0.25 : 0;
    const dailyRecovery = Math.max(3.0, Math.min(5.2, 4.1 + staminaBonus + agePenalty));

    // If injured, tick down remaining recovery days
    if (p.injured) {
      const currentDays = p.injuryDaysRemaining ?? 10;
      const nextDays = currentDays - daysElapsed;

      if (nextDays <= 0) {
        const cleared: Player = {
          ...p,
          injured: false,
          injuryNote: undefined,
          injuryType: undefined,
          injurySeverity: undefined,
          injuryDaysRemaining: 0,
          injuryTotalDays: undefined,
          // Cleared from DM with partial match fitness so manager ramps them back in
          condition: Math.min(86, Math.max(74, Math.round(p.condition + daysElapsed * 1.5))),
          consecutiveMatches: 0,
        };
        recoveredPlayers.push(cleared);
        return cleared;
      }

      const typeLabel = p.injuryType || p.injuryNote?.split(' (')[0] || 'Lesão em tratamento';
      return {
        ...p,
        injuryDaysRemaining: nextDays,
        injuryNote: `${typeLabel} (${nextDays}d restantes)`,
        condition: Math.min(76, Math.round(p.condition + daysElapsed * 0.8)),
      };
    }

    // Healthy player daily physical recovery
    const gained = Math.round(dailyRecovery * daysElapsed);
    const nextCond = Math.min(99, p.condition + gained);
    // Reset consecutive streak if rested 6+ days between games
    const nextStreak = daysElapsed >= 6 ? 0 : p.consecutiveMatches ?? 0;

    return {
      ...p,
      condition: nextCond,
      consecutiveMatches: nextStreak,
    };
  });

  const clearanceMessages: InboxMessage[] =
    recoveredPlayers.length > 0 && dateLabel
      ? [
          {
            id: `msg-dm-clear-${dateLabel}-${recoveredPlayers.map((p) => p.id).join('-')}`,
            date: dateLabel,
            sender: 'Departamento Médico',
            senderRole: 'Fisiologia & Reabilitação',
            subject:
              recoveredPlayers.length === 1
                ? `Alta Médica: ${recoveredPlayers[0].name} liberado pelo DM`
                : `Alta Médica: ${recoveredPlayers.length} atletas liberados pelo DM`,
            category: 'Departamento Médico',
            priority: 'positive',
            read: false,
            relatedPlayerId: recoveredPlayers[0].id,
            body: [
              recoveredPlayers.length === 1
                ? `${recoveredPlayers[0].name} (${recoveredPlayers[0].position}) concluiu a transição física no Departamento Médico e está liberado para voltar a ser relacionado.`
                : `${recoveredPlayers.map((p) => `${p.name} (${p.position})`).join(', ')} concluíram a recuperação no Departamento Médico e voltaram a ficar disponíveis.`,
              'Recomendamos reintegrar gradualmente na escalação para recuperar o ritmo ideal sem risco de recidiva.',
            ],
            bulletPoints: recoveredPlayers.map(
              (p) =>
                `#${p.number} ${p.name} (${p.position}) — Condição atual: ${Math.round(
                  p.condition
                )}% (liberado para jogo)`
            ),
            actionLabel: 'Abrir Elenco',
            actionTargetTab: 'squad',
          },
        ]
      : [];

  return { updatedSquad, recoveredPlayers, clearanceMessages };
}

/**
 * Ensures no injured player remains in the 11 fielded slots if a healthy
 * squad alternative is available. Returns updated squad + swap log.
 */
export function ensureHealthyStartingLineup(squad: Player[]): {
  updatedSquad: Player[];
  replacedStarters: Array<{ injuredOut: Player; replacementIn: Player }>;
} {
  const injuredStarters = squad.filter((p) => p.isStarter && p.injured);
  if (injuredStarters.length === 0) {
    return { updatedSquad: squad, replacedStarters: [] };
  }

  let working = [...squad];
  const replacedStarters: Array<{ injuredOut: Player; replacementIn: Player }> = [];

  for (const inj of injuredStarters) {
    const healthyBench = working.filter((p) => !p.isStarter && !p.injured);
    if (healthyBench.length === 0) break;

    const scoreCandidate = (cand: Player): number => {
      let score = cand.condition * 0.4;
      if (inj.position === 'GOL') {
        score += cand.position === 'GOL' ? 1000 : -500;
      } else {
        if (cand.position === 'GOL') score -= 500;
        if (cand.position === inj.position) score += 60;
        else if (cand.sector === inj.sector) score += 30;
      }
      const attrAvg =
        (cand.attributes.passe +
          cand.attributes.finalizacao +
          cand.attributes.drible +
          cand.attributes.desarme +
          cand.attributes.posicionamento +
          cand.attributes.velocidade) /
        6;
      return score + attrAvg * 3;
    };

    const bestReplacement = [...healthyBench].sort(
      (a, b) => scoreCandidate(b) - scoreCandidate(a)
    )[0];
    if (!bestReplacement) continue;

    working = working.map((p) => {
      if (p.id === inj.id) {
        return { ...p, isStarter: false, slotIndex: null };
      }
      if (p.id === bestReplacement.id) {
        return {
          ...p,
          isStarter: true,
          slotIndex: inj.slotIndex,
          assignedRole:
            p.sector === inj.sector ? inj.assignedRole : p.assignedRole,
          assignedDuty:
            p.sector === inj.sector ? inj.assignedDuty : p.assignedDuty,
        };
      }
      return p;
    });

    replacedStarters.push({
      injuredOut: inj,
      replacementIn: bestReplacement,
    });
  }

  return { updatedSquad: working, replacedStarters };
}

/**
 * Generates an inbox medical bulletin when one or more user players get injured.
 */
export function createInjuryInboxMessage(params: {
  injuries: InMatchInjuryRecord[];
  dateLabel: string;
  competitionLabel?: string;
}): InboxMessage {
  const { injuries, dateLabel, competitionLabel } = params;
  const primary = injuries[0];
  const isSingle = injuries.length === 1;

  return {
    id: `msg-injury-${dateLabel}-${injuries.map((i) => i.playerId).join('-')}`,
    date: dateLabel,
    sender: 'Departamento Médico',
    senderRole: 'Boletim de Lesões',
    subject: isSingle
      ? `DM: ${primary.playerName} sofre ${primary.injuryType.toLowerCase()} (${primary.days} dias)`
      : `DM: ${injuries.length} jogadores lesionados após a partida`,
    category: 'Departamento Médico',
    priority: 'warning',
    read: false,
    relatedPlayerId: primary.playerId,
    body: [
      isSingle
        ? `${primary.playerName} precisou de atendimento médico${
            competitionLabel ? ` na partida pela ${competitionLabel}` : ''
          } (aos ${primary.minute}') e teve diagnosticada uma ${primary.injuryType.toLowerCase()} (${formatInjurySeverityLabel(
            primary.severity
          )}).`
        : `O Departamento Médico confirmou ${injuries.length} novas baixas no elenco após o último compromisso.`,
      injuries.some((i) => i.wasFatigued)
        ? 'A fisiologia aponta que o alto desgaste físico acumulado aumentou significativamente o risco da lesão. Recomendamos maior rodízio do elenco nas próximas partidas.'
        : 'O departamento de fisioterapia já iniciou o protocolo de recuperação para devolver o atleta o quanto antes.',
    ],
    bulletPoints: injuries.map(
      (i) =>
        `${i.playerName} — ${i.injuryType} (${formatInjurySeverityLabel(
          i.severity
        )}) · Tempo estimado fora: ${formatInjuryDurationShort(i.days)}${
          i.wasFatigued ? ' · Fator agravante: desgaste físico' : ''
        }`
    ),
    actionLabel: 'Gerenciar Elenco',
    actionTargetTab: 'squad',
  };
}
