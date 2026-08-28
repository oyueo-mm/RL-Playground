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

// stepReward/goalReward/terminalCells are NOT observable anywhere in the public
// EngineSnapshot/Environment surface (see this Phase's report, "발견된 문제" #1) and
// this Phase doesn't edit them anyway (Post-MVP FR-8/FR-9), so Apply always carries the
// environment's documented defaults forward unchanged.
const DEFAULT_CONFIG = createDefaultGridWorldConfig()

export interface GridEditorDraft {
  width: number
  height: number
  start: Position
  goal: Position
  walls: Position[]
}

export type EditMode = 'wall' | 'start' | 'goal'

export function samePosition(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y
}

export function draftFromRenderModel(renderModel: Extract<EnvRenderModel, { kind: 'grid' }>): GridEditorDraft {
  return {
    width: renderModel.width,
    height: renderModel.height,
    start: parseStateKey(renderModel.start),
    goal: parseStateKey(renderModel.goal),
    walls: renderModel.walls.map(parseStateKey),
  }
}

export function draftToRenderModel(draft: GridEditorDraft): Extract<EnvRenderModel, { kind: 'grid' }> {
  return {
    kind: 'grid',
    width: draft.width,
    height: draft.height,
    walls: draft.walls.map(toStateKey),
    start: toStateKey(draft.start),
    goal: toStateKey(draft.goal),
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
  if (!inBounds(draft.goal, draft)) errors.push('Goal is outside the grid.')
  if (samePosition(draft.start, draft.goal)) errors.push('Start and Goal cannot be the same cell.')
  if (draft.walls.some((w) => samePosition(w, draft.start))) errors.push('Start cannot be a wall.')
  if (draft.walls.some((w) => samePosition(w, draft.goal))) errors.push('Goal cannot be a wall.')
  if (draft.walls.some((w) => !inBounds(w, draft))) errors.push('One or more walls are outside the grid.')

  return errors
}

export function draftToGridWorldConfig(draft: GridEditorDraft): GridWorldConfig {
  return {
    width: draft.width,
    height: draft.height,
    start: draft.start,
    goal: draft.goal,
    walls: draft.walls,
    stepReward: DEFAULT_CONFIG.stepReward,
    goalReward: DEFAULT_CONFIG.goalReward,
    terminalCells: DEFAULT_CONFIG.terminalCells,
  }
}
