// Phase 25 — three small SVG trend charts over episodeStatsHistory (Total Reward /
// Steps / Exploration Rate), complementing (not replacing) the existing single-metric
// Reward Chart (RewardChart.tsx, left completely untouched by this Phase) with a
// side-by-side comparison view — Phase 24/25 spec's explicit role split: RewardChart =
// the standalone Total Reward result chart, Learning Progress = comparing several
// metrics' trends together. Same "plain SVG, no charting library" approach RewardChart
// already established (§4.1/§14 across phases), and the same selection-highlight
// mechanism RewardChart gained in Phase 24 — reused here via the same `selectedEpisode`
// prop App.tsx already owns (no new selection state, per this Phase's §4).
//
// All three metrics are read directly off the existing EpisodeStats (confirmed by
// reading SimulationEngine.ts's finishEpisode(): totalReward/steps/explorationRate are
// all already computed there, explorationRate = explorationCount/steps since Phase 21)
// — this component never recomputes them, calls Math.random(), or re-runs
// epsilonGreedy()/any Algorithm code.

import type { EpisodeStats } from '../../core/engine/types'
import { translations, type Dictionary } from '../../ui/i18n'

export interface LearningProgressProps {
  episodeStatsHistory: EpisodeStats[]
  /** Phase 25 — same selection App.tsx already owns for StatsPanel/RewardChart (Phase
   * 24); this component never creates its own selection state. */
  selectedEpisode?: number | null
  /** Phase 13 — defaults to English so every pre-existing caller/test is unaffected. */
  t?: Dictionary
}

const PADDING = 8
const CHART_WIDTH = 320
const CHART_HEIGHT = 80

interface MiniTrendChartProps {
  points: { episode: number; value: number }[]
  selectedEpisode: number | null
  formatValue: (value: number) => string
  color: string
  heading: string
  description: string
  ariaLabel: string
  xAxisLabel: string
  yAxisLabel: string
  selectedEpisodeLabel: string
  testIdPrefix: string
}

/** Phase 25 — same normalization/flat-guard/path-building algorithm as RewardChart.tsx
 * (kept local rather than importing from there, so RewardChart.tsx stays fully
 * untouched per this Phase's §3 "don't replace the existing Reward Chart"). */
function MiniTrendChart({
  points,
  selectedEpisode,
  formatValue,
  color,
  heading,
  description,
  ariaLabel,
  xAxisLabel,
  yAxisLabel,
  selectedEpisodeLabel,
  testIdPrefix,
}: MiniTrendChartProps) {
  const values = points.map((p) => p.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  // All-equal (or single-point) history would otherwise divide by zero — same flat,
  // vertically centered treatment RewardChart.tsx uses.
  const isFlat = max - min < 1e-9

  const innerWidth = CHART_WIDTH - PADDING * 2
  const innerHeight = CHART_HEIGHT - PADDING * 2

  const plotted = points.map((p, index) => {
    const x = points.length === 1 ? PADDING + innerWidth / 2 : PADDING + (index / (points.length - 1)) * innerWidth
    const normalized = isFlat ? 0.5 : (p.value - min) / (max - min)
    const y = PADDING + (1 - normalized) * innerHeight
    return { x, y, episode: p.episode, value: p.value }
  })

  const d = plotted.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')

  const selectedPoint = selectedEpisode == null ? undefined : plotted.find((p) => p.episode === selectedEpisode)

  return (
    <div className="rounded border border-gray-100 p-2" data-testid={`${testIdPrefix}-chart`}>
      <h3 className="mb-1 text-xs font-semibold text-gray-600">{heading}</h3>
      <svg
        width={CHART_WIDTH}
        height={CHART_HEIGHT}
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="img"
        aria-label={ariaLabel}
        data-testid={`${testIdPrefix}-svg`}
      >
        <path d={d} fill="none" stroke={color} strokeWidth={2} data-testid={`${testIdPrefix}-path`} />
        {plotted.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={1.5} fill={color} />
        ))}
        {selectedPoint && (
          <>
            <line
              x1={selectedPoint.x}
              y1={PADDING}
              x2={selectedPoint.x}
              y2={CHART_HEIGHT - PADDING}
              stroke="#f97316"
              strokeWidth={1}
              strokeDasharray="3 2"
              data-testid={`${testIdPrefix}-selected-guide`}
            />
            <circle
              cx={selectedPoint.x}
              cy={selectedPoint.y}
              r={3.5}
              fill="#f97316"
              stroke="white"
              strokeWidth={1.5}
              data-testid={`${testIdPrefix}-selected-point`}
            />
          </>
        )}
      </svg>
      {selectedPoint && (
        <p className="mt-0.5 text-xs text-orange-600" data-testid={`${testIdPrefix}-selected-label`}>
          {selectedEpisodeLabel}: {selectedEpisode} ({formatValue(selectedPoint.value)})
        </p>
      )}
      <p className="mt-0.5 text-xs text-gray-500">
        <span data-testid={`${testIdPrefix}-x-axis`}>X: {xAxisLabel}</span>
        {' · '}
        <span data-testid={`${testIdPrefix}-y-axis`}>Y: {yAxisLabel}</span>
      </p>
      <p className="text-xs text-gray-400" data-testid={`${testIdPrefix}-description`}>
        {description}
      </p>
    </div>
  )
}

