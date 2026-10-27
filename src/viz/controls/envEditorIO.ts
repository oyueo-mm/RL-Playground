// Phase 46 — Environment Export/Import as JSON files. Pure functions only (no React, no
// DOM file APIs — EnvEditor.tsx owns the Blob/download and FileReader/<input> plumbing),
// so this module is trivially unit-testable and mirrors envEditorDraft.ts's own
// "pure Draft <-> config helpers, no React" split.
//
// Import validation is deliberately two-stage: (1) JSON-structural checks below (parse
// errors, version, type, field presence/shape) that are specific to "is this a valid
// export FILE", followed by (2) delegating to envEditorDraft.ts's EXISTING
// `validateDraft()` for every semantic check (range/collision/required-Goal/etc.) it
// already implements — no duplicated/diverging validation logic between the Editor's own
// manual-edit path and this file-import path.

import type { BombTile, GoalTile, Position } from '../../core/environments/gridworld/types'
import type { GridFeatures } from '../../core/environments/gridworld/types'
import { copyFeatures, hasElementOverrides, hasV5Elements, readFeatures } from '../../core/environments/gridworld/features'
import { validateDraft, type GridEditorDraft } from './envEditorDraft'

/**
 * V4 — version 3 adds optional per-element fields (goal `reward`, bomb `penalty`, toggle
 * wall `initialOpen`). Exports use the lowest version able to represent the map, so a map
 * without those fields still exports as version 2 and stays readable by earlier builds,
 * while a file that relies on them can never be silently misread as a version 2 map.
 * V5 — version 4 adds swamp tiles (`terrains`, `terrainCost`) and one-way portals (`directed`),
 * under the same lowest-version rule: maps using neither keep exporting as version 2 or 3.
 */
export const ENV_EXPORT_VERSION = 4
const ELEMENT_OVERRIDE_VERSION = 3
const LEGACY_FEATURE_VERSION = 2
export const ENV_EXPORT_TYPE = 'gridworld'

export interface EnvExportFile extends GridFeatures {
  version: number
  type: string
  width: number
  height: number
  start: Position
  goals: GoalTile[]
  walls: Position[]
  bombs: BombTile[]
  stepReward: number
  wallPenalty: number
  goalReward: number
  bombPenalty: number
}

export function draftToExportFile(draft: GridEditorDraft): EnvExportFile {
  return {
    version: hasV5Elements(draft) ? ENV_EXPORT_VERSION : hasElementOverrides(draft) ? ELEMENT_OVERRIDE_VERSION : LEGACY_FEATURE_VERSION,
    type: ENV_EXPORT_TYPE,
    width: draft.width,
    height: draft.height,
    start: draft.start,
    goals: draft.goals,
    walls: draft.walls,
    bombs: draft.bombs,
    stepReward: draft.stepReward,
    wallPenalty: draft.wallPenalty,
    goalReward: draft.goalReward,
    bombPenalty: draft.bombPenalty,
    ...copyFeatures(draft),
  }
}

export function serializeEnvExport(draft: GridEditorDraft): string {
  return JSON.stringify(draftToExportFile(draft), null, 2)
}

/** A suggested filename for the downloaded export — not itself validated on import (the
 * file's actual JSON content is the only thing that matters), just a friendly default. */
