// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { EpisodeStats } from '../../core/engine/types'
import { translations } from '../../ui/i18n'
import { EpisodeTrajectory } from './EpisodeTrajectory'

afterEach(cleanup)

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
    uniqueStates: 3,
    trajectory: [
      { state: '0,3', action: 0, nextState: '0,2', reward: -1, done: false },
      { state: '0,2', action: 0, nextState: '0,1', reward: -1, done: false },
      { state: '0,1', action: 0, nextState: '0,0', reward: 10, done: true },
    ],
    ...overrides,
  }
}

describe('EpisodeTrajectory', () => {
  it('shows the empty state when selectedEpisode is not provided', () => {
    render(<EpisodeTrajectory episodeStatsHistory={[episodeStats()]} />)
    expect(screen.getByTestId('episode-trajectory-empty')).toBeTruthy()
    expect(screen.queryByTestId('episode-trajectory')).toBeNull()
  })

  it('shows the empty state when selectedEpisode is not found in history', () => {
    render(<EpisodeTrajectory episodeStatsHistory={[episodeStats({ episode: 1 })]} selectedEpisode={999} />)
    expect(screen.getByTestId('episode-trajectory-empty')).toBeTruthy()
  })

  it('shows the summary (Start / Steps / Next State / Termination) for the selected Episode', () => {
    render(<EpisodeTrajectory episodeStatsHistory={[episodeStats({ episode: 1 })]} selectedEpisode={1} />)
    expect(screen.getByTestId('episode-trajectory-start').textContent).toBe('0,3')
    expect(screen.getByTestId('episode-trajectory-step-count').textContent).toBe('3')
    expect(screen.getByTestId('episode-trajectory-end').textContent).toBe('0,0')
    expect(screen.getByTestId('episode-trajectory-termination').textContent).toBe('Goal')
  })

  it('shows the Bomb termination label when the Episode ended on a Bomb', () => {
    render(
      <EpisodeTrajectory
        episodeStatsHistory={[episodeStats({ episode: 1, terminationReason: 'bomb' })]}
        selectedEpisode={1}
      />,
    )
    expect(screen.getByTestId('episode-trajectory-termination').textContent).toBe('Bomb')
  })

  it('renders one row per transition, with State/Action/Reward/Next State matching the real trajectory data exactly', () => {
    render(<EpisodeTrajectory episodeStatsHistory={[episodeStats({ episode: 1 })]} selectedEpisode={1} />)

    const row0 = within(screen.getByTestId('trajectory-step-row-0'))
    expect(row0.getByTestId('trajectory-step-state-0').textContent).toBe('0,3')
    expect(row0.getByTestId('trajectory-step-action-0').textContent).toBe('Up')
    expect(row0.getByTestId('trajectory-step-reward-0').textContent).toBe('-1.00')
    expect(row0.getByTestId('trajectory-step-next-state-0').textContent).toBe('0,2')

    const row2 = within(screen.getByTestId('trajectory-step-row-2'))
    expect(row2.getByTestId('trajectory-step-reward-2').textContent).toBe('10.00') // real Goal reward, not stepReward
    expect(row2.getByTestId('trajectory-step-next-state-2').textContent).toBe('0,0')
  })

  it('translates the Action label to Korean via the shared translateActionLabel/actionLabel pipeline', () => {
    render(
      <EpisodeTrajectory
        episodeStatsHistory={[episodeStats({ episode: 1 })]}
        selectedEpisode={1}
        t={translations.ko}
        locale="ko"
      />,
    )
    expect(screen.getByTestId('trajectory-step-action-0').textContent).toBe('위')
  })

  it('a repeated State appears as separate rows in the correct order (not deduplicated)', () => {
    render(
      <EpisodeTrajectory
        episodeStatsHistory={[
          episodeStats({
            episode: 1,
            trajectory: [
              { state: '0,0', action: 0, nextState: '0,0', reward: -1, done: false },
              { state: '0,0', action: 1, nextState: '0,0', reward: -1, done: false },
              { state: '0,0', action: 3, nextState: '1,0', reward: 10, done: true },
            ],
          }),
        ]}
        selectedEpisode={1}
      />,
    )
    expect(screen.getByTestId('trajectory-step-row-0')).toBeTruthy()
    expect(screen.getByTestId('trajectory-step-row-1')).toBeTruthy()
    expect(screen.getByTestId('trajectory-step-row-2')).toBeTruthy()
    expect(screen.getByTestId('trajectory-step-action-0').textContent).toBe('Up')
    expect(screen.getByTestId('trajectory-step-action-1').textContent).toBe('Down')
  })

  it('caps the initially rendered rows at 50 for a very long Episode, with a "Show all steps" toggle to reveal the rest', () => {
    const longTrajectory = Array.from({ length: 120 }, (_, i) => ({
      state: `${i},0`,
      action: 3,
      nextState: `${i + 1},0`,
      reward: -0.1,
      done: i === 119,
    }))
    render(
      <EpisodeTrajectory
        episodeStatsHistory={[episodeStats({ episode: 1, steps: 120, trajectory: longTrajectory })]}
        selectedEpisode={1}
      />,
    )

    expect(screen.getByTestId('trajectory-step-row-49')).toBeTruthy()
    expect(screen.queryByTestId('trajectory-step-row-50')).toBeNull()
    expect(screen.getByTestId('episode-trajectory-truncated-note').textContent).toBe(
      'Showing the first 50 of 120 steps.',
    )

    fireEvent.click(screen.getByTestId('episode-trajectory-toggle-show-all'))

    expect(screen.getByTestId('trajectory-step-row-119')).toBeTruthy()
    expect(screen.queryByTestId('episode-trajectory-truncated-note')).toBeNull()
  })

  it('never truncates the underlying step count summary, even while the table itself is capped', () => {
    const longTrajectory = Array.from({ length: 120 }, (_, i) => ({
      state: `${i},0`,
      action: 3,
      nextState: `${i + 1},0`,
      reward: -0.1,
      done: i === 119,
    }))
    render(
      <EpisodeTrajectory
        episodeStatsHistory={[episodeStats({ episode: 1, steps: 120, trajectory: longTrajectory })]}
        selectedEpisode={1}
      />,
    )
    expect(screen.getByTestId('episode-trajectory-step-count').textContent).toBe('120')
  })

  it('does not show a "Show all steps" toggle for a short Episode (nothing to expand)', () => {
    render(<EpisodeTrajectory episodeStatsHistory={[episodeStats({ episode: 1 })]} selectedEpisode={1} />)
    expect(screen.queryByTestId('episode-trajectory-toggle-show-all')).toBeNull()
  })

  it('the heading and empty state translate to Korean', () => {
    render(<EpisodeTrajectory episodeStatsHistory={[]} t={translations.ko} />)
    expect(screen.getByTestId('episode-trajectory-empty').textContent).toBe(
      'History에서 Episode를 선택하면 이동 경로가 표시됩니다.',
    )
  })
})
