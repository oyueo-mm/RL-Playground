import { describe, expect, it } from 'vitest'
import { createEnvironment } from './environments/registry'
import { TabularQAgent } from './agents/TabularQAgent'
import { getAlgorithm } from './algorithms/registry'
import type { Transition } from './types/rl'

// This is NOT the SimulationEngine (that is Phase 2). It manually wires
// Environment + Agent + Algorithm the way ARCHITECTURE.md §6.1's performStep()
// eventually will, to prove the Phase 1 pieces actually compose end-to-end.
describe('GridWorld + Q-Learning integration (manual, pre-Engine)', () => {
  it('performs one full step: select -> env.step -> computeUpdate -> applyUpdate', () => {
    const env = createEnvironment('gridworld')
    const agent = new TabularQAgent(env.getActionSpace())
    const algorithm = getAlgorithm('q-learning')
    const hp = { alpha: 0.5, gamma: 0.9, epsilon: 0 } // epsilon=0 -> deterministic greedy

    const state = env.getState()
    const selection = algorithm.selectAction(state, agent, hp)
    const stepResult = env.step(selection.action)
    const transition: Transition = { state, action: selection.action, ...stepResult }

    const tdInfo = algorithm.computeUpdate(transition, agent, hp)
    agent.applyUpdate(transition.state, transition.action, tdInfo)

    expect(agent.getValue(state, selection.action)).toBe(tdInfo.updatedEstimate)
    expect(tdInfo.algorithm).toBe('q-learning')
    expect(env.getState()).toBe(stepResult.nextState)
  })

  it('runs many steps without throwing and keeps the isTerminal/done invariant', () => {
    const env = createEnvironment('gridworld')
    const agent = new TabularQAgent(env.getActionSpace())
    const algorithm = getAlgorithm('q-learning')
    const hp = { alpha: 0.1, gamma: 0.9, epsilon: 0.2 }

    for (let i = 0; i < 500; i++) {
      const state = env.getState()
      const selection = algorithm.selectAction(state, agent, hp)
      const stepResult = env.step(selection.action)
      expect(stepResult.done).toBe(env.isTerminal(stepResult.nextState))

      const transition: Transition = { state, action: selection.action, ...stepResult }
      const tdInfo = algorithm.computeUpdate(transition, agent, hp)
      agent.applyUpdate(transition.state, transition.action, tdInfo)

      if (stepResult.done) {
        env.reset()
      }
    }
  })
})
