import type { GridEditorDraft } from './envEditorDraft'

/** Potential geometry only: closed gates, collapse history and one-way rules are
 * intentionally evaluated separately by real-transition witness replays. */
export function auditPreset(draft: GridEditorDraft, portalConnectivity = false) {
  const key = (x: number, y: number) => `${x},${y}`
  const walls = new Set(draft.walls.map(p => key(p.x, p.y)))
  const adjacent = (x: number, y: number) => {
    const neighbors = [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].filter(([a,b]) => a >= 0 && b >= 0 && a < draft.width && b < draft.height && !walls.has(key(a,b)))
    if (portalConnectivity) for (const pair of draft.portals ?? []) {
      const index = pair.ends.findIndex(p => p.x === x && p.y === y)
      if (index !== -1) { const other = pair.ends[1-index]; neighbors.push([other.x, other.y]) }
    }
    return neighbors
  }
  const distances = (x: number, y: number) => {
    const result = new Map([[key(x,y), 0]]), queue = [[x,y]]
    for (let head = 0; head < queue.length; head++) {
      const [a,b] = queue[head]
      for (const [c,d] of adjacent(a,b)) if (!result.has(key(c,d))) { result.set(key(c,d), result.get(key(a,b))! + 1); queue.push([c,d]) }
    }
    return result
  }
  const reachable = distances(draft.start.x, draft.start.y)
  let branches = 0, deadEnds = 0
  for (const cell of reachable.keys()) { const [x,y] = cell.split(',').map(Number); const degree = adjacent(x,y).length; if (degree >= 3) branches++; if (degree === 1) deadEnds++ }
  return { cells: draft.width * draft.height, walls: walls.size, wallRatio: walls.size / (draft.width * draft.height), potentialReachable: reachable.size, branches, deadEnds, deadEndRatio: deadEnds / reachable.size, goals: draft.goals.length, goalDistances: draft.goals.map(goal => { const d = distances(goal.x,goal.y); return draft.goals.map(other => d.get(key(other.x,other.y)) ?? null) }) }
}
