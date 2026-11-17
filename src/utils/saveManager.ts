import { CareerSaveData, CareerSlotIndex } from '../types/football';
import { CONMEBOL_FOREIGN_CLUBS } from '../data/initialDatabase';
import {
  createInitialCopaDoBrasil,
  createInitialLibertadores,
} from '../data/cupFactory';
import { createInitialFreeAgents } from '../data/transferCatalog';

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
    (obj.division === 'A' || obj.division === 'B') &&
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

function hydrateCareerSave(save: CareerSaveData): CareerSaveData {
  const existingIds = new Set(save.clubs.map((c) => c.id));
  const missingForeign = CONMEBOL_FOREIGN_CLUBS.filter(
    (c) => !existingIds.has(c.id)
  ).map((c) => ({
    ...c,
    instructions: { ...c.instructions },
    starPlayers: c.starPlayers.map((s) => ({ ...s })),
  }));

  return {
    ...save,
    clubs:
      missingForeign.length > 0 ? [...save.clubs, ...missingForeign] : save.clubs,
    seasonStepIndex: save.seasonStepIndex ?? Math.max(0, save.currentRound - 1),
    activeCompetition: save.activeCompetition ?? 'BRASILEIRAO',
    copaDoBrasil:
      save.copaDoBrasil ?? createInitialCopaDoBrasil(save.userClubId),
    libertadores:
      save.libertadores ?? createInitialLibertadores(save.userClubId),
    freeAgents: save.freeAgents ?? createInitialFreeAgents(),
    loanedOutPlayers: save.loanedOutPlayers ?? [],
    transferHistory: save.transferHistory ?? [],
    transferredOutClubPlayerIds: save.transferredOutClubPlayerIds ?? [],
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
