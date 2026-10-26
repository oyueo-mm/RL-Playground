import { describe, expect, it } from 'vitest'
import { ENVIRONMENT_PRESETS } from './manifest'
import { GridWorldEnv } from '../../core/environments/gridworld/GridWorldEnv'
import { draftToGridWorldConfig, validateDraft } from '../../viz/controls/envEditorDraft'
import { parseEnvImport, serializeEnvExport } from '../../viz/controls/envEditorIO'
import inventoryJSON from '../../../docs/preset30-source/inventory.json?raw'
import v2Inventory from '../../../docs/v2-source-inventory.json'
import v3Inventory from '../../../docs/v3-source-inventory.json'

describe('ZIP official maps and supplied witnesses', () => {
  it('preserves untouched maps 1–18 and exact V2 map/solution bytes', async () => {
    const maps = import.meta.glob<string>('./maps/*.json', { query: '?raw', import: 'default', eager: true })
    const solutions = import.meta.glob<string>('./solutions/*.json', { query: '?raw', import: 'default', eager: true })
    const inventory = JSON.parse(inventoryJSON) as { path: string; sha256: string }[]
    for (const [path, raw] of Object.entries({ ...maps, ...solutions })) {
      const source = path.replace('./maps/', 'json/').replace('./solutions/', 'solutions/')
      if (path.includes('/11_')) continue // Authorized repair; verified by full-state audit.
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
      const number = Number(path.split('/').at(-1)!.slice(0,2))
      const expected = number >= 25
        ? v3Inventory.find(item => item.path.endsWith(path.slice(1)))?.sha256
        : number >= 19
          ? v2Inventory.find(item => item.path.endsWith(path.slice(1)))?.sha256
          : inventory.find(item => item.path === source)?.sha256
      expect(expected).toBeDefined()
      expect([...new Uint8Array(digest)].map(n => n.toString(16).padStart(2,'0')).join('')).toBe(expected)
    }
    expect(Object.keys(maps)).toHaveLength(30); expect(Object.keys(solutions)).toHaveLength(30)
  })
  it('contains exactly 30 unique maps with six per approved tier', () => {
    expect(ENVIRONMENT_PRESETS).toHaveLength(30)
    expect(new Set(ENVIRONMENT_PRESETS.map(p => p.id)).size).toBe(30)
    for (const tier of ['Very Easy', 'Easy', 'Medium', 'Hard', 'Very Hard']) expect(ENVIRONMENT_PRESETS.filter(p => p.metadata.difficulty.en === tier)).toHaveLength(6)
  })
  it.each(ENVIRONMENT_PRESETS)('$id validates and reproduces supplied steps, goal order and events', preset => {
    expect(validateDraft(preset.draft)).toEqual([])
    expect(parseEnvImport(serializeEnvExport(preset.draft))).toEqual({ ok: true, draft: preset.draft })
    const env = new GridWorldEnv(draftToGridWorldConfig(preset.draft))
    const order: number[][] = [], events: Record<string, number> = {}
    let collectedMask = 0n
    expect(preset.solution.length).toBe(preset.solutionData.steps)
    for (const [index, action] of preset.solution.entries()) {
      expect([0, 1, 2, 3]).toContain(action)
      const before = env.getRenderModel(), result = env.step(action), after = env.getRenderModel()
      expect(after.bombs).not.toContain(after.agentPos)
      expect(result.done).toBe(index === preset.solution.length - 1)
      let event = after.agentPos === before.agentPos ? 'blocked' : 'move'
      if (after.goals.length < before.goals.length) {
        order.push(after.agentPos.split(',').map(Number)); event = 'goal'
        const goalIndex = preset.draft.goals.findIndex(p => `${p.x},${p.y}` === after.agentPos)
        collectedMask |= 1n << BigInt(goalIndex)
        expect(result.reward).toBe(preset.draft.goalReward)
      }
      expect(BigInt(result.nextState.split(',')[2])).toBe(collectedMask)
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
    expect(collectedMask).toBe((1n << BigInt(preset.draft.goals.length)) - 1n)
    expect(env.isTerminal(env.getState())).toBe(true)
    expect(order).toEqual(preset.solutionData.goalOrder)
    // V2 calls ordinary movement "step"; the original ZIP calls it "move".
    const supplied = { ...preset.solutionData.events }
    if ('step' in supplied) { supplied.move = supplied.step; delete supplied.step }
    expect(events).toEqual(supplied)
  })
})
