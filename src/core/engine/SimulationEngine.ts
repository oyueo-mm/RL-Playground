// ARCHITECTURE.md §5 — wires Environment + Agent + Algorithm into a runnable engine.
// performStep() (private `tick`/`performOneStep` below) is the single primitive shared
// by step(), runEpisode(), and run(): they differ only in how many times it's called
// and when the loop stops, per §5.1.

import { TabularQAgent } from '../agents/TabularQAgent'
import { TabularValueAgent } from '../agents/TabularValueAgent'
import type { Algorithm } from '../algorithms/Algorithm'
import { getAlgorithm } from '../algorithms/registry'
import type { Environment } from '../environments/Environment'
import { createEnvironment } from '../environments/registry'
import type { Hyperparams } from '../types/hyperparams'
import type { ActionSelection, StateKey, TDInfo, Transition } from '../types/rl'
import { EventEmitter } from './EventEmitter'
import { Scheduler, defaultTimerSource, type SpeedSetting, type TimerSource } from './Scheduler'
import { buildSnapshot } from './snapshot'
import type { EngineSnapshot, EngineStatus, EpisodeStats, EpisodeTerminationReason, ResetOverrides } from './types'

const DEFAULT_ENV_ID = 'gridworld'
const DEFAULT_ALGORITHM_ID = 'q-learning'
const DEFAULT_SPEED: SpeedSetting = { mode: 'interval', intervalMs: 200 }
// Phase 28 — the previous REWARD_HISTORY_LIMIT=200 cap (shift()-based eviction on both
// rewardHistory and episodeStatsHistory, including each Episode's trajectory) has been
// removed: the user must be able to run 201+, 500+ Episodes and see all of them in the
// Reward Chart / Learning Progress / Episode History / Episode Trajectory. Episode count
// itself was never capped anywhere in Core (confirmed by reading run()/schedulerTick()
// before this Phase — only this shift()-based retention limit and a UI input max, see
// PlaybackControls.tsx, ever bounded anything). No replacement windowing/pagination
// strategy is introduced here per this Phase's explicit priority ("200 Episode 제한 제거를
// 우선한다") — unbounded retention is an accepted tradeoff, noted as technical debt for a
// very long single session in the final report, not solved by this Phase.

/** Engine only ever instantiates one of these two concrete Agents (Phase 1 §4.2/§4.3). */
type ConcreteAgent = TabularQAgent | TabularValueAgent

interface MutableStats {
  episode: number
  totalReward: number
  episodeReward: number
  episodeLength: number
  successCount: number
  successRate: number
  rewardHistory: number[]
  // Phase 21 — accumulate through the in-progress Episode, reset in finishEpisode()
  // alongside episodeReward/episodeLength above (same lifecycle, same reasoning).
  episodeExplorationCount: number
  episodeExploitationCount: number
  episodeVisitedStates: Set<StateKey>
  // Phase 26 — the in-progress Episode's ordered transition sequence, snapshotted into
  // EpisodeStats.trajectory at finishEpisode() time. Reassigned (not `.length = 0`) when
  // reset below, so a captured reference in an already-pushed EpisodeStats stays intact
  // and independent — no per-step or per-episode array copy needed (Phase 26 §15).
  episodeTrajectory: Transition[]
  episodeStatsHistory: EpisodeStats[]
}

function createEmptyStats(): MutableStats {
  return {
    episode: 0,
    totalReward: 0,
    episodeReward: 0,
    episodeLength: 0,
    successCount: 0,
    successRate: 0,
    rewardHistory: [],
    episodeExplorationCount: 0,
    episodeExploitationCount: 0,
    episodeVisitedStates: new Set(),
    episodeTrajectory: [],
    episodeStatsHistory: [],
  }
}

function createAgentFor(kind: 'V' | 'Q', actionSpace: number): ConcreteAgent {
  return kind === 'Q' ? new TabularQAgent(actionSpace) : new TabularValueAgent()
}

function defaultHyperparams(algorithm: Algorithm): Hyperparams {
  const hp: Hyperparams = {}
  for (const field of algorithm.hyperparamSchema) {
    hp[field.key] = field.default
  }
  return hp
}

export interface SimulationEngineOptions {
  envId?: string
  envConfig?: unknown
  algorithmId?: string
  hyperparams?: Hyperparams
  timerSource?: TimerSource
  speed?: SpeedSetting
}

type RunMode = 'episodes' | 'single-episode'

export class SimulationEngine {
  private envId: string
  private algorithmId: string
  private environment: Environment
  private algorithm: Algorithm
  private agent: ConcreteAgent
  private hyperparams: Hyperparams

