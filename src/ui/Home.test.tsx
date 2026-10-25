// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { engine } from './engine'
import { createDefaultGridWorldConfig } from '../core/environments/gridworld/GridWorldEnv'

beforeEach(() => {
  engine.reset({ envConfig: createDefaultGridWorldConfig(), algorithmId: 'q-learning' })
  engine.setSpeed({ mode: 'interval', intervalMs: 100000 })
})
afterEach(() => { cleanup(); engine.reset(); vi.useRealTimers() })

describe('Home and workspace navigation', () => {
  it('opens and hides analysis without remounting panels or changing an active experiment', () => {
    render(<App />)
    fireEvent.click(screen.getByTestId('nav-environment'))
    const panel = screen.getByTestId('analysis-panel')
    expect(panel.hidden).toBe(true)
    fireEvent.click(screen.getByTestId('cell-1,1'))
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    const before = engine.getSnapshot()
    fireEvent.click(screen.getByTestId('toggle-analysis'))
    const qValues = screen.getByTestId('qvalue-bars')
    expect(panel.hidden).toBe(false)
    fireEvent.click(screen.getByTestId('toggle-analysis'))
    expect(panel.hidden).toBe(true)
    fireEvent.click(screen.getByTestId('toggle-analysis'))
    expect(screen.getByTestId('qvalue-bars')).toBe(qValues)
    expect(qValues.textContent).toContain('1,1')
    expect(engine.getSnapshot()).toEqual(before)
    expect(screen.getByTestId('toggle-analysis').getAttribute('aria-expanded')).toBe('true')
  })

  it('opens analysis from Results and preserves episode selection through panel toggles', () => {
    engine.reset({ envConfig: { ...createDefaultGridWorldConfig(), width: 1, height: 2, start: { x: 0, y: 1 }, goals: [{ x: 0, y: 0 }], walls: [], bombs: [], stepReward: -1, goalReward: 10 }, hyperparams: { alpha: 0.1, gamma: 0.9, epsilon: 0 } })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 100 })
    render(<App />)
    fireEvent.click(screen.getByTestId('nav-environment'))
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '2' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    fireEvent.click(screen.getByTestId('nav-results'))
    expect(screen.getByTestId('analysis-panel').hidden).toBe(false)
    fireEvent.click(screen.getByTestId('episode-history-row-1'))
    const trajectory = screen.getByTestId('episode-trajectory')
    const before = engine.getSnapshot()
    fireEvent.click(screen.getByTestId('toggle-analysis'))
    fireEvent.click(screen.getByTestId('toggle-analysis'))
    expect(screen.getByTestId('episode-trajectory')).toBe(trajectory)
    expect(engine.getSnapshot()).toEqual(before)
    expect(screen.getByTestId('episode-history-row-1').getAttribute('data-selected')).toBe('true')
  })

  it('opens on the Korean home with an explicitly scripted demo', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('강화학습 시뮬레이터')
    expect(screen.getByTestId('experiment-workspace').hidden).toBe(true)
    expect(screen.getByText(/실제 학습 결과가 아닙니다/)).toBeTruthy()
    expect(screen.getByTestId('nav-home').getAttribute('aria-current')).toBe('page')
    expect(engine.getSnapshot().lastTransition).toBeNull()
  })

  it('preserves a running experiment and UI selections through home, guide, and results', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /학습 시작하기/ }))
    fireEvent.click(screen.getByTestId('cell-1,1'))
    fireEvent.click(screen.getByTestId('toggle-policy'))
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    const before = engine.getSnapshot()
    expect(before.status).toBe('running')
    fireEvent.click(screen.getByTestId('nav-home'))
    fireEvent.click(screen.getByTestId('nav-guide'))
    fireEvent.click(screen.getByTestId('nav-results'))
    expect(engine.getSnapshot()).toEqual(before)
    expect(screen.getByTestId('experiment-workspace').hidden).toBe(false)
    expect((screen.getByTestId('toggle-policy') as HTMLInputElement).checked).toBe(true)
    expect(screen.getByTestId('qvalue-bars').textContent).toContain('1,1')
    fireEvent.click(screen.getByTestId('playback-pause'))
    expect(engine.getSnapshot().status).toBe('paused')
  })

  it('opens the existing editor and preserves its draft while navigating and translating', () => {
    render(<App />)
    fireEvent.click(screen.getByTestId('nav-editor'))
    const editor = document.getElementById('environment-editor')
    expect(editor).toBeTruthy()
    fireEvent.click(screen.getByTestId('nav-home'))
    fireEvent.change(screen.getAllByTestId('language-selector')[0], { target: { value: 'en' } })
    fireEvent.click(screen.getByTestId('nav-editor'))
    expect(document.getElementById('environment-editor')).toBe(editor)
    expect(document.documentElement.lang).toBe('en')
  })

  it('collapses the sidebar and closes the mobile drawer with Escape', () => {
    render(<App />)
    fireEvent.click(document.querySelector('.collapse-button')!)
    expect(document.querySelector('.app-shell')?.classList.contains('is-collapsed')).toBe(true)
    fireEvent.click(document.getElementById('mobile-menu')!)
    expect(document.querySelector('.workspace')?.hasAttribute('inert')).toBe(true)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(document.getElementById('mobile-menu')?.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement?.id).toBe('mobile-menu')
  })
})

describe('Illustrative GridWorld', () => {
  it('compares paths with different lengths without touching the real engine', () => {
    render(<App />)
    const before = engine.getSnapshot()
    for (let i = 0; i < 19; i++) fireEvent.click(screen.getByRole('button', { name: '한 칸 이동' }))
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('19번 이동')
    expect(screen.getByText(/목표 도달/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '학습 후 · 경로 활용' }))
    for (let i = 0; i < 9; i++) fireEvent.click(screen.getByRole('button', { name: '한 칸 이동' }))
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('9번 이동')
    expect(engine.getSnapshot()).toEqual(before)
  })

  it('plays, pauses, resets and stops its timer when leaving home', () => {
    vi.useFakeTimers()
    const intervals = vi.spyOn(window, 'setInterval')
    const clearInterval = vi.spyOn(window, 'clearInterval')
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '시연 재생' }))
    act(() => vi.advanceTimersByTime(1200))
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('2번 이동')
    fireEvent.click(screen.getByRole('button', { name: '일시정지' }))
    act(() => vi.advanceTimersByTime(1200))
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('2번 이동')
    fireEvent.click(screen.getByRole('button', { name: '시연 초기화' }))
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('0번 이동')
    fireEvent.click(screen.getByRole('button', { name: '시연 재생' }))
    const demoTimer = intervals.mock.results.at(-1)!.value
    fireEvent.click(screen.getByTestId('nav-environment'))
    expect(clearInterval).toHaveBeenCalledWith(demoTimer)
    intervals.mockRestore()
    clearInterval.mockRestore()
  })
})
