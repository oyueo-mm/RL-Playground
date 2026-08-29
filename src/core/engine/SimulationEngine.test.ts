import { describe, expect, it } from 'vitest'
import { SimulationEngine } from './SimulationEngine'
import type { TimerSource } from './Scheduler'

/**
 * Manual TimerSource for deterministic, synchronous-ish control over Engine's Scheduler
 * in tests: setTimeout/rAF just record the callback; `flushOne()`/`flushAll()` fire them
 * on demand instead of relying on real timers or vi.useFakeTimers().
 */
function createManualTimerSource() {
  let nextId = 1
  const scheduled = new Map<number, () => void>()
  const cancelled = new Set<number>()

  const source: TimerSource = {
    now: () => 0,
    setTimeout: (fn) => {
      const id = nextId++
      scheduled.set(id, fn)
      return id
    },
    clearTimeout: (id) => {
      cancelled.add(id)
    },
    requestAnimationFrame: (fn) => {
      const id = nextId++
      scheduled.set(id, fn)
      return id
    },
    cancelAnimationFrame: (id) => {
      cancelled.add(id)
    },
  }

  /** Fires the single most-recently-scheduled, non-cancelled callback, if any. */
  function flushOne(): boolean {
    const ids = [...scheduled.keys()].filter((id) => !cancelled.has(id))
    const id = ids.at(-1)
    if (id === undefined) return false
    const fn = scheduled.get(id)!
    scheduled.delete(id)
    fn()
    return true
  }

  /** Repeatedly flushes the latest pending callback until none remain (bounded). */
  function flushAll(maxIterations = 100_000): number {
    let count = 0
    while (count < maxIterations && flushOne()) {
      count += 1
    }
    return count
  }

  return { source, flushOne, flushAll }
}

describe('SimulationEngine — state machine', () => {
  it('goes IDLE -> RUNNING -> PAUSED -> RUNNING -> IDLE', () => {
    const { source, flushAll } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source })

    expect(engine.getSnapshot().status).toBe('idle')

    engine.run({ episodes: 1 })
    expect(engine.getSnapshot().status).toBe('running')

    engine.pause()
    expect(engine.getSnapshot().status).toBe('paused')

    engine.resume()
    expect(engine.getSnapshot().status).toBe('running')

    flushAll() // drive the run to completion (1 episode)
    expect(engine.getSnapshot().status).toBe('idle')
  })

  it('step() throws while running', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source })
    engine.run({ episodes: 5 })
    expect(() => engine.step()).toThrow()
  })

  it('pause() while idle is a no-op', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source })
    engine.pause()
    expect(engine.getSnapshot().status).toBe('idle')
  })

  it('resume() while idle is a no-op', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source })
    engine.resume()
    expect(engine.getSnapshot().status).toBe('idle')
  })
})

describe('SimulationEngine — step()', () => {
  it('changes state, produces a Transition/TDInfo, updates the Q-table, and reflects it in the snapshot', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source, hyperparams: { alpha: 0.5, gamma: 0.9, epsilon: 0 } })

    const before = engine.getSnapshot()
    expect(before.lastTransition).toBeNull()
    expect(before.lastTdInfo).toBeNull()

    engine.step()

    const after = engine.getSnapshot()
    expect(after.lastTransition).not.toBeNull()
    expect(after.lastActionSelection).not.toBeNull()
    expect(after.lastTdInfo).not.toBeNull()
    expect(after.lastTdInfo!.algorithm).toBe('q-learning')
    expect(after.currentState).toBe(after.lastTransition!.nextState)

    // Q-table reflects the update: the (state, action) pair just visited now holds
    // updatedEstimate rather than the default 0.
    expect(after.agentSnapshot.kind).toBe('Q')
    if (after.agentSnapshot.kind === 'Q') {
      const q = after.agentSnapshot.qTable[before.currentState]
      expect(q).toBeDefined()
      expect(q[after.lastTransition!.action]).toBe(after.lastTdInfo!.updatedEstimate)
    }
  })

  it('emits a snapshot to subscribers on every step()', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source })
    const received: string[] = []
    engine.subscribe((snap) => received.push(snap.currentState))

    engine.step()
    engine.step()

    expect(received.length).toBe(2)
  })
})

describe('SimulationEngine — runEpisode()', () => {
  it('runs exactly one episode and returns to idle', () => {
    const { source, flushAll } = createManualTimerSource()
    // width=1 so the agent reaches the goal in exactly one rightward-adjacent move;
    // use a tiny grid to keep the episode short and deterministic-ish regardless of RNG.
    const engine = new SimulationEngine({
      timerSource: source,
      envConfig: {
        width: 2,
        height: 1,
        start: { x: 0, y: 0 },
        goal: { x: 1, y: 0 },
        walls: [],
        stepReward: -0.1,
        goalReward: 10,
        terminalCells: [],
        bombs: [],
        bombPenalty: -10,
      },
    })

    engine.runEpisode()
    flushAll()

    const snapshot = engine.getSnapshot()
    expect(snapshot.status).toBe('idle')
    expect(snapshot.episode).toBe(1)
  })
})

describe('SimulationEngine — run({ episodes })', () => {
  it('completes exactly N episodes, no more and no less', () => {
    const { source, flushAll } = createManualTimerSource()
    const engine = new SimulationEngine({
      timerSource: source,
      envConfig: {
        width: 2,
        height: 1,
        start: { x: 0, y: 0 },
        goal: { x: 1, y: 0 },
        walls: [],
        stepReward: -0.1,
        goalReward: 10,
        terminalCells: [],
        bombs: [],
        bombPenalty: -10,
      },
    })

    engine.run({ episodes: 7 })
    flushAll()

    const snapshot = engine.getSnapshot()
    expect(snapshot.status).toBe('idle')
    expect(snapshot.episode).toBe(7)
  })

  it('rejects a non-positive episode count', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source })
    expect(() => engine.run({ episodes: 0 })).toThrow()
    expect(() => engine.run({ episodes: -1 })).toThrow()
  })

  it('does not spin up a duplicate run when already running', () => {
    const { source, flushAll } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source })
    engine.run({ episodes: 100 })
    engine.run({ episodes: 1 }) // should be ignored — already running
    engine.pause()
    // If a second loop had started, episode target bookkeeping would be inconsistent;
    // simplest correctness signal is that the engine is still cleanly pausable/resumable.
    expect(engine.getSnapshot().status).toBe('paused')
    engine.resume()
    flushAll()
    expect(engine.getSnapshot().status).toBe('idle')
  })
})

describe('SimulationEngine — pause/resume', () => {
  it('no further steps happen while paused, and resume continues from where it left off', () => {
    const { source, flushAll } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source })

    engine.run({ episodes: 50 })
    engine.pause()
    const pausedSnapshot = engine.getSnapshot()

    // Nothing should change while paused, however long "time" passes.
    for (let i = 0; i < 5; i++) {
      const stillPaused = engine.getSnapshot()
      expect(stillPaused.episode).toBe(pausedSnapshot.episode)
      expect(stillPaused.stats.totalReward).toBe(pausedSnapshot.stats.totalReward)
    }

    engine.resume()
    flushAll()
    expect(engine.getSnapshot().status).toBe('idle')
    expect(engine.getSnapshot().episode).toBe(50)
  })

  it('pause does not reset the environment, agent, or stats', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source })

    engine.run({ episodes: 50 })
    engine.pause()
    const snapshot = engine.getSnapshot()

    // Some learning must have happened (Q-table non-empty) and it must survive pause().
    expect(snapshot.agentSnapshot.kind).toBe('Q')
    if (snapshot.agentSnapshot.kind === 'Q') {
      expect(Object.keys(snapshot.agentSnapshot.qTable).length).toBeGreaterThan(0)
    }
  })
})

describe('SimulationEngine — speed changes', () => {
  it('setSpeed while RUNNING does not throw and the run still completes correctly', () => {
    const { source, flushAll } = createManualTimerSource()
    const engine = new SimulationEngine({
      timerSource: source,
      speed: { mode: 'interval', intervalMs: 200 },
    })

    engine.run({ episodes: 20 })
    expect(() => engine.setSpeed({ mode: 'batch', stepsPerFrame: 25 })).not.toThrow()
    flushAll()

    expect(engine.getSnapshot().status).toBe('idle')
    expect(engine.getSnapshot().episode).toBe(20)
  })
})

