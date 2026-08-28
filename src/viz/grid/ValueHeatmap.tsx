// Renders V(s) = max_a Q(s,a) as color intensity per visited State. Reads only
// EngineSnapshot.agentSnapshot — same data-source contract as PolicyOverlay. Composed
// as a separate absolutely positioned <svg> layer (see App.tsx), GridSvg untouched.

import type { AgentSnapshot, EnvRenderModel } from '../../core/types/render'
import { parseStateKey } from './stateKey'

type GridRenderModel = Extract<EnvRenderModel, { kind: 'grid' }>

export interface ValueHeatmapProps {
  renderModel: GridRenderModel
  agentSnapshot: AgentSnapshot
  cellSize?: number
  className?: string
}

const MIN_MAX_ABS = 1e-6 // avoids a divide-by-zero when every visited value is exactly 0
const MAX_OPACITY = 0.65

export function ValueHeatmap({ renderModel, agentSnapshot, cellSize = 48, className }: ValueHeatmapProps) {
  const width = renderModel.width * cellSize
  const height = renderModel.height * cellSize

  // V(s) is only defined for a Q-table (this Phase's only Agent, Q-Learning). A
  // ValueAgent (Future — TD(0)) would already store V(s) directly, but no Algorithm
  // uses it yet (ARCHITECTURE.md §11), so there's nothing to generalize to here yet.
  const values =
    agentSnapshot.kind === 'Q'
      ? Object.entries(agentSnapshot.qTable).map(([state, qVector]) => ({
          state,
          value: Math.max(...qVector),
        }))
      : []

  const maxAbs = Math.max(MIN_MAX_ABS, ...values.map((entry) => Math.abs(entry.value)))

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      pointerEvents="none"
      aria-hidden
      data-testid="value-heatmap"
    >
      {values.map(({ state, value }) => {
        const { x, y } = parseStateKey(state)
        // 0-centered normalization: intensity scales with |value| relative to the
        // largest |value| currently visible, capped at 1 so it can never overflow the
        // visual range regardless of how large Q-values grow.
        const intensity = Math.min(1, Math.abs(value) / maxAbs)
        const opacity = intensity * MAX_OPACITY
        const color = value >= 0 ? `rgba(34, 197, 94, ${opacity})` : `rgba(239, 68, 68, ${opacity})`
        return (
          <rect
            key={state}
            x={x * cellSize}
            y={y * cellSize}
            width={cellSize}
            height={cellSize}
            fill={color}
            data-testid={`value-cell-${state}`}
            data-value={value}
          />
        )
      })}
    </svg>
  )
}
