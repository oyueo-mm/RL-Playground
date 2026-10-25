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
  it('runs four independent concurrent scenarios, pauses and cleans up its single timer', () => {
    vi.useFakeTimers()
    const { unmount } = render(<GridDemo locale="ko" />)
    expect(screen.getAllByRole('img')).toHaveLength(4)
    act(() => vi.advanceTimersByTime(2600))
    const steps = () => [...document.querySelectorAll('.mini-demo')].map(el => el.getAttribute('data-step'))
    expect(steps()).toEqual(['4', '4', '4', '4'])
    fireEvent.click(screen.getByRole('button', { name: '일시정지' }))
    act(() => vi.advanceTimersByTime(3000)); expect(steps()).toEqual(['4', '4', '4', '4'])
    fireEvent.click(screen.getByRole('button', { name: '한 칸 이동' }))
    expect(steps()).toEqual(['5', '5', '5', '5'])
    fireEvent.click(screen.getByRole('button', { name: '시연 초기화' }))
    expect(steps()).toEqual(['0', '0', '0', '0'])
    unmount(); expect(vi.getTimerCount()).toBe(0)
  })
  it('stays paused under reduced motion until explicitly played', () => {
    vi.useFakeTimers(); vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    render(<GridDemo locale="en" />)
    act(() => vi.advanceTimersByTime(3000))
    expect(document.querySelector('.mini-demo')?.getAttribute('data-step')).toBe('0')
    fireEvent.click(screen.getByRole('button', { name: 'Play demo' })); act(() => vi.advanceTimersByTime(650))
    expect(document.querySelector('.mini-demo')?.getAttribute('data-step')).toBe('1')
  })
})
