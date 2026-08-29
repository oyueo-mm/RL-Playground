// GridWorld: TS re-implementation of the reference repo's Env.py, adapted to the
// Environment contract confirmed in ARCHITECTURE.md §4.1. See LEGACY_ANALYSIS.md §2
// for the original Python rules this is based on.
//
// Deliberate differences from the legacy reference (see LEGACY_ANALYSIS.md §5):
//  - Walls are a new concept (non-terminal, blocks movement). The legacy repo only had
//    grid boundaries; "bombs" there were terminal (closer to a future Trap, FR-10).
//  - Terminal state resolution is explicit (`isTerminal`) rather than inferred from
//    reward, closing the "terminal but still bootstrapped" trap noted in
//    LEGACY_ANALYSIS.md §3.
//  - Phase 30: a Wall/boundary collision now uses its own `wallPenalty` (previously it
//    silently reused `stepReward` — confirmed via this file's pre-Phase-30 code before
//    changing it). Goal is now `goals: Position[]` (one or more); the Episode ends only
//    once every Goal has been visited at least once this Episode, or a Bomb is reached.
//    `goalReward` is paid only on a Goal's first visit within the current Episode —
//    tracked via `collectedGoals`, mutable per-episode state reset in `reset()` (the same
//    "per-episode, not per-instance" lifetime as `this.agent`).

import type { Environment, EnvironmentDefinition } from '../Environment'
import type { StateKey, StepResult } from '../../types/rl'
import type { EnvRenderModel } from '../../types/render'
import type { GridWorldConfig, LegacyGridWorldConfigInput, Position } from './types'

// 0=up, 1=down, 2=left, 3=right — same encoding as the reference repo (LEGACY_ANALYSIS.md §2).
const ACTION_SPACE = 4

function positionKey(pos: Position): StateKey {
  return `${pos.x},${pos.y}`
}

function samePosition(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y
}

function isOutOfBounds(pos: Position, config: GridWorldConfig): boolean {
  return pos.x < 0 || pos.x >= config.width || pos.y < 0 || pos.y >= config.height
}

function clampPosition(pos: Position, config: GridWorldConfig): Position {
  return {
    x: Math.max(0, Math.min(pos.x, config.width - 1)),
    y: Math.max(0, Math.min(pos.y, config.height - 1)),
  }
}

function isWall(pos: Position, config: GridWorldConfig): boolean {
  return config.walls.some((wall) => samePosition(wall, pos))
}

function isBomb(pos: Position, config: GridWorldConfig): boolean {
  return config.bombs.some((bomb) => samePosition(bomb, pos))
}

function applyAction(pos: Position, action: number): Position {
  switch (action) {
    case 0:
      return { x: pos.x, y: pos.y - 1 }
    case 1:
      return { x: pos.x, y: pos.y + 1 }
    case 2:
      return { x: pos.x - 1, y: pos.y }
    case 3:
      return { x: pos.x + 1, y: pos.y }
    default:
      throw new Error(`GridWorldEnv: invalid action ${action} (expected 0-3)`)
  }
}

/**
 * Phase 30 — accepts either the current `goals: Position[]` shape or the legacy singular
 * `goal: Position` shape (and legacy configs with no `wallPenalty`), and returns the
 * canonical `GridWorldConfig`. The `unknown`-typed config boundary (SimulationEngine's
 * envConfig) means callers/tests are never statically checked against `GridWorldConfig`,
 * so this is the single place that needs to know about the legacy shape.
 */
export function normalizeGridWorldConfig(raw: unknown): GridWorldConfig {
  const input = raw as LegacyGridWorldConfigInput
  const goals = input.goals ?? (input.goal ? [input.goal] : [])
  // Legacy configs had no separate wall penalty — they reused stepReward for wall/boundary
  // collisions, so that remains the default when wallPenalty is unspecified.
  const wallPenalty = input.wallPenalty ?? input.stepReward
  return { ...input, goals, wallPenalty }
}

export function createDefaultGridWorldConfig(): GridWorldConfig {
  return {
    width: 7,
    height: 7,
    start: { x: 0, y: 0 },
    goals: [{ x: 6, y: 6 }],
    walls: [],
    stepReward: -0.1,
    wallPenalty: -0.1,
    goalReward: 10,
    terminalCells: [],
    bombs: [],
    // Same magnitude as goalReward, opposite sign — a clear, symmetric penalty on the
    // existing reward scale (stepReward=-0.1, goalReward=+10), per Phase 20 spec §3's
    // own example rather than an arbitrary new number.
    bombPenalty: -10,
  }
}

