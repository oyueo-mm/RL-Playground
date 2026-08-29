export interface Position {
  x: number
  y: number
}

export interface GridWorldConfig {
  width: number
  height: number
  start: Position
  /** Phase 30 — one or more Goals; Episode ends only once every Goal has been collected. */
  goals: Position[]
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
  bombs: Position[]
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
