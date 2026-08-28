import type { StateKey, TDInfo } from '../types/rl'
import type { AgentSnapshot } from '../types/render'
import type { ActionValueAgent } from './Agent'

/**
 * Q-table backed by a plain Map, with lazy per-state initialization (same pattern as
 * the reference repo's `get_q` — LEGACY_ANALYSIS.md §3). The only Agent actually used
 * in the MVP (Q-Learning, and later SARSA).
 */
export class TabularQAgent implements ActionValueAgent {
  readonly kind = 'Q' as const

  private readonly table = new Map<StateKey, number[]>()
  private readonly actionSpace: number

  constructor(actionSpace: number) {
    this.actionSpace = actionSpace
  }

  private getOrCreate(state: StateKey): number[] {
    let vector = this.table.get(state)
    if (!vector) {
      vector = new Array(this.actionSpace).fill(0)
      this.table.set(state, vector)
    }
    return vector
  }

  getQVector(state: StateKey): number[] {
    return [...this.getOrCreate(state)]
  }

  getValue(state: StateKey, action: number): number {
    return this.getOrCreate(state)[action]
  }

  applyUpdate(state: StateKey, action: number, tdInfo: TDInfo): void {
    const vector = this.getOrCreate(state)
    vector[action] = tdInfo.updatedEstimate
  }

  reset(): void {
    this.table.clear()
  }

  toSnapshot(): AgentSnapshot {
    const qTable: Record<StateKey, number[]> = {}
    for (const [state, vector] of this.table) {
      qTable[state] = [...vector]
    }
    return { kind: 'Q', qTable }
  }
}
