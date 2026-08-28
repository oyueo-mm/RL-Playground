// Renders argmax_a Q(s,a) as an arrow per visited State. Reads only
// EngineSnapshot.agentSnapshot (AgentSnapshot.qTable, src/core/types/render.ts) — never
// touches TabularQAgent or any live Agent method. Composed as a separate, absolutely
// positioned <svg> layer on top of GridSvg (see App.tsx) rather than modifying GridSvg
// itself, so GridSvg's Phase 1~4 rendering and tests stay untouched.

import type { AgentSnapshot, EnvRenderModel } from '../../core/types/render'
import { GRIDWORLD_ACTION_LABELS } from './actionLabels'
import { argmaxLowestIndex } from './policy'
import { parseStateKey } from './stateKey'

type GridRenderModel = Extract<EnvRenderModel, { kind: 'grid' }>

export interface PolicyOverlayProps {
  renderModel: GridRenderModel
  agentSnapshot: AgentSnapshot
  cellSize?: number
  className?: string
}

const ARROW_BY_LABEL: Record<string, string> = {
  Up: '↑',
  Down: '↓',
  Left: '←',
  Right: '→',
}

export function PolicyOverlay({ renderModel, agentSnapshot, cellSize = 48, className }: PolicyOverlayProps) {
  const width = renderModel.width * cellSize
  const height = renderModel.height * cellSize

  // Only ActionValueAgent (Q-Learning) has a policy to display. A ValueAgent (Future —
  // TD(0)) has no per-action values to argmax over, so nothing is drawn (never a guess).
  const entries = agentSnapshot.kind === 'Q' ? Object.entries(agentSnapshot.qTable) : []

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      pointerEvents="none"
      aria-hidden
      data-testid="policy-overlay"
    >
      {entries.map(([state, qVector]) => {
        const { x, y } = parseStateKey(state)
        const action = argmaxLowestIndex(qVector)
        const label = GRIDWORLD_ACTION_LABELS[action]
        const arrow = label ? ARROW_BY_LABEL[label] : undefined
        if (!arrow) return null // unknown action index — draw nothing rather than a guess
        return (
          <text
            key={state}
            x={x * cellSize + cellSize / 2}
            y={y * cellSize + cellSize / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={cellSize * 0.5}
            fill="#1d4ed8"
            data-testid={`policy-arrow-${state}`}
            data-action={action}
          >
            {arrow}
          </text>
        )
      })}
    </svg>
  )
}
