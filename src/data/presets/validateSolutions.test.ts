import { describe, expect, it } from 'vitest'
import { ENVIRONMENT_PRESETS } from './manifest'
import { GridWorldEnv } from '../../core/environments/gridworld/GridWorldEnv'
import { draftToGridWorldConfig, validateDraft } from '../../viz/controls/envEditorDraft'
import { parseEnvImport, serializeEnvExport } from '../../viz/controls/envEditorIO'
import inventoryJSON from '../../../docs/preset30-source/inventory.json?raw'
import catalogJSON from './catalog.json?raw'

describe('ZIP official maps and supplied witnesses', () => {
  it('preserves all forty map/solution hashes and the original catalog bytes from the ZIP', async () => {
    const maps = import.meta.glob<string>('./maps/*.json', { query: '?raw', import: 'default', eager: true })
    const solutions = import.meta.glob<string>('./solutions/*.json', { query: '?raw', import: 'default', eager: true })
    const inventory = JSON.parse(inventoryJSON) as { path: string; sha256: string }[]
    const catalogHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(catalogJSON))
    expect([...new Uint8Array(catalogHash)].map(n => n.toString(16).padStart(2,'0')).join('')).toBe(inventory.find(item => item.path === 'manifest.json')!.sha256)
    for (const [path, raw] of Object.entries({ ...maps, ...solutions })) {
      const source = path.replace('./maps/', 'json/').replace('./solutions/', 'solutions/')
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
      expect([...new Uint8Array(digest)].map(n => n.toString(16).padStart(2,'0')).join('')).toBe(inventory.find(item => item.path === source)!.sha256)
    }
    expect(Object.keys(maps)).toHaveLength(30); expect(Object.keys(solutions)).toHaveLength(30)
  })
  it('contains exactly 20 unique maps with five per approved tier', () => {
    expect(ENVIRONMENT_PRESETS).toHaveLength(30)
    expect(new Set(ENVIRONMENT_PRESETS.map(p => p.id)).size).toBe(30)
    for (const tier of ['Easy', 'Medium', 'Hard', 'Very Hard', 'Extreme']) expect(ENVIRONMENT_PRESETS.filter(p => p.metadata.difficulty.en === tier)).toHaveLength(6)
  })
  it.each(ENVIRONMENT_PRESETS)('$id validates and reproduces supplied steps, goal order and events', preset => {
    expect(validateDraft(preset.draft)).toEqual([])
    expect(parseEnvImport(serializeEnvExport(preset.draft))).toEqual({ ok: true, draft: preset.draft })
    const env = new GridWorldEnv(draftToGridWorldConfig(preset.draft))
    const order: number[][] = [], events: Record<string, number> = {}
    expect(preset.solution.length).toBe(preset.solutionData.steps)
    for (const [index, action] of preset.solution.entries()) {
      expect([0, 1, 2, 3]).toContain(action)
      const before = env.getRenderModel(), result = env.step(action), after = env.getRenderModel()
      expect(after.bombs).not.toContain(after.agentPos)
      expect(result.done).toBe(index === preset.solution.length - 1)
      let event = after.agentPos === before.agentPos ? 'blocked' : 'move'
      if (after.goals.length < before.goals.length) { order.push(after.agentPos.split(',').map(Number)); event = 'goal' }
      if ((after.collapsedFragiles?.length ?? 0) > (before.collapsedFragiles?.length ?? 0)) event = 'fragile'
      if (JSON.stringify(after.openGroups) !== JSON.stringify(before.openGroups)) event = 'switch'
      const [x,y] = before.agentPos.split(',').map(Number)
      const [dx,dy] = [[0,-1],[0,1],[-1,0],[1,0]][action]
      if (after.agentPos !== before.agentPos && after.agentPos !== `${x+dx},${y+dy}`) event = 'portal'
      // ZIP event labels count landing on an already-collected Goal too; actual
      // collection order/rewards above remain first-visit only. Success overrides.
      if (after.agentPos !== before.agentPos && (after.allGoals ?? []).includes(after.agentPos)) event = 'goal'
      if (result.done) event = 'success'
      events[event] = (events[event] ?? 0) + 1
    }
    expect(env.getRenderModel().goals).toEqual([])
    expect(env.isTerminal(env.getState())).toBe(true)
    expect(order).toEqual(preset.solutionData.goalOrder)
    expect(events).toEqual(preset.solutionData.events)
  })
})
