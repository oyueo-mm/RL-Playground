// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { plotIndices, CHART_POINT_LIMIT } from './chartSampling'
import { RewardChart } from './RewardChart'
import { LearningProgress } from './LearningProgress'
afterEach(cleanup)

it('bounds display points while preserving endpoints, extrema and selected records', () => {
  const indices = plotIndices(100000, [50, 99, 43004])
  expect(indices.length).toBeLessThanOrEqual(CHART_POINT_LIMIT)
  for (const index of [0, 50, 99, 43004, 99999]) expect(indices).toContain(index)
})
it('renders very large histories without argument-stack overflow or unbounded DOM', () => {
  const values = Array.from({ length: 150000 }, (_, i) => i === 50000 ? 1000 : -1)
  const numbers = values.map((_, i) => i + 1)
  const { container } = render(<RewardChart rewardHistory={values} episodeNumbers={numbers} selectedEpisode={50001} />)
  expect(container.querySelectorAll('circle').length).toBeLessThanOrEqual(CHART_POINT_LIMIT + 1)
  expect(screen.getByTestId('reward-chart-selected-point')).toBeTruthy()
  expect(screen.getByTestId('reward-chart-path').getAttribute('d')).not.toMatch(/NaN|Infinity/)
})
it('keeps large progress charts bounded and retains exact selection values', () => {
  const history = Array.from({ length: 10000 }, (_, i) => ({ episode: i + 1, steps: i % 200, totalReward: i, terminationReason: 'truncated' as const, explorationCount: 0, exploitationCount: i % 200, explorationRate: 0, averageReward: 0, uniqueStates: 1, trajectory: [] }))
  const { container } = render(<LearningProgress episodeStatsHistory={history} selectedEpisode={9999} />)
  expect(container.querySelectorAll('circle').length).toBeLessThanOrEqual(CHART_POINT_LIMIT * 2 + 2)
  expect(screen.getByTestId('learning-progress-total-reward-selected-point')).toBeTruthy()
})
