// ARCHITECTURE.md §4.2 — Agent is split by table shape rather than a single type,
// because TD(0) (V-table) and Q-Learning/SARSA (Q-table) cannot share one storage
// shape. Action-selection policy is NOT here — it is owned by Algorithm (§4.3).

import type { StateKey, TDInfo } from '../types/rl'

export interface ValueAgent {
  kind: 'V'
  getValue(state: StateKey): number
  applyUpdate(state: StateKey, tdInfo: TDInfo): void
  reset(): void
}

export interface ActionValueAgent {
  kind: 'Q'
  getValue(state: StateKey, action: number): number
  /** Full Q(s,·) vector, e.g. for QValueBars (Phase 4). */
  getQVector(state: StateKey): number[]
  applyUpdate(state: StateKey, action: number, tdInfo: TDInfo): void
  reset(): void
}

export type Agent = ValueAgent | ActionValueAgent
