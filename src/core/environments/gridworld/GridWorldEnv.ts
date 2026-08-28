// GridWorld: TS re-implementation of the reference repo's Env.py, adapted to the
// Environment contract confirmed in ARCHITECTURE.md §4.1. See LEGACY_ANALYSIS.md §2
// for the original Python rules this is based on.
//
// Deliberate differences from the legacy reference (see LEGACY_ANALYSIS.md §5):
//  - Walls are a new concept (non-terminal, blocks movement). The legacy repo only had
//    grid boundaries; "bombs" there were terminal (closer to a future Trap, FR-10).
//  - Both an out-of-bounds attempt and a blocked-by-wall attempt use the plain
//    `stepReward` (no separate boundary/wall penalty) — this is what the current
//    Phase 1 spec's Config field list (width/height/start/goal/walls/stepReward/
//    goalReward/terminalCells) supports; it does not ask for a distinct penalty field.
//  - Terminal state resolution is explicit (`isTerminal`) rather than inferred from
//    reward, closing the "terminal but still bootstrapped" trap noted in
//    LEGACY_ANALYSIS.md §3.

import type { Environment, EnvironmentDefinition } from '../Environment'
import type { StateKey, StepResult } from '../../types/rl'
import type { EnvRenderModel } from '../../types/render'
import type { GridWorldConfig, Position } from './types'

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

export function createDefaultGridWorldConfig(): GridWorldConfig {
  return {
    width: 7,
    height: 7,
    start: { x: 0, y: 0 },
    goal: { x: 6, y: 6 },
    walls: [],
    stepReward: -0.1,
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

  constructor(config: GridWorldConfig) {
    this.config = config
    this.agent = { ...config.start }
  }

  reset(): StateKey {
    this.agent = { ...this.config.start }
    return positionKey(this.agent)
  }

  getState(): StateKey {
    return positionKey(this.agent)
  }

  getActionSpace(): number {
    return ACTION_SPACE
  }

  isTerminal(state: StateKey): boolean {
    if (state === positionKey(this.config.goal)) return true
    if (this.config.terminalCells.some((cell) => positionKey(cell) === state)) return true
    return this.config.bombs.some((bomb) => positionKey(bomb) === state)
  }

  step(action: number): StepResult {
    const current = this.agent
    const attempted = applyAction(current, action)

    let next: Position
    let reward: number

    if (isOutOfBounds(attempted, this.config)) {
      next = clampPosition(attempted, this.config)
      reward = this.config.stepReward
    } else if (isWall(attempted, this.config)) {
      next = current
      reward = this.config.stepReward
    } else if (isBomb(attempted, this.config)) {
      // Phase 20: entering a Bomb is terminal, exactly like Goal, but with its own
      // penalty reward instead of goalReward. Bomb/Wall/Goal are mutually exclusive by
      // construction (Environment Editor prevents placing one on top of another), so
      // this branch never competes with the wall/goal branches for the same cell.
      next = attempted
      reward = this.config.bombPenalty
    } else if (samePosition(attempted, this.config.goal)) {
      next = attempted
      reward = this.config.goalReward
    } else {
      next = attempted
      reward = this.config.stepReward
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
      start: positionKey(this.config.start),
      goal: positionKey(this.config.goal),
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
    this.config = config as GridWorldConfig
  }
}

export const gridWorldDefinition: EnvironmentDefinition = {
  id: 'gridworld',
  displayName: 'GridWorld',
  createDefaultConfig: createDefaultGridWorldConfig,
  create(config: unknown): Environment {
    return new GridWorldEnv(config as GridWorldConfig)
  },
  editorSchema: undefined,
}
