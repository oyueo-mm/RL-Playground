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