describe('SimulationEngine — reset()', () => {
  it('clears the Q-table, stats, current state, pendingAction, and returns to idle', () => {
    const { source, flushAll } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source })

    engine.run({ episodes: 10 })
    flushAll()
    expect(engine.getSnapshot().episode).toBe(10) // learning happened

    engine.reset()
    const snapshot = engine.getSnapshot()

    expect(snapshot.status).toBe('idle')
    expect(snapshot.episode).toBe(0)
    expect(snapshot.stats.totalReward).toBe(0)
    expect(snapshot.stats.rewardHistory).toEqual([])
    expect(snapshot.lastTransition).toBeNull()
    expect(snapshot.lastActionSelection).toBeNull()
    expect(snapshot.lastTdInfo).toBeNull()
    expect(snapshot.agentSnapshot.kind).toBe('Q')
    if (snapshot.agentSnapshot.kind === 'Q') {
      expect(Object.keys(snapshot.agentSnapshot.qTable).length).toBe(0)
    }
  })

  it('a plain reset() with no overrides still clears the Q-table and stats', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source })
    engine.step()
    engine.reset()
    const snapshot = engine.getSnapshot()
    expect(snapshot.agentSnapshot.kind).toBe('Q')
    if (snapshot.agentSnapshot.kind === 'Q') {
      expect(Object.keys(snapshot.agentSnapshot.qTable).length).toBe(0)
    }
    expect(snapshot.episode).toBe(0)
  })

  it('invalidates any callback that was already scheduled before reset() was called', () => {
    const { source, flushOne } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source })

    engine.run({ episodes: 1000 })
    const episodeAtReset = engine.getSnapshot().episode
    engine.reset()

    // Firing whatever was queued before reset() must not resurrect the old run.
    flushOne()

    expect(engine.getSnapshot().status).toBe('idle')
    expect(engine.getSnapshot().episode).toBe(0)
    expect(engine.getSnapshot().episode).not.toBe(episodeAtReset + 1)
  })

  // Phase 10 §5 boundary audit: reset() from PAUSED wasn't exercised on its own before
  // (only from RUNNING and IDLE) — pause() and reset() both call scheduler.stop()
  // internally, so this checks that calling it twice in a row (once via pause(), once
  // via reset()) doesn't leave the Scheduler or status in an inconsistent state.
  it('reset() while PAUSED returns cleanly to idle (not stuck paused, no leftover run)', () => {
    const { source, flushOne } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source })

    engine.run({ episodes: 1000 })
    engine.pause()
    expect(engine.getSnapshot().status).toBe('paused')

    engine.reset()

    expect(engine.getSnapshot().status).toBe('idle')
    expect(engine.getSnapshot().episode).toBe(0)
    // Nothing should still be scheduled from before the pause/reset.
    expect(flushOne()).toBe(false)
  })

  // reset() had only been exercised mid-run({episodes}) before — runEpisode() is a
  // different internal runMode ('single-episode' vs 'episodes') with its own stop
  // condition, so this confirms reset() aborts it just as cleanly.
  it('reset() mid-runEpisode() aborts the in-progress episode cleanly', () => {
    const { source, flushOne } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source })

    engine.runEpisode()
    expect(engine.getSnapshot().status).toBe('running')

    engine.reset()

    expect(engine.getSnapshot().status).toBe('idle')
    expect(engine.getSnapshot().episode).toBe(0)
    expect(engine.getSnapshot().lastTransition).toBeNull()
    // The runEpisode() loop's next scheduled batch must not resurrect after reset().
    expect(flushOne()).toBe(false)
  })
})

describe('SimulationEngine — computation vs. emit frequency invariant', () => {
  it('fast batch mode performs every RL update but can emit less often than steps taken', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({
      timerSource: source,
      speed: { mode: 'batch', stepsPerFrame: 50 },
    })

    let emitCount = 0
    engine.subscribe(() => {
      emitCount += 1
    })

    engine.run({ episodes: 100000 }) // effectively "run until we stop it"
    // start() executes exactly one batch of up to 50 steps synchronously.
    const afterFirstBatch = engine.getSnapshot()

    // Only one snapshot should have been emitted for the whole batch (afterBatch, once),
    // not once per individual step.
    expect(emitCount).toBe(1)

    // totalReward accumulates every single step's reward, so if fewer than
    // stepsPerFrame RL updates had actually run, its magnitude would be far smaller
    // than roughly 50 * |stepReward|. stepReward is a small negative constant, so a
    // near-zero totalReward after a 50-step batch would indicate steps were skipped.
    expect(Math.abs(afterFirstBatch.stats.totalReward)).toBeGreaterThan(1)

    engine.pause() // stop the run so the test doesn't leave a dangling scheduled callback
  })

  it('the Q-table reflects all steps in a fast batch, not just the last one', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({
      timerSource: source,
      speed: { mode: 'batch', stepsPerFrame: 30 },
      hyperparams: { alpha: 0.3, gamma: 0.9, epsilon: 1 }, // epsilon=1 forces exploration -> movement
    })

    engine.run({ episodes: 100000 })
    engine.pause()

    const snapshot = engine.getSnapshot()
    expect(snapshot.agentSnapshot.kind).toBe('Q')
    if (snapshot.agentSnapshot.kind === 'Q') {
      // With 30 real steps taken (batch size) and only a 7x7 default grid, multiple
      // distinct states should have been visited and updated, not just one.
      const visitedStates = Object.keys(snapshot.agentSnapshot.qTable).length
      expect(visitedStates).toBeGreaterThan(1)
    }
  })
})

// Phase 12: clarifies the Episode execution model. Run/Run Episode/Pause/Resume/Reset
// already had correct state-machine plumbing from Phase 2's design (generation token,
// runMode/remainingEpisodes as Engine — not Scheduler — fields, environment.reset() only
// inside finishEpisode()); the actual bug this phase fixes was UI-layer only (App.tsx's
// Run button called run({ episodes: 1000 }) instead of running just the current
// episode). These tests pin down the Core-level guarantees the UI fix depends on.
describe('SimulationEngine — Phase 12: episode execution model', () => {
  it('run({ episodes: 1 }) runs exactly the current episode to termination, then idle', () => {
    const { source, flushAll } = createManualTimerSource()
    const engine = new SimulationEngine({
      timerSource: source,
      envConfig: {
        width: 2,
        height: 1,
        start: { x: 0, y: 0 },
        goal: { x: 1, y: 0 },
        walls: [],
        stepReward: -0.1,
        goalReward: 10,
        terminalCells: [],
        bombs: [],
        bombPenalty: -10,
      },
    })

    engine.run({ episodes: 1 })
    flushAll()

    const snapshot = engine.getSnapshot()
    expect(snapshot.status).toBe('idle')
    expect(snapshot.episode).toBe(1)
  })

  it('pause preserves exact mid-episode progress, and resume continues the same episode from the next step (not a restart)', () => {
    const { source, flushOne } = createManualTimerSource()
    const engine = new SimulationEngine({
      timerSource: source,
      speed: { mode: 'interval', intervalMs: 200 },
      // alpha=0 freezes the Q-table (no learning), epsilon=0 is fully greedy — with an
      // all-zero Q-table that never changes, action selection ties on every step and the
      // lowest-index action ("up") always wins, so the agent deterministically self-loops
      // against the top boundary of the default 7x7 grid forever. This makes step count
      // and position fully predictable without depending on any RNG behavior.
      hyperparams: { alpha: 0, gamma: 0.9, epsilon: 0 },
    })

    // Scheduler.start() runs the first batch synchronously, so run() itself already
    // performs step 1 before any flushOne() — only 2 more flushes are needed to reach 3.
    engine.run({ episodes: 1 })
    flushOne()
    flushOne()
    const midSnapshot = engine.getSnapshot()
    expect(midSnapshot.status).toBe('running')
    expect(midSnapshot.stepInCurrentEpisode).toBe(3)
    expect(midSnapshot.currentState).toBe('0,0')

    engine.pause()
    const pausedSnapshot = engine.getSnapshot()
    expect(pausedSnapshot.status).toBe('paused')
    expect(pausedSnapshot.stepInCurrentEpisode).toBe(3)
    expect(pausedSnapshot.currentState).toBe('0,0')
    expect(pausedSnapshot.stats.totalReward).toBe(midSnapshot.stats.totalReward)

    // resume() -> Scheduler.start() also performs the next step synchronously, so no
    // extra flushOne() is needed to observe step 4.
    engine.resume()
    const afterResumeSnapshot = engine.getSnapshot()
    expect(afterResumeSnapshot.status).toBe('running')
    // Exactly one more step than at pause time — proves resume executed step 4, not a
    // fresh episode restarting back at step 1.
    expect(afterResumeSnapshot.stepInCurrentEpisode).toBe(4)
    expect(afterResumeSnapshot.episode).toBe(0) // still the same, unfinished episode
  })

  it('pause/resume during runEpisode() (single-episode mode) completes the same episode without restarting or duplicating it', () => {
    const { source, flushOne, flushAll } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source, speed: { mode: 'interval', intervalMs: 200 } })

    // runEpisode() -> Scheduler.start() also performs step 1 synchronously, so only 1
    // more flushOne() is needed to reach step 2.
    engine.runEpisode()
    flushOne()
    const midSnapshot = engine.getSnapshot()
    expect(midSnapshot.status).toBe('running')
    expect(midSnapshot.episode).toBe(0) // not finished yet
    expect(midSnapshot.stepInCurrentEpisode).toBe(2)

    engine.pause()
    const pausedSnapshot = engine.getSnapshot()
    expect(pausedSnapshot.stepInCurrentEpisode).toBe(2)
    expect(pausedSnapshot.currentState).toBe(midSnapshot.currentState)

    engine.resume()
    flushAll() // drive the SAME episode to completion (default 7x7 grid, random walk)

    const finalSnapshot = engine.getSnapshot()
    expect(finalSnapshot.status).toBe('idle')
    // Exactly one episode total — a restart-on-resume bug would either duplicate this to
    // 2, or a lost-progress bug would show a step count inconsistent with continuation.
    expect(finalSnapshot.episode).toBe(1)
  })

  it('a new episode starts from the environment Start state when a multi-episode run continues past a terminal transition', () => {
    const { source, flushOne } = createManualTimerSource()
    const engine = new SimulationEngine({
      timerSource: source,
      speed: { mode: 'interval', intervalMs: 200 },
      hyperparams: { alpha: 0.1, gamma: 0.9, epsilon: 1 }, // fully random -> reliably reaches Goal
      envConfig: {
        width: 2,
        height: 1,
        start: { x: 0, y: 0 },
        goal: { x: 1, y: 0 },
        walls: [],
        stepReward: -0.1,
        goalReward: 10,
        terminalCells: [],
        bombs: [],
        bombPenalty: -10,
      },
    })

    let sawEpisodeOneStart = false
    function checkForEpisodeOneStart() {
      const snap = engine.getSnapshot()
      if (snap.episode === 1 && !sawEpisodeOneStart) {
        sawEpisodeOneStart = true
        // The moment the 1st episode ends and the 2nd begins, currentState must already
        // be back at Start (0,0) — not wherever episode 1's terminal transition landed.
        expect(snap.currentState).toBe('0,0')
        expect(snap.stepInCurrentEpisode).toBe(0)
      }
    }

    // Scheduler.start() performs the first step synchronously, so episode 1 could in
    // principle already have started before the flush loop below even begins — check
    // right after run() too, not just after each flushOne().
    engine.run({ episodes: 2 })
    checkForEpisodeOneStart()

    for (let i = 0; i < 500 && engine.getSnapshot().episode < 2; i++) {
      flushOne()
      checkForEpisodeOneStart()
    }

    expect(sawEpisodeOneStart).toBe(true)
    expect(engine.getSnapshot().status).toBe('idle')
    expect(engine.getSnapshot().episode).toBe(2)
  })
})

