import { describe, expect, it } from 'vitest'
import { createDefaultGridWorldConfig, GridWorldEnv } from './GridWorldEnv'
import { stateSpaceEstimate, STATE_SPACE_WARNING, validateFeatures } from './features'
import { parseEnvImport, serializeEnvExport } from '../../../viz/controls/envEditorIO'
import { draftFromRenderModel } from '../../../viz/controls/envEditorDraft'

const config = { ...createDefaultGridWorldConfig(), width: 4, height: 4, start: { x: 0, y: 1 }, goals: [{ x: 3, y: 3 }], switches: [{ x: 1, y: 1, groupId: 'A' }], toggleWalls: [{ x: 2, y: 1, groupId: 'A' }], wallPenalty: -2 }
describe('Switches and toggle walls', () => {
  it('starts closed, opens on switch entry and allows crossing', () => {
    const env = new GridWorldEnv(config)
    expect(env.getRenderModel().walls).toContain('2,1')
    expect(env.step(3).nextState).toBe('1,1,0,0,1')
    expect(env.getRenderModel().walls).not.toContain('2,1')
    expect(env.step(3).nextState).toBe('2,1,0,0,1')
  })
  it('does not toggle on collisions but toggles again on re-entry', () => {
    const env = new GridWorldEnv({ ...config, walls: [{ x: 1, y: 0 }] })
    env.step(3)
    expect(env.step(0).nextState).toBe('1,1,0,0,1')
    env.step(2); env.step(3)
    expect(env.getRenderModel().openGroups).toEqual([])
    expect(env.step(3)).toEqual({ nextState: '1,1,0,0,0', reward: -2, done: false })
  })
  it('maintains independent groups and multiple walls/switches per group', () => {
    const env = new GridWorldEnv({ ...config, switches: [...config.switches, { x: 0, y: 0, groupId: 'B' }, { x: 2, y: 0, groupId: 'A' }], toggleWalls: [...config.toggleWalls, { x: 3, y: 1, groupId: 'A' }, { x: 0, y: 2, groupId: 'B' }] })
    env.step(3)
    expect(env.getRenderModel().openGroups).toEqual(['A'])
    expect(env.getRenderModel().walls).not.toContain('3,1')
    expect(env.getRenderModel().walls).toContain('0,2')
    env.step(2); env.step(0)
    expect(new Set(env.getRenderModel().openGroups)).toEqual(new Set(['A', 'B']))
    env.reset()
    expect(env.getRenderModel().openGroups).toEqual([])
  })
  it('rejects orphan groups and overlap that could close a wall on the agent', () => {
    expect(() => new GridWorldEnv({ ...config, switches: [] })).toThrow('group')
    expect(() => new GridWorldEnv({ ...config, toggleWalls: [{ x: 1, y: 1, groupId: 'A' }] })).toThrow('Overlapping')
  })
  it('accounts for goals, fragile bits and group bits together without restricting legacy maps', () => {
    expect(stateSpaceEstimate({ ...config, fragiles: [{ x: 2, y: 2 }] })).toBe(16 * 2 ** 3)
    const huge = { ...createDefaultGridWorldConfig(), fragiles: Array.from({ length: 15 }, (_, i) => ({ x: i % 7, y: Math.floor(i / 7) + 1 })) }
    expect(stateSpaceEstimate(huge)).toBeGreaterThan(STATE_SPACE_WARNING)
    expect(validateFeatures(huge)).toEqual([])
    expect(validateFeatures({ ...createDefaultGridWorldConfig(), goals: Array.from({ length: 35 }, (_, i) => ({ x: i % 7, y: Math.floor(i / 7) })) })).toEqual([])
  })
  it('round-trips group IDs and resets episode state', () => {
    const env = new GridWorldEnv(config); env.step(3)
    const parsed = parseEnvImport(serializeEnvExport(draftFromRenderModel(env.getRenderModel())))
    if (!parsed.ok) throw new Error(parsed.error)
    expect(parsed.draft.switches).toEqual(config.switches)
    expect(parsed.draft.toggleWalls).toEqual(config.toggleWalls)
  })
})
