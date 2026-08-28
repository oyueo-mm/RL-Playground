// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { EngineStats } from '../../core/engine/types'
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