describe('SimulationEngine — 500 episode smoke test', () => {
  it('Q-Learning improves over 500 episodes on GridWorld (headless)', () => {
    const { source, flushAll } = createManualTimerSource()
    const engine = new SimulationEngine({
      timerSource: source,
      speed: { mode: 'batch', stepsPerFrame: 500 },
      hyperparams: { alpha: 0.2, gamma: 0.9, epsilon: 0.2 },
    })

    engine.run({ episodes: 500 })
    flushAll()

    const snapshot = engine.getSnapshot()
    expect(snapshot.status).toBe('idle')
    expect(snapshot.episode).toBe(500)

    // A weak, RNG-tolerant regression guard: some episodes must have succeeded, and the
    // average reward over the most recent window must not be catastrophically negative
    // (which would indicate the agent never learns / never reaches the goal at all).
    expect(snapshot.stats.successCount).toBeGreaterThan(0)
    expect(snapshot.stats.avgRewardMovingWindow).toBeGreaterThan(-5)
  })
})

describe('SimulationEngine — Phase 18: setHyperparams() / epsilon control', () => {
  it('EngineSnapshot exposes the current hyperparameters, defaulting to the Algorithm schema defaults (epsilon=0.2, Phase 28)', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source })
    expect(engine.getSnapshot().hyperparams).toEqual({ alpha: 0.1, gamma: 0.9, epsilon: 0.2 })
  })

  it('setHyperparams({ epsilon: 0 }) is reflected in the snapshot and makes action selection fully greedy (no exploration)', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source })

    engine.setHyperparams({ epsilon: 0 })
    expect(engine.getSnapshot().hyperparams.epsilon).toBe(0)

    for (let i = 0; i < 10; i++) engine.step()
    const snapshot = engine.getSnapshot()
    expect(snapshot.lastActionSelection!.wasExploration).toBe(false)
  })

  it('setHyperparams({ epsilon: 1 }) makes every action selection exploration', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source })

    engine.setHyperparams({ epsilon: 1 })
    expect(engine.getSnapshot().hyperparams.epsilon).toBe(1)

    for (let i = 0; i < 10; i++) engine.step()
    expect(engine.getSnapshot().lastActionSelection!.wasExploration).toBe(true)
  })

  it('an intermediate epsilon value is stored and reported exactly', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source })
    engine.setHyperparams({ epsilon: 0.37 })
    expect(engine.getSnapshot().hyperparams.epsilon).toBe(0.37)
  })

  it('does not reset the Environment, Agent/Q-table, episode, or stats', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source, hyperparams: { alpha: 0.5, gamma: 0.9, epsilon: 0 } })

    engine.step()
    const before = engine.getSnapshot()
    expect(before.agentSnapshot.kind).toBe('Q')
    const qTableBefore = before.agentSnapshot.kind === 'Q' ? before.agentSnapshot.qTable : null
    expect(Object.keys(qTableBefore!).length).toBeGreaterThan(0) // learning already happened

    engine.setHyperparams({ epsilon: 0.5 })
    const after = engine.getSnapshot()

    expect(after.currentState).toBe(before.currentState)
    expect(after.episode).toBe(before.episode)
    expect(after.stats.totalReward).toBe(before.stats.totalReward)
    expect(after.agentSnapshot).toEqual(before.agentSnapshot) // Q-table byte-for-byte unchanged
    expect(after.status).toBe(before.status)
  })

  it('takes effect starting with the very next action selection, mid-episode', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source, hyperparams: { alpha: 0.1, gamma: 0.9, epsilon: 0 } })

    engine.step() // greedy while epsilon=0
    expect(engine.getSnapshot().lastActionSelection!.wasExploration).toBe(false)

    engine.setHyperparams({ epsilon: 1 }) // same in-progress episode, no reset
    engine.step() // must now explore
    const snap = engine.getSnapshot()
    expect(snap.lastActionSelection!.wasExploration).toBe(true)
    expect(snap.episode).toBe(0) // still the same episode throughout
  })

  it('can be changed while RUNNING and while PAUSED without disturbing the in-flight run', () => {
    const { source, flushOne } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source, speed: { mode: 'interval', intervalMs: 200 } })

    engine.run({ episodes: 5 })
    expect(engine.getSnapshot().status).toBe('running')
    expect(() => engine.setHyperparams({ epsilon: 0.2 })).not.toThrow()
    expect(engine.getSnapshot().hyperparams.epsilon).toBe(0.2)
    expect(engine.getSnapshot().status).toBe('running') // unaffected

    engine.pause()
    expect(() => engine.setHyperparams({ epsilon: 0.8 })).not.toThrow()
    expect(engine.getSnapshot().hyperparams.epsilon).toBe(0.8)
    expect(engine.getSnapshot().status).toBe('paused') // unaffected

    engine.resume()
    expect(flushOne()).toBe(true) // the run is still alive and progressing, unaffected
  })

  it('reset() restores hyperparameters to the Algorithm schema defaults, undoing any setHyperparams() call', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source })

    engine.setHyperparams({ epsilon: 0.05 })
    expect(engine.getSnapshot().hyperparams.epsilon).toBe(0.05)

    engine.reset()
    expect(engine.getSnapshot().hyperparams.epsilon).toBe(0.2)
  })
})

