import { describe, expect, it } from 'vitest'
import { TabularQAgent } from '../agents/TabularQAgent'
import type { TDInfo, Transition } from '../types/rl'
import { qLearning } from './qLearning'

/** Seeds Q(state, action) directly via applyUpdate (bypasses the update formula). */
function seed(agent: TabularQAgent, state: string, action: number, value: number): void {
  const tdInfo: TDInfo = {
    algorithm: 'seed',
    target: value,
    targetFormula: '',
    previousEstimate: 0,
    updatedEstimate: value,
    error: value,
  }
  agent.applyUpdate(state, action, tdInfo)
}

describe('qLearning', () => {
  it('exposes id "q-learning" and requiredAgentKind "Q"', () => {
    expect(qLearning.id).toBe('q-learning')
    expect(qLearning.requiredAgentKind).toBe('Q')
  })

  it('computes a hand-verifiable non-terminal TD target/error/update', () => {
    const agent = new TabularQAgent(4)
    // Q(s1, ·) = [1, 2, 0.5, -1] -> max = 2
    seed(agent, '1,0', 0, 1)
    seed(agent, '1,0', 1, 2)
    seed(agent, '1,0', 2, 0.5)
    seed(agent, '1,0', 3, -1)
    // Q(s0, action=3) starts at the default 0 (not seeded).

    const transition: Transition = {
      state: '0,0',
      action: 3,
      reward: -0.1,
      nextState: '1,0',
      done: false,
    }
    const hp = { alpha: 0.5, gamma: 0.9, epsilon: 0 }

    const tdInfo = qLearning.computeUpdate(transition, agent, hp)

    const reward = -0.1
    const gamma = 0.9
    const bootstrap = 2
    const expectedTarget = reward + gamma * bootstrap
    const expectedError = expectedTarget - 0
    const expectedUpdated = 0 + hp.alpha * expectedError

    expect(tdInfo.algorithm).toBe('q-learning')
    expect(tdInfo.previousEstimate).toBe(0)
    expect(tdInfo.target).toBeCloseTo(expectedTarget, 12)
    expect(tdInfo.error).toBeCloseTo(expectedError, 12)
    expect(tdInfo.updatedEstimate).toBeCloseTo(expectedUpdated, 12)
    expect(tdInfo.targetFormula).toBe(
      `target = r + γ·max Q(s',·) = ${reward} + ${gamma} × ${bootstrap} = ${expectedTarget}`,
    )
  })

  it('disables bootstrap on a terminal transition (target = reward only)', () => {
    const agent = new TabularQAgent(4)
    seed(agent, '6,6', 0, 3) // Q(s, a=0) = 3 before update
    // next state's Q-values must NOT affect a terminal update, even if non-zero.
    seed(agent, 'TERMINAL_NEXT', 0, 999)

    const transition: Transition = {
      state: '6,6',
      action: 0,
      reward: 10,
      nextState: 'TERMINAL_NEXT',
      done: true,
    }
    const hp = { alpha: 0.5, gamma: 0.9, epsilon: 0 }

    const tdInfo = qLearning.computeUpdate(transition, agent, hp)

    expect(tdInfo.target).toBe(10) // reward only, no gamma*bootstrap term
    expect(tdInfo.previousEstimate).toBe(3)
    expect(tdInfo.error).toBe(7)
    expect(tdInfo.updatedEstimate).toBe(3 + 0.5 * 7)
    expect(tdInfo.targetFormula).toContain('terminal')
  })

  it('scales the update by alpha', () => {
    const agent = new TabularQAgent(4)
    const transition: Transition = { state: 's', action: 0, reward: 1, nextState: 's2', done: true }

    const low = qLearning.computeUpdate(transition, agent, { alpha: 0.1, gamma: 0.9, epsilon: 0 })
    expect(low.updatedEstimate).toBeCloseTo(0 + 0.1 * (1 - 0), 12)

    const agent2 = new TabularQAgent(4)
    const high = qLearning.computeUpdate(transition, agent2, { alpha: 0.9, gamma: 0.9, epsilon: 0 })
    expect(high.updatedEstimate).toBeCloseTo(0 + 0.9 * (1 - 0), 12)
  })

  it('scales the bootstrap term by gamma', () => {
    const makeAgent = () => {
      const agent = new TabularQAgent(4)
      seed(agent, 's2', 0, 10) // max Q(s2,·) = 10
      return agent
    }
    const transition: Transition = { state: 's', action: 0, reward: 0, nextState: 's2', done: false }

    const lowGamma = qLearning.computeUpdate(transition, makeAgent(), { alpha: 1, gamma: 0, epsilon: 0 })
    expect(lowGamma.target).toBe(0) // reward(0) + 0*10

    const highGamma = qLearning.computeUpdate(transition, makeAgent(), { alpha: 1, gamma: 1, epsilon: 0 })
    expect(highGamma.target).toBe(10) // reward(0) + 1*10
  })

  it('selectAction uses ActionValueAgent Q-vectors via epsilon-greedy (epsilon=0 is deterministic)', () => {
    const agent = new TabularQAgent(4)
    seed(agent, 's', 0, 1)
    seed(agent, 's', 1, 5)
    seed(agent, 's', 2, 3)
    seed(agent, 's', 3, 2)

    const selection = qLearning.selectAction('s', agent, { alpha: 0.1, gamma: 0.9, epsilon: 0 })
    expect(selection.action).toBe(1)
    expect(selection.wasExploration).toBe(false)
    expect(selection.candidateValues).toEqual([1, 5, 3, 2])
  })

  it('does not implement pickNextAction (off-policy, no next-action reuse needed)', () => {
    expect(qLearning.pickNextAction).toBeUndefined()
  })
})
