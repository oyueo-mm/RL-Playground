import { describe, expect, it } from 'vitest'
import { createDefaultGridWorldConfig, GridWorldEnv } from './GridWorldEnv'
import { TabularQAgent } from '../../agents/TabularQAgent'
import { draftFromRenderModel, draftToGridWorldConfig } from '../../../viz/controls/envEditorDraft'
import { parseEnvImport, serializeEnvExport } from '../../../viz/controls/envEditorIO'

const config = { ...createDefaultGridWorldConfig(), width: 3, height: 3, start: { x: 0, y: 1 }, goals: [{ x: 2, y: 2 }], walls: [{ x: 1, y: 0 }], wallPenalty: -2, fragiles: [{ x: 1, y: 1 }] }
describe('Fragile tiles and Markov state', () => {
  it('is ordinary on entry and does not collapse on a blocked action', () => {
    const env = new GridWorldEnv(config)
    expect(env.step(3).nextState).toBe('1,1,0,0,0')
    expect(env.step(0)).toEqual({ nextState: '1,1,0,0,0', reward: -2, done: false })
    expect(env.getRenderModel().collapsedFragiles).toEqual([])
  })
  it('collapses only after successful departure and blocks re-entry', () => {
    const env = new GridWorldEnv(config)
    env.step(3)
    expect(env.step(3).nextState).toBe('2,1,0,1,0')
    expect(env.step(2)).toEqual({ nextState: '2,1,0,1,0', reward: -2, done: false })
    expect(env.getRenderModel().walls).toContain('1,1')
    expect(env.getRenderModel().staticWalls).not.toContain('1,1')
  })
  it('restores tiles and the initial state for the next episode', () => {
    const env = new GridWorldEnv(config)
    env.step(3); env.step(3)
    expect(env.step(1).done).toBe(true)
    expect(env.reset()).toBe('0,1,0,0,0')
    expect(env.getRenderModel().collapsedFragiles).toEqual([])
    expect(env.step(3).reward).toBe(-.1)
  })
  it('distinguishes identical positions with different future dynamics and Q rows', () => {
    const collapsed = new GridWorldEnv(config)
    collapsed.step(3); collapsed.step(3)
    const intact = new GridWorldEnv(config)
    intact.step(1); intact.step(3); intact.step(3); intact.step(0)
    const a = collapsed.getState(), b = intact.getState()
    expect(a.split(',').slice(0, 2)).toEqual(b.split(',').slice(0, 2))
    expect(a).not.toBe(b)
    const agent = new TabularQAgent(4)
    agent.getQVector(a); agent.getQVector(b)
    if (agent.toSnapshot().kind === 'Q') expect(Object.keys((agent.toSnapshot() as { qTable: object }).qTable)).toHaveLength(2)
    expect(collapsed.step(2).reward).toBe(-2)
    expect(intact.step(2).reward).toBe(-.1)
  })
  it('exports initial fragile configuration, never episode collapse progress', () => {
    const env = new GridWorldEnv(config)
    env.step(3); env.step(3)
    const file = serializeEnvExport(draftFromRenderModel(env.getRenderModel()))
    expect(file).not.toContain('collapsed')
    const parsed = parseEnvImport(file)
    if (!parsed.ok) throw new Error(parsed.error)
    const restored = new GridWorldEnv(draftToGridWorldConfig(parsed.draft))
    expect(restored.getRenderModel().collapsedFragiles).toEqual([])
    expect(restored.getConfig()).toMatchObject({ walls: config.walls, fragiles: config.fragiles })
  })
})