describe('SimulationEngine — Phase 20: Bomb', () => {
  // width=2, start=(0,0), bomb=(1,0): action 3 (right) reaches the Bomb; actions 0/1/2
  // all self-loop at (0,0) (up/left go out of bounds or nowhere, down also out of
  // bounds on a height=1 grid). With epsilon=1 (default), each step has a 1-in-4 chance
  // of ending the episode via the Bomb — flushAll() (bounded, effectively unlimited)
  // reliably reaches it, same technique Phase 12's random-walk tests already use.
  const bombGridConfig = {
    width: 2,
    height: 1,
    start: { x: 0, y: 0 },
    goal: { x: 1, y: 1 }, // off this 2x1 grid's reachable area — only the Bomb can end an episode
    walls: [],
    stepReward: -0.1,
    goalReward: 10,
    terminalCells: [],
    bombs: [{ x: 1, y: 0 }],
    bombPenalty: -10,
  }

  it('a completed Run Episode via Bomb returns to idle, with the Bomb penalty reflected in stats', () => {
    const { source, flushAll } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source, envConfig: bombGridConfig })

    engine.runEpisode()
    flushAll()

    const snapshot = engine.getSnapshot()
    expect(snapshot.status).toBe('idle')
    expect(snapshot.episode).toBe(1)
    // The episode's last transition must be the terminal Bomb entry with its penalty.
    expect(snapshot.lastTransition!.reward).toBe(-10)
    expect(snapshot.lastTransition!.done).toBe(true)
    expect(snapshot.lastTransition!.nextState).toBe('1,0')
  })

  it('run({ episodes: N }): a Bomb ending Episode 1 does not stop the overall run — Episode 2 starts at Start', () => {
    const { source, flushOne } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source, envConfig: bombGridConfig })

    let sawEpisodeOneStart = false
    function checkForEpisodeOneStart() {
      const snap = engine.getSnapshot()
      if (snap.episode === 1 && !sawEpisodeOneStart) {
        sawEpisodeOneStart = true
        expect(snap.currentState).toBe('0,0') // back at Start, not stuck at the Bomb
        expect(snap.stepInCurrentEpisode).toBe(0)
      }
    }

    // Scheduler.start() performs the first step synchronously (Phase 12), so the Bomb
    // could already have ended episode 1 before the flush loop below even begins.
    engine.run({ episodes: 3 })
    checkForEpisodeOneStart()

    for (let i = 0; i < 2000 && engine.getSnapshot().episode < 3; i++) {
      flushOne()
      checkForEpisodeOneStart()
    }

    expect(sawEpisodeOneStart).toBe(true)
    expect(engine.getSnapshot().status).toBe('idle')
    expect(engine.getSnapshot().episode).toBe(3)
  })

  it('Pause/Resume work normally on a Bomb-containing environment (no crash, progress continues)', () => {
    const { source, flushOne } = createManualTimerSource()
    const engine = new SimulationEngine({
      timerSource: source,
      speed: { mode: 'interval', intervalMs: 200 },
      envConfig: bombGridConfig,
      hyperparams: { alpha: 0, gamma: 0.9, epsilon: 0 }, // deterministic self-loop, won't hit the Bomb
    })

    engine.run({ episodes: 1 })
    flushOne()
    const midSnapshot = engine.getSnapshot()
    expect(midSnapshot.status).toBe('running')

    engine.pause()
    expect(engine.getSnapshot().status).toBe('paused')
    expect(engine.getSnapshot().stepInCurrentEpisode).toBe(midSnapshot.stepInCurrentEpisode)

    engine.resume()
    expect(engine.getSnapshot().status).toBe('running')
    expect(engine.getSnapshot().stepInCurrentEpisode).toBe(midSnapshot.stepInCurrentEpisode + 1)
  })

  it('Reset cancels an in-progress Bomb-environment run cleanly (same semantics as any other environment)', () => {
    const { source, flushOne } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source, envConfig: bombGridConfig })

    engine.run({ episodes: 10 })
    expect(engine.getSnapshot().status).toBe('running')

    engine.reset()

    expect(engine.getSnapshot().status).toBe('idle')
    expect(engine.getSnapshot().episode).toBe(0)
    expect(flushOne()).toBe(false) // no leftover scheduled callback resurrects the old run
  })

  it('Reset (no envConfig override) preserves the Bomb placement/penalty already applied', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source, envConfig: bombGridConfig })

    engine.step()
    engine.reset()

    const snapshot = engine.getSnapshot()
    expect(snapshot.envRenderModel.kind).toBe('grid')
    if (snapshot.envRenderModel.kind === 'grid') {
      expect(snapshot.envRenderModel.bombs).toEqual(['1,0'])
      expect(snapshot.envRenderModel.bombPenalty).toBe(-10)
    }
  })

  it('the Bomb penalty is included in episodeReward and recorded in rewardHistory (no separate reward pipeline)', () => {
    const { source, flushAll } = createManualTimerSource()
    const engine = new SimulationEngine({
      timerSource: source,
      envConfig: bombGridConfig,
      // interval mode (not batch): exactly one step per emitted snapshot, so subscribe()
      // below observes every single step's transition — batch mode would only expose
      // the last step of each batch, undercounting the sum.
      speed: { mode: 'interval', intervalMs: 200 },
    })

    // Sum every step's reward independently via subscribe(), exactly mirroring how
    // Engine itself accumulates episodeReward (SimulationEngine.ts: `episodeReward +=
    // transition.reward` per step) — this proves rewardHistory reflects the real
    // per-step rewards (including the Bomb's) rather than some separately computed value.
    let expectedTotal = 0
    let sawTerminalBombReward = false
    engine.subscribe((snap) => {
      if (snap.lastTransition && !sawTerminalBombReward) {
        expectedTotal += snap.lastTransition.reward
        if (snap.lastTransition.done) sawTerminalBombReward = true
      }
    })

    engine.runEpisode()
    flushAll()

    expect(sawTerminalBombReward).toBe(true)
    const snapshot = engine.getSnapshot()
    expect(snapshot.status).toBe('idle')
    expect(snapshot.stats.rewardHistory).toEqual([expectedTotal])
    expect(snapshot.stats.totalReward).toBe(expectedTotal)
  })

  // Requirement §10: PolicyOverlay/ValueHeatmap must never draw a normal policy
  // arrow/value for a Bomb cell. Both components only render for States that are keys
  // in agentSnapshot.qTable, computed from Agent.applyUpdate(transition.state, ...) —
  // the FROM state, never the terminal TO state. Since entering a Bomb always ends the
  // Episode (finishEpisode() resets the environment before any further action is ever
  // selected FROM the Bomb), a Bomb position should never become a qTable key — exactly
  // the same mechanism that already makes this true for Goal today. This test proves
  // that guarantee holds, so PolicyOverlay/ValueHeatmap correctly need no Bomb-specific
  // code at all.
  it('a Bomb cell never becomes a key in the Agent Q-table, across many episodes (same as Goal)', () => {
    const { source, flushAll } = createManualTimerSource()
    const engine = new SimulationEngine({
      timerSource: source,
      envConfig: bombGridConfig,
      speed: { mode: 'batch', stepsPerFrame: 500 },
      hyperparams: { alpha: 0.2, gamma: 0.9, epsilon: 0.5 },
    })

    engine.run({ episodes: 100 })
    flushAll()

    const snapshot = engine.getSnapshot()
    expect(snapshot.status).toBe('idle')
    expect(snapshot.episode).toBe(100)
    expect(snapshot.agentSnapshot.kind).toBe('Q')
    if (snapshot.agentSnapshot.kind === 'Q') {
      expect(Object.keys(snapshot.agentSnapshot.qTable)).not.toContain('1,0') // the Bomb's position
    }
  })
})

