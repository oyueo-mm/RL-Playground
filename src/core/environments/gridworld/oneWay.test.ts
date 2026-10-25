import { describe, expect, it } from 'vitest'
import { GridWorldEnv, createDefaultGridWorldConfig } from './GridWorldEnv'
import { SimulationEngine } from '../../engine/SimulationEngine'
import { draftFromRenderModel, draftToGridWorldConfig } from '../../../viz/controls/envEditorDraft'
import { parseEnvImport, serializeEnvExport } from '../../../viz/controls/envEditorIO'

const config = { ...createDefaultGridWorldConfig(), width: 3, height: 3, start: { x: 0, y: 1 }, goals: [{ x: 2, y: 1 }], wallPenalty: -2, oneWays: [{ x: 1, y: 1, direction: 3 as const }] }
describe('One-way tiles', () => {
  it('allows ordinary entry and blocks every disallowed exit with wall penalty', () => {
    const env = new GridWorldEnv(config)
    expect(env.step(3)).toEqual({ nextState: '1,1,0', reward: -.1, done: false })
    for (const action of [0, 1, 2]) expect(env.step(action)).toEqual({ nextState: '1,1,0', reward: -2, done: false })
    expect(env.step(3)).toEqual({ nextState: '2,1,1', reward: 10, done: true })
  })
  it.each([0, 1, 2, 3] as const)('permits direction %s from the tile', direction => {
    const env = new GridWorldEnv({ ...config, goals: [{ x: 2, y: 2 }], oneWays: [{ x: 1, y: 1, direction }] })
    env.step(3)
    const result = env.step(direction)
    expect(result.reward).toBe(-.1)
    expect(result.nextState).not.toBe('1,1,0')
  })
  it('rejects invalid directions', () => { expect(() => new GridWorldEnv({ ...config, oneWays: [{ x: 1, y: 1, direction: 4 }] })).toThrow('direction') })
  it.each(['q-learning', 'sarsa'])('learns blocked transitions using the unmodified %s update', algorithmId => {
    const engine = new SimulationEngine({ algorithmId, envConfig: { ...config, goals: [{ x: 2, y: 2 }], oneWays: [{ x: 0, y: 0, direction: 3 }] }, hyperparams: { alpha: 1, gamma: 0, epsilon: 0 } })
    engine.step(); engine.step()
    const snapshot = engine.getSnapshot()
    expect(snapshot.lastTransition?.nextState).toBe('0,0,0')
    expect(snapshot.lastTransition?.reward).toBe(-2)
    if (snapshot.agentSnapshot.kind === 'Q') expect(snapshot.agentSnapshot.qTable['0,0,0'][0]).toBe(-2)
  })
  it('preserves directions in JSON and the render model', () => {
    const draft = draftFromRenderModel(new GridWorldEnv(config).getRenderModel())
    const parsed = parseEnvImport(serializeEnvExport(draft))
    if (!parsed.ok) throw new Error(parsed.error)
    expect(draftToGridWorldConfig(parsed.draft).oneWays).toEqual(config.oneWays)
  })
})
