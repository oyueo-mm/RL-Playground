export interface Position {
  x: number
  y: number
}

export type Direction = 0 | 1 | 2 | 3
/** `directed: true` makes the pair one-way: entering `ends[0]` (A) lands on `ends[1]` (B); entering B is an ordinary move. Omitted = the original two-way pair. */
export interface PortalPair { id: string; ends: Position[]; directed?: true }
/**
 * V5 — a swamp tile is walkable; entering it pays `cost` instead of `stepReward`. Omitted `cost`
 * inherits the map-wide `terrainCost` (default -1). Static terrain: it adds no state bits.
 */
export interface TerrainTile extends Position { cost?: number }
export interface OneWayTile extends Position { direction: Direction }
export interface GroupTile extends Position { groupId: string }
/**
 * V4 — a toggle wall may start open. Omitted/false means closed (every pre-V4 map).
 * A switch flips every wall of its group relative to its own current state, so the wall's
 * live state is `initialOpen XOR (group toggled an odd number of times)`.
 */
export interface ToggleWallTile extends GroupTile { initialOpen?: boolean }
/** V4 — a Goal with an optional own first-collection reward; omitted inherits `goalReward`. */
export interface GoalTile extends Position { reward?: number }
/** V4 — a Bomb with an optional own penalty (same sign convention as `bombPenalty`); omitted inherits it. */
export interface BombTile extends Position { penalty?: number }
export interface GridFeatures {
  portals?: PortalPair[]
  oneWays?: OneWayTile[]
  fragiles?: Position[]
  switches?: GroupTile[]
  toggleWalls?: ToggleWallTile[]
  terrains?: TerrainTile[]
  /** Map-wide default swamp cost; finite and <= 0. Only meaningful (and only exported) with `terrains`. */
  terrainCost?: number
}

export interface GridWorldConfig extends GridFeatures {
  width: number
  height: number
  start: Position
  /** Phase 30 — one or more Goals; Episode ends only once every Goal has been collected. */
  goals: GoalTile[]
  walls: Position[]
  stepReward: number
  /**
   * Phase 30 — reward for an attempted move blocked by a Wall (or an out-of-bounds
   * attempt), kept independent of `stepReward` so a user can e.g. set stepReward=-0.1 but
   * wallPenalty=-1.0. Previously wall/boundary collisions silently reused `stepReward`.
   */
  wallPenalty: number
  goalReward: number
  /** Extension point for FR-9 (Post-MVP): additional terminal cells beyond goal. */
  terminalCells: Position[]
  /**
   * Phase 20 (PRODUCT_SPEC.md FR-10 "Trap"): entering a bomb cell ends the Episode
   * immediately with `bombPenalty` as the reward, same terminal mechanics as Goal.
   * Kept separate from `terminalCells` (rather than folding bombs into it) because
   * `terminalCells` carries no reward information of its own — bombs need a distinct,
   * uniform penalty value alongside their positions.
   */
  bombs: BombTile[]
  bombPenalty: number
}

/**
 * Phase 30 — legacy input shape accepted at the `unknown`-typed Environment config
 * boundary (SimulationEngineOptions.envConfig / ResetOverrides.envConfig): a singular
 * `goal: Position` and no `wallPenalty`. Normalized into the canonical `GridWorldConfig`
 * shape by `normalizeGridWorldConfig()` so the ~66 existing `goal: {x,y}`-shaped test
 * fixtures across the codebase keep working unmodified.
 */
export type LegacyGridWorldConfigInput = Omit<GridWorldConfig, 'goals' | 'wallPenalty'> &
  Partial<Pick<GridWorldConfig, 'goals' | 'wallPenalty'>> & { goal?: Position }
