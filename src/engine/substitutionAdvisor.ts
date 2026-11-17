import { getRoleById } from '../data/tacticsData';
import { LiveMatchState, NaturalPosition, Player } from '../types/football';
import { calculatePlayerOverall, calculateRoleSuitability } from './matchEngine';

export interface SubstitutionSuggestion {
  id: string;
  starterOut: Player;
  reserveIn: Player;
  starterLiveCondition: number;
  starterLiveRating: number;
  starterHasYellowCard: boolean;
  starterOvr: number;
  reserveOvr: number;
  reserveCondition: number;
  roleSuitabilityPct: number;
  categoryLabel:
    | 'Renovação Física'
    | 'Prevenção de Cartão'
    | 'Impulso Ofensivo'
    | 'Segurança Defensiva'
    | 'Elevação Técnica'
    | 'Equilíbrio Tático';
  compatibilityLabel: string;
  reason: string;
  score: number;
}

function getPositionCompatibility(
  outPos: NaturalPosition,
  inPos: NaturalPosition,
  outSector: Player['sector'],
  inSector: Player['sector'],
  scoreDiff: number
): { coherent: boolean; bonus: number; label: string; isTacticalShift: boolean } {
  if (outPos === 'GOL' || inPos === 'GOL') {
    if (outPos === 'GOL' && inPos === 'GOL') {
      return {
        coherent: true,
        bonus: 40,
        label: 'Troca de Goleiro (GOL)',
        isTacticalShift: false,
      };
    }
    return { coherent: false, bonus: -999, label: '', isTacticalShift: false };
  }

  if (outPos === inPos) {
    return {
      coherent: true,
      bonus: 42,
      label: `Mesma Posição (${inPos})`,
      isTacticalShift: false,
    };
  }

  // Same corridor pairs
  if (
    (outPos === 'LD' && inPos === 'LE') ||
    (outPos === 'LE' && inPos === 'LD') ||
    (outPos === 'PD' && inPos === 'PE') ||
    (outPos === 'PE' && inPos === 'PD')
  ) {
    return {
      coherent: true,
      bonus: 30,
      label: `Troca de Corredor (${outPos} → ${inPos})`,
      isTacticalShift: false,
    };
  }

  // Same sector pairs (DEF->DEF, MEI->MEI, ATA->ATA)
  if (outSector === inSector) {
    return {
      coherent: true,
      bonus: 26,
      label: `Mesmo Setor ${inSector} (${outPos} → ${inPos})`,
      isTacticalShift: false,
    };
  }

  // Coherent tactical shift when losing or drawing in 2nd half: Midfield/Fullback -> Attacking Mid/Winger/Striker
  if (
    scoreDiff <= 0 &&
    ((outPos === 'VOL' && (inPos === 'MC' || inPos === 'MEI')) ||
      (outSector === 'MEI' && inSector === 'ATA') ||
      ((outPos === 'LD' || outPos === 'LE') && (inPos === 'PD' || inPos === 'PE')))
  ) {
    return {
      coherent: true,
      bonus: scoreDiff < 0 ? 22 : 12,
      label: `Avanço Tático (${outPos} → ${inPos})`,
      isTacticalShift: true,
    };
  }

  // Coherent tactical shift when winning: Striker/Winger/AM -> Defensive Mid/Fullback/Center-Back
  if (
    scoreDiff > 0 &&
    ((outSector === 'ATA' && inSector === 'MEI') ||
      (outPos === 'MEI' && (inPos === 'VOL' || inPos === 'MC')) ||
      ((outPos === 'PD' || outPos === 'PE') && (inPos === 'LD' || inPos === 'LE')) ||
      (outSector === 'MEI' && inPos === 'ZAG'))
  ) {
    return {
      coherent: true,
      bonus: 20,
      label: `Fechamento Tático (${outPos} → ${inPos})`,
      isTacticalShift: true,
    };
  }

  return { coherent: false, bonus: -999, label: '', isTacticalShift: false };
}

