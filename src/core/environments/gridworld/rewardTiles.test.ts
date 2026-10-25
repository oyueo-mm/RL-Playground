import { describe, expect, it } from 'vitest'
import { GridWorldEnv, createDefaultGridWorldConfig } from './GridWorldEnv'
import { SimulationEngine } from '../../engine/SimulationEngine'
import { defaultDraft, draftFromRenderModel, draftToGridWorldConfig, validateDraft } from '../../../viz/controls/envEditorDraft'
import { parseEnvImport, serializeEnvExport } from '../../../viz/controls/envEditorIO'

describe('Reward tiles', () => {
  const config = { ...createDefaultGridWorldConfig(), width: 3, height: 3, start: { x: 0, y: 1 }, goals: [{ x: 2, y: 2 }], walls: [{ x: 1, y: 0 }], rewardTiles: [{ x: 1, y: 1, reward: 5 }] }
  it('adds reward on entry and re-entry, never for a collision or an extra terminal condition', () => {
    const env = new GridWorldEnv(config)
    expect(env.step(3)).toMatchObject({ reward: 4.9, done: false })
    expect(env.step(0)).toMatchObject({ reward: -0.1, done: false })
    env.step(2)
    expect(env.step(3).reward).toBe(4.9)
    expect(env.getRenderModel().cellRewards).toEqual({ '1,1': 5 })
  })
  it('supports negative rewards and the existing goal terminal rule', () => {
    const env = new GridWorldEnv({ ...config, rewardTiles: [{ x: 1, y: 1, reward: -5 }] })
    expect(env.step(3).reward).toBe(-5.1)
    env.step(1)
    expect(env.step(3)).toMatchObject({ reward: 10, done: true })
  })
  it.each(['q-learning', 'sarsa'])('updates real %s action values from the tile reward', algorithmId => {
    const engine = new SimulationEngine({ envConfig: { ...config, rewardTiles: [{ x: 0, y: 0, reward: 5 }] }, algorithmId, hyperparams: { alpha: 1, gamma: 0, epsilon: 0 } })
    engine.step()
    const snapshot = engine.getSnapshot()
    expect(snapshot.lastTransition?.reward).toBe(4.9)
    if (snapshot.agentSnapshot.kind === 'Q') expect(snapshot.agentSnapshot.qTable['0,1,0'][0]).toBe(4.9)
  })
  it('round-trips tiles through rendering, draft, JSON export/import and config', () => {
    const env = new GridWorldEnv(config)
    const draft = draftFromRenderModel(env.getRenderModel())
    const parsed = parseEnvImport(serializeEnvExport(draft))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(draftToGridWorldConfig(parsed.draft).rewardTiles).toEqual(config.rewardTiles)
    expect(parseEnvImport(serializeEnvExport(defaultDraft())).ok).toBe(true)
  })
  it('rejects non-finite, out-of-bounds, duplicate and overlapping tiles', () => {
    for (const tiles of [[{ x: 0, y: 0, reward: 1 }], [{ x: 50, y: 1, reward: 1 }], [{ x: 1, y: 1, reward: Infinity }], [{ x: 1, y: 1, reward: 1 }, { x: 1, y: 1, reward: 2 }]]) {
      expect(validateDraft({ ...defaultDraft(), rewardTiles: tiles }).length).toBeGreaterThan(0)
    }
  })
})