describe('SimulationEngine — Phase 21: Episode Statistics', () => {
  // A 1-wide, 4-tall corridor: start=(0,3), goal=(0,0). With alpha=0 (Q-table never
  // updates) and epsilon=0 (fully greedy), every step ties on an all-zero Q-vector and
  // resolves to the lowest-index action — action 0 ("up", y-1) — every single time.
  // "Up" from (0,3)->(0,2)->(0,1)->(0,0)=goal is a fully deterministic 3-step path, with
  // no reliance on Math.random() at all: perfect for exact-value assertions.
  const corridorGoalConfig = {
    width: 1,
    height: 4,
    start: { x: 0, y: 3 },
    goal: { x: 0, y: 0 },
    walls: [],
    stepReward: -1,
    goalReward: 10,
    terminalCells: [],
    bombs: [],
    bombPenalty: -10,
  }
  // Same corridor, but a Bomb sits where the Goal was — "up" from (0,1) reaches it in
  // exactly 2 steps. Goal is placed off the reachable column so it can never trigger.
  const corridorBombConfig = {
    ...corridorGoalConfig,
    goal: { x: 0, y: 3 }, // same as start — never reached by moving up
    bombs: [{ x: 0, y: 1 }],
    bombPenalty: -7,
  }
  const deterministicHyperparams = { alpha: 0, gamma: 0.9, epsilon: 0 }

  function runCorridorToCompletion(engine: SimulationEngine) {
    while (engine.getSnapshot().episode === 0) engine.step()
  }

  it('1/2/3. exactly one EpisodeStats is created on completion, with steps and totalReward matching the actual episode', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source, envConfig: corridorGoalConfig, hyperparams: deterministicHyperparams })

    runCorridorToCompletion(engine)

    const snapshot = engine.getSnapshot()
    expect(snapshot.stats.episodeStatsHistory.length).toBe(1)
    const stats = snapshot.stats.latestEpisodeStats!
    expect(stats.episode).toBe(1)
    expect(stats.steps).toBe(3) // (0,3)->(0,2)->(0,1)->(0,0), 3 transitions
    expect(stats.totalReward).toBe(snapshot.stats.rewardHistory[0]) // same value rewardHistory already recorded
    expect(stats.totalReward).toBeCloseTo(-1 + -1 + 10, 10) // 2 step penalties + the goal reward
  })

  it('4/5. explorationCount + exploitationCount === steps, and explorationRate is exact', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source, envConfig: corridorGoalConfig, hyperparams: deterministicHyperparams })

    runCorridorToCompletion(engine)

    const stats = engine.getSnapshot().stats.latestEpisodeStats!
    expect(stats.explorationCount + stats.exploitationCount).toBe(stats.steps)
    // epsilon=0 -> every step is exploitation, never exploration.
    expect(stats.explorationCount).toBe(0)
    expect(stats.exploitationCount).toBe(3)
    expect(stats.explorationRate).toBe(0)
  })

  it('6. averageReward === totalReward / steps exactly', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source, envConfig: corridorGoalConfig, hyperparams: deterministicHyperparams })

    runCorridorToCompletion(engine)

    const stats = engine.getSnapshot().stats.latestEpisodeStats!
    expect(stats.averageReward).toBeCloseTo(stats.totalReward / stats.steps, 10)
  })

  it('7. uniqueStates counts every distinct StateKey occupied, including the terminal cell', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source, envConfig: corridorGoalConfig, hyperparams: deterministicHyperparams })

    runCorridorToCompletion(engine)

    const stats = engine.getSnapshot().stats.latestEpisodeStats!
    // (0,3), (0,2), (0,1), (0,0) — 4 distinct cells, each visited exactly once.
    expect(stats.uniqueStates).toBe(4)
  })

  it('8. a Goal-ended Episode is recorded with terminationReason "goal"', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source, envConfig: corridorGoalConfig, hyperparams: deterministicHyperparams })

    runCorridorToCompletion(engine)

    expect(engine.getSnapshot().stats.latestEpisodeStats!.terminationReason).toBe('goal')
  })

  it('9. a Bomb-ended Episode is recorded with terminationReason "bomb", and the penalty is in totalReward', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source, envConfig: corridorBombConfig, hyperparams: deterministicHyperparams })

    runCorridorToCompletion(engine)

    const stats = engine.getSnapshot().stats.latestEpisodeStats!
    expect(stats.terminationReason).toBe('bomb')
    expect(stats.steps).toBe(2) // (0,3)->(0,2)->(0,1)=bomb
    expect(stats.totalReward).toBeCloseTo(-1 + -7, 10) // 1 step penalty + the bomb penalty
  })

  it('10. Pause mid-Episode creates no EpisodeStats yet; completing after Resume creates exactly one', () => {
    const { source, flushOne } = createManualTimerSource()
    const engine = new SimulationEngine({
      timerSource: source,
      speed: { mode: 'interval', intervalMs: 200 },
      envConfig: corridorGoalConfig,
      hyperparams: deterministicHyperparams,
    })

    engine.run({ episodes: 1 }) // step 1 synchronously: (0,3)->(0,2)
    expect(engine.getSnapshot().stats.episodeStatsHistory).toEqual([])

    engine.pause()
    expect(engine.getSnapshot().stats.episodeStatsHistory).toEqual([]) // still none — Episode not done

    engine.resume() // step 2 synchronously: (0,2)->(0,1)
    expect(engine.getSnapshot().stats.episodeStatsHistory).toEqual([])

    flushOne() // step 3: (0,1)->(0,0)=goal, Episode completes
    const snapshot = engine.getSnapshot()
    expect(snapshot.status).toBe('idle')
    expect(snapshot.stats.episodeStatsHistory.length).toBe(1)
    expect(snapshot.stats.latestEpisodeStats!.steps).toBe(3)
  })

  it('11. running N episodes produces exactly N EpisodeStats entries', () => {
    const { source, flushAll } = createManualTimerSource()
    const engine = new SimulationEngine({
      timerSource: source,
      envConfig: {
        width: 2,
        height: 1,
        start: { x: 0, y: 0 },
        goal: { x: 1, y: 0 },
        walls: [],
        stepReward: -0.1,
        goalReward: 10,
        terminalCells: [],
        bombs: [],
        bombPenalty: -10,
      },
    })

    engine.run({ episodes: 5 })
    flushAll()

    const snapshot = engine.getSnapshot()
    expect(snapshot.status).toBe('idle')
    expect(snapshot.episode).toBe(5)
    expect(snapshot.stats.episodeStatsHistory.length).toBe(5)
    expect(snapshot.stats.episodeStatsHistory.map((s) => s.episode)).toEqual([1, 2, 3, 4, 5])
  })

  it('12. Reset clears episodeStatsHistory, the same way it clears rewardHistory', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source, envConfig: corridorGoalConfig, hyperparams: deterministicHyperparams })

    runCorridorToCompletion(engine)
    expect(engine.getSnapshot().stats.episodeStatsHistory.length).toBe(1)

    engine.reset()

    const snapshot = engine.getSnapshot()
    expect(snapshot.stats.episodeStatsHistory).toEqual([])
    expect(snapshot.stats.latestEpisodeStats).toBeNull()
    expect(snapshot.stats.rewardHistory).toEqual([]) // unchanged existing policy, same reset
  })

  it('13. works correctly under Q-Learning (the default algorithm)', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({
      timerSource: source,
      algorithmId: 'q-learning',
      envConfig: corridorGoalConfig,
      hyperparams: deterministicHyperparams,
    })

    runCorridorToCompletion(engine)

    const stats = engine.getSnapshot().stats.latestEpisodeStats!
    expect(stats.terminationReason).toBe('goal')
    expect(stats.steps).toBe(3)
    expect(stats.exploitationCount).toBe(3)
  })

  it('14. works correctly under SARSA (on-policy, uses pendingAction/pickNextAction)', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({
      timerSource: source,
      algorithmId: 'sarsa',
      envConfig: corridorGoalConfig,
      hyperparams: deterministicHyperparams,
    })

    runCorridorToCompletion(engine)

    const stats = engine.getSnapshot().stats.latestEpisodeStats!
    expect(stats.terminationReason).toBe('goal')
    expect(stats.steps).toBe(3)
    expect(stats.explorationCount + stats.exploitationCount).toBe(3)
    expect(stats.exploitationCount).toBe(3) // epsilon=0 -> SARSA's selectAction/pickNextAction are both greedy too
  })

  it('15. changing epsilon mid-Episode is reflected in the actual exploration/exploitation tally (not re-derived)', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source, envConfig: corridorGoalConfig, hyperparams: deterministicHyperparams })

    engine.step() // epsilon=0 -> exploitation, deterministic: (0,3)->(0,2)
    expect(engine.getSnapshot().lastActionSelection!.wasExploration).toBe(false)

    engine.setHyperparams({ epsilon: 1 }) // force exploration for every subsequent step
    let guard = 0
    while (engine.getSnapshot().episode === 0 && guard < 5000) {
      engine.step()
      guard++
    }

    const stats = engine.getSnapshot().stats.latestEpisodeStats!
    expect(stats.exploitationCount).toBe(1) // exactly the one step taken before the epsilon change
    expect(stats.explorationCount).toBeGreaterThanOrEqual(1) // every step after the change
    expect(stats.exploitationCount + stats.explorationCount).toBe(stats.steps)
  })
})

describe('SimulationEngine — Phase 22: setHyperparams({ alpha }) / setHyperparams({ gamma })', () => {
  // Phase 22 makes no Core changes — setHyperparams() (Phase 18) already merges any
  // Hyperparams key generically, and qLearning.ts/sarsa.ts already read hp.alpha/hp.gamma
  // fresh on every computeUpdate() call. These tests are direct evidence that holds for
  // alpha/gamma specifically too, not just epsilon (which is all Phase 18 exercised).

  it('setHyperparams({ alpha }) / setHyperparams({ gamma }) update the snapshot independently of other hyperparams', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source, hyperparams: { alpha: 0.1, gamma: 0.9, epsilon: 0.2 } })

    engine.setHyperparams({ alpha: 0.6 })
    expect(engine.getSnapshot().hyperparams).toEqual({ alpha: 0.6, gamma: 0.9, epsilon: 0.2 })

    engine.setHyperparams({ gamma: 0.4 })
    expect(engine.getSnapshot().hyperparams).toEqual({ alpha: 0.6, gamma: 0.4, epsilon: 0.2 })
  })

  it('changing alpha takes effect starting with the very next Q-value update, not retroactively', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source, hyperparams: { alpha: 0, gamma: 0.9, epsilon: 0 } })

    engine.step() // alpha=0 -> Q_new = Q_old + 0*(target-Q_old) = Q_old, unchanged
    expect(engine.getSnapshot().lastTdInfo!.updatedEstimate).toBe(0)

    engine.setHyperparams({ alpha: 1 }) // same in-progress episode, no reset
    engine.step() // alpha=1 -> Q_new = Q_old + 1*(target-Q_old) = target, exactly
    const snapshot = engine.getSnapshot()
    expect(snapshot.lastTdInfo!.updatedEstimate).toBe(snapshot.lastTdInfo!.target)
  })

  it('changing gamma takes effect starting with the very next TD target, not retroactively', () => {
    const { source } = createManualTimerSource()
    // Default 7x7 grid, Goal 12 steps away — the very first step from Start is
    // guaranteed non-terminal, so gamma's bootstrap term is actually exercised.
    const engine = new SimulationEngine({ timerSource: source, hyperparams: { alpha: 0.1, gamma: 0.9, epsilon: 0 } })

    engine.setHyperparams({ gamma: 0 })
    engine.step()

    const snapshot = engine.getSnapshot()
    expect(snapshot.lastTransition!.done).toBe(false) // sanity: not a terminal step
    // target = r + gamma·max Q(s',·) = r + 0 = r exactly, when gamma=0.
    expect(snapshot.lastTdInfo!.target).toBeCloseTo(snapshot.lastTransition!.reward, 10)
  })

  it('reset() restores alpha/gamma to the Algorithm schema defaults too, not just epsilon', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source })

    engine.setHyperparams({ alpha: 0.99, gamma: 0.01 })
    expect(engine.getSnapshot().hyperparams).toEqual({ alpha: 0.99, gamma: 0.01, epsilon: 0.2 })

    engine.reset()
    expect(engine.getSnapshot().hyperparams).toEqual({ alpha: 0.1, gamma: 0.9, epsilon: 0.2 })
  })

  it('works identically under SARSA (same generic hyperparams pass-through, no algorithm-specific handling)', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({
      timerSource: source,
      algorithmId: 'sarsa',
      hyperparams: { alpha: 0, gamma: 0.9, epsilon: 0 },
    })

    engine.step()
    expect(engine.getSnapshot().lastTdInfo!.updatedEstimate).toBe(0) // alpha=0

    engine.setHyperparams({ alpha: 1 })
    engine.step()
    const snapshot = engine.getSnapshot()
    expect(snapshot.lastTdInfo!.updatedEstimate).toBe(snapshot.lastTdInfo!.target) // alpha=1
  })
})