/**
 * Generates a diverse, ranked list of coherent live substitution suggestions
 * based on player fatigue, live rating, yellow cards, natural positions, and match scoreline.
 */
export function generateSubstitutionSuggestions(
  squad: Player[],
  match: LiveMatchState
): SubstitutionSuggestion[] {
  const starters = squad.filter((p) => p.isStarter && p.position !== 'GOL');
  const reserves = squad.filter(
    (p) => !p.isStarter && !p.injured && p.position !== 'GOL'
  );

  if (starters.length === 0 || reserves.length === 0) {
    return [];
  }

  const userTokens = match.isUserHome ? match.homeTokens : match.awayTokens;
  const tokenMap = new Map(userTokens.map((t) => [t.id, t]));

  const userGoals = match.isUserHome ? match.homeGoals : match.awayGoals;
  const oppGoals = match.isUserHome ? match.awayGoals : match.homeGoals;
  const scoreDiff = userGoals - oppGoals;

  const yellowCardEvents = match.events.filter(
    (e) => e.type === 'CARTAO_AMARELO'
  );

  const allCandidates: SubstitutionSuggestion[] = [];

  for (const starter of starters) {
    const token = tokenMap.get(starter.id);
    const starterLiveCond = Math.round(
      token ? token.condition : starter.condition
    );
    const starterLiveRating = Number(
      (token ? token.rating : 6.7).toFixed(1)
    );
    const hasYellow = yellowCardEvents.some((e) =>
      e.text.includes(starter.name)
    );

    const starterOvr = calculatePlayerOverall(
      starter.attributes,
      starter.position
    );
    const assignedRole = getRoleById(starter.assignedRole);

    for (const reserve of reserves) {
      const compat = getPositionCompatibility(
        starter.position,
        reserve.position,
        starter.sector,
        reserve.sector,
        scoreDiff
      );

      if (!compat.coherent) continue;

      const reserveOvr = calculatePlayerOverall(
        reserve.attributes,
        reserve.position
      );
      const reserveCond = Math.round(reserve.condition);
      const suitability = calculateRoleSuitability(reserve, assignedRole).score;

      const condGain = reserveCond - starterLiveCond;
      const starterEffectiveOvr =
        starterOvr * (0.72 + (starterLiveCond / 100) * 0.28);
      const reserveEffectiveOvr =
        reserveOvr * (0.72 + (reserveCond / 100) * 0.28);
      const effectiveOvrDelta = reserveEffectiveOvr - starterEffectiveOvr;

      let score =
        compat.bonus +
        condGain * 0.95 +
        effectiveOvrDelta * 2.4 +
        (suitability - 65) * 0.3;

      if (starterLiveCond < 78) {
        score += (78 - starterLiveCond) * 1.4;
      }
      if (hasYellow) {
        score += 24;
      }
      if (starterLiveRating < 6.6) {
        score += (6.7 - starterLiveRating) * 18;
      }

      // Scoreline context bonuses
      if (scoreDiff < 0) {
        const attBoost =
          (reserve.attributes.finalizacao +
            reserve.attributes.drible +
            reserve.attributes.velocidade +
            reserve.attributes.visaoDeJogo) /
          4;
        score += (attBoost - 13) * 2.2;
      } else if (scoreDiff > 0) {
        const defBoost =
          (reserve.attributes.desarme +
            reserve.attributes.posicionamento +
            reserve.attributes.indiceDeTrabalho +
            reserve.attributes.resistencia) /
          4;
        score += (defBoost - 13) * 2.2;
      }

      // Determine category and human-readable tactical justification
      let categoryLabel: SubstitutionSuggestion['categoryLabel'] =
        'Equilíbrio Tático';
      let reason = '';

      if (hasYellow) {
        categoryLabel = 'Prevenção de Cartão';
        reason = `#${starter.number} ${starter.name} já tem cartão amarelo (${starterLiveCond}% físico). #${reserve.number} ${reserve.name} (${reserve.position}, OVR ${reserveOvr}) entra zerado com ${reserveCond}% de fôlego.`;
      } else if (starterLiveCond <= 79 || condGain >= 14) {
        categoryLabel = 'Renovação Física';
        reason = `#${starter.number} ${starter.name} caiu para ${starterLiveCond}% de condição física. #${reserve.number} ${reserve.name} (${reserveCond}% físico, OVR ${reserveOvr}) recompõe a intensidade na faixa de ${reserve.position}.`;
      } else if (scoreDiff < 0 && (reserve.sector === 'ATA' || reserve.position === 'MEI')) {
        categoryLabel = 'Impulso Ofensivo';
        reason = `Buscando reagir no placar (${match.homeGoals}x${match.awayGoals}), #${reserve.number} ${reserve.name} (Finalização ${reserve.attributes.finalizacao}, Velocidade ${reserve.attributes.velocidade}) aumenta a agressividade no lugar de #${starter.number} ${starter.name}.`;
      } else if (scoreDiff > 0 && (reserve.sector === 'DEF' || reserve.position === 'VOL' || reserve.position === 'MC')) {
        categoryLabel = 'Segurança Defensiva';
        reason = `Para proteger a vantagem (${match.homeGoals}x${match.awayGoals}), #${reserve.number} ${reserve.name} (Desarme ${reserve.attributes.desarme}, Trabalho ${reserve.attributes.indiceDeTrabalho}) reforça a marcação no setor de #${starter.number} ${starter.name}.`;
      } else if (reserveOvr >= starterOvr || starterLiveRating <= 6.5) {
        categoryLabel = 'Elevação Técnica';
        reason = `#${starter.number} ${starter.name} atua com nota ${starterLiveRating.toFixed(1)}. #${reserve.number} ${reserve.name} (OVR ${reserveOvr}, adequação ${suitability}%) oferece ganho técnico imediato como ${assignedRole.name}.`;
      } else {
        categoryLabel = 'Equilíbrio Tático';
        reason = `Troca natural em ${compat.label}: #${reserve.number} ${reserve.name} (OVR ${reserveOvr}, ${reserveCond}% físico) mantém a estrutura tática no lugar de #${starter.number} ${starter.name} (${starterLiveCond}%).`;
      }

      allCandidates.push({
        id: `${starter.id}__${reserve.id}`,
        starterOut: starter,
        reserveIn: reserve,
        starterLiveCondition: starterLiveCond,
        starterLiveRating,
        starterHasYellowCard: hasYellow,
        starterOvr,
        reserveOvr,
        reserveCondition: reserveCond,
        roleSuitabilityPct: suitability,
        categoryLabel,
        compatibilityLabel: compat.label,
        reason,
        score: Math.round(score * 10) / 10,
      });
    }
  }

  allCandidates.sort((a, b) => b.score - a.score);

  // Build a diverse top list: first pick the #1 best suggestion for distinct starters/reserves,
  // then fill remaining slots up to 8 so reloading always offers a fresh, coherent option.
  const selected: SubstitutionSuggestion[] = [];
  const usedPairs = new Set<string>();
  const usedStartersFirstPass = new Set<string>();
  const usedReservesFirstPass = new Set<string>();

  for (const cand of allCandidates) {
    if (
      !usedStartersFirstPass.has(cand.starterOut.id) &&
      !usedReservesFirstPass.has(cand.reserveIn.id)
    ) {
      selected.push(cand);
      usedPairs.add(cand.id);
      usedStartersFirstPass.add(cand.starterOut.id);
      usedReservesFirstPass.add(cand.reserveIn.id);
      if (selected.length >= 5) break;
    }
  }

  for (const cand of allCandidates) {
    if (selected.length >= 8) break;
    if (!usedPairs.has(cand.id)) {
      selected.push(cand);
      usedPairs.add(cand.id);
    }
  }

  return selected;
}
