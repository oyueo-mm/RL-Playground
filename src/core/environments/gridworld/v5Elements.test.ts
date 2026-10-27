import { describe, expect, it } from 'vitest'
import { createDefaultGridWorldConfig, GridWorldEnv, normalizeGridWorldConfig } from './GridWorldEnv'
import type { GridWorldConfig } from './types'
import { stateSpaceDetails, stateSpaceEstimate, validateFeatures } from './features'
import { SimulationEngine } from '../../engine/SimulationEngine'
import { draftFromRenderModel, draftToGridWorldConfig, draftToRenderModel, validateDraft, defaultDraft } from '../../../viz/controls/envEditorDraft'
import { draftToExportFile, parseEnvImport, serializeEnvExport } from '../../../viz/controls/envEditorIO'
import { beginStroke, elementAt, extendStroke, flipPortal, moveElement, placeElement, setPortalDirected, setTerrainCost } from '../../../viz/controls/editorOperations'

const row = (): GridWorldConfig => ({ ...createDefaultGridWorldConfig(), width: 6, height: 1, start: { x: 0, y: 0 }, goals: [{ x: 5, y: 0 }], walls: [], stepReward: -0.1, wallPenalty: -1, goalReward: 10, bombPenalty: -10 })
const grid = (): GridWorldConfig => ({ ...createDefaultGridWorldConfig(), width: 7, height: 7, start: { x: 0, y: 0 }, goals: [{ x: 6, y: 6 }] })

describe('swamp (terrain) tiles', () => {
  it('replaces the step reward on entry: own cost, else map default, else -1', () => {
    const env = new GridWorldEnv({ ...row(), terrains: [{ x: 1, y: 0 }, { x: 2, y: 0, cost: -5 }, { x: 3, y: 0 }], terrainCost: -2 })
    expect(env.step(3).reward).toBe(-2) // map default
    expect(env.step(3).reward).toBe(-5) // own cost
    expect(env.step(3).reward).toBe(-2)
    expect(env.step(3).reward).toBe(-0.1) // ordinary tile again
    expect(new GridWorldEnv({ ...row(), terrains: [{ x: 1, y: 0 }] }).step(3).reward).toBe(-1) // built-in default
  })
  it('charges the cost on every entry, including re-entry, and zero is allowed', () => {
    const env = new GridWorldEnv({ ...row(), terrains: [{ x: 1, y: 0, cost: -3 }, { x: 2, y: 0, cost: 0 }] })
    expect([env.step(3).reward, env.step(2).reward, env.step(3).reward, env.step(3).reward]).toEqual([-3, -0.1, -3, 0])
  })
  it('never charges blocked moves, boundary hits or walls', () => {
    const env = new GridWorldEnv({ ...grid(), walls: [{ x: 1, y: 0 }], terrains: [{ x: 0, y: 1, cost: -4 }] })
    expect(env.step(3).reward).toBe(-0.1) // wall bump pays wallPenalty (-0.1 default), not a swamp cost
    expect(env.step(0).reward).toBe(-0.1) // out of bounds
    expect(env.step(1).reward).toBe(-4) // onto the swamp
  })
  it('keeps the goal reward and bomb terminal rules unchanged', () => {
    const env = new GridWorldEnv({ ...row(), terrains: [{ x: 4, y: 0, cost: -2 }] })
    for (let i = 0; i < 3; i++) env.step(3)
    expect(env.step(3).reward).toBe(-2)
    expect(env.step(3)).toMatchObject({ reward: 10, done: true })
  })
  it('rejects positive, NaN, Infinity and non-number costs', () => {
    for (const cost of [1, 0.1, Number.NaN, Infinity, -Infinity, '-1' as unknown as number]) {
      expect(() => new GridWorldEnv({ ...row(), terrains: [{ x: 1, y: 0, cost }] }), String(cost)).toThrow('Swamp costs must be finite numbers no greater than 0.')
      expect(() => new GridWorldEnv({ ...row(), terrains: [{ x: 1, y: 0 }], terrainCost: cost }), `default ${String(cost)}`).toThrow('Swamp costs')
    }
    expect(validateFeatures({ ...row(), terrains: [{ x: 1, y: 0, cost: 2 }] })).toContain('Swamp costs must be finite numbers no greater than 0.')
  })
  it('cannot share a cell with any other element and stays in bounds', () => {
    expect(() => new GridWorldEnv({ ...grid(), terrains: [{ x: 6, y: 6 }] })).toThrow(/Overlapping/)
    expect(() => new GridWorldEnv({ ...grid(), portals: [{ id: 'P', ends: [{ x: 1, y: 1 }, { x: 2, y: 2 }] }], terrains: [{ x: 2, y: 2 }] })).toThrow(/Overlapping/)
    expect(() => new GridWorldEnv({ ...grid(), terrains: [{ x: 1, y: 1 }, { x: 1, y: 1 }] })).toThrow(/Overlapping/)
    expect(() => new GridWorldEnv({ ...grid(), terrains: [{ x: 9, y: 1 }] })).toThrow(/outside/)
  })
  it('adds no state bits: same state keys and the same theoretical state estimate', () => {
    const plain = new GridWorldEnv(grid()), swampy = new GridWorldEnv({ ...grid(), terrains: [{ x: 1, y: 0 }, { x: 2, y: 2 }] })
    expect(swampy.reset()).toBe(plain.reset())
    expect(swampy.step(3).nextState).toBe(plain.step(3).nextState)
    expect(stateSpaceEstimate({ ...grid(), terrains: [{ x: 1, y: 0 }] })).toBe(stateSpaceEstimate(grid()))
    expect(stateSpaceDetails({ ...grid(), terrains: [{ x: 1, y: 0 }] }).text).toBe(stateSpaceDetails(grid()).text)
  })
  it('engine learning transitions, direct play and the editor preview use one rule', () => {
    const config = { ...grid(), terrains: [{ x: 1, y: 0, cost: -3 }, { x: 2, y: 0 }, { x: 0, y: 1, cost: -0.5 }], terrainCost: -2 }
    const engine = new SimulationEngine({ envConfig: config, hyperparams: { alpha: .1, gamma: .9, epsilon: 1 }, algorithmId: 'sarsa' })
    const replay = new GridWorldEnv(config)
    for (let i = 0; i < 300; i++) {
      engine.step()
      const t = engine.getSnapshot().lastTransition!
      expect(t.reward).toBe(replay.step(t.action).reward)
      if (t.done || t.truncated) replay.reset()
    }
    const draft = draftFromRenderModel(engine.getSnapshot().envRenderModel)
    expect(draft.terrains).toEqual(config.terrains)
    expect(draft.terrainCost).toBe(-2)
    expect(new GridWorldEnv(draftToGridWorldConfig(draft)).getRenderModel().terrainCost).toBe(-2)
    expect(draftToRenderModel(draft).features?.terrains).toEqual(config.terrains)
  })
  it('exposes the effective default in the render model only when swamps exist', () => {
    expect(new GridWorldEnv(grid()).getRenderModel()).not.toHaveProperty('terrainCost')
    expect(new GridWorldEnv({ ...grid(), terrains: [{ x: 1, y: 0 }] }).getRenderModel().terrainCost).toBe(-1)
  })
})

