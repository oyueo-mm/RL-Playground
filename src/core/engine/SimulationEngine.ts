// ARCHITECTURE.md §5 — wires Environment + Agent + Algorithm into a runnable engine.
// performStep() (private `tick`/`performOneStep` below) is the single primitive shared
// by step(), runEpisode(), and run(): they differ only in how many times it's called
// and when the loop stops, per §5.1.

import { sliderToSpeed } from '../../viz/controls/speedSlider'
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
import { DEFAULT_RESOURCE_BUDGET, type ResourceBudget, type ResourceMetrics, type ResourcePauseReason } from './resources'
import type { EngineSnapshot, EngineStatus, EpisodeStats, EpisodeTerminationReason, ResetOverrides } from './types'

const DEFAULT_ENV_ID = 'gridworld'
const DEFAULT_ALGORITHM_ID = 'q-learning'
const DEFAULT_SPEED: SpeedSetting = { mode: 'interval', intervalMs: 200 }
// Lifetime counters are independent of retention. Detailed paths use a bounded FIFO;
// recent summaries compact in batches, and React receives a cached history projection.

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

/**
 * Phase 34 — a `StateKey` is the RL-facing State (e.g. GridWorld's `"x,y,mask"`, per
 * GridWorldEnv.ts's file header) while `EnvRenderModel`'s position arrays (`bombs`/
 * `goals`/`walls`/`start`) deliberately stay plain grid-cell coordinates. This strips any
 * suffix beyond the first two comma-separated components back off, so a `StateKey` can be
 * compared against those position-only arrays again. A no-op for an Environment whose
 * State genuinely is just "x,y" (nothing to strip).
 */
function statePosition(state: StateKey): StateKey {
  const [x, y] = state.split(',')
  return `${x},${y}`
}

export interface SimulationEngineOptions {
  envId?: string
  envConfig?: unknown
  algorithmId?: string
  hyperparams?: Hyperparams
  timerSource?: TimerSource
  speed?: SpeedSetting
  resourceBudget?: Partial<ResourceBudget>
}

type RunMode = 'episodes' | 'single-episode'

export class SimulationEngine {
  private envId: string
  private algorithmId: string
  private environment: Environment
  private algorithm: Algorithm
  private agent: ConcreteAgent
  private hyperparams: Hyperparams

  private readonly uiEmitter = new EventEmitter<EngineSnapshot>()
  private resourceBudget: ResourceBudget = { ...DEFAULT_RESOURCE_BUDGET }
  private resourcePauseReason: ResourcePauseReason = null
  private totalSteps = 0
  private recordedSteps = 0
  private detailQueue: { episode: number; length: number }[] = []
  private detailHead = 0
  private lifetime = { exploration: 0, exploitation: 0, reasons: {} as Record<string, number> }

