// ARCHITECTURE.md §5.2/§5.5/§5.6 — Engine-level types. Note on deviations from the
// EngineSnapshot sketch in ARCHITECTURE.md §5.6 (EngineSnapshot/stats were not part of
// the "frozen" Phase 1 contract list, so this is an additive Phase 2 design decision,
// not a redesign of core domain types):
//   - `currentState` was added at the top level: Phase 2's spec explicitly requires
//     "현재 State" to be directly observable, and reaching into `envRenderModel` for it
//     would be GridWorld-specific (envRenderModel is a discriminated union that need
//     not always carry a single "current position" concept for future environments).
//   - `stats` gained `totalReward`, `episodeReward`, `episodeLength`, `successCount`
//     (ARCHITECTURE.md §5.6 only had `totalRewardThisEpisode`) because Phase 2 §17
//     explicitly requires the engine to track all of these. `totalRewardThisEpisode`
//     was renamed to `episodeReward` for clarity; `avgRewardMovingWindow` and
//     `rewardHistory` are unchanged.

import type { ActionSelection, StateKey, TDInfo, Transition } from '../types/rl'
import type { AgentSnapshot, EnvRenderModel } from '../types/render'
import type { Hyperparams } from '../types/hyperparams'

export type EngineStatus = 'idle' | 'running' | 'paused'

export interface ResetOverrides {
  envId?: string
  envConfig?: unknown
  algorithmId?: string
  hyperparams?: Hyperparams
}

export interface EngineStats {
  totalReward: number
  episodeReward: number
  episodeLength: number
  successCount: number
  successRate: number
  rewardHistory: number[]
  avgRewardMovingWindow: number
}

export interface EngineSnapshot {
  status: EngineStatus
  episode: number
  stepInCurrentEpisode: number
  currentState: StateKey
  lastTransition: Transition | null
  lastActionSelection: ActionSelection | null
  lastTdInfo: TDInfo | null
  envRenderModel: EnvRenderModel
  agentSnapshot: AgentSnapshot
  stats: EngineStats
}
