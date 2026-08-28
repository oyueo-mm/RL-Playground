import { describe, expect, it } from 'vitest'
import { TabularQAgent } from '../agents/TabularQAgent'
import type { ActionSelection, TDInfo, Transition } from '../types/rl'
import { qLearning } from './qLearning'
import { sarsa } from './sarsa'

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

function actionSelection(action: number, candidateValues: number[] = []): ActionSelection {
  return { action, wasExploration: false, candidateValues }
}

describe('sarsa', () => {
  it('exposes id "sarsa" and requiredAgentKind "Q"', () => {
    expect(sarsa.id).toBe('sarsa')
    expect(sarsa.requiredAgentKind).toBe('Q')
  })

  it('implements pickNextAction (on-policy — Engine caches it as pendingAction)', () => {
    expect(typeof sarsa.pickNextAction).toBe('function')
  })

  it('computes a hand-verifiable non-terminal TD target using Q(nextState, nextAction) — NOT max', () => {
    const agent = new TabularQAgent(4)
    // Q(s1, ·) = [1.0, 2.0, 3.0, 4.0] (Phase 8 §9's own worked example). If SARSA used
    // max like Q-Learning it would use 4.0 (index 3); deliberately picking
    // nextAction=2 (value 3.0) proves it uses the actual next action, not argmax.
    seed(agent, '1,0', 0, 1.0)
    seed(agent, '1,0', 1, 2.0)
    seed(agent, '1,0', 2, 3.0)
    seed(agent, '1,0', 3, 4.0)

    const transition: Transition = { state: '0,0', action: 3, reward: -0.1, nextState: '1,0', done: false }
    const nextAction = actionSelection(2)
    const hp = { alpha: 0.5, gamma: 0.9, epsilon: 0 }

    const tdInfo = sarsa.computeUpdate(transition, agent, hp, nextAction)

    const reward = -0.1
    const gamma = 0.9
    const nextQ = 3.0 // Q(s1, action=2), the actual next action — not max(Q(s1,·))=4.0
    const expectedTarget = reward + gamma * nextQ
    const expectedError = expectedTarget - 0
    const expectedUpdated = 0 + hp.alpha * expectedError

    expect(tdInfo.algorithm).toBe('sarsa')
    expect(tdInfo.previousEstimate).toBe(0)
    expect(tdInfo.target).toBeCloseTo(expectedTarget, 12)
    expect(tdInfo.error).toBeCloseTo(expectedError, 12)
    expect(tdInfo.updatedEstimate).toBeCloseTo(expectedUpdated, 12)
    expect(tdInfo.targetFormula).toBe(
      `target = r + γ·Q(s',a') = ${reward} + ${gamma} × ${nextQ} = ${expectedTarget}`,
    )
  })

  it('disables bootstrap on a terminal transition (target = reward only), even with a nextAction supplied', () => {
    const agent = new TabularQAgent(4)
    seed(agent, '6,6', 0, 3) // Q(s, a=0) = 3 before update
    seed(agent, 'TERMINAL_NEXT', 1, 999) // must NOT affect a terminal update

    const transition: Transition = { state: '6,6', action: 0, reward: 10, nextState: 'TERMINAL_NEXT', done: true }
    const nextAction = actionSelection(1) // points straight at the 999 entry
    const hp = { alpha: 0.5, gamma: 0.9, epsilon: 0 }

    const tdInfo = sarsa.computeUpdate(transition, agent, hp, nextAction)

    expect(tdInfo.target).toBe(10)
    expect(tdInfo.previousEstimate).toBe(3)
    expect(tdInfo.error).toBe(7)
    expect(tdInfo.updatedEstimate).toBe(3 + 0.5 * 7)
    expect(tdInfo.targetFormula).toContain('terminal')
  })

  it('scales the update by alpha', () => {
    const transition: Transition = { state: 's', action: 0, reward: 1, nextState: 's2', done: true }

    const low = sarsa.computeUpdate(transition, new TabularQAgent(4), { alpha: 0.1, gamma: 0.9, epsilon: 0 })
    expect(low.updatedEstimate).toBeCloseTo(0 + 0.1 * (1 - 0), 12)

    const high = sarsa.computeUpdate(transition, new TabularQAgent(4), { alpha: 0.9, gamma: 0.9, epsilon: 0 })
    expect(high.updatedEstimate).toBeCloseTo(0 + 0.9 * (1 - 0), 12)
  })

  it('scales the Q(s\',a\') bootstrap term by gamma', () => {
    const makeAgent = () => {
      const agent = new TabularQAgent(4)
      seed(agent, 's2', 0, 10)
      return agent
    }
    const transition: Transition = { state: 's', action: 0, reward: 0, nextState: 's2', done: false }
    const nextAction = actionSelection(0)

    const lowGamma = sarsa.computeUpdate(transition, makeAgent(), { alpha: 1, gamma: 0, epsilon: 0 }, nextAction)
    expect(lowGamma.target).toBe(0)

    const highGamma = sarsa.computeUpdate(transition, makeAgent(), { alpha: 1, gamma: 1, epsilon: 0 }, nextAction)
    expect(highGamma.target).toBe(10)
  })

  it('selectAction uses ActionValueAgent Q-vectors via epsilon-greedy (epsilon=0 is deterministic)', () => {
    const agent = new TabularQAgent(4)
    seed(agent, 's', 0, 1)
    seed(agent, 's', 1, 5)
    seed(agent, 's', 2, 3)
    seed(agent, 's', 3, 2)

    const selection = sarsa.selectAction('s', agent, { alpha: 0.1, gamma: 0.9, epsilon: 0 })
    expect(selection.action).toBe(1)
    expect(selection.wasExploration).toBe(false)
    expect(selection.candidateValues).toEqual([1, 5, 3, 2])
  })

  it('pickNextAction uses ActionValueAgent Q-vectors via epsilon-greedy, same tie-break rule (lowest index)', () => {
    const agent = new TabularQAgent(4)
    seed(agent, 's2', 0, 4)
    seed(agent, 's2', 1, 4)
    seed(agent, 's2', 2, 1)
    seed(agent, 's2', 3, 4)

    const selection = sarsa.pickNextAction!('s2', agent, { alpha: 0.1, gamma: 0.9, epsilon: 0 })
    expect(selection.action).toBe(0) // tie among 0/1/3 at value 4 -> lowest index wins
    expect(selection.wasExploration).toBe(false)
  })

  it('Q-Learning vs SARSA: same transition/Q-vector, different targets (max vs. actual next action)', () => {
    const buildAgent = () => {
      const agent = new TabularQAgent(4)
      seed(agent, 's2', 0, 1)
      seed(agent, 's2', 1, 5) // the max
      seed(agent, 's2', 2, 2)
      seed(agent, 's2', 3, 3)
      return agent
    }
    const transition: Transition = { state: 's', action: 0, reward: 0, nextState: 's2', done: false }
    const hp = { alpha: 1, gamma: 1, epsilon: 0 }

    const qLearningResult = qLearning.computeUpdate(transition, buildAgent(), hp)
    expect(qLearningResult.target).toBe(5) // max(Q(s2,·)) = 5

    // SARSA's actual next action (as chosen by pickNextAction / the policy) is 0, not
    // the greedy max — its target must reflect Q(s2, 0) = 1, not 5.
    const sarsaResult = sarsa.computeUpdate(transition, buildAgent(), hp, actionSelection(0))
    expect(sarsaResult.target).toBe(1)

    expect(sarsaResult.target).not.toBe(qLearningResult.target)
  })
})