  /** Cursor FIFO: no array shift and no mutation of previously emitted episodes. */
  private trimDetails(reserve = 0): void {
    const history = this.stats.episodeStatsHistory
    while (this.detailHead < this.detailQueue.length && (this.recordedSteps + reserve > this.resourceBudget.maxRecordedSteps || this.detailQueue.length - this.detailHead > (this.resourceBudget.maxDetailedEpisodes ?? 100))) {
      const old = this.detailQueue[this.detailHead++]
      this.recordedSteps -= old.length
      const index = old.episode - (history[0]?.episode ?? 0)
      if (history[index]?.episode === old.episode) history[index] = { ...history[index], trajectory: [], trajectoryStatus: 'evicted' }
      this.projectedHistory = null
    }
    if (this.detailHead > 1024) { this.detailQueue = this.detailQueue.slice(this.detailHead); this.detailHead = 0 }
  }
  private metrics = { stepsPerSecond: 0, uiUpdatesPerSecond: 0, qStateGrowth: 0 }
  private rateWindow = { at: 0, steps: 0, states: 0, updates: 0 }
  private lastUIAt = -Infinity
  private timer: TimerSource = defaultTimerSource
  private projectedHistory: { source: EpisodeStats[]; count: number; rewards: number[]; episodes: EpisodeStats[] } | null = null

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
  private savedTrainingSpeed: SpeedSetting | null = null
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
    this.setResourceBudget(options.resourceBudget ?? {})
    this.timer = options.timerSource ?? defaultTimerSource
    this.rateWindow.at = this.timer.now()
    this.scheduler = new Scheduler(options.timerSource ?? defaultTimerSource, options.speed ?? DEFAULT_SPEED)
  }

  // ---- observation ----

  subscribe(listener: (snapshot: EngineSnapshot) => void): () => void {
    return this.emitter.subscribe(listener)
  }

  subscribeUI(listener: (snapshot: EngineSnapshot) => void): () => void { return this.uiEmitter.subscribe(listener) }

  getResourceMetrics(): ResourceMetrics {
    const q = this.agent.kind === 'Q' ? this.agent : null
    const ratio = (q?.size ?? 0) / this.resourceBudget.maxQStates
    return { lifetime: { ...this.lifetime, reasons: { ...this.lifetime.reasons } }, qStates: q?.size ?? 0, qVersion: q?.version ?? 0, estimatedQBytes: q?.estimatedBytes ?? 0, totalSteps: this.totalSteps, completedEpisodes: this.stats.episode, episodeSteps: this.stats.episodeLength, recordedSteps: this.recordedSteps, ...this.metrics, pauseReason: this.resourcePauseReason, level: ratio >= .85 ? 'high' : ratio >= .6 ? 'warning' : 'normal', budget: { ...this.resourceBudget } }
  }

  setResourceBudget(overrides: Partial<ResourceBudget>): void {
    for (const [key, value] of Object.entries(overrides)) {
      if (!Number.isSafeInteger(value) || value! < (key === 'maxQStates' ? 10 : 1)) throw new Error('Resource budgets must be positive safe integers (Q states >= 10).')
    }
    this.resourceBudget = { ...this.resourceBudget, ...overrides }
    this.trimDetails()
    if (this.stats.episodeTrajectory.length > this.resourceBudget.maxRecordedSteps) {
      this.recordedSteps -= this.stats.episodeTrajectory.length - this.resourceBudget.maxRecordedSteps
      this.stats.episodeTrajectory = this.stats.episodeTrajectory.slice(0, this.resourceBudget.maxRecordedSteps)
    }
    this.resourcePauseReason = null
    this.emitSnapshot()
  }

  getUISnapshot(): EngineSnapshot { return this.snapshot(true) }
  getSnapshot(): EngineSnapshot { return this.snapshot(false) }

  private snapshot(visible: boolean): EngineSnapshot {
    const model = this.environment.getRenderModel()
    const currentState = this.environment.getState()
    const suffix = currentState.split(',').slice(2).join(',')
    const keys = visible && this.agent.kind === 'Q' ? Array.from({ length: model.width * model.height }, (_, index) => `${index % model.width},${Math.floor(index / model.width)}${suffix ? ',' + suffix : ''}`) : []
    if (visible && (this.projectedHistory?.source !== this.stats.episodeStatsHistory || this.projectedHistory.count !== this.stats.episodeStatsHistory.length)) {
      this.projectedHistory = { source: this.stats.episodeStatsHistory, count: this.stats.episodeStatsHistory.length, rewards: [...this.stats.rewardHistory], episodes: [...this.stats.episodeStatsHistory] }
    }
    return { ...buildSnapshot({
      copyHistory: !visible,
      resources: this.getResourceMetrics(),
      status: this.status,
      algorithmId: this.algorithmId,
      episode: this.stats.episode,
      stepInCurrentEpisode: this.stats.episodeLength,
      currentState,
      lastTransition: this.lastTransition,
      lastActionSelection: this.lastActionSelection,
      lastTdInfo: this.lastTdInfo,
      envRenderModel: model,
      agentSnapshot: visible && this.agent.kind === 'Q' ? this.agent.toVisibleSnapshot(keys) : this.agent.toSnapshot(),
      stats: visible ? { ...this.stats, rewardHistory: this.projectedHistory!.rewards, episodeStatsHistory: this.projectedHistory!.episodes } : this.stats,
      hyperparams: this.hyperparams,
      isGreedyRun: this.greedyRun,
    }) }
  }

  private emitSnapshot(force = true): void {
    // Legacy full subscriptions remain opt-in. React uses only the bounded projection.
    if (this.emitter.size) this.emitter.emit(this.getSnapshot())
    const now = this.timer.now()
    const interval = this.getResourceMetrics().level === 'high' ? 250 : 80
    if (this.uiEmitter.size && (force || now - this.lastUIAt >= interval)) {
      this.lastUIAt = now
      this.rateWindow.updates++
      this.uiEmitter.emit(this.getUISnapshot())
    }
  }

  // ---- manual step ----

  /** Matches the documented state machine: step() is only valid while IDLE. */
  step(): void {
    if (this.status !== 'idle') {
      throw new Error(`step() is only valid while idle (current status: "${this.status}")`)
    }
    if (this.atResourceBoundary()) { this.status = 'paused'; this.emitSnapshot(); return }
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
    this.restoreTrainingSpeed()
    if (greedy) { this.pendingAction = null; this.savedTrainingSpeed = this.scheduler.getSpeed(); this.scheduler.setSpeed(sliderToSpeed(45)) }
    this.runMode = mode
    this.remainingEpisodes = episodes
    this.greedyRun = greedy
    this.resourcePauseReason = null
    this.status = 'running'
    this.scheduler.start(this.schedulerCallbacks())
  }

  private schedulerCallbacks() {
    let firstBatch = true
    return {
      performUnit: () => this.schedulerTick(),
      afterBatch: () => { this.emitSnapshot(firstBatch); firstBatch = false },
      onStop: () => {
        if (this.resourcePauseReason) { this.status = 'paused'; this.emitSnapshot(); return }
        this.restoreTrainingSpeed()
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
    if (!this.greedyRun && this.atResourceBoundary()) return false
    this.performOneStep(this.greedyRun)
    const justFinishedEpisode = !!(this.lastTransition?.done || this.lastTransition?.truncated)

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
    this.resourcePauseReason = null
    this.status = 'running'
    this.scheduler.start(this.schedulerCallbacks())
  }

  private restoreTrainingSpeed(): void {
    if (this.savedTrainingSpeed) this.scheduler.setSpeed(this.savedTrainingSpeed)
    this.savedTrainingSpeed = null
  }

  // ---- speed ----

  setSpeed(speed: SpeedSetting): void {
    this.scheduler.setSpeed(speed)
    this.emitSnapshot()
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
    this.restoreTrainingSpeed()
    this.environment = createEnvironment(envId, envConfig)

    const algorithmId = overrides?.algorithmId ?? this.algorithmId
    this.algorithmId = algorithmId
    this.algorithm = getAlgorithm(algorithmId)

    // Always fully reinitialized, regardless of which fields changed (ARCHITECTURE.md §5.5).
    this.agent = createAgentFor(this.algorithm.requiredAgentKind, this.environment.getActionSpace())
    this.hyperparams = overrides?.hyperparams ?? defaultHyperparams(this.algorithm)
    this.stats = createEmptyStats()
    this.totalSteps = 0; this.recordedSteps = 0; this.resourcePauseReason = null; this.detailQueue = []; this.detailHead = 0; this.lifetime = { exploration: 0, exploitation: 0, reasons: {} }
    this.metrics = { stepsPerSecond: 0, uiUpdatesPerSecond: 0, qStateGrowth: 0 }
    this.rateWindow = { at: this.timer.now(), steps: 0, states: 0, updates: 0 }

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

  // ---- restart current episode (Phase 36) ----

  /**
   * Phase 36 — stops any in-flight run (Greedy or not) and returns the Environment to
   * its episode-start state, WITHOUT recreating the Agent/Q-table — unlike reset()
   * above, which always fully reinitializes the Agent regardless of which fields
   * changed (ARCHITECTURE.md §5.5). Added specifically so a stuck/looping Greedy run
   * (Phase 36 audit §7: Scheduler has no built-in max-step safety limit, and a
   * deterministic infinite loop was reproduced and confirmed by direct execution) can be
   * aborted by the user without destroying whatever was genuinely learned via prior
   * Step/Run actions — a Greedy run itself never writes to the Q-table in the first
   * place (performOneStep()'s `greedy` branch skips computeUpdate()/applyAgentUpdate()),
   * so there is nothing greedy-specific to lose by keeping the Agent untouched here.
   *
   * Only this in-progress Episode's own accumulators are reset — the same fields
   * finishEpisode() itself resets after a normal completion (episodeReward/
   * episodeLength/episodeExploration·ExploitationCount/episodeVisitedStates/
   * episodeTrajectory) — because this Episode never validly completed (it was aborted,
   * not finished), so it must not be counted into `stats.episode`/`successCount`/
   * `rewardHistory`/`episodeStatsHistory`, and the NEXT episode must not start with
   * leftover counts from the aborted attempt. Cross-episode aggregates (totalReward,
   * successCount, successRate, rewardHistory, episodeStatsHistory, the episode counter
   * itself) are untouched, exactly like a normal in-progress episode never contributes
   * to them until finishEpisode() runs.
   */
  restartEpisode(): void {
    this.scheduler.stop() // invalidate any in-flight callback before anything else changes
    this.restoreTrainingSpeed()
    this.environment.reset()
    this.recordedSteps -= this.stats.episodeTrajectory.length
    this.resourcePauseReason = null

    this.status = 'idle'
    this.pendingAction = null
    this.lastTransition = null
    this.lastActionSelection = null
    this.lastTdInfo = null
    this.runMode = null
    this.remainingEpisodes = null
    this.greedyRun = false

    this.stats.episodeReward = 0
    this.stats.episodeLength = 0
    this.stats.episodeExplorationCount = 0
    this.stats.episodeExploitationCount = 0
    this.stats.episodeVisitedStates = new Set()
    this.stats.episodeTrajectory = []

    this.emitSnapshot()
  }

  // ---- performStep() primitive (ARCHITECTURE.md §5.1) ----

  private atResourceBoundary(): boolean {
    const states = this.agent.kind === 'Q' ? this.agent.size : 0
    // A step can lazily create current and next rows. Reserve both before acting.
    this.resourcePauseReason = states + 2 > this.resourceBudget.maxQStates ? 'q-states' : null
    return this.resourcePauseReason !== null
  }

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
    const action = greedy && this.agent.kind === 'Q'
      ? (() => { const candidateValues = this.agent.peekQVector(state); return { action: candidateValues.indexOf(Math.max(...candidateValues)), wasExploration: false, candidateValues } })()
      : this.pendingAction ?? this.algorithm.selectAction(state, this.agent, selectionHyperparams)

    const stepResult = this.environment.step(action.action)
    const truncated = !stepResult.done && this.stats.episodeLength + 1 >= this.resourceBudget.maxEpisodeSteps
    const transition: Transition = { state, action: action.action, ...stepResult, ...(truncated ? { truncated: true } : {}) }

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
    this.totalSteps++
    if (action.wasExploration) this.lifetime.exploration++; else this.lifetime.exploitation++
    const now = this.timer.now()
    if (now - this.rateWindow.at >= 1000) {
      const seconds = (now - this.rateWindow.at) / 1000
      const states = this.agent.kind === 'Q' ? this.agent.size : 0
      this.metrics = { stepsPerSecond: (this.totalSteps - this.rateWindow.steps) / seconds, uiUpdatesPerSecond: this.rateWindow.updates / seconds, qStateGrowth: states - this.rateWindow.states }
      this.rateWindow = { at: now, steps: this.totalSteps, states, updates: 0 }
    }
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
    this.trimDetails(1)
    if (this.recordedSteps < this.resourceBudget.maxRecordedSteps) {
      this.stats.episodeTrajectory.push(transition)
      this.recordedSteps++
    }

    if (transition.done || transition.truncated) {
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
   *
   * Phase 32: `renderModel.goals` now reflects only the Goals NOT YET collected this
   * Episode (GridWorldEnv.getRenderModel() excludes collectedGoals) — by the time this is
   * called, the just-collected terminal Goal has already been removed from it, so a Goal
   * termination can no longer be detected via `renderModel.goals.includes(nextState)`
   * (confirmed by this Phase's own regression run: that check always missed). Bombs are
   * unaffected (never filtered). For a 'grid' Environment, `isTerminal()` only becomes
   * true via a Bomb (handled above) or every Goal being collected — `terminalCells`
   * (Post-MVP FR-9) is not reachable through any current UI path (every fixture in this
   * codebase uses `[]`), so any other terminal transition is a Goal termination.
   *
   * Phase 34: `transition.nextState` is now `"x,y,mask"` (State Representation fix, see
   * GridWorldEnv.ts's file header) while `renderModel.bombs`/`.goals` remain pure `"x,y"`
   * position keys (rendering-only, deliberately unchanged) — so a raw `.includes()` no
   * longer matches even when the position IS a bomb. `statePosition()` strips the mask
   * suffix back off before comparing, restoring the original position-only comparison.
   */
  private classifyTermination(transition: Transition): EpisodeTerminationReason {
    if (transition.truncated) return 'truncated'
    const renderModel = this.environment.getRenderModel()
    if (renderModel.kind !== 'grid') return 'other'
    if (renderModel.bombs.includes(statePosition(transition.nextState))) return 'bomb'
    return 'goal'
  }

  private finishEpisode(transition: Transition): void {
    const terminationReason = this.classifyTermination(transition)
    this.lifetime.reasons[terminationReason] = (this.lifetime.reasons[terminationReason] ?? 0) + 1
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
    let goalMask = BigInt(transition.nextState.split(',')[2] ?? '0')
    let collectedGoals = 0
    while (goalMask > 0n) { collectedGoals += Number(goalMask & 1n); goalMask >>= 1n }
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
      trajectoryStatus: this.stats.episodeTrajectory.length === steps ? 'complete' : 'partial',
      collectedGoals,
    }
    this.stats.episodeStatsHistory.push(episodeStats)
    this.detailQueue.push({ episode: episodeStats.episode, length: episodeStats.trajectory.length })
    this.trimDetails()
    // Keep 9,001–10,000 recent summaries, amortizing array compaction across episodes.
    // Lifetime totals are independent of this explicitly bounded chart window.
    if (this.stats.episodeStatsHistory.length > 10_000) {
      this.stats.episodeStatsHistory = this.stats.episodeStatsHistory.slice(1000)
      this.stats.rewardHistory = this.stats.rewardHistory.slice(1000)
      this.projectedHistory = null
    }

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
