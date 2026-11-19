import { NaturalPosition, PlayerAttributes } from '../types/football';

/**
 * Converts an internal 1..20 weighted rating to the 60..99 OVR scale
 * calibrated to EA FC / eFootball (PES) benchmarks:
 *  - World-Class European Elite: 84 – 91+
 *  - Brasileirão Série A / Libertadores Stars (Arrascaeta, Pedro, Hulk, Estêvão, Paquetá, Garro): 80 – 83
 *  - Série A / Libertadores Starters: 74 – 79
 *  - Série A Reserves / Série B Standouts: 70 – 73
 *  - Série B Starters & Rotation: 65 – 70
 *  - Série B Backups / Youth: 61 – 65
 */
export function rawScoreToOvr(rawScore: number): number {
  let ovr: number;
  if (rawScore <= 12.5) {
    ovr = 58 + (rawScore - 10.5) * 1.5; // 12.5 -> 61
  } else if (rawScore <= 15.5) {
    ovr = 61 + (rawScore - 12.5) * 3.0; // 14.0 -> 65.5, 15.5 -> 70
  } else if (rawScore <= 18.5) {
    ovr = 70 + (rawScore - 15.5) * 4.0; // 16.5 -> 74, 17.5 -> 78, 18.5 -> 82
  } else {
    ovr = 82 + ((rawScore - 18.5) / 1.5) * 17.0; // 19.0 -> 88, 19.5 -> 93, 20.0 -> 99
  }
  return Math.min(99, Math.max(60, Math.round(ovr)));
}

/**
 * Calculates a player's overall rating (60 to 99) weighted by their natural position.
 * Peak 99 corresponds to 20 across all position-relevant attributes (Pelé / Messi at their peak).
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

  if (totalWeight === 0) return 64;
  return rawScoreToOvr(weightedSum / totalWeight);
}
