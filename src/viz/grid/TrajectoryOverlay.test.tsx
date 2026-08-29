// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { EpisodeStats } from '../../core/engine/types'
import type { EnvRenderModel } from '../../core/types/render'
import { TrajectoryOverlay } from './TrajectoryOverlay'

afterEach(cleanup)

type GridRenderModel = Extract<EnvRenderModel, { kind: 'grid' }>

function gridRenderModel(overrides: Partial<GridRenderModel> = {}): GridRenderModel {
  return {
    kind: 'grid',
    width: 4,
    height: 4,
    walls: [],
    bombs: [],
    bombPenalty: -10,
    start: '0,3',
    goals: ['0,0'],
    agentPos: '0,3',
    ...overrides,
  }
}

function episodeStats(overrides: Partial<EpisodeStats> = {}): EpisodeStats {
  return {
    episode: 1,
    steps: 3,
    totalReward: 8,
    terminationReason: 'goal',
    explorationCount: 0,
    exploitationCount: 3,
    explorationRate: 0,
    averageReward: 8 / 3,
    uniqueStates: 4,
    trajectory: [
      { state: '0,3', action: 0, nextState: '0,2', reward: -1, done: false },
      { state: '0,2', action: 0, nextState: '0,1', reward: -1, done: false },
      { state: '0,1', action: 0, nextState: '0,0', reward: 10, done: true },
    ],
    ...overrides,
  }
}

