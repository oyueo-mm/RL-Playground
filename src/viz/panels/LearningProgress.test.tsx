// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { EpisodeStats } from '../../core/engine/types'
import { translations } from '../../ui/i18n'
import { LearningProgress } from './LearningProgress'

afterEach(cleanup)

function episodeStats(overrides: Partial<EpisodeStats> = {}): EpisodeStats {
  return {
    episode: 1,
    steps: 5,
    totalReward: 3.5,
    terminationReason: 'goal',
    explorationCount: 2,
    exploitationCount: 3,
    explorationRate: 0.4,
    averageReward: 0.7,
    uniqueStates: 4,
    trajectory: [],
    ...overrides,
  }
}

describe('LearningProgress', () => {
  it('shows an empty state when episodeStatsHistory is empty', () => {
    render(<LearningProgress episodeStatsHistory={[]} />)
    expect(screen.getByTestId('learning-progress-empty')).toBeTruthy()
    expect(screen.queryByTestId('learning-progress')).toBeNull()
  })

  it('renders exactly two charts (Total Reward / Steps), and no Exploration Rate chart, once at least one Episode exists', () => {
    render(<LearningProgress episodeStatsHistory={[episodeStats({ episode: 1 })]} />)
    expect(screen.getByTestId('learning-progress')).toBeTruthy()
    expect(screen.getByTestId('learning-progress-total-reward-chart')).toBeTruthy()
    expect(screen.getByTestId('learning-progress-steps-chart')).toBeTruthy()
    expect(screen.queryByTestId('learning-progress-exploration-rate-chart')).toBeNull()
  })

  it('the Total Reward chart path reflects the number of Episodes (moveto + one lineto per additional point)', () => {
    const history = [
      episodeStats({ episode: 1, totalReward: 1 }),
      episodeStats({ episode: 2, totalReward: 2 }),
      episodeStats({ episode: 3, totalReward: 3 }),
    ]
    render(<LearningProgress episodeStatsHistory={history} />)
    const d = screen.getByTestId('learning-progress-total-reward-path').getAttribute('d') ?? ''
    expect(d.startsWith('M')).toBe(true)
    expect((d.match(/L/g) ?? []).length).toBe(2) // 3 points -> 1 M + 2 L
  })

  it('renders without NaN/Infinity when all Episodes have identical values (flat line)', () => {
    const history = [
      episodeStats({ episode: 1, totalReward: -1, steps: 5 }),
      episodeStats({ episode: 2, totalReward: -1, steps: 5 }),
    ]
    render(<LearningProgress episodeStatsHistory={history} />)
    for (const prefix of ['learning-progress-total-reward', 'learning-progress-steps']) {
      const d = screen.getByTestId(`${prefix}-path`).getAttribute('d') ?? ''
      expect(d).not.toContain('NaN')
      expect(d).not.toContain('Infinity')
    }
  })

  it('the Steps chart uses EpisodeStats.steps values directly (no recomputation)', () => {
    const history = [episodeStats({ episode: 1, steps: 7 }), episodeStats({ episode: 2, steps: 23 })]
    render(<LearningProgress episodeStatsHistory={history} />)
    const d = screen.getByTestId('learning-progress-steps-path').getAttribute('d') ?? ''
    expect(d).not.toContain('NaN')
    // Two very different step counts must not collapse onto the same y (flat line).
    const ys = [...d.matchAll(/[ML] [\d.-]+ ([\d.-]+)/g)].map((m) => Number(m[1]))
    expect(new Set(ys).size).toBeGreaterThan(1)
  })

  it('each chart shows its X/Y axis explanation and a description', () => {
    render(<LearningProgress episodeStatsHistory={[episodeStats()]} />)
    expect(screen.getByTestId('learning-progress-total-reward-x-axis').textContent).toBe('X: Episode')
    expect(screen.getByTestId('learning-progress-total-reward-y-axis').textContent).toBe('Y: Total Reward')
    expect(screen.getByTestId('learning-progress-steps-y-axis').textContent).toBe('Y: Steps')
    expect(screen.getByTestId('learning-progress-total-reward-description')).toBeTruthy()
    expect(screen.getByTestId('learning-progress-steps-description')).toBeTruthy()
  })

  it('each chart has an accessible role="img" aria-label', () => {
    render(<LearningProgress episodeStatsHistory={[episodeStats()]} />)
    expect(within(screen.getByTestId('learning-progress-total-reward-chart')).getByRole('img')).toBeTruthy()
    expect(within(screen.getByTestId('learning-progress-steps-chart')).getByRole('img')).toBeTruthy()
  })
})

