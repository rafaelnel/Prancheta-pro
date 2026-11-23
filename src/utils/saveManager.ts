import { CareerSaveData, CareerSlotIndex, Player } from '../types/football';
import {
  BUNDESLIGA_EXTRA_CLUBS,
  CONMEBOL_FOREIGN_CLUBS,
  GLOBAL_WORLD_CLUBS,
  INITIAL_CLUBS,
  LALIGA_EXTRA_CLUBS,
  LIGA_PORTUGAL_EXTRA_CLUBS,
  LIGUE_1_EXTRA_CLUBS,
  PREMIER_LEAGUE_EXTRA_CLUBS,
  SERIE_A_IT_EXTRA_CLUBS,
  UCL_CLUBS,
  getPlayableDivisionForClub,
  isEuropeanPlayableDivision,
} from '../data/initialDatabase';
import {
  createInitialChampionsLeague,
  createInitialCopaDoBrasil,
  createInitialLibertadores,
  createInitialMundial,
  createInitialSuperMundial,
} from '../data/cupFactory';
import { createInitialFreeAgents } from '../data/transferCatalog';
import { buildInitialAiSquads } from '../engine/aiMarketEngine';
import {
  GLOBAL_SCALE_VERSION,
  createInitialFinanceLedger,
  ensurePlayerDefaults,
  recalibratePlayerForGlobalScale,
} from '../engine/economyAndEvolution';
import {
  YOUTH_TIERS,
  createInitialYouthAcademy,
} from '../engine/youthAcademyEngine';

export const MAX_CAREER_SLOTS = 4;
export const CAREER_SLOTS: CareerSlotIndex[] = [1, 2, 3, 4];
export const STORAGE_KEY = 'prancheta_pro_saves_v1';

export interface StorageAdapter {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

function getDefaultStorage(): StorageAdapter | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

type StoredSlotMap = Partial<Record<string, CareerSaveData>>;

function isValidCareerSave(candidate: unknown): candidate is CareerSaveData {
  if (!candidate || typeof candidate !== 'object') return false;
  const obj = candidate as Partial<CareerSaveData>;
  return (
    obj.version === 3 &&
    typeof obj.slotIndex === 'number' &&
    obj.slotIndex >= 1 &&
    obj.slotIndex <= MAX_CAREER_SLOTS &&
    typeof obj.userClubId === 'string' &&
    (obj.division === 'A' ||
      obj.division === 'B' ||
      obj.division === 'PL' ||
      obj.division === 'LALIGA' ||
      obj.division === 'BUNDESLIGA' ||
      obj.division === 'SERIE_A_IT' ||
      obj.division === 'LIGUE_1' ||
      obj.division === 'LIGA_PORTUGAL') &&
    typeof obj.clubName === 'string' &&
    Array.isArray(obj.clubs) &&
    obj.clubs.length >= 40 &&
    typeof obj.clubs[0]?.overallAttack === 'number' &&
    obj.clubs[0].overallAttack >= 60 &&
    Array.isArray(obj.squad) &&
    Array.isArray(obj.standings) &&
    Array.isArray(obj.fixtures) &&
    Array.isArray(obj.messages) &&
    typeof obj.matchState === 'object' &&
    obj.matchState !== null
  );
}

function readSlotMap(storage: StorageAdapter | null = getDefaultStorage()): StoredSlotMap {
  if (!storage) return {};
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as StoredSlotMap;
  } catch {
    return {};
  }
}

function writeSlotMap(
  map: StoredSlotMap,
  storage: StorageAdapter | null = getDefaultStorage()
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(map));
    return true;
  } catch {
    return false;
  }
}