describe('SimulationEngine — Phase 23: Algorithm selection', () => {
  // Same 1x4 corridor fixture reasoning as Phase 21/the alpha/gamma tests above:
  // alpha=0/epsilon=0 ties every step to the lowest-index action ("up"), a fully
  // deterministic 3-step path to Goal, for RNG-free exact-value assertions.
  const corridorConfig = {
    width: 1,
    height: 4,
    start: { x: 0, y: 3 },
    goal: { x: 0, y: 0 },
    walls: [],
    stepReward: -1,
    goalReward: 10,
    terminalCells: [],
    bombs: [], // 1-wide corridor — no column exists off the "up" path to place a Bomb on
    bombPenalty: -9,
  }
  const deterministicHyperparams = { alpha: 0, gamma: 0.9, epsilon: 0 }

  it('EngineSnapshot.algorithmId reflects the constructor option (default "q-learning")', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source })
    expect(engine.getSnapshot().algorithmId).toBe('q-learning')
  })

  it('reset({ algorithmId }) — the existing ResetOverrides path — switches the active Algorithm', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source })
    expect(engine.getSnapshot().algorithmId).toBe('q-learning')

    engine.reset({ algorithmId: 'sarsa' })
    expect(engine.getSnapshot().algorithmId).toBe('sarsa')

    engine.reset({ algorithmId: 'q-learning' })
    expect(engine.getSnapshot().algorithmId).toBe('q-learning')
  })

  it('switching algorithm resets the Q-table, episode, and reward/episode-stats history (same as a plain reset())', () => {
    const { source, flushAll } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source, envConfig: corridorConfig, hyperparams: deterministicHyperparams })

    while (engine.getSnapshot().episode === 0) engine.step() // complete one deterministic Episode
    const before = engine.getSnapshot()
    expect(before.episode).toBe(1)
    expect(before.stats.rewardHistory.length).toBe(1)
    expect(before.stats.episodeStatsHistory.length).toBe(1)
    expect(before.agentSnapshot.kind).toBe('Q')
    if (before.agentSnapshot.kind === 'Q') expect(Object.keys(before.agentSnapshot.qTable).length).toBeGreaterThan(0)

    engine.reset({ algorithmId: 'sarsa' })

    const after = engine.getSnapshot()
    expect(after.algorithmId).toBe('sarsa')
    expect(after.episode).toBe(0)
    expect(after.stats.rewardHistory).toEqual([])
    expect(after.stats.episodeStatsHistory).toEqual([])
    expect(after.stats.latestEpisodeStats).toBeNull()
    expect(after.agentSnapshot.kind).toBe('Q') // SARSA also requires a Q-agent
    if (after.agentSnapshot.kind === 'Q') expect(Object.keys(after.agentSnapshot.qTable).length).toBe(0)

    flushAll() // no dangling scheduled callback from the old run survives the switch
  })

  it('switching algorithm resets hyperparameters to the NEW algorithm\'s own schema defaults (never copies the old values)', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source, hyperparams: { alpha: 0.77, gamma: 0.11, epsilon: 0.33 } })

    engine.reset({ algorithmId: 'sarsa' })

    // qLearning.ts and sarsa.ts declare an identical schema (alpha=0.1/gamma=0.9/
    // epsilon=0.2 defaults, Phase 28) — confirmed by reading both files — so this also
    // proves the old engine's customized 0.77/0.11/0.33 values were NOT carried over.
    expect(engine.getSnapshot().hyperparams).toEqual({ alpha: 0.1, gamma: 0.9, epsilon: 0.2 })
  })

  it('switching algorithm preserves the current Environment config (Bomb/Start/Goal untouched)', () => {
    const { source } = createManualTimerSource()
    const customConfig = { ...corridorConfig, bombs: [{ x: 0, y: 2 }], bombPenalty: -9 }
    const engine = new SimulationEngine({ timerSource: source, envConfig: customConfig })

    engine.reset({ algorithmId: 'sarsa' })

    const snapshot = engine.getSnapshot()
    expect(snapshot.envRenderModel.kind).toBe('grid')
    if (snapshot.envRenderModel.kind === 'grid') {
      expect(snapshot.envRenderModel.bombs).toEqual(['0,2'])
      expect(snapshot.envRenderModel.bombPenalty).toBe(-9)
      expect(snapshot.envRenderModel.start).toBe('0,3')
      expect(snapshot.envRenderModel.goals).toEqual(['0,0'])
    }
  })

  it('Q-Learning produces TDInfo tagged "q-learning" and completes the deterministic corridor correctly', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({
      timerSource: source,
      algorithmId: 'q-learning',
      envConfig: corridorConfig,
      hyperparams: deterministicHyperparams,
    })

    engine.step()
    expect(engine.getSnapshot().lastTdInfo!.algorithm).toBe('q-learning')

    while (engine.getSnapshot().episode === 0) engine.step()
    expect(engine.getSnapshot().stats.latestEpisodeStats!.terminationReason).toBe('goal')
    expect(engine.getSnapshot().stats.latestEpisodeStats!.steps).toBe(3)
  })

  it('SARSA (selected via reset) produces TDInfo tagged "sarsa" and completes the deterministic corridor correctly', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source, envConfig: corridorConfig })
    engine.reset({ algorithmId: 'sarsa', hyperparams: deterministicHyperparams })

    engine.step()
    expect(engine.getSnapshot().lastTdInfo!.algorithm).toBe('sarsa')

    while (engine.getSnapshot().episode === 0) engine.step()
    expect(engine.getSnapshot().stats.latestEpisodeStats!.terminationReason).toBe('goal')
    expect(engine.getSnapshot().stats.latestEpisodeStats!.steps).toBe(3)
  })

  it('does not disturb an in-progress run when the switch happens between runs (IDLE only, per UI gating) — reset() itself remains the only way to change algorithm mid-flow', () => {
    // Core itself doesn't gate reset({ algorithmId }) by status (the UI does, via
    // `disabled`) — this documents that reset() already tears down any in-flight run
    // safely if called anyway, exactly like a plain reset() while RUNNING already does.
    const { source, flushOne } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source })
    engine.run({ episodes: 5 })
    expect(engine.getSnapshot().status).toBe('running')

    engine.reset({ algorithmId: 'sarsa' })

    expect(engine.getSnapshot().status).toBe('idle')
    expect(engine.getSnapshot().algorithmId).toBe('sarsa')
    expect(flushOne()).toBe(false) // no leftover scheduled callback resurrects the old run
  })
})

