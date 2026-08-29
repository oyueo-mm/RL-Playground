// Phase 3: Step/Reset. Phase 5 adds Run/Run Episode/Pause/Resume, gated by the
// Engine's actual `status` (from EngineSnapshot — src/core/engine/types.ts) so the UI
// can never trigger a redundant Scheduler loop or an invalid step() call (Engine's
// step() throws unless idle; run()/runEpisode() already no-op while running, but the
// buttons are disabled too so the UI's own state is never ambiguous about what's safe).
// Still presentational only — takes callbacks, not an Engine reference.

import type { ChangeEvent } from 'react'
import type { EngineStatus } from '../../core/engine/types'
import { translations, type Dictionary } from '../../ui/i18n'

export interface PlaybackControlsProps {
  status: EngineStatus
  onStep: () => void
  onRun: () => void
  onRunEpisode: () => void
  onPause: () => void
  onResume: () => void
  onReset: () => void
  /** Phase 13 — defaults to English so every pre-existing caller/test is unaffected. */
  t?: Dictionary
  /**
   * Phase 15 — how many episodes `onRunEpisode` will run (the caller, App.tsx, is the
   * one that actually calls `engine.run({ episodes: episodeCount })`; this component
   * only renders/edits the count). Defaults preserve every pre-Phase-15 caller/test.
   */
  episodeCount?: number
  onEpisodeCountChange?: (count: number) => void
  /**
   * Phase 28 — "Run Greedy Policy": runs exactly the current Episode (Phase 12's "Run"
   * semantics) using pure argmax action selection instead of the user's real epsilon.
   * Optional/omitted preserves every pre-Phase-28 caller/test (button simply doesn't
   * render — see below).
   */
  onRunGreedy?: () => void
  /**
   * Phase 36 — stops any in-flight run (primarily for aborting a stuck/looping Greedy
   * run — Scheduler has no built-in max-step limit, see SimulationEngine.ts's
   * `restartEpisode()`) and returns the Environment to episode-start, WITHOUT touching
   * the Agent/Q-table (unlike `onReset` above). Enabled only while running/paused, since
   * there's nothing to abort while idle. Optional/omitted preserves every
   * pre-Phase-36 caller/test (button simply doesn't render — see below).
   */
  onRestartEpisode?: () => void
}

const baseButtonClass = 'rounded px-4 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-40'

// Episode count bounds. MIN=1 matches "at least the current episode" (PRODUCT_SPEC.md
// FR-4-adjacent convention of small integer minimums). Phase 28 removed the previous
// MAX=200 — it existed only because SimulationEngine.ts's own REWARD_HISTORY_LIMIT
// capped retention at 200 (also removed this Phase), not because of any real constraint
// on how many Episodes can be requested in one Run Episode call.
const EPISODE_COUNT_MIN = 1

