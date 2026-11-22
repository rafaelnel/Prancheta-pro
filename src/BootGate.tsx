import React, { Suspense, useEffect, useState } from 'react';
import { PreloadScreen } from './components/PreloadScreen';
import {
  PreloadSnapshot,
  computePreloadProgress,
  runAssetPreload,
} from './utils/assetPreloader';
import { REAL_BADGE_CLUB_IDS } from './data/clubBadgeAssets';

let appImportPromise: Promise<{ default: React.ComponentType }> | null = null;

function loadAppChunk(): Promise<{ default: React.ComponentType }> {
  if (!appImportPromise) {
    appImportPromise = import('./App');
  }
  return appImportPromise;
}

const LazyApp = React.lazy(loadAppChunk);

const EXIT_ANIMATION_MS = 380;

export const BootGate: React.FC = () => {
  const [appChunkReady, setAppChunkReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const [snapshot, setSnapshot] = useState<PreloadSnapshot>(() =>
    computePreloadProgress({
      brandReady: false,
      fontsReady: false,
      appModuleReady: false,
      loadedBadges: 0,
      totalBadges: REAL_BADGE_CLUB_IDS.size,
    })
  );

  useEffect(() => {
    const controller = new AbortController();
    let exitTimer: ReturnType<typeof setTimeout> | null = null;
    let unmountTimer: ReturnType<typeof setTimeout> | null = null;

    runAssetPreload({
      baseUrl: import.meta.env.BASE_URL,
      minDisplayMs: 1300,
      maxWaitMs: 6000,
      concurrency: 12,
      perImageTimeoutMs: 2200,
      loadAppModule: async () => {
        await loadAppChunk();
        if (!controller.signal.aborted) {
          setAppChunkReady(true);
        }
      },
      onProgress: (next) => {
        if (!controller.signal.aborted) {
          setSnapshot(next);
        }
      },
      signal: controller.signal,
    }).then(() => {
      if (controller.signal.aborted) return;
      setAppChunkReady(true);
      // Let 100% settle briefly before fading out smoothly
      exitTimer = setTimeout(() => {
        if (controller.signal.aborted) return;
        setIsExiting(true);
        unmountTimer = setTimeout(() => {
          if (!controller.signal.aborted) {
            setShowSplash(false);
          }
        }, EXIT_ANIMATION_MS);
      }, 180);
    });

    return () => {
      controller.abort();
      if (exitTimer) clearTimeout(exitTimer);
      if (unmountTimer) clearTimeout(unmountTimer);
    };
  }, []);

  return (
    <>
      {appChunkReady && (
        <Suspense fallback={null}>
          <LazyApp />
        </Suspense>
      )}
      {showSplash && <PreloadScreen snapshot={snapshot} isExiting={isExiting} />}
    </>
  );
};

export default BootGate;
