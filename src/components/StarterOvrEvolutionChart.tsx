import React, { useMemo, useState } from 'react';
import { BarChart3, TrendingDown, TrendingUp } from 'lucide-react';
import { SeasonStarterOvrPoint } from '../types/football';
import { computeStarterOvrChartSummary } from '../engine/seasonStarterOvrChart';

interface StarterOvrEvolutionChartProps {
  seasonYear: number;
  points: SeasonStarterOvrPoint[];
  clubShortName: string;
}

function getRatingFeedbackText(point: SeasonStarterOvrPoint): string {
  if (point.avgRating >= 7.15) {
    return point.deltaOvr >= 0
      ? 'Média de rating elevada impulsionou o ganho técnico do time titular.'
      : 'Boa média de rating ajudou a conter oscilações no overall titular.';
  }
  if (point.avgRating >= 6.75) {
    return point.deltaOvr > 0
      ? 'Consistência nas notas sustentou a evolução gradual dos titulares.'
      : 'Rendimento regular manteve o overall médio em faixa estável.';
  }
  return 'Notas abaixo da média pressionaram o ritmo e a evolução dos titulares.';
}

function getBarColorClasses(
  point: SeasonStarterOvrPoint,
  isPeak: boolean,
  isSelected: boolean
): string {
  if (point.deltaOvr < -0.1) {
    return isSelected
      ? 'bg-rose-400 shadow-[0_0_0_1px_rgba(255,255,255,0.45)]'
      : 'bg-rose-400/80 group-hover:bg-rose-400';
  }
  if (isPeak || point.deltaOvr > 0.1) {
    return isSelected
      ? 'bg-[#b5ff00] shadow-[0_0_0_1px_rgba(255,255,255,0.5)]'
      : 'bg-[#b5ff00]/80 group-hover:bg-[#b5ff00]';
  }
  return isSelected
    ? 'bg-sky-400 shadow-[0_0_0_1px_rgba(255,255,255,0.45)]'
    : 'bg-sky-400/75 group-hover:bg-sky-400';
}

function getRatingTextClass(rating: number): string {
  if (rating >= 7.15) return 'text-amber-300';
  if (rating >= 6.75) return 'text-zinc-300';
  return 'text-rose-300';
}

