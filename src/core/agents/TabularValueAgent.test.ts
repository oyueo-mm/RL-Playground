import { describe, expect, it } from 'vitest'
import { TabularValueAgent } from './TabularValueAgent'
import type { TDInfo } from '../types/rl'

function tdInfo(updatedEstimate: number): TDInfo {
  return {
    algorithm: 'test',
    target: updatedEstimate,
    targetFormula: '',
    previousEstimate: 0,
    updatedEstimate,
    error: updatedEstimate,
  }
}

// TD(0) is Future (ARCHITECTURE.md §11) — no Algorithm uses this yet. These tests only
// confirm the ValueAgent shape is real and usable, not that it is wired up anywhere.
describe('TabularValueAgent', () => {
  it('defaults unseen states to 0', () => {
    const agent = new TabularValueAgent()
    expect(agent.getValue('unseen')).toBe(0)
  })

  it('applyUpdate writes updatedEstimate for the state', () => {
    const agent = new TabularValueAgent()
    agent.applyUpdate('s', tdInfo(4.5))
    expect(agent.getValue('s')).toBe(4.5)
  })

  it('reset() clears the table', () => {
    const agent = new TabularValueAgent()
    agent.applyUpdate('s', tdInfo(4.5))
    agent.reset()
    expect(agent.getValue('s')).toBe(0)
  })

  it('toSnapshot() reflects touched states as kind "V"', () => {
    const agent = new TabularValueAgent()
    agent.applyUpdate('a', tdInfo(2))
    expect(agent.toSnapshot()).toEqual({ kind: 'V', vTable: { a: 2 } })
  })

  it('satisfies the ValueAgent kind discriminant', () => {
    const agent = new TabularValueAgent()
    expect(agent.kind).toBe('V')
  })
})
