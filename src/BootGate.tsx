import React, { useCallback, useEffect, useState } from 'react';
import { PreloadScreen } from './components/PreloadScreen';
import {
  PreloadSnapshot,
  computePreloadProgress,
  loadModuleWithRetry,
  runAssetPreload,
} from './utils/assetPreloader';
import { REAL_BADGE_CLUB_IDS } from './data/clubBadgeAssets';

const EXIT_ANIMATION_MS = 380;

export const BootGate: React.FC = () => {
  const [LoadedApp, setLoadedApp] = useState<React.ComponentType | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bootAttempt, setBootAttempt] = useState(0);
  const [snapshot, setSnapshot] = useState<PreloadSnapshot>(() =>
    computePreloadProgress({
      brandReady: false,
      fontsReady: false,
      appModuleReady: false,
      loadedBadges: 0,
      totalBadges: REAL_BADGE_CLUB_IDS.size,
    })
  );

  const handleRetry = useCallback(() => {
    setLoadError(null);
    setShowSplash(true);
    setIsExiting(false);
    setSnapshot(
      computePreloadProgress({
        brandReady: false,
        fontsReady: false,
        appModuleReady: false,
        loadedBadges: 0,
        totalBadges: REAL_BADGE_CLUB_IDS.size,
      })
    );
    setBootAttempt((prev) => prev + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let exitTimer: ReturnType<typeof setTimeout> | null = null;
    let unmountTimer: ReturnType<typeof setTimeout> | null = null;

    runAssetPreload({
      baseUrl: import.meta.env.BASE_URL,
      minDisplayMs: 1200,
      maxWaitMs: 6000,
      concurrency: 6,
      perImageTimeoutMs: 2200,
      loadAppModule: async () => {
        const mod = await loadModuleWithRetry(() => import('./App'), {
          retries: 3,
          baseDelayMs: 350,
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          setLoadedApp(() => mod.default);
        }
      },
      onProgress: (next) => {
        if (!controller.signal.aborted) {
          setSnapshot(next);
        }
      },
      signal: controller.signal,
    })
      .then(() => {
        if (controller.signal.aborted) return;
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
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setLoadError(
          'Não foi possível concluir o download dos módulos do jogo. Verifique sua conexão e tente novamente.'
        );
      });

    return () => {
      controller.abort();
      if (exitTimer) clearTimeout(exitTimer);
      if (unmountTimer) clearTimeout(unmountTimer);
    };
  }, [bootAttempt]);

  return (
    <>
      {LoadedApp && <LoadedApp />}
      {showSplash && (
        <PreloadScreen
          snapshot={snapshot}
          isExiting={isExiting}
          errorMessage={loadError}
          onRetry={handleRetry}
        />
      )}
    </>
  );
};

export default BootGate;