export const StarterOvrEvolutionChart: React.FC<StarterOvrEvolutionChartProps> = ({
  seasonYear,
  points,
  clubShortName,
}) => {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const summary = useMemo(() => computeStarterOvrChartSummary(points), [points]);

  const activeIdx =
    selectedIdx !== null && selectedIdx >= 0 && selectedIdx < points.length
      ? selectedIdx
      : Math.max(0, points.length - 1);

  const activePoint = points[activeIdx] || null;

  const scale = useMemo(() => {
    if (points.length === 0) {
      return { minY: 70, maxY: 85, midY: 77.5, span: 15 };
    }
    const values = points.map((p) => p.starterAvgOvr);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const rawSpan = rawMax - rawMin;

    // Keep a clear zoomed Y-axis so +0.5 to +2.5 OVR shifts read unmistakably
    const padBottom = Math.max(0.9, rawSpan * 0.35);
    const padTop = Math.max(0.6, rawSpan * 0.25);
    let minY = Math.max(50, Math.floor((rawMin - padBottom) * 2) / 2);
    let maxY = Math.min(99, Math.ceil((rawMax + padTop) * 2) / 2);

    if (maxY - minY < 2.5) {
      const center = (rawMin + rawMax) / 2;
      minY = Math.max(50, Number((center - 1.5).toFixed(1)));
      maxY = Math.min(99, Number((center + 1.5).toFixed(1)));
    }

    const span = Math.max(1, maxY - minY);
    const midY = Number(((minY + maxY) / 2).toFixed(1));
    return { minY, maxY, midY, span };
  }, [points]);

  return (
    <section
      aria-label={`Evolução do overall médio do time titular em ${seasonYear}`}
      data-testid="starter-ovr-evolution-chart"
      className="bg-[#14171f] border border-white/[0.08] rounded-2xl p-4 sm:p-5 space-y-4"
    >
      {/* Header & Inline Tabular Summary */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-2.5">
        <div className="space-y-1">
          <h3 className="font-display text-lg sm:text-xl font-extrabold uppercase tracking-tight text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#b5ff00] shrink-0" />
            <span>Evolução do Overall Médio · Time Titular</span>
          </h3>
          <p className="text-xs text-zinc-400">
            Comparativo ao longo de {seasonYear} baseado no histórico de média de rating dos titulares do {clubShortName}
          </p>
        </div>

        {summary && (
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-mono tabular-nums text-zinc-300">
            <span>
              Início <strong className="text-white">{summary.startOvr.toFixed(1)}</strong>
            </span>
            <span className="text-zinc-600" aria-hidden="true">·</span>
            <span>
              Final <strong className="text-white">{summary.endOvr.toFixed(1)}</strong>
            </span>
            <span className="text-zinc-600" aria-hidden="true">·</span>
            <span
              className={`inline-flex items-center gap-1 font-bold ${
                summary.netDeltaOvr > 0
                  ? 'text-[#b5ff00]'
                  : summary.netDeltaOvr < 0
                  ? 'text-rose-400'
                  : 'text-sky-400'
              }`}
            >
              {summary.netDeltaOvr > 0 ? (
                <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
              ) : summary.netDeltaOvr < 0 ? (
                <TrendingDown className="w-3.5 h-3.5" aria-hidden="true" />
              ) : null}
              <span>
                {summary.netDeltaOvr > 0
                  ? `+${summary.netDeltaOvr.toFixed(1)}`
                  : summary.netDeltaOvr.toFixed(1)}{' '}
                OVR
              </span>
            </span>
            <span className="text-zinc-600" aria-hidden="true">·</span>
            <span>
              Nota Média{' '}
              <strong className={getRatingTextClass(summary.overallAvgRating)}>
                {summary.overallAvgRating.toFixed(2)}
              </strong>
            </span>
          </div>
        )}
      </div>

      {/* Bar Chart Stage */}
      {points.length === 0 ? (
        <div className="bg-[#0b0c10] border border-white/[0.06] rounded-xl px-4 py-8 text-center text-xs text-zinc-400">
          Jogue ou simule partidas da temporada para acompanhar a evolução do overall médio do time titular.
        </div>
      ) : (
        <div className="bg-[#0b0c10] border border-white/[0.06] rounded-xl p-3.5 sm:p-4 space-y-3">
          {/* Legend Row (clean inline text, zero pills) */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-400">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#b5ff00]" aria-hidden="true" />
                <span>Evolução / Pico OVR</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-sky-400" aria-hidden="true" />
                <span>Base / Estável</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-rose-400" aria-hidden="true" />
                <span>Queda vs Início</span>
              </span>
            </div>
            <span className="font-mono text-[10px] text-zinc-500">
              Barras: OVR Titular · Linha inferior: Média de Rating
            </span>
          </div>

          {/* Plot Area with Y-Axis + Bars */}
          <div className="overflow-x-auto pb-1">
            <div className="min-w-[420px] flex items-stretch gap-3">
              {/* Y-Axis Labels */}
              <div
                className="w-9 shrink-0 flex flex-col justify-between text-right text-[10px] font-mono tabular-nums text-zinc-500 pt-5 pb-11 select-none"
                aria-hidden="true"
              >
                <span>{scale.maxY.toFixed(1)}</span>
                <span>{scale.midY.toFixed(1)}</span>
                <span>{scale.minY.toFixed(1)}</span>
              </div>

              {/* Gridlines + Interactive Bars */}
              <div className="flex-1 relative">
                {/* Horizontal Reference Lines */}
                <div
                  className="pointer-events-none absolute inset-x-0 top-5 bottom-11 flex flex-col justify-between"
                  aria-hidden="true"
                >
                  <div className="border-t border-dashed border-white/[0.08]" />
                  <div className="border-t border-dashed border-white/[0.06]" />
                  <div className="border-t border-white/[0.12]" />
                </div>

                {/* Bars Row */}
                <div
                  className="relative z-10 grid items-end gap-1.5 sm:gap-2.5"
                  style={{
                    gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))`,
                  }}
                >
                  {points.map((point, idx) => {
                    const heightPct = Math.max(
                      12,
                      Math.min(
                        100,
                        ((point.starterAvgOvr - scale.minY) / scale.span) * 100
                      )
                    );
                    const isPeak =
                      summary !== null &&
                      point.starterAvgOvr === summary.peakOvr &&
                      point.starterAvgOvr > summary.startOvr;
                    const isSelected = idx === activeIdx;

                    return (
                      <button
                        key={point.id}
                        type="button"
                        onClick={() => setSelectedIdx(idx)}
                        onMouseEnter={() => setSelectedIdx(idx)}
                        onFocus={() => setSelectedIdx(idx)}
                        aria-pressed={isSelected}
                        aria-label={`${point.periodTitle}: OVR médio titular ${point.starterAvgOvr.toFixed(1)} (${point.deltaOvr >= 0 ? '+' : ''}${point.deltaOvr.toFixed(1)}), média de rating ${point.avgRating.toFixed(2)}`}
                        data-testid={`starter-ovr-bar-${idx}`}
                        className="group flex flex-col items-center text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b5ff00] rounded-lg pt-0.5 transition-opacity"
                      >
                        {/* Top OVR Value */}
                        <span
                          className={`text-[11px] font-mono tabular-nums font-bold leading-none mb-1.5 transition-colors ${
                            isSelected
                              ? 'text-white'
                              : 'text-zinc-300 group-hover:text-white'
                          }`}
                        >
                          {point.starterAvgOvr.toFixed(1)}
                        </span>

                        {/* Bar Track */}
                        <div className="w-full h-36 sm:h-40 flex items-end justify-center px-0.5 sm:px-1.5">
                          <div
                            className={`w-full max-w-[44px] rounded-t-md transition-all duration-200 ${getBarColorClasses(
                              point,
                              isPeak,
                              isSelected
                            )}`}
                            style={{ height: `${heightPct}%` }}
                          />
                        </div>

                        {/* X-Axis Period Label + Rating Average */}
                        <div className="w-full pt-2 space-y-0.5">
                          <div
                            className={`text-[11px] font-semibold leading-tight truncate ${
                              isSelected ? 'text-white' : 'text-zinc-400'
                            }`}
                          >
                            {point.label}
                          </div>
                          <div
                            className={`text-[10px] font-mono tabular-nums leading-tight ${getRatingTextClass(
                              point.avgRating
                            )}`}
                            title={`Média de rating dos titulares em ${point.periodTitle}: ${point.avgRating.toFixed(2)}`}
                          >
                            {point.avgRating.toFixed(2)}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Selected Period Detail Strip */}
          {activePoint && (
            <div
              data-testid="starter-ovr-selected-detail"
              className="border-t border-white/[0.08] pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
            >
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-zinc-300">
                <strong className="text-white font-semibold">
                  {activePoint.periodTitle}
                </strong>
                <span className="text-zinc-600" aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  OVR Titular{' '}
                  <strong className="text-white">
                    {activePoint.starterAvgOvr.toFixed(1)}
                  </strong>{' '}
                  <span
                    className={
                      activePoint.deltaOvr > 0
                        ? 'text-[#b5ff00]'
                        : activePoint.deltaOvr < 0
                        ? 'text-rose-400'
                        : 'text-zinc-400'
                    }
                  >
                    ({activePoint.deltaOvr > 0 ? '+' : ''}
                    {activePoint.deltaOvr.toFixed(1)})
                  </span>
                </span>
                <span className="text-zinc-600" aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  Média de Rating{' '}
                  <strong className={getRatingTextClass(activePoint.avgRating)}>
                    {activePoint.avgRating.toFixed(2)}
                  </strong>
                </span>
              </div>
              <div className="text-[11px] text-zinc-400">
                {getRatingFeedbackText(activePoint)}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
