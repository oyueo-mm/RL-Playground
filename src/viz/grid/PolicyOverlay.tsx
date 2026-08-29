// Renders argmax_a Q(s,a) as an arrow per visited State. Reads only
// EngineSnapshot.agentSnapshot (AgentSnapshot.qTable, src/core/types/render.ts) — never
// touches TabularQAgent or any live Agent method. Composed as a separate, absolutely
// positioned <svg> layer on top of GridSvg (see App.tsx) rather than modifying GridSvg
// itself, so GridSvg's Phase 1~4 rendering and tests stay untouched.
//
// Phase 36: Phase 34's State Representation ("x,y,mask") means a single grid position can
// legitimately have multiple distinct Q-table entries (one per Goal-collection mask ever
// visited there), which previously rendered as multiple overlapping arrows at the same
// cell. Fixed by keeping only the entry whose mask matches the Environment's CURRENT
// mask (via the new `currentState` prop, same pattern QValueBars.tsx already established
// in Phase 34) before rendering — this is not a new tie-break rule (argmaxLowestIndex()
// itself is untouched), it is a *which entries are even considered* filter: for a fixed
// mask, at most one Q-table entry can exist per position, so this guarantees exactly one
// arrow per cell without arbitrarily picking among genuinely different situations.

import type { AgentSnapshot, EnvRenderModel } from '../../core/types/render'
import type { StateKey } from '../../core/types/rl'
import { GRIDWORLD_ACTION_ARROWS, GRIDWORLD_ACTION_LABELS } from './actionLabels'
import { argmaxLowestIndex } from './policy'
import { parseStateKey, stateMask } from './stateKey'

type GridRenderModel = Extract<EnvRenderModel, { kind: 'grid' }>

export interface PolicyOverlayProps {
  renderModel: GridRenderModel
  agentSnapshot: AgentSnapshot
  /**
   * Phase 36 — the Engine's current RL State (`EngineSnapshot.currentState`). Supplies
   * the live mask used to pick exactly one Q-table entry per grid position (see file
   * header). Optional/defaults to matching "no mask" for pre-Phase-36 callers/tests that
   * don't pass it, so an omitted prop degrades to the old plain-"x,y" behavior rather
   * than silently rendering nothing.
   */
  currentState?: StateKey | null
  cellSize?: number
  className?: string
}

export function PolicyOverlay({ renderModel, agentSnapshot, currentState, cellSize = 48, className }: PolicyOverlayProps) {
  const width = renderModel.width * cellSize
  const height = renderModel.height * cellSize

  // Only ActionValueAgent (Q-Learning) has a policy to display. A ValueAgent (Future —
  // TD(0)) has no per-action values to argmax over, so nothing is drawn (never a guess).
  const currentMask = currentState ? stateMask(currentState) : undefined
  const entries =
    agentSnapshot.kind === 'Q'
      ? Object.entries(agentSnapshot.qTable).filter(([state]) => stateMask(state) === currentMask)
      : []

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
        const arrow = label ? GRIDWORLD_ACTION_ARROWS[label] : undefined
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
