// Phase 7 — GridWorld Environment Editor. Manages a local Draft (React state) that is
// completely independent of the live Engine until "Apply" — clicking cells here never
// touches the real Environment (ARCHITECTURE.md §7.3/§11, Phase 7 §2.1).
//
// GridSvg.tsx is reused as-is (not modified) to render the Draft preview: it already
// accepts a generic EnvRenderModel + onStateSelect, so a synthetic render model built
// from the Draft is fed into a second GridSvg instance. GridSvg's read-only-visualization
// responsibility is unchanged — this component just re-purposes its existing click
// callback as "edit this cell" instead of "select this cell for inspection".

import { useState } from 'react'
import type { GridWorldConfig } from '../../core/environments/gridworld/types'
import type { EnvRenderModel } from '../../core/types/render'
import type { StateKey } from '../../core/types/rl'
import { GridSvg } from '../grid/GridSvg'
import { parseStateKey } from '../grid/stateKey'
import {
  draftFromRenderModel,
  draftToGridWorldConfig,
  draftToRenderModel,
  MAX_SIZE,
  MIN_SIZE,
  samePosition,
  validateDraft,
  type EditMode,
  type GridEditorDraft,
} from './envEditorDraft'

export interface EnvEditorProps {
  /** The live environment's current render model — used only to seed the initial Draft. */
  currentRenderModel: Extract<EnvRenderModel, { kind: 'grid' }>
  /** Called only after validation passes AND the user confirms. Never called otherwise. */
  onApply: (config: GridWorldConfig) => void
  /** Defaults to window.confirm (Phase 7 §9 explicitly allows the plain browser dialog). */
  confirmApply?: (message: string) => boolean
}

const APPLY_CONFIRM_MESSAGE =
  'Applying this environment will reset the current Q-table, episode count, and statistics. Continue?'

export function EnvEditor({ currentRenderModel, onApply, confirmApply = window.confirm }: EnvEditorProps) {
  const [draft, setDraft] = useState<GridEditorDraft>(() => draftFromRenderModel(currentRenderModel))
  const [mode, setMode] = useState<EditMode>('wall')

  const errors = validateDraft(draft)
  const isValid = errors.length === 0

  function updateWidth(value: number) {
    setDraft((prev) => ({ ...prev, width: value, walls: prev.walls.filter((w) => w.x < value) }))
  }

  function updateHeight(value: number) {
    setDraft((prev) => ({ ...prev, height: value, walls: prev.walls.filter((w) => w.y < value) }))
  }

  function handleCellClick(stateKey: StateKey) {
    const pos = parseStateKey(stateKey)

    if (mode === 'start') {
      setDraft((prev) => ({ ...prev, start: pos, walls: prev.walls.filter((w) => !samePosition(w, pos)) }))
      return
    }
    if (mode === 'goal') {
      setDraft((prev) => ({ ...prev, goal: pos, walls: prev.walls.filter((w) => !samePosition(w, pos)) }))
      return
    }
    // mode === 'wall': Start/Goal cells can never become walls.
    if (samePosition(pos, draft.start) || samePosition(pos, draft.goal)) return
    setDraft((prev) => {
      const exists = prev.walls.some((w) => samePosition(w, pos))
      return {
        ...prev,
        walls: exists ? prev.walls.filter((w) => !samePosition(w, pos)) : [...prev.walls, pos],
      }
    })
  }

  function handleApply() {
    if (!isValid) return // defense in depth — the button is already disabled in this case
    if (!confirmApply(APPLY_CONFIRM_MESSAGE)) return
    onApply(draftToGridWorldConfig(draft))
  }

  return (
    <div className="w-full max-w-md space-y-3 rounded border border-gray-200 p-4 text-sm" data-testid="env-editor">
      <h2 className="font-semibold text-gray-700">Environment Editor</h2>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1">
          Width
          <input
            type="number"
            min={MIN_SIZE}
            max={MAX_SIZE}
            value={draft.width}
            onChange={(e) => updateWidth(Number(e.target.value))}
            data-testid="env-editor-width-input"
            className="w-16 rounded border border-gray-300 px-1 py-0.5"
          />
        </label>
        <label className="flex items-center gap-1">
          Height
          <input
            type="number"
            min={MIN_SIZE}
            max={MAX_SIZE}
            value={draft.height}
            onChange={(e) => updateHeight(Number(e.target.value))}
            data-testid="env-editor-height-input"
            className="w-16 rounded border border-gray-300 px-1 py-0.5"
          />
        </label>
      </div>

      <div className="flex gap-2">
        {(['wall', 'start', 'goal'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            data-testid={`env-editor-mode-${m}`}
            className={`rounded px-3 py-1 text-sm font-medium capitalize ${
              mode === m ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <div data-testid="env-editor-grid">
        <p className="mb-1 text-xs text-gray-500">Draft preview (not applied yet)</p>
        <GridSvg renderModel={draftToRenderModel(draft)} cellSize={32} onStateSelect={handleCellClick} />
      </div>

      {errors.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-4 text-xs text-red-600" data-testid="env-editor-errors">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={handleApply}
        disabled={!isValid}
        data-testid="env-editor-apply"
        className="rounded bg-purple-600 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        Apply Environment
      </button>
    </div>
  )
}
