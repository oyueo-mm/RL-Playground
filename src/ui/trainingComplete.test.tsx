// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { engine } from './engine'
import { createDefaultGridWorldConfig } from '../core/environments/gridworld/GridWorldEnv'

const config = { ...createDefaultGridWorldConfig(), width: 3, height: 3, start: { x: 0, y: 0 }, goals: [{ x: 2, y: 0 }], bombs: [{ x: 1, y: 1 }], walls: [] }
beforeEach(() => {
  vi.useFakeTimers(); vi.spyOn(performance, 'now').mockImplementation(() => Date.now())
  engine.reset({ envConfig: config, algorithmId: 'q-learning', hyperparams: { alpha: .1, gamma: .9, epsilon: 1 } })
  engine.setResourceBudget({ maxEpisodeSteps: 30 })
  engine.setSpeed({ mode: 'batch', stepsPerFrame: 100 })
})
afterEach(() => { cleanup(); engine.reset(); vi.useRealTimers(); vi.restoreAllMocks() })
const run = (ms = 4000) => act(() => { vi.advanceTimersByTime(ms) })
const dialog = () => screen.queryByTestId('training-complete')
const start = (episodes: number, turbo = false) => { act(() => engine.run({ episodes, turbo })); run() }

describe('training-complete dialog', () => {
  it('opens once, with this run’s real numbers, when the requested episodes are all done', () => {
    render(<App />)
    expect(dialog()).toBeNull()
    start(12)
    expect(engine.getSnapshot().status).toBe('idle')
    const box = dialog()!
    expect(box.textContent).toContain('학습 완료!')
    expect(box.textContent).toContain('12개 에피소드')
    const history = engine.getSnapshot().stats.episodeStatsHistory
    const successes = history.filter(e => e.terminationReason === 'goal').length
    expect(screen.getByTestId('completion-episodes').textContent).toBe('12')
    expect(screen.getByTestId('completion-success').textContent).toContain(`${(successes / 12 * 100).toFixed(1)}%`)
    expect(screen.getByTestId('completion-success').textContent).toContain(`${successes} / 12`)
    const mean = history.reduce((n, e) => n + e.totalReward, 0) / 12
    expect(screen.getByTestId('completion-reward').textContent!.replace('−', '-').replace('+', '')).toBe(mean.toFixed(2))
    expect(box.textContent).toContain('최적 정책에 수렴했다는 뜻은 아닙니다')
  })
  it('reports only the latest request, not earlier history', () => {
    render(<App />)
    start(8); fireEvent.click(screen.getByTestId('completion-close'))
    start(5)
    expect(screen.getByTestId('completion-episodes').textContent).toBe('5')
    expect(engine.getSnapshot().episode).toBe(13)
    const mine = engine.getSnapshot().stats.episodeStatsHistory.slice(-5)
    expect(screen.getByTestId('completion-reward').textContent!.replace('−', '-').replace('+', '')).toBe((mine.reduce((n, e) => n + e.totalReward, 0) / 5).toFixed(2))
  })
  it('shows once per run: re-renders, navigation and language switches do not reopen it', () => {
    const { rerender } = render(<App />)
    start(6); expect(dialog()).not.toBeNull()
    fireEvent.click(screen.getByTestId('completion-close')); expect(dialog()).toBeNull()
    rerender(<App />); run(1000)
    fireEvent.click(screen.getByTestId('nav-guide')); fireEvent.click(screen.getByTestId('nav-environment'))
    fireEvent.change(screen.getAllByTestId('language-selector')[0], { target: { value: 'en' } })
    expect(dialog()).toBeNull()
  })
  it('closes with Escape, keeps the Q-table and results, and focus returns to the page', () => {
    render(<App />)
    const before = document.activeElement
    start(6)
    const learned = engine.getSnapshot().agentSnapshot
    expect(document.activeElement?.getAttribute('data-testid')).toBe('completion-results') // keyboard users land on the main action
    fireEvent(dialog()!, new Event('cancel', { cancelable: true }))
    expect(dialog()).toBeNull()
    expect(engine.getSnapshot().agentSnapshot).toEqual(learned)
    expect(engine.getSnapshot().episode).toBe(6)
    expect(document.activeElement === before || document.activeElement === document.body).toBe(true)
  })
  it('“View results” opens the results page and leaves training data untouched', () => {
    render(<App />)
    start(6)
    const before = engine.getSnapshot()
    fireEvent.click(screen.getByTestId('completion-results'))
    expect(dialog()).toBeNull()
    expect(screen.getByTestId('nav-results').getAttribute('aria-current')).toBe('page')
    expect(engine.getSnapshot().agentSnapshot).toEqual(before.agentSnapshot)
    expect(engine.getSnapshot().stats.episodeStatsHistory).toEqual(before.stats.episodeStatsHistory)
  })
  it('Turbo Training completes with the same dialog', () => {
    render(<App />)
    start(15, true)
    expect(engine.getSnapshot().status).toBe('idle')
    expect(screen.getByTestId('completion-episodes').textContent).toBe('15')
    expect(dialog()!.textContent).toContain('Turbo')
  })
  it('shows English copy when the language is English', () => {
    render(<App />)
    fireEvent.change(screen.getAllByTestId('language-selector')[0], { target: { value: 'en' } })
    start(4)
    expect(dialog()!.textContent).toContain('Training complete!')
    expect(screen.getByTestId('completion-results').textContent).toBe('View results')
  })
  it.each([
    ['a user stop', () => { act(() => engine.run({ episodes: 100000 })); run(60); act(() => engine.restartEpisode()); run(2000) }],
    ['a pause', () => { act(() => engine.run({ episodes: 100000 })); run(60); act(() => engine.pause()); run(2000) }],
    ['greedy playback', () => { act(() => engine.run({ episodes: 1, greedy: true })); run(30000) }],
    ['a single episode', () => { act(() => engine.runEpisode()); run(30000) }],
    ['a reset', () => { act(() => engine.run({ episodes: 100000 })); run(60); act(() => engine.reset({ envConfig: config })); run(2000) }],
  ])('never opens for %s', (_name, action) => {
    render(<App />); action()
    expect(dialog()).toBeNull()
    expect(engine.getSnapshot().completedRun).toBeUndefined()
  })
  it('does not open for a resource-limit pause, but does once the resumed run finishes', () => {
    engine.reset({ envConfig: { ...config, width: 6, height: 6, goals: [{ x: 5, y: 5 }], bombs: [] } })
    engine.setResourceBudget({ maxQStates: 12, maxEpisodeSteps: 30 })
    render(<App />); start(300)
    expect(engine.getSnapshot().status).toBe('paused'); expect(dialog()).toBeNull()
    act(() => { engine.setResourceBudget({ maxQStates: 1000 }); engine.resume() }); run()
    expect(screen.getByTestId('completion-episodes').textContent).toBe('300')
  })
  it('does not reopen after a stale completed run when the page is mounted later', () => {
    start(5)
    expect(engine.getSnapshot().completedRun?.id).toBeGreaterThan(0)
    render(<App />); run(500)
    expect(dialog()).toBeNull() // a completion that happened before mounting is not announced
  })
})
