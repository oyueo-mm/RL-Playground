import { memo } from 'react'
import { extent, plotIndices, CHART_POINT_LIMIT } from './chartSampling'
// Phase 25 — small SVG trend charts over episodeStatsHistory (Total Reward / Steps),
// complementing (not replacing) the existing single-metric Reward Chart (RewardChart.tsx,
// left completely untouched by this Phase) with a side-by-side comparison view — Phase
// 24/25 spec's explicit role split: RewardChart = the standalone Total Reward result
// chart, Learning Progress = comparing several metrics' trends together. Same "plain SVG,
// no charting library" approach RewardChart already established (§4.1/§14 across
// phases), and the same selection-highlight mechanism RewardChart gained in Phase 24 —
// reused here via the same `selectedEpisode` prop App.tsx already owns (no new selection
// state, per this Phase's §4).
//
// Both metrics are read directly off the existing EpisodeStats (confirmed by reading
// SimulationEngine.ts's finishEpisode(): totalReward/steps are already computed there) —
// this component never recomputes them, calls Math.random(), or re-runs epsilonGreedy()/
// any Algorithm code.
//
// Phase 28 — the original third chart (Exploration Rate) was removed per that Phase's
// explicit instruction: Exploration Rate is a parameter/behavior statistic rather than
// an Episode *outcome* metric, and was judged lower-value here relative to the screen
// space it used. The underlying `EpisodeStats.explorationRate`/`explorationCount` data
// itself is untouched — StatsPanel's Episode Detail still displays it; only this chart
// was removed. Numeric X/Y axis tick labels were added this same Phase (§7) via the
// shared `niceTicksInDomain()` helper (chartTicks.ts), reused by RewardChart.tsx too.

import type { EpisodeStats } from '../../core/engine/types'
import { translations, type Dictionary } from '../../ui/i18n'
import { niceTicksInDomain } from './chartTicks'

export interface LearningProgressProps {
  episodeStatsHistory: EpisodeStats[]
  /** Phase 25 — same selection App.tsx already owns for StatsPanel/RewardChart (Phase
   * 24); this component never creates its own selection state. */
  selectedEpisode?: number | null
  /** Phase 13 — defaults to English so every pre-existing caller/test is unaffected. */
  t?: Dictionary
}

// Phase 28 §7: same asymmetric-padding reasoning as RewardChart.tsx — extra room on the
// left/bottom for numeric tick labels, additive to the existing plot area.
const PADDING = 8
const PADDING_LEFT = 30
const PADDING_BOTTOM = 14
// Phase 28 §2/§3: widened from 320, same reasoning as RewardChart.tsx's own `width`
// default — all geometry below is parameterized by this constant, not a magic number.
const CHART_WIDTH = 384
const CHART_HEIGHT = 80

interface MiniTrendChartProps {
  points: { episode: number; value: number; index?: number }[]
  totalCount?: number
  domain?: [number, number]
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
  totalCount = points.length,
  domain,
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
  const bounds = extent(values)
  const min = domain?.[0] ?? bounds.min
  const max = domain?.[1] ?? bounds.max
  // All-equal (or single-point) history would otherwise divide by zero — same flat,
  // vertically centered treatment RewardChart.tsx uses.
  const isFlat = max - min < 1e-9

  const innerWidth = CHART_WIDTH - PADDING_LEFT - PADDING
  const innerHeight = CHART_HEIGHT - PADDING - PADDING_BOTTOM

  const plotted = points.map((p, itemIndex) => {
    const index = p.index ?? itemIndex
    const x =
      totalCount === 1 ? PADDING_LEFT + innerWidth / 2 : PADDING_LEFT + (index / (totalCount - 1)) * innerWidth
    const normalized = isFlat ? 0.5 : (p.value - min) / (max - min)
    const y = PADDING + (1 - normalized) * innerHeight
    return { x, y, episode: p.episode, value: p.value }
  })

  const d = plotted.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')

  const selectedPoint = selectedEpisode == null ? undefined : plotted.find((p) => p.episode === selectedEpisode)

