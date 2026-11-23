import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REAL_BADGE_CLUB_IDS,
  getAllClubBadgeUrls,
  getClubBadgeUrl,
} from '../data/clubBadgeAssets';
import {
  computePreloadProgress,
  loadModuleWithRetry,
  runAssetPreload,
} from './assetPreloader';

test('clubBadgeAssets resolves all 182 real club badge URLs with correct extensions and baseUrl', () => {
  const urls = getAllClubBadgeUrls('/');
  assert.equal(urls.length, REAL_BADGE_CLUB_IDS.size);
  assert.equal(urls.length, 182);
  assert.equal(getClubBadgeUrl('flamengo', '/'), '/badges/flamengo.png');
  assert.equal(getClubBadgeUrl('arsenal', '/'), '/badges/arsenal.png');
  assert.equal(getClubBadgeUrl('aston-villa', '/'), '/badges/aston-villa.png');
  assert.equal(getClubBadgeUrl('deportivo-la-coruna', './'), './badges/deportivo-la-coruna.png');
  assert.equal(getClubBadgeUrl('boca-juniors', '/'), '/badges/boca-juniors.svg');
  assert.equal(getClubBadgeUrl('non-existent-club', '/'), null);
});

test('computePreloadProgress advances monotonically from 0% to 100% across brand, module, and badge stages', () => {
  const s0 = computePreloadProgress({
    brandReady: false,
    fontsReady: false,
    appModuleReady: false,
    loadedBadges: 0,
    totalBadges: 182,
  });
  assert.equal(s0.percent, 0);
  assert.equal(s0.phase, 'BRAND');

  const s1 = computePreloadProgress({
    brandReady: true,
    fontsReady: true,
    appModuleReady: false,
    loadedBadges: 0,
    totalBadges: 182,
  });
  assert.equal(s1.percent, 15);
  assert.equal(s1.phase, 'MODULES');

  const s2 = computePreloadProgress({
    brandReady: true,
    fontsReady: true,
    appModuleReady: true,
    loadedBadges: 91,
    totalBadges: 182,
  });
  assert.ok(s2.percent > 60 && s2.percent < 95);
  assert.equal(s2.phase, 'BADGES');
  assert.ok(s2.statusText.includes('91/182'));

  const s3 = computePreloadProgress({
    brandReady: true,
    fontsReady: true,
    appModuleReady: true,
    loadedBadges: 182,
    totalBadges: 182,
  });
  assert.equal(s3.percent, 100);
  assert.equal(s3.phase, 'READY');
});

test('runAssetPreload loads app module before club badges and handles individual image failures gracefully', async () => {
  const requestedUrls: string[] = [];
  const emittedPercents: number[] = [];
  let appLoaded = false;
  let badgeLoadedBeforeApp = false;

  const result = await runAssetPreload({
    baseUrl: '/',
    minDisplayMs: 10,
    maxWaitMs: 2000,
    concurrency: 16,
    loadAppModule: async () => {
      await new Promise((r) => setTimeout(r, 15));
      appLoaded = true;
    },
    loadFonts: async () => undefined,
    preloadImage: async (url) => {
      if (url.includes('/badges/') && !appLoaded) {
        badgeLoadedBeforeApp = true;
      }
      requestedUrls.push(url);
      if (url.endsWith('birmingham-city.png')) {
        throw new Error('simulated network glitch');
      }
    },
    onProgress: (snap) => {
      emittedPercents.push(snap.percent);
    },
  });

  assert.equal(appLoaded, true);
  assert.equal(
    badgeLoadedBeforeApp,
    false,
    'Badge requests must start after loadAppModule finishes so module fetches are never saturated'
  );
  assert.equal(result.percent, 100);
  assert.equal(result.phase, 'READY');
  assert.ok(requestedUrls.includes('/favicon.svg'), 'Must preload app logomarca');
  assert.ok(requestedUrls.includes('/badges/flamengo.png'));
  assert.ok(requestedUrls.includes('/badges/arsenal.png'));
  assert.ok(requestedUrls.includes('/badges/deportivo-la-coruna.png'));
  assert.equal(
    requestedUrls.length,
    2 + REAL_BADGE_CLUB_IDS.size,
    'Must attempt brand icons + all 182 club badges'
  );
  for (let i = 1; i < emittedPercents.length; i++) {
    assert.ok(
      emittedPercents[i] >= emittedPercents[i - 1],
      `Progress regressed from ${emittedPercents[i - 1]} to ${emittedPercents[i]}`
    );
  }
});

test('loadModuleWithRetry recovers from transient dynamic import failures and surfaces persistent errors', async () => {
  let attempts = 0;
  const recovered = await loadModuleWithRetry(
    async () => {
      attempts++;
      if (attempts < 3) {
        throw new TypeError('Failed to fetch dynamically imported module');
      }
      return { ok: true };
    },
    { retries: 3, baseDelayMs: 5 }
  );
  assert.equal(recovered.ok, true);
  assert.equal(attempts, 3);

  await assert.rejects(
    () =>
      runAssetPreload({
        baseUrl: '/',
        minDisplayMs: 0,
        loadAppModule: () =>
          loadModuleWithRetry(
            async () => {
              throw new TypeError('Persistent network failure');
            },
            { retries: 1, baseDelayMs: 5 }
          ),
        loadFonts: async () => undefined,
        preloadImage: async () => undefined,
      }),
    /Persistent network failure/
  );
});
