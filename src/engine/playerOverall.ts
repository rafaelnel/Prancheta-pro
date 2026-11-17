import { NaturalPosition, PlayerAttributes } from '../types/football';

/**
 * Converts an internal 1..20 weighted rating to the 60..99 OVR scale,
 * where 99 represents peak Pelé / Messi (all key attributes at 20).
 */
export function rawScoreToOvr(rawScore: number): number {
  const normalized = Math.max(12.0, Math.min(20.0, rawScore));
  const t = (normalized - 12.0) / 8.0;
  const ovr = 60 + Math.pow(t, 1.42) * 39;
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
