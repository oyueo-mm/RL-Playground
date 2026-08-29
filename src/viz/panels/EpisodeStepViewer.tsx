// Phase 46 — scrubs through a selected Episode's individual Steps via a slider, extending
// the existing "click an Episode to see its path" feature (StatsPanel's Episode History +
// TrajectoryOverlay/EpisodeTrajectory, Phase 24/26) with per-Step exploration.
//
// Strictly READ-ONLY: this component owns no Engine/Q-table access at all (no `engine`
// import, same as every other panel in src/viz/panels) and its `step`/`onStepChange` are
// fully controlled by the caller (App.tsx) — moving the slider only ever changes which
// already-recorded historical Step is being displayed, never the live Simulation/Agent/
// Q-table state (Phase 46's own "Step Viewer는 읽기 전용 시각화여야 한다" requirement).
//
// Reconstructs the Step's Agent position and Multi-Goal collection state directly from
// `EpisodeStats.trajectory` (a Transition[] of StateKeys already carrying "x,y,mask", see
// GridWorldEnv.ts's file header) via stateKey.ts's existing parseStateKey()/stateMask() —
// confirmed sufficient without any new Core/Engine storage (Phase 46 §6/§7's own "먼저
// 확인, 충분하면 기존 구조 활용" requirement).

import { useEffect, useState } from 'react'
import type { EpisodeStats } from '../../core/engine/types'
import type { StateKey } from '../../core/types/rl'
import { stateMask } from '../grid/stateKey'
import { translations, type Dictionary } from '../../ui/i18n'

export interface EpisodeStepViewerProps {
  episode: EpisodeStats | null
  step: number
  onStepChange: (step: number) => void
  /** Phase 44's `EnvRenderModel.allGoals` — the static, full Goal list. Empty/omitted for
   * a single-Goal (or non-grid) Environment, in which case no Goals line is shown, same
   * convention StatsPanel's EpisodeStatsCard already uses. */
  allGoals?: StateKey[]
  /** Phase 13 — defaults to English so every pre-existing caller/test is unaffected. */
  t?: Dictionary
}

const AUTO_PLAY_INTERVAL_MS = 400

/** Bit `i` of a GridWorld goal-mask StateKey segment is set iff `allGoals[i]` was
 * collected by that point — same encoding as GridWorldEnv.ts's private goalsMask(). */
function collectedCount(mask: string | undefined, totalGoals: number): number {
  const value = mask === undefined ? 0 : Number(mask)
  if (!Number.isFinite(value)) return 0
  let count = 0
  for (let i = 0; i < totalGoals; i++) {
    if (value & (1 << i)) count++
  }
  return count
}

/** The StateKey actually occupied at `step` (0..trajectory.length): each trajectory entry
 * records its own *starting* state, so the final position (step === trajectory.length)
 * has to come from the last entry's `nextState` instead — same convention
 * TrajectoryOverlay.tsx's own final point already uses. */
function stateAtStep(episode: EpisodeStats, step: number): StateKey {
  if (step < episode.trajectory.length) return episode.trajectory[step].state
  return episode.trajectory[episode.trajectory.length - 1].nextState
}