export function hydrateCareerSave(save: CareerSaveData): CareerSaveData {
  const existingIds = new Set(save.clubs.map((c) => c.id));
  const missingClubs = [
    ...CONMEBOL_FOREIGN_CLUBS,
    ...UCL_CLUBS,
    ...PREMIER_LEAGUE_EXTRA_CLUBS,
    ...LALIGA_EXTRA_CLUBS,
    ...BUNDESLIGA_EXTRA_CLUBS,
    ...SERIE_A_IT_EXTRA_CLUBS,
    ...LIGUE_1_EXTRA_CLUBS,
    ...LIGA_PORTUGAL_EXTRA_CLUBS,
    ...GLOBAL_WORLD_CLUBS,
  ]
    .filter((c) => !existingIds.has(c.id))
    .map((c) => ({
      ...c,
      instructions: { ...c.instructions },
      starPlayers: c.starPlayers.map((s) => ({ ...s })),
    }));

  const hydratedClubs =
    missingClubs.length > 0 ? [...save.clubs, ...missingClubs] : save.clubs;
  const baseClubRefMap = new Map(
    [
      ...INITIAL_CLUBS,
      ...CONMEBOL_FOREIGN_CLUBS,
      ...UCL_CLUBS,
      ...PREMIER_LEAGUE_EXTRA_CLUBS,
      ...LALIGA_EXTRA_CLUBS,
      ...BUNDESLIGA_EXTRA_CLUBS,
      ...SERIE_A_IT_EXTRA_CLUBS,
      ...LIGUE_1_EXTRA_CLUBS,
      ...LIGA_PORTUGAL_EXTRA_CLUBS,
      ...GLOBAL_WORLD_CLUBS,
    ].map((c) => [c.id, c])
  );
  const seasonYear = save.currentYear ?? 2026;
  const needsGlobalScaleMigration =
    (save.globalScaleVersion ?? 1) < GLOBAL_SCALE_VERSION;
  const needsTransfermarktMoneyUpgrade = (save.globalScaleVersion ?? 1) < 5;
  const migratedClubs = needsTransfermarktMoneyUpgrade
    ? hydratedClubs.map((c) => {
        const ref = baseClubRefMap.get(c.id);
        const targetCash = ref
          ? Math.max(c.cashBalance, ref.cashBalance)
          : c.division === 'UCL' ||
            c.division === 'PL' ||
            c.division === 'LALIGA' ||
            c.division === 'BUNDESLIGA' ||
            c.division === 'SERIE_A_IT' ||
            c.division === 'LIGUE_1' ||
            c.division === 'LIGA_PORTUGAL'
          ? Math.round(c.cashBalance * 2.2)
          : Math.round(c.cashBalance * 2.0);
        const targetWage = ref
          ? Math.max(c.wageBudget, ref.wageBudget)
          : Math.round(c.wageBudget * 1.75);
        return {
          ...c,
          cashBalance: targetCash,
          wageBudget: targetWage,
        };
      })
    : hydratedClubs;

  const migratedClubMap = new Map(migratedClubs.map((c) => [c.id, c]));
  const migratedUserClub = migratedClubMap.get(save.userClubId) || migratedClubs[0];

  const normalizePlayer = (
    p: Player,
    clubRep: number,
    div: typeof migratedUserClub.division
  ): Player => {
    const base = ensurePlayerDefaults(p, clubRep, div, seasonYear);
    return needsGlobalScaleMigration
      ? recalibratePlayerForGlobalScale(base, clubRep, div, seasonYear)
      : base;
  };

  const hydratedSquad = save.squad.map((p) =>
    normalizePlayer(p, migratedUserClub.reputation, migratedUserClub.division)
  );
  const baseAiSquads = buildInitialAiSquads(migratedClubs, save.userClubId);
  const rawAiSquads =
    save.aiSquads && Object.keys(save.aiSquads).length > 0
      ? { ...baseAiSquads, ...save.aiSquads }
      : baseAiSquads;

  const hydratedAiSquads: Record<string, Player[]> = {};
  for (const [cid, roster] of Object.entries(rawAiSquads)) {
    const c = migratedClubMap.get(cid);
    const rep = c?.reputation ?? 74;
    const div = c?.division ?? 'A';
    hydratedAiSquads[cid] = needsGlobalScaleMigration
      ? roster.map((p) => normalizePlayer(p, rep, div))
      : roster;
  }

  return {
    ...save,
    currentYear: seasonYear,
    globalScaleVersion: GLOBAL_SCALE_VERSION,
    clubs: migratedClubs,
    squad: hydratedSquad,
    aiSquads: hydratedAiSquads,
    seasonStepIndex: save.seasonStepIndex ?? Math.max(0, save.currentRound - 1),
    activeCompetition: save.activeCompetition ?? 'BRASILEIRAO',
    copaDoBrasil:
      save.copaDoBrasil ??
      createInitialCopaDoBrasil(save.userClubId, hydratedClubs),
    libertadores:
      save.libertadores ?? createInitialLibertadores(save.userClubId),
    championsLeague:
      save.championsLeague ??
      createInitialChampionsLeague(
        seasonYear,
        hydratedClubs,
        isEuropeanPlayableDivision(getPlayableDivisionForClub(migratedUserClub))
          ? save.userClubId
          : undefined
      ),
    mundial: save.mundial ?? createInitialMundial(seasonYear),
    superMundial:
      save.superMundial ??
      createInitialSuperMundial({
        seasonYear,
        userClubId: save.userClubId,
        clubsPool: migratedClubs,
        accumulatedUclChampions: save.accumulatedUclChampions ?? [],
        accumulatedLibChampions: save.accumulatedLibChampions ?? [],
      }),
    accumulatedUclChampions: save.accumulatedUclChampions ?? [],
    accumulatedLibChampions: save.accumulatedLibChampions ?? [],
    freeAgents: (save.freeAgents ?? createInitialFreeAgents()).map((p) =>
      normalizePlayer(p, 72, 'A')
    ),
    loanedOutPlayers: save.loanedOutPlayers ?? [],
    transferHistory: save.transferHistory ?? [],
    transferredOutClubPlayerIds: save.transferredOutClubPlayerIds ?? [],
    watchedPlayers: save.watchedPlayers ?? [],
    pendingOffers: save.pendingOffers ?? [],
    financeLedger:
      save.financeLedger ??
      createInitialFinanceLedger(migratedUserClub, hydratedSquad, seasonYear),
    seasonHistory: save.seasonHistory ?? [],
    matchHistory: save.matchHistory ?? [],
    seasonEndReport: save.seasonEndReport ?? null,
    youthAcademy: (() => {
      const fallback = createInitialYouthAcademy(
        migratedUserClub.id,
        migratedUserClub.reputation,
        migratedUserClub.division,
        seasonYear
      );
      if (!save.youthAcademy) return fallback;
      const tierDef =
        YOUTH_TIERS.find((t) => t.tier === save.youthAcademy?.investmentTier) ||
        YOUTH_TIERS[1];
      const hasOnlyLegacyGenericInitRegens =
        save.youthAcademy.youthRoster &&
        save.youthAcademy.youthRoster.length > 0 &&
        save.youthAcademy.youthRoster.every((yp) =>
          yp.id.startsWith(`regen-${migratedUserClub.id}-2026-`)
        ) &&
        (fallback.youthRoster || []).some((fp) =>
          fp.id.startsWith(`youth-real-${migratedUserClub.id}-`)
        );
      const rawRoster =
        save.youthAcademy.youthRoster &&
        save.youthAcademy.youthRoster.length > 0 &&
        !hasOnlyLegacyGenericInitRegens
          ? save.youthAcademy.youthRoster
          : fallback.youthRoster || [];
      const sanitizedRoster = rawRoster.map((yp) =>
        normalizePlayer(
          { ...yp, isRegen: true },
          migratedUserClub.reputation,
          migratedUserClub.division
        )
      );
      return {
        ...save.youthAcademy,
        monthlyCost: tierDef.monthlyCost,
        youthRoster: sanitizedRoster,
        lastGraduatedRegens: hasOnlyLegacyGenericInitRegens
          ? fallback.lastGraduatedRegens
          : save.youthAcademy.lastGraduatedRegens,
      };
    })(),
  };
}