  private status: EngineStatus = 'idle'
  private pendingAction: ActionSelection | null = null
  private lastTransition: Transition | null = null
  private lastActionSelection: ActionSelection | null = null
  private lastTdInfo: TDInfo | null = null
  private stats: MutableStats = createEmptyStats()

  private runMode: RunMode | null = null
  private remainingEpisodes: number | null = null
  // Phase 28 — true only while the current/most recent run was started via
  // `run({ greedy: true })`. Read by performOneStep() to force epsilon=0 for that call's
  // action selection ONLY (never written into `this.hyperparams` — see run()'s comment
  // for why this is not the same as calling setHyperparams({ epsilon: 0 })).
  private greedyRun = false

  private readonly emitter = new EventEmitter<EngineSnapshot>()
  private readonly scheduler: Scheduler

  constructor(options: SimulationEngineOptions = {}) {
    this.envId = options.envId ?? DEFAULT_ENV_ID
    this.algorithmId = options.algorithmId ?? DEFAULT_ALGORITHM_ID
    this.environment = createEnvironment(this.envId, options.envConfig)
    this.algorithm = getAlgorithm(this.algorithmId)
    this.agent = createAgentFor(this.algorithm.requiredAgentKind, this.environment.getActionSpace())
    this.hyperparams = options.hyperparams ?? defaultHyperparams(this.algorithm)
    this.scheduler = new Scheduler(options.timerSource ?? defaultTimerSource, options.speed ?? DEFAULT_SPEED)
  }

  // ---- observation ----

  subscribe(listener: (snapshot: EngineSnapshot) => void): () => void {
    return this.emitter.subscribe(listener)
  }

  getSnapshot(): EngineSnapshot {
    return buildSnapshot({
      status: this.status,
      algorithmId: this.algorithmId,
      episode: this.stats.episode,
      stepInCurrentEpisode: this.stats.episodeLength,
      currentState: this.environment.getState(),
      lastTransition: this.lastTransition,
      lastActionSelection: this.lastActionSelection,
      lastTdInfo: this.lastTdInfo,
      envRenderModel: this.environment.getRenderModel(),
      agentSnapshot: this.agent.toSnapshot(),
      stats: this.stats,
      hyperparams: this.hyperparams,
      isGreedyRun: this.greedyRun,
    })
  }

  private emitSnapshot(): void {
    this.emitter.emit(this.getSnapshot())
  }

  // ---- manual step ----

  /** Matches the documented state machine: step() is only valid while IDLE. */
  step(): void {
    if (this.status !== 'idle') {
      throw new Error(`step() is only valid while idle (current status: "${this.status}")`)
    }
    this.performOneStep()
    this.emitSnapshot()
  }

  // ---- run / runEpisode ----

  runEpisode(): void {
    this.startRun('single-episode', null)
  }

  /**
   * Phase 28 — `greedy: true` runs this Episode using pure argmax action selection
   * (epsilon forced to 0 for every step's `selectAction`/`pickNextAction` call, ONLY for
   * that call — `this.hyperparams.epsilon` itself is never read from or written to, so
   * the user's real epsilon setting is simply never touched at all, not "restored"
   * afterward because it was never changed). It also skips `computeUpdate()`/
   * `applyAgentUpdate()` entirely — a Greedy run is Policy Evaluation/exhibition of the
   * already-learned Q-table, not a learning step, so the Q-table is never written to.
   * Everything else (Environment stepping, Goal/Bomb termination, EpisodeStats/reward
   * history/trajectory recording) reuses the exact same finishEpisode() pipeline a normal
   * learning run uses — greedy Episodes are recorded identically, just with
   * explorationRate always 0 (a true reflection of what happened, not a special case).
   */
  run(options: { episodes: number; greedy?: boolean }): void {
    if (!Number.isInteger(options.episodes) || options.episodes <= 0) {
      throw new Error('run({ episodes }) requires a positive integer episode count')
    }
    this.startRun('episodes', options.episodes, options.greedy ?? false)
  }

  private startRun(mode: RunMode, episodes: number | null, greedy = false): void {
    if (this.status === 'running') return // never spin up a duplicate Scheduler loop
    this.runMode = mode
    this.remainingEpisodes = episodes
    this.greedyRun = greedy
    this.status = 'running'
    this.scheduler.start(this.schedulerCallbacks())
  }

  private schedulerCallbacks() {
    return {
      performUnit: () => this.schedulerTick(),
      afterBatch: () => this.emitSnapshot(),
      onStop: () => {
        this.status = 'idle'
        this.runMode = null
        this.remainingEpisodes = null
        this.greedyRun = false
        this.emitSnapshot()
      },
    }
  }

