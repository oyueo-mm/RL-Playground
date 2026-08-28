// ARCHITECTURE.md §4.3 — Algorithm owns action-selection policy (not Agent), and
// declares which Agent kind it needs so the Engine (Phase 2) can instantiate the
// right one on reset()/algorithm change.

import type { Agent } from '../agents/Agent'
import type { Hyperparams, HyperparamSchema } from '../types/hyperparams'
import type { ActionSelection, StateKey, TDInfo, Transition } from '../types/rl'

export interface Algorithm {
  /** Registry id, e.g. "q-learning". Never a hardcoded literal union (NFR-4). */
  id: string
  requiredAgentKind: 'V' | 'Q'
  hyperparamSchema: HyperparamSchema

  selectAction(state: StateKey, agent: Agent, hp: Hyperparams): ActionSelection

  /**
   * On-policy algorithms (SARSA) implement this so the Engine can cache the result as
   * `pendingAction` and reuse it as the *actual* next action — otherwise the action
   * used to compute the TD target could diverge from the action really executed next
   * (ARCHITECTURE.md §4.3, §5.1). Q-Learning does not implement this.
   */
  pickNextAction?(nextState: StateKey, agent: Agent, hp: Hyperparams): ActionSelection

  computeUpdate(
    transition: Transition,
    agent: Agent,
    hp: Hyperparams,
    nextAction?: ActionSelection,
  ): TDInfo
}
