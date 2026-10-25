import type { AgentSnapshot, EnvRenderModel } from '../../core/types/render'
import type { StateKey } from '../../core/types/rl'
import { stateMask } from './stateKey'

/** Rendering costs at most width×height lookups, independent of how many dynamic
 * configurations have accumulated in the Q-table. */
export function visibleQEntries(model: EnvRenderModel, agent: AgentSnapshot, currentState?: StateKey | null): [StateKey, number[]][] {
  if (agent.kind !== 'Q') return []
  const suffix = currentState ? stateMask(currentState) : undefined
  const entries: [StateKey, number[]][] = []
  for (let y = 0; y < model.height; y++) for (let x = 0; x < model.width; x++) {
    const key = `${x},${y}${suffix === undefined ? '' : `,${suffix}`}`
    if (agent.qTable[key]) entries.push([key, agent.qTable[key]])
  }
  return entries
}
