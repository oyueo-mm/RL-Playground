// Phase 7 — GridWorld Environment Editor. Manages a local Draft (React state) that is
// completely independent of the live Engine until "Apply" — clicking cells here never
// touches the real Environment (ARCHITECTURE.md §7.3/§11, Phase 7 §2.1).
//
// GridSvg.tsx is reused as-is (not modified) to render the Draft preview: it already
// accepts a generic EnvRenderModel + onStateSelect, so a synthetic render model built
// from the Draft is fed into a second GridSvg instance. GridSvg's read-only-visualization
// responsibility is unchanged — this component just re-purposes its existing click
// callback as "edit this cell" instead of "select this cell for inspection".
//
// Phase 30: Goal mode changed from "move a singleton" to "toggle membership in an array",
// mirroring Bomb mode's existing click pattern exactly (see handleCellClick below).
// Reward fields (Step/Wall/Goal, alongside the pre-existing Bomb penalty) and an
// Environment Preset selector were added; both still only ever mutate the local Draft —
// neither reaches the live Environment before Apply.

import { useState } from 'react'
import type { GridWorldConfig } from '../../core/environments/gridworld/types'
import type { EnvRenderModel } from '../../core/types/render'
import type { StateKey } from '../../core/types/rl'
import { GridSvg } from '../grid/GridSvg'
import { parseStateKey } from '../grid/stateKey'
import { translations, translateValidationError, type Dictionary, type Locale } from '../../ui/i18n'
import { ENVIRONMENT_PRESETS } from './environmentPresets'
import {
  defaultDraft,
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
  /** Phase 13 — defaults to English so every pre-existing caller/test is unaffected. */
  t?: Dictionary
  locale?: Locale
}

function isAnyGoal(pos: { x: number; y: number }, goals: GridEditorDraft['goals']): boolean {
  return goals.some((g) => samePosition(g, pos))
}

