import { getAllClubBadgeUrls, normalizeBaseUrl } from '../data/clubBadgeAssets';

export type PreloadPhase = 'BRAND' | 'MODULES' | 'BADGES' | 'FINALIZING' | 'READY';

export interface PreloadSnapshot {
  phase: PreloadPhase;
  percent: number;
  loadedAssets: number;
  totalAssets: number;
  statusText: string;
}

export interface PreloadProgressInputs {
  brandReady: boolean;
  fontsReady: boolean;
  appModuleReady: boolean;
  loadedBadges: number;
  totalBadges: number;
}

export function computePreloadProgress(inputs: PreloadProgressInputs): PreloadSnapshot {
  const safeTotalBadges = Math.max(0, inputs.totalBadges);
  const clampedBadges = Math.min(safeTotalBadges, Math.max(0, inputs.loadedBadges));

  // Weighted progress: brand + fonts (15%), main app & database chunk (30%), all club crests (55%)
  const brandWeight = inputs.brandReady ? 8 : 0;
  const fontsWeight = inputs.fontsReady ? 7 : 0;
  const moduleWeight = inputs.appModuleReady ? 30 : 0;
  const badgeRatio = safeTotalBadges > 0 ? clampedBadges / safeTotalBadges : 1;
  const badgeWeight = Math.round(badgeRatio * 55);

  const rawPercent = Math.min(100, brandWeight + fontsWeight + moduleWeight + badgeWeight);

  let phase: PreloadPhase = 'BRAND';
  let statusText = 'Carregando logomarca e tipografia...';

  if (rawPercent >= 100 && inputs.appModuleReady && inputs.fontsReady && inputs.brandReady) {
    phase = 'READY';
    statusText = 'Pronto para iniciar';
  } else if (!inputs.brandReady || !inputs.fontsReady) {
    phase = 'BRAND';
    statusText = 'Carregando logomarca e tipografia...';
  } else if (!inputs.appModuleReady) {
    phase = 'MODULES';
    statusText = 'Carregando ligas, elencos e motor de jogo...';
  } else if (clampedBadges < safeTotalBadges) {
    phase = 'BADGES';
    statusText = `Carregando escudos dos clubes (${clampedBadges}/${safeTotalBadges})...`;
  } else {
    phase = 'FINALIZING';
    statusText = 'Preparando carreira e interface...';
  }

  const fixedTasks = 3; // brand + fonts + app module
  const fixedDone =
    (inputs.brandReady ? 1 : 0) +
    (inputs.fontsReady ? 1 : 0) +
    (inputs.appModuleReady ? 1 : 0);

  return {
    phase,
    percent: rawPercent,
    loadedAssets: fixedDone + clampedBadges,
    totalAssets: fixedTasks + safeTotalBadges,
    statusText,
  };
}

export interface RunAssetPreloadOptions {
  baseUrl?: string;
  minDisplayMs?: number;
  maxWaitMs?: number;
  concurrency?: number;
  perImageTimeoutMs?: number;
  loadAppModule: () => Promise<unknown>;
  loadFonts?: () => Promise<void>;
  preloadImage?: (url: string, timeoutMs: number) => Promise<void>;
  onProgress?: (snapshot: PreloadSnapshot) => void;
  signal?: AbortSignal;
}

export function defaultBrowserPreloadImage(
  url: string,
  timeoutMs: number
): Promise<void> {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') {
      resolve();
      return;
    }

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    };

    const timer = setTimeout(finish, timeoutMs);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      if (typeof img.decode === 'function') {
        img.decode().then(finish, finish);
      } else {
        finish();
      }
    };
    img.onerror = finish;
    img.src = url;

    if (img.complete) {
      finish();
    }
  });
}

