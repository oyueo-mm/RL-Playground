import { describe, expect, it } from 'vitest'
import { GridWorldEnv, createDefaultGridWorldConfig } from './GridWorldEnv'
import type { GridWorldConfig, Position } from './types'

// Accepts the legacy singular `goal: Position` shape (as ~all pre-Phase-30 fixtures in
// this file already use) alongside the current `goals: Position[]` shape — so existing
// fixture lines below did not need to change for the Phase 30 goals: Position[] migration.
function config(overrides: Partial<GridWorldConfig> & { goal?: Position } = {}): GridWorldConfig {
  const base = createDefaultGridWorldConfig()
  const goals = overrides.goal ? [overrides.goal] : (overrides.goals ?? base.goals)
  const wallPenalty = overrides.wallPenalty ?? overrides.stepReward ?? base.wallPenalty
  return { ...base, ...overrides, goals, wallPenalty }
}

describe('GridWorldEnv', () => {
  it('reset() returns to the configured start position', () => {
    const env = new GridWorldEnv(config({ start: { x: 2, y: 3 } }))
    env.step(3) // move away from start
    // Phase 34: State is now "x,y,mask" — reset() also clears collectedGoals, so the
    // mask segment is always "0" right after reset(), regardless of what was collected
    // before it.
    expect(env.reset()).toBe('2,3,0')
    expect(env.getState()).toBe('2,3,0')
  })

  it('moves correctly for a normal step (right)', () => {
    const env = new GridWorldEnv(config({ start: { x: 1, y: 1 }, goal: { x: 6, y: 6 } }))
    const result = env.step(3) // right
    expect(result.nextState).toBe('2,1,0') // not a Goal cell -> mask unchanged (0)
    expect(env.getState()).toBe('2,1,0')
  })

  it('moves correctly for all four directions', () => {
    const env = new GridWorldEnv(config({ start: { x: 3, y: 3 }, goal: { x: 6, y: 6 } }))
    expect(env.step(0).nextState).toBe('3,2,0') // up
    env.reset()
    expect(env.step(1).nextState).toBe('3,4,0') // down
    env.reset()
    expect(env.step(2).nextState).toBe('2,3,0') // left
    env.reset()
    expect(env.step(3).nextState).toBe('4,3,0') // right
  })

  it('clamps position when moving out of bounds', () => {
    const env = new GridWorldEnv(config({ start: { x: 0, y: 0 }, goal: { x: 6, y: 6 } }))
    const result = env.step(2) // left, out of bounds
    expect(result.nextState).toBe('0,0,0')
    expect(env.getState()).toBe('0,0,0')
  })

  it('applies stepReward when moving out of bounds', () => {
    const env = new GridWorldEnv(
      config({ start: { x: 0, y: 0 }, goal: { x: 6, y: 6 }, stepReward: -0.1 }),
    )
    const result = env.step(0) // up, out of bounds
    expect(result.reward).toBe(-0.1)
    expect(result.done).toBe(false)
  })

  it('does not move into a wall', () => {
    const env = new GridWorldEnv(
      config({ start: { x: 1, y: 1 }, goal: { x: 6, y: 6 }, walls: [{ x: 2, y: 1 }] }),
    )
    const result = env.step(3) // right, into wall
    expect(result.nextState).toBe('1,1,0')
    expect(env.getState()).toBe('1,1,0')
  })

  it('applies stepReward when blocked by a wall', () => {
    const env = new GridWorldEnv(
      config({
        start: { x: 1, y: 1 },
        goal: { x: 6, y: 6 },
        walls: [{ x: 2, y: 1 }],
        stepReward: -0.1,
      }),
    )
    const result = env.step(3)
    expect(result.reward).toBe(-0.1)
    expect(result.done).toBe(false)
  })

  it('grants goalReward on reaching the goal', () => {
    const env = new GridWorldEnv(
      config({ start: { x: 5, y: 6 }, goal: { x: 6, y: 6 }, goalReward: 10 }),
    )
    const result = env.step(3) // right, into goal
    expect(result.nextState).toBe('6,6,1') // the single Goal (index 0) is now collected
    expect(result.reward).toBe(10)
  })

  it('done is true when the goal (terminal) is reached', () => {
    const env = new GridWorldEnv(config({ start: { x: 5, y: 6 }, goal: { x: 6, y: 6 } }))
    const result = env.step(3)
    expect(result.done).toBe(true)
  })

  it('honors extra terminalCells beyond goal', () => {
    const env = new GridWorldEnv(
      config({
        start: { x: 1, y: 1 },
        goal: { x: 6, y: 6 },
        terminalCells: [{ x: 2, y: 1 }],
      }),
    )
    const result = env.step(3) // right, into terminal cell
    expect(result.nextState).toBe('2,1,0') // not a Goal cell -> mask unchanged (0)
    expect(result.done).toBe(true)
  })

  it('invariant: step(action).done === isTerminal(nextState), across boundary/wall/goal/plain moves', () => {
    const env = new GridWorldEnv(
      config({
        start: { x: 1, y: 1 },
        goal: { x: 6, y: 6 },
        walls: [{ x: 2, y: 1 }],
      }),
    )
    for (const action of [0, 1, 2, 3]) {
      env.reset()
      const result = env.step(action)
      expect(result.done).toBe(env.isTerminal(result.nextState))
    }
    // also check the boundary case explicitly
    const boundaryEnv = new GridWorldEnv(config({ start: { x: 0, y: 0 }, goal: { x: 6, y: 6 } }))
    const boundaryResult = boundaryEnv.step(2)
    expect(boundaryResult.done).toBe(boundaryEnv.isTerminal(boundaryResult.nextState))
  })

  it('getActionSpace() returns 4', () => {
    const env = new GridWorldEnv(config())
    expect(env.getActionSpace()).toBe(4)
  })

  it('getRenderModel() exposes grid size, walls, start, goal, and agent position', () => {
    const env = new GridWorldEnv(
      config({
        width: 5,
        height: 4,
        start: { x: 0, y: 0 },
        goal: { x: 4, y: 3 },
        walls: [{ x: 1, y: 1 }, { x: 2, y: 2 }],
      }),
    )
    env.step(3) // move agent so agentPos differs from start

    const model = env.getRenderModel()
    expect(model).toEqual({
      kind: 'grid',
      width: 5,
      height: 4,
      walls: ['1,1', '2,2'],
      bombs: [],
      bombPenalty: -10,
      stepReward: -0.1,
      wallPenalty: -0.1,
      goalReward: 10,
      start: '0,0',
      goals: ['4,3'],
      agentPos: '1,0',
    })
  })

  it('isTerminal() is a pure query independent of step()', () => {
    // Phase 34: `state` is now "x,y,mask" — isTerminal() reads the mask directly from the
    // input string rather than any live instance field, so it never needs step() to have
    // run first (still true), and now ALSO never needs this instance's own collectedGoals
    // (the query is self-contained purely from the string passed in).
    const env = new GridWorldEnv(config({ start: { x: 0, y: 0 }, goal: { x: 6, y: 6 } }))
    expect(env.isTerminal('6,6,1')).toBe(true) // the Goal cell, with its bit set (fully collected)
    expect(env.isTerminal('6,6,0')).toBe(false) // same Goal cell, but not (yet) collected
    expect(env.isTerminal('0,0,0')).toBe(false) // not a Goal cell at all
  })

  // Phase 20 — Bomb: a terminal cell with its own penalty reward, same mechanics as Goal.
  describe('Bomb', () => {
    it('entering a Bomb yields bombPenalty as the reward', () => {
      const env = new GridWorldEnv(
        config({ start: { x: 0, y: 0 }, goal: { x: 6, y: 6 }, bombs: [{ x: 1, y: 0 }], bombPenalty: -25 }),
      )
      const result = env.step(3) // right, into the bomb at (1,0)
      expect(result.nextState).toBe('1,0,0') // Bomb, not a Goal -> mask unchanged (0)
      expect(result.reward).toBe(-25)
    })

    it('entering a Bomb sets done=true', () => {
      const env = new GridWorldEnv(
        config({ start: { x: 0, y: 0 }, goal: { x: 6, y: 6 }, bombs: [{ x: 1, y: 0 }] }),
      )
      const result = env.step(3)
      expect(result.done).toBe(true)
      expect(env.isTerminal(result.nextState)).toBe(true)
    })

    it('a Bomb cell is reported terminal by isTerminal() as a pure query, independent of step()', () => {
      const env = new GridWorldEnv(config({ bombs: [{ x: 3, y: 3 }] }))
      // Bomb-ness is decided purely by position — the mask segment is irrelevant, so any
      // value there (including "0") still correctly reports a Bomb cell as terminal.
      expect(env.isTerminal('3,3,0')).toBe(true)
      expect(env.isTerminal('3,4,0')).toBe(false)
    })

    it('getRenderModel() exposes bomb positions and the configured penalty', () => {
      const env = new GridWorldEnv(config({ bombs: [{ x: 2, y: 1 }, { x: 4, y: 4 }], bombPenalty: -7 }))
      const model = env.getRenderModel()
      expect(model.bombs.sort()).toEqual(['2,1', '4,4'])
      expect(model.bombPenalty).toBe(-7)
    })

    it('does not treat a non-bomb, non-wall, non-goal cell as terminal', () => {
      const env = new GridWorldEnv(
        config({ start: { x: 0, y: 0 }, goal: { x: 6, y: 6 }, bombs: [{ x: 1, y: 0 }] }),
      )
      const result = env.step(1) // down, into (0,1) — an ordinary cell
      expect(result.done).toBe(false)
      expect(result.reward).toBe(createDefaultGridWorldConfig().stepReward)
    })
  })

  // Phase 30 §4 — Wall Penalty: independent of stepReward (previously wall/boundary
  // collisions silently reused stepReward — confirmed by reading GridWorldEnv.ts before
  // this Phase's implementation).
  describe('Wall Penalty', () => {
    it('applies wallPenalty (not stepReward) when blocked by a wall, when the two differ', () => {
      const env = new GridWorldEnv(
        config({
          start: { x: 1, y: 1 },
          goal: { x: 6, y: 6 },
          walls: [{ x: 2, y: 1 }],
          stepReward: -0.1,
          wallPenalty: -1.0,
        }),
      )
      const result = env.step(3) // right, into wall
      expect(result.reward).toBe(-1.0)
      expect(result.done).toBe(false)
    })

    it('applies wallPenalty (not stepReward) for an out-of-bounds attempt, when the two differ', () => {
      const env = new GridWorldEnv(
        config({ start: { x: 0, y: 0 }, goal: { x: 6, y: 6 }, stepReward: -0.1, wallPenalty: -1.0 }),
      )
      const result = env.step(0) // up, out of bounds
      expect(result.reward).toBe(-1.0)
    })

    it('leaves stepReward on ordinary cells unaffected by a different wallPenalty', () => {
      const env = new GridWorldEnv(
        config({ start: { x: 0, y: 0 }, goal: { x: 6, y: 6 }, stepReward: -0.1, wallPenalty: -1.0 }),
      )
      const result = env.step(1) // down, into an ordinary cell
      expect(result.reward).toBe(-0.1)
    })
  })

  // Phase 30 §6-§10 — Multiple Goals: Episode ends only once every Goal has been visited
  // at least once, or a Bomb is reached. goalReward is paid once per distinct Goal.
  describe('Multiple Goals', () => {
    it('works with exactly 1 goal (unchanged single-goal behavior)', () => {
      const env = new GridWorldEnv(config({ start: { x: 5, y: 6 }, goals: [{ x: 6, y: 6 }] }))
      const result = env.step(3)
      expect(result.done).toBe(true)
      expect(result.reward).toBe(10)
    })

    it('works with 2 goals: visiting the first does not end the episode, visiting the second does', () => {
      // Corridor: Start(0,0) -> right -> (1,0)=Goal A -> right -> (2,0)=Goal B
      const env = new GridWorldEnv(
        config({ width: 3, height: 1, start: { x: 0, y: 0 }, goals: [{ x: 1, y: 0 }, { x: 2, y: 0 }] }),
      )
      const first = env.step(3)
      expect(first.nextState).toBe('1,0,1') // Goal A (index 0) collected -> bit 0 set
      expect(first.done).toBe(false)
      expect(first.reward).toBe(10)

      const second = env.step(3)
      expect(second.nextState).toBe('2,0,3') // Goal B (index 1) too -> bits 0+1 = 3
      expect(second.done).toBe(true)
      expect(second.reward).toBe(10)
    })

    it('works with 3 goals: partial collection (1 or 2 of 3) never ends the episode', () => {
      const env = new GridWorldEnv(
        config({
          width: 4,
          height: 1,
          start: { x: 0, y: 0 },
          goals: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }],
        }),
      )
      expect(env.step(3).done).toBe(false) // 1 of 3
      expect(env.step(3).done).toBe(false) // 2 of 3
      const last = env.step(3)
      expect(last.done).toBe(true) // 3 of 3
    })

    it('revisiting an already-collected goal does not end the episode and pays no extra goalReward', () => {
      // Path Start(0,0) -> A(1,0) -> B(2,0) -> back to A(1,0) -> C(3,0), same as Phase 30 §9's example.
      const env = new GridWorldEnv(
        config({
          width: 4,
          height: 1,
          start: { x: 0, y: 0 },
          goals: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }],
          stepReward: -0.1,
          goalReward: 10,
        }),
      )
      // goals = [(1,0)=A index0 bit1, (2,0)=B index1 bit2, (3,0)=C index2 bit4]; fullMask=7.
      expect(env.step(3)).toMatchObject({ nextState: '1,0,1', reward: 10, done: false }) // collect A
      expect(env.step(3)).toMatchObject({ nextState: '2,0,3', reward: 10, done: false }) // collect B
      const revisitA = env.step(2) // left, back onto A (already collected)
      expect(revisitA.nextState).toBe('1,0,3') // mask unchanged — A was already counted
      expect(revisitA.reward).toBe(-0.1) // no extra goalReward — behaves like a plain cell
      expect(revisitA.done).toBe(false)
      const goRight = env.step(3)
      expect(goRight.nextState).toBe('2,0,3') // mask unchanged — B was already counted
      expect(goRight.done).toBe(false) // B already collected too — no new reward, no termination
      const collectC = env.step(3)
      expect(collectC.nextState).toBe('3,0,7') // all 3 bits set now
      expect(collectC.reward).toBe(10)
      expect(collectC.done).toBe(true) // all 3 now collected
    })

    it('reaching a Bomb while Goals remain uncollected ends the episode immediately (bomb wins)', () => {
      const env = new GridWorldEnv(
        config({
          width: 4,
          height: 1,
          start: { x: 0, y: 0 },
          goals: [{ x: 1, y: 0 }, { x: 3, y: 0 }],
          bombs: [{ x: 2, y: 0 }],
        }),
      )
      env.step(3) // collect the first goal at (1,0), not done yet — mask becomes 1
      const bombResult = env.step(3) // right, into the bomb at (2,0)
      expect(bombResult.nextState).toBe('2,0,1') // Bomb doesn't touch the Goal mask
      expect(bombResult.done).toBe(true)
      expect(bombResult.reward).toBe(createDefaultGridWorldConfig().bombPenalty)
    })

    // Phase 34: isTerminal() no longer reads this instance's live collectedGoals at all —
    // the mask must be supplied by the caller as part of `state` itself. This test now
    // demonstrates that directly, and separately confirms getState()'s own mask matches
    // what actually happened via step().
    it("isTerminal()'s answer is driven entirely by the mask encoded in the query string", () => {
      const env = new GridWorldEnv(
        config({ width: 3, height: 1, start: { x: 0, y: 0 }, goals: [{ x: 1, y: 0 }, { x: 2, y: 0 }] }),
      )
      // A Goal position queried with an incomplete mask is never terminal...
      expect(env.isTerminal('1,0,0')).toBe(false)
      expect(env.isTerminal('2,0,0')).toBe(false)
      // ...but IS terminal once the query's own mask says every Goal is collected —
      // regardless of what this instance's actual collectedGoals currently holds (it is
      // still empty at this point; step() has not been called yet).
      expect(env.isTerminal('1,0,3')).toBe(true)
      expect(env.isTerminal('2,0,3')).toBe(true)

      env.step(3) // (0,0) -> (1,0): actually collects Goal A (index 0)
      expect(env.getState()).toBe('1,0,1')
      expect(env.isTerminal(env.getState())).toBe(false) // only Goal A collected so far

      // reset() clears collectedGoals, so a freshly-reset getState() is back to mask 0.
      env.reset()
      expect(env.getState()).toBe('0,0,0')
    })

    it('getRenderModel() exposes multiple goal positions', () => {
      const env = new GridWorldEnv(config({ goals: [{ x: 1, y: 1 }, { x: 4, y: 4 }] }))
      expect(env.getRenderModel().goals.sort()).toEqual(['1,1', '4,4'])
    })
  })

  // Phase 32 — a collected Goal disappears from the Grid (EnvRenderModel.goals) for the
  // rest of the Episode, without ever mutating the static GridWorldConfig.goals itself.
  describe('Goal removal from render model (Phase 32)', () => {
    it('a collected Goal is removed from getRenderModel().goals immediately after collection', () => {
      const env = new GridWorldEnv(
        config({ width: 3, height: 1, start: { x: 0, y: 0 }, goals: [{ x: 1, y: 0 }, { x: 2, y: 0 }] }),
      )
      expect(env.getRenderModel().goals.sort()).toEqual(['1,0', '2,0'])
      env.step(3) // collect the goal at (1,0)
      expect(env.getRenderModel().goals).toEqual(['2,0'])
    })

    it('the last Goal is removed too, right before the Episode ends', () => {
      const env = new GridWorldEnv(config({ start: { x: 5, y: 6 }, goals: [{ x: 6, y: 6 }] }))
      const result = env.step(3)
      expect(result.done).toBe(true)
      expect(env.getRenderModel().goals).toEqual([])
    })

    it('does not mutate GridWorldConfig.goals when a Goal is collected', () => {
      const goals = [{ x: 1, y: 0 }, { x: 2, y: 0 }]
      const cfg = config({ width: 3, height: 1, start: { x: 0, y: 0 }, goals })
      const env = new GridWorldEnv(cfg)
      env.step(3) // collect (1,0)
      // The config object passed in (and its goals array) must be untouched — only the
      // Environment's own internal collectedGoals (runtime state) changes.
      expect(cfg.goals).toEqual([{ x: 1, y: 0 }, { x: 2, y: 0 }])
      expect(cfg.goals).toHaveLength(2)
    })

    it('reset() restores every Goal to getRenderModel().goals', () => {
      const env = new GridWorldEnv(
        config({ width: 3, height: 1, start: { x: 0, y: 0 }, goals: [{ x: 1, y: 0 }, { x: 2, y: 0 }] }),
      )
      env.step(3) // collect (1,0)
      expect(env.getRenderModel().goals).toEqual(['2,0'])
      env.reset()
      expect(env.getRenderModel().goals.sort()).toEqual(['1,0', '2,0'])
    })

    it('a revisited, already-collected Goal cell stays absent from getRenderModel().goals (not re-added)', () => {
      const env = new GridWorldEnv(
        config({ width: 3, height: 1, start: { x: 0, y: 0 }, goals: [{ x: 1, y: 0 }, { x: 2, y: 0 }] }),
      )
      env.step(3) // collect (1,0)
      env.step(2) // move back left onto the collected (1,0)
      expect(env.getRenderModel().goals).toEqual(['2,0'])
    })

    it('Goal removal works normally alongside a Bomb that remains on the Grid', () => {
      const env = new GridWorldEnv(
        config({
          width: 4,
          height: 1,
          start: { x: 0, y: 0 },
          goals: [{ x: 1, y: 0 }, { x: 3, y: 0 }],
          bombs: [{ x: 2, y: 0 }],
        }),
      )
      env.step(3) // collect goal at (1,0)
      const model = env.getRenderModel()
      expect(model.goals).toEqual(['3,0']) // remaining goal still visible
      expect(model.bombs).toEqual(['2,0']) // bomb unaffected by goal collection
    })
  })

  // Phase 34 — State Representation (Markov) fix: State = "x,y,mask". These tests map
  // directly onto Phase 34's required Test 1-4/9 list.
  describe('State Representation (Phase 34)', () => {
    // Test 1 — Initial State Mask.
    it('a new Episode always starts with mask 0, regardless of what was collected before', () => {
      const env = new GridWorldEnv(
        config({ width: 3, height: 1, start: { x: 0, y: 0 }, goals: [{ x: 1, y: 0 }, { x: 2, y: 0 }] }),
      )
      expect(env.getState()).toBe('0,0,0')
      env.step(3) // collect Goal A
      env.step(3) // collect Goal B
      expect(env.reset()).toBe('0,0,0') // fresh Episode -> mask cleared
      expect(env.getState()).toBe('0,0,0')
    })

    // Test 2 — Goal Collection Changes State.
    it('collecting a Goal changes the State (before !== after)', () => {
      const env = new GridWorldEnv(
        config({ width: 3, height: 1, start: { x: 0, y: 0 }, goals: [{ x: 1, y: 0 }] }),
      )
      const before = env.getState()
      env.step(3) // (0,0) -> (1,0), collects the Goal
      const after = env.getState()
      expect(before).not.toBe(after)
      expect(before).toBe('0,0,0')
      expect(after).toBe('1,0,1')
    })

    // Test 3 — Same Position, Different Goal State.
    it('revisiting the same position with different collectedGoals produces a different StateKey', () => {
      const env = new GridWorldEnv(
        config({ width: 3, height: 1, start: { x: 0, y: 0 }, goals: [{ x: 1, y: 0 }, { x: 2, y: 0 }] }),
      )
      env.step(3) // (0,0) -> (1,0): collect Goal A, mask=1
      const stateKeyA = env.getState()
      env.step(3) // (1,0) -> (2,0): collect Goal B, mask=3
      env.step(2) // (2,0) -> (1,0): revisit position (1,0) again, now with both collected
      const stateKeyB = env.getState()

      const samePosition = stateKeyA.split(',').slice(0, 2).join(',') === stateKeyB.split(',').slice(0, 2).join(',')
      expect(samePosition).toBe(true)
      expect(stateKeyA).not.toBe(stateKeyB)
      expect(stateKeyA).toBe('1,0,1')
      expect(stateKeyB).toBe('1,0,3')
    })

    // Test 4 — Same State + Action Aliasing Regression (the exact Phase 33 counterexample,
    // now fixed: reproduces the scenario from Phase 33's audit and proves the two
    // occurrences of "state before stepping Right from (1,0)" are no longer the same key).
    it('the Phase 33 aliasing counterexample no longer aliases: same coordinate + same action + different reward now also means different StateKey', () => {
      const env = new GridWorldEnv(
        config({
          width: 4,
          height: 1,
          start: { x: 0, y: 0 },
          goals: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }],
          stepReward: -0.1,
          goalReward: 10,
        }),
      )
      env.step(3) // (0,0) -> (1,0): collect Goal A
      const stateBeforeFirstRight = env.getState() // "1,0,1"
      const firstRight = env.step(3) // (1,0) -> (2,0): collect Goal B, reward = goalReward

      env.step(2) // (2,0) -> (1,0): revisit A (already collected)
      const stateBeforeSecondRight = env.getState() // "1,0,3"
      const secondRight = env.step(3) // (1,0) -> (2,0): revisit B (already collected), reward = stepReward

      const samePosition =
        stateBeforeFirstRight.split(',').slice(0, 2).join(',') ===
        stateBeforeSecondRight.split(',').slice(0, 2).join(',')
      const sameAction = true // both are action 3 (Right)

      expect(samePosition).toBe(true)
      expect(sameAction).toBe(true)
      expect(firstRight.reward).not.toBe(secondRight.reward) // 10 vs -0.1 — different Reward
      expect(stateBeforeFirstRight).not.toBe(stateBeforeSecondRight) // different StateKey — no more aliasing
      expect(stateBeforeFirstRight).toBe('1,0,1')
      expect(stateBeforeSecondRight).toBe('1,0,3')
    })

    // Test 9 — Final Goal: collecting the last remaining Goal removes it from the Grid,
    // sets the State's mask to "all collected", pays goalReward, and ends the Episode.
    it('collecting the final Goal removes it from the Grid, completes the mask, and ends the Episode as a Goal termination', () => {
      const env = new GridWorldEnv(
        config({
          width: 3,
          height: 1,
          start: { x: 0, y: 0 },
          goals: [{ x: 1, y: 0 }, { x: 2, y: 0 }],
          goalReward: 10,
        }),
      )
      env.step(3) // collect Goal A -> mask 1, not done
      const result = env.step(3) // collect Goal B (the final one) -> mask 3 (full), done

      expect(result.nextState).toBe('2,0,3')
      expect(result.reward).toBe(10)
      expect(result.done).toBe(true)
      expect(env.getRenderModel().goals).toEqual([]) // both Goals gone from the Grid
      expect(env.isTerminal(result.nextState)).toBe(true)
    })
  })
})