export function exportFileName(draft: GridEditorDraft): string {
  return `rl-playground-env-${draft.width}x${draft.height}.json`
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isPosition(value: unknown): value is Position {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return isFiniteNumber(candidate.x) && isFiniteNumber(candidate.y)
}

function isPositionArray(value: unknown): value is Position[] {
  return Array.isArray(value) && value.every(isPosition)
}

export type ImportResult = { ok: true; draft: GridEditorDraft } | { ok: false; error: string }

/**
 * Parses and validates a candidate Environment export file's raw text content. Returns
 * `{ ok: false, error }` for ANY problem (malformed JSON, wrong version/type, missing/
 * malformed fields, or any of `validateDraft()`'s own semantic rejections) — the caller
 * (EnvEditor.tsx) is expected to show `error` and leave the existing Draft/Environment
 * completely unchanged, never partially apply a bad file.
 */
export function parseEnvImport(text: string): ImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: 'File is not valid JSON.' }
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, error: 'File does not contain a JSON object.' }
  }
  const candidate = parsed as Record<string, unknown>
  if (candidate.rewardTiles !== undefined && (!Array.isArray(candidate.rewardTiles) || candidate.rewardTiles.length > 0)) return { ok: false, error: 'Reward tiles are no longer supported. Remove rewardTiles explicitly before importing this map.' }

  if (candidate.version !== 1 && candidate.version !== LEGACY_FEATURE_VERSION && candidate.version !== ELEMENT_OVERRIDE_VERSION && candidate.version !== ENV_EXPORT_VERSION) {
    return { ok: false, error: `Unsupported export version (expected ${ENV_EXPORT_VERSION}).` }
  }
  if (candidate.type !== ENV_EXPORT_TYPE) {
    return { ok: false, error: `Unsupported environment type (expected "${ENV_EXPORT_TYPE}").` }
  }
  if (!isFiniteNumber(candidate.width) || !isFiniteNumber(candidate.height)) {
    return { ok: false, error: 'Width/height must be numbers.' }
  }
  if (!isPosition(candidate.start)) {
    return { ok: false, error: 'Start must be a position with numeric x/y.' }
  }
  if (!isPositionArray(candidate.goals)) {
    return { ok: false, error: 'Goals must be an array of positions with numeric x/y.' }
  }
  // Walls/bombs are optional in the file (default to none) — everything else is required.
  const walls = candidate.walls === undefined ? [] : candidate.walls
  const bombs = candidate.bombs === undefined ? [] : candidate.bombs
  if (!isPositionArray(walls)) return { ok: false, error: 'Walls must be an array of positions with numeric x/y.' }
  if (!isPositionArray(bombs)) return { ok: false, error: 'Bombs must be an array of positions with numeric x/y.' }

  // Reward fields fall back to envEditorDraft.ts's own defaults when missing/malformed —
  // same fallback convention draftFromRenderModel() already uses for an older/synthetic
  // renderModel that doesn't carry them. defaultDraft() is not imported here purely to
  // avoid a circular concern; the literal defaults below match GridWorldEnv's documented
  // defaults, and any wrong value is still caught below by validateDraft()'s own
  // `Number.isFinite` checks (there is no way for a bad fallback to slip through).
  const stepReward = isFiniteNumber(candidate.stepReward) ? candidate.stepReward : -0.1
  const wallPenalty = isFiniteNumber(candidate.wallPenalty) ? candidate.wallPenalty : -1
  const goalReward = isFiniteNumber(candidate.goalReward) ? candidate.goalReward : 10
  const bombPenalty = isFiniteNumber(candidate.bombPenalty) ? candidate.bombPenalty : -10
  let features: GridFeatures
  try { features = readFeatures(candidate) } catch (error) { return { ok: false, error: (error as Error).message } }
  if (candidate.version === 1 && Object.keys(features).length) return { ok: false, error: 'New environment elements require schema version 2.' }
  // Keep only known per-element fields; the semantic check of their values is validateDraft()'s.
  const goals: GoalTile[] = candidate.goals.map(({ x, y, reward }: GoalTile) => reward === undefined ? { x, y } : { x, y, reward })
  const bombList: BombTile[] = bombs.map(({ x, y, penalty }: BombTile) => penalty === undefined ? { x, y } : { x, y, penalty })
  if (typeof candidate.version === 'number' && candidate.version < ELEMENT_OVERRIDE_VERSION && hasElementOverrides({ goals, bombs: bombList, ...features })) return { ok: false, error: 'Per-element rewards and initial gate states require schema version 3.' }

  if (candidate.version !== ENV_EXPORT_VERSION && (hasV5Elements(features) || candidate.terrainCost !== undefined)) return { ok: false, error: 'Swamps and one-way portals require schema version 4.' }

  const draft: GridEditorDraft = {
    width: candidate.width,
    height: candidate.height,
    start: candidate.start,
    goals,
    walls,
    bombs: bombList,
    stepReward,
    wallPenalty,
    goalReward,
    bombPenalty,
    ...features,
  }

  // Structural checks above only prove "this parses into the right SHAPE" — width/height
  // still need MIN_SIZE/MAX_SIZE range-checking, positions still need in-bounds/collision
  // checking, etc. Rather than re-implement any of that, delegate to the exact same
  // validateDraft() the manual Editor already runs on every keystroke (imported above).
  const errors = validateDraft(draft)
  if (errors.length > 0) return { ok: false, error: errors[0] }

  return { ok: true, draft }
}
