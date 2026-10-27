import { describe, expect, it } from 'vitest'
import { createDefaultGridWorldConfig, GridWorldEnv, normalizeGridWorldConfig } from './GridWorldEnv'
import type { GridWorldConfig } from './types'
import { validateFeatures } from './features'
import { parseEnvImport, serializeEnvExport, draftToExportFile } from '../../../viz/controls/envEditorIO'
import { draftFromRenderModel, draftToGridWorldConfig, draftToRenderModel, validateDraft } from '../../../viz/controls/envEditorDraft'
import { ENVIRONMENT_PRESETS } from '../../../data/presets/manifest'
import { SimulationEngine } from '../../engine/SimulationEngine'

const base = (): GridWorldConfig => ({ ...createDefaultGridWorldConfig(), width: 5, height: 1, start: { x: 0, y: 0 }, walls: [], stepReward: -0.1, wallPenalty: -1, goalReward: 10, bombPenalty: -10 })

describe('V4 per-element goal rewards and bomb penalties', () => {
  it('pays each goal its own reward once and inherits goalReward when unset', () => {
    const env = new GridWorldEnv({ ...base(), goals: [{ x: 1, y: 0, reward: 50 }, { x: 2, y: 0 }, { x: 4, y: 0, reward: 100 }] })
    expect(env.step(3).reward).toBe(50)
    expect(env.step(3).reward).toBe(10)
    expect(env.step(2).reward).toBe(-0.1) // revisiting a collected goal pays nothing extra
    expect(env.step(3).reward).toBe(-0.1)
    expect(env.step(3).reward).toBe(-0.1)
    expect(env.step(3)).toMatchObject({ reward: 100, done: true })
    env.reset()
    expect(env.step(3).reward).toBe(50) // a new Episode can collect it again
  })
  it('allows zero and negative goal rewards and positive bomb values as finite numbers', () => {
    const env = new GridWorldEnv({ ...base(), goals: [{ x: 1, y: 0, reward: 0 }, { x: 3, y: 0, reward: -5 }] })
    expect(env.step(3).reward).toBe(0)
    expect(env.step(3).reward).toBe(-0.1)
    expect(env.step(3)).toMatchObject({ reward: -5, done: true })
    expect(validateFeatures({ ...base(), goals: [{ x: 1, y: 0, reward: Infinity }] })).toContain('Goal rewards must be finite numbers.')
    expect(validateFeatures({ ...base(), goals: [{ x: 4, y: 0 }], bombs: [{ x: 1, y: 0, penalty: Number.NaN }] })).toContain('Bomb penalties must be finite numbers.')
    expect(() => normalizeGridWorldConfig({ ...base(), goals: [{ x: 4, y: 0, reward: '5' }] })).toThrow('Goal rewards must be finite numbers.')
  })
  it('ends the Episode on a bomb with that bomb’s own penalty, else bombPenalty', () => {
    const config = { ...base(), width: 3, height: 3, start: { x: 1, y: 1 }, goals: [{ x: 2, y: 2 }], bombs: [{ x: 1, y: 0, penalty: -50 }, { x: 0, y: 1 }] }
    const env = new GridWorldEnv(config)
    expect(env.step(0)).toMatchObject({ reward: -50, done: true })
    env.reset()
    expect(env.step(2)).toMatchObject({ reward: -10, done: true })
  })
  it('matches the reward the engine records and the render model shows', () => {
    const config = { ...base(), goals: [{ x: 1, y: 0, reward: 42 }, { x: 4, y: 0 }], bombs: [{ x: 3, y: 0, penalty: -7 }] }
    const engine = new SimulationEngine({ envConfig: { ...config, start: { x: 2, y: 0 } }, hyperparams: { alpha: .1, gamma: .9, epsilon: 1 } })
    const replay = new GridWorldEnv({ ...config, start: { x: 2, y: 0 } })
    for (let i = 0; i < 40; i++) {
      engine.step()
      const t = engine.getSnapshot().lastTransition!
      expect(t.reward).toBe(replay.step(t.action).reward)
      if (t.done || t.truncated) replay.reset()
    }
    const model = new GridWorldEnv(config).getRenderModel()
    expect(model.goalRewards).toEqual({ '1,0': 42 })
    expect(model.bombPenalties).toEqual({ '3,0': -7 })
    expect(new GridWorldEnv(base()).getRenderModel()).not.toHaveProperty('goalRewards')
  })
})

