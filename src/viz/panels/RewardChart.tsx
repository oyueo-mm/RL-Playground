// Phase 6 — simple SVG line chart over EngineSnapshot.stats.rewardHistory. Pure
// presentational component: rendering is determined entirely by the `rewardHistory`
// prop, no Engine access and no simulation triggered from here (Phase 6 §12).
// Plain React + SVG + Tailwind only — no charting library (§4.1/§14).
//
// Phase 24 — optionally highlights the point for a selected Episode (StatsPanel's
// Episode History selection). `rewardHistory` itself carries no Episode identity (it's
// just `number[]`), so the caller also passes `episodeNumbers` — the parallel array of
// real Episode numbers, i.e. `episodeStatsHistory.map(e => e.episode)`. Both
// `rewardHistory` and `episodeStatsHistory` are pushed and 200-capped together in the
// same SimulationEngine.ts finishEpisode() call (confirmed by reading the code), so
// they're always the same length and in the same order — `episodeNumbers.indexOf(...)`
// is therefore always the correct point index, with no separate offset math needed even
// once the 200-entry cap has started shifting older entries out.

import { translations, type Dictionary } from '../../ui/i18n'

export interface RewardChartProps {
  rewardHistory: number[]
  width?: number
  height?: number
  /** Phase 13 — defaults to English so every pre-existing caller/test is unaffected. */
  t?: Dictionary
  /** Phase 24 — parallel to rewardHistory (same length/order). Omit to disable
   * highlighting entirely (pre-Phase-24 callers/tests are unaffected). */
  episodeNumbers?: number[]
  /** Phase 24 — which Episode to highlight, or null/omitted for no highlight. */
  selectedEpisode?: number | null
}

const PADDING = 8

export function RewardChart({
  rewardHistory,
  width = 320,
  height = 120,
  t = translations.en,
  episodeNumbers = [],
  selectedEpisode = null,
}: RewardChartProps) {
  if (rewardHistory.length === 0) {
    return (
      <div
        className="w-full max-w-md rounded border border-gray-200 p-4 text-sm text-gray-500"
        data-testid="reward-chart-empty"
      >
        {t.rewardChart.empty}
      </div>
    )
  }

  const min = Math.min(...rewardHistory)
  const max = Math.max(...rewardHistory)
  // All-equal (or single-point) reward history would otherwise divide by zero — treat
  // it as a flat, vertically centered line instead of letting NaN/Infinity through.
  const isFlat = max - min < 1e-9

  const innerWidth = width - PADDING * 2
  const innerHeight = height - PADDING * 2

  const points = rewardHistory.map((value, index) => {
    const x =
      rewardHistory.length === 1 ? PADDING + innerWidth / 2 : PADDING + (index / (rewardHistory.length - 1)) * innerWidth
    const normalized = isFlat ? 0.5 : (value - min) / (max - min)
    // Higher reward renders higher on the chart (smaller y = up in SVG coordinates).
    const y = PADDING + (1 - normalized) * innerHeight
    return { x, y }
  })

  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')

  const selectedIndex = selectedEpisode == null ? -1 : episodeNumbers.indexOf(selectedEpisode)
  const selectedPoint = selectedIndex >= 0 ? points[selectedIndex] : undefined

  return (
    <div className="w-full max-w-md overflow-x-auto rounded border border-gray-200 p-4" data-testid="reward-chart">
      <h2 className="mb-2 text-sm font-semibold text-gray-700">{t.rewardChart.heading}</h2>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={t.rewardChart.ariaLabel}
        data-testid="reward-chart-svg"
      >
        <path d={d} fill="none" stroke="#2563eb" strokeWidth={2} data-testid="reward-chart-path" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2} fill="#2563eb" />
        ))}
        {selectedPoint && (
          <>
            <line
              x1={selectedPoint.x}
              y1={PADDING}
              x2={selectedPoint.x}
              y2={height - PADDING}
              stroke="#f97316"
              strokeWidth={1}
              strokeDasharray="3 2"
              data-testid="reward-chart-selected-guide"
            />
            <circle
              cx={selectedPoint.x}
              cy={selectedPoint.y}
              r={4.5}
              fill="#f97316"
              stroke="white"
              strokeWidth={1.5}
              data-testid="reward-chart-selected-point"
            />
          </>
        )}
      </svg>
      {selectedPoint && (
        <p className="mt-1 text-xs text-orange-600" data-testid="reward-chart-selected-label">
          {t.rewardChart.selectedEpisodeLabel}: {selectedEpisode}
        </p>
      )}
      {/*
        Phase 19: the chart's actual data source (SimulationEngine.ts finishEpisode()) —
        confirmed by reading the code, not assumed — is: one point is pushed per
        completed Episode (X, left-to-right = Episode sequence), and its value is
        `episodeReward`, the sum of every step's reward across that whole Episode
        (Y = Total Reward). These two lines just make that explicit instead of leaving
        the reader to infer it from an unlabeled line chart.
      */}
      <p className="mt-1 text-xs text-gray-500">
        <span data-testid="reward-chart-x-axis">X: {t.rewardChart.xAxisLabel}</span>
        {' · '}
        <span data-testid="reward-chart-y-axis">Y: {t.rewardChart.yAxisLabel}</span>
      </p>
      <p className="text-xs text-gray-400" data-testid="reward-chart-description">
        {t.rewardChart.description}
      </p>
    </div>
  )
}