function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`
}

function formatReward(value: number): string {
  return value.toFixed(2)
}

export function LearningProgress({
  episodeStatsHistory,
  selectedEpisode = null,
  t = translations.en,
}: LearningProgressProps) {
  if (episodeStatsHistory.length === 0) {
    return (
      <div
        className="w-full max-w-md rounded border border-gray-200 p-4 text-sm text-gray-500"
        data-testid="learning-progress-empty"
      >
        {t.learningProgress.empty}
      </div>
    )
  }

  return (
    <div
      className="w-full max-w-md overflow-x-auto rounded border border-gray-200 p-4"
      data-testid="learning-progress"
    >
      <h2 className="mb-2 text-sm font-semibold text-gray-700">{t.learningProgress.heading}</h2>
      <div className="flex flex-col gap-3">
        <MiniTrendChart
          points={episodeStatsHistory.map((e) => ({ episode: e.episode, value: e.totalReward }))}
          selectedEpisode={selectedEpisode}
          formatValue={formatReward}
          color="#2563eb"
          heading={t.stats.totalReward}
          description={t.learningProgress.totalRewardDescription}
          ariaLabel={t.learningProgress.totalRewardAriaLabel}
          xAxisLabel={t.rewardChart.xAxisLabel}
          yAxisLabel={t.stats.totalReward}
          selectedEpisodeLabel={t.rewardChart.selectedEpisodeLabel}
          testIdPrefix="learning-progress-total-reward"
        />
        <MiniTrendChart
          points={episodeStatsHistory.map((e) => ({ episode: e.episode, value: e.steps }))}
          selectedEpisode={selectedEpisode}
          formatValue={(v) => `${v}`}
          color="#16a34a"
          heading={t.stats.steps}
          description={t.learningProgress.stepsDescription}
          ariaLabel={t.learningProgress.stepsAriaLabel}
          xAxisLabel={t.rewardChart.xAxisLabel}
          yAxisLabel={t.stats.steps}
          selectedEpisodeLabel={t.rewardChart.selectedEpisodeLabel}
          testIdPrefix="learning-progress-steps"
        />
        <MiniTrendChart
          points={episodeStatsHistory.map((e) => ({ episode: e.episode, value: e.explorationRate }))}
          selectedEpisode={selectedEpisode}
          formatValue={formatPercent}
          color="#9333ea"
          heading={t.stats.explorationRate}
          description={t.learningProgress.explorationRateDescription}
          ariaLabel={t.learningProgress.explorationRateAriaLabel}
          xAxisLabel={t.rewardChart.xAxisLabel}
          yAxisLabel={t.stats.explorationRate}
          selectedEpisodeLabel={t.rewardChart.selectedEpisodeLabel}
          testIdPrefix="learning-progress-exploration-rate"
        />
      </div>
    </div>
  )
}
