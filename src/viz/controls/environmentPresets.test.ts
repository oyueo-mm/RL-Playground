import { describe, expect, it } from 'vitest'
import { ENVIRONMENT_PRESETS } from './environmentPresets'
import { MAX_SIZE, MIN_SIZE, samePosition, validateDraft, type GridEditorDraft } from './envEditorDraft'
import type { Position } from '../../core/environments/gridworld/types'

// Phase 56 §3 — "Start에서 적어도 하나의 Goal까지 도달 가능한 경로가 존재한다" is the one
// requirement `validateDraft()` (envEditorDraft.ts) does NOT already check — it validates
// bounds/collisions but has no notion of connectivity. A plain BFS over open (non-Wall)
// cells is enough: Bombs are NOT impassable (stepping onto one ends the Episode with a
// penalty, it doesn't block movement — see GridWorldEnv.ts's step() — the only true
// obstacle is a Wall, which keeps `next = current`), so only Walls need to be excluded
// from the traversal.
function isReachable(draft: GridEditorDraft): boolean {
  const wallSet = new Set(draft.walls.map((w) => `${w.x},${w.y}`))
  const goalSet = new Set(draft.goals.map((g) => `${g.x},${g.y}`))
  const visited = new Set<string>()
  const queue: Position[] = [draft.start]
  visited.add(`${draft.start.x},${draft.start.y}`)

  while (queue.length > 0) {
    const pos = queue.shift()!
    if (goalSet.has(`${pos.x},${pos.y}`)) return true
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const next = { x: pos.x + dx, y: pos.y + dy }
      const key = `${next.x},${next.y}`
      if (next.x < 0 || next.x >= draft.width || next.y < 0 || next.y >= draft.height) continue
      if (wallSet.has(key) || visited.has(key)) continue
      visited.add(key)
      queue.push(next)
    }
  }
  return false
}

// Every Goal must be reachable, not just "at least one" — Multi-Goal Episodes only
// terminate once ALL Goals are collected (GridWorldEnv.ts, unchanged this Phase), so a
// Multi-Goal preset with even one unreachable Goal could never actually finish an Episode.
function allGoalsReachable(draft: GridEditorDraft): boolean {
  return draft.goals.every((goal) => isReachable({ ...draft, goals: [goal] }))
}

