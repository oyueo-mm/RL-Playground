// Phase 6 — read-only display of Engine statistics. Consumes only
// EngineSnapshot.episode / EngineSnapshot.stats (EngineStats, src/core/engine/types.ts)
// — a pure presentational component, no Engine import, no RL computation.

import type { EngineStats } from '../../core/engine/types'
import { translations, type Dictionary } from '../../ui/i18n'

export interface StatsPanelProps {
  episode: number
  stats: EngineStats
  /** Phase 13 — defaults to English so every pre-existing caller/test is unaffected. */
  t?: Dictionary
}

function formatReward(value: number): string {
  return value.toFixed(2)
}

function formatSuccessRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`
}

export function StatsPanel({ episode, stats, t = translations.en }: StatsPanelProps) {
  return (
    <div className="w-full max-w-md rounded border border-gray-200 p-4 text-sm" data-testid="stats-panel">
      <h2 className="mb-2 font-semibold text-gray-700">{t.stats.heading}</h2>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
        <dt className="text-gray-500">{t.stats.episode}</dt>
        <dd className="text-right tabular-nums" data-testid="stats-episode">
          {episode}
        </dd>

        <dt className="text-gray-500">{t.stats.totalReward}</dt>
        <dd className="text-right tabular-nums" data-testid="stats-total-reward">
          {formatReward(stats.totalReward)}
        </dd>

        <dt className="text-gray-500">{t.stats.episodeLength}</dt>
        <dd className="text-right tabular-nums" data-testid="stats-episode-length">
          {stats.episodeLength}
        </dd>

        <dt className="text-gray-500">{t.stats.successRate}</dt>
        <dd className="text-right tabular-nums" data-testid="stats-success-rate">
          {formatSuccessRate(stats.successRate)}
        </dd>
      </dl>
    </div>
  )
}
