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
//  - Phase 34 (State Representation audit, Phase 33): the RL State (`getState()`/
//    `step()`'s `nextState`) is no longer just the Agent's position — it is
//    `"x,y,mask"`, where `mask` is a bitmask over `config.goals`' index order marking
//    which Goals `collectedGoals` already contains. This closes the Markov-property gap
//    Phase 33 proved by direct execution: two truly different situations (same position,
//    different remaining Goals) previously collapsed onto the identical StateKey `"x,y"`,
//    so the same `Q[state][action]` slot was overwritten with contradictory targets (e.g.
//    +10 the first time a Goal was collected there, -0.1 on a later revisit once it and
//    another Goal were already collected). `positionKey()` itself is UNCHANGED and still
//    means exactly "grid cell coordinate" — it is what `getRenderModel()` (walls/bombs/
//    goals/start/agentPos, all rendering-only) and cell-membership checks keep using;
//    only the RL-facing State gets the mask suffix appended by the new `stateKeyFor()`.

import type { Environment, EnvironmentDefinition } from '../Environment'
import type { StateKey, StepResult } from '../../types/rl'
import type { EnvRenderModel } from '../../types/render'
import type { GridWorldConfig, LegacyGridWorldConfigInput, Position } from './types'
import { bombPenaltyOf, goalRewardOf, groupIds, readFeatures, toggleWallOpen, validateFeatures, positionId } from './features'

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
  const legacyRewards = (raw as Record<string, unknown>).rewardTiles
  if (legacyRewards !== undefined && (!Array.isArray(legacyRewards) || legacyRewards.length > 0)) throw new Error('Reward tiles are no longer supported. Remove rewardTiles explicitly before loading this map.')
  const input = raw as LegacyGridWorldConfigInput
  const goals = input.goals ?? (input.goal ? [input.goal] : [])
  // Legacy configs had no separate wall penalty — they reused stepReward for wall/boundary
  // collisions, so that remains the default when wallPenalty is unspecified.
  const wallPenalty = input.wallPenalty ?? input.stepReward
  const features = readFeatures(raw as Record<string, unknown>)
  const result = { ...input, goals, wallPenalty, ...features }
  delete (result as unknown as Record<string, unknown>).rewardTiles
  const errors = validateFeatures(result)
  if (errors.length) throw new Error(errors.join(' '))
  return structuredClone(result)
}

