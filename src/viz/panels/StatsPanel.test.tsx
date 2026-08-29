// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EngineStats, EpisodeStats } from '../../core/engine/types'
import { translations } from '../../ui/i18n'
import { StatsPanel } from './StatsPanel'

afterEach(cleanup)

function stats(overrides: Partial<EngineStats> = {}): EngineStats {
  return {
    totalReward: 0,
    episodeReward: 0,
    episodeLength: 0,
    successCount: 0,
    successRate: 0,
    rewardHistory: [],
    avgRewardMovingWindow: 0,
    latestEpisodeStats: null,
    episodeStatsHistory: [],
    ...overrides,
  }
}

describe('StatsPanel', () => {
  it('displays the current episode number', () => {
    render(<StatsPanel episode={7} stats={stats()} />)
    expect(screen.getByTestId('stats-episode').textContent).toBe('7')
  })

  it('displays Total Reward', () => {
    render(<StatsPanel episode={0} stats={stats({ totalReward: 12.345 })} />)
    expect(screen.getByTestId('stats-total-reward').textContent).toBe('12.35')
  })

  it('displays Episode Length', () => {
    render(<StatsPanel episode={0} stats={stats({ episodeLength: 23 })} />)
    expect(screen.getByTestId('stats-episode-length').textContent).toBe('23')
  })

  it('displays Success Rate as a percentage', () => {
    render(<StatsPanel episode={0} stats={stats({ successRate: 0.425 })} />)
    expect(screen.getByTestId('stats-success-rate').textContent).toBe('42.5%')
  })

  it('renders normal positive numeric values correctly across all fields at once', () => {
    render(
      <StatsPanel
        episode={10}
        stats={stats({ totalReward: 5, episodeLength: 3, successRate: 0.5 })}
      />,
    )
    expect(screen.getByTestId('stats-episode').textContent).toBe('10')
    expect(screen.getByTestId('stats-total-reward').textContent).toBe('5.00')
    expect(screen.getByTestId('stats-episode-length').textContent).toBe('3')
    expect(screen.getByTestId('stats-success-rate').textContent).toBe('50.0%')
  })

  it('displays 0% Success Rate correctly', () => {
    render(<StatsPanel episode={0} stats={stats({ successRate: 0 })} />)
    expect(screen.getByTestId('stats-success-rate').textContent).toBe('0.0%')
  })

  it('displays 100% Success Rate correctly', () => {
    render(<StatsPanel episode={0} stats={stats({ successRate: 1 })} />)
    expect(screen.getByTestId('stats-success-rate').textContent).toBe('100.0%')
  })

  it('displays a negative Total Reward without breaking', () => {
    render(<StatsPanel episode={0} stats={stats({ totalReward: -42.1 })} />)
    expect(screen.getByTestId('stats-total-reward').textContent).toBe('-42.10')
  })
})

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

