// Phase 26 — draws the selected Episode's actual movement path on top of GridSvg, as a
// separate absolutely positioned <svg> layer (same composition pattern PolicyOverlay/
// ValueHeatmap already established — GridSvg itself is left untouched). Unlike those two
// (aria-hidden, purely decorative restatements of data already accessible elsewhere via
// Q-value bars), this overlay is a primary way trajectory data is shown, so it carries a
// real `role="img"`/`aria-label` — the full text equivalent lives alongside it in
// EpisodeTrajectory.tsx's step table (Phase 26 §17 accessibility requirement).
//
// Draws the ordered transition sequence as a single connected path (not a deduplicated
// "visited state" set — see SimulationEngine.ts's Phase 26 comment on why
// episodeVisitedStates, a Set, could never have been reused for this), with a small
// numbered marker at every step (0..steps). A State visited more than once gets a small
// fixed offset per repeat so its markers don't fully overlap — the authoritative,
// unambiguous record of repeat visits is the ordered step table in EpisodeTrajectory.tsx.

import type { EpisodeStats } from '../../core/engine/types'
import type { EnvRenderModel } from '../../core/types/render'
import { parseStateKey } from './stateKey'

type GridRenderModel = Extract<EnvRenderModel, { kind: 'grid' }>

export interface TrajectoryOverlayProps {
  renderModel: GridRenderModel
  episodeStatsHistory: EpisodeStats[]
  selectedEpisode?: number | null
  cellSize?: number
  className?: string
  ariaLabel: string
}

// Small pixel offsets applied to repeat visits of the same State, so a 2nd/3rd/... marker
// at the same cell doesn't land exactly on top of the first (cycles if visited more than
// REPEAT_OFFSETS.length times — markers start overlapping again past that, same as any
// finite palette would, but the ordered path line and the step table remain fully exact).
const REPEAT_OFFSETS = [
  { dx: 0, dy: 0 },
  { dx: 7, dy: -7 },
  { dx: -7, dy: 7 },
  { dx: 7, dy: 7 },
  { dx: -7, dy: -7 },
]

export function TrajectoryOverlay({
  renderModel,
  episodeStatsHistory,
  selectedEpisode = null,
  cellSize = 48,
  className,
  ariaLabel,
}: TrajectoryOverlayProps) {
  const episode = selectedEpisode == null ? null : (episodeStatsHistory.find((e) => e.episode === selectedEpisode) ?? null)

  if (episode === null || episode.trajectory.length === 0) return null

  const width = renderModel.width * cellSize
  const height = renderModel.height * cellSize

  const center = (stateKey: string) => {
    const { x, y } = parseStateKey(stateKey)
    return { cx: x * cellSize + cellSize / 2, cy: y * cellSize + cellSize / 2 }
  }

  const visitCounts = new Map<string, number>()
  function nextOffsetFor(stateKey: string) {
    const visits = visitCounts.get(stateKey) ?? 0
    visitCounts.set(stateKey, visits + 1)
    return REPEAT_OFFSETS[visits % REPEAT_OFFSETS.length]
  }

  const points = episode.trajectory.map((step, index) => {
    const { cx, cy } = center(step.state)
    const offset = nextOffsetFor(step.state)
    return { index, x: cx + offset.dx, y: cy + offset.dy }
  })
  // The final point is the last transition's destination (Goal/Bomb/wherever it ended) —
  // trajectory only records each step's *starting* state, so the very last position
  // reached is otherwise never plotted.
  const last = episode.trajectory[episode.trajectory.length - 1]
  const lastCenter = center(last.nextState)
  const lastOffset = nextOffsetFor(last.nextState)
  points.push({ index: episode.trajectory.length, x: lastCenter.cx + lastOffset.dx, y: lastCenter.cy + lastOffset.dy })

  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      pointerEvents="none"
      role="img"
      aria-label={ariaLabel}
      data-testid="trajectory-overlay"
    >
      <path d={d} fill="none" stroke="#f97316" strokeWidth={2} data-testid="trajectory-path" />
      {points.map((p) => (
        <g key={p.index} data-testid={`trajectory-marker-${p.index}`}>
          <circle cx={p.x} cy={p.y} r={7} fill="#f97316" stroke="white" strokeWidth={1.5} />
          <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontSize={9} fill="white">
            {p.index}
          </text>
        </g>
      ))}
    </svg>
  )
}
