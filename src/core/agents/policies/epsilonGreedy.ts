import type { ActionSelection } from '../../types/rl'

export interface EpsilonGreedyInput {
  qValues: number[]
  epsilon: number
  /** Injected RNG returning a value in [0, 1). Use a fixed sequence for deterministic tests. */
  random: () => number
}

/** Lowest index among the maximal Q-values wins ties — deterministic, testable. */
function argmax(values: number[]): number {
  let bestIndex = 0
  let bestValue = values[0]
  for (let i = 1; i < values.length; i++) {
    if (values[i] > bestValue) {
      bestValue = values[i]
      bestIndex = i
    }
  }
  return bestIndex
}

/**
 * Pure ε-greedy action selection. Algorithm implementations (qLearning.ts) own the
 * default RNG (Math.random); this function is unit-tested in isolation with an
 * injected RNG so behaviour at the epsilon=0/epsilon=1 boundaries is deterministic.
 */
export function epsilonGreedy(input: EpsilonGreedyInput): ActionSelection {
  const { qValues, epsilon, random } = input
  const candidateValues = [...qValues]

  const exploring = random() < epsilon
  if (exploring) {
    const action = Math.floor(random() * qValues.length)
    return { action, wasExploration: true, candidateValues }
  }

  return { action: argmax(qValues), wasExploration: false, candidateValues }
}
