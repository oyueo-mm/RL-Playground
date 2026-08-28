import { describe, expect, it } from 'vitest'
import { TabularQAgent } from './TabularQAgent'
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

describe('TabularQAgent', () => {
  it('lazily initializes unseen states to a zero vector of the given action space size', () => {
    const agent = new TabularQAgent(4)
    expect(agent.getQVector('unseen')).toEqual([0, 0, 0, 0])
    expect(agent.getValue('unseen', 2)).toBe(0)
  })

  it('applyUpdate writes updatedEstimate into the (state, action) slot only', () => {
    const agent = new TabularQAgent(4)
    agent.applyUpdate('s', 2, tdInfo(7))
    expect(agent.getQVector('s')).toEqual([0, 0, 7, 0])
    expect(agent.getValue('s', 2)).toBe(7)
  })

  it('reset() clears the table back to lazy defaults', () => {
    const agent = new TabularQAgent(4)
    agent.applyUpdate('s', 0, tdInfo(9))
    agent.reset()
    expect(agent.getQVector('s')).toEqual([0, 0, 0, 0])
  })

  it('toSnapshot() reflects only states that were actually touched', () => {
    const agent = new TabularQAgent(4)
    agent.applyUpdate('a', 0, tdInfo(1))
    const snapshot = agent.toSnapshot()
    expect(snapshot).toEqual({ kind: 'Q', qTable: { a: [1, 0, 0, 0] } })
  })

  it('getQVector returns a copy, not a live reference into the table', () => {
    const agent = new TabularQAgent(4)
    const vector = agent.getQVector('s')
    vector[0] = 999
    expect(agent.getQVector('s')).toEqual([0, 0, 0, 0])
  })
})
