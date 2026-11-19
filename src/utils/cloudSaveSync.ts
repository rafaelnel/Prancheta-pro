import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { CareerSaveData, CareerSlotIndex } from '../types/football';
import { CurrencyCode } from './formatters';
import {
  CAREER_SLOTS,
  hydrateCareerSave,
  loadAllCareerSlots,
  writeCareerSlotDirectly,
} from './saveManager';

function sanitizeDisplayName(rawName: string | null | undefined): string {
  const trimmed = (rawName || 'Treinador').trim();
  if (trimmed.length === 0) return 'Treinador';
  return trimmed.slice(0, 80);
}

function compactCareerPayload(save: CareerSaveData): Record<string, unknown> {
  // Compact large AI squad cache (rehydrated deterministically on load via hydrateCareerSave)
  // and strip any undefined fields via JSON round-trip so Firestore map validation never fails.
  const compact: CareerSaveData = {
    ...save,
    aiSquads: {},
    messages: (save.messages || []).slice(0, 40),
    transferHistory: (save.transferHistory || []).slice(0, 60),
    matchHistory: (save.matchHistory || []).slice(0, 80),
  };
  return JSON.parse(JSON.stringify(compact)) as Record<string, unknown>;
}

export async function ensureCloudUserProfile(
  user: User,
  preferredCurrency: CurrencyCode = 'BRL',
  activeSlotIndex: CareerSlotIndex = 1
): Promise<void> {
  const path = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);
  const displayName = sanitizeDisplayName(
    user.displayName || user.email?.split('@')[0] || 'Treinador'
  );
  const safeCurrency: CurrencyCode =
    preferredCurrency === 'EUR' ? 'EUR' : 'BRL';
  const safeSlot = Math.min(4, Math.max(1, Math.round(activeSlotIndex)));

  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        ownerId: user.uid,
        displayName,
        preferredCurrency: safeCurrency,
        activeSlotIndex: safeSlot,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(userRef, {
        displayName,
        preferredCurrency: safeCurrency,
        activeSlotIndex: safeSlot,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveCareerSlotToCloud(
  user: User,
  save: CareerSaveData,
  preferredCurrency: CurrencyCode = 'BRL'
): Promise<void> {
  await ensureCloudUserProfile(user, preferredCurrency, save.slotIndex);

  const slotDocId = `slot_${save.slotIndex}`;
  const path = `users/${user.uid}/careerSlots/${slotDocId}`;
  const slotRef = doc(db, 'users', user.uid, 'careerSlots', slotDocId);

  const payloadMap = compactCareerPayload(save);
  const rawClubId = (save.userClubId || 'FLA')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 64);
  const safeClubId = rawClubId.length >= 1 ? rawClubId : 'FLA';
  const rawIso =
    typeof save.savedAt === 'string' && save.savedAt.trim().length >= 10
      ? save.savedAt.trim()
      : new Date().toISOString();
  const safeIso = rawIso.slice(0, 40);

  const commonFields = {
    managerName: sanitizeDisplayName(save.managerName || user.displayName),
    clubId: safeClubId,
    clubName: sanitizeDisplayName(save.clubName || 'Clube'),
    division: save.division === 'B' ? 'B' : 'A',
    currentYear: Math.min(2150, Math.max(2026, Math.round(save.currentYear || 2026))),
    currentRound: Math.min(60, Math.max(1, Math.round(save.currentRound || 1))),
    savedAtIso: safeIso,
    careerPayload: payloadMap,
    updatedAt: serverTimestamp(),
  };

  try {
    const existingSnap = await getDoc(slotRef);
    if (!existingSnap.exists()) {
      await setDoc(slotRef, {
        ownerId: user.uid,
        slotIndex: save.slotIndex,
        ...commonFields,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(slotRef, commonFields);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteCareerSlotFromCloud(
  user: User,
  slotIndex: CareerSlotIndex
): Promise<void> {
  const slotDocId = `slot_${slotIndex}`;
  const path = `users/${user.uid}/careerSlots/${slotDocId}`;
  const slotRef = doc(db, 'users', user.uid, 'careerSlots', slotDocId);

  try {
    const snap = await getDoc(slotRef);
    if (snap.exists()) {
      await deleteDoc(slotRef);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export interface CloudSyncSummary {
  slots: Array<CareerSaveData | null>;
  downloadedCount: number;
  uploadedCount: number;
}

export async function syncAllCareerSlotsWithCloud(
  user: User,
  preferredCurrency: CurrencyCode = 'BRL',
  activeSlotIndex: CareerSlotIndex = 1
): Promise<CloudSyncSummary> {
  await ensureCloudUserProfile(user, preferredCurrency, activeSlotIndex);

  const slotsPath = `users/${user.uid}/careerSlots`;
  const slotsCol = collection(db, 'users', user.uid, 'careerSlots');
  const q = query(slotsCol, where('ownerId', '==', user.uid));

  const cloudBySlot = new Map<CareerSlotIndex, CareerSaveData>();
  try {
    const snap = await getDocs(q);
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const sIdx = data.slotIndex as CareerSlotIndex;
      if (
        (sIdx === 1 || sIdx === 2 || sIdx === 3 || sIdx === 4) &&
        data.careerPayload &&
        typeof data.careerPayload === 'object'
      ) {
        try {
          const hydrated = hydrateCareerSave({
            ...(data.careerPayload as CareerSaveData),
            slotIndex: sIdx,
            savedAt:
              typeof data.savedAtIso === 'string'
                ? data.savedAtIso
                : new Date().toISOString(),
          });
          cloudBySlot.set(sIdx, hydrated);
        } catch {
          // Ignore malformed cloud payload
        }
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, slotsPath);
  }

  const localSlots = loadAllCareerSlots();
  let downloadedCount = 0;
  let uploadedCount = 0;

  for (const slotIndex of CAREER_SLOTS) {
    const localSave = localSlots[slotIndex - 1];
    const cloudSave = cloudBySlot.get(slotIndex) || null;

    if (cloudSave && !localSave) {
      writeCareerSlotDirectly(cloudSave);
      downloadedCount += 1;
    } else if (!cloudSave && localSave) {
      await saveCareerSlotToCloud(user, localSave, preferredCurrency);
      uploadedCount += 1;
    } else if (cloudSave && localSave) {
      const cloudTime = new Date(cloudSave.savedAt).getTime() || 0;
      const localTime = new Date(localSave.savedAt).getTime() || 0;
      if (cloudTime > localTime + 1000) {
        writeCareerSlotDirectly(cloudSave);
        downloadedCount += 1;
      } else if (localTime > cloudTime + 1000) {
        await saveCareerSlotToCloud(user, localSave, preferredCurrency);
        uploadedCount += 1;
      }
    }
  }

  return {
    slots: loadAllCareerSlots(),
    downloadedCount,
    uploadedCount,
  };
}
