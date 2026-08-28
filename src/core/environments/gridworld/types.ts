export interface Position {
  x: number
  y: number
}

export interface GridWorldConfig {
  width: number
  height: number
  start: Position
  goal: Position
  walls: Position[]
  stepReward: number
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
