// Phase 6 — simple SVG line chart over EngineSnapshot.stats.rewardHistory. Pure
// presentational component: rendering is determined entirely by the `rewardHistory`
// prop, no Engine access and no simulation triggered from here (Phase 6 §12).
// Plain React + SVG + Tailwind only — no charting library (§4.1/§14).

import { translations, type Dictionary } from '../../ui/i18n'

export interface RewardChartProps {
  rewardHistory: number[]
  width?: number
  height?: number
  /** Phase 13 — defaults to English so every pre-existing caller/test is unaffected. */
  t?: Dictionary
}

const PADDING = 8

export function RewardChart({ rewardHistory, width = 320, height = 120, t = translations.en }: RewardChartProps) {
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
      </svg>
    </div>
  )
}
