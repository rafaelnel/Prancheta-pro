import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REAL_BADGE_CLUB_IDS,
  getAllClubBadgeUrls,
  getClubBadgeUrl,
} from '../data/clubBadgeAssets';
import {
  computePreloadProgress,
  runAssetPreload,
} from './assetPreloader';

test('clubBadgeAssets resolves all 117 real club badge URLs with correct extensions and baseUrl', () => {
  const urls = getAllClubBadgeUrls('/');
  assert.equal(urls.length, REAL_BADGE_CLUB_IDS.size);
  assert.equal(urls.length, 117);
  assert.equal(getClubBadgeUrl('flamengo', '/'), '/badges/flamengo.png');
  assert.equal(getClubBadgeUrl('arsenal', '/'), '/badges/arsenal.png');
  assert.equal(getClubBadgeUrl('aston-villa', '/'), '/badges/aston-villa.svg');
  assert.equal(getClubBadgeUrl('real-oviedo', './'), './badges/real-oviedo.svg');
  assert.equal(getClubBadgeUrl('non-existent-club', '/'), null);
});

test('computePreloadProgress advances monotonically from 0% to 100% across brand, module, and badge stages', () => {
  const s0 = computePreloadProgress({
    brandReady: false,
    fontsReady: false,
    appModuleReady: false,
    loadedBadges: 0,
    totalBadges: 117,
  });
  assert.equal(s0.percent, 0);
  assert.equal(s0.phase, 'BRAND');

  const s1 = computePreloadProgress({
    brandReady: true,
    fontsReady: true,
    appModuleReady: false,
    loadedBadges: 0,
    totalBadges: 117,
  });
  assert.equal(s1.percent, 15);
  assert.equal(s1.phase, 'MODULES');

  const s2 = computePreloadProgress({
    brandReady: true,
    fontsReady: true,
    appModuleReady: true,
    loadedBadges: 58,
    totalBadges: 117,
  });
  assert.ok(s2.percent > 60 && s2.percent < 95);
  assert.equal(s2.phase, 'BADGES');
  assert.ok(s2.statusText.includes('58/117'));

  const s3 = computePreloadProgress({
    brandReady: true,
    fontsReady: true,
    appModuleReady: true,
    loadedBadges: 117,
    totalBadges: 117,
  });
  assert.equal(s3.percent, 100);
  assert.equal(s3.phase, 'READY');
});

test('runAssetPreload preloads brand, fonts, app module, and all badges with error resilience', async () => {
  const requestedUrls: string[] = [];
  const emittedPercents: number[] = [];
  let appLoaded = false;

  const result = await runAssetPreload({
    baseUrl: '/',
    minDisplayMs: 10,
    maxWaitMs: 2000,
    concurrency: 16,
    loadAppModule: async () => {
      appLoaded = true;
    },
    loadFonts: async () => undefined,
    preloadImage: async (url) => {
      requestedUrls.push(url);
      // Simulate an occasional broken image to confirm resilience
      if (url.endsWith('wolves.svg')) {
        throw new Error('simulated network glitch');
      }
    },
    onProgress: (snap) => {
      emittedPercents.push(snap.percent);
    },
  });

  assert.equal(appLoaded, true);
  assert.equal(result.percent, 100);
  assert.equal(result.phase, 'READY');
  assert.ok(requestedUrls.includes('/favicon.svg'), 'Must preload app logomarca');
  assert.ok(requestedUrls.includes('/badges/flamengo.png'));
  assert.ok(requestedUrls.includes('/badges/arsenal.png'));
  assert.ok(requestedUrls.includes('/badges/real-oviedo.svg'));
  assert.equal(
    requestedUrls.length,
    2 + REAL_BADGE_CLUB_IDS.size,
    'Must attempt brand icons + all 117 club badges'
  );
  // Progress updates must never move backwards
  for (let i = 1; i < emittedPercents.length; i++) {
    assert.ok(
      emittedPercents[i] >= emittedPercents[i - 1],
      `Progress regressed from ${emittedPercents[i - 1]} to ${emittedPercents[i]}`
    );
  }
});