export function EnvEditor({
  currentRenderModel,
  onApply,
  confirmApply = window.confirm,
  t = translations.en,
  locale = 'en',
}: EnvEditorProps) {
  const [draft, setDraft] = useState<GridEditorDraft>(() => draftFromRenderModel(currentRenderModel))
  const [mode, setMode] = useState<EditMode>('wall')
  const [presetId, setPresetId] = useState<string>('custom')

  // validateDraft() itself always returns plain English messages (its own pure-function
  // tests assert those exact strings) — translated only for display here.
  const errors = validateDraft(draft)
  const isValid = errors.length === 0

  function updateWidth(value: number) {
    setDraft((prev) => ({
      ...prev,
      width: value,
      walls: prev.walls.filter((w) => w.x < value),
      bombs: prev.bombs.filter((b) => b.x < value),
      goals: prev.goals.filter((g) => g.x < value),
    }))
  }

  function updateHeight(value: number) {
    setDraft((prev) => ({
      ...prev,
      height: value,
      walls: prev.walls.filter((w) => w.y < value),
      bombs: prev.bombs.filter((b) => b.y < value),
      goals: prev.goals.filter((g) => g.y < value),
    }))
  }

  function updateBombPenalty(value: number) {
    setDraft((prev) => ({ ...prev, bombPenalty: value }))
  }

  function updateStepReward(value: number) {
    setDraft((prev) => ({ ...prev, stepReward: value }))
  }

  function updateWallPenalty(value: number) {
    setDraft((prev) => ({ ...prev, wallPenalty: value }))
  }

  function updateGoalReward(value: number) {
    setDraft((prev) => ({ ...prev, goalReward: value }))
  }

  // Phase 32 §9/§10 — "Reset Environment": restores the Editor's Draft to the project's
  // default Environment. This ONLY touches Draft state (same as every other change in
  // this component) — it never calls onApply, so the live/running Environment is
  // completely unaffected until the user separately clicks Apply.
  function handleResetEnvironment() {
    setDraft(defaultDraft())
    setPresetId('custom')
  }

  function selectPreset(id: string) {
    setPresetId(id)
    if (id === 'custom') return
    const preset = ENVIRONMENT_PRESETS.find((p) => p.id === id)
    if (preset) setDraft(preset.draft)
  }

  function handleCellClick(stateKey: StateKey) {
    const pos = parseStateKey(stateKey)

    if (mode === 'start') {
      setDraft((prev) => ({
        ...prev,
        start: pos,
        walls: prev.walls.filter((w) => !samePosition(w, pos)),
        bombs: prev.bombs.filter((b) => !samePosition(b, pos)),
        goals: prev.goals.filter((g) => !samePosition(g, pos)),
      }))
      return
    }
    if (mode === 'goal') {
      // Same "toggle membership" click pattern as Bomb mode below — Start can never
      // become a Goal.
      if (samePosition(pos, draft.start)) return
      setDraft((prev) => {
        const exists = isAnyGoal(pos, prev.goals)
        return {
          ...prev,
          walls: prev.walls.filter((w) => !samePosition(w, pos)),
          bombs: prev.bombs.filter((b) => !samePosition(b, pos)),
          goals: exists ? prev.goals.filter((g) => !samePosition(g, pos)) : [...prev.goals, pos],
        }
      })
      return
    }
    if (mode === 'bomb') {
      // Bomb/Start/Goal can never coexist on one cell — same rule as Wall below.
      if (samePosition(pos, draft.start) || isAnyGoal(pos, draft.goals)) return
      setDraft((prev) => {
        const exists = prev.bombs.some((b) => samePosition(b, pos))
        return {
          ...prev,
          // Placing a Bomb where a Wall was clears the Wall — mirrors how moving
          // Start/Goal onto a Wall clears it above (last placed entity wins).
          walls: prev.walls.filter((w) => !samePosition(w, pos)),
          bombs: exists ? prev.bombs.filter((b) => !samePosition(b, pos)) : [...prev.bombs, pos],
        }
      })
      return
    }
    // mode === 'wall': Start/Goal cells can never become walls.
    if (samePosition(pos, draft.start) || isAnyGoal(pos, draft.goals)) return
    setDraft((prev) => {
      const exists = prev.walls.some((w) => samePosition(w, pos))
      return {
        ...prev,
        // Same "last placed entity wins" rule, in the other direction.
        bombs: prev.bombs.filter((b) => !samePosition(b, pos)),
        walls: exists ? prev.walls.filter((w) => !samePosition(w, pos)) : [...prev.walls, pos],
      }
    })
  }

  function handleApply() {
    if (!isValid) return // defense in depth — the button is already disabled in this case
    if (!confirmApply(t.envEditor.applyConfirm)) return
    onApply(draftToGridWorldConfig(draft))
  }

  // Canonical mode ids ('wall'/'start'/'goal'/'bomb') drive data-testid/aria-pressed
  // unchanged; only the visible button text is looked up per-locale.
  const modeLabel: Record<EditMode, string> = {
    wall: t.envEditor.modeWall,
    start: t.envEditor.modeStart,
    goal: t.envEditor.modeGoal,
    bomb: t.envEditor.modeBomb,
  }

  const presetLabel: Record<string, string> = {
    custom: t.envEditor.presetCustom,
    corridor: t.envEditor.presetCorridor,
    maze: t.envEditor.presetMaze,
    bombField: t.envEditor.presetBombField,
    multiGoal: t.envEditor.presetMultiGoal,
    treasureHunt: t.envEditor.presetTreasureHunt,
  }

  return (
    <div className="w-full max-w-lg space-y-3 rounded border border-gray-200 p-4 text-sm" data-testid="env-editor">
      <h2 className="font-semibold text-gray-700">{t.envEditor.heading}</h2>

      <label className="flex items-center gap-1">
        {t.envEditor.preset}
        <select
          value={presetId}
          onChange={(e) => selectPreset(e.target.value)}
          data-testid="env-editor-preset-select"
          className="rounded border border-gray-300 px-1 py-0.5"
        >
          <option value="custom">{presetLabel.custom}</option>
          {ENVIRONMENT_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {presetLabel[preset.id]}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1">
          {t.envEditor.width}
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
          {t.envEditor.height}
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

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1">
          {t.envEditor.stepReward}
          <input
            type="number"
            step={0.1}
            value={draft.stepReward}
            onChange={(e) => updateStepReward(Number(e.target.value))}
            data-testid="env-editor-step-reward-input"
            className="w-16 rounded border border-gray-300 px-1 py-0.5"
          />
        </label>
        <label className="flex items-center gap-1">
          {t.envEditor.wallPenalty}
          <input
            type="number"
            step={0.1}
            value={draft.wallPenalty}
            onChange={(e) => updateWallPenalty(Number(e.target.value))}
            data-testid="env-editor-wall-penalty-input"
            className="w-16 rounded border border-gray-300 px-1 py-0.5"
          />
        </label>
        <label className="flex items-center gap-1">
          {t.envEditor.goalReward}
          <input
            type="number"
            step={0.1}
            value={draft.goalReward}
            onChange={(e) => updateGoalReward(Number(e.target.value))}
            data-testid="env-editor-goal-reward-input"
            className="w-16 rounded border border-gray-300 px-1 py-0.5"
          />
        </label>
        <label className="flex items-center gap-1">
          {t.envEditor.bombPenalty}
          <input
            type="number"
            step={0.1}
            value={draft.bombPenalty}
            onChange={(e) => updateBombPenalty(Number(e.target.value))}
            data-testid="env-editor-bomb-penalty-input"
            className="w-16 rounded border border-gray-300 px-1 py-0.5"
          />
        </label>
      </div>

      <div className="flex gap-2">
        {(['wall', 'start', 'goal', 'bomb'] as const).map((m) => (
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
            {modeLabel[m]}
          </button>
        ))}
      </div>

      <div data-testid="env-editor-grid">
        <p className="mb-1 text-xs text-gray-500">{t.envEditor.draftPreview}</p>
        <GridSvg renderModel={draftToRenderModel(draft)} cellSize={32} onStateSelect={handleCellClick} />
      </div>

      {errors.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-4 text-xs text-red-600" data-testid="env-editor-errors">
          {errors.map((message) => (
            <li key={message}>{translateValidationError(message, locale)}</li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleApply}
          disabled={!isValid}
          data-testid="env-editor-apply"
          className="rounded bg-purple-600 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t.envEditor.apply}
        </button>
        <button
          type="button"
          onClick={handleResetEnvironment}
          data-testid="env-editor-reset"
          className="rounded bg-gray-200 px-4 py-2 font-medium text-gray-800 hover:bg-gray-300"
        >
          {t.envEditor.resetEnvironment}
        </button>
      </div>
    </div>
  )
}
