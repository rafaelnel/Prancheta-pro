import React from 'react';
import { PreloadSnapshot } from '../utils/assetPreloader';

interface PreloadScreenProps {
  snapshot: PreloadSnapshot;
  isExiting: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
}

export const PreloadScreen: React.FC<PreloadScreenProps> = ({
  snapshot,
  isExiting,
  errorMessage = null,
  onRetry,
}) => {
  const logoSrc = `${import.meta.env.BASE_URL}favicon.svg`;
  const clampedPercent = Math.min(100, Math.max(0, snapshot.percent));
  const scaleX = Math.max(0.02, clampedPercent / 100);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Carregando Prancheta Pro: ${clampedPercent}%`}
      data-testid="preload-screen"
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0b0c10] text-zinc-100 select-none overflow-hidden px-6 ${
        isExiting ? 'animate-preload-exit pointer-events-none' : ''
      }`}
    >
      {/* Subtle tactical pitch geometry backdrop */}
      <svg
        aria-hidden="true"
        viewBox="0 0 1200 720"
        fill="none"
        className="pointer-events-none absolute inset-0 w-full h-full object-cover opacity-[0.06]"
        preserveAspectRatio="xMidYMid slice"
      >
        <line x1="600" y1="0" x2="600" y2="720" stroke="#b5ff00" strokeWidth="1.5" />
        <circle cx="600" cy="360" r="148" stroke="#b5ff00" strokeWidth="1.5" />
        <circle cx="600" cy="360" r="6" fill="#b5ff00" />
        <rect x="44" y="44" width="1112" height="632" rx="18" stroke="#b5ff00" strokeWidth="1.5" />
        <rect x="44" y="210" width="136" height="300" stroke="#b5ff00" strokeWidth="1.5" />
        <rect x="1020" y="210" width="136" height="300" stroke="#b5ff00" strokeWidth="1.5" />
      </svg>

      {/* Subtle top-center ambient surface lift */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(181,255,0,0.08),transparent_56%)]"
      />

      {/* Centered Brand & Progress Lockup */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-[400px] animate-preload-enter">
        {/* Official Logomarca */}
        <div className="mb-6 flex items-center justify-center">
          <img
            src={logoSrc}
            alt="Logomarca Prancheta Pro"
            width={108}
            height={108}
            draggable={false}
            className="w-24 h-24 sm:w-[108px] sm:h-[108px] rounded-[26px] object-contain"
          />
        </div>

        {/* Display Brand Wordmark */}
        <h1 className="font-display text-4xl sm:text-[46px] font-extrabold uppercase tracking-[0.04em] leading-none text-white text-center">
          PRANCHETA <span className="text-[#b5ff00]">PRO</span>
        </h1>

        {/* Clean Unboxed League Metadata */}
        <p className="mt-2.5 text-xs sm:text-[13px] text-zinc-400 tracking-wide text-center">
          Brasileirão <span aria-hidden="true">·</span> Premier League{' '}
          <span aria-hidden="true">·</span> La Liga{' '}
          <span aria-hidden="true">·</span> Bundesliga{' '}
          <span aria-hidden="true">·</span> Serie A{' '}
          <span aria-hidden="true">·</span> Ligue 1{' '}
          <span aria-hidden="true">·</span> Liga Portugal{' '}
          <span aria-hidden="true">·</span> 2026
        </p>

        {/* Progress Bar Track + Real-Time Status OR Clean Recovery Prompt */}
        {errorMessage ? (
          <div
            role="alert"
            className="mt-8 w-full rounded-xl border border-red-500/30 bg-[#151821] p-4 text-center"
          >
            <p className="text-xs text-zinc-200 leading-relaxed">{errorMessage}</p>
            <div className="mt-3.5 flex items-center justify-center gap-2.5">
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="px-4 py-2 rounded-lg bg-[#b5ff00] text-[#0b0c10] text-xs font-bold hover:brightness-105 transition cursor-pointer"
                >
                  Tentar novamente
                </button>
              )}
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-lg border border-white/15 bg-white/5 text-zinc-200 text-xs font-semibold hover:bg-white/10 transition cursor-pointer"
              >
                Recarregar página
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-9 w-full">
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={clampedPercent}
              className="relative h-1.5 w-full overflow-hidden rounded-full bg-[#1a1d26] border border-white/[0.06]"
            >
              <div
                className="h-full w-full origin-left rounded-full bg-[#b5ff00] transition-transform duration-200 ease-out"
                style={{ transform: `scaleX(${scaleX})` }}
              />
            </div>

            <div className="mt-3 flex items-center justify-between gap-4 text-xs">
              <span className="text-zinc-400 truncate">{snapshot.statusText}</span>
              <span className="font-mono font-semibold text-[#b5ff00] tabular-nums shrink-0">
                {clampedPercent}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Subtle Bottom Attribution Line */}
      <div className="relative z-10 mt-14 text-[11px] text-zinc-500 tracking-wide">
        154 clubes jogáveis <span aria-hidden="true">·</span> Elencos reais{' '}
        <span aria-hidden="true">·</span> Motor tático 2D
      </div>
    </div>
  );
};