export function loadAllCareerSlots(
  storage: StorageAdapter | null = getDefaultStorage()
): Array<CareerSaveData | null> {
  const map = readSlotMap(storage);
  return CAREER_SLOTS.map((slot) => {
    const item = map[String(slot)];
    return isValidCareerSave(item) ? hydrateCareerSave(item) : null;
  });
}

export function loadCareerSlot(
  slotIndex: CareerSlotIndex,
  storage: StorageAdapter | null = getDefaultStorage()
): CareerSaveData | null {
  const map = readSlotMap(storage);
  const item = map[String(slotIndex)];
  return isValidCareerSave(item) ? hydrateCareerSave(item) : null;
}

export function getLatestCareerSave(
  storage: StorageAdapter | null = getDefaultStorage()
): CareerSaveData | null {
  const slots = loadAllCareerSlots(storage).filter(
    (s): s is CareerSaveData => s !== null
  );
  if (slots.length === 0) return null;
  return [...slots].sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
  )[0];
}

export function saveCareerToSlot(
  saveData: CareerSaveData,
  storage: StorageAdapter | null = getDefaultStorage()
): CareerSaveData {
  const stamped: CareerSaveData = {
    ...saveData,
    savedAt: new Date().toISOString(),
  };
  const map = readSlotMap(storage);
  map[String(stamped.slotIndex)] = stamped;
  writeSlotMap(map, storage);
  return stamped;
}

export function writeCareerSlotDirectly(
  saveData: CareerSaveData,
  storage: StorageAdapter | null = getDefaultStorage()
): CareerSaveData {
  const hydrated = hydrateCareerSave(saveData);
  const map = readSlotMap(storage);
  map[String(hydrated.slotIndex)] = hydrated;
  writeSlotMap(map, storage);
  return hydrated;
}

export function deleteCareerSlot(
  slotIndex: CareerSlotIndex,
  storage: StorageAdapter | null = getDefaultStorage()
): void {
  const map = readSlotMap(storage);
  delete map[String(slotIndex)];
  writeSlotMap(map, storage);
}

export function serializeCareerBackup(saveData: CareerSaveData): string {
  return JSON.stringify(saveData, null, 2);
}

export function parseCareerBackup(
  jsonText: string,
  targetSlot: CareerSlotIndex
): CareerSaveData | null {
  try {
    const parsed = JSON.parse(jsonText) as unknown;
    if (!isValidCareerSave(parsed)) return null;
    return hydrateCareerSave({
      ...parsed,
      slotIndex: targetSlot,
      savedAt: new Date().toISOString(),
    });
  } catch {
    return null;
  }
}

export function formatSavedTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return 'Agora';
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Agora';
  }
}
