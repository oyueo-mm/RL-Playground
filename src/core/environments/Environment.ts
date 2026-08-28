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
   * Pure query, independent of step(). Invariant enforced by every Environment
   * implementation: `step(a).done === isTerminal(step(a).nextState)`.
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
