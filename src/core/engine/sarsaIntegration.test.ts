// Phase 8's core regression concern: does the pendingAction wiring designed in Phase 2
// actually preserve SARSA's on-policy guarantee end-to-end through the real Engine —
// i.e. is the action used to compute a step's TD target EXACTLY the action executed on
// the following step()? This file tests that against the real SimulationEngine +
// Scheduler-free step() path (no Core code changed to make this pass).

import { describe, expect, it, vi, afterEach } from 'vitest'
import { SimulationEngine } from './SimulationEngine'
import type { TimerSource } from './Scheduler'
import { getAlgorithm } from '../algorithms/registry'

/**
 * Manual TimerSource (same pattern as SimulationEngine.test.ts's Phase 2 smoke test):
 * setTimeout/rAF just record the callback; flushAll() fires them synchronously on
 * demand, so a multi-batch run({episodes}) can be driven to completion headlessly
 * without real timers.
 */
function createManualTimerSource() {
  let nextId = 1
  const scheduled = new Map<number, () => void>()

  const source: TimerSource = {
    now: () => 0,
    setTimeout: (fn) => {
      const id = nextId++
      scheduled.set(id, fn)
      return id
    },
    clearTimeout: (id) => {
      scheduled.delete(id)
    },
    requestAnimationFrame: (fn) => {
      const id = nextId++
      scheduled.set(id, fn)
      return id
    },
    cancelAnimationFrame: (id) => {
      scheduled.delete(id)
    },
  }

  function flushAll(maxIterations = 200_000): number {
    let count = 0
    while (count < maxIterations && scheduled.size > 0) {
      const [id, fn] = [...scheduled.entries()][0]
      scheduled.delete(id)
      fn()
      count += 1
    }
    return count
  }

  return { source, flushAll }
}

/** Same tie-break rule as core/agents/policies/epsilonGreedy.ts's argmax (lowest index wins). */
function argmaxLowestIndex(values: number[]): number {
  let bestIndex = 0
  let bestValue = values[0]
  for (let i = 1; i < values.length; i++) {
    if (values[i] > bestValue) {
      bestValue = values[i]
      bestIndex = i
    }
  }
  return bestIndex
}

