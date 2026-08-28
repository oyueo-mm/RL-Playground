import { describe, expect, it } from 'vitest'
import { GridWorldEnv, createDefaultGridWorldConfig } from './GridWorldEnv'
import type { GridWorldConfig } from './types'

function config(overrides: Partial<GridWorldConfig> = {}): GridWorldConfig {
  return { ...createDefaultGridWorldConfig(), ...overrides }
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
      start: '0,0',
      goal: '4,3',
      agentPos: '1,0',
    })
  })

  it('isTerminal() is a pure query independent of step()', () => {
    const env = new GridWorldEnv(config({ start: { x: 0, y: 0 }, goal: { x: 6, y: 6 } }))
    expect(env.isTerminal('6,6')).toBe(true)
    expect(env.isTerminal('0,0')).toBe(false)
  })
})
