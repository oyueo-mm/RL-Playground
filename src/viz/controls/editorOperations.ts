import type { Direction, Position } from '../../core/environments/gridworld/types'
import { positionId } from '../../core/environments/gridworld/features'
import { removeFeaturesAt, samePosition, type EditMode, type GridEditorDraft } from './envEditorDraft'

export type ElementKind = Exclude<EditMode, 'select' | 'erase'>
export interface MapElement { kind: ElementKind; portalId?: string; groupId?: string; direction?: Direction; initialOpen?: boolean; reward?: number; penalty?: number; cost?: number; directed?: boolean }
export type EditError = 'start' | 'last-goal' | 'portal-complete' | 'portal-merge' | 'bounds'
export interface EditResult { draft: GridEditorDraft; error?: EditError }

export function elementAt(d: GridEditorDraft, p: Position): MapElement | null {
  if (samePosition(d.start, p)) return { kind: 'start' }
  for (const [field, kind] of [['walls', 'wall'], ['fragiles', 'fragile']] as const) if (d[field]?.some(tile => samePosition(tile, p))) return { kind }
  const goal = d.goals.find(tile => samePosition(tile, p))
  if (goal) return goal.reward === undefined ? { kind: 'goal' } : { kind: 'goal', reward: goal.reward }
  const bomb = d.bombs.find(tile => samePosition(tile, p))
  if (bomb) return bomb.penalty === undefined ? { kind: 'bomb' } : { kind: 'bomb', penalty: bomb.penalty }
  const portal = d.portals?.find(pair => pair.ends.some(end => samePosition(end, p)))
  if (portal) return { kind: 'portal', portalId: portal.id, ...(portal.directed ? { directed: true } : {}) }
  const swamp = d.terrains?.find(tile => samePosition(tile, p))
  if (swamp) return swamp.cost === undefined ? { kind: 'terrain' } : { kind: 'terrain', cost: swamp.cost }
  const way = d.oneWays?.find(tile => samePosition(tile, p))
  if (way) return { kind: 'oneWay', direction: way.direction }
  const pressed = d.switches?.find(tile => samePosition(tile, p))
  if (pressed) return { kind: 'switch', groupId: pressed.groupId }
  const wall = d.toggleWalls?.find(tile => samePosition(tile, p))
  return wall ? { kind: 'toggleWall', groupId: wall.groupId, ...(wall.initialOpen ? { initialOpen: true } : {}) } : null
}
function erase(d: GridEditorDraft, p: Position): GridEditorDraft {
  return { ...d, ...removeFeaturesAt(d, p), walls: d.walls.filter(tile => !samePosition(tile, p)), goals: d.goals.filter(tile => !samePosition(tile, p)), bombs: d.bombs.filter(tile => !samePosition(tile, p)) }
}
function insert(d: GridEditorDraft, p: Position, element: MapElement): GridEditorDraft {
  switch (element.kind) {
    case 'start': return { ...d, start: p }
    case 'wall': return { ...d, walls: [...d.walls, p] }
    case 'goal': return { ...d, goals: [...d.goals, element.reward === undefined ? p : { ...p, reward: element.reward }] }
    case 'bomb': return { ...d, bombs: [...d.bombs, element.penalty === undefined ? p : { ...p, penalty: element.penalty }] }
    case 'fragile': return { ...d, fragiles: [...(d.fragiles ?? []), p] }
    case 'oneWay': return { ...d, oneWays: [...(d.oneWays ?? []), { ...p, direction: element.direction ?? 3 }] }
    case 'switch': return { ...d, switches: [...(d.switches ?? []), { ...p, groupId: element.groupId ?? 'G1' }] }
    case 'toggleWall': return { ...d, toggleWalls: [...(d.toggleWalls ?? []), { ...p, groupId: element.groupId ?? 'G1', ...(element.initialOpen ? { initialOpen: true } : {}) }] }
    case 'terrain': return { ...d, terrains: [...(d.terrains ?? []), element.cost === undefined ? p : { ...p, cost: element.cost }] }
    case 'portal': {
      const id = element.portalId ?? 'P1'
      const pair = d.portals?.find(pair => pair.id === id)
      return { ...d, portals: pair ? d.portals?.map(pair => pair.id === id ? { ...pair, ends: [...pair.ends, p] } : pair) : [...(d.portals ?? []), { id, ends: [p], ...(element.directed ? { directed: true as const } : {}) }] }
    }
  }
}
function protectedTarget(d: GridEditorDraft, p: Position, incoming: MapElement): EditError | undefined {
  const old = elementAt(d, p)
  if (old?.kind === 'start' && incoming.kind !== 'start') return 'start'
  if (old?.kind === 'goal' && d.goals.length === 1 && incoming.kind !== 'goal') return 'last-goal'
}
export function placeElement(d: GridEditorDraft, p: Position, incoming: MapElement): EditResult {
  const old = elementAt(d, p)
  const error = protectedTarget(d, p, incoming)
  if (error) return { draft: d, error }
  if (old?.kind === incoming.kind) {
    if (incoming.kind === 'oneWay') return { draft: { ...d, oneWays: d.oneWays?.map(tile => samePosition(tile, p) ? { ...tile, direction: ({ 0: 3, 3: 1, 1: 2, 2: 0 } as const)[tile.direction] } : tile) } }
    // V4: re-clicking a toggle wall cycles its initial state closed -> open -> closed.
    if (incoming.kind === 'toggleWall') return { draft: setToggleInitialOpen(d, p, !old.initialOpen) }
    // V5: re-clicking a portal end edits the pair that end belongs to, whatever ID the tool currently has.
    if (incoming.kind === 'portal') return { draft: cyclePortalAt(d, p) }
    if (incoming.kind === 'goal' && d.goals.length === 1) return { draft: d, error: 'last-goal' }
    if (['wall', 'bomb', 'goal', 'terrain'].includes(incoming.kind)) return { draft: erase(d, p) }
    return { draft: d }
  }
  if (incoming.kind === 'portal' && (d.portals?.find(pair => pair.id === (incoming.portalId ?? 'P1'))?.ends.length ?? 0) >= 2) return { draft: d, error: 'portal-complete' }
  return { draft: insert(erase(d, p), p, incoming) }
}
export function moveElement(d: GridEditorDraft, from: Position, to: Position): EditResult {
  if (samePosition(from, to)) return { draft: d }
  if (to.x < 0 || to.y < 0 || to.x >= d.width || to.y >= d.height) return { draft: d, error: 'bounds' }
  const element = elementAt(d, from)
  if (!element) return { draft: d }
  const error = protectedTarget(d, to, element)
  if (error) return { draft: d, error }
  const target = elementAt(d, to)
  if (target?.kind === 'start') return { draft: d, error: 'start' }
  if (element.kind === 'portal' && target?.kind === 'portal' && element.portalId === target.portalId) return { draft: d, error: 'portal-merge' }
  if (element.kind === 'portal') {
    // Move an endpoint in place: ends[0] is the entrance A and ends[1] the exit B of a one-way pair, so the slot must not change.
    const cleared = erase(d, to)
    return { draft: { ...cleared, portals: cleared.portals?.map(pair => ({ ...pair, ends: pair.ends.map(end => samePosition(end, from) ? to : end) })) } }
  }
  return { draft: insert(erase(erase(d, from), to), to, element) }
}
/** V5 — undefined restores inheritance from the map-wide swamp cost. */
export function setTerrainCost(d: GridEditorDraft, p: Position, cost: number | undefined): GridEditorDraft {
  return { ...d, terrains: d.terrains?.map(tile => {
    if (!samePosition(tile, p)) return tile
    const copy = { ...tile }
    delete copy.cost
    return cost === undefined ? copy : { ...copy, cost }
  }) }
}
/** V5 — switch a portal pair between two-way and one-way (A -> B). Two-way is stored by omission. */
export function setPortalDirected(d: GridEditorDraft, id: string, directed: boolean): GridEditorDraft {
  return { ...d, portals: d.portals?.map(pair => {
    if (pair.id !== id) return pair
    const copy = { ...pair }
    delete copy.directed
    return directed ? { ...copy, directed: true as const } : copy
  }) }
}
/**
 * V5 — click-to-direct. The clicked end of a complete pair becomes the destination:
 *   two-way A↔B --click A--> B→A --click B--> A→B --click the destination--> two-way.
 * An incomplete pair is left untouched so repeated clicks can never create a duplicate end.
 */