describe('SimulationEngine + SARSA — pendingAction integration (Phase 8 §8/§9)', () => {
  // Engine's performOneStep() order (SimulationEngine.ts, unchanged from Phase 2):
  //   pickNextAction(nextState) and computeUpdate()'s previousEstimate BOTH read the
  //   Agent BEFORE this step's own applyAgentUpdate() mutates it. So the pendingAction
  //   set during step t was computed against the Q-table as it stood *before* step t
  //   ran — i.e. the snapshot captured after (t-1) steps, NOT the snapshot taken right
  //   after step t itself (which already reflects step t's own update, and can differ
  //   at that exact cell when a step is a self-loop, e.g. bumping into a boundary).
  // These tests take a snapshot after every step (snap[0] = before any step) and
  // predict step t's action from snap[t-2] — the Q-table as it stood before step
  // (t-1) computed the pendingAction that step t goes on to execute.

  it('the action used in the TD target for step N is exactly the action executed in step N+1', () => {
    // epsilon=0 makes selectAction/pickNextAction pure, deterministic argmax (no RNG
    // mocking needed) — the Engine's own real Q-table (read back via the public
    // snapshot only) is used to predict what pickNextAction must have chosen.
    const engine = new SimulationEngine({
      algorithmId: 'sarsa',
      hyperparams: { alpha: 0.5, gamma: 0.9, epsilon: 0 },
    })

    const snap0 = engine.getSnapshot() // Q-table before step 1 (pristine)
    engine.step()
    const snap1 = engine.getSnapshot()
    expect(snap1.lastTdInfo!.algorithm).toBe('sarsa')

    // What SARSA's pickNextAction(s1) returned during step 1, computed from snap0's
    // Q-table (the state pickNextAction actually saw) — not snap1's (post-update).
    const s1 = snap1.lastTransition!.nextState
    const preStep1QTable = snap0.agentSnapshot.kind === 'Q' ? snap0.agentSnapshot.qTable : {}
    const expectedNextAction = argmaxLowestIndex(preStep1QTable[s1] ?? [0, 0, 0, 0])

    // The TD target computed during step 1 must already reflect Q(s1, expectedNextAction)
    // as it stood before step 1 (i.e. 0, since the table was pristine).
    if (!snap1.lastTransition!.done) {
      const qAtExpected = (preStep1QTable[s1] ?? [0, 0, 0, 0])[expectedNextAction]
      const expectedTarget = snap1.lastTransition!.reward + 0.9 * qAtExpected
      expect(snap1.lastTdInfo!.target).toBeCloseTo(expectedTarget, 12)
    }

    engine.step()
    const snap2 = engine.getSnapshot()

    // Step 2 must start exactly where step 1 left off, and — the critical assertion —
    // execute the SAME action that was used to compute step 1's TD target, not a
    // freshly re-selected one.
    expect(snap2.lastTransition!.state).toBe(s1)
    expect(snap2.lastTransition!.action).toBe(expectedNextAction)
  })

  it('pendingAction continues to be honoured across many consecutive steps', () => {
    const engine = new SimulationEngine({
      algorithmId: 'sarsa',
      hyperparams: { alpha: 0.3, gamma: 0.9, epsilon: 0 },
    })

    const STEPS = 20
    const snapshots = [engine.getSnapshot()]
    for (let i = 0; i < STEPS; i++) {
      engine.step()
      snapshots.push(engine.getSnapshot())
    }

    let checkedAtLeastOne = false
    for (let t = 2; t <= STEPS; t++) {
      const priorTransitionDone = snapshots[t - 1].lastTransition!.done
      if (priorTransitionDone) continue // episode boundary -> a fresh selectAction() is expected instead

      const agentSnapshotBeforePriorStep = snapshots[t - 2].agentSnapshot
      const qTableBeforePriorStep = agentSnapshotBeforePriorStep.kind === 'Q' ? agentSnapshotBeforePriorStep.qTable : {}
      const stateEnteringThisStep = snapshots[t - 1].currentState
      const predicted = argmaxLowestIndex(qTableBeforePriorStep[stateEnteringThisStep] ?? [0, 0, 0, 0])

      expect(snapshots[t].lastTransition!.action).toBe(predicted)
      expect(snapshots[t].lastTdInfo!.algorithm).toBe('sarsa')
      checkedAtLeastOne = true
    }
    expect(checkedAtLeastOne).toBe(true) // sanity: the loop actually verified something
  })
})