export function EpisodeStepViewer({ episode, step, onStepChange, allGoals = [], t = translations.en }: EpisodeStepViewerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  // Phase 51 — purely a UI visibility toggle (default expanded, per §1): collapsing never
  // touches `episode`/`step`/`onStepChange` or any other prop, so the selected Episode and
  // viewedStep are completely unaffected by collapsing/expanding — this component isn't
  // unmounted either way, only the controls below the heading are conditionally rendered.
  const [isExpanded, setIsExpanded] = useState(true)
  const maxStep = episode ? episode.trajectory.length : 0

  // Auto-advance while Playing; stops itself at the last Step, and whenever the Episode
  // selection changes out from under it (episode/maxStep dependency) or the caller
  // unmounts/remounts this panel (see App.tsx's `key={selectedEpisode}` on this component).
  useEffect(() => {
    if (!isPlaying || episode === null) return
    if (step >= maxStep) {
      setIsPlaying(false)
      return
    }
    const id = window.setInterval(() => {
      onStepChange(Math.min(step + 1, maxStep))
    }, AUTO_PLAY_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [isPlaying, episode, step, maxStep, onStepChange])

  useEffect(() => {
    if (step >= maxStep) setIsPlaying(false)
  }, [step, maxStep])

  // Phase 47 audit finding: when focus is on the Slider itself (the common case right
  // after dragging it), the browser's OWN native <input type="range"> arrow-key handling
  // (step=1) also fires alongside this window-level listener, silently advancing the
  // Step by 2 instead of 1 — reproduced via real-browser measurement (fill('2') then one
  // ArrowRight press landed on Step 4, not 3; the same press with focus elsewhere
  // correctly landed on step+1). `preventDefault()` suppresses the native range-input
  // handling unconditionally, leaving this listener as the single source of truth for
  // both ArrowLeft/ArrowRight regardless of which element currently has focus.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (episode === null) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        onStepChange(Math.max(0, step - 1))
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        onStepChange(Math.min(maxStep, step + 1))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [episode, step, maxStep, onStepChange])

  if (episode === null) {
    return (
      <div className="w-full max-w-lg rounded border border-gray-200 p-4 text-sm text-gray-500" data-testid="step-viewer-empty">
        {t.stepViewer.empty}
      </div>
    )
  }

  const clampedStep = Math.min(step, maxStep)
  const currentState = stateAtStep(episode, clampedStep)
  const collected = allGoals.length > 0 ? collectedCount(stateMask(currentState), allGoals.length) : 0

  return (
    <div className="w-full max-w-lg rounded border border-gray-200 p-4 text-sm" data-testid="step-viewer">
      {/*
        Phase 51 — collapse/expand toggle. Same "isolated header row, only visibility
        toggles" pattern already used by envToggle/episodePath (App.tsx) — the heading
        and this button always render; only the controls below (slider/Prev/Next/Play/
        Goals) are conditionally omitted, so a collapsed panel never loses its own
        identity ("Step Viewer" + Episode number stay visible, per §1).
      */}
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold text-gray-700">
          {t.stepViewer.heading} — {t.stats.episode} {episode.episode}
        </h2>
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
          data-testid="step-viewer-toggle"
          className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
        >
          {isExpanded ? t.stepViewer.collapse : t.stepViewer.expand}
        </button>
      </div>

      {isExpanded && (
        <div data-testid="step-viewer-controls">
          <input
            type="range"
            min={0}
            max={maxStep}
            step={1}
            value={clampedStep}
            onChange={(e) => onStepChange(Number(e.target.value))}
            data-testid="step-viewer-slider"
            className="w-full"
          />

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onStepChange(Math.max(0, clampedStep - 1))}
              disabled={clampedStep <= 0}
              data-testid="step-viewer-previous"
              className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t.stepViewer.previous}
            </button>
            <button
              type="button"
              onClick={() => setIsPlaying((prev) => !prev)}
              data-testid="step-viewer-play-pause"
              className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
            >
              {isPlaying ? t.stepViewer.pause : t.stepViewer.play}
            </button>
            <button
              type="button"
              onClick={() => onStepChange(Math.min(maxStep, clampedStep + 1))}
              disabled={clampedStep >= maxStep}
              data-testid="step-viewer-next"
              className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t.stepViewer.next}
            </button>
            <span className="tabular-nums text-gray-600" data-testid="step-viewer-position">
              {t.stepViewer.stepLabel} {clampedStep} / {maxStep}
            </span>
          </div>

          {allGoals.length > 1 && (
            <p className="mt-2 tabular-nums text-gray-600" data-testid="step-viewer-goals-collected">
              {t.stats.goalsCollected}: {collected} / {allGoals.length}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
