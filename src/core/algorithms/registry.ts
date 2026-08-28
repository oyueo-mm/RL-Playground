import type { Algorithm } from './Algorithm'
import { qLearning } from './qLearning'
import { sarsa } from './sarsa'

const registry = new Map<string, Algorithm>()

export function registerAlgorithm(algorithm: Algorithm): void {
  registry.set(algorithm.id, algorithm)
}

export function getAlgorithm(id: string): Algorithm {
  const algorithm = registry.get(id)
  if (!algorithm) {
    throw new Error(`Unknown algorithm id: "${id}"`)
  }
  return algorithm
}

export function listAlgorithms(): Algorithm[] {
  return Array.from(registry.values())
}

registerAlgorithm(qLearning)
registerAlgorithm(sarsa)
