import { describe, expect, it } from 'vitest'
import { getAlgorithm, listAlgorithms } from './registry'

describe('algorithm registry', () => {
  it('looks up Q-Learning by id "q-learning"', () => {
    const algorithm = getAlgorithm('q-learning')
    expect(algorithm.id).toBe('q-learning')
    expect(algorithm.requiredAgentKind).toBe('Q')
  })

  it('looks up SARSA by id "sarsa" (Phase 8)', () => {
    const algorithm = getAlgorithm('sarsa')
    expect(algorithm.id).toBe('sarsa')
    expect(algorithm.requiredAgentKind).toBe('Q')
    expect(typeof algorithm.pickNextAction).toBe('function')
  })

  it('lists registered algorithms', () => {
    const algorithms = listAlgorithms()
    expect(algorithms.map((a) => a.id)).toContain('q-learning')
    expect(algorithms.map((a) => a.id)).toContain('sarsa')
  })

  it('throws a clear error for an unknown algorithm id', () => {
    expect(() => getAlgorithm('does-not-exist')).toThrow(/does-not-exist/)
  })
})
