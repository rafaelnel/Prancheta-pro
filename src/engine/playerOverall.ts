import { NaturalPosition, PlayerAttributes } from '../types/football';

/**
 * Converts an internal 1..20 weighted rating to the 60..95 OVR scale
 * calibrated globally across Série B, Brasileirão/Libertadores, and UEFA Champions League:
 *  - World-Class Ballon d'Or Outliers (Mbappé, Vini Jr, Haaland, Rodri, Bellingham, Salah, Yamal): 90 – 95
 *  - UEFA Champions League Elite Starters: 84 – 89
 *  - Champions League Rotation / Brasileirão & Libertadores Superstars: 78 – 83
 *  - Série A / Libertadores Starters: 73 – 77
 *  - Série A Reserves / Série B Standouts: 69 – 72
 *  - Série B Starters & Rotation: 64 – 68
 *  - Série B Backups / Youth: 60 – 63
 */
export function rawScoreToOvr(rawScore: number): number {
  let ovr: number;
  if (rawScore <= 12.5) {
    ovr = 58 + (rawScore - 10.5) * 1.5; // 12.5 -> 61.0
  } else if (rawScore <= 15.5) {
    ovr = 61.0 + (rawScore - 12.5) * 2.5; // 14.0 -> 64.75, 15.5 -> 68.5
  } else if (rawScore <= 17.8) {
    ovr = 68.5 + (rawScore - 15.5) * 4.0; // 16.5 -> 72.5, 17.5 -> 76.5, 17.8 -> 77.7
  } else if (rawScore <= 19.0) {
    ovr = 77.7 + (rawScore - 17.8) * 6.0; // 18.2 -> 80.1, 18.6 -> 82.5, 19.0 -> 84.9
  } else {
    ovr = 84.9 + (rawScore - 19.0) * 10.1; // 19.3 -> 87.9, 19.5 -> 90.0, 19.7 -> 92.0, 20.0 -> 95.0
  }
  return Math.min(95, Math.max(60, Math.round(ovr)));
}

/**
 * Calculates a player's overall rating (60 to 95) weighted by their natural position.
 * Peak 95 corresponds to 20 across all position-relevant attributes (generational all-time peak).
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
