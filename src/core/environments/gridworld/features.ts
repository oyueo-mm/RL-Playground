import type { BombTile, GoalTile, GridFeatures, GridWorldConfig, Position, TerrainTile, ToggleWallTile } from './types'

export const FEATURE_FIELDS = ['portals', 'oneWays', 'fragiles', 'switches', 'toggleWalls', 'terrains'] as const
/** Swamp cost used when neither the tile nor the map sets one. */
export const DEFAULT_TERRAIN_COST = -1
export const validTerrainCost = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value <= 0
/** Informational complexity threshold, never an admission limit. */
export const STATE_SPACE_WARNING = 262_144
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
        if (item.directed !== undefined && item.directed !== true) throw new Error('Portal direction must be one-way or omitted.')
      } else {
        if (!isPosition(item)) throw new Error(`Invalid ${name} coordinates.`)
        if (name === 'oneWays' && ![0, 1, 2, 3].includes((item as unknown as { direction: number }).direction)) throw new Error('One-way direction must be 0, 1, 2 or 3.')
        if ((name === 'switches' || name === 'toggleWalls') && !validId((item as unknown as { groupId: string }).groupId)) throw new Error('Invalid switch/wall group ID.')
        if (name === 'terrains' && (item as TerrainTile).cost !== undefined && !validTerrainCost((item as TerrainTile).cost)) throw new Error('Swamp costs must be finite numbers no greater than 0.')
        if (name === 'toggleWalls' && (item as ToggleWallTile).initialOpen !== undefined && typeof (item as ToggleWallTile).initialOpen !== 'boolean') throw new Error('Toggle wall initial state must be open or closed.')
      }
    }
  }
  if (raw.terrainCost !== undefined && !validTerrainCost(raw.terrainCost)) throw new Error('Swamp costs must be finite numbers no greater than 0.')
  const features = Object.fromEntries(FEATURE_FIELDS.filter(name => Array.isArray(raw[name]) && (raw[name] as unknown[]).length > 0).map(name => [name, structuredClone(raw[name])])) as GridFeatures
  if (features.terrains?.length && raw.terrainCost !== undefined) features.terrainCost = raw.terrainCost as number
  return features
}

/** V4 — a toggle wall's live state: its own initial state flipped once per odd group toggle. */
export const toggleWallOpen = (tile: ToggleWallTile, groupToggled: boolean): boolean => !!tile.initialOpen !== groupToggled
/** V4 — per-element values; omitted means "inherit the map-wide goalReward/bombPenalty". */
export const goalRewardOf = (goal: GoalTile, fallback: number): number => goal.reward ?? fallback
export const bombPenaltyOf = (bomb: BombTile, fallback: number): number => bomb.penalty ?? fallback
/** Any finite real (positive, zero or negative) is a valid per-element override, same policy as the map-wide fields. */
export function elementValueErrors(map: { goals: GoalTile[]; bombs: BombTile[] }): string[] {
  const errors: string[] = []
  if (map.goals.some(goal => goal.reward !== undefined && (typeof goal.reward !== 'number' || !Number.isFinite(goal.reward)))) errors.push('Goal rewards must be finite numbers.')
  if (map.bombs.some(bomb => bomb.penalty !== undefined && (typeof bomb.penalty !== 'number' || !Number.isFinite(bomb.penalty)))) errors.push('Bomb penalties must be finite numbers.')
  return errors
}
/** True when a map needs the v4 export schema: swamps or one-way portals. */
export function hasV5Elements(map: GridFeatures): boolean {
  return !!map.terrains?.length || !!map.portals?.some(pair => pair.directed)
}
/** True when a map uses any v3-only per-element field (goal reward, bomb penalty, initially open door). */
export function hasElementOverrides(map: { goals: GoalTile[]; bombs: BombTile[] } & GridFeatures): boolean {
  return map.goals.some(goal => goal.reward !== undefined) || map.bombs.some(bomb => bomb.penalty !== undefined) || !!map.toggleWalls?.some(tile => tile.initialOpen)
}

export function featurePositions(features: GridFeatures): Position[] {
  return [...(features.portals ?? []).flatMap(pair => pair.ends), ...(features.oneWays ?? []), ...(features.fragiles ?? []), ...(features.switches ?? []), ...(features.toggleWalls ?? []), ...(features.terrains ?? [])]
}
/** Drafts may be temporarily invalid; copying must never validate or repair them. */
export function copyFeatures(features: GridFeatures): GridFeatures {
  const copy = Object.fromEntries(FEATURE_FIELDS.filter(field => features[field]?.length).map(field => [field, structuredClone(features[field])])) as GridFeatures
  if (copy.terrains?.length && features.terrainCost !== undefined) copy.terrainCost = features.terrainCost
  return copy
}
export function groupIds(features: GridFeatures): string[] { return [...new Set((features.toggleWalls ?? []).map(wall => wall.groupId))].sort() }
export function stateSpaceEstimate(map: Pick<GridWorldConfig, 'width' | 'height' | 'goals'> & GridFeatures): number {
  return map.width * map.height * 2 ** (map.goals.length + (map.fragiles?.length ?? 0) + groupIds(map).length)
}

export function stateSpaceDetails(map: Pick<GridWorldConfig, 'width' | 'height' | 'goals'> & GridFeatures) {
  const goals = map.goals.length, fragiles = map.fragiles?.length ?? 0, groups = groupIds(map).length
  const cells = map.width * map.height
  const log10 = Math.log10(cells) + (goals + fragiles + groups) * Math.LOG10E * Math.LN2
  const valid = Number.isFinite(log10) && cells > 0
  const exact = valid && Number.isSafeInteger(cells) && goals + fragiles + groups <= 1024 ? BigInt(cells) << BigInt(goals + fragiles + groups) : null
  const text = !valid ? '—' : exact !== null && exact <= BigInt(Number.MAX_SAFE_INTEGER) ? exact.toLocaleString('en-US') : `≈ ${(10 ** (log10 - Math.floor(log10))).toFixed(2)} × 10^${Math.floor(log10)}`
  return { goals, fragiles, groups, text, log10, large: valid && log10 > Math.log10(STATE_SPACE_WARNING) }
}

/** New features share no coordinates with each other or any ordinary map element. */
export function validateFeatures(map: Pick<GridWorldConfig, 'width' | 'height' | 'start' | 'goals' | 'walls' | 'bombs'> & GridFeatures): string[] {
  const errors: string[] = elementValueErrors(map)
  try { readFeatures(map as unknown as Record<string, unknown>) } catch (error) { return [...errors, (error as Error).message] }
  const positions = featurePositions(map)
  if (!Number.isInteger(map.width) || !Number.isInteger(map.height) || map.width < 1 || map.height < 1 || map.width > 64 || map.height > 64) errors.push('Feature maps require integer dimensions between 1 and 64.')
  if (!positions.length && !map.portals?.length) return errors
  if (!map.goals.length) errors.push('At least one Goal is required.')
  const base = [map.start, ...map.goals, ...map.walls, ...map.bombs]
  if (base.some(pos => !isPosition(pos) || pos.x < 0 || pos.y < 0 || pos.x >= map.width || pos.y >= map.height)) errors.push('Base element coordinates are outside the map or invalid.')
  if (new Set(base.map(positionId)).size !== base.length) errors.push('Base map elements cannot overlap.')
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
  return [...new Set(errors)]
}
