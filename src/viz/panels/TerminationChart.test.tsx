// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { EpisodeStats } from '../../core/engine/types'
import { translations } from '../../ui/i18n'
import { TerminationChart } from './TerminationChart'

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

describe('TerminationChart', () => {
  it('shows the empty state when episodeStatsHistory is empty', () => {
    render(<TerminationChart episodeStatsHistory={[]} />)
    expect(screen.getByTestId('termination-chart-empty')).toBeTruthy()
    expect(screen.queryByTestId('termination-chart')).toBeNull()
  })

  it('counts each termination reason correctly from real episodeStatsHistory data', () => {
    const history = [
      episodeStats({ episode: 1, terminationReason: 'goal' }),
      episodeStats({ episode: 2, terminationReason: 'goal' }),
      episodeStats({ episode: 3, terminationReason: 'bomb' }),
      episodeStats({ episode: 4, terminationReason: 'other' }),
      episodeStats({ episode: 5, terminationReason: 'goal' }),
    ]
    render(<TerminationChart episodeStatsHistory={history} />)
    expect(screen.getByTestId('termination-chart-count-goal').textContent).toBe('3')
    expect(screen.getByTestId('termination-chart-count-bomb').textContent).toBe('1')
    expect(screen.getByTestId('termination-chart-count-other').textContent).toBe('1')
  })

  it('shows a 0 count for a reason that never occurred (still rendered, not omitted)', () => {
    const history = [episodeStats({ episode: 1, terminationReason: 'goal' })]
    render(<TerminationChart episodeStatsHistory={history} />)
    expect(screen.getByTestId('termination-chart-bar-bomb')).toBeTruthy()
    expect(screen.getByTestId('termination-chart-count-bomb').textContent).toBe('0')
    expect(screen.getByTestId('termination-chart-bar-other')).toBeTruthy()
    expect(screen.getByTestId('termination-chart-count-other').textContent).toBe('0')
  })

  it('renders all three category bars/labels even with a single Episode', () => {
    render(<TerminationChart episodeStatsHistory={[episodeStats()]} />)
    expect(within(screen.getByTestId('termination-chart-bar-goal')).getByText('Goal')).toBeTruthy()
    expect(within(screen.getByTestId('termination-chart-bar-bomb')).getByText('Bomb')).toBeTruthy()
    expect(within(screen.getByTestId('termination-chart-bar-other')).getByText('Other')).toBeTruthy()
  })

  it('has role="img" and an aria-label', () => {
    render(<TerminationChart episodeStatsHistory={[episodeStats()]} />)
    const svg = screen.getByTestId('termination-chart-svg')
    expect(svg.getAttribute('role')).toBe('img')
    expect(svg.getAttribute('aria-label')).toBeTruthy()
  })

  it('does not change when an unrelated Episode is added twice with the same reason (bar count grows correctly, not capped)', () => {
    const history = Array.from({ length: 12 }, (_, i) => episodeStats({ episode: i + 1, terminationReason: 'goal' }))
      .concat(Array.from({ length: 3 }, (_, i) => episodeStats({ episode: i + 13, terminationReason: 'bomb' })))
    render(<TerminationChart episodeStatsHistory={history} />)
    expect(screen.getByTestId('termination-chart-count-goal').textContent).toBe('12')
    expect(screen.getByTestId('termination-chart-count-bomb').textContent).toBe('3')
    expect(screen.getByTestId('termination-chart-count-other').textContent).toBe('0')
  })

  it('handles 1000+ Episodes without crashing (Phase 28 §4/§10: no 200-episode cap upstream)', () => {
    const history = Array.from({ length: 1200 }, (_, i) =>
      episodeStats({ episode: i + 1, terminationReason: i % 3 === 0 ? 'bomb' : 'goal' }),
    )
    render(<TerminationChart episodeStatsHistory={history} />)
    const goalCount = Number(screen.getByTestId('termination-chart-count-goal').textContent)
    const bombCount = Number(screen.getByTestId('termination-chart-count-bomb').textContent)
    expect(goalCount + bombCount).toBe(1200)
  })

  it('is independent of any selected Episode — always shows the full distribution (no selectedEpisode prop exists)', () => {
    const history = [
      episodeStats({ episode: 1, terminationReason: 'goal' }),
      episodeStats({ episode: 2, terminationReason: 'bomb' }),
    ]
    render(<TerminationChart episodeStatsHistory={history} />)
    expect(screen.getByTestId('termination-chart-count-goal').textContent).toBe('1')
    expect(screen.getByTestId('termination-chart-count-bomb').textContent).toBe('1')
  })

  it('renders headings/labels in Korean', () => {
    render(<TerminationChart episodeStatsHistory={[episodeStats({ terminationReason: 'bomb' })]} t={translations.ko} />)
    expect(screen.getByText('종료 원인 분포')).toBeTruthy()
    expect(within(screen.getByTestId('termination-chart-bar-goal')).getByText('Goal')).toBeTruthy()
    expect(within(screen.getByTestId('termination-chart-bar-bomb')).getByText('Bomb')).toBeTruthy()
    expect(within(screen.getByTestId('termination-chart-bar-other')).getByText('기타')).toBeTruthy()
  })

  it('renders the empty state in Korean', () => {
    render(<TerminationChart episodeStatsHistory={[]} t={translations.ko} />)
    expect(screen.getByTestId('termination-chart-empty').textContent).toBe('아직 완료된 Episode가 없습니다.')
  })
})
