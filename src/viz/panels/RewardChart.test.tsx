// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
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
})