describe('one-way portals', () => {
  const pair = (directed: boolean) => ({ ...grid(), portals: [{ id: 'P1', ends: [{ x: 1, y: 1 }, { x: 5, y: 1 }], ...(directed ? { directed: true as const } : {}) }] })
  it('keeps two-way pairs exactly as before', () => {
    const env = new GridWorldEnv(pair(false))
    env.reset(); env.step(1) // (0,1)
    expect(env.step(3).nextState.startsWith('5,1')).toBe(true) // into A -> B
    const back = new GridWorldEnv({ ...pair(false), start: { x: 6, y: 1 } })
    expect(back.step(2).nextState.startsWith('1,1')).toBe(true) // into B -> A
  })
  it('teleports A -> B but treats B as an ordinary cell', () => {
    const forward = new GridWorldEnv(pair(true)); forward.step(1)
    expect(forward.step(3).nextState.startsWith('5,1')).toBe(true)
    const back = new GridWorldEnv({ ...pair(true), start: { x: 6, y: 1 } })
    const result = back.step(2) // enter B from the east
    expect(result.nextState.startsWith('5,1')).toBe(true) // stays on B, no return to A
    expect(back.getRenderModel().agentPos).toBe('5,1')
    expect(back.step(2).nextState.startsWith('4,1')).toBe(true) // walks on normally
  })
  it('fires one portal per action and costs the ordinary step reward', () => {
    const env = new GridWorldEnv({ ...pair(true), start: { x: 0, y: 1 } })
    expect(env.step(3).reward).toBe(-0.1)
    expect(env.step(2)).toMatchObject({ reward: -0.1 }) // from B west, ordinary move
  })
  it('stays two-way when mixed with a one-way pair, and adds no state bits', () => {
    const config = { ...grid(), portals: [{ id: 'A', ends: [{ x: 1, y: 1 }, { x: 5, y: 1 }], directed: true as const }, { id: 'B', ends: [{ x: 1, y: 3 }, { x: 5, y: 3 }] }] }
    const env = new GridWorldEnv({ ...config, start: { x: 6, y: 3 } })
    expect(env.step(2).nextState.startsWith('1,3')).toBe(true) // two-way pair still returns
    expect(stateSpaceEstimate(config)).toBe(stateSpaceEstimate({ ...config, portals: config.portals.map(p => ({ id: p.id, ends: p.ends })) }))
  })
  it('requires a complete pair and rejects an invalid direction flag', () => {
    expect(() => new GridWorldEnv({ ...grid(), portals: [{ id: 'P', ends: [{ x: 1, y: 1 }], directed: true }] })).toThrow(/two endpoints/)
    expect(() => new GridWorldEnv({ ...grid(), portals: [{ id: 'P', ends: [{ x: 1, y: 1 }, { x: 2, y: 2 }], directed: false as unknown as true }] })).toThrow('Portal direction must be one-way or omitted.')
    expect(validateDraft({ ...defaultDraft(), portals: [{ id: 'P', ends: [{ x: 1, y: 1 }], directed: true }] }).some(e => e.includes('two endpoints'))).toBe(true)
  })
  it('agrees between the learning engine and independent play', () => {
    const config = pair(true)
    const engine = new SimulationEngine({ envConfig: config, hyperparams: { alpha: .1, gamma: .9, epsilon: 1 } })
    const replay = new GridWorldEnv(config)
    for (let i = 0; i < 300; i++) {
      engine.step()
      const t = engine.getSnapshot().lastTransition!
      expect(t.nextState).toBe(replay.step(t.action).nextState)
      if (t.done || t.truncated) replay.reset()
    }
  })
})