/** V4 — only overridden cells are listed, so legacy maps produce no extra render fields. */
export function elementRewardFields(config: Pick<GridWorldConfig, 'goals' | 'bombs'>): Pick<EnvRenderModel, 'goalRewards' | 'bombPenalties'> {
  const goals = config.goals.filter(goal => goal.reward !== undefined), bombs = config.bombs.filter(bomb => bomb.penalty !== undefined)
  return {
    ...(goals.length ? { goalRewards: Object.fromEntries(goals.map(goal => [positionKey(goal), goal.reward!])) } : {}),
    ...(bombs.length ? { bombPenalties: Object.fromEntries(bombs.map(bomb => [positionKey(bomb), bomb.penalty!])) } : {}),
  }
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
  private collapsed = new Set<StateKey>()
  private openGroups = new Set<string>()

  private wallIndex = new Set<string>()
  private bombIndex = new Set<string>()
  private terminalIndex = new Set<string>()
  private goalBits = new Map<string, bigint>()
  private fragileBits = new Map<string, bigint>()
  private groupBits = new Map<string, bigint>()
  private portalIndex = new Map<string, Position>()
  private directionIndex = new Map<string, number>()
  private switchIndex = new Map<string, string>()
  private wallGroups = new Map<string, string>()
  /** V4 — toggle walls that start open; a group toggle flips them closed (see toggleWallOpen). */
  private initiallyOpenWalls = new Set<string>()
  /** V4 — resolved per-cell rewards (own override, else the map-wide default). */
  private goalRewards = new Map<string, number>()
  private bombPenalties = new Map<string, number>()
  private goalMask = 0n
  private fragileMask = 0n
  private toggleMask = 0n
  private fullGoalMask = 0n
  private terrain: Omit<EnvRenderModel, 'agentPos'> | null = null

  private indexConfig(): void {
    this.wallIndex = new Set(this.config.walls.map(positionKey))
    this.bombIndex = new Set(this.config.bombs.map(positionKey))
    this.terminalIndex = new Set(this.config.terminalCells.map(positionKey))
    this.goalBits = new Map(this.config.goals.map((p, i) => [positionKey(p), 1n << BigInt(i)]))
    this.fragileBits = new Map(this.config.fragiles?.map((p, i) => [positionKey(p), 1n << BigInt(i)]))
    this.groupBits = new Map(groupIds(this.config).map((id, i) => [id, 1n << BigInt(i)]))
    this.portalIndex = new Map(this.config.portals?.flatMap(pair => [[positionKey(pair.ends[0]), pair.ends[1]], [positionKey(pair.ends[1]), pair.ends[0]]] as [string, Position][]))
    this.directionIndex = new Map(this.config.oneWays?.map(tile => [positionKey(tile), tile.direction]))
    this.switchIndex = new Map(this.config.switches?.map(tile => [positionKey(tile), tile.groupId]))
    this.wallGroups = new Map(this.config.toggleWalls?.map(tile => [positionKey(tile), tile.groupId]))
    this.initiallyOpenWalls = new Set(this.config.toggleWalls?.filter(tile => tile.initialOpen).map(positionKey))
    this.goalRewards = new Map(this.config.goals.map(goal => [positionKey(goal), goalRewardOf(goal, this.config.goalReward)]))
    this.bombPenalties = new Map(this.config.bombs.map(bomb => [positionKey(bomb), bombPenaltyOf(bomb, this.config.bombPenalty)]))
    this.fullGoalMask = (1n << BigInt(this.config.goals.length)) - 1n
    // setConfig preserves episode contents until reset, including reordered bit indices.
    this.goalMask = [...this.collectedGoals].reduce((mask, key) => mask | (this.goalBits.get(key) ?? 0n), 0n)
    this.fragileMask = [...this.collapsed].reduce((mask, key) => mask | (this.fragileBits.get(key) ?? 0n), 0n)
    this.toggleMask = [...this.openGroups].reduce((mask, id) => mask | (this.groupBits.get(id) ?? 0n), 0n)
    this.terrain = null
  }

  constructor(config: unknown) {
    this.config = normalizeGridWorldConfig(config)
    this.agent = { ...this.config.start }
    this.collectedGoals = new Set()
    this.indexConfig()
  }

  reset(): StateKey {
    this.agent = { ...this.config.start }
    this.collectedGoals = new Set()
    this.collapsed.clear()
    this.openGroups.clear()
    this.goalMask = 0n; this.fragileMask = 0n; this.toggleMask = 0n; this.terrain = null
    return this.stateKeyFor(this.agent)
  }

  getState(): StateKey {
    return this.stateKeyFor(this.agent)
  }

  /** Independent episode state; immutable configuration/indices may be shared by auditors. */
  fork(): GridWorldEnv {
    const copy = Object.assign(Object.create(GridWorldEnv.prototype) as GridWorldEnv, this)
    copy.agent = { ...this.agent }
    copy.collectedGoals = new Set(this.collectedGoals)
    copy.collapsed = new Set(this.collapsed)
    copy.openGroups = new Set(this.openGroups)
    return copy
  }

  /** A sufficient, conservative proof only: no action changes the complete state. */
  isImmobile(): boolean {
    if (this.isTerminal(this.getState())) return false
    const key = this.getState()
    for (let action = 0; action < 4; action++) if (this.fork().step(action).nextState !== key) return false
    return true
  }

  getActionSpace(): number {
    return ACTION_SPACE
  }

  /**
   * Phase 34 — bit `i` is set iff `config.goals[i]` is in `collectedGoals`. `config.goals`'
   * array order is used as each Goal's fixed index for the lifetime of this instance
   * (never reordered, `config.goals` itself never mutated — see the file header).
   */
  private stateKeyFor(pos: Position): StateKey {
    const base = `${positionKey(pos)},${this.goalMask}`
    if (!this.config.fragiles?.length && !this.config.toggleWalls?.length) return base
    return `${base},${this.fragileMask.toString(16)},${this.toggleMask.toString(16)}`
  }

  isTerminal(state: StateKey): boolean {
    // Phase 34: `state` is now "x,y,mask" — parse the position back out for the
    // position-only Bomb/terminalCells checks (unchanged semantics), and read `mask`
    // directly from the input rather than `this.collectedGoals`, so this stays a query
    // purely of `state` itself (independent of step()/of this instance's current episode
    // progress) exactly as already documented on `Environment.isTerminal()`.
    const [xStr, yStr, maskStr] = state.split(',')
    const pos: Position = { x: Number(xStr), y: Number(yStr) }
    const mask = BigInt(maskStr ?? '0')

    if (this.bombIndex.has(positionKey(pos))) return true
    if (this.terminalIndex.has(positionKey(pos))) return true
    if (!this.goalBits.has(positionKey(pos))) return false
    // `pos` is a Goal cell: terminal only once every Goal's bit is set in `mask`.
    return mask === this.fullGoalMask
  }

  step(action: number): StepResult {
    const current = this.agent
    let attempted = applyAction(current, action)
    const oneWay = this.directionIndex.get(positionKey(current))
    const blockedByDirection = oneWay !== undefined && oneWay !== action
    const attemptedKey = positionKey(attempted)
    const wallGroup = this.wallGroups.get(attemptedKey)
    // V4: open = initialOpen XOR group toggled; the state key's toggleMask (group parity)
    // plus the static initial states fully determine every wall, so no new state bits.
    const closedWall = wallGroup !== undefined && this.initiallyOpenWalls.has(attemptedKey) === this.openGroups.has(wallGroup)
    const blockedByDynamic = this.collapsed.has(positionId(attempted)) || closedWall
    if (!blockedByDirection && !blockedByDynamic && !isOutOfBounds(attempted, this.config) && !this.wallIndex.has(positionKey(attempted))) {
      attempted = this.portalIndex.get(positionKey(attempted)) ?? attempted
    }

    let next: Position
    let reward: number

    if (blockedByDirection || blockedByDynamic) {
      next = current
      reward = this.config.wallPenalty
    } else if (isOutOfBounds(attempted, this.config)) {
      next = clampPosition(attempted, this.config)
      reward = this.config.wallPenalty
    } else if (this.wallIndex.has(positionKey(attempted))) {
      next = current
      reward = this.config.wallPenalty
    } else if (this.bombIndex.has(positionKey(attempted))) {
      // Phase 20: entering a Bomb is terminal, exactly like Goal, but with its own
      // penalty reward instead of goalReward. Bomb/Wall/Goal are mutually exclusive by
      // construction (Environment Editor prevents placing one on top of another), so
      // this branch never competes with the wall/goal branches for the same cell.
      next = attempted
      reward = this.bombPenalties.get(positionKey(attempted))!
    } else {
      const key = positionKey(attempted)
      const goalBit = this.goalBits.get(key)
      if (goalBit !== undefined) {
        const alreadyCollected = this.collectedGoals.has(key)
        // Phase 30 §10: goalReward is paid only on a Goal's first visit this Episode;
        // a revisit to an already-collected Goal behaves like any other plain cell.
        reward = alreadyCollected ? this.config.stepReward : this.goalRewards.get(key)!
        if (!alreadyCollected) { this.collectedGoals.add(key); this.goalMask |= goalBit; this.terrain = null }
        next = attempted
      } else {
        next = attempted
        reward = this.config.stepReward
      }
    }

    if (!samePosition(current, next)) {
      const bit = this.fragileBits.get(positionKey(current))
      if (bit !== undefined) { this.collapsed.add(positionKey(current)); this.fragileMask |= bit; this.terrain = null }
      const pressed = this.switchIndex.get(positionKey(next))
      if (pressed) {
        if (this.openGroups.has(pressed)) this.openGroups.delete(pressed)
        else this.openGroups.add(pressed)
        this.toggleMask ^= this.groupBits.get(pressed)!
        this.terrain = null
      }
    }
    this.agent = next
    // Phase 34: computed AFTER `this.agent = next` and after any `collectedGoals.add()`
    // above, so `nextState`'s mask correctly reflects "post-action, post-collection-
    // judgment" — the snapshot semantics required for the Q-Learning/SARSA target to see
    // the Goal it just collected. `state` (the pre-action snapshot used in Transition) is
    // never touched here — it was already captured by a separate `getState()` call before
    // `step()` was invoked (SimulationEngine.performOneStep()), so it still reflects
    // collectedGoals as of BEFORE this step.
    const nextState = this.stateKeyFor(next)
    const done = this.isTerminal(nextState)
    return { nextState, reward, done }
  }

  getRenderModel(): EnvRenderModel {
    if (!this.terrain) this.terrain = {
      kind: 'grid',
      width: this.config.width,
      height: this.config.height,
      walls: [...this.config.walls.map(positionKey), ...this.collapsed, ...(this.config.toggleWalls ?? []).filter(tile => !toggleWallOpen(tile, this.openGroups.has(tile.groupId))).map(positionId)],
      bombs: this.config.bombs.map(positionKey),
      bombPenalty: this.config.bombPenalty,
      stepReward: this.config.stepReward,
      wallPenalty: this.config.wallPenalty,
      goalReward: this.config.goalReward,
      ...elementRewardFields(this.config),
      start: positionKey(this.config.start),
      // Phase 32: visible goals = configured goals minus this Episode's collectedGoals —
      // `this.config.goals` itself is never mutated (stays the static, restorable
      // configuration); only this render-time projection changes as Goals are collected.
      goals: this.config.goals.map(positionKey).filter((key) => !this.collectedGoals.has(key)),
      // Phase 44 — the full, static Goal list `config.goals` itself, never filtered by
      // `collectedGoals`. Distinct from `goals` above specifically so callers that need
      // "the true total Goal count" (StatsPanel's "N / M Goals Collected") have a source
      // that cannot shrink as Goals are collected — see render.ts's doc comment.
      allGoals: this.config.goals.map(positionKey),
      ...(this.config.portals?.length || this.config.oneWays?.length || this.config.fragiles?.length || this.config.switches?.length || this.config.toggleWalls?.length ? {
        features: { portals: this.config.portals, oneWays: this.config.oneWays, fragiles: this.config.fragiles, switches: this.config.switches, toggleWalls: this.config.toggleWalls },
        staticWalls: this.config.walls.map(positionKey), collapsedFragiles: [...this.collapsed], openGroups: [...this.openGroups],
      } : {}),
    }
    return { ...this.terrain, agentPos: positionKey(this.agent) }
  }

  getConfig(): unknown {
    return structuredClone(this.config)
  }

  setConfig(config: unknown): void {
    // Replaces config only — does not move the agent. Callers that need the agent
    // back at the new start must call reset() explicitly (Engine's reset(overrides)
    // flow does this, per ARCHITECTURE.md §5.5).
    this.config = normalizeGridWorldConfig(config)
    this.indexConfig()
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
