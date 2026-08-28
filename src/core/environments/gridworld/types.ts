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
}