describe('editor operations for the new elements', () => {
  const base = () => ({ ...defaultDraft(), portals: [{ id: 'P1', ends: [{ x: 1, y: 1 }, { x: 5, y: 1 }], directed: true as const }] })
  it('moving a one-way portal endpoint keeps entrance/exit slots, the direction flag and the link', () => {
    const afterA = moveElement(base(), { x: 1, y: 1 }, { x: 2, y: 3 }).draft
    expect(afterA.portals).toEqual([{ id: 'P1', ends: [{ x: 2, y: 3 }, { x: 5, y: 1 }], directed: true }])
    const afterB = moveElement(afterA, { x: 5, y: 1 }, { x: 6, y: 4 }).draft
    expect(afterB.portals).toEqual([{ id: 'P1', ends: [{ x: 2, y: 3 }, { x: 6, y: 4 }], directed: true }])
    expect(validateDraft(afterB)).toEqual([])
    expect(new GridWorldEnv(draftToGridWorldConfig({ ...afterB, start: { x: 2, y: 2 } })).step(1).nextState.startsWith('6,4')).toBe(true)
  })
  it('moving onto another element replaces it without disturbing the pair', () => {
    const d = { ...base(), walls: [{ x: 3, y: 3 }] }
    const moved = moveElement(d, { x: 1, y: 1 }, { x: 3, y: 3 }).draft
    expect(moved.walls).toEqual([])
    expect(moved.portals?.[0]).toEqual({ id: 'P1', ends: [{ x: 3, y: 3 }, { x: 5, y: 1 }], directed: true })
  })
  it('flips direction, toggles one-way, and creates directed pairs from the tool', () => {
    const flipped = flipPortal(base(), 'P1')
    expect(flipped.portals?.[0]).toEqual({ id: 'P1', ends: [{ x: 5, y: 1 }, { x: 1, y: 1 }], directed: true })
    expect(setPortalDirected(flipped, 'P1', false).portals?.[0]).toEqual({ id: 'P1', ends: [{ x: 5, y: 1 }, { x: 1, y: 1 }] })
    expect(setPortalDirected(setPortalDirected(base(), 'P1', false), 'P1', true)).toEqual(base())
    let d = placeElement(defaultDraft(), { x: 2, y: 2 }, { kind: 'portal', portalId: 'Q', directed: true }).draft
    d = placeElement(d, { x: 4, y: 4 }, { kind: 'portal', portalId: 'Q', directed: true }).draft
    expect(d.portals).toEqual([{ id: 'Q', ends: [{ x: 2, y: 2 }, { x: 4, y: 4 }], directed: true }])
    expect(elementAt(d, { x: 2, y: 2 })).toMatchObject({ kind: 'portal', directed: true })
  })
  it('places, drags, erases and edits swamp tiles', () => {
    let d = placeElement(defaultDraft(), { x: 2, y: 2 }, { kind: 'terrain' }).draft
    expect(d.terrains).toEqual([{ x: 2, y: 2 }])
    d = extendStroke(beginStroke(d, { x: 1, y: 4 }, { kind: 'terrain' }), { x: 5, y: 4 }).draft
    expect(d.terrains).toHaveLength(6)
    expect(new Set(d.terrains!.map(t => `${t.x},${t.y}`)).size).toBe(6)
    d = setTerrainCost(d, { x: 2, y: 2 }, -4)
    expect(elementAt(d, { x: 2, y: 2 })).toEqual({ kind: 'terrain', cost: -4 })
    expect(moveElement(d, { x: 2, y: 2 }, { x: 3, y: 2 }).draft.terrains).toContainEqual({ x: 3, y: 2, cost: -4 })
    expect(setTerrainCost(d, { x: 2, y: 2 }, undefined).terrains).toContainEqual({ x: 2, y: 2 })
    expect(placeElement(d, { x: 2, y: 2 }, { kind: 'terrain' }).draft.terrains).toHaveLength(5) // re-click removes
    const removed = extendStroke(beginStroke(d, { x: 1, y: 4 }, { kind: 'terrain' }), { x: 5, y: 4 }).draft
    expect(removed.terrains).toEqual([{ x: 2, y: 2, cost: -4 }])
    expect(validateDraft(d)).toEqual([])
  })
})

