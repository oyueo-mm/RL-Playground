// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { translations } from '../../ui/i18n'
import { RewardChart } from './RewardChart'

afterEach(cleanup)

function isFiniteNumber(n: number): boolean {
  return Number.isFinite(n)
}

describe('RewardChart', () => {
  it('shows an empty state when rewardHistory is empty', () => {
    render(<RewardChart rewardHistory={[]} />)
    expect(screen.getByTestId('reward-chart-empty').textContent).toMatch(/No reward history yet\./)
    expect(screen.queryByTestId('reward-chart-svg')).toBeNull()
  })

  it('renders without crashing for a single value', () => {
    render(<RewardChart rewardHistory={[5]} />)
    expect(screen.getByTestId('reward-chart-svg')).toBeTruthy()
    const d = screen.getByTestId('reward-chart-path').getAttribute('d') ?? ''
    expect(d.length).toBeGreaterThan(0)
    expect(d).not.toContain('NaN')
    expect(d).not.toContain('Infinity')
  })

  it('renders a path with a moveto + one lineto per additional point for several values', () => {
    render(<RewardChart rewardHistory={[1, 2, 3, 2, 1]} />)
    const d = screen.getByTestId('reward-chart-path').getAttribute('d') ?? ''
    expect(d.startsWith('M')).toBe(true)
    expect((d.match(/L/g) ?? []).length).toBe(4) // 5 points -> 1 M + 4 L
  })

  it('renders negative reward values without producing NaN/Infinity coordinates', () => {
    render(<RewardChart rewardHistory={[-10, -5, -2, -7]} />)
    const d = screen.getByTestId('reward-chart-path').getAttribute('d') ?? ''
    expect(d).not.toContain('NaN')
    expect(d).not.toContain('Infinity')
    // and the values should not all collapse onto the same y (they differ).
    const ys = [...d.matchAll(/[ML] [\d.-]+ ([\d.-]+)/g)].map((m) => Number(m[1]))
    expect(new Set(ys).size).toBeGreaterThan(1)
  })

  it('renders without NaN/Infinity when every reward is identical', () => {
    render(<RewardChart rewardHistory={[-0.1, -0.1, -0.1]} />)
    const d = screen.getByTestId('reward-chart-path').getAttribute('d') ?? ''
    expect(d).not.toContain('NaN')
    expect(d).not.toContain('Infinity')
    const coords = [...d.matchAll(/[ML] ([\d.-]+) ([\d.-]+)/g)].flatMap((m) => [Number(m[1]), Number(m[2])])
    expect(coords.every(isFiniteNumber)).toBe(true)
  })

  it('renders mixed positive/negative values without breaking', () => {
    render(<RewardChart rewardHistory={[-100, 0, 100]} />)
    const d = screen.getByTestId('reward-chart-path').getAttribute('d') ?? ''
    expect(d).not.toContain('NaN')
    expect(d).not.toContain('Infinity')
  })

  it('handles the extreme case of a single zero value', () => {
    render(<RewardChart rewardHistory={[0]} />)
    const d = screen.getByTestId('reward-chart-path').getAttribute('d') ?? ''
    expect(d).not.toContain('NaN')
    expect(d).not.toContain('Infinity')
  })

  it('handles four identical negative values', () => {
    render(<RewardChart rewardHistory={[-1, -1, -1, -1]} />)
    const d = screen.getByTestId('reward-chart-path').getAttribute('d') ?? ''
    expect(d).not.toContain('NaN')
    expect(d).not.toContain('Infinity')
  })

  it('has an accessible description', () => {
    render(<RewardChart rewardHistory={[1, 2]} />)
    expect(screen.getByRole('img', { name: /reward history/i })).toBeTruthy()
  })

  // Phase 19 — the chart's actual data source (confirmed by reading
  // SimulationEngine.ts's finishEpisode(): one point per completed Episode, whose value
  // is `episodeReward`, the sum of every step's reward across that Episode) is now
  // explained on-screen instead of left for the reader to infer from an unlabeled line.
  describe('Phase 19 — axis explanation', () => {
    it('shows an X-axis label (English default: "Episode")', () => {
      render(<RewardChart rewardHistory={[1, 2, 3]} />)
      expect(screen.getByTestId('reward-chart-x-axis').textContent).toBe('X: Episode')
    })

    it('shows a Y-axis label (English default: "Total Reward")', () => {
      render(<RewardChart rewardHistory={[1, 2, 3]} />)
      expect(screen.getByTestId('reward-chart-y-axis').textContent).toBe('Y: Total Reward')
    })

    it('shows a short description matching the actual data meaning', () => {
      render(<RewardChart rewardHistory={[1, 2, 3]} />)
      expect(screen.getByTestId('reward-chart-description').textContent).toBe(
        "Each point is one completed Episode's Total Reward.",
      )
    })

    it('renders the axis labels and description in Korean', () => {
      render(<RewardChart rewardHistory={[1, 2, 3]} t={translations.ko} />)
      expect(screen.getByTestId('reward-chart-x-axis').textContent).toBe('X: 에피소드')
      expect(screen.getByTestId('reward-chart-y-axis').textContent).toBe('Y: 총 보상')
      expect(screen.getByTestId('reward-chart-description').textContent).toBe(
        '각 점은 완료된 한 Episode의 총 보상을 나타냅니다.',
      )
    })

    it('does not render axis labels in the empty state (nothing to label yet)', () => {
      render(<RewardChart rewardHistory={[]} />)
      expect(screen.queryByTestId('reward-chart-x-axis')).toBeNull()
      expect(screen.queryByTestId('reward-chart-y-axis')).toBeNull()
    })
  })

  describe('Phase 24 — selected Episode highlight', () => {
    it('shows no highlight when selectedEpisode is not provided', () => {
      render(<RewardChart rewardHistory={[1, 2, 3]} episodeNumbers={[1, 2, 3]} />)
      expect(screen.queryByTestId('reward-chart-selected-point')).toBeNull()
      expect(screen.queryByTestId('reward-chart-selected-label')).toBeNull()
    })

    it('shows no highlight when selectedEpisode is null', () => {
      render(<RewardChart rewardHistory={[1, 2, 3]} episodeNumbers={[1, 2, 3]} selectedEpisode={null} />)
      expect(screen.queryByTestId('reward-chart-selected-point')).toBeNull()
    })

    it('highlights the point matching selectedEpisode via episodeNumbers', () => {
      render(<RewardChart rewardHistory={[1, 2, 3]} episodeNumbers={[10, 11, 12]} selectedEpisode={11} />)
      expect(screen.getByTestId('reward-chart-selected-point')).toBeTruthy()
      expect(screen.getByTestId('reward-chart-selected-guide')).toBeTruthy()
      expect(screen.getByTestId('reward-chart-selected-label').textContent).toBe('Selected Episode: 11')
    })

    it('shows no highlight when selectedEpisode is not found in episodeNumbers (e.g. evicted from history)', () => {
      render(<RewardChart rewardHistory={[1, 2, 3]} episodeNumbers={[10, 11, 12]} selectedEpisode={999} />)
      expect(screen.queryByTestId('reward-chart-selected-point')).toBeNull()
    })

    it('highlight label translates to Korean', () => {
      render(
        <RewardChart
          rewardHistory={[1, 2, 3]}
          episodeNumbers={[1, 2, 3]}
          selectedEpisode={2}
          t={translations.ko}
        />,
      )
      expect(screen.getByTestId('reward-chart-selected-label').textContent).toBe('선택된 Episode: 2')
    })

    it('episodeNumbers defaulting to [] (omitted) never crashes even with a non-null selectedEpisode', () => {
      render(<RewardChart rewardHistory={[1, 2, 3]} selectedEpisode={2} />)
      expect(screen.queryByTestId('reward-chart-selected-point')).toBeNull()
    })
  })

  describe('Phase 28 §7 — numeric axis ticks', () => {
    it('renders a numeric Y-axis tick reflecting the actual value range', () => {
      render(<RewardChart rewardHistory={[-10, 0, 10]} />)
      // -10..10 should produce a "0" tick among the nice round numbers.
      expect(screen.getByTestId('reward-chart-y-tick-0')).toBeTruthy()
    })

    it('renders numeric X-axis tick labels reflecting real Episode numbers', () => {
      const history = Array.from({ length: 10 }, (_, i) => i)
      const episodeNumbers = Array.from({ length: 10 }, (_, i) => i + 1)
      render(<RewardChart rewardHistory={history} episodeNumbers={episodeNumbers} />)
      expect(screen.getByTestId('reward-chart-x-tick-10')).toBeTruthy()
    })

    it('falls back to index+1 for X ticks when episodeNumbers is omitted', () => {
      render(<RewardChart rewardHistory={Array.from({ length: 10 }, (_, i) => i)} />)
      expect(screen.getByTestId('reward-chart-x-tick-10')).toBeTruthy()
    })

    it('does not blow up the tick count for a very large Episode range (1..1000)', () => {
      render(<RewardChart rewardHistory={[0, 5]} episodeNumbers={[1, 1000]} />)
      const svg = screen.getByTestId('reward-chart-svg')
      const xTickTexts = [...svg.querySelectorAll('text')].filter((el) =>
        (el.getAttribute('data-testid') ?? '').includes('-x-tick-'),
      )
      expect(xTickTexts.length).toBeLessThanOrEqual(8)
    })

    it('renders no ticks in the empty state', () => {
      render(<RewardChart rewardHistory={[]} />)
      expect(screen.queryByTestId('reward-chart-svg')).toBeNull()
    })
  })
})