  /** Returns true to keep the Scheduler loop going, false to stop it (target reached). */
  private schedulerTick(): boolean {
    this.performOneStep(this.greedyRun)
    const justFinishedEpisode = this.lastTransition?.done ?? false

    if (this.runMode === 'single-episode') {
      return !justFinishedEpisode
    }
    if (this.runMode === 'episodes' && this.remainingEpisodes !== null) {
      if (justFinishedEpisode) this.remainingEpisodes -= 1
      return this.remainingEpisodes > 0
    }
    return true
  }

  // ---- pause / resume ----

  pause(): void {
    if (this.status !== 'running') return
    this.scheduler.stop()
    this.status = 'paused'
    this.emitSnapshot()
  }

  resume(): void {
    if (this.status !== 'paused') return
    this.status = 'running'
    this.scheduler.start(this.schedulerCallbacks())
  }

  // ---- speed ----

  setSpeed(speed: SpeedSetting): void {
    this.scheduler.setSpeed(speed)
  }

  getSpeed(): SpeedSetting {
    return this.scheduler.getSpeed()
  }

  // ---- hyperparameters (Phase 18) ----

  /**
   * Merges the given fields into the current hyperparameters (e.g. `{ epsilon: 0.3 }`)
   * without touching anything else — no reset() of the Environment/Agent/stats, no
   * status change, no effect on pendingAction/runMode/remainingEpisodes. Safe to call
   * from any status (idle/running/paused): performOneStep() reads `this.hyperparams`
   * fresh on every call rather than caching it per-episode, so a change here is picked
   * up starting with the very next action selection, whether or not a run is in flight.
   */
  setHyperparams(overrides: Partial<Hyperparams>): void {
    const next: Hyperparams = { ...this.hyperparams }
    for (const [key, value] of Object.entries(overrides)) {
      if (value !== undefined) next[key] = value
    }
    this.hyperparams = next
    this.emitSnapshot()
  }

  // ---- reset ----

  reset(overrides?: ResetOverrides): void {
    this.scheduler.stop() // invalidate any in-flight callback before anything else changes

    const envId = overrides?.envId ?? this.envId
    const envConfig = overrides?.envConfig ?? this.environment.getConfig()
    this.envId = envId
    this.environment = createEnvironment(envId, envConfig)

    const algorithmId = overrides?.algorithmId ?? this.algorithmId
    this.algorithmId = algorithmId
    this.algorithm = getAlgorithm(algorithmId)

    // Always fully reinitialized, regardless of which fields changed (ARCHITECTURE.md §5.5).
    this.agent = createAgentFor(this.algorithm.requiredAgentKind, this.environment.getActionSpace())
    this.hyperparams = overrides?.hyperparams ?? defaultHyperparams(this.algorithm)
    this.stats = createEmptyStats()

    this.status = 'idle'
    this.pendingAction = null
    this.lastTransition = null
    this.lastActionSelection = null
    this.lastTdInfo = null
    this.runMode = null
    this.remainingEpisodes = null
    this.greedyRun = false

    this.emitSnapshot()
  }

  // ---- performStep() primitive (ARCHITECTURE.md §5.1) ----

  private performOneStep(greedy = false): void {
    const state = this.environment.getState()

    // Phase 28: a Greedy run forces epsilon=0 for action selection ONLY — a shallow copy
    // passed to selectAction(), never assigned to `this.hyperparams`. Reuses the exact
    // same epsilonGreedy()/tie-break machinery every algorithm already goes through, so
    // no algorithm-specific greedy logic is needed here.
    const selectionHyperparams = greedy ? { ...this.hyperparams, epsilon: 0 } : this.hyperparams

    // pendingAction rule: if Algorithm.pickNextAction() cached a next action on the
    // previous call (SARSA), it MUST be reused here verbatim rather than re-selecting —
    // otherwise the action the TD target was computed against could diverge from the
    // action actually executed next. Q-Learning never sets pendingAction, so it always
    // falls through to selectAction() here, unchanged from Phase 1's behaviour. A Greedy
    // run never sets pendingAction in the first place (see below), so this always
    // re-selects fresh via argmax on every step while greedy.
    const action = this.pendingAction ?? this.algorithm.selectAction(state, this.agent, selectionHyperparams)

    const stepResult = this.environment.step(action.action)
    const transition: Transition = { state, action: action.action, ...stepResult }

    if (greedy) {
      // Policy Evaluation/exhibition only — no TD update, no Q-table write. lastTdInfo is
      // cleared (not stale) so Inspector correctly shows its existing "nothing to show"
      // empty state rather than a misleading value from a step that didn't happen.
      this.lastTdInfo = null
      this.pendingAction = null
    } else {
      const nextAction = this.algorithm.pickNextAction?.(stepResult.nextState, this.agent, this.hyperparams)
      const tdInfo = this.algorithm.computeUpdate(transition, this.agent, this.hyperparams, nextAction)
      this.applyAgentUpdate(transition, tdInfo)
      this.lastTdInfo = tdInfo
      this.pendingAction = nextAction ?? null
    }

    this.lastTransition = transition
    this.lastActionSelection = action

    this.stats.totalReward += transition.reward
    this.stats.episodeReward += transition.reward
    this.stats.episodeLength += 1
    // Phase 21: tallied from the real ActionSelection result `action` already computed
    // above (selectAction()/pendingAction) — never re-derived via a fresh RNG draw here.
    if (action.wasExploration) {
      this.stats.episodeExplorationCount += 1
    } else {
      this.stats.episodeExploitationCount += 1
    }
    // Both endpoints of this step's transition count as "visited" — this is what makes
    // the terminal state itself (e.g. the Goal/Bomb cell) included in uniqueStates, not
    // just every state that was ever a step's FROM position.
    this.stats.episodeVisitedStates.add(transition.state)
    this.stats.episodeVisitedStates.add(transition.nextState)
    // Phase 26: the full ordered record — unlike episodeVisitedStates above (a Set, used
    // only for the uniqueStates count), this preserves visit order and repeat visits.
    this.stats.episodeTrajectory.push(transition)

    if (transition.done) {
      this.finishEpisode(transition)
    }
  }

