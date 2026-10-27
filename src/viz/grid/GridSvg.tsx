// GridWorld renderer. Consumes only the public EnvRenderModel (ARCHITECTURE.md §4.4)
// — never reaches into GridWorldEnv internals. Cell content is still read-only (Wall/
// Start/Goal/Reward editing is Phase 7's scope); Phase 4 adds only a State *selection*
// callback, which does not mutate the environment.

import type { EnvRenderModel } from '../../core/types/render'
import type { StateKey } from '../../core/types/rl'
import { FeatureOverlay } from './FeatureOverlay'
import { toggleWallOpen } from '../../core/environments/gridworld/features'
import { memo, type SVGProps } from 'react'

type GridRenderModel = Extract<EnvRenderModel, { kind: 'grid' }>

export interface GridSvgProps {
  renderModel: GridRenderModel
  cellSize?: number
  /** Currently selected State, if any (owned by the caller — GridSvg does not track its own selection). */
  selectedState?: StateKey | null
  /** Called with a cell's StateKey when it's clicked. Omit to keep the grid non-interactive. */
  /** `source` is 'keyboard' for Enter/Space activation; pointer clicks pass only the key. */
  onStateSelect?: (state: StateKey, source?: 'keyboard') => void
  /**
   * Phase 37 — forwarded to the root <svg>. Only the live App.tsx grid passes a value
   * here (CSS-responsive sizing, see App.tsx's `grid-stack`); EnvEditor.tsx's Draft
   * preview omits it, so its fixed cellSize=32 rendering is completely unaffected.
   */
  className?: string
  showAgent?: boolean
  ariaLabel?: string
  movable?: boolean
  interaction?: Pick<SVGProps<SVGSVGElement>, 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel' | 'onLostPointerCapture'>
}

/**
 * StateKey's "x,y" string format is the documented general convention
 * (ARCHITECTURE.md §4.1's `StateKey` comment), not a GridWorldEnv-private detail — safe
 * to parse here since this component is itself grid-shape-specific (`kind: 'grid'`).
 */
const valueBadge = (value: number | undefined) => value === undefined ? undefined : `${value > 0 ? '+' : ''}${value}`

function parsePosition(stateKey: string): { x: number; y: number } {
  const [x, y] = stateKey.split(',').map(Number)
  return { x, y }
}

type CellKind = 'empty' | 'wall' | 'start' | 'goal' | 'bomb'

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

