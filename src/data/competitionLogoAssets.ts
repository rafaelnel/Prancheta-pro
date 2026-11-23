import { CompetitionType, PlayableDivision } from '../types/football';

export type CompetitionLogoKey =
  | PlayableDivision
  | 'BRASILEIRAO'
  | 'COPA_DO_BRASIL'
  | 'LIBERTADORES'
  | 'CHAMPIONS'
  | 'CHAMPIONS_LEAGUE'
  | 'MUNDIAL'
  | 'SUPER_MUNDIAL';

export const COMPETITION_LOGO_FILES: Record<CompetitionLogoKey, string> = {
  A: 'brasileirao-a.png',
  B: 'brasileirao-b.svg',
  PL: 'premier-league.png',
  LALIGA: 'la-liga.png',
  BUNDESLIGA: 'bundesliga.png',
  SERIE_A_IT: 'serie-a-it.png',
  LIGUE_1: 'ligue-1.png',
  LIGA_PORTUGAL: 'liga-portugal.svg',
  BRASILEIRAO: 'brasileirao-a.png',
  COPA_DO_BRASIL: 'copa-do-brasil.png',
  LIBERTADORES: 'libertadores.png',
  CHAMPIONS: 'champions-league.svg',
  CHAMPIONS_LEAGUE: 'champions-league.svg',
  MUNDIAL: 'mundial.svg',
  SUPER_MUNDIAL: 'super-mundial.svg',
};

export const COMPETITION_LOGO_LABELS: Record<CompetitionLogoKey, string> = {
  A: 'Brasileirão Série A',
  B: 'Brasileirão Série B',
  PL: 'Premier League',
  LALIGA: 'La Liga',
  BUNDESLIGA: 'Bundesliga',
  SERIE_A_IT: 'Serie A Italiana',
  LIGUE_1: 'Ligue 1',
  LIGA_PORTUGAL: 'Liga Portugal',
  BRASILEIRAO: 'Brasileirão',
  COPA_DO_BRASIL: 'Copa do Brasil',
  LIBERTADORES: 'Copa Libertadores',
  CHAMPIONS: 'UEFA Champions League',
  CHAMPIONS_LEAGUE: 'UEFA Champions League',
  MUNDIAL: 'Mundial de Clubes',
  SUPER_MUNDIAL: 'Super Mundial FIFA',
};

export function getCompetitionLogoUrl(
  key: CompetitionLogoKey,
  baseUrl?: string
): string {
  const filename = COMPETITION_LOGO_FILES[key];
  const resolvedBase =
    baseUrl ??
    ((import.meta as unknown as { env?: { BASE_URL?: string } }).env
      ?.BASE_URL ||
      '/');
  const cleanBase = resolvedBase.endsWith('/')
    ? resolvedBase
    : `${resolvedBase}/`;
  return `${cleanBase}leagues/${filename}`;
}

export function getCompetitionLogoKeyFromContext(
  activeCompetition: CompetitionType,
  userDivision: PlayableDivision
): CompetitionLogoKey {
  if (activeCompetition === 'BRASILEIRAO') {
    return userDivision;
  }
  return activeCompetition;
}
