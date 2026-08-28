// ARCHITECTURE.md §4.1/§4.4 — StateKey/StepResult live here (single source of truth);
// Environment.ts imports them rather than redeclaring.

export type StateKey = string

export interface StepResult {
  nextState: StateKey
  reward: number
  done: boolean
}

// Transition = { state, action } & StepResult — composed rather than redeclaring
// nextState/reward/done so the two shapes cannot drift apart (ARCHITECTURE.md §4.4).
export interface Transition extends StepResult {
  state: StateKey
  action: number
}

export interface TDInfo {
  // registry id (e.g. "q-learning"), never a hardcoded literal union — new algorithms
  // must be addable via registry registration alone (ARCHITECTURE.md §4.3/§4.4, NFR-4).
  algorithm: string
  target: number
  targetFormula: string
  previousEstimate: number
  updatedEstimate: number
  error: number
}

export interface ActionSelection {
  action: number
  wasExploration: boolean
  candidateValues: number[]
}