describe('StatsPanel — Phase 21: Episode Statistics', () => {
  it('shows the "no Episode yet" empty state for Latest Episode and Episode History before any Episode completes', () => {
    render(<StatsPanel episode={0} stats={stats()} />)
    expect(screen.getByTestId('latest-episode-empty')).toBeTruthy()
    expect(screen.queryByTestId('latest-episode')).toBeNull()
    expect(screen.getByTestId('episode-history-empty')).toBeTruthy()
    expect(screen.queryByTestId('episode-history')).toBeNull()
  })

  it('displays Latest Episode fields exactly as given (no recomputation)', () => {
    const ep = episodeStats({
      episode: 4,
      steps: 7,
      totalReward: 12.345,
      terminationReason: 'bomb',
      explorationCount: 3,
      exploitationCount: 4,
      explorationRate: 3 / 7,
      averageReward: 12.345 / 7,
      uniqueStates: 5,
    })
    render(<StatsPanel episode={4} stats={stats({ latestEpisodeStats: ep, episodeStatsHistory: [ep] })} />)

    const latest = within(screen.getByTestId('latest-episode'))
    expect(latest.getByTestId('latest-episode-number').textContent).toBe('4')
    expect(latest.getByTestId('latest-episode-steps').textContent).toBe('7')
    expect(latest.getByTestId('latest-episode-total-reward').textContent).toBe('12.35')
    expect(latest.getByTestId('latest-episode-termination').textContent).toBe('Bomb')
    expect(latest.getByTestId('latest-episode-exploration').textContent).toBe('3')
    expect(latest.getByTestId('latest-episode-exploitation').textContent).toBe('4')
    expect(latest.getByTestId('latest-episode-exploration-rate').textContent).toBe('42.9%')
    expect(latest.getByTestId('latest-episode-average-reward').textContent).toBe('1.76')
    expect(latest.getByTestId('latest-episode-unique-states').textContent).toBe('5')
  })

  // Phase 30 §11 — "N / M Goals Collected", derived from the Episode's own trajectory
  // (no new Core storage) and the current Environment's goals.
  it('shows "Goals Collected" only when there is more than one Goal', () => {
    const ep = episodeStats({ trajectory: [{ state: '0,0', action: 3, nextState: '1,0', reward: 10, done: false }] })
    const { rerender } = render(
      <StatsPanel episode={1} stats={stats({ latestEpisodeStats: ep, episodeStatsHistory: [ep] })} goals={['1,0']} />,
    )
    expect(screen.queryByTestId('latest-episode-goals-collected')).toBeNull()

    rerender(
      <StatsPanel
        episode={1}
        stats={stats({ latestEpisodeStats: ep, episodeStatsHistory: [ep] })}
        goals={['1,0', '2,0']}
      />,
    )
    expect(screen.getByTestId('latest-episode-goals-collected').textContent).toBe('1 / 2')
  })

  it('counts each distinct Goal only once even if visited more than once in the trajectory', () => {
    const ep = episodeStats({
      trajectory: [
        { state: '0,0', action: 3, nextState: '1,0', reward: 10, done: false },
        { state: '1,0', action: 2, nextState: '0,0', reward: -0.1, done: false },
        { state: '0,0', action: 3, nextState: '1,0', reward: -0.1, done: false },
        { state: '1,0', action: 3, nextState: '2,0', reward: 10, done: true },
      ],
    })
    render(
      <StatsPanel
        episode={1}
        stats={stats({ latestEpisodeStats: ep, episodeStatsHistory: [ep] })}
        goals={['1,0', '2,0']}
      />,
    )
    expect(screen.getByTestId('latest-episode-goals-collected').textContent).toBe('2 / 2')
  })

  it('shows the Goal/Other termination labels correctly too', () => {
    const { rerender } = render(
      <StatsPanel episode={1} stats={stats({ latestEpisodeStats: episodeStats({ terminationReason: 'goal' }) })} />,
    )
    expect(screen.getByTestId('latest-episode-termination').textContent).toBe('Goal')

    rerender(<StatsPanel episode={1} stats={stats({ latestEpisodeStats: episodeStats({ terminationReason: 'other' }) })} />)
    expect(screen.getByTestId('latest-episode-termination').textContent).toBe('Other')
  })

  it('Episode History renders one row per completed Episode, most recent first', () => {
    const history = [episodeStats({ episode: 1 }), episodeStats({ episode: 2 }), episodeStats({ episode: 3 })]
    render(<StatsPanel episode={3} stats={stats({ latestEpisodeStats: history[2], episodeStatsHistory: history })} />)

    const table = screen.getByTestId('episode-history')
    const rows = within(table).getAllByRole('row').slice(1) // drop the header row
    expect(rows).toHaveLength(3)
    // Most recent (Episode 3) shown first.
    expect(screen.getByTestId('episode-history-row-3')).toBeTruthy()
    expect(rows[0]).toBe(screen.getByTestId('episode-history-row-3'))
    expect(rows[2]).toBe(screen.getByTestId('episode-history-row-1'))
  })

  it('a History row shows the same values as the corresponding EpisodeStats', () => {
    const ep = episodeStats({ episode: 9, steps: 6, totalReward: -4.2, terminationReason: 'bomb', explorationRate: 0.5 })
    render(<StatsPanel episode={9} stats={stats({ latestEpisodeStats: ep, episodeStatsHistory: [ep] })} />)

    const row = within(screen.getByTestId('episode-history-row-9'))
    expect(row.getByText('9')).toBeTruthy()
    expect(row.getByText('6')).toBeTruthy()
    expect(row.getByText('-4.20')).toBeTruthy()
    expect(row.getByText('Bomb')).toBeTruthy()
    expect(row.getByText('50.0%')).toBeTruthy()
  })

  it('the History table only shows the most recent 10 entries even if more exist', () => {
    const history = Array.from({ length: 15 }, (_, i) => episodeStats({ episode: i + 1 }))
    render(<StatsPanel episode={15} stats={stats({ latestEpisodeStats: history.at(-1), episodeStatsHistory: history })} />)

    const rows = within(screen.getByTestId('episode-history')).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(10)
    expect(screen.getByTestId('episode-history-row-15')).toBeTruthy() // most recent present
    expect(screen.queryByTestId('episode-history-row-1')).toBeNull() // oldest, trimmed from display
  })

  it('renders Latest Episode / Episode History headings and Termination labels in Korean', () => {
    const ep = episodeStats({ terminationReason: 'bomb' })
    render(
      <StatsPanel
        episode={1}
        stats={stats({ latestEpisodeStats: ep, episodeStatsHistory: [ep] })}
        t={translations.ko}
      />,
    )
    expect(screen.getByText('최근 Episode')).toBeTruthy()
    expect(screen.getByText('Episode 기록')).toBeTruthy()
    expect(screen.getByTestId('latest-episode-termination').textContent).toBe('Bomb')
  })
})

