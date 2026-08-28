import type { ActionSelection, StateKey, TDInfo, Transition } from '../types/rl'
import type { AgentSnapshot, EnvRenderModel } from '../types/render'
import type { EngineSnapshot, EngineStatus } from './types'

const DEFAULT_MOVING_WINDOW = 20

export interface SnapshotInput {
  status: EngineStatus
  episode: number
  stepInCurrentEpisode: number
  currentState: StateKey
  lastTransition: Transition | null
  lastActionSelection: ActionSelection | null
  lastTdInfo: TDInfo | null
  envRenderModel: EnvRenderModel
  agentSnapshot: AgentSnapshot
  stats: {
    totalReward: number
    episodeReward: number
    episodeLength: number
    successCount: number
    successRate: number
    rewardHistory: number[]
  }
}

function movingAverage(history: number[], window = DEFAULT_MOVING_WINDOW): number {
  if (history.length === 0) return 0
  const slice = history.slice(-window)
  return slice.reduce((sum, value) => sum + value, 0) / slice.length
}

/** Builds an immutable EngineSnapshot from Engine's mutable internal state (defensive copies only). */
export function buildSnapshot(input: SnapshotInput): EngineSnapshot {
  return {
    status: input.status,
    episode: input.episode,
    stepInCurrentEpisode: input.stepInCurrentEpisode,
    currentState: input.currentState,
    lastTransition: input.lastTransition,
    lastActionSelection: input.lastActionSelection,
    lastTdInfo: input.lastTdInfo,
    envRenderModel: input.envRenderModel,
    agentSnapshot: input.agentSnapshot,
    stats: {
      totalReward: input.stats.totalReward,
      episodeReward: input.stats.episodeReward,
      episodeLength: input.stats.episodeLength,
      successCount: input.stats.successCount,
      successRate: input.stats.successRate,
      rewardHistory: [...input.stats.rewardHistory],
      avgRewardMovingWindow: movingAverage(input.stats.rewardHistory),
    },
  }
}