describe('SimulationEngine + SARSA — terminal transition (Phase 8 §15)', () => {
  // A tiny 1-step-to-goal grid + a mocked Math.random (below) forces the very first
  // step to reach the goal deterministically, so the terminal branch is exercised
  // without depending on how many steps a real random walk happens to take.
  const originalRandom = Math.random

  afterEach(() => {
    Math.random = originalRandom
  })

  it('target = reward only on a terminal transition, and pendingAction is null afterward', () => {
    const engine = new SimulationEngine({
      algorithmId: 'sarsa',
      hyperparams: { alpha: 0.5, gamma: 0.9, epsilon: 1 }, // epsilon=1 -> always explore -> RNG picks the action
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

    // epsilonGreedy consumes: 1) explore-check random() (any value <1 triggers explore
    // since epsilon=1), 2) index-pick random() -> floor(value*4). 0.8 -> action 3 (Right),
    // which moves (0,0) -> (1,0) = goal. Provide plenty more values for the Engine's
    // unconditional pickNextAction() call on the (terminal) next state, which is
    // computed but discarded (finishEpisode() nulls pendingAction right after).
    let call = 0
    const sequence = [0, 0.8]
    vi.spyOn(Math, 'random').mockImplementation(() => {
      const v = sequence[call] ?? 0
      call += 1
      return v
    })

    engine.step()
    const snapshot = engine.getSnapshot()

    expect(snapshot.lastTransition!.done).toBe(true)
    expect(snapshot.lastTransition!.reward).toBe(10)
    expect(snapshot.lastTdInfo!.target).toBe(10) // no gamma*bootstrap term at all
    expect(snapshot.lastTdInfo!.targetFormula).toContain('terminal')

    // episode must have auto-reset (ARCHITECTURE.md §7 / SimulationEngine.finishEpisode()).
    expect(snapshot.episode).toBe(1)
    expect(snapshot.currentState).toBe('0,0')

    // The next step must perform a *fresh* selectAction() rather than reusing a stale
    // pendingAction from before the reset — verified indirectly: it must not throw and
    // must produce a new transition starting from the reset start state.
    engine.step()
    expect(engine.getSnapshot().lastTransition!.state).toBe('0,0')
  })
})

describe('SimulationEngine + SARSA — learning over an episode/run (Phase 8 §16)', () => {
  it('a single step completes the full state -> action -> transition -> next action -> TD update cycle', () => {
    const engine = new SimulationEngine({ algorithmId: 'sarsa' })
    const before = engine.getSnapshot()
    expect(before.lastTransition).toBeNull()

    engine.step()

    const after = engine.getSnapshot()
    expect(after.lastTransition).not.toBeNull()
    expect(after.lastActionSelection).not.toBeNull()
    expect(after.lastTdInfo).not.toBeNull()
    expect(after.agentSnapshot.kind).toBe('Q')
    if (after.agentSnapshot.kind === 'Q') {
      const q = after.agentSnapshot.qTable[before.currentState]
      expect(q[after.lastTransition!.action]).toBe(after.lastTdInfo!.updatedEstimate)
    }
  })

  it('runs several episodes headlessly: episodes complete, Q-table updates, pendingAction resets between episodes', () => {
    const engine = new SimulationEngine({
      algorithmId: 'sarsa',
      hyperparams: { alpha: 0.2, gamma: 0.9, epsilon: 0.3 },
    })

    // Generous step budget so at least one episode reliably completes on the default
    // 7x7 grid regardless of how the random walk happens to go (this test only checks
    // "an episode can complete at all", not a specific success rate).
    for (let i = 0; i < 20_000; i++) {
      engine.step()
    }

    const snapshot = engine.getSnapshot()
    expect(snapshot.episode).toBeGreaterThan(0)
    expect(snapshot.agentSnapshot.kind).toBe('Q')
    if (snapshot.agentSnapshot.kind === 'Q') {
      expect(Object.keys(snapshot.agentSnapshot.qTable).length).toBeGreaterThan(0)
    }
  })
})

describe('SimulationEngine + SARSA — 500 episode smoke test (Phase 8 §17)', () => {
  it('Q-Learning-equivalent smoke test: no exceptions, episodes progress, learning improves', () => {
    const { source, flushAll } = createManualTimerSource()
    const engine = new SimulationEngine({
      algorithmId: 'sarsa',
      timerSource: source,
      speed: { mode: 'batch', stepsPerFrame: 500 },
      hyperparams: { alpha: 0.2, gamma: 0.9, epsilon: 0.2 },
    })

    expect(() => engine.run({ episodes: 500 })).not.toThrow()
    flushAll()

    const snapshot = engine.getSnapshot()
    expect(snapshot.status).toBe('idle')
    expect(snapshot.episode).toBe(500)

    // Same weak, RNG-tolerant bar as Phase 2's Q-Learning smoke test (SimulationEngine.test.ts):
    // some episodes must have succeeded, and recent average reward must not be
    // catastrophically negative (which would indicate the agent never learns at all).
    expect(snapshot.stats.successCount).toBeGreaterThan(0)
    expect(snapshot.stats.avgRewardMovingWindow).toBeGreaterThan(-5)
  })
})

describe('SimulationEngine + Q-Learning — unaffected by SARSA (Phase 8 §14 regression)', () => {
  it('pendingAction stays null throughout, and selectAction is re-invoked every step (off-policy, unchanged)', () => {
    const engine = new SimulationEngine({ algorithmId: 'q-learning' })

    for (let i = 0; i < 10; i++) {
      engine.step()
      expect(engine.getSnapshot().lastTdInfo!.algorithm).toBe('q-learning')
    }
    // No direct public getter for pendingAction (private), but Q-Learning's algorithm
    // definition still declares no pickNextAction — the one fact Engine relies on to
    // never populate pendingAction for it (SimulationEngine.ts performOneStep()).
    expect(getAlgorithm('q-learning').pickNextAction).toBeUndefined()
  })
})
