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
    expect(env.reset()).toBe('2,3')
    expect(env.getState()).toBe('2,3')
  })

  it('moves correctly for a normal step (right)', () => {
    const env = new GridWorldEnv(config({ start: { x: 1, y: 1 }, goal: { x: 6, y: 6 } }))
    const result = env.step(3) // right
    expect(result.nextState).toBe('2,1')
    expect(env.getState()).toBe('2,1')
  })

  it('moves correctly for all four directions', () => {
    const env = new GridWorldEnv(config({ start: { x: 3, y: 3 }, goal: { x: 6, y: 6 } }))
    expect(env.step(0).nextState).toBe('3,2') // up
    env.reset()
    expect(env.step(1).nextState).toBe('3,4') // down
    env.reset()
    expect(env.step(2).nextState).toBe('2,3') // left
    env.reset()
    expect(env.step(3).nextState).toBe('4,3') // right
  })

  it('clamps position when moving out of bounds', () => {
    const env = new GridWorldEnv(config({ start: { x: 0, y: 0 }, goal: { x: 6, y: 6 } }))
    const result = env.step(2) // left, out of bounds
    expect(result.nextState).toBe('0,0')
    expect(env.getState()).toBe('0,0')
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
    expect(result.nextState).toBe('1,1')
    expect(env.getState()).toBe('1,1')
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
    expect(result.nextState).toBe('6,6')
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
    expect(result.nextState).toBe('2,1')
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
    const env = new GridWorldEnv(config({ start: { x: 0, y: 0 }, goal: { x: 6, y: 6 } }))
    expect(env.isTerminal('6,6')).toBe(true)
    expect(env.isTerminal('0,0')).toBe(false)
  })

  // Phase 20 — Bomb: a terminal cell with its own penalty reward, same mechanics as Goal.
  describe('Bomb', () => {
    it('entering a Bomb yields bombPenalty as the reward', () => {
      const env = new GridWorldEnv(
        config({ start: { x: 0, y: 0 }, goal: { x: 6, y: 6 }, bombs: [{ x: 1, y: 0 }], bombPenalty: -25 }),
      )
      const result = env.step(3) // right, into the bomb at (1,0)
      expect(result.nextState).toBe('1,0')
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
      expect(env.isTerminal('3,3')).toBe(true)
      expect(env.isTerminal('3,4')).toBe(false)
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
      expect(first.nextState).toBe('1,0')
      expect(first.done).toBe(false)
      expect(first.reward).toBe(10)

      const second = env.step(3)
      expect(second.nextState).toBe('2,0')
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
      expect(env.step(3)).toMatchObject({ nextState: '1,0', reward: 10, done: false }) // collect A
      expect(env.step(3)).toMatchObject({ nextState: '2,0', reward: 10, done: false }) // collect B
      const revisitA = env.step(2) // left, back onto A (already collected)
      expect(revisitA.nextState).toBe('1,0')
      expect(revisitA.reward).toBe(-0.1) // no extra goalReward — behaves like a plain cell
      expect(revisitA.done).toBe(false)
      const goRight = env.step(3)
      expect(goRight.nextState).toBe('2,0')
      expect(goRight.done).toBe(false) // B already collected too — no new reward, no termination
      const collectC = env.step(3)
      expect(collectC.nextState).toBe('3,0')
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
      env.step(3) // collect the first goal at (1,0), not done yet
      const bombResult = env.step(3) // right, into the bomb at (2,0)
      expect(bombResult.nextState).toBe('2,0')
      expect(bombResult.done).toBe(true)
      expect(bombResult.reward).toBe(createDefaultGridWorldConfig().bombPenalty)
    })

    it('isTerminal() reflects the Environment\'s current per-Episode collected-goal progress', () => {
      const env = new GridWorldEnv(
        config({ width: 3, height: 1, start: { x: 0, y: 0 }, goals: [{ x: 1, y: 0 }, { x: 2, y: 0 }] }),
      )
      // Neither goal collected yet: neither is (yet) terminal.
      expect(env.isTerminal('1,0')).toBe(false)
      expect(env.isTerminal('2,0')).toBe(false)
      env.step(3) // collect goal A at (1,0)
      // A is now collected; B (the only remaining goal) is terminal, A itself is not.
      expect(env.isTerminal('2,0')).toBe(true)
      expect(env.isTerminal('1,0')).toBe(false)
      // reset() clears collected-goal progress, restoring the pre-step answers.
      env.reset()
      expect(env.isTerminal('1,0')).toBe(false)
      expect(env.isTerminal('2,0')).toBe(false)
    })

    it('getRenderModel() exposes multiple goal positions', () => {
      const env = new GridWorldEnv(config({ goals: [{ x: 1, y: 1 }, { x: 4, y: 4 }] }))
      expect(env.getRenderModel().goals.sort()).toEqual(['1,1', '4,4'])
    })
  })
})
