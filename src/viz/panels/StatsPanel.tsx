// Phase 6 — read-only display of Engine statistics. Consumes only
// EngineSnapshot.episode / EngineSnapshot.stats (EngineStats, src/core/engine/types.ts)
// — a pure presentational component, no Engine import, no RL computation.

import type { EngineStats } from '../../core/engine/types'

export interface StatsPanelProps {
  episode: number
  stats: EngineStats
}

function formatReward(value: number): string {
  return value.toFixed(2)
}

function formatSuccessRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`
}

export function StatsPanel({ episode, stats }: StatsPanelProps) {
  return (
    <div className="w-full max-w-md rounded border border-gray-200 p-4 text-sm" data-testid="stats-panel">
      <h2 className="mb-2 font-semibold text-gray-700">Statistics</h2>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
        <dt className="text-gray-500">Episode</dt>
        <dd className="text-right tabular-nums" data-testid="stats-episode">
          {episode}
        </dd>

        <dt className="text-gray-500">Total Reward</dt>
        <dd className="text-right tabular-nums" data-testid="stats-total-reward">
          {formatReward(stats.totalReward)}
        </dd>

        <dt className="text-gray-500">Episode Length</dt>
        <dd className="text-right tabular-nums" data-testid="stats-episode-length">
          {stats.episodeLength}
        </dd>

        <dt className="text-gray-500">Success Rate</dt>
        <dd className="text-right tabular-nums" data-testid="stats-success-rate">
          {formatSuccessRate(stats.successRate)}
        </dd>
      </dl>
    </div>
  )
}
