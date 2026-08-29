// Phase 6 — read-only display of Engine statistics. Consumes only
// EngineSnapshot.episode / EngineSnapshot.stats (EngineStats, src/core/engine/types.ts)
// — a pure presentational component, no Engine import, no RL computation.
//
// Phase 21 extends this with per-Episode statistics (EpisodeStats, already computed by
// SimulationEngine.ts's finishEpisode() and carried on EngineStats.latestEpisodeStats /
// episodeStatsHistory) — no new computation happens here either, this only formats and
// displays values the Engine already produced.
//
// Phase 24 — lets the user click an Episode History row to see that Episode's detail
// (the same fields the Latest Episode card already shows, factored into EpisodeStatsCard
// below and reused for both). `selectedEpisode` is owned by the caller (App.tsx), same
// pattern as `selectedState`/GridSvg — this component only reports clicks upward via
// `onSelectEpisode`, it never mutates its own idea of "what's selected". No new Core
// computation: `explorationRate`/`averageReward` were already on EpisodeStats since Phase
// 21; only `exploitationRate` is new, and it's derived here from the existing
// exploitationCount/steps fields (never stored in Core) via the same
// explorationCount + exploitationCount === steps invariant Phase 21 established.

import type { EngineStats, EpisodeStats, EpisodeTerminationReason } from '../../core/engine/types'
import type { StateKey } from '../../core/types/rl'
import { translations, type Dictionary } from '../../ui/i18n'

export interface StatsPanelProps {
  episode: number
  stats: EngineStats
  /** Phase 13 — defaults to English so every pre-existing caller/test is unaffected. */
  t?: Dictionary
  /** Phase 24 — which Episode History row (by its real Episode number, not array index)
   * is currently selected for the Episode Detail card. `null`/omitted = no selection. */
  selectedEpisode?: number | null
  /** Phase 24 — called with an Episode's number when its History row is activated
   * (click, or Enter/Space while focused). Omitted in existing callers/tests — rows
   * still render and are focusable, they just have nothing to report to. */
  onSelectEpisode?: (episode: number) => void
  /**
   * Phase 30 — the current Environment's Goal positions, used only to compute each
   * Episode's "N / M Goals Collected" display from its own `trajectory` (already stored
   * on EpisodeStats since Phase 26) — no new Core storage. Omitted/empty for a
   * single-Goal (or non-grid) Environment, in which case the row is not shown at all.
   *
   * Phase 44 — MUST be the full, static Goal list (`EnvRenderModel.allGoals`), never
   * `EnvRenderModel.goals` (which shrinks as Goals are collected — see render.ts). The
   * caller (App.tsx) previously passed the live-shrinking list here by mistake: since
   * `collectedGoalCount()` below counts how many of THIS prop's entries appear in the
   * trajectory, feeding it an already-shrunk list corrupted both the numerator and the
   * denominator identically (e.g. "31/31" collapsing to "30/30", "29/29", ... on every
   * single Goal collected, and the ratio never reaching the Episode's true total).
   */
  goals?: StateKey[]
}

/**
 * Phase 30 — distinct Goal positions visited at least once in this Episode's trajectory.
 *
 * Phase 34: `goals` (from `EnvRenderModel.goals`) stays a plain "x,y" position list, but
 * `trajectory[].nextState` is now the richer RL State "x,y,mask" (GridWorldEnv.ts's file
 * header) — a raw membership check would never match. `statePosition()` strips the mask
 * segment back off before comparing, restoring the original position-only comparison.
 */
function statePosition(state: StateKey): StateKey {
  const [x, y] = state.split(',')
  return `${x},${y}`
}

function collectedGoalCount(stats: EpisodeStats, goals: StateKey[]): number {
  const visited = new Set(stats.trajectory.map((t) => statePosition(t.nextState)))
  return goals.filter((g) => visited.has(g)).length
}

function formatReward(value: number): string {
  return value.toFixed(2)
}

function formatSuccessRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`
}

function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`
}

/** Phase 24 — exploitationCount/steps, guarded the same way EpisodeStats.explorationRate
 * already is (steps is always >= 1 by the time an Episode can finish, per
 * SimulationEngine.ts's finishEpisode(), but guarded anyway). */