export class GridWorldEnv implements Environment {
  private config: GridWorldConfig
  private agent: Position
  /** Phase 30 — Goal StateKeys collected so far this Episode; reset alongside `agent`. */
  private collectedGoals: Set<StateKey>

  constructor(config: unknown) {
    this.config = normalizeGridWorldConfig(config)
    this.agent = { ...this.config.start }
    this.collectedGoals = new Set()
  }

  reset(): StateKey {
    this.agent = { ...this.config.start }
    this.collectedGoals = new Set()
    return positionKey(this.agent)
  }

  getState(): StateKey {
    return positionKey(this.agent)
  }

  getActionSpace(): number {
    return ACTION_SPACE
  }

  isTerminal(state: StateKey): boolean {
    if (this.config.bombs.some((bomb) => positionKey(bomb) === state)) return true
    if (this.config.terminalCells.some((cell) => positionKey(cell) === state)) return true
    const goalKeys = this.config.goals.map(positionKey)
    if (!goalKeys.includes(state)) return false
    // `state` is a Goal: terminal only if every Goal is collected once `state` counts too
    // (i.e. every other Goal was already collected this Episode).
    return goalKeys.every((key) => key === state || this.collectedGoals.has(key))
  }

  step(action: number): StepResult {
    const current = this.agent
    const attempted = applyAction(current, action)

    let next: Position
    let reward: number

    if (isOutOfBounds(attempted, this.config)) {
      next = clampPosition(attempted, this.config)
      reward = this.config.wallPenalty
    } else if (isWall(attempted, this.config)) {
      next = current
      reward = this.config.wallPenalty
    } else if (isBomb(attempted, this.config)) {
      // Phase 20: entering a Bomb is terminal, exactly like Goal, but with its own
      // penalty reward instead of goalReward. Bomb/Wall/Goal are mutually exclusive by
      // construction (Environment Editor prevents placing one on top of another), so
      // this branch never competes with the wall/goal branches for the same cell.
      next = attempted
      reward = this.config.bombPenalty
    } else {
      const goalKey = this.config.goals.find((g) => samePosition(g, attempted))
      if (goalKey) {
        const key = positionKey(goalKey)
        const alreadyCollected = this.collectedGoals.has(key)
        // Phase 30 §10: goalReward is paid only on a Goal's first visit this Episode;
        // a revisit to an already-collected Goal behaves like any other plain cell.
        reward = alreadyCollected ? this.config.stepReward : this.config.goalReward
        if (!alreadyCollected) this.collectedGoals.add(key)
        next = attempted
      } else {
        next = attempted
        reward = this.config.stepReward
      }
    }

    this.agent = next
    const nextState = positionKey(next)
    const done = this.isTerminal(nextState)
    return { nextState, reward, done }
  }

  getRenderModel(): EnvRenderModel {
    return {
      kind: 'grid',
      width: this.config.width,
      height: this.config.height,
      walls: this.config.walls.map(positionKey),
      bombs: this.config.bombs.map(positionKey),
      bombPenalty: this.config.bombPenalty,
      stepReward: this.config.stepReward,
      wallPenalty: this.config.wallPenalty,
      goalReward: this.config.goalReward,
      start: positionKey(this.config.start),
      goals: this.config.goals.map(positionKey),
      agentPos: positionKey(this.agent),
    }
  }

  getConfig(): unknown {
    return this.config
  }

  setConfig(config: unknown): void {
    // Replaces config only — does not move the agent. Callers that need the agent
    // back at the new start must call reset() explicitly (Engine's reset(overrides)
    // flow does this, per ARCHITECTURE.md §5.5).
    this.config = normalizeGridWorldConfig(config)
  }
}

export const gridWorldDefinition: EnvironmentDefinition = {
  id: 'gridworld',
  displayName: 'GridWorld',
  createDefaultConfig: createDefaultGridWorldConfig,
  create(config: unknown): Environment {
    return new GridWorldEnv(config)
  },
  editorSchema: undefined,
}
