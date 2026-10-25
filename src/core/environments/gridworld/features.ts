import type { GridFeatures, GridWorldConfig, Position } from './types'

export const FEATURE_FIELDS = ['portals', 'oneWays', 'fragiles', 'switches', 'toggleWalls'] as const
export const STATE_SPACE_BUDGET = 262_144
export const positionId = (pos: Position) => `${pos.x},${pos.y}`
const validId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,24}$/.test(value)
const isPosition = (value: unknown): value is Position => typeof value === 'object' && value !== null && Number.isInteger((value as Position).x) && Number.isInteger((value as Position).y)

/** Parse optional version-2 fields at both the engine and JSON boundaries. */
export function readFeatures(raw: Record<string, unknown>): GridFeatures {
  for (const name of FEATURE_FIELDS) {
    const value = raw[name]
    if (value === undefined) continue
    if (!Array.isArray(value)) throw new Error(`${name} must be an array.`)
    for (const item of value) {
      if (name === 'portals') {
        if (!item || !validId(item.id) || !Array.isArray(item.ends) || !item.ends.every(isPosition)) throw new Error('Invalid portal ID or endpoints.')
      } else {
        if (!isPosition(item)) throw new Error(`Invalid ${name} coordinates.`)
        if (name === 'oneWays' && ![0, 1, 2, 3].includes((item as unknown as { direction: number }).direction)) throw new Error('One-way direction must be 0, 1, 2 or 3.')
        if ((name === 'switches' || name === 'toggleWalls') && !validId((item as unknown as { groupId: string }).groupId)) throw new Error('Invalid switch/wall group ID.')
      }
    }
  }
  return Object.fromEntries(FEATURE_FIELDS.filter(name => Array.isArray(raw[name]) && (raw[name] as unknown[]).length > 0).map(name => [name, structuredClone(raw[name])])) as GridFeatures
}

export function featurePositions(features: GridFeatures): Position[] {
  return [...(features.portals ?? []).flatMap(pair => pair.ends), ...(features.oneWays ?? []), ...(features.fragiles ?? []), ...(features.switches ?? []), ...(features.toggleWalls ?? [])]
}
/** Drafts may be temporarily invalid; copying must never validate or repair them. */
export function copyFeatures(features: GridFeatures): GridFeatures {
  return Object.fromEntries(FEATURE_FIELDS.filter(field => features[field]?.length).map(field => [field, structuredClone(features[field])])) as GridFeatures
}
export function groupIds(features: GridFeatures): string[] { return [...new Set((features.toggleWalls ?? []).map(wall => wall.groupId))].sort() }
export function stateSpaceEstimate(map: Pick<GridWorldConfig, 'width' | 'height' | 'goals'> & GridFeatures): number {
  return map.width * map.height * 2 ** (map.goals.length + (map.fragiles?.length ?? 0) + groupIds(map).length)
}

/** New features share no coordinates with each other or any ordinary map element. */
export function validateFeatures(map: Pick<GridWorldConfig, 'width' | 'height' | 'start' | 'goals' | 'walls' | 'bombs'> & GridFeatures): string[] {
  const errors: string[] = []
  try { readFeatures(map as unknown as Record<string, unknown>) } catch (error) { return [(error as Error).message] }
  const positions = featurePositions(map)
  if (!positions.length && !map.portals?.length) return errors
  if (!Number.isInteger(map.width) || !Number.isInteger(map.height) || map.width < 1 || map.height < 1 || map.width > 20 || map.height > 20) errors.push('Feature maps require integer dimensions between 1 and 20.')
  if (!map.goals.length) errors.push('At least one Goal is required.')
  if (positions.some(pos => pos.x < 0 || pos.y < 0 || pos.x >= map.width || pos.y >= map.height)) errors.push('Special element coordinates are outside the map.')
  const occupied = new Set([map.start, ...map.goals, ...map.walls, ...map.bombs].map(positionId))
  for (const pos of positions) {
    const key = positionId(pos)
    if (occupied.has(key)) errors.push(`Overlapping map elements at ${key}.`)
    occupied.add(key)
  }
  if (map.portals?.some(pair => pair.ends.length !== 2)) errors.push('Each portal pair must have exactly two endpoints.')
  if (new Set(map.portals?.map(pair => pair.id)).size !== (map.portals?.length ?? 0)) errors.push('Portal pair IDs must be unique.')
  const switches = new Set(map.switches?.map(tile => tile.groupId))
  const walls = new Set(groupIds(map))
  if ([...switches].some(id => !walls.has(id)) || [...walls].some(id => !switches.has(id))) errors.push('Each toggle group needs at least one switch and one wall.')
  // Preserve all legacy static maps. Dynamic maps must budget the FULL state space,
  // including goals; counting only fragile tiles or groups would underestimate it.
  if (((map.fragiles?.length ?? 0) > 0 || walls.size > 0) && stateSpaceEstimate(map) > STATE_SPACE_BUDGET) errors.push(`Estimated state space exceeds ${STATE_SPACE_BUDGET} (cells × 2^(goals + fragile tiles + wall groups)). Reduce goals or dynamic elements.`)
  return [...new Set(errors)]
}
