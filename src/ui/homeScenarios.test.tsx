// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HOME_SCENARIOS, scenarioFrames } from './homeScenarios'
import { GridDemo } from './GridDemo'
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

describe('Real-rule illustrative scenarios', () => {
  it.each(HOME_SCENARIOS)('$id completes in both modes and keeps frame history detached', scenario => {
    for (const mode of ['explore', 'learned'] as const) {
      const frames = scenarioFrames(scenario, mode)
      expect(frames.at(-1)?.done).toBe(true)
      expect(frames.at(-1)?.model.goals).toEqual([])
      expect(frames[0].model.goals).toHaveLength(1)
    }
  })
  it('demonstrates a portal jump, opening wall, collapsed floor and blocked departure', () => {
    expect(scenarioFrames(HOME_SCENARIOS[1], 'explore')[1].model.agentPos).toBe('4,2')
    expect(scenarioFrames(HOME_SCENARIOS[2], 'explore')[2].model.openGroups).toContain('G1')
    expect(scenarioFrames(HOME_SCENARIOS[3], 'explore')[2].model.collapsedFragiles).toContain('1,2')
    expect(scenarioFrames(HOME_SCENARIOS[4], 'explore')[2].model.agentPos).toBe('1,2')
  })
  it('automatically advances scenarios, pauses, allows selection and cleans up timers', () => {
    vi.useFakeTimers()
    const { unmount } = render(<GridDemo locale="ko" />)
    act(() => vi.advanceTimersByTime(13200))
    expect(document.querySelector('.demo-card')?.getAttribute('data-scenario')).toBe('portal')
    fireEvent.click(screen.getByRole('button', { name: '일시정지' }))
    const position = screen.getByRole('img').getAttribute('aria-label')
    act(() => vi.advanceTimersByTime(3000)); expect(screen.getByRole('img').getAttribute('aria-label')).toBe(position)
    fireEvent.click(screen.getByTestId('demo-fragile')); fireEvent.click(screen.getByRole('button', { name: '한 칸 이동' }))
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('1번 이동')
    unmount(); expect(vi.getTimerCount()).toBe(0)
  })
  it('stays paused under reduced motion until explicitly played', () => {
    vi.useFakeTimers(); vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    render(<GridDemo locale="en" />)
    act(() => vi.advanceTimersByTime(3000))
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('0 moves')
    fireEvent.click(screen.getByRole('button', { name: 'Play demo' })); act(() => vi.advanceTimersByTime(600))
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('1 moves')
  })
})
