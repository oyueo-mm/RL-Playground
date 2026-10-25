import type { Direction, Position } from '../../core/environments/gridworld/types'
import { positionId } from '../../core/environments/gridworld/features'
import { removeFeaturesAt, samePosition, type EditMode, type GridEditorDraft } from './envEditorDraft'

export type ElementKind = Exclude<EditMode, 'select' | 'erase'>
export interface MapElement { kind: ElementKind; portalId?: string; groupId?: string; direction?: Direction }
export type EditError = 'start' | 'last-goal' | 'portal-complete' | 'portal-merge' | 'bounds'
export interface EditResult { draft: GridEditorDraft; error?: EditError }

export function elementAt(d: GridEditorDraft, p: Position): MapElement | null {
  if (samePosition(d.start, p)) return { kind: 'start' }
  for (const [field, kind] of [['walls', 'wall'], ['goals', 'goal'], ['bombs', 'bomb'], ['fragiles', 'fragile']] as const) if (d[field]?.some(tile => samePosition(tile, p))) return { kind }
  const portal = d.portals?.find(pair => pair.ends.some(end => samePosition(end, p)))
  if (portal) return { kind: 'portal', portalId: portal.id }
  const way = d.oneWays?.find(tile => samePosition(tile, p))
  if (way) return { kind: 'oneWay', direction: way.direction }
  const pressed = d.switches?.find(tile => samePosition(tile, p))
  if (pressed) return { kind: 'switch', groupId: pressed.groupId }
  const wall = d.toggleWalls?.find(tile => samePosition(tile, p))
  return wall ? { kind: 'toggleWall', groupId: wall.groupId } : null
}
function erase(d: GridEditorDraft, p: Position): GridEditorDraft {
  return { ...d, ...removeFeaturesAt(d, p), walls: d.walls.filter(tile => !samePosition(tile, p)), goals: d.goals.filter(tile => !samePosition(tile, p)), bombs: d.bombs.filter(tile => !samePosition(tile, p)) }
}
function insert(d: GridEditorDraft, p: Position, element: MapElement): GridEditorDraft {
  switch (element.kind) {
    case 'start': return { ...d, start: p }
    case 'wall': return { ...d, walls: [...d.walls, p] }
    case 'goal': return { ...d, goals: [...d.goals, p] }
    case 'bomb': return { ...d, bombs: [...d.bombs, p] }
    case 'fragile': return { ...d, fragiles: [...(d.fragiles ?? []), p] }
    case 'oneWay': return { ...d, oneWays: [...(d.oneWays ?? []), { ...p, direction: element.direction ?? 3 }] }
    case 'switch': return { ...d, switches: [...(d.switches ?? []), { ...p, groupId: element.groupId ?? 'G1' }] }
    case 'toggleWall': return { ...d, toggleWalls: [...(d.toggleWalls ?? []), { ...p, groupId: element.groupId ?? 'G1' }] }
    case 'portal': {
      const id = element.portalId ?? 'P1'
      const pair = d.portals?.find(pair => pair.id === id)
      return { ...d, portals: pair ? d.portals?.map(pair => pair.id === id ? { ...pair, ends: [...pair.ends, p] } : pair) : [...(d.portals ?? []), { id, ends: [p] }] }
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
    if (incoming.kind === 'goal' && d.goals.length === 1) return { draft: d, error: 'last-goal' }
    if (['wall', 'bomb', 'goal'].includes(incoming.kind)) return { draft: erase(d, p) }
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
  return { draft: insert(erase(erase(d, from), to), to, element) }
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
