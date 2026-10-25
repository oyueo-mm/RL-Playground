import { describe, expect, it } from 'vitest'
import { GridWorldEnv, createDefaultGridWorldConfig } from './GridWorldEnv'
import { ENVIRONMENT_PRESETS } from '../../../viz/controls/environmentPresets'
import { draftToGridWorldConfig } from '../../../viz/controls/envEditorDraft'
import { SimulationEngine } from '../../engine/SimulationEngine'

describe('Feature interactions', () => {
  it('checks one-way exit before applying one portal jump', () => {
    const env = new GridWorldEnv({ ...createDefaultGridWorldConfig(), width: 3, height: 3, start: { x: 0, y: 1 }, goals: [{ x: 2, y: 2 }], oneWays: [{ x: 1, y: 1, direction: 3 }], portals: [{ id: 'P', ends: [{ x: 2, y: 1 }, { x: 0, y: 2 }] }] })
    env.step(3)
    expect(env.step(0).nextState).toBe('1,1,0')
    expect(env.step(3)).toEqual({ nextState: '0,2,0', reward: -.1, done: false })
  })
  it('collapses the departed floor, toggles the arrived switch, and terminates only after ALL goals', () => {
    const env = new GridWorldEnv({ ...createDefaultGridWorldConfig(), width: 3, height: 3, start: { x: 0, y: 1 }, goals: [{ x: 0, y: 0 }, { x: 2, y: 2 }], fragiles: [{ x: 1, y: 1 }], switches: [{ x: 2, y: 1, groupId: 'G' }], toggleWalls: [{ x: 2, y: 0, groupId: 'G' }] })
    expect(env.step(0)).toMatchObject({ done: false, reward: 10 })
    env.step(1); env.step(3)
    expect(env.step(3)).toEqual({ nextState: '2,1,1,1,1', reward: -.1, done: false })
    expect(env.step(1)).toEqual({ nextState: '2,2,3,1,1', reward: 10, done: true })
    env.reset()
    expect(env.getRenderModel().goals).toHaveLength(2)
    expect(env.getRenderModel().collapsedFragiles).toEqual([])
    expect(env.getRenderModel().openGroups).toEqual([])
  })
  it('preserves the legacy state key and represents more than 32 goals without aliasing', () => {
    expect(new GridWorldEnv(createDefaultGridWorldConfig()).getState()).toBe('0,0,0')
    const env = new GridWorldEnv({ ...createDefaultGridWorldConfig(), start: { x: 5, y: 5 }, goals: Array.from({ length: 35 }, (_, index) => ({ x: index % 7, y: Math.floor(index / 7) })) })
    env.step(0)
    expect(BigInt(env.getState().split(',')[2])).toBe(1n << 33n)
  })
  it.each(['q-learning', 'sarsa'])('runs %s on the mixed dynamic environment without changing algorithm rules', algorithmId => {
    const config = draftToGridWorldConfig(ENVIRONMENT_PRESETS.find(preset => preset.id === '20_final_proving_grounds')!.draft)
    const engine = new SimulationEngine({ algorithmId, envConfig: config, hyperparams: { alpha: .3, gamma: .9, epsilon: .3 } })
    for (let i = 0; i < 300; i++) engine.step()
    const snapshot = engine.getSnapshot()
    expect(snapshot.currentState.split(',')).toHaveLength(5)
    if (snapshot.agentSnapshot.kind === 'Q') expect(Object.values(snapshot.agentSnapshot.qTable).flat().every(Number.isFinite)).toBe(true)
  })
})
