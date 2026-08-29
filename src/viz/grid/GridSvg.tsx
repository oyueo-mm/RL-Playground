// GridWorld renderer. Consumes only the public EnvRenderModel (ARCHITECTURE.md §4.4)
// — never reaches into GridWorldEnv internals. Cell content is still read-only (Wall/
// Start/Goal/Reward editing is Phase 7's scope); Phase 4 adds only a State *selection*
// callback, which does not mutate the environment.

import type { EnvRenderModel } from '../../core/types/render'
import type { StateKey } from '../../core/types/rl'

type GridRenderModel = Extract<EnvRenderModel, { kind: 'grid' }>

export interface GridSvgProps {
  renderModel: GridRenderModel
  cellSize?: number
  /** Currently selected State, if any (owned by the caller — GridSvg does not track its own selection). */
  selectedState?: StateKey | null
  /** Called with a cell's StateKey when it's clicked. Omit to keep the grid non-interactive. */
  onStateSelect?: (state: StateKey) => void
}

/**
 * StateKey's "x,y" string format is the documented general convention
 * (ARCHITECTURE.md §4.1's `StateKey` comment), not a GridWorldEnv-private detail — safe
 * to parse here since this component is itself grid-shape-specific (`kind: 'grid'`).
 */
function parsePosition(stateKey: string): { x: number; y: number } {
  const [x, y] = stateKey.split(',').map(Number)
  return { x, y }
}

type CellKind = 'empty' | 'wall' | 'start' | 'goal' | 'bomb'

export function GridSvg({ renderModel, cellSize = 48, selectedState = null, onStateSelect }: GridSvgProps) {
  const { width, height, walls, bombs, start, goals, agentPos } = renderModel
  const wallSet = new Set(walls)
  const bombSet = new Set(bombs)
  const goalSet = new Set(goals)
  const agent = parsePosition(agentPos)
  const svgWidth = width * cellSize
  const svgHeight = height * cellSize

  const cellFill: Record<CellKind, string> = {
    empty: '#ffffff',
    wall: '#374151',
    start: '#93c5fd',
    goal: '#22c55e',
    // Light red — distinct from Wall's dark gray at a glance, and from the light gray
    // grid lines; the bomb glyph drawn on top (see below) carries the rest of the
    // distinction so this cell doesn't rely on color alone.
    bomb: '#fecaca',
  }

  const cells: Array<{ key: string; x: number; y: number; kind: CellKind }> = []
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const key = `${x},${y}`
      let kind: CellKind = 'empty'
      if (wallSet.has(key)) kind = 'wall'
      else if (bombSet.has(key)) kind = 'bomb'
      else if (goalSet.has(key)) kind = 'goal'
      else if (key === start) kind = 'start'
      cells.push({ key, x, y, kind })
    }
  }

  return (
    <svg
      width={svgWidth}
      height={svgHeight}
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      role="img"
      aria-label="GridWorld"
      data-testid="grid-svg"
    >
      {cells.map((cell) => {
        const cx = cell.x * cellSize + cellSize / 2
        const cy = cell.y * cellSize + cellSize / 2
        return (
          <g key={cell.key}>
            <rect
              x={cell.x * cellSize}
              y={cell.y * cellSize}
              width={cellSize}
              height={cellSize}
              fill={cellFill[cell.kind]}
              stroke="#d1d5db"
              style={{ cursor: onStateSelect ? 'pointer' : undefined }}
              onClick={onStateSelect ? () => onStateSelect(cell.key) : undefined}
              data-testid={`cell-${cell.key}`}
              data-cell-kind={cell.kind}
            />
            {/*
              Phase 20: a simple bomb glyph (body + fuse + spark) built from the same
              SVG primitives already used elsewhere in this file (circle/line) — no icon
              dependency. pointerEvents="none" so it never intercepts the cell's own
              click handler above.
            */}
            {cell.kind === 'bomb' && (
              <g pointerEvents="none" data-testid={`bomb-marker-${cell.key}`}>
                <circle cx={cx} cy={cy + cellSize * 0.08} r={cellSize * 0.24} fill="#1f2937" />
                <line
                  x1={cx + cellSize * 0.1}
                  y1={cy - cellSize * 0.14}
                  x2={cx + cellSize * 0.24}
                  y2={cy - cellSize * 0.32}
                  stroke="#b45309"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
                <circle cx={cx + cellSize * 0.26} cy={cy - cellSize * 0.36} r={cellSize * 0.05} fill="#f59e0b" />
              </g>
            )}
          </g>
        )
      })}
      {selectedState ? (
        <rect
          x={parsePosition(selectedState).x * cellSize}
          y={parsePosition(selectedState).y * cellSize}
          width={cellSize}
          height={cellSize}
          fill="none"
          stroke="#f59e0b"
          strokeWidth={3}
          pointerEvents="none"
          data-testid="selected-cell-outline"
        />
      ) : null}
      <circle
        cx={agent.x * cellSize + cellSize / 2}
        cy={agent.y * cellSize + cellSize / 2}
        r={cellSize / 3}
        fill="#ef4444"
        data-testid="agent-marker"
      />
    </svg>
  )
}