describe('V4 toggle wall initial states', () => {
  // y=0: S . A . . ; doors at (2,1) [closed] and (3,1) [open], switch at (1,0), goal (4,2)
  const gate = (): GridWorldConfig => ({ ...base(), width: 5, height: 3, goals: [{ x: 4, y: 2 }], walls: [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 4, y: 1 }], switches: [{ x: 1, y: 0, groupId: 'G1' }], toggleWalls: [{ x: 2, y: 1, groupId: 'G1' }, { x: 3, y: 1, groupId: 'G1', initialOpen: true }] })
  const closed = (env: GridWorldEnv) => env.getRenderModel().walls.filter(key => key === '2,1' || key === '3,1')
  it('flips every wall of the group from its own current state on each switch press', () => {
    const env = new GridWorldEnv(gate())
    expect(closed(env)).toEqual(['2,1'])
    env.step(3) // press G1 once
    expect(closed(env)).toEqual(['3,1'])
    env.step(2); env.step(3) // press twice
    expect(closed(env)).toEqual(['2,1'])
  })
  it('blocks and admits movement exactly like the rendered state', () => {
    const env = new GridWorldEnv(gate())
    env.step(3); env.step(3); env.step(3) // (3,0) via switch press at (1,0)
    expect(env.step(1)).toMatchObject({ reward: -1 }) // (3,1) now closed
    expect(env.getRenderModel().agentPos).toBe('3,0')
    env.step(2)
    expect(env.step(1).nextState.startsWith('2,1,')).toBe(true) // (2,1) now open
  })
  it('restores initial states on reset and keeps state keys distinct per toggle parity', () => {
    const env = new GridWorldEnv(gate())
    const k0 = env.getState()
    env.step(3)
    const k1 = env.getState()
    expect(k1.split(',').at(-1)).toBe('1')
    env.step(2)
    expect(env.getState()).not.toBe(k0) // same cell, different door state
    env.reset()
    expect(env.getState()).toBe(k0)
    expect(closed(env)).toEqual(['2,1'])
  })
  it('treats a missing initialOpen as closed and rejects non-boolean values', () => {
    const legacy = { ...gate(), toggleWalls: [{ x: 2, y: 1, groupId: 'G1' }, { x: 3, y: 1, groupId: 'G1' }] }
    expect(closed(new GridWorldEnv(legacy))).toEqual(['2,1', '3,1'])
    expect(() => new GridWorldEnv({ ...gate(), toggleWalls: [{ x: 2, y: 1, groupId: 'G1', initialOpen: 'yes' }] })).toThrow('Toggle wall initial state must be open or closed.')
  })
  it('agrees across direct play environment, engine learning environment and the editor preview', () => {
    const config = gate()
    const engine = new SimulationEngine({ envConfig: config })
    const live = engine.getSnapshot().envRenderModel
    const draft = draftFromRenderModel(live)
    expect(draft.toggleWalls).toEqual(config.toggleWalls)
    expect(draftToRenderModel(draft).walls).not.toContain('3,1')
    expect(new GridWorldEnv(draftToGridWorldConfig(draft)).getRenderModel().walls).toEqual(live.walls)
  })
})

describe('V4 schema compatibility', () => {
  const draft = () => draftFromRenderModel(new GridWorldEnv({ ...base(), width: 5, height: 3, goals: [{ x: 4, y: 2, reward: 25 }], bombs: [{ x: 2, y: 2, penalty: -3 }], switches: [{ x: 1, y: 0, groupId: 'G1' }], toggleWalls: [{ x: 2, y: 1, groupId: 'G1', initialOpen: true }] }).getRenderModel())
  it('round-trips per-element values through JSON export/import as version 3', () => {
    const file = draftToExportFile(draft())
    expect(file.version).toBe(3)
    const parsed = parseEnvImport(serializeEnvExport(draft()))
    expect(parsed).toEqual({ ok: true, draft: draft() })
    if (parsed.ok) expect(serializeEnvExport(parsed.draft)).toBe(serializeEnvExport(draft()))
  })
  it('rejects V4-only fields in older schema versions instead of silently dropping them', () => {
    const file = { ...JSON.parse(serializeEnvExport(draft())), version: 2 }
    expect(parseEnvImport(JSON.stringify(file))).toEqual({ ok: false, error: 'Per-element rewards and initial gate states require schema version 3.' })
  })
  it('drops unknown per-element junk and validates override values on import', () => {
    const file = JSON.parse(serializeEnvExport(draft()))
    file.goals[0].colour = 'red'
    const parsed = parseEnvImport(JSON.stringify(file))
    expect(parsed.ok && parsed.draft.goals[0]).toEqual({ x: 4, y: 2, reward: 25 })
    file.goals[0].reward = 'big'
    expect(parseEnvImport(JSON.stringify(file))).toMatchObject({ ok: false })
  })
  it.each(ENVIRONMENT_PRESETS)('$id keeps its legacy export byte-identical (version 2, no new fields)', preset => {
    const text = serializeEnvExport(preset.draft)
    expect(JSON.parse(text).version).toBe(2)
    expect(text).not.toMatch(/"reward"|"penalty"|"initialOpen"/)
    expect(validateDraft(preset.draft)).toEqual([])
  })
})