  private applyAgentUpdate(transition: Transition, tdInfo: TDInfo): void {
    if (this.agent.kind === 'Q') {
      this.agent.applyUpdate(transition.state, transition.action, tdInfo)
    } else {
      this.agent.applyUpdate(transition.state, tdInfo)
    }
  }

  /**
   * Classifies why the Episode ended, read from the grid render model rather than any
   * GridWorldEnv-internal import (same source `isSuccessTransition` used to read before
   * this Phase — kept generic across `EnvRenderModel`'s discriminated union, so a future
   * non-'grid' kind falls back to 'other' rather than crashing). "Success" (successCount)
   * is exactly `terminationReason === 'goal'`, unchanged from before.
   */
  private classifyTermination(transition: Transition): EpisodeTerminationReason {
    const renderModel = this.environment.getRenderModel()
    if (renderModel.kind !== 'grid') return 'other'
    if (transition.nextState === renderModel.goal) return 'goal'
    if (renderModel.bombs.includes(transition.nextState)) return 'bomb'
    return 'other'
  }

  private finishEpisode(transition: Transition): void {
    const terminationReason = this.classifyTermination(transition)
    if (terminationReason === 'goal') {
      this.stats.successCount += 1
    }
    this.stats.episode += 1
    this.stats.rewardHistory.push(this.stats.episodeReward)
    this.stats.successRate = this.stats.successCount / this.stats.episode

    // Phase 21: snapshot this Episode's stats before any of the per-episode counters
    // below are reset. `steps` reuses episodeLength (already tracked); `totalReward`
    // reuses episodeReward — neither is recomputed independently.
    const steps = this.stats.episodeLength
    const episodeStats: EpisodeStats = {
      episode: this.stats.episode,
      steps,
      totalReward: this.stats.episodeReward,
      terminationReason,
      explorationCount: this.stats.episodeExplorationCount,
      exploitationCount: this.stats.episodeExploitationCount,
      // steps is always >= 1 by the time an Episode can finish (done is only ever
      // returned from a step() call), but guarded anyway per Phase 21 §2's requirement.
      explorationRate: steps > 0 ? this.stats.episodeExplorationCount / steps : 0,
      averageReward: steps > 0 ? this.stats.episodeReward / steps : 0,
      uniqueStates: this.stats.episodeVisitedStates.size,
      // Phase 26: hands off the accumulator array itself (not a copy) — safe because the
      // reassignment below (`= []`) replaces it with a brand-new array rather than
      // mutating this one in place, so this reference stays a stable, complete,
      // independent record of the Episode that just finished.
      trajectory: this.stats.episodeTrajectory,
    }
    this.stats.episodeStatsHistory.push(episodeStats)

    // Agent's learned table is NOT touched here (ARCHITECTURE.md §7 — only reset()
    // clears it). Only the environment and per-episode bookkeeping restart.
    this.environment.reset()
    this.pendingAction = null
    this.stats.episodeReward = 0
    this.stats.episodeLength = 0
    this.stats.episodeExplorationCount = 0
    this.stats.episodeExploitationCount = 0
    this.stats.episodeVisitedStates = new Set()
    this.stats.episodeTrajectory = []
  }
}