describe('LearningProgress — Phase 28: numeric axis ticks', () => {
  it('renders numeric Y-axis tick labels reflecting the actual value range', () => {
    const history = [
      episodeStats({ episode: 1, totalReward: -10 }),
      episodeStats({ episode: 2, totalReward: 10 }),
    ]
    render(<LearningProgress episodeStatsHistory={history} />)
    // A -10..10 range should produce a "0" tick among the nice round numbers.
    expect(screen.getByTestId('learning-progress-total-reward-y-tick-0')).toBeTruthy()
  })

  it('renders numeric X-axis tick labels reflecting real Episode numbers', () => {
    const history = Array.from({ length: 10 }, (_, i) => episodeStats({ episode: i + 1, totalReward: i }))
    render(<LearningProgress episodeStatsHistory={history} />)
    // 1..10 domain should include "10" among the nice round-number ticks.
    expect(screen.getByTestId('learning-progress-total-reward-x-tick-10')).toBeTruthy()
  })

  it('does not blow up the tick count for a very large Episode range (1..1000)', () => {
    const history = [episodeStats({ episode: 1, steps: 5 }), episodeStats({ episode: 1000, steps: 50 })]
    render(<LearningProgress episodeStatsHistory={history} />)
    const svg = screen.getByTestId('learning-progress-steps-svg')
    const xTickTexts = [...svg.querySelectorAll('text')].filter((el) =>
      (el.getAttribute('data-testid') ?? '').includes('-x-tick-'),
    )
    expect(xTickTexts.length).toBeLessThanOrEqual(8)
  })
})

describe('LearningProgress — Phase 25: Episode selection highlight', () => {
  const history = [
    episodeStats({ episode: 1, totalReward: 1, steps: 5 }),
    episodeStats({ episode: 2, totalReward: 2, steps: 9 }),
  ]

  it('shows no highlight when selectedEpisode is not provided', () => {
    render(<LearningProgress episodeStatsHistory={history} />)
    expect(screen.queryByTestId('learning-progress-total-reward-selected-point')).toBeNull()
    expect(screen.queryByTestId('learning-progress-steps-selected-point')).toBeNull()
  })

  it('highlights the selected Episode consistently across both remaining charts', () => {
    render(<LearningProgress episodeStatsHistory={history} selectedEpisode={2} />)
    expect(screen.getByTestId('learning-progress-total-reward-selected-point')).toBeTruthy()
    expect(screen.getByTestId('learning-progress-steps-selected-point')).toBeTruthy()
    expect(screen.getByTestId('learning-progress-total-reward-selected-label').textContent).toContain('2')
  })

  it('the selected label shows the actual value for that chart', () => {
    render(<LearningProgress episodeStatsHistory={history} selectedEpisode={2} />)
    expect(screen.getByTestId('learning-progress-steps-selected-label').textContent).toContain('9')
  })

  it('does not highlight an Episode that is not in history (e.g. evicted / never existed)', () => {
    render(<LearningProgress episodeStatsHistory={history} selectedEpisode={999} />)
    expect(screen.queryByTestId('learning-progress-total-reward-selected-point')).toBeNull()
    expect(screen.queryByTestId('learning-progress-steps-selected-point')).toBeNull()
  })

  it('selectedEpisode=null shows no highlight (explicit deselection)', () => {
    render(<LearningProgress episodeStatsHistory={history} selectedEpisode={null} />)
    expect(screen.queryByTestId('learning-progress-total-reward-selected-point')).toBeNull()
  })
})

describe('LearningProgress — Phase 25: i18n', () => {
  it('renders the heading and empty state in Korean', () => {
    render(<LearningProgress episodeStatsHistory={[]} t={translations.ko} />)
    expect(screen.getByTestId('learning-progress-empty').textContent).toBe('아직 완료된 Episode가 없습니다.')
  })

  it('renders headings and axis/description text in Korean when Episodes exist', () => {
    render(<LearningProgress episodeStatsHistory={[episodeStats()]} t={translations.ko} />)
    expect(screen.getByText('학습 진행 상황')).toBeTruthy()
    expect(screen.getByTestId('learning-progress-total-reward-x-axis').textContent).toBe('X: 에피소드')
    expect(screen.getByTestId('learning-progress-total-reward-y-axis').textContent).toBe('Y: 총 보상')
    expect(screen.getByTestId('learning-progress-steps-y-axis').textContent).toBe('Y: Step 수')
  })

  it('renders the selected label in Korean', () => {
    render(
      <LearningProgress
        episodeStatsHistory={[episodeStats({ episode: 3 })]}
        selectedEpisode={3}
        t={translations.ko}
      />,
    )
    expect(screen.getByTestId('learning-progress-total-reward-selected-label').textContent).toContain('선택된 Episode')
  })
})