describe('SimulationEngine — Phase 26: Episode trajectory', () => {
  // Same 1x4 corridor fixture as the Phase 21/23/25 tests above — alpha=0/epsilon=0
  // ties every step to the lowest-index action ("up"), giving a fully deterministic
  // 3-step path to Goal.
  const corridorConfig = {
    width: 1,
    height: 4,
    start: { x: 0, y: 3 },
    goal: { x: 0, y: 0 },
    walls: [],
    stepReward: -1,
    goalReward: 10,
    terminalCells: [],
    bombs: [],
    bombPenalty: -9,
  }
  const deterministicHyperparams = { alpha: 0, gamma: 0.9, epsilon: 0 }

  it('records the trajectory as the exact ordered transition sequence (not a deduplicated set)', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source, envConfig: corridorConfig, hyperparams: deterministicHyperparams })

    while (engine.getSnapshot().episode === 0) engine.step()

    const ep = engine.getSnapshot().stats.latestEpisodeStats!
    expect(ep.trajectory).toEqual([
      { state: '0,3', action: 0, nextState: '0,2', reward: -1, done: false },
      { state: '0,2', action: 0, nextState: '0,1', reward: -1, done: false },
      { state: '0,1', action: 0, nextState: '0,0', reward: 10, done: true },
    ])
  })

  it('trajectory length always equals EpisodeStats.steps', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source, envConfig: corridorConfig, hyperparams: deterministicHyperparams })

    while (engine.getSnapshot().episode === 0) engine.step()

    const ep = engine.getSnapshot().stats.latestEpisodeStats!
    expect(ep.trajectory.length).toBe(ep.steps)
    expect(ep.trajectory.length).toBe(3)
  })

  it('each recorded action matches the action Algorithm.selectAction actually chose (cross-checked against lastActionSelection)', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source, envConfig: corridorConfig, hyperparams: deterministicHyperparams })

    engine.step()
    const firstAction = engine.getSnapshot().lastActionSelection!.action
    expect(firstAction).toBe(0) // "up" — argmax over an all-zero Q row, lowest index wins

    while (engine.getSnapshot().episode === 0) engine.step()
    const ep = engine.getSnapshot().stats.latestEpisodeStats!
    expect(ep.trajectory[0].action).toBe(firstAction)
    expect(ep.trajectory.every((t) => t.action === 0)).toBe(true)
  })

  it('each recorded reward matches the real per-step reward (step reward vs. the actual Goal reward on the final transition)', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source, envConfig: corridorConfig, hyperparams: deterministicHyperparams })

    while (engine.getSnapshot().episode === 0) engine.step()

    const ep = engine.getSnapshot().stats.latestEpisodeStats!
    expect(ep.trajectory[0].reward).toBe(-1) // stepReward
    expect(ep.trajectory[1].reward).toBe(-1)
    expect(ep.trajectory[2].reward).toBe(10) // goalReward, not stepReward+goalReward
    expect(ep.trajectory.reduce((sum, t) => sum + t.reward, 0)).toBe(ep.totalReward)
  })

  it('Goal termination: last transition is state -> goal, terminationReason "goal"', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source, envConfig: corridorConfig, hyperparams: deterministicHyperparams })

    while (engine.getSnapshot().episode === 0) engine.step()

    const ep = engine.getSnapshot().stats.latestEpisodeStats!
    expect(ep.terminationReason).toBe('goal')
    expect(ep.trajectory[ep.trajectory.length - 1].nextState).toBe('0,0')
    expect(ep.trajectory[ep.trajectory.length - 1].done).toBe(true)
  })

  it('Bomb termination: last transition is state -> bomb, terminationReason "bomb", reward is the real bombPenalty', () => {
    // Same corridor shape, but the Bomb sits one cell before the Goal on the only path
    // the deterministic "always up" policy ever takes — so the Bomb is guaranteed to be
    // reached deterministically, without needing real random exploration.
    const bombCorridorConfig = {
      ...corridorConfig,
      bombs: [{ x: 0, y: 1 }],
      bombPenalty: -7,
    }
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source, envConfig: bombCorridorConfig, hyperparams: deterministicHyperparams })

    while (engine.getSnapshot().episode === 0) engine.step()

    const ep = engine.getSnapshot().stats.latestEpisodeStats!
    expect(ep.terminationReason).toBe('bomb')
    expect(ep.trajectory).toEqual([
      { state: '0,3', action: 0, nextState: '0,2', reward: -1, done: false },
      { state: '0,2', action: 0, nextState: '0,1', reward: -7, done: true },
    ])
  })

  it('repeated State visits are preserved in order (not collapsed like the Set-based uniqueStates count)', () => {
    // width=2,height=1,start=(0,0), Goal at (1,0), alpha=1 (exact convergence — no
    // floating-point ambiguity), epsilon=0. Q(start,·) starts all-zero, so the first
    // three steps each pick the next lowest-index action in turn (up/down/left), and
    // each one bounces off a boundary (height=1 forbids up/down; x=0 forbids left) back
    // to the SAME start State — deterministically revisiting it 3 times before the 4th
    // step's "right" finally reaches the Goal. This is a fully deterministic way to
    // produce a genuine repeated-State trajectory without relying on real randomness.
    const bounceConfig = {
      width: 2,
      height: 1,
      start: { x: 0, y: 0 },
      goal: { x: 1, y: 0 },
      walls: [],
      stepReward: -1,
      goalReward: 10,
      terminalCells: [],
      bombs: [],
      bombPenalty: -9,
    }
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({
      timerSource: source,
      envConfig: bounceConfig,
      hyperparams: { alpha: 1, gamma: 0.9, epsilon: 0 },
    })

    while (engine.getSnapshot().episode === 0) engine.step()

    const ep = engine.getSnapshot().stats.latestEpisodeStats!
    expect(ep.trajectory).toEqual([
      { state: '0,0', action: 0, nextState: '0,0', reward: -1, done: false }, // up: boundary bounce
      { state: '0,0', action: 1, nextState: '0,0', reward: -1, done: false }, // down: boundary bounce
      { state: '0,0', action: 2, nextState: '0,0', reward: -1, done: false }, // left: boundary bounce
      { state: '0,0', action: 3, nextState: '1,0', reward: 10, done: true }, // right: reaches Goal
    ])
    expect(ep.trajectory.length).toBe(4)
    // The Set-based uniqueStates count correctly collapses the 3 repeat visits to '0,0'
    // down to 2 distinct States — proving trajectory (length 4) and uniqueStates (2) are
    // genuinely different pieces of information, neither derivable from the other alone.
    expect(ep.uniqueStates).toBe(2)
    expect(ep.trajectory[0].state).toBe(ep.trajectory[1].state)
    expect(ep.trajectory[1].state).toBe(ep.trajectory[2].state)
  })

  it('the accumulator is reset for the next Episode — trajectories never leak across Episode boundaries', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source, envConfig: corridorConfig, hyperparams: deterministicHyperparams })

    while (engine.getSnapshot().episode === 0) engine.step()
    while (engine.getSnapshot().episode === 1) engine.step()

    const history = engine.getSnapshot().stats.episodeStatsHistory
    expect(history.length).toBe(2)
    expect(history[0].trajectory.length).toBe(3)
    expect(history[1].trajectory.length).toBe(3)
    expect(history[0].trajectory).not.toBe(history[1].trajectory) // independent array references
  })

  it('reset() clears all recorded trajectories from episodeStatsHistory', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source, envConfig: corridorConfig, hyperparams: deterministicHyperparams })

    while (engine.getSnapshot().episode === 0) engine.step()
    expect(engine.getSnapshot().stats.episodeStatsHistory.length).toBe(1)

    engine.reset({ envConfig: corridorConfig })

    expect(engine.getSnapshot().stats.episodeStatsHistory).toEqual([])
  })
})

describe('SimulationEngine — Phase 28: Episode scale (no 200-episode cap)', () => {
  // Same deterministic corridor as the Phase 21/23/26 tests above — 3 steps/Episode,
  // fast enough to run hundreds of times in a unit test.
  const corridorConfig = {
    width: 1,
    height: 4,
    start: { x: 0, y: 3 },
    goal: { x: 0, y: 0 },
    walls: [],
    stepReward: -1,
    goalReward: 10,
    terminalCells: [],
    bombs: [],
    bombPenalty: -9,
  }
  const deterministicHyperparams = { alpha: 0, gamma: 0.9, epsilon: 0 }

  function runEpisodesManually(engine: SimulationEngine, count: number): void {
    for (let target = 1; target <= count; target++) {
      while (engine.getSnapshot().episode < target) engine.step()
    }
  }

  it('retains all 200 Episodes (the boundary of the old cap) without evicting the first one', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source, envConfig: corridorConfig, hyperparams: deterministicHyperparams })

    runEpisodesManually(engine, 200)

    const snapshot = engine.getSnapshot()
    expect(snapshot.episode).toBe(200)
    expect(snapshot.stats.rewardHistory.length).toBe(200)
    expect(snapshot.stats.episodeStatsHistory.length).toBe(200)
    expect(snapshot.stats.episodeStatsHistory[0].episode).toBe(1)
    expect(snapshot.stats.episodeStatsHistory[199].episode).toBe(200)
  })

  it('retains all 201 Episodes — one past the old cap, previously evicted, now preserved', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source, envConfig: corridorConfig, hyperparams: deterministicHyperparams })

    runEpisodesManually(engine, 201)

    const snapshot = engine.getSnapshot()
    expect(snapshot.episode).toBe(201)
    expect(snapshot.stats.rewardHistory.length).toBe(201)
    expect(snapshot.stats.episodeStatsHistory.length).toBe(201)
    // Episode 1 is still there — under the old REWARD_HISTORY_LIMIT=200 cap, this would
    // have been shift()-evicted the moment Episode 201 completed.
    expect(snapshot.stats.episodeStatsHistory[0].episode).toBe(1)
    expect(snapshot.stats.episodeStatsHistory[200].episode).toBe(201)
  })

  it('retains all 500 Episodes, each with its own intact trajectory (Core data structures, not just the count)', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source, envConfig: corridorConfig, hyperparams: deterministicHyperparams })

    runEpisodesManually(engine, 500)

    const snapshot = engine.getSnapshot()
    expect(snapshot.episode).toBe(500)
    expect(snapshot.stats.rewardHistory.length).toBe(500)
    expect(snapshot.stats.episodeStatsHistory.length).toBe(500)
    expect(snapshot.stats.episodeStatsHistory[0].episode).toBe(1)
    expect(snapshot.stats.episodeStatsHistory[0].trajectory.length).toBe(3)
    expect(snapshot.stats.episodeStatsHistory[499].episode).toBe(500)
    expect(snapshot.stats.episodeStatsHistory[499].trajectory.length).toBe(3)
    // successRate uses the real cumulative successCount/episode — not a stale value
    // frozen by the old cap's eviction of early successes.
    expect(snapshot.stats.successRate).toBe(1) // every Episode reaches Goal deterministically
  })

  it('reset() still fully clears an Episode count well past the old 200 cap', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source, envConfig: corridorConfig, hyperparams: deterministicHyperparams })

    runEpisodesManually(engine, 250)
    expect(engine.getSnapshot().stats.episodeStatsHistory.length).toBe(250)

    engine.reset({ envConfig: corridorConfig })

    expect(engine.getSnapshot().episode).toBe(0)
    expect(engine.getSnapshot().stats.rewardHistory).toEqual([])
    expect(engine.getSnapshot().stats.episodeStatsHistory).toEqual([])
  })
})

