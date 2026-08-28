import { describe, expect, it } from 'vitest'
import { createEnvironment, getEnvironmentDefinition, listEnvironmentDefinitions } from './registry'
import { GridWorldEnv } from './gridworld/GridWorldEnv'

describe('environment registry', () => {
  it('creates a GridWorld instance for id "gridworld"', () => {
    const env = createEnvironment('gridworld')
    expect(env).toBeInstanceOf(GridWorldEnv)
    expect(env.getActionSpace()).toBe(4)
  })

  it('creates GridWorld with a custom config when provided', () => {
    const env = createEnvironment('gridworld', {
      width: 3,
      height: 3,
      start: { x: 0, y: 0 },
      goal: { x: 2, y: 2 },
      walls: [],
      stepReward: -0.1,
      goalReward: 10,
      terminalCells: [],
    })
    expect(env.getState()).toBe('0,0')
    expect(env.getRenderModel()).toMatchObject({ width: 3, height: 3, goal: '2,2' })
  })

  it('looks up the GridWorld EnvironmentDefinition by id', () => {
    const definition = getEnvironmentDefinition('gridworld')
    expect(definition.id).toBe('gridworld')
    expect(typeof definition.create).toBe('function')
    expect(typeof definition.createDefaultConfig).toBe('function')
  })

  it('lists registered environment definitions', () => {
    const definitions = listEnvironmentDefinitions()
    expect(definitions.map((d) => d.id)).toContain('gridworld')
  })

  it('throws a clear error for an unknown environment id', () => {
    expect(() => createEnvironment('does-not-exist')).toThrow(/does-not-exist/)
    expect(() => getEnvironmentDefinition('does-not-exist')).toThrow(/does-not-exist/)
  })
})
