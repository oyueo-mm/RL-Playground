// Pure Draft <-> config helpers for EnvEditor.tsx, split into their own module so that
// file only exports the React component (keeps Fast Refresh happy — react-refresh/
// only-export-components). No React here at all.

import { createDefaultGridWorldConfig } from '../../core/environments/gridworld/GridWorldEnv'
import type { GridWorldConfig, Position } from '../../core/environments/gridworld/types'
import type { EnvRenderModel } from '../../core/types/render'
import { parseStateKey, toStateKey } from '../grid/stateKey'

// PRODUCT_SPEC.md FR-4 already documents "3~20" as the example Grid size range — reused
// here rather than inventing a new range.
export const MIN_SIZE = 3
export const MAX_SIZE = 20

const DEFAULT_CONFIG = createDefaultGridWorldConfig()

export interface GridEditorDraft {
  width: number
  height: number
  start: Position
  /** Phase 30 — one or more Goals; at least one is required. */
  goals: Position[]
  walls: Position[]
  bombs: Position[]
  stepReward: number
  wallPenalty: number
  goalReward: number
  bombPenalty: number
}

// 'goal' mode still refers to editing the (now plural) Goal set one cell at a time —
// same click-to-toggle interaction Bomb mode already uses (see EnvEditor.tsx).
export type EditMode = 'wall' | 'start' | 'goal' | 'bomb'

export function samePosition(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y
}

export function draftFromRenderModel(renderModel: Extract<EnvRenderModel, { kind: 'grid' }>): GridEditorDraft {
  return {
    width: renderModel.width,
    height: renderModel.height,
    start: parseStateKey(renderModel.start),
    goals: renderModel.goals.map(parseStateKey),
    walls: renderModel.walls.map(parseStateKey),
    bombs: renderModel.bombs.map(parseStateKey),
    // renderModel's reward fields are optional (see EnvRenderModel's Phase 30 comment) —
    // fall back to the environment's own documented defaults when a caller's renderModel
    // doesn't carry them (e.g. an older/synthetic renderModel in a test).
    stepReward: renderModel.stepReward ?? DEFAULT_CONFIG.stepReward,
    wallPenalty: renderModel.wallPenalty ?? DEFAULT_CONFIG.wallPenalty,
    goalReward: renderModel.goalReward ?? DEFAULT_CONFIG.goalReward,
    bombPenalty: renderModel.bombPenalty,
  }
}

export function draftToRenderModel(draft: GridEditorDraft): Extract<EnvRenderModel, { kind: 'grid' }> {
  return {
    kind: 'grid',
    width: draft.width,
    height: draft.height,
    walls: draft.walls.map(toStateKey),
    bombs: draft.bombs.map(toStateKey),
    bombPenalty: draft.bombPenalty,
    stepReward: draft.stepReward,
    wallPenalty: draft.wallPenalty,
    goalReward: draft.goalReward,
    start: toStateKey(draft.start),
    goals: draft.goals.map(toStateKey),
    // No live agent exists for a Draft — Start is shown as a stand-in so the preview
    // still renders a marker, without implying a real simulation is running there.
    agentPos: toStateKey(draft.start),
  }
}

function inBounds(pos: Position, draft: GridEditorDraft): boolean {
  return pos.x >= 0 && pos.x < draft.width && pos.y >= 0 && pos.y < draft.height
}

export function validateDraft(draft: GridEditorDraft): string[] {
  const errors: string[] = []

  if (!Number.isInteger(draft.width) || draft.width < MIN_SIZE || draft.width > MAX_SIZE) {
    errors.push(`Width must be a whole number between ${MIN_SIZE} and ${MAX_SIZE}.`)
  }
  if (!Number.isInteger(draft.height) || draft.height < MIN_SIZE || draft.height > MAX_SIZE) {
    errors.push(`Height must be a whole number between ${MIN_SIZE} and ${MAX_SIZE}.`)
  }
  // Further checks assume in-range width/height; skip them until size itself is valid
  // so a single bad resize doesn't produce a wall of confusing follow-on errors.
  if (errors.length > 0) return errors

  if (!inBounds(draft.start, draft)) errors.push('Start is outside the grid.')
  if (draft.goals.length === 0) errors.push('At least one Goal is required.')
  if (draft.goals.some((g) => !inBounds(g, draft))) errors.push('One or more Goals are outside the grid.')
  if (draft.goals.some((g) => samePosition(g, draft.start))) errors.push('Start and Goal cannot be the same cell.')
  if (draft.walls.some((w) => samePosition(w, draft.start))) errors.push('Start cannot be a wall.')
  if (draft.walls.some((w) => draft.goals.some((g) => samePosition(w, g)))) errors.push('Goal cannot be a wall.')
  if (draft.walls.some((w) => !inBounds(w, draft))) errors.push('One or more walls are outside the grid.')

  // Phase 20 — Bomb/Start/Goal collisions are already prevented at click-time
  // (EnvEditor.tsx's handleCellClick never lets one land on the other), but validated
  // here too so a Draft built any other way (e.g. a future non-click seeding path) is
  // still caught, exactly like the Wall checks above.
  if (draft.bombs.some((b) => samePosition(b, draft.start))) errors.push('Start cannot be a bomb.')
  if (draft.bombs.some((b) => draft.goals.some((g) => samePosition(b, g)))) errors.push('Goal cannot be a bomb.')
  if (draft.bombs.some((b) => !inBounds(b, draft))) errors.push('One or more bombs are outside the grid.')
  if (!Number.isFinite(draft.bombPenalty)) errors.push('Bomb penalty must be a number.')
  if (!Number.isFinite(draft.stepReward)) errors.push('Step reward must be a number.')
  if (!Number.isFinite(draft.wallPenalty)) errors.push('Wall penalty must be a number.')
  if (!Number.isFinite(draft.goalReward)) errors.push('Goal reward must be a number.')

  return errors
}

export function draftToGridWorldConfig(draft: GridEditorDraft): GridWorldConfig {
  return {
    width: draft.width,
    height: draft.height,
    start: draft.start,
    goals: draft.goals,
    walls: draft.walls,
    bombs: draft.bombs,
    bombPenalty: draft.bombPenalty,
    stepReward: draft.stepReward,
    wallPenalty: draft.wallPenalty,
    goalReward: draft.goalReward,
    terminalCells: DEFAULT_CONFIG.terminalCells,
  }
}
