// Phase 26 — the selected Episode's full step-by-step trajectory (state → action →
// reward → nextState), read directly from EpisodeStats.trajectory (Core, added this
// Phase — see SimulationEngine.ts's Phase 26 comments for why no existing field could
// have been reused). This is the authoritative, always-exact text record of the Episode
// — TrajectoryOverlay.tsx's Grid drawing is a visual aid alongside it, never the only
// place this information is available (Phase 26 §17 accessibility requirement).
//
// Same Episode Selection this panel's siblings (StatsPanel's Episode Detail, RewardChart,
// LearningProgress) already use — no separate selection state (Phase 26 §8/§9).

import { useState } from 'react'
import type { EpisodeStats, EpisodeTerminationReason } from '../../core/engine/types'
import { actionLabel } from '../grid/actionLabels'
import { describeTrajectoryTruncation, translateActionLabel, translations, type Dictionary, type Locale } from '../../ui/i18n'

export interface EpisodeTrajectoryProps {
  episodeStatsHistory: EpisodeStats[]
  selectedEpisode?: number | null
  /** Phase 13 — defaults to English so every pre-existing caller/test is unaffected. */
  t?: Dictionary
  locale?: Locale
}

function formatReward(value: number): string {
  return value.toFixed(2)
}

// A capped initial view avoids rendering thousands of DOM rows for a very long Episode
// by default (Phase 26 §7 performance guidance) — the "Show all steps" toggle below lets
// the user see the complete trajectory on demand, so nothing is ever hidden permanently.
const STEP_DISPLAY_LIMIT = 50

export function EpisodeTrajectory({
  episodeStatsHistory,
  selectedEpisode = null,
  t = translations.en,
  locale = 'en',
}: EpisodeTrajectoryProps) {
  const [showAll, setShowAll] = useState(false)

  const episode = selectedEpisode == null ? null : (episodeStatsHistory.find((e) => e.episode === selectedEpisode) ?? null)

  if (episode === null) {
    return (
      <div
        className="w-full max-w-lg rounded border border-gray-200 p-4 text-sm text-gray-500"
        data-testid="episode-trajectory-empty"
      >
        {t.episodeTrajectory.empty}
      </div>
    )
  }

  const terminationLabel: Record<EpisodeTerminationReason, string> = {
    goal: t.stats.terminationGoal,
    bomb: t.stats.terminationBomb,
    other: t.stats.terminationOther,
  }

  const trajectory = episode.trajectory
  const visibleSteps = showAll ? trajectory : trajectory.slice(0, STEP_DISPLAY_LIMIT)
  const truncated = !showAll && trajectory.length > STEP_DISPLAY_LIMIT
  const lastTransition = trajectory[trajectory.length - 1]

  return (
    <div
      className="w-full max-w-lg overflow-x-auto rounded border border-gray-200 p-4 text-sm"
      data-testid="episode-trajectory"
    >
      <h2 className="mb-2 font-semibold text-gray-700">
        {t.episodeTrajectory.heading} — {t.stats.episode} {episode.episode}
      </h2>

      <dl className="mb-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <dt className="text-gray-500">{t.episodeTrajectory.start}</dt>
        <dd className="text-right tabular-nums" data-testid="episode-trajectory-start">
          {trajectory.length > 0 ? trajectory[0].state : ''}
        </dd>
        <dt className="text-gray-500">{t.stats.steps}</dt>
        <dd className="text-right tabular-nums" data-testid="episode-trajectory-step-count">
          {trajectory.length}
        </dd>
        <dt className="text-gray-500">{t.episodeTrajectory.nextState}</dt>
        <dd className="text-right tabular-nums" data-testid="episode-trajectory-end">
          {lastTransition ? lastTransition.nextState : ''}
        </dd>
        <dt className="text-gray-500">{t.stats.termination}</dt>
        <dd className="text-right" data-testid="episode-trajectory-termination">
          {terminationLabel[episode.terminationReason]}
        </dd>
      </dl>

      <div className="max-h-64 overflow-y-auto" data-testid="episode-trajectory-steps">
        <table className="w-full text-right text-xs">
          <thead>
            <tr className="text-gray-500">
              <th scope="col" className="text-left font-medium">
                {t.episodeTrajectory.step}
              </th>
              <th scope="col" className="font-medium">
                {t.inspector.state}
              </th>
              <th scope="col" className="font-medium">
                {t.inspector.action}
              </th>
              <th scope="col" className="font-medium">
                {t.inspector.reward}
              </th>
              <th scope="col" className="font-medium">
                {t.episodeTrajectory.nextState}
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleSteps.map((step, index) => (
              <tr key={index} className="tabular-nums" data-testid={`trajectory-step-row-${index}`}>
                <td className="text-left">{index}</td>
                <td data-testid={`trajectory-step-state-${index}`}>{step.state}</td>
                <td data-testid={`trajectory-step-action-${index}`}>
                  {translateActionLabel(actionLabel(step.action), locale)}
                </td>
                <td data-testid={`trajectory-step-reward-${index}`}>{formatReward(step.reward)}</td>
                <td data-testid={`trajectory-step-next-state-${index}`}>{step.nextState}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {trajectory.length > STEP_DISPLAY_LIMIT && (
        <div className="mt-2">
          {truncated && (
            <p className="mb-1 text-xs text-gray-400" data-testid="episode-trajectory-truncated-note">
              {describeTrajectoryTruncation(STEP_DISPLAY_LIMIT, trajectory.length, locale)}
            </p>
          )}
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            data-testid="episode-trajectory-toggle-show-all"
            className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
          >
            {showAll ? t.episodeTrajectory.showFewer : t.episodeTrajectory.showAll}
          </button>
        </div>
      )}
    </div>
  )
}
