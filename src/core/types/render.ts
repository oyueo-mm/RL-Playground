// ARCHITECTURE.md §4.4 — used in place of `unknown` in EngineSnapshot (Phase 2) so
// viz/** can render without casting.

import type { StateKey } from './rl'

export type EnvRenderModel = {
  kind: 'grid'
  width: number
  height: number
  walls: StateKey[]
  /** Phase 20 — Bomb cell positions (terminal, penalty reward — see GridWorldConfig.bombs). */
  bombs: StateKey[]
  /** Phase 20 — the uniform penalty reward for entering any bomb cell. */
  bombPenalty: number
  start: StateKey
  goal: StateKey
  agentPos: StateKey
  cellRewards?: Record<StateKey, number>
}
// Future non-grid environments add a member to this union (e.g. { kind: 'graph'; ... }).

export type AgentSnapshot =
  | { kind: 'Q'; qTable: Record<StateKey, number[]> }
  | { kind: 'V'; vTable: Record<StateKey, number> }