function exploitationRate(stats: EpisodeStats): number {
  return stats.steps > 0 ? stats.exploitationCount / stats.steps : 0
}

// Core retains up to REWARD_HISTORY_LIMIT (200) entries for episodeStatsHistory, same as
// rewardHistory — but a raw HTML table showing 200 rows would be unusable. This caps how
// many of the most-recent entries the table actually renders; it does not affect what
// Core stores or what other consumers (a future Reward Chart tooltip, etc.) could read.
const EPISODE_HISTORY_DISPLAY_LIMIT = 10

export function StatsPanel({
  episode,
  stats,
  t = translations.en,
  selectedEpisode = null,
  onSelectEpisode,
  goals = [],
}: StatsPanelProps) {
  const terminationLabel: Record<EpisodeTerminationReason, string> = {
    goal: t.stats.terminationGoal,
    bomb: t.stats.terminationBomb,
    other: t.stats.terminationOther,
  }

  const recentEpisodes = stats.episodeStatsHistory.slice(-EPISODE_HISTORY_DISPLAY_LIMIT).reverse()
  // Phase 24 §6/§8: looked up by the real Episode number (not an array index), so this
  // is automatically correct even after the 200-entry cap has shifted older entries out
  // — and automatically becomes null (safe empty state) once the selected Episode is no
  // longer in history, with no separate "is it still there?" bookkeeping needed.
  const selectedEpisodeStats =
    selectedEpisode == null ? null : (stats.episodeStatsHistory.find((row) => row.episode === selectedEpisode) ?? null)

  return (
    <div className="w-full max-w-lg rounded border border-gray-200 p-4 text-sm" data-testid="stats-panel">
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

      <h3 className="mt-4 mb-2 font-semibold text-gray-700">{t.stats.latestEpisodeHeading}</h3>
      {stats.latestEpisodeStats === null ? (
        <p className="text-gray-500" data-testid="latest-episode-empty">
          {t.stats.latestEpisodeEmpty}
        </p>
      ) : (
        <EpisodeStatsCard stats={stats.latestEpisodeStats} t={t} terminationLabel={terminationLabel} testIdPrefix="latest-episode" goals={goals} />
      )}

      <h3 className="mt-4 mb-2 font-semibold text-gray-700">{t.stats.episodeHistoryHeading}</h3>
      {recentEpisodes.length === 0 ? (
        <p className="text-gray-500" data-testid="episode-history-empty">
          {t.stats.episodeHistoryEmpty}
        </p>
      ) : (
        <div className="overflow-x-auto" data-testid="episode-history">
          {/* Phase 36 — rows have been clickable/keyboard-focusable since Phase 24
              (cursor-pointer + tabIndex + Enter/Space), but nothing said so up front.
              Same quiet-caption pattern EnvEditor.tsx already uses for draftPreview. */}
          <p className="mb-1 text-xs text-gray-500" data-testid="episode-history-hint">
            {t.stats.episodeHistoryHint}
          </p>
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="text-gray-500">
                <th scope="col" className="text-left font-medium">
                  {t.stats.episode}
                </th>
                <th scope="col" className="font-medium">
                  {t.stats.steps}
                </th>
                <th scope="col" className="font-medium">
                  {t.stats.totalReward}
                </th>
                <th scope="col" className="font-medium">
                  {t.stats.termination}
                </th>
                <th scope="col" className="font-medium">
                  {t.stats.explorationRate}
                </th>
              </tr>
            </thead>
            <tbody>
              {recentEpisodes.map((row) => {
                const isSelected = row.episode === selectedEpisode
                const selectRow = () => onSelectEpisode?.(row.episode)
                return (
                  <tr
                    key={row.episode}
                    className={`tabular-nums cursor-pointer focus:outline focus:outline-2 focus:outline-blue-500 ${
                      isSelected ? 'bg-blue-50' : ''
                    }`}
                    data-testid={`episode-history-row-${row.episode}`}
                    data-selected={isSelected ? 'true' : undefined}
                    tabIndex={0}
                    onClick={selectRow}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        selectRow()
                      }
                    }}
                  >
                    <td className="text-left">{row.episode}</td>
                    <td>{row.steps}</td>
                    <td>{formatReward(row.totalReward)}</td>
                    <td>{terminationLabel[row.terminationReason]}</td>
                    <td>{formatPercent(row.explorationRate)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="mt-4 mb-2 font-semibold text-gray-700">{t.stats.episodeDetailHeading}</h3>
      {selectedEpisodeStats === null ? (
        <p className="text-gray-500" data-testid="episode-detail-empty">
          {t.stats.episodeDetailEmpty}
        </p>
      ) : (
        <EpisodeStatsCard stats={selectedEpisodeStats} t={t} terminationLabel={terminationLabel} testIdPrefix="episode-detail" goals={goals} />
      )}
    </div>
  )
}

interface EpisodeStatsCardProps {
  stats: EpisodeStats
  t: Dictionary
  terminationLabel: Record<EpisodeTerminationReason, string>
  testIdPrefix: string
  goals: StateKey[]
}

/** Phase 24 — generic card for one EpisodeStats, reused for both "Latest Episode"
 * (testIdPrefix="latest-episode", exact same testids as before Phase 24 — see
 * StatsPanel.test.tsx's pre-Phase-24 assertions) and the new "Episode Detail"
 * (testIdPrefix="episode-detail"). */
function EpisodeStatsCard({ stats, t, terminationLabel, testIdPrefix, goals }: EpisodeStatsCardProps) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1" data-testid={testIdPrefix}>
      {goals.length > 1 && (
        <>
          <dt className="text-gray-500">{t.stats.goalsCollected}</dt>
          <dd className="text-right tabular-nums" data-testid={`${testIdPrefix}-goals-collected`}>
            {collectedGoalCount(stats, goals)} / {goals.length}
          </dd>
        </>
      )}
      <dt className="text-gray-500">{t.stats.episode}</dt>
      <dd className="text-right tabular-nums" data-testid={`${testIdPrefix}-number`}>
        {stats.episode}
      </dd>

      <dt className="text-gray-500">{t.stats.steps}</dt>
      <dd className="text-right tabular-nums" data-testid={`${testIdPrefix}-steps`}>
        {stats.steps}
      </dd>

      <dt className="text-gray-500">{t.stats.totalReward}</dt>
      <dd className="text-right tabular-nums" data-testid={`${testIdPrefix}-total-reward`}>
        {formatReward(stats.totalReward)}
      </dd>

      <dt className="text-gray-500">{t.stats.termination}</dt>
      <dd className="text-right" data-testid={`${testIdPrefix}-termination`}>
        {terminationLabel[stats.terminationReason]}
      </dd>

      <dt className="text-gray-500">{t.stats.exploration}</dt>
      <dd className="text-right tabular-nums" data-testid={`${testIdPrefix}-exploration`}>
        {stats.explorationCount}
      </dd>

      <dt className="text-gray-500">{t.stats.exploitation}</dt>
      <dd className="text-right tabular-nums" data-testid={`${testIdPrefix}-exploitation`}>
        {stats.exploitationCount}
      </dd>

      <dt className="text-gray-500">{t.stats.explorationRate}</dt>
      <dd className="text-right tabular-nums" data-testid={`${testIdPrefix}-exploration-rate`}>
        {formatPercent(stats.explorationRate)}
      </dd>

      <dt className="text-gray-500">{t.stats.exploitationRate}</dt>
      <dd className="text-right tabular-nums" data-testid={`${testIdPrefix}-exploitation-rate`}>
        {formatPercent(exploitationRate(stats))}
      </dd>

      <dt className="text-gray-500">{t.stats.averageReward}</dt>
      <dd className="text-right tabular-nums" data-testid={`${testIdPrefix}-average-reward`}>
        {formatReward(stats.averageReward)}
      </dd>

      <dt className="text-gray-500">{t.stats.uniqueStates}</dt>
      <dd className="text-right tabular-nums" data-testid={`${testIdPrefix}-unique-states`}>
        {stats.uniqueStates}
      </dd>
    </dl>
  )
}
