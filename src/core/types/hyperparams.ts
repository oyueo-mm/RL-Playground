// ARCHITECTURE.md §4.5 — HyperparamPanel (Phase 5+) generates its form by iterating
// Algorithm.hyperparamSchema; no algorithm-specific UI code should be hardcoded.

export interface HyperparamField {
  key: string
  label: string
  type: 'number' | 'range'
  min?: number
  max?: number
  step?: number
  default: number
}

export type HyperparamSchema = HyperparamField[]

export type Hyperparams = Record<string, number>