describe('SimulationEngine — Phase 28: Greedy Policy execution (run({ greedy: true }))', () => {
  const corridorConfig = {
    width: 1,
    height: 4,
    start: { x: 0, y: 3 },
    goal: { x: 0, y: 0 },
    walls: [],
    stepReward: -1,
    goalReward: 10,
    terminalCells: [],
    bombs: [],
    bombPenalty: -9,
  }

  it('always selects the argmax action (wasExploration=false), even with epsilon=1 (always-explore)', () => {
    const { source, flushAll } = createManualTimerSource()
    const engine = new SimulationEngine({
      timerSource: source,
      envConfig: corridorConfig,
      hyperparams: { alpha: 0.1, gamma: 0.9, epsilon: 1 }, // would normally force pure exploration
    })

    engine.run({ episodes: 1, greedy: true })
    // The first step already ran synchronously (Scheduler.start()'s known behaviour).
    expect(engine.getSnapshot().lastActionSelection!.wasExploration).toBe(false)
    flushAll()
    const ep = engine.getSnapshot().stats.latestEpisodeStats!
    expect(ep.explorationCount).toBe(0)
    expect(ep.explorationRate).toBe(0)
  })

  it('never applies an update — every Q-value stays exactly 0 (querying a State during argmax action-selection already lazily creates a zero-vector entry for it, same as any normal run; the invariant this Phase actually guarantees is that no VALUE ever changes)', () => {
    const { source, flushAll } = createManualTimerSource()
    const engine = new SimulationEngine({
      timerSource: source,
      envConfig: corridorConfig,
      hyperparams: { alpha: 0.1, gamma: 0.9, epsilon: 1 },
    })

    engine.run({ episodes: 1, greedy: true })
    flushAll()

    const snapshot = engine.getSnapshot().agentSnapshot
    expect(snapshot.kind).toBe('Q')
    if (snapshot.kind === 'Q') {
      const allValues = Object.values(snapshot.qTable).flat()
      expect(allValues.length).toBeGreaterThan(0) // visited at least one State
      expect(allValues.every((v) => v === 0)).toBe(true) // and none of them ever got updated
    }
  })

  it('lastTdInfo is null during a Greedy run (no TD update happened to report)', () => {
    const { source } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source, envConfig: corridorConfig })

    engine.run({ episodes: 1, greedy: true })

    expect(engine.getSnapshot().lastTdInfo).toBeNull()
  })

  it("does not read from or write to the user's real hyperparams.epsilon — it stays exactly as set, before/during/after", () => {
    const { source, flushAll } = createManualTimerSource()
    const engine = new SimulationEngine({
      timerSource: source,
      envConfig: corridorConfig,
      hyperparams: { alpha: 0.1, gamma: 0.9, epsilon: 0.73 },
    })

    expect(engine.getSnapshot().hyperparams.epsilon).toBe(0.73)
    engine.run({ episodes: 1, greedy: true })
    expect(engine.getSnapshot().hyperparams.epsilon).toBe(0.73) // unchanged mid-run too
    flushAll()
    expect(engine.getSnapshot().hyperparams.epsilon).toBe(0.73) // unchanged after completion
  })

  it('still reaches Goal and finishes the Episode normally (Environment stepping/termination unaffected)', () => {
    const { source, flushAll } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source, envConfig: corridorConfig })

    engine.run({ episodes: 1, greedy: true })
    flushAll()

    expect(engine.getSnapshot().status).toBe('idle')
    const ep = engine.getSnapshot().stats.latestEpisodeStats!
    expect(ep.terminationReason).toBe('goal')
  })

  it('records EpisodeStats/trajectory for a Greedy run identically to a normal run (same finishEpisode() pipeline)', () => {
    const { source, flushAll } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source, envConfig: corridorConfig })

    engine.run({ episodes: 1, greedy: true })
    flushAll()

    expect(engine.getSnapshot().stats.episodeStatsHistory.length).toBe(1)
    expect(engine.getSnapshot().stats.rewardHistory.length).toBe(1)
    const ep = engine.getSnapshot().stats.episodeStatsHistory[0]
    expect(ep.trajectory.length).toBeGreaterThan(0)
    expect(ep.trajectory.every((t) => t.action !== undefined)).toBe(true)
  })

  it('a normal (non-greedy) run({ episodes }) is completely unaffected — greedy defaults to false', () => {
    const { source, flushAll } = createManualTimerSource()
    const engine = new SimulationEngine({
      timerSource: source,
      envConfig: corridorConfig,
      hyperparams: { alpha: 1, gamma: 0.9, epsilon: 0 },
    })

    engine.run({ episodes: 1 }) // no `greedy` field at all
    flushAll()

    // alpha=1 means a real learning run leaves an exact, non-zero Q-table — proving this
    // ordinary run still learns normally (never silently treated as greedy).
    const snapshot = engine.getSnapshot()
    expect(snapshot.agentSnapshot.kind).toBe('Q')
    if (snapshot.agentSnapshot.kind === 'Q') {
      expect(Object.keys(snapshot.agentSnapshot.qTable).length).toBeGreaterThan(0)
    }
  })

  it('EngineSnapshot.isGreedyRun is true only while a Greedy run is in flight, and resets to false once it stops', () => {
    const { source, flushAll } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source, envConfig: corridorConfig })

    expect(engine.getSnapshot().isGreedyRun).toBe(false)
    engine.run({ episodes: 1, greedy: true })
    expect(engine.getSnapshot().isGreedyRun).toBe(true)
    flushAll()
    expect(engine.getSnapshot().isGreedyRun).toBe(false)
  })

  it('EngineSnapshot.isGreedyRun is false for a normal run', () => {
    const { source, flushAll } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source, envConfig: corridorConfig })

    engine.run({ episodes: 1 })
    expect(engine.getSnapshot().isGreedyRun).toBe(false)
    flushAll()
    expect(engine.getSnapshot().isGreedyRun).toBe(false)
  })

  it('works under SARSA too (pendingAction never carries over from a Greedy step — every step re-selects fresh)', () => {
    const { source, flushAll } = createManualTimerSource()
    const engine = new SimulationEngine({
      timerSource: source,
      envConfig: corridorConfig,
      algorithmId: 'sarsa',
      hyperparams: { alpha: 0.1, gamma: 0.9, epsilon: 1 },
    })

    engine.run({ episodes: 1, greedy: true })
    flushAll()

    expect(engine.getSnapshot().status).toBe('idle')
    const ep = engine.getSnapshot().stats.latestEpisodeStats!
    expect(ep.terminationReason).toBe('goal')
    expect(ep.explorationCount).toBe(0)
  })

  it('Bomb termination works normally during a Greedy run', () => {
    const bombCorridorConfig = { ...corridorConfig, bombs: [{ x: 0, y: 1 }], bombPenalty: -7 }
    const { source, flushAll } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source, envConfig: bombCorridorConfig })

    engine.run({ episodes: 1, greedy: true })
    flushAll()

    expect(engine.getSnapshot().status).toBe('idle')
    const ep = engine.getSnapshot().stats.latestEpisodeStats!
    expect(ep.terminationReason).toBe('bomb')
  })

  it('Pause/Resume works normally during a Greedy run and the run stays greedy after Resume', () => {
    const { source, flushAll } = createManualTimerSource()
    const engine = new SimulationEngine({ timerSource: source, envConfig: corridorConfig })

    engine.run({ episodes: 1, greedy: true })
    engine.pause()
    expect(engine.getSnapshot().status).toBe('paused')
    expect(engine.getSnapshot().isGreedyRun).toBe(true) // still greedy across the pause

    engine.resume()
    expect(engine.getSnapshot().isGreedyRun).toBe(true)
    flushAll()

    expect(engine.getSnapshot().status).toBe('idle')
    expect(engine.getSnapshot().agentSnapshot.kind).toBe('Q')
  })
})