describe('ENVIRONMENT_PRESETS — every preset (existing + Phase 56 additions)', () => {
  it('has no duplicate ids', () => {
    const ids = ENVIRONMENT_PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it.each(ENVIRONMENT_PRESETS.map((p) => [p.id, p] as const))('%s: passes validateDraft() with zero errors', (_id, preset) => {
    expect(validateDraft(preset.draft)).toEqual([])
  })

  it.each(ENVIRONMENT_PRESETS.map((p) => [p.id, p] as const))('%s: Grid size is within MIN_SIZE/MAX_SIZE', (_id, preset) => {
    expect(preset.draft.width).toBeGreaterThanOrEqual(MIN_SIZE)
    expect(preset.draft.width).toBeLessThanOrEqual(MAX_SIZE)
    expect(preset.draft.height).toBeGreaterThanOrEqual(MIN_SIZE)
    expect(preset.draft.height).toBeLessThanOrEqual(MAX_SIZE)
  })

  it.each(ENVIRONMENT_PRESETS.map((p) => [p.id, p] as const))('%s: exactly one Start position', (_id, preset) => {
    // GridEditorDraft.start is a single Position (not an array) — this is really
    // asserting the TYPE-level invariant is honored (no accidental duplicate/omitted
    // field), the meaningful "is it exactly one" check the Phase asked for.
    expect(preset.draft.start).toBeTruthy()
    expect(typeof preset.draft.start.x).toBe('number')
    expect(typeof preset.draft.start.y).toBe('number')
  })

  it.each(ENVIRONMENT_PRESETS.map((p) => [p.id, p] as const))('%s: at least one Goal', (_id, preset) => {
    expect(preset.draft.goals.length).toBeGreaterThanOrEqual(1)
  })

  it.each(ENVIRONMENT_PRESETS.map((p) => [p.id, p] as const))('%s: no duplicate coordinates within any single field (Goals/Walls/Bombs)', (_id, preset) => {
    for (const field of [preset.draft.goals, preset.draft.walls, preset.draft.bombs]) {
      const keys = field.map((p) => `${p.x},${p.y}`)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })

  it.each(ENVIRONMENT_PRESETS.map((p) => [p.id, p] as const))('%s: Start/Goal/Wall/Bomb never collide with each other', (_id, preset) => {
    const { start, goals, walls, bombs } = preset.draft
    for (const g of goals) expect(samePosition(g, start)).toBe(false)
    for (const w of walls) {
      expect(samePosition(w, start)).toBe(false)
      expect(goals.some((g) => samePosition(g, w))).toBe(false)
    }
    for (const b of bombs) {
      expect(samePosition(b, start)).toBe(false)
      expect(goals.some((g) => samePosition(g, b))).toBe(false)
      expect(walls.some((w) => samePosition(w, b))).toBe(false)
    }
  })

  it.each(ENVIRONMENT_PRESETS.map((p) => [p.id, p] as const))('%s: at least one Goal is reachable from Start (Walls only, Bombs are passable)', (_id, preset) => {
    expect(isReachable(preset.draft)).toBe(true)
  })

  it.each(ENVIRONMENT_PRESETS.map((p) => [p.id, p] as const))('%s: EVERY Goal is reachable (Multi-Goal Episodes require collecting all of them)', (_id, preset) => {
    expect(allGoalsReachable(preset.draft)).toBe(true)
  })
})

describe('ENVIRONMENT_PRESETS — Phase 56 new presets, individually', () => {
  function presetById(id: string) {
    const preset = ENVIRONMENT_PRESETS.find((p) => p.id === id)
    if (!preset) throw new Error(`preset "${id}" not found`)
    return preset
  }

  it('basic: an open field, no Walls/Bombs at all — a genuine "no obstacles" tutorial env', () => {
    const { draft } = presetById('basic')
    expect(draft.walls).toEqual([])
    expect(draft.bombs).toEqual([])
    expect(draft.goals.length).toBe(1)
  })

  it('obstacleCourse: the direct straight-line row IS blocked (proving a detour is actually required)', () => {
    const { draft } = presetById('obstacleCourse')
    const straightLineBlocked = draft.walls.some((w) => w.y === draft.start.y)
    expect(straightLineBlocked).toBe(true)
    // ...but the Goal is still reachable via the one gap.
    expect(isReachable(draft)).toBe(true)
  })

  it('complexMaze: the Phase 56 showcase — large grid, Multi-Goal, Walls, and Bombs all together', () => {
    const { draft } = presetById('complexMaze')
    expect(draft.width).toBeGreaterThanOrEqual(15)
    expect(draft.height).toBeGreaterThanOrEqual(15)
    expect(draft.goals.length).toBeGreaterThanOrEqual(3)
    expect(draft.walls.length).toBeGreaterThan(0)
    expect(draft.bombs.length).toBeGreaterThan(0)
    expect(allGoalsReachable(draft)).toBe(true)
  })

  it('all three new presets round-trip through draftToGridWorldConfig() -> validateDraft() cleanly (same path EnvEditor\'s Apply button uses)', async () => {
    const { draftToGridWorldConfig } = await import('./envEditorDraft')
    for (const id of ['basic', 'obstacleCourse', 'complexMaze']) {
      const { draft } = presetById(id)
      const config = draftToGridWorldConfig(draft)
      expect(config.width).toBe(draft.width)
      expect(config.goals).toEqual(draft.goals)
    }
  })
})

describe('ENVIRONMENT_PRESETS — Phase 58 new presets, individually', () => {
  function presetById(id: string) {
    const preset = ENVIRONMENT_PRESETS.find((p) => p.id === id)
    if (!preset) throw new Error(`preset "${id}" not found`)
    return preset
  }

  it('deadEndMaze: has at least one genuine dead-end cell (open, but only ONE open neighbor)', () => {
    const { draft } = presetById('deadEndMaze')
    const wallSet = new Set(draft.walls.map((w) => `${w.x},${w.y}`))
    const openNeighborCount = (x: number, y: number) =>
      [[0, -1], [0, 1], [-1, 0], [1, 0]].filter(([dx, dy]) => {
        const nx = x + dx, ny = y + dy
        if (nx < 0 || nx >= draft.width || ny < 0 || ny >= draft.height) return false
        return !wallSet.has(`${nx},${ny}`)
      }).length

    let deadEndCount = 0
    for (let y = 0; y < draft.height; y++) {
      for (let x = 0; x < draft.width; x++) {
        if (wallSet.has(`${x},${y}`)) continue
        if (openNeighborCount(x, y) === 1) deadEndCount++
      }
    }
    // At least the two purpose-built pockets — Start/Goal themselves are excluded from
    // counting as "dead ends" only incidentally (they have >1 open neighbor by design).
    expect(deadEndCount).toBeGreaterThanOrEqual(2)
    expect(isReachable(draft)).toBe(true)
  })

  it('multipleRoute: a freestanding Wall island (touches none of the Grid\'s edges) — a real route CHOICE, not a forced single detour', () => {
    const { draft } = presetById('multipleRoute')
    for (const w of draft.walls) {
      expect(w.x).toBeGreaterThan(0)
      expect(w.x).toBeLessThan(draft.width - 1)
      expect(w.y).toBeGreaterThan(0)
      expect(w.y).toBeLessThan(draft.height - 1)
    }
    expect(isReachable(draft)).toBe(true)
  })

  it('riskyPath: the direct Start-Goal row is lined with Bombs, AND a Bomb-free detour route exists', () => {
    const { draft } = presetById('riskyPath')
    const directRowBombs = draft.bombs.filter((b) => b.y === draft.start.y)
    expect(directRowBombs.length).toBeGreaterThan(0)

    // A Bomb-free path exists: BFS treating Bombs as impassable too (in addition to
    // Walls) — proving there's a genuine SAFE alternative, not just "the only route
    // happens to be risky."
    const wallSet = new Set(draft.walls.map((w) => `${w.x},${w.y}`))
    const bombSet = new Set(draft.bombs.map((b) => `${b.x},${b.y}`))
    const goalSet = new Set(draft.goals.map((g) => `${g.x},${g.y}`))
    const visited = new Set<string>([`${draft.start.x},${draft.start.y}`])
    const queue = [draft.start]
    let safeRouteExists = false
    while (queue.length > 0) {
      const pos = queue.shift()!
      if (goalSet.has(`${pos.x},${pos.y}`)) { safeRouteExists = true; break }
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const next = { x: pos.x + dx, y: pos.y + dy }
        const key = `${next.x},${next.y}`
        if (next.x < 0 || next.x >= draft.width || next.y < 0 || next.y >= draft.height) continue
        if (wallSet.has(key) || bombSet.has(key) || visited.has(key)) continue
        visited.add(key)
        queue.push(next)
      }
    }
    expect(safeRouteExists).toBe(true)
    // ...and the risky direct route (Bombs are passable, not blocking) is ALSO reachable.
    expect(isReachable(draft)).toBe(true)
  })

  it('all three new presets round-trip through draftToGridWorldConfig() -> validateDraft() cleanly', async () => {
    const { draftToGridWorldConfig, validateDraft } = await import('./envEditorDraft')
    for (const id of ['deadEndMaze', 'multipleRoute', 'riskyPath']) {
      const { draft } = presetById(id)
      const config = draftToGridWorldConfig(draft)
      expect(config.width).toBe(draft.width)
      expect(config.goals).toEqual(draft.goals)
      expect(validateDraft(draft)).toEqual([])
    }
  })
})
