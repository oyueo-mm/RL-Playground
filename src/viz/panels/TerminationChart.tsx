// Phase 28 §10 — bar chart of how completed Episodes ended (Goal / Bomb / Other),
// aggregated entirely from the existing `episodeStatsHistory` (each EpisodeStats already
// carries `terminationReason`, computed once by SimulationEngine.ts's classifyTermination()
// since Phase 21 — see StatsPanel.tsx's identical terminationLabel map for precedent).
// No new Core data, no new termination classification: this component only counts values
// that already exist. Plain SVG, no charting library (§4.1/§14 across every prior phase).
//
// Shows the distribution across ALL of episodeStatsHistory regardless of any selected
// Episode — StatsPanel's Episode Detail already covers "this one Episode's termination",
// so this deliberately does not duplicate that (§10's own "선택 Episode와의 관계" note).

import type { EpisodeStats, EpisodeTerminationReason } from '../../core/engine/types'
import { translations, type Dictionary } from '../../ui/i18n'

export interface TerminationChartProps {
  episodeStatsHistory: EpisodeStats[]
  /** Phase 13 — defaults to English so every pre-existing caller/test is unaffected. */
  t?: Dictionary
}

const CHART_WIDTH = 384
const BAR_HEIGHT = 18
const BAR_GAP = 10
const PADDING = 8
const LABEL_WIDTH = 56
const COUNT_WIDTH = 32

const REASONS: EpisodeTerminationReason[] = ['goal', 'bomb', 'other']
const BAR_COLOR: Record<EpisodeTerminationReason, string> = {
  goal: '#22c55e',
  bomb: '#ef4444',
  other: '#9ca3af',
}

export function TerminationChart({ episodeStatsHistory, t = translations.en }: TerminationChartProps) {
  if (episodeStatsHistory.length === 0) {
    return (
      <div
        className="w-full max-w-lg rounded border border-gray-200 p-4 text-sm text-gray-500"
        data-testid="termination-chart-empty"
      >
        {t.stats.terminationChartEmpty}
      </div>
    )
  }

  // Aggregation only — no re-classification. Each Episode's terminationReason was
  // already decided once, by finishEpisode(), when it completed.
  const counts: Record<EpisodeTerminationReason, number> = { goal: 0, bomb: 0, other: 0 }
  for (const ep of episodeStatsHistory) counts[ep.terminationReason] += 1

  const label: Record<EpisodeTerminationReason, string> = {
    goal: t.stats.terminationGoal,
    bomb: t.stats.terminationBomb,
    other: t.stats.terminationOther,
  }

  const maxCount = Math.max(1, ...REASONS.map((r) => counts[r])) // guards a 0/0 division below
  const barAreaWidth = CHART_WIDTH - PADDING * 2 - LABEL_WIDTH - COUNT_WIDTH
  const chartHeight = PADDING * 2 + REASONS.length * BAR_HEIGHT + (REASONS.length - 1) * BAR_GAP

  return (
    <div
      className="w-full max-w-lg overflow-x-auto rounded border border-gray-200 p-4"
      data-testid="termination-chart"
    >
      <h2 className="mb-2 text-sm font-semibold text-gray-700">{t.stats.terminationChartHeading}</h2>
      <svg
        width={CHART_WIDTH}
        height={chartHeight}
        viewBox={`0 0 ${CHART_WIDTH} ${chartHeight}`}
        role="img"
        aria-label={t.stats.terminationChartAriaLabel}
        data-testid="termination-chart-svg"
      >
        {REASONS.map((reason, i) => {
          const y = PADDING + i * (BAR_HEIGHT + BAR_GAP)
          const count = counts[reason]
          // A 0-count bar still renders (as a hairline-width, effectively invisible bar)
          // rather than being omitted — the label/count row itself is always present, per
          // §10's "0인 범주도 표시한다".
          const barWidth = (count / maxCount) * barAreaWidth
          return (
            <g key={reason} data-testid={`termination-chart-bar-${reason}`}>
              <text x={PADDING} y={y + BAR_HEIGHT / 2} dominantBaseline="middle" fontSize={11} fill="#374151">
                {label[reason]}
              </text>
              <rect
                x={PADDING + LABEL_WIDTH}
                y={y}
                width={barWidth}
                height={BAR_HEIGHT}
                fill={BAR_COLOR[reason]}
                data-testid={`termination-chart-bar-${reason}-rect`}
              />
              <text
                x={PADDING + LABEL_WIDTH + barAreaWidth + 4}
                y={y + BAR_HEIGHT / 2}
                dominantBaseline="middle"
                fontSize={11}
                fill="#374151"
                data-testid={`termination-chart-count-${reason}`}
              >
                {count}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
