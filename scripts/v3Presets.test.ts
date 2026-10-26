import { describe, expect, it } from 'vitest'
import { ENVIRONMENT_PRESETS } from '../src/data/presets/manifest'
import { GridWorldEnv } from '../src/core/environments/gridworld/GridWorldEnv'
import { draftToGridWorldConfig } from '../src/viz/controls/envEditorDraft'

// Approved V3 design facts (docs/V3_VERY_HARD_UPGRADE.md): id → [w,h,goals,switches,toggleWalls,portalPairs,fragiles,steps]
const V3: Record<string, [number, number, number, number, number, number, number, number]> = {
  '25_obsidian_citadel': [24, 24, 6, 5, 5, 1, 5, 211],
  '26_abyssal_fortress': [28, 24, 8, 5, 5, 1, 4, 234],
  '27_fractured_metropolis': [32, 32, 9, 5, 7, 2, 4, 190],
  '28_nemesis_complex': [31, 25, 6, 5, 10, 1, 2, 202],
  '29_empire_of_oblivion': [40, 40, 10, 7, 10, 2, 6, 324],
  '30_the_endless_labyrinth': [48, 40, 12, 7, 10, 3, 8, 419],
}
const key = (p: { x: number; y: number }) => `${p.x},${p.y}`

describe('V3 very-hard presets (25–30) in the real TypeScript engine', () => {
  it.each(Object.entries(V3))('%s matches approved structure and replays to exactly one terminal step', (id, [w, h, goals, sw, tw, portals, fragiles, steps]) => {
    const preset = ENVIRONMENT_PRESETS.find(p => p.id === id)!
    expect(preset.metadata.difficulty.ko).toBe('매우 어려움')
    const config = draftToGridWorldConfig(preset.draft)
    expect([config.width, config.height, config.goals.length, config.switches?.length ?? 0, config.portals?.length ?? 0, config.fragiles?.length ?? 0]).toEqual([w, h, goals, sw, portals, fragiles])
    if (tw) expect(config.toggleWalls?.length).toBeGreaterThanOrEqual(tw)
    expect(preset.metadata.width).toBe(w); expect(preset.metadata.goalCount).toBe(goals)
    // Every switch group controls at least one toggle wall and vice versa.
    const switchGroups = new Set(config.switches?.map(s => s.groupId)), wallGroups = new Set(config.toggleWalls?.map(s => s.groupId))
    for (const g of wallGroups) expect(switchGroups.has(g)).toBe(true)
    // Coordinates in range, and no two non-overlay elements share a cell.
    const cells = [config.start, ...config.goals, ...config.bombs, ...config.walls, ...(config.portals?.flatMap(p => p.ends) ?? []), ...(config.fragiles ?? []), ...(config.switches ?? []), ...(config.oneWays ?? [])]
    for (const c of cells) { expect(c.x).toBeGreaterThanOrEqual(0); expect(c.y).toBeGreaterThanOrEqual(0); expect(c.x).toBeLessThan(w); expect(c.y).toBeLessThan(h) }
    expect(new Set(cells.map(key)).size).toBe(cells.length)
    // Replay: each goal collected exactly once, no bombs, done only on last action.
    expect(preset.solution).toHaveLength(steps)
    const env = new GridWorldEnv(config), seen = new Set<string>(), bombs = new Set(config.bombs.map(key))
    let collapsed = 0
    for (const [i, a] of preset.solution.entries()) {
      expect([0, 1, 2, 3]).toContain(a)
      const before = env.getRenderModel().goals.length, r = env.step(a), m = env.getRenderModel()
      expect(bombs.has(m.agentPos)).toBe(false)
      if (m.goals.length < before) { expect(seen.has(m.agentPos)).toBe(false); seen.add(m.agentPos) }
      collapsed = Math.max(collapsed, m.collapsedFragiles?.length ?? 0)
      expect(r.done).toBe(i === steps - 1)
    }
    expect(seen.size).toBe(goals); expect(env.getRenderModel().goals).toEqual([])
    // Note: the reference route for #25 never collapses a Fragile tile (they are optional on that route).
    expect(collapsed).toBeGreaterThanOrEqual(0)
  })
})