export function cyclePortalAt(d: GridEditorDraft, p: Position): GridEditorDraft {
  const pair = d.portals?.find(item => item.ends.some(end => samePosition(end, p)))
  if (!pair || pair.ends.length !== 2) return d
  const clickedIsDestination = pair.directed === true && samePosition(pair.ends[1], p)
  const clicked = pair.ends.find(end => samePosition(end, p))!, other = pair.ends.find(end => !samePosition(end, p))!
  return { ...d, portals: d.portals?.map(item => {
    if (item !== pair) return item
    const copy = { ...item }
    delete copy.directed
    return clickedIsDestination ? copy : { ...copy, ends: [other, clicked], directed: true as const }
  }) }
}
/** V5 — swap entrance and exit of a one-way pair (A -> B becomes B -> A). */
export function flipPortal(d: GridEditorDraft, id: string): GridEditorDraft {
  return { ...d, portals: d.portals?.map(pair => pair.id === id && pair.ends.length === 2 ? { ...pair, ends: [pair.ends[1], pair.ends[0]] } : pair) }
}
export function nextPortalId(d: GridEditorDraft, preferred = ''): string {
  const partial = d.portals?.filter(pair => pair.ends.length === 1)
  return partial?.find(pair => pair.id === preferred)?.id ?? partial?.[0]?.id ?? unusedId('P', new Set(d.portals?.map(pair => pair.id)))
}
export function nextGroupId(d: GridEditorDraft, preferred = ''): string {
  const switches = new Set(d.switches?.map(tile => tile.groupId)), walls = new Set(d.toggleWalls?.map(tile => tile.groupId))
  const ids = new Set([...switches, ...walls])
  const partial = [...ids].filter(id => !switches.has(id) || !walls.has(id))
  return partial.includes(preferred) ? preferred : partial[0] ?? unusedId('G', ids)
}
function unusedId(prefix: string, ids: Set<string>): string { let n = 1; while (ids.has(`${prefix}${n}`)) n++; return `${prefix}${n}` }
export const positionKey = positionId