interface GridCellProps { cellKey: StateKey; x: number; y: number; kind: CellKind; cellSize: number; select?: (key: StateKey, source?: 'keyboard') => void; description?: string; movable?: boolean; badge?: string }
// Rendered as a plain function, not a memoized component: a fiber per cell measurably
// slowed the initial render of 48×40 / 64×64 maps (see EDITOR_UX_V4_REPORT.md §16).
function renderCell({ cellKey, x, y, kind, cellSize, select, description, movable, badge }: GridCellProps) {
  const cx = x * cellSize + cellSize / 2
  const cy = y * cellSize + cellSize / 2
  return (
    <g key={cellKey}>
      <rect
        x={x * cellSize}
        y={y * cellSize}
        width={cellSize}
        height={cellSize}
        fill={cellFill[kind]}
        stroke="#d1d5db"
        style={{ cursor: select ? 'pointer' : undefined }}
        onClick={select ? () => select(cellKey) : undefined}
        role={select ? 'button' : undefined}
        tabIndex={select ? 0 : undefined}
        aria-label={select ? `Cell ${cellKey}: ${description ?? kind}` : undefined}
        onKeyDown={select ? (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            select(cellKey, 'keyboard')
          }
        } : undefined}
        data-testid={`cell-${cellKey}`}
        data-cell-kind={kind}
        data-movable={movable && (kind !== 'empty' || description !== undefined) ? 'true' : undefined}
      />
      {/*
        Phase 20: a simple bomb glyph (body + fuse + spark) built from the same
        SVG primitives already used elsewhere in this file (circle/line) — no icon
        dependency. pointerEvents="none" so it never intercepts the cell's own
        click handler above.
      */}
      {/* V4 — a goal/bomb with its own value shows it, so overrides are visible without opening the inspector. */}
      {badge && <text pointerEvents="none" data-testid={`value-badge-${cellKey}`} x={x * cellSize + cellSize * 0.06} y={y * cellSize + cellSize * 0.24} fontSize={cellSize * 0.2} fontWeight={600} fill={kind === 'goal' ? '#0f4d27' : '#7f1d1d'} stroke="white" strokeWidth={cellSize * 0.06} paintOrder="stroke">{badge}</text>}
      {kind === 'bomb' && (
        <g pointerEvents="none" data-testid={`bomb-marker-${cellKey}`}>
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
}

function GridSvgView({ renderModel, cellSize = 48, selectedState = null, onStateSelect, className, showAgent = true, ariaLabel = 'GridWorld', movable, interaction }: GridSvgProps) {
  const { width, height, walls, bombs, start, goals, agentPos } = renderModel
  const wallSet = new Set(walls)
  const bombSet = new Set(bombs)
  const goalSet = new Set(goals)
  const agent = parsePosition(agentPos)
  const svgWidth = width * cellSize
  const svgHeight = height * cellSize
  const descriptions = new Map<string, string>()
  renderModel.features?.portals?.forEach(pair => pair.ends.forEach(end => descriptions.set(`${end.x},${end.y}`, `Portal ${pair.id}`)))
  renderModel.features?.oneWays?.forEach(tile => descriptions.set(`${tile.x},${tile.y}`, `One-way ${['up', 'down', 'left', 'right'][tile.direction]}`))
  renderModel.features?.fragiles?.forEach(tile => descriptions.set(`${tile.x},${tile.y}`, renderModel.collapsedFragiles?.includes(`${tile.x},${tile.y}`) ? 'Collapsed fragile tile' : 'Fragile tile'))
  renderModel.features?.switches?.forEach(tile => descriptions.set(`${tile.x},${tile.y}`, `Switch ${tile.groupId}`))
  renderModel.features?.toggleWalls?.forEach(tile => descriptions.set(`${tile.x},${tile.y}`, `Toggle wall ${tile.groupId}, ${toggleWallOpen(tile, renderModel.openGroups?.includes(tile.groupId) ?? false) ? 'open' : 'closed'}`))

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
      {...interaction}
      width={svgWidth}
      height={svgHeight}
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      className={className}
      // Grid glyphs are graphics, not prose: repeated clicks must never paint a text selection.
      style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
      role={onStateSelect ? 'group' : 'img'}
      aria-label={ariaLabel}
      data-testid="grid-svg"
    >
      {cells.map(cell => renderCell({ cellKey: cell.key, x: cell.x, y: cell.y, kind: cell.kind, cellSize, select: onStateSelect, description: descriptions.get(cell.key), movable, badge: valueBadge(cell.kind === 'goal' ? renderModel.goalRewards?.[cell.key] : cell.kind === 'bomb' ? renderModel.bombPenalties?.[cell.key] : undefined) }))}
      <FeatureOverlay model={renderModel} cellSize={cellSize} selected={selectedState} />
      {selectedState ? (
        <rect
          x={parsePosition(selectedState).x * cellSize}
          y={parsePosition(selectedState).y * cellSize}
          width={cellSize}
          height={cellSize}
          fill="none"
          stroke="#102B50"
          strokeWidth={2.5}
          vectorEffect="non-scaling-stroke"
          rx={0}
          pointerEvents="none"
          data-testid="selected-cell-outline"
        />
      ) : null}
      {/*
        Phase 37 — pointerEvents="none", matching the exact pattern this file already
        uses for the bomb glyph and the selected-cell outline above: without it, a real
        browser's hit-test resolves the marker (the topmost element visually covering the
        cell) as the click target instead of the cell <rect> beneath it, silently
        swallowing clicks on whichever cell the Agent currently occupies. "none" makes the
        marker fully transparent to pointer events, so a click always lands on the cell
        underneath regardless of whether the Agent is standing there — the marker itself
        has no click handler to lose by this (it's purely visual).
      */}
      {showAgent && <circle
        cx={agent.x * cellSize + cellSize / 2}
        cy={agent.y * cellSize + cellSize / 2}
        r={cellSize / 3}
        fill="#ef4444"
        pointerEvents="none"
        data-testid="agent-marker"
      />}
    </svg>
  )
}

export const GridSvg = memo(GridSvgView, (a, b) => {
  if (a.showAgent !== false || b.showAgent !== false) return false
  const x = a.renderModel, y = b.renderModel
  return a.selectedState === b.selectedState && a.onStateSelect === b.onStateSelect && a.cellSize === b.cellSize && a.className === b.className && x.width === y.width && x.height === y.height && x.start === y.start && x.walls === y.walls && x.bombs === y.bombs && x.goals === y.goals && x.features === y.features && x.collapsedFragiles === y.collapsedFragiles && x.openGroups === y.openGroups
})