async function defaultLoadFonts(timeoutMs: number): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document) || !document.fonts?.ready) {
    return;
  }
  await Promise.race([
    document.fonts.ready.then(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

function waitMs(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function loadModuleWithRetry<T>(
  loader: () => Promise<T>,
  options: {
    retries?: number;
    baseDelayMs?: number;
    signal?: AbortSignal;
  } = {}
): Promise<T> {
  const { retries = 3, baseDelayMs = 350, signal } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (signal?.aborted) {
      throw new Error('Carregamento cancelado.');
    }
    try {
      return await loader();
    } catch (err) {
      lastError = err;
      if (attempt < retries && !signal?.aborted) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await waitMs(delay);
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Falha ao carregar o módulo principal da aplicação.');
}

export async function runAssetPreload(
  options: RunAssetPreloadOptions
): Promise<PreloadSnapshot> {
  const {
    baseUrl = './',
    minDisplayMs = 1250,
    maxWaitMs = 6000,
    concurrency = 6,
    perImageTimeoutMs = 2200,
    loadAppModule,
    loadFonts = () => defaultLoadFonts(1800),
    preloadImage = defaultBrowserPreloadImage,
    onProgress,
    signal,
  } = options;

  const startedAt = Date.now();
  const prefix = normalizeBaseUrl(baseUrl);
  const brandUrls = [`${prefix}favicon.svg`, `${prefix}pwa-192x192.png`];
  const badgeUrls = getAllClubBadgeUrls(prefix);

  const state: PreloadProgressInputs = {
    brandReady: false,
    fontsReady: false,
    appModuleReady: false,
    loadedBadges: 0,
    totalBadges: badgeUrls.length,
  };

  let lastEmittedPercent = -1;
  let lastEmittedPhase: PreloadPhase | null = null;
  let lastEmittedBadges = -1;

  const emit = (force = false) => {
    if (signal?.aborted) return;
    const snap = computePreloadProgress(state);
    if (
      force ||
      snap.percent !== lastEmittedPercent ||
      snap.phase !== lastEmittedPhase ||
      state.loadedBadges - lastEmittedBadges >= 6 ||
      state.loadedBadges === state.totalBadges
    ) {
      lastEmittedPercent = snap.percent;
      lastEmittedPhase = snap.phase;
      lastEmittedBadges = state.loadedBadges;
      onProgress?.(snap);
    }
  };

  emit(true);

  const brandTask = Promise.all(
    brandUrls.map((url) => preloadImage(url, perImageTimeoutMs).catch(() => undefined))
  ).then(() => {
    state.brandReady = true;
    emit(true);
  });

  const fontsTask = loadFonts()
    .catch(() => undefined)
    .then(() => {
      state.fontsReady = true;
      emit(true);
    });

  // Load main application module FIRST so 117 badge requests never saturate browser/proxy connections
  await loadAppModule();
  if (signal?.aborted) {
    return computePreloadProgress(state);
  }
  state.appModuleReady = true;
  emit(true);

  const badgesTask = (async () => {
    let cursor = 0;
    const workerCount = Math.max(1, Math.min(concurrency, badgeUrls.length || 1));

    const runWorker = async () => {
      while (cursor < badgeUrls.length && !signal?.aborted) {
        const idx = cursor++;
        const url = badgeUrls[idx];
        try {
          await preloadImage(url, perImageTimeoutMs);
        } catch {
          // Ignore individual asset failure so preload never stalls
        }
        state.loadedBadges += 1;
        emit(false);
      }
    };

    await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
    emit(true);
  })();

  // Cap remaining wait for optional assets so slow networks never stall boot
  const elapsedSoFar = Date.now() - startedAt;
  const remainingBudgetMs = Math.max(800, maxWaitMs - elapsedSoFar);
  const optionalAssetsTask = Promise.all([brandTask, fontsTask, badgesTask]);
  await Promise.race([optionalAssetsTask, waitMs(remainingBudgetMs)]);

  const elapsed = Date.now() - startedAt;
  if (elapsed < minDisplayMs && !signal?.aborted) {
    await waitMs(minDisplayMs - elapsed);
  }

  state.brandReady = true;
  state.fontsReady = true;
  state.appModuleReady = true;
  state.loadedBadges = state.totalBadges;

  const finalSnapshot = computePreloadProgress(state);
  if (!signal?.aborted) {
    onProgress?.(finalSnapshot);
  }
  return finalSnapshot;
}