describe('StatsPanel — Phase 24: Episode Detail / selection', () => {
  it('shows the Episode Detail empty state when no Episode is selected', () => {
    const history = [episodeStats({ episode: 1 })]
    render(<StatsPanel episode={1} stats={stats({ episodeStatsHistory: history })} />)
    expect(screen.getByTestId('episode-detail-empty')).toBeTruthy()
    expect(screen.queryByTestId('episode-detail')).toBeNull()
  })

  it('clicking a History row selects it and shows its Episode Detail', () => {
    const history = [episodeStats({ episode: 1 }), episodeStats({ episode: 2, steps: 9, totalReward: 4.5 })]
    const onSelectEpisode = vi.fn()
    render(
      <StatsPanel
        episode={2}
        stats={stats({ episodeStatsHistory: history })}
        selectedEpisode={null}
        onSelectEpisode={onSelectEpisode}
      />,
    )
    fireEvent.click(screen.getByTestId('episode-history-row-2'))
    expect(onSelectEpisode).toHaveBeenCalledWith(2)
  })

  it('Episode Detail reflects the selectedEpisode prop (owned by the caller, not internal state)', () => {
    const history = [episodeStats({ episode: 1, steps: 5 }), episodeStats({ episode: 2, steps: 9, totalReward: 4.5 })]
    render(<StatsPanel episode={2} stats={stats({ episodeStatsHistory: history })} selectedEpisode={2} />)

    const detail = within(screen.getByTestId('episode-detail'))
    expect(detail.getByTestId('episode-detail-number').textContent).toBe('2')
    expect(detail.getByTestId('episode-detail-steps').textContent).toBe('9')
    expect(detail.getByTestId('episode-detail-total-reward').textContent).toBe('4.50')
  })

  it('Episode Detail shows Exploitation Rate derived from exploitationCount/steps (never stored in Core)', () => {
    const ep = episodeStats({ episode: 3, steps: 10, explorationCount: 4, exploitationCount: 6, explorationRate: 0.4 })
    render(<StatsPanel episode={3} stats={stats({ episodeStatsHistory: [ep] })} selectedEpisode={3} />)

    const detail = within(screen.getByTestId('episode-detail'))
    expect(detail.getByTestId('episode-detail-exploration-rate').textContent).toBe('40.0%')
    expect(detail.getByTestId('episode-detail-exploitation-rate').textContent).toBe('60.0%')
  })

  it('the selected History row is visually marked via data-selected', () => {
    const history = [episodeStats({ episode: 1 }), episodeStats({ episode: 2 })]
    render(<StatsPanel episode={2} stats={stats({ episodeStatsHistory: history })} selectedEpisode={2} />)

    expect(screen.getByTestId('episode-history-row-2').getAttribute('data-selected')).toBe('true')
    expect(screen.getByTestId('episode-history-row-1').getAttribute('data-selected')).toBeNull()
  })

  it('a History row is keyboard-selectable via Enter', () => {
    const onSelectEpisode = vi.fn()
    const history = [episodeStats({ episode: 5 })]
    render(
      <StatsPanel episode={5} stats={stats({ episodeStatsHistory: history })} onSelectEpisode={onSelectEpisode} />,
    )
    const row = screen.getByTestId('episode-history-row-5')
    expect(row.tabIndex).toBe(0)
    fireEvent.keyDown(row, { key: 'Enter' })
    expect(onSelectEpisode).toHaveBeenCalledWith(5)
  })

  it('a History row is keyboard-selectable via Space', () => {
    const onSelectEpisode = vi.fn()
    const history = [episodeStats({ episode: 5 })]
    render(
      <StatsPanel episode={5} stats={stats({ episodeStatsHistory: history })} onSelectEpisode={onSelectEpisode} />,
    )
    fireEvent.keyDown(screen.getByTestId('episode-history-row-5'), { key: ' ' })
    expect(onSelectEpisode).toHaveBeenCalledWith(5)
  })

  it('an unrelated key on a History row does not trigger selection', () => {
    const onSelectEpisode = vi.fn()
    const history = [episodeStats({ episode: 5 })]
    render(
      <StatsPanel episode={5} stats={stats({ episodeStatsHistory: history })} onSelectEpisode={onSelectEpisode} />,
    )
    fireEvent.keyDown(screen.getByTestId('episode-history-row-5'), { key: 'Tab' })
    expect(onSelectEpisode).not.toHaveBeenCalled()
  })

  it('selectedEpisode pointing at an Episode no longer in history (evicted) safely falls back to the empty state', () => {
    const history = [episodeStats({ episode: 50 }), episodeStats({ episode: 51 })]
    render(<StatsPanel episode={51} stats={stats({ episodeStatsHistory: history })} selectedEpisode={3} />)
    expect(screen.getByTestId('episode-detail-empty')).toBeTruthy()
  })

  it('Episode Detail heading/empty-state translate to Korean', () => {
    render(<StatsPanel episode={0} stats={stats()} t={translations.ko} />)
    expect(screen.getByText('Episode 상세')).toBeTruthy()
    expect(screen.getByText('History에서 Episode를 선택하면 상세 정보가 표시됩니다.')).toBeTruthy()
  })

  it('does not affect Latest Episode rendering/testids (regression)', () => {
    const ep = episodeStats({ episode: 7 })
    render(<StatsPanel episode={7} stats={stats({ latestEpisodeStats: ep, episodeStatsHistory: [ep] })} />)
    expect(within(screen.getByTestId('latest-episode')).getByTestId('latest-episode-number').textContent).toBe('7')
  })
})
