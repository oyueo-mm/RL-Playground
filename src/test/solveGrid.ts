import { GridWorldEnv } from '../core/environments/gridworld/GridWorldEnv'
import type { GridWorldConfig } from '../core/environments/gridworld/types'

/** Test-only BFS over the actual environment's complete state keys. Replaying a
 * short path reconstructs all goal, fragile and switch state without a test-only
 * state mutation API in the production environment. */
export function solveGrid(config: GridWorldConfig, maxStates = 30_000): { actions: number[]; visited: number } | null {
  const initial = new GridWorldEnv(config)
  const seen = new Set([initial.reset()])
  const queue: number[][] = [[]]
  for (let index = 0; index < queue.length && seen.size <= maxStates; index++) {
    for (let action = 0; action < 4; action++) {
      const env = new GridWorldEnv(config)
      for (const previous of queue[index]) env.step(previous)
      const result = env.step(action)
      const actions = [...queue[index], action]
      if (result.done && env.getRenderModel().goals.length === 0) return { actions, visited: seen.size }
      if (result.done || seen.has(result.nextState)) continue
      seen.add(result.nextState)
      queue.push(actions)
    }
  }
  if (seen.size > maxStates) throw new Error(`Search budget exhausted at ${seen.size} states; solvability is unknown.`)
  return null
}
