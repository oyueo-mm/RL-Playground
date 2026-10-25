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
  private revision = 0
  private keyCharacters = 0

  get size(): number { return this.table.size }
  get version(): number { return this.revision }
  /** Own-data estimate, not browser/process memory: UTF-16 keys + doubles + overhead allowance. */
  get estimatedBytes(): number { return this.keyCharacters * 2 + this.table.size * (this.actionSpace * 8 + 96) }

  constructor(actionSpace: number) {
    this.actionSpace = actionSpace
  }

  private getOrCreate(state: StateKey): number[] {
    let vector = this.table.get(state)
    if (!vector) {
      vector = new Array(this.actionSpace).fill(0)
      this.table.set(state, vector)
      this.keyCharacters += state.length
      this.revision++
    }
    return vector
  }

  peekQVector(state: StateKey): number[] { return [...(this.table.get(state) ?? new Array(this.actionSpace).fill(0))] }

  getQVector(state: StateKey): number[] {
    return [...this.getOrCreate(state)]
  }

  getValue(state: StateKey, action: number): number {
    return this.getOrCreate(state)[action]
  }

  applyUpdate(state: StateKey, action: number, tdInfo: TDInfo): void {
    const vector = this.getOrCreate(state)
    vector[action] = tdInfo.updatedEstimate
    this.revision++
  }

  reset(): void {
    this.table.clear()
    this.keyCharacters = 0
    this.revision++
  }

  /** A bounded, detached projection at one revision. Reads never create unseen rows. */
  toVisibleSnapshot(states: StateKey[]): AgentSnapshot {
    const qTable: Record<StateKey, number[]> = {}
    for (const key of states) {
      const vector = this.table.get(key)
      if (vector) qTable[key] = Object.freeze([...vector]) as unknown as number[]
    }
    return Object.freeze({ kind: 'Q', qTable: Object.freeze(qTable), version: this.revision, totalStates: this.size, scope: 'visible' })
  }

  toSnapshot(): AgentSnapshot {
    const qTable: Record<StateKey, number[]> = {}
    for (const [state, vector] of this.table) {
      qTable[state] = [...vector]
    }
    return { kind: 'Q', qTable }
  }
}
