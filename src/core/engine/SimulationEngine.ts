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
import type { ActionSelection, TDInfo, Transition } from '../types/rl'
import { EventEmitter } from './EventEmitter'
import { Scheduler, defaultTimerSource, type SpeedSetting, type TimerSource } from './Scheduler'
import { buildSnapshot } from './snapshot'
import type { EngineSnapshot, EngineStatus, ResetOverrides } from './types'

const DEFAULT_ENV_ID = 'gridworld'
const DEFAULT_ALGORITHM_ID = 'q-learning'
const DEFAULT_SPEED: SpeedSetting = { mode: 'interval', intervalMs: 200 }
const REWARD_HISTORY_LIMIT = 200

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
      episode: this.stats.episode,
      stepInCurrentEpisode: this.stats.episodeLength,
      currentState: this.environment.getState(),
      lastTransition: this.lastTransition,
      lastActionSelection: this.lastActionSelection,
      lastTdInfo: this.lastTdInfo,
      envRenderModel: this.environment.getRenderModel(),
      agentSnapshot: this.agent.toSnapshot(),
      stats: this.stats,
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

  run(options: { episodes: number }): void {
    if (!Number.isInteger(options.episodes) || options.episodes <= 0) {
      throw new Error('run({ episodes }) requires a positive integer episode count')
    }
    this.startRun('episodes', options.episodes)
  }

  private startRun(mode: RunMode, episodes: number | null): void {
    if (this.status === 'running') return // never spin up a duplicate Scheduler loop
    this.runMode = mode
    this.remainingEpisodes = episodes
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
        this.emitSnapshot()
      },
    }
  }

  /** Returns true to keep the Scheduler loop going, false to stop it (target reached). */
  private schedulerTick(): boolean {
    this.performOneStep()
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

    this.emitSnapshot()
  }

  // ---- performStep() primitive (ARCHITECTURE.md §5.1) ----

  private performOneStep(): void {
    const state = this.environment.getState()

    // pendingAction rule: if Algorithm.pickNextAction() cached a next action on the
    // previous call (SARSA), it MUST be reused here verbatim rather than re-selecting —
    // otherwise the action the TD target was computed against could diverge from the
    // action actually executed next. Q-Learning never sets pendingAction, so it always
    // falls through to selectAction() here, unchanged from Phase 1's behaviour.
    const action = this.pendingAction ?? this.algorithm.selectAction(state, this.agent, this.hyperparams)

    const stepResult = this.environment.step(action.action)
    const transition: Transition = { state, action: action.action, ...stepResult }

    const nextAction = this.algorithm.pickNextAction?.(stepResult.nextState, this.agent, this.hyperparams)
    const tdInfo = this.algorithm.computeUpdate(transition, this.agent, this.hyperparams, nextAction)

    this.applyAgentUpdate(transition, tdInfo)

    this.lastTransition = transition
    this.lastActionSelection = action
    this.lastTdInfo = tdInfo
    this.pendingAction = nextAction ?? null

    this.stats.totalReward += transition.reward
    this.stats.episodeReward += transition.reward
    this.stats.episodeLength += 1

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
   * "Success" = the episode ended by reaching the environment's goal cell, read from the
   * grid render model rather than any GridWorld-specific import (keeps this generic
   * across `EnvRenderModel`'s discriminated union — a future non-"grid" kind simply
   * never counts as a success here, rather than crashing).
   */
  private isSuccessTransition(transition: Transition): boolean {
    const renderModel = this.environment.getRenderModel()
    return renderModel.kind === 'grid' && transition.nextState === renderModel.goal
  }

  private finishEpisode(transition: Transition): void {
    if (this.isSuccessTransition(transition)) {
      this.stats.successCount += 1
    }
    this.stats.episode += 1
    this.stats.rewardHistory.push(this.stats.episodeReward)
    if (this.stats.rewardHistory.length > REWARD_HISTORY_LIMIT) {
      this.stats.rewardHistory.shift()
    }
    this.stats.successRate = this.stats.successCount / this.stats.episode

    // Agent's learned table is NOT touched here (ARCHITECTURE.md §7 — only reset()
    // clears it). Only the environment and per-episode bookkeeping restart.
    this.environment.reset()
    this.pendingAction = null
    this.stats.episodeReward = 0
    this.stats.episodeLength = 0
  }
}
