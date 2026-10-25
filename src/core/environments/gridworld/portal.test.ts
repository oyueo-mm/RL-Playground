import { describe, expect, it } from 'vitest'
import { createDefaultGridWorldConfig, GridWorldEnv } from './GridWorldEnv'
import { draftFromRenderModel, draftToGridWorldConfig, validateDraft } from '../../../viz/controls/envEditorDraft'
import { parseEnvImport, serializeEnvExport } from '../../../viz/controls/envEditorIO'

const config = { ...createDefaultGridWorldConfig(), width: 3, height: 3, start: { x: 0, y: 1 }, goals: [{ x: 2, y: 2 }], portals: [{ id: 'P1', ends: [{ x: 1, y: 1 }, { x: 2, y: 0 }] }] }
describe('Portal', () => {
  it('teleports once in one action and pays only one movement reward', () => {
    const env = new GridWorldEnv(config)
    expect(env.step(3)).toEqual({ nextState: '2,0,0', reward: -.1, done: false })
    expect(env.getRenderModel().agentPos).toBe('2,0')
  })
  it('works in the other direction without immediately ping-ponging', () => {
    const env = new GridWorldEnv(config)
    env.step(3); env.step(1)
    expect(env.step(0).nextState).toBe('1,1,0')
  })
  it.each([
    [{ id: 'P1', ends: [{ x: 1, y: 1 }] }],
    [{ id: 'P1', ends: [{ x: 1, y: 1 }, { x: 3, y: 1 }] }],
    [{ id: 'P1', ends: [{ x: 1, y: 1 }, { x: 1, y: 1 }] }],
    [{ id: 'P1', ends: [{ x: 1, y: 1 }, { x: 2, y: 2 }] }],
    [{ id: '', ends: [{ x: 1, y: 1 }, { x: 2, y: 0 }] }],
  ])('rejects incomplete, out-of-bounds, overlapping or invalid pairs (%j)', portals => { expect(() => new GridWorldEnv({ ...config, portals })).toThrow() })
  it('rejects duplicate pair IDs', () => {
    expect(() => new GridWorldEnv({ ...config, portals: [...config.portals, { id: 'P1', ends: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }] })).toThrow('unique')
  })
  it('round-trips through draft, rendering and JSON v2', () => {
    const draft = draftFromRenderModel(new GridWorldEnv(config).getRenderModel())
    expect(validateDraft(draft)).toEqual([])
    const parsed = parseEnvImport(serializeEnvExport(draft))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(draftToGridWorldConfig(parsed.draft).portals).toEqual(config.portals)
  })
})