describe('schema version 4 import / export', () => {
  const swampy = () => ({ ...defaultDraft(), terrains: [{ x: 2, y: 2 }, { x: 3, y: 2, cost: -5 }], terrainCost: -2, portals: [{ id: 'P1', ends: [{ x: 1, y: 4 }, { x: 5, y: 4 }], directed: true as const }] })
  it('exports v4 only when swamps or one-way portals exist and round-trips exactly', () => {
    expect(draftToExportFile(defaultDraft()).version).toBe(2)
    expect(draftToExportFile({ ...defaultDraft(), goals: [{ x: 6, y: 6, reward: 3 }] }).version).toBe(3)
    expect(draftToExportFile(swampy()).version).toBe(4)
    expect(draftToExportFile({ ...defaultDraft(), portals: [{ id: 'P', ends: [{ x: 1, y: 1 }, { x: 2, y: 2 }] }] }).version).toBe(2)
    const parsed = parseEnvImport(serializeEnvExport(swampy()))
    expect(parsed).toEqual({ ok: true, draft: swampy() })
    if (parsed.ok) expect(serializeEnvExport(parsed.draft)).toBe(serializeEnvExport(swampy()))
  })
  it('does not export a stray terrainCost without swamps', () => {
    expect(JSON.parse(serializeEnvExport({ ...defaultDraft(), terrainCost: -3 }))).not.toHaveProperty('terrainCost')
  })
  it('still reads v1, v2 and v3 files and refuses to silently drop new fields from them', () => {
    const file = JSON.parse(serializeEnvExport(swampy()))
    for (const version of [2, 3]) expect(parseEnvImport(JSON.stringify({ ...file, version }))).toEqual({ ok: false, error: 'Swamps and one-way portals require schema version 4.' })
    const legacy = JSON.parse(serializeEnvExport(defaultDraft()))
    for (const version of [1, 2, 3, 4]) expect(parseEnvImport(JSON.stringify({ ...legacy, version })).ok, `v${version}`).toBe(true)
    const noSwamp = { ...file }
    delete noSwamp.terrains
    expect(parseEnvImport(JSON.stringify({ ...noSwamp, version: 3 }))).toMatchObject({ ok: false }) // terrainCost without swamps is still a v4-only field
  })
  it('reports invalid costs, overlaps and incomplete one-way links', () => {
    const file = JSON.parse(serializeEnvExport(swampy()))
    expect(parseEnvImport(JSON.stringify({ ...file, terrains: [{ x: 2, y: 2, cost: 3 }] }))).toEqual({ ok: false, error: 'Swamp costs must be finite numbers no greater than 0.' })
    expect(parseEnvImport(JSON.stringify({ ...file, terrainCost: 0.5 }))).toMatchObject({ ok: false })
    expect(parseEnvImport(JSON.stringify({ ...file, terrains: [{ x: 6, y: 6 }] }))).toMatchObject({ ok: false, error: expect.stringContaining('Overlapping') })
    expect(parseEnvImport(JSON.stringify({ ...file, portals: [{ id: 'P1', ends: [{ x: 1, y: 4 }], directed: true }] }))).toMatchObject({ ok: false })
    expect(parseEnvImport(JSON.stringify({ ...file, portals: [{ id: 'P1', ends: [{ x: 1, y: 4 }, { x: 5, y: 4 }], directed: 'yes' }] }))).toEqual({ ok: false, error: 'Portal direction must be one-way or omitted.' })
  })
  it('normalizes through the engine boundary without losing swamp data', () => {
    const config = normalizeGridWorldConfig(draftToGridWorldConfig(swampy()))
    expect(config.terrains).toEqual(swampy().terrains)
    expect(config.terrainCost).toBe(-2)
    expect(config.portals?.[0].directed).toBe(true)
  })
})
