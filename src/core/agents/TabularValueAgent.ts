import type { StateKey, TDInfo } from '../types/rl'
import type { AgentSnapshot } from '../types/render'
import type { ValueAgent } from './Agent'

/**
 * V-table backed by a plain Map. No Algorithm uses this yet — TD(0) is Future
 * (ARCHITECTURE.md §11, DESIGN_REVIEW.md §1 R3/R8). This exists only so the
 * `Agent = ValueAgent | ActionValueAgent` union has a real implementation to type-check
 * against, and so the shape is validated by tests now rather than guessed at later.
 */
export class TabularValueAgent implements ValueAgent {
  readonly kind = 'V' as const

  private readonly table = new Map<StateKey, number>()

  getValue(state: StateKey): number {
    return this.table.get(state) ?? 0
  }

  applyUpdate(state: StateKey, tdInfo: TDInfo): void {
    this.table.set(state, tdInfo.updatedEstimate)
  }

  reset(): void {
    this.table.clear()
  }

  toSnapshot(): AgentSnapshot {
    const vTable: Record<StateKey, number> = {}
    for (const [state, value] of this.table) {
      vTable[state] = value
    }
    return { kind: 'V', vTable }
  }
}
