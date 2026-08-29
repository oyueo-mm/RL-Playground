// Q-Learning: off-policy TD control. Update rule ported from the reference repo
// (LEGACY_ANALYSIS.md §3): Q(s,a) <- Q(s,a) + alpha * [r + gamma * max_a' Q(s',a') - Q(s,a)],
// with the terminal-state bootstrap explicitly disabled (see LEGACY_ANALYSIS.md §3 —
// the reference relies on a lazily-zeroed table to get this right by accident; here it
// is an explicit branch instead).

import type { Agent, ActionValueAgent } from '../agents/Agent'
import { epsilonGreedy } from '../agents/policies/epsilonGreedy'
import type { Hyperparams, HyperparamSchema } from '../types/hyperparams'
import type { ActionSelection, StateKey, TDInfo, Transition } from '../types/rl'
import type { Algorithm } from './Algorithm'

const ALGORITHM_ID = 'q-learning'

export const QLEARNING_HYPERPARAM_SCHEMA: HyperparamSchema = [
  { key: 'alpha', label: 'Learning rate (α)', type: 'range', min: 0, max: 1, step: 0.01, default: 0.1 },
  { key: 'gamma', label: 'Discount factor (γ)', type: 'range', min: 0, max: 1, step: 0.01, default: 0.9 },
  // Phase 28 — default lowered from 1.0 (always explore) to 0.2 (~20% exploration / ~80%
  // exploitation), matching describeEpsilon()'s existing wording so a fresh session's
  // default value and its own on-screen description agree from the very first render.
  { key: 'epsilon', label: 'Exploration rate (ε)', type: 'range', min: 0, max: 1, step: 0.01, default: 0.2 },
]

function assertActionValueAgent(agent: Agent): asserts agent is ActionValueAgent {
  if (agent.kind !== 'Q') {
    throw new Error('Q-Learning requires an ActionValueAgent (requiredAgentKind "Q")')
  }
}

function selectAction(state: StateKey, agent: Agent, hp: Hyperparams): ActionSelection {
  assertActionValueAgent(agent)
  return epsilonGreedy({
    qValues: agent.getQVector(state),
    epsilon: hp.epsilon,
    random: Math.random,
  })
}

function computeUpdate(transition: Transition, agent: Agent, hp: Hyperparams): TDInfo {
  assertActionValueAgent(agent)
  const { state, action, reward, nextState, done } = transition

  const previousEstimate = agent.getValue(state, action)
  const bootstrap = done ? 0 : Math.max(...agent.getQVector(nextState))
  const target = done ? reward : reward + hp.gamma * bootstrap
  const error = target - previousEstimate
  const updatedEstimate = previousEstimate + hp.alpha * error

  const targetFormula = done
    ? `target = r (terminal, no bootstrap) = ${reward}`
    : `target = r + γ·max Q(s',·) = ${reward} + ${hp.gamma} × ${bootstrap} = ${target}`

  return {
    algorithm: ALGORITHM_ID,
    target,
    targetFormula,
    previousEstimate,
    updatedEstimate,
    error,
  }
}

export const qLearning: Algorithm = {
  id: ALGORITHM_ID,
  requiredAgentKind: 'Q',
  hyperparamSchema: QLEARNING_HYPERPARAM_SCHEMA,
  selectAction,
  // No pickNextAction: off-policy — the target's max_a' term does not depend on
  // which action is actually taken next, so there is nothing to cache/reuse.
  computeUpdate,
}
