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

// Phase 21 — reused wherever a terminal transition's cause needs to be identified
// (SimulationEngine.ts's finishEpisode()), classified from the same EnvRenderModel
// fields isSuccessTransition already read (goal/bombs) — no new Environment API. 'other'
// covers any future terminalCells-only ending, or a non-'grid' EnvRenderModel kind.
export type EpisodeTerminationReason = 'goal' | 'bomb' | 'other'

/**
 * Phase 21 — one completed Episode's statistics. `steps`/`totalReward` are read from the
 * same counters EngineStats already tracks per-episode (episodeLength/episodeReward) —
 * not recomputed separately. `explorationCount`/`exploitationCount` are tallied from the
 * real `ActionSelection.wasExploration` result at each step (never re-derived via
 * `Math.random() < epsilon`), so `explorationCount + exploitationCount === steps` always.
 */
export interface EpisodeStats {
  episode: number
  steps: number
  totalReward: number
  terminationReason: EpisodeTerminationReason
  explorationCount: number
  exploitationCount: number
  /** explorationCount / steps. 0 if steps is 0 (never happens in practice, guarded anyway). */
  explorationRate: number
  /** totalReward / steps. 0 if steps is 0 (never happens in practice, guarded anyway). */
  averageReward: number
  /** Distinct StateKeys occupied during the Episode (start state through the terminal state). */
  uniqueStates: number
  /**
   * Phase 26 — the Episode's full ordered sequence of transitions (state → action →
   * reward → nextState), exactly as executed. Not derivable from any other existing
   * field: `episodeVisitedStates` (used only to compute `uniqueStates` above) is a `Set`,
   * which discards both visit order and repeat counts (confirmed by reading
   * SimulationEngine.ts before this Phase — no ordered per-step array existed anywhere).
   * Length always equals `steps`. Never truncated here — any display-length limit is a
   * UI-only concern (src/viz/panels/EpisodeTrajectory.tsx).
   */
  trajectory: Transition[]
}

export interface EngineStats {
  totalReward: number
  episodeReward: number
  episodeLength: number
  successCount: number
  successRate: number
  rewardHistory: number[]
  avgRewardMovingWindow: number
  /**
   * Phase 21 — the most recently completed Episode's stats, or null before any Episode
   * has finished (never a stale/mid-episode value — set exactly once per finishEpisode()
   * call, alongside episodeStatsHistory below).
   */
  latestEpisodeStats: EpisodeStats | null
  /**
   * Phase 21 — history of completed Episodes' stats. Previously capped at 200 (shifted
   * FIFO) the same way rewardHistory was; Phase 28 removed that cap on both so the user
   * can run and see 500+ Episodes.
   */
  episodeStatsHistory: EpisodeStats[]
}

export interface EngineSnapshot {
  status: EngineStatus
  /**
   * Phase 23 — the currently active Algorithm's registry id (e.g. "q-learning",
   * "sarsa"). The Engine already tracked this privately since Phase 1 (constructor
   * option / reset({ algorithmId }) — see ResetOverrides above); this just exposes the
   * existing value so the UI has a source of truth instead of mirroring its own copy.
   */
  algorithmId: string
  episode: number
  stepInCurrentEpisode: number
  currentState: StateKey
  lastTransition: Transition | null
  lastActionSelection: ActionSelection | null
  lastTdInfo: TDInfo | null
  envRenderModel: EnvRenderModel
  agentSnapshot: AgentSnapshot
  stats: EngineStats
  /**
   * Phase 18 — the Algorithm's current hyperparameters (alpha/gamma/epsilon), so the UI
   * can observe them (e.g. an Epsilon control) without maintaining its own mirrored
   * copy that could drift from the Engine's actual value across reset()/setHyperparams().
   */
  hyperparams: Hyperparams
  /**
   * Phase 28 — true while the currently in-flight (or just-stopped) run was started via
   * `run({ greedy: true })` (the "Run Greedy Policy" button). During a Greedy run, every
   * action is selected with epsilon forced to 0 for that call only — `hyperparams.epsilon`
   * above always still reflects the user's real, untouched setting throughout.
   */
  isGreedyRun: boolean
}
