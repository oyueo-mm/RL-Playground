// Phase 3: Step/Reset. Phase 5 adds Run/Run Episode/Pause/Resume, gated by the
// Engine's actual `status` (from EngineSnapshot — src/core/engine/types.ts) so the UI
// can never trigger a redundant Scheduler loop or an invalid step() call (Engine's
// step() throws unless idle; run()/runEpisode() already no-op while running, but the
// buttons are disabled too so the UI's own state is never ambiguous about what's safe).
// Still presentational only — takes callbacks, not an Engine reference.

import type { EngineStatus } from '../../core/engine/types'

export interface PlaybackControlsProps {
  status: EngineStatus
  onStep: () => void
  onRun: () => void
  onRunEpisode: () => void
  onPause: () => void
  onResume: () => void
  onReset: () => void
}

const baseButtonClass = 'rounded px-4 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-40'

export function PlaybackControls({
  status,
  onStep,
  onRun,
  onRunEpisode,
  onPause,
  onResume,
  onReset,
}: PlaybackControlsProps) {
  const isIdle = status === 'idle'
  const isRunning = status === 'running'
  const isPaused = status === 'paused'

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onStep}
        disabled={!isIdle}
        data-testid="playback-step"
        className={`${baseButtonClass} bg-blue-600 text-white hover:bg-blue-700`}
      >
        Step
      </button>
      <button
        type="button"
        onClick={onRun}
        disabled={!isIdle}
        data-testid="playback-run"
        className={`${baseButtonClass} bg-green-600 text-white hover:bg-green-700`}
      >
        Run
      </button>
      <button
        type="button"
        onClick={onRunEpisode}
        disabled={!isIdle}
        data-testid="playback-run-episode"
        className={`${baseButtonClass} bg-green-700 text-white hover:bg-green-800`}
      >
        Run Episode
      </button>
      <button
        type="button"
        onClick={onPause}
        disabled={!isRunning}
        data-testid="playback-pause"
        className={`${baseButtonClass} bg-amber-500 text-white hover:bg-amber-600`}
      >
        Pause
      </button>
      <button
        type="button"
        onClick={onResume}
        disabled={!isPaused}
        data-testid="playback-resume"
        className={`${baseButtonClass} bg-amber-600 text-white hover:bg-amber-700`}
      >
        Resume
      </button>
      <button
        type="button"
        onClick={onReset}
        data-testid="playback-reset"
        className={`${baseButtonClass} bg-gray-200 text-gray-800 hover:bg-gray-300`}
      >
        Reset
      </button>
    </div>
  )
}