  const firstEpisode = points.length > 0 ? points[0].episode : 1
  const lastEpisode = points.length > 0 ? points[points.length - 1].episode : 1
  const xTicks = niceTicksInDomain(firstEpisode, lastEpisode, 4)
  const yTicks = niceTicksInDomain(min, max, 3)

  function xTickPos(tick: number): number {
    if (lastEpisode === firstEpisode) return PADDING_LEFT + innerWidth / 2
    return PADDING_LEFT + ((tick - firstEpisode) / (lastEpisode - firstEpisode)) * innerWidth
  }
  function yTickPos(tick: number): number {
    const normalized = isFlat ? 0.5 : (tick - min) / (max - min)
    return PADDING + (1 - normalized) * innerHeight
  }
  function formatTick(value: number): string {
    return Number(value.toFixed(2)).toString()
  }

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
        {yTicks.map((tick) => (
          <text
            key={`y-${tick}`}
            x={PADDING_LEFT - 4}
            y={yTickPos(tick)}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize={7}
            fill="#6b7280"
            data-testid={`${testIdPrefix}-y-tick-${formatTick(tick)}`}
          >
            {formatTick(tick)}
          </text>
        ))}
        {xTicks.map((tick) => (
          <text
            key={`x-${tick}`}
            x={xTickPos(tick)}
            y={CHART_HEIGHT - PADDING_BOTTOM + 9}
            textAnchor="middle"
            fontSize={7}
            fill="#6b7280"
            data-testid={`${testIdPrefix}-x-tick-${Math.round(tick)}`}
          >
            {Math.round(tick)}
          </text>
        ))}
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
              y2={CHART_HEIGHT - PADDING_BOTTOM}
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

function formatReward(value: number): string {
  return value.toFixed(2)
}

function LearningProgressView({
  episodeStatsHistory,
  selectedEpisode = null,
  t = translations.en,
}: LearningProgressProps) {
  if (episodeStatsHistory.length === 0) {
    return (
      <div
        className="w-full max-w-lg rounded border border-gray-200 p-4 text-sm text-gray-500"
        data-testid="learning-progress-empty"
      >
        {t.learningProgress.empty}
      </div>
    )
  }

  let rewardMin = Infinity, rewardMax = -Infinity, stepsMin = Infinity, stepsMax = -Infinity
  const extrema = [0, 0, 0, 0]
  episodeStatsHistory.forEach((row, index) => {
    if (row.totalReward < rewardMin) { rewardMin = row.totalReward; extrema[0] = index }
    if (row.totalReward > rewardMax) { rewardMax = row.totalReward; extrema[1] = index }
    if (row.steps < stepsMin) { stepsMin = row.steps; extrema[2] = index }
    if (row.steps > stepsMax) { stepsMax = row.steps; extrema[3] = index }
  })
  const indices = plotIndices(episodeStatsHistory.length, [...extrema, episodeStatsHistory.findIndex(row => row.episode === selectedEpisode)])
  return (
    <div
      className="w-full max-w-lg overflow-x-auto rounded border border-gray-200 p-4"
      data-testid="learning-progress"
    >
      <h2 className="mb-2 text-sm font-semibold text-gray-700">{t.learningProgress.heading}</h2>
      {episodeStatsHistory.length > CHART_POINT_LIMIT && <p className="chart-sample-notice">{t.rewardChart.sampledNotice}</p>}
      <div className="flex flex-col gap-3">
        <MiniTrendChart
          totalCount={episodeStatsHistory.length} domain={[rewardMin, rewardMax]} points={indices.map(index => ({ episode: episodeStatsHistory[index].episode, value: episodeStatsHistory[index].totalReward, index }))}
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
          totalCount={episodeStatsHistory.length} domain={[stepsMin, stepsMax]} points={indices.map(index => ({ episode: episodeStatsHistory[index].episode, value: episodeStatsHistory[index].steps, index }))}
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
      </div>
    </div>
  )
}

export const LearningProgress = memo(LearningProgressView)