describe('TrajectoryOverlay', () => {
  it('renders nothing when selectedEpisode is not provided', () => {
    const { container } = render(
      <TrajectoryOverlay renderModel={gridRenderModel()} episodeStatsHistory={[episodeStats()]} ariaLabel="x" />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when selectedEpisode is not found in history', () => {
    const { container } = render(
      <TrajectoryOverlay
        renderModel={gridRenderModel()}
        episodeStatsHistory={[episodeStats({ episode: 1 })]}
        selectedEpisode={999}
        ariaLabel="x"
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when the selected Episode has an empty trajectory', () => {
    const { container } = render(
      <TrajectoryOverlay
        renderModel={gridRenderModel()}
        episodeStatsHistory={[episodeStats({ episode: 1, trajectory: [] })]}
        selectedEpisode={1}
        ariaLabel="x"
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders the overlay with role="img" and the given aria-label when the Episode is found', () => {
    render(
      <TrajectoryOverlay
        renderModel={gridRenderModel()}
        episodeStatsHistory={[episodeStats({ episode: 1 })]}
        selectedEpisode={1}
        ariaLabel="Trajectory for Episode 1"
      />,
    )
    const svg = screen.getByTestId('trajectory-overlay')
    expect(svg.getAttribute('role')).toBe('img')
    expect(svg.getAttribute('aria-label')).toBe('Trajectory for Episode 1')
  })

  it('renders one marker per step plus one for the final destination (N transitions -> N+1 markers)', () => {
    render(
      <TrajectoryOverlay
        renderModel={gridRenderModel()}
        episodeStatsHistory={[episodeStats({ episode: 1 })]} // 3 transitions
        selectedEpisode={1}
        ariaLabel="x"
      />,
    )
    expect(screen.getByTestId('trajectory-marker-0')).toBeTruthy()
    expect(screen.getByTestId('trajectory-marker-1')).toBeTruthy()
    expect(screen.getByTestId('trajectory-marker-2')).toBeTruthy()
    expect(screen.getByTestId('trajectory-marker-3')).toBeTruthy() // final destination
    expect(screen.queryByTestId('trajectory-marker-4')).toBeNull()
  })

  it('the path has one M followed by one L per remaining point (4 points -> 1 M + 3 L)', () => {
    render(
      <TrajectoryOverlay
        renderModel={gridRenderModel()}
        episodeStatsHistory={[episodeStats({ episode: 1 })]}
        selectedEpisode={1}
        ariaLabel="x"
      />,
    )
    const d = screen.getByTestId('trajectory-path').getAttribute('d') ?? ''
    expect(d.startsWith('M')).toBe(true)
    expect((d.match(/L/g) ?? []).length).toBe(3)
  })

  it('a repeated State gets an offset marker so repeats do not fully overlap', () => {
    render(
      <TrajectoryOverlay
        renderModel={gridRenderModel({ width: 2, height: 1, start: '0,0', goals: ['1,0'] })}
        episodeStatsHistory={[
          episodeStats({
            episode: 1,
            trajectory: [
              { state: '0,0', action: 0, nextState: '0,0', reward: -1, done: false },
              { state: '0,0', action: 1, nextState: '0,0', reward: -1, done: false },
              { state: '0,0', action: 2, nextState: '0,0', reward: -1, done: false },
              { state: '0,0', action: 3, nextState: '1,0', reward: 10, done: true },
            ],
          }),
        ]}
        selectedEpisode={1}
        ariaLabel="x"
      />,
    )
    // markers 0,1,2 are all nominally at cell (0,0) but must not share the exact same
    // (cx, cy) — this is what proves repeat visits are visually distinguished, not
    // silently drawn as a single overlapping point.
    const marker0 = screen.getByTestId('trajectory-marker-0').querySelector('circle')!
    const marker1 = screen.getByTestId('trajectory-marker-1').querySelector('circle')!
    const marker2 = screen.getByTestId('trajectory-marker-2').querySelector('circle')!
    const positions = [marker0, marker1, marker2].map((c) => `${c.getAttribute('cx')},${c.getAttribute('cy')}`)
    expect(new Set(positions).size).toBe(3) // all three distinct on-screen positions
  })

  describe('Phase 39 — repeat-visit offset keyed by physical position, not the full "x,y,mask" StateKey', () => {
    it('two visits to the same position under DIFFERENT Goal-collection masks still get distinct offsets (no overlap)', () => {
      render(
        <TrajectoryOverlay
          renderModel={gridRenderModel({ width: 2, height: 1, start: '0,0', goals: ['1,0'] })}
          episodeStatsHistory={[
            episodeStats({
              episode: 1,
              trajectory: [
                // Same position (0,0) visited three times, each under a different mask
                // suffix — before Phase 39 this reset the repeat-offset counter every
                // time (visitCounts keyed by the full StateKey), so all three markers
                // rendered at the identical (cx, cy) despite the anti-overlap logic.
                { state: '0,0,0', action: 3, nextState: '1,0,1', reward: -1, done: false },
                { state: '1,0,1', action: 2, nextState: '0,0,1', reward: -1, done: false },
                { state: '0,0,1', action: 3, nextState: '1,0,3', reward: -1, done: false },
                { state: '1,0,3', action: 2, nextState: '0,0,3', reward: -1, done: false },
              ],
            }),
          ]}
          selectedEpisode={1}
          ariaLabel="x"
        />,
      )
      // Steps 0, 2 both start at position (0,0) (masks 0 and 1) — and the final
      // destination (step 4) also lands at (0,0) (mask 3). All three must be visually
      // distinct on-screen positions despite sharing the same (x,y).
      const at00 = ['trajectory-marker-0', 'trajectory-marker-2', 'trajectory-marker-4'].map((id) => {
        const c = screen.getByTestId(id).querySelector('circle')!
        return `${c.getAttribute('cx')},${c.getAttribute('cy')}`
      })
      expect(new Set(at00).size).toBe(3)
    })

    it('the offset sequence for position-based repeats matches what a plain (no-mask) StateKey trajectory would produce', () => {
      // Same shape as the pre-existing "a repeated State gets an offset marker" test
      // above, but every step's StateKey carries a mask suffix — the resulting on-screen
      // positions must be identical either way, proving the fix is purely about which
      // key visitCounts uses internally, not a change to the offset values/order.
      const withMask = render(
        <TrajectoryOverlay
          renderModel={gridRenderModel({ width: 2, height: 1, start: '0,0', goals: ['1,0'] })}
          episodeStatsHistory={[
            episodeStats({
              episode: 1,
              trajectory: [
                { state: '0,0,0', action: 0, nextState: '0,0,0', reward: -1, done: false },
                { state: '0,0,0', action: 1, nextState: '0,0,0', reward: -1, done: false },
                { state: '0,0,0', action: 2, nextState: '0,0,0', reward: -1, done: false },
                { state: '0,0,0', action: 3, nextState: '1,0,1', reward: 10, done: true },
              ],
            }),
          ]}
          selectedEpisode={1}
          ariaLabel="x"
        />,
      )
      const withMaskPositions = ['trajectory-marker-0', 'trajectory-marker-1', 'trajectory-marker-2'].map((id) => {
        const c = screen.getByTestId(id).querySelector('circle')!
        return `${c.getAttribute('cx')},${c.getAttribute('cy')}`
      })
      withMask.unmount()

      const withoutMask = render(
        <TrajectoryOverlay
          renderModel={gridRenderModel({ width: 2, height: 1, start: '0,0', goals: ['1,0'] })}
          episodeStatsHistory={[
            episodeStats({
              episode: 1,
              trajectory: [
                { state: '0,0', action: 0, nextState: '0,0', reward: -1, done: false },
                { state: '0,0', action: 1, nextState: '0,0', reward: -1, done: false },
                { state: '0,0', action: 2, nextState: '0,0', reward: -1, done: false },
                { state: '0,0', action: 3, nextState: '1,0', reward: 10, done: true },
              ],
            }),
          ]}
          selectedEpisode={1}
          ariaLabel="x"
        />,
      )
      const withoutMaskPositions = ['trajectory-marker-0', 'trajectory-marker-1', 'trajectory-marker-2'].map((id) => {
        const c = screen.getByTestId(id).querySelector('circle')!
        return `${c.getAttribute('cx')},${c.getAttribute('cy')}`
      })
      withoutMask.unmount()

      expect(withMaskPositions).toEqual(withoutMaskPositions)
    })

    it('positions that never repeat still render at their exact plain (x,y) center, unaffected by mask stripping', () => {
      render(
        <TrajectoryOverlay
          renderModel={gridRenderModel()}
          episodeStatsHistory={[
            episodeStats({
              episode: 1,
              trajectory: [
                { state: '0,3,0', action: 0, nextState: '0,2,0', reward: -1, done: false },
                { state: '0,2,0', action: 0, nextState: '0,1,1', reward: -1, done: false },
                { state: '0,1,1', action: 0, nextState: '0,0,1', reward: 10, done: true },
              ],
            }),
          ]}
          selectedEpisode={1}
          ariaLabel="x"
        />,
      )
      const marker0 = screen.getByTestId('trajectory-marker-0').querySelector('circle')!
      // cellSize defaults to 48; position (0,3) -> center (24, 168).
      expect(marker0.getAttribute('cx')).toBe('24')
      expect(marker0.getAttribute('cy')).toBe('168')
    })
  })

  it('renders without crashing when the render model also declares Walls elsewhere on the grid (Wall rendering itself is GridSvg\'s responsibility, not this overlay\'s)', () => {
    render(
      <TrajectoryOverlay
        renderModel={gridRenderModel({ walls: ['3,3'] })} // nowhere on the fixture's actual path
        episodeStatsHistory={[episodeStats({ episode: 1 })]}
        selectedEpisode={1}
        ariaLabel="x"
      />,
    )
    expect(screen.getByTestId('trajectory-overlay')).toBeTruthy()
  })
})
