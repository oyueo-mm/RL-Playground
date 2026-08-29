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
  /**
   * Phase 30 — reward fields the Environment Editor needs to seed its Draft (stepReward
   * for an ordinary move, wallPenalty for a Wall/boundary-blocked attempt — independent
   * of stepReward, goalReward for a Goal's first visit this Episode, shared by every
   * Goal). Optional (unlike bombPenalty, which existing non-Editor consumers already
   * always supply) so the many pre-Phase-30 EnvRenderModel test fixtures across
   * GridSvg/TrajectoryOverlay/ValueHeatmap/PolicyOverlay — which never read these values
   * — did not need to be touched for this addition.
   */
  stepReward?: number
  wallPenalty?: number
  goalReward?: number
  start: StateKey
  /** Phase 30 — one or more Goal positions; Episode ends only once all are collected. */
  goals: StateKey[]
  agentPos: StateKey
  cellRewards?: Record<StateKey, number>
}
// Future non-grid environments add a member to this union (e.g. { kind: 'graph'; ... }).

export type AgentSnapshot =
  | { kind: 'Q'; qTable: Record<StateKey, number[]> }
  | { kind: 'V'; vTable: Record<StateKey, number> }