/** V4 — false is stored by omission so closed walls serialize exactly like pre-V4 walls. */
export function setToggleInitialOpen(d: GridEditorDraft, p: Position, open: boolean): GridEditorDraft {
  return { ...d, toggleWalls: d.toggleWalls?.map(tile => {
    if (!samePosition(tile, p)) return tile
    const rest = { ...tile }
    delete rest.initialOpen
    return open ? { ...rest, initialOpen: true } : rest
  }) }
}
/** V4 — undefined restores inheritance from the map-wide goalReward / bombPenalty. */
export function setElementValue(d: GridEditorDraft, p: Position, kind: 'goal' | 'bomb', value: number | undefined): GridEditorDraft {
  const field = kind === 'goal' ? 'reward' : 'penalty'
  const update = <T extends Position & { reward?: number; penalty?: number }>(tile: T): T => {
    if (!samePosition(tile, p)) return tile
    const copy = { ...tile }
    delete copy[field]
    return value === undefined ? copy : { ...copy, [field]: value }
  }
  return kind === 'goal' ? { ...d, goals: d.goals.map(update) } : { ...d, bombs: d.bombs.map(update) }
}
export function eraseElement(d: GridEditorDraft, p: Position): EditResult {
  const old = elementAt(d, p)
  if (old?.kind === 'start') return { draft: d, error: 'start' }
  if (old?.kind === 'goal' && d.goals.length === 1) return { draft: d, error: 'last-goal' }
  return old ? { draft: erase(d, p) } : { draft: d }
}

// ---- V4 drag painting ----

/** Tools whose drag continues past the first cell. Start, portals and switches stay single-cell so their links never fan out by accident. */
export const PAINTABLE_TOOLS: ReadonlySet<EditMode> = new Set<EditMode>(['wall', 'goal', 'bomb', 'fragile', 'oneWay', 'toggleWall', 'terrain', 'erase'])
export interface Stroke {
  /** null = eraser */
  element: MapElement | null
  /** A stroke that starts on its own kind removes that kind; otherwise it fills empty cells only. */
  intent: 'place' | 'remove'
  visited: Set<string>
  last: Position
  draft: GridEditorDraft
  error?: EditError
}
/** The first cell uses the exact single-click rules (including direction / initial-state cycling). */
export function beginStroke(d: GridEditorDraft, p: Position, element: MapElement | null): Stroke {
  const old = elementAt(d, p)
  const result = element ? placeElement(d, p, element) : eraseElement(d, p)
  const removable = element && ['wall', 'goal', 'bomb', 'fragile', 'terrain'].includes(element.kind)
  return { element, intent: removable && old?.kind === element.kind ? 'remove' : 'place', visited: new Set([positionId(p)]), last: p, draft: result.draft, error: result.error }
}
/** Bresenham cells after `from` up to and including `to`, so fast pointer moves leave no gaps. */
export function cellsBetween(from: Position, to: Position): Position[] {
  const cells: Position[] = []
  const dx = Math.abs(to.x - from.x), dy = -Math.abs(to.y - from.y), sx = from.x < to.x ? 1 : -1, sy = from.y < to.y ? 1 : -1
  let x = from.x, y = from.y, error = dx + dy
  while (x !== to.x || y !== to.y) {
    const twice = 2 * error
    if (twice >= dy) { error += dy; x += sx }
    if (twice <= dx) { error += dx; y += sy }
    cells.push({ x, y })
  }
  return cells
}
export function extendStroke(stroke: Stroke, to: Position): Stroke {
  if (samePosition(stroke.last, to)) return stroke
  const tool: EditMode = stroke.element?.kind ?? 'erase'
  if (!PAINTABLE_TOOLS.has(tool)) return { ...stroke, last: to }
  let { draft, error } = stroke
  const visited = stroke.visited
  for (const p of cellsBetween(stroke.last, to)) {
    const key = positionId(p)
    if (visited.has(key) || p.x < 0 || p.y < 0 || p.x >= draft.width || p.y >= draft.height) continue
    visited.add(key)
    const old = elementAt(draft, p)
    if (!stroke.element) {
      const result = eraseElement(draft, p)
      draft = result.draft; error ??= result.error
    } else if (stroke.intent === 'remove') {
      if (old?.kind !== stroke.element.kind) continue
      const result = eraseElement(draft, p)
      draft = result.draft; error ??= result.error
    } else if (!old) draft = insert(draft, p, stroke.element)
  }
  return { ...stroke, draft, error, last: to }
}