export function PlaybackControls({
  status,
  onStep,
  onRun,
  onRunEpisode,
  onPause,
  onResume,
  onReset,
  t = translations.en,
  episodeCount = 1,
  onEpisodeCountChange = () => {},
  onRunGreedy,
  onRestartEpisode,
}: PlaybackControlsProps) {
  const isIdle = status === 'idle'
  const isRunning = status === 'running'
  const isPaused = status === 'paused'

  function handleEpisodeCountChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    const parsed = Number(raw)
    // Reject (ignore the keystroke, input snaps back to the last valid value) rather
    // than accept-then-flag: empty/non-integer/out-of-range input never becomes the
    // committed value, so there is never an "invalid" state to separately display.
    // Phase 28: no upper bound any more — see EPISODE_COUNT_MIN's comment.
    if (raw === '' || !Number.isInteger(parsed) || parsed < EPISODE_COUNT_MIN) return
    onEpisodeCountChange(parsed)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onStep}
        disabled={!isIdle}
        data-testid="playback-step"
        className={`${baseButtonClass} bg-blue-600 text-white hover:bg-blue-700`}
      >
        {t.playback.step}
      </button>
      <button
        type="button"
        onClick={onRun}
        disabled={!isIdle}
        data-testid="playback-run"
        className={`${baseButtonClass} bg-green-600 text-white hover:bg-green-700`}
      >
        {t.playback.run}
      </button>
      <button
        type="button"
        onClick={onRunEpisode}
        disabled={!isIdle}
        data-testid="playback-run-episode"
        className={`${baseButtonClass} bg-green-700 text-white hover:bg-green-800`}
      >
        {t.playback.runEpisode}
      </button>
      {/*
        Phase 14: Pause and Resume previously were two ALWAYS-rendered buttons (each just
        toggling `disabled`), occupying two separate flex-item slots in this
        `flex flex-wrap` row at all times. That made the row wider than necessary and —
        combined with page height changing as Inspector/Stats/RewardChart populate (which
        can toggle a vertical scrollbar and shift the available width by a few px) — put
        the row right at a flex-wrap breakpoint, so Pause/Reset could flip between the end
        of line 1 and the start of line 2 on a bare status change (see Phase 14 report
        "발견한 실제 원인"). Fix: a single slot renders exactly one of the two buttons at a
        time, and both variants share the same `min-w-*` so swapping between them never
        changes the slot's own width either — the row's total content width is now fully
        stable across every status transition and both locales.
      */}
      <span data-testid="playback-pause-resume-slot" className="inline-block">
        {isPaused ? (
          <button
            type="button"
            onClick={onResume}
            data-testid="playback-resume"
            className={`${baseButtonClass} min-w-[92px] bg-amber-600 text-white hover:bg-amber-700`}
          >
            {t.playback.resume}
          </button>
        ) : (
          <button
            type="button"
            onClick={onPause}
            disabled={!isRunning}
            data-testid="playback-pause"
            className={`${baseButtonClass} min-w-[92px] bg-amber-500 text-white hover:bg-amber-600`}
          >
            {t.playback.pause}
          </button>
        )}
      </span>
      <button
        type="button"
        onClick={onReset}
        data-testid="playback-reset"
        className={`${baseButtonClass} bg-gray-200 text-gray-800 hover:bg-gray-300`}
      >
        {t.playback.reset}
      </button>
      </div>

      {/*
        Phase 15: this lives in its own flex row, separate from the button row above —
        deliberately NOT added as one more item inside that `flex flex-wrap` row, so it
        can never affect that row's own wrap breakpoint (Phase 14's fix depended on the
        button row's total width; this keeps that width completely unchanged).
      */}
      <label className="flex items-center gap-1 text-sm text-gray-600">
        {t.playback.episodeCount}
        <input
          type="number"
          inputMode="numeric"
          min={EPISODE_COUNT_MIN}
          step={1}
          value={episodeCount}
          onChange={handleEpisodeCountChange}
          disabled={!isIdle}
          data-testid="episode-count-input"
          className="w-20 rounded border border-gray-300 px-1 py-0.5 disabled:cursor-not-allowed disabled:opacity-40"
        />
      </label>

      {/*
        Phase 28 — same isolation reasoning as the Episode count row above: a separate
        row, never added to the Phase 14 button row, so this can never affect that row's
        own carefully-tuned wrap breakpoint. Omitted entirely (renders nothing) when the
        caller doesn't pass `onRunGreedy`, so every pre-Phase-28 caller/test is unaffected.
      */}
      {onRunGreedy && (
        <button
          type="button"
          onClick={onRunGreedy}
          disabled={!isIdle}
          data-testid="playback-run-greedy"
          className={`${baseButtonClass} self-start bg-teal-600 text-white hover:bg-teal-700`}
        >
          {t.playback.runGreedy}
        </button>
      )}

      {/*
        Phase 36 — same isolation reasoning as the rows above: a separate row, never
        added to the Phase 14 button row, so this can never affect that row's own
        carefully-tuned wrap breakpoint. Enabled only while running/paused (nothing to
        abort while idle). Omitted entirely when the caller doesn't pass
        `onRestartEpisode`, so every pre-Phase-36 caller/test is unaffected.
      */}
      {onRestartEpisode && (
        <button
          type="button"
          onClick={onRestartEpisode}
          disabled={isIdle}
          data-testid="playback-restart-episode"
          className={`${baseButtonClass} self-start bg-rose-600 text-white hover:bg-rose-700`}
        >
          {t.playback.restartEpisode}
        </button>
      )}
    </div>
  )
}
