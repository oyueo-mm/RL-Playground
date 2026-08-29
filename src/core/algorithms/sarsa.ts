// SARSA: on-policy TD control. Update rule: Q(s,a) <- Q(s,a) + alpha * [r + gamma *
// Q(s',a') - Q(s,a)], where a' is the SAME action actually executed at the next step —
// not argmax over Q(s',·) (that's Q-Learning's off-policy target, qLearning.ts).
//
// This "same action" requirement is why pickNextAction() exists (ARCHITECTURE.md §4.3):
// the Engine (src/core/engine/SimulationEngine.ts, performOneStep()) caches this
// function's return value as `pendingAction` and reuses it verbatim as the action for
// the following step() — it does NOT call selectAction() again for that state. If it
// did, epsilon-greedy's randomness could pick a different action than the one the TD
// target was computed against, silently turning this into something that isn't SARSA
// anymore. Engine behaviour itself is unchanged from Phase 2 — this file only supplies
// the pickNextAction() hook Engine already knows how to consume.

import type { Agent, ActionValueAgent } from '../agents/Agent'
import { epsilonGreedy } from '../agents/policies/epsilonGreedy'
import type { Hyperparams, HyperparamSchema } from '../types/hyperparams'
import type { ActionSelection, StateKey, TDInfo, Transition } from '../types/rl'
import type { Algorithm } from './Algorithm'

const ALGORITHM_ID = 'sarsa'

// Same hyperparameters as Q-Learning (Phase 8 §2: "새로운 hyperparameter를 임의로
// 추가하지 않는다") — SARSA needs no additional knobs beyond alpha/gamma/epsilon.
export const SARSA_HYPERPARAM_SCHEMA: HyperparamSchema = [
  { key: 'alpha', label: 'Learning rate (α)', type: 'range', min: 0, max: 1, step: 0.01, default: 0.1 },
  // Phase 30: max widened 1 -> 2, same reasoning as qLearning.ts's own gamma schema entry.
  { key: 'gamma', label: 'Discount factor (γ)', type: 'range', min: 0, max: 2, step: 0.01, default: 0.9 },
  // Phase 28 — default lowered from 1.0 to 0.2, same reasoning as qLearning.ts.
  { key: 'epsilon', label: 'Exploration rate (ε)', type: 'range', min: 0, max: 1, step: 0.01, default: 0.2 },
]

function assertActionValueAgent(agent: Agent): asserts agent is ActionValueAgent {
  if (agent.kind !== 'Q') {
    throw new Error('SARSA requires an ActionValueAgent (requiredAgentKind "Q")')
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

// Called by the Engine once per step to choose A' for the *next* state under the same
// epsilon-greedy policy as selectAction(). Its return value is what both (a) this same
// step's computeUpdate() target uses, and (b) the Engine's pendingAction for the actual
// next step — see the file header. It is fine to call this unconditionally, including
// when nextState is terminal (GridWorld's Q-table lazily defaults any state to a zero
// vector — see LEGACY_ANALYSIS.md §3 — so this never throws); the Engine already
// discards pendingAction back to null right after a terminal transition
// (SimulationEngine.ts finishEpisode()), so a "next action" computed past a terminal
// state is simply never acted upon.
function pickNextAction(nextState: StateKey, agent: Agent, hp: Hyperparams): ActionSelection {
  assertActionValueAgent(agent)
  return epsilonGreedy({
    qValues: agent.getQVector(nextState),
    epsilon: hp.epsilon,
    random: Math.random,
  })
}

function computeUpdate(
  transition: Transition,
  agent: Agent,
  hp: Hyperparams,
  nextAction?: ActionSelection,
): TDInfo {
  assertActionValueAgent(agent)
  const { state, action, reward, nextState, done } = transition

  const previousEstimate = agent.getValue(state, action)
  // done -> no bootstrap at all (§7/§15). Otherwise use Q(s', a') for the SAME a' the
  // Engine will execute next (nextAction), never max_a' Q(s',a') — that would make this
  // Q-Learning, not SARSA (Phase 8 §10).
  const nextQ = !done && nextAction ? agent.getValue(nextState, nextAction.action) : 0
  const target = done ? reward : reward + hp.gamma * nextQ
  const error = target - previousEstimate
  const updatedEstimate = previousEstimate + hp.alpha * error

  const targetFormula = done
    ? `target = r (terminal, no bootstrap) = ${reward}`
    : `target = r + γ·Q(s',a') = ${reward} + ${hp.gamma} × ${nextQ} = ${target}`

  return {
    algorithm: ALGORITHM_ID,
    target,
    targetFormula,
    previousEstimate,
    updatedEstimate,
    error,
  }
}

export const sarsa: Algorithm = {
  id: ALGORITHM_ID,
  requiredAgentKind: 'Q',
  hyperparamSchema: SARSA_HYPERPARAM_SCHEMA,
  selectAction,
  pickNextAction,
  computeUpdate,
}
