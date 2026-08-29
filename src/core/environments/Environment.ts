// ARCHITECTURE.md §4.1 — Environment (runtime instance) vs EnvironmentDefinition
// (registry-level "kind of environment") are deliberately separate types.

import type { StateKey, StepResult } from '../types/rl'
import type { EnvRenderModel } from '../types/render'

export interface Environment {
  reset(): StateKey
  step(action: number): StepResult
  getState(): StateKey
  /** Fixed action count for the whole environment (not per-state). GridWorld: 4. */
  getActionSpace(): number
  /**
   * Query independent of step() — callable right after construction/reset() without ever
   * calling step() first. Invariant enforced by every Environment implementation:
   * `step(a).done === isTerminal(step(a).nextState)`, evaluated against the environment's
   * state at that same moment. Phase 30: for environments with per-episode history (e.g.
   * GridWorld's multi-Goal "collect all before terminating"), the answer may depend on the
   * environment's current episode progress (which goals have already been collected), not
   * on `state` in isolation — it does not, however, require step() to have run.
   */
  isTerminal(state: StateKey): boolean
  getRenderModel(): EnvRenderModel
  getConfig(): unknown
  setConfig(config: unknown): void
}

export interface EnvironmentDefinition {
  id: string
  displayName: string
  createDefaultConfig(): unknown
  create(config: unknown): Environment
  /** EnvEditor form schema (Phase 7). Not defined yet in Phase 1. */
  editorSchema: unknown
}
