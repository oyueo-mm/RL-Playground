import { describe, expect, it } from 'vitest'
import { epsilonGreedy } from './epsilonGreedy'

/** Returns a fixed sequence of values in [0,1), one per call. */
function sequenceRng(values: number[]): () => number {
  let i = 0
  return () => {
    const v = values[Math.min(i, values.length - 1)]
    i++
    return v
  }
}

describe('epsilonGreedy', () => {
  it('epsilon=0 always selects the greedy action, regardless of RNG', () => {
    const qValues = [1, 5, 3, 2]
    const selection = epsilonGreedy({ qValues, epsilon: 0, random: sequenceRng([0.9999]) })
    expect(selection.action).toBe(1) // index of max value (5)
    expect(selection.wasExploration).toBe(false)
  })

  it('epsilon=1 always takes the exploration branch', () => {
    const qValues = [1, 5, 3, 2]
    // random() < 1 is always true for any value in [0,1)
    const selection = epsilonGreedy({ qValues, epsilon: 1, random: sequenceRng([0.0, 0.0]) })
    expect(selection.wasExploration).toBe(true)
  })

  it('result is fully determined by the injected RNG', () => {
    const qValues = [1, 5, 3, 2]
    // first draw (0.5) >= epsilon(0.3) -> exploit path -> greedy action, ignoring 2nd value
    const exploit = epsilonGreedy({ qValues, epsilon: 0.3, random: sequenceRng([0.5, 0.9]) })
    expect(exploit.wasExploration).toBe(false)
    expect(exploit.action).toBe(1)

    // first draw (0.1) < epsilon(0.3) -> explore path -> action from 2nd draw
    // random()=0.5 over length 4 -> floor(0.5*4)=2
    const explore = epsilonGreedy({ qValues, epsilon: 0.3, random: sequenceRng([0.1, 0.5]) })
    expect(explore.wasExploration).toBe(true)
    expect(explore.action).toBe(2)
  })

  it('candidateValues reflects the input Q-values exactly', () => {
    const qValues = [1, 5, 3, 2]
    const selection = epsilonGreedy({ qValues, epsilon: 0, random: sequenceRng([0.5]) })
    expect(selection.candidateValues).toEqual([1, 5, 3, 2])
  })

  it('ties break deterministically toward the lowest index', () => {
    const qValues = [4, 4, 1, 4]
    const selection = epsilonGreedy({ qValues, epsilon: 0, random: sequenceRng([0.5]) })
    expect(selection.action).toBe(0)
  })
})
