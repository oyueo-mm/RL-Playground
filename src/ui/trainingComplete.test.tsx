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
const toast = () => screen.queryByTestId('training-complete')
const mount = () => { const view = render(<App />); fireEvent.click(screen.getByTestId('nav-environment')); return view }
const start = (episodes: number, turbo = false) => { act(() => engine.run({ episodes, turbo })); run() }

describe('training-complete toast', () => {
  it('appears once, as a small non-blocking status with this run’s real episode count', () => {
    mount()
    expect(toast()).toBeNull()
    start(12)
    expect(engine.getSnapshot().status).toBe('idle')
    const box = toast()!
    expect(screen.getByTestId('completion-message').textContent).toBe('12번 학습 완료!')
    expect(box.getAttribute('role')).toBe('status'); expect(box.getAttribute('aria-live')).toBe('polite')
    expect(document.querySelector('dialog')).toBeNull() // no modal, no backdrop, no focus trap
    expect(box.textContent).not.toMatch(/%|보상/) // no success rate or reward statistics
    expect(box.contains(document.activeElement)).toBe(false) // focus is not stolen
  })
  it('formats thousands and reports only the latest request', () => {
    mount()
    start(8); fireEvent.click(screen.getByTestId('completion-close'))
    start(1000)
    expect(screen.getByTestId('completion-message').textContent).toBe('1,000번 학습 완료!')
    expect(engine.getSnapshot().episode).toBe(1008)
  })
  it('shows English copy when the language is English', () => {
    mount()
    fireEvent.change(screen.getAllByTestId('language-selector')[0], { target: { value: 'en' } })
    start(4)
    expect(screen.getByTestId('completion-message').textContent).toBe('4 episodes complete!')
    expect(screen.getByTestId('completion-run-policy').textContent).toContain('Run policy')
  })
  it('× removes only the note and keeps the Q-table and history', () => {
    mount()
    start(6)
    const learned = engine.getSnapshot().agentSnapshot, history = engine.getSnapshot().stats.episodeStatsHistory
    fireEvent.click(screen.getByTestId('completion-close'))
    expect(toast()).toBeNull()
    expect(engine.getSnapshot().agentSnapshot).toEqual(learned)
    expect(engine.getSnapshot().stats.episodeStatsHistory).toEqual(history)
  })
  it('closes by itself after about eight seconds, unless hovered or focused', () => {
    mount()
    start(6)
    run(3000); expect(toast()).not.toBeNull()
    run(5500); expect(toast()).toBeNull()
    start(6)
    fireEvent.mouseEnter(toast()!)
    run(30000); expect(toast()).not.toBeNull() // paused while hovered
    fireEvent.mouseLeave(toast()!); run(8500); expect(toast()).toBeNull()
    start(6)
    fireEvent.focus(screen.getByTestId('completion-run-policy'))
    run(30000); expect(toast()).not.toBeNull() // paused while a button has focus
  })
  it('does not reappear after re-renders, navigation or language switches', () => {
    const { rerender } = mount()
    start(6); expect(toast()).not.toBeNull()
    fireEvent.click(screen.getByTestId('completion-close')); expect(toast()).toBeNull()
    rerender(<App />); run(1000)
    fireEvent.click(screen.getByTestId('nav-guide')); fireEvent.click(screen.getByTestId('nav-environment'))
    fireEvent.change(screen.getAllByTestId('language-selector')[0], { target: { value: 'en' } })
    expect(toast()).toBeNull()
  })
  it('disappears when leaving the learning screen and is not replayed on return', () => {
    mount()
    start(6); expect(toast()).not.toBeNull()
    fireEvent.click(screen.getByTestId('nav-results'))
    expect(toast()).toBeNull()
    fireEvent.click(screen.getByTestId('nav-environment')); run(500)
    expect(toast()).toBeNull()
  })
  it('a run that finishes while another page is open is not announced later', () => {
    mount()
    fireEvent.click(screen.getByTestId('nav-guide'))
    start(6)
    expect(engine.getSnapshot().completedRun?.id).toBeGreaterThan(0)
    fireEvent.click(screen.getByTestId('nav-environment')); run(500)
    expect(toast()).toBeNull()
  })
  it('a new run or a reset removes an open note', () => {
    mount()
    start(6); expect(toast()).not.toBeNull()
    act(() => engine.run({ episodes: 100000 })); run(60)
    expect(toast()).toBeNull()
    act(() => engine.restartEpisode())
    start(6); expect(toast()).not.toBeNull()
    act(() => engine.reset({ envConfig: config })); expect(toast()).toBeNull()
  })
  it('Run policy replays the Q-table greedily on the same screen, with no results navigation or learning', () => {
    mount()
    start(30)
    const before = engine.getSnapshot(), learned = before.agentSnapshot
    const nav = screen.getByTestId('nav-environment').getAttribute('aria-current')
    fireEvent.click(screen.getByTestId('completion-run-policy'))
    expect(toast()).toBeNull()
    expect(engine.getSnapshot().isGreedyRun).toBe(true) // the same run as the toolbar's playback-run-greedy
    expect(screen.getByTestId('nav-environment').getAttribute('aria-current')).toBe(nav)
    expect(screen.getByTestId('nav-environment').getAttribute('aria-current')).toBe('page')
    run(30000)
    expect(engine.getSnapshot().status).toBe('idle')
    expect(toast()).toBeNull() // the end of a greedy replay is not announced
    expect(engine.getSnapshot().agentSnapshot).toEqual(learned) // no learning, no reset
  })
  it('the toolbar button and the toast share the same greedy path', () => {
    mount()
    start(10)
    fireEvent.click(screen.getByTestId('playback-run-greedy'))
    expect(engine.getSnapshot().isGreedyRun).toBe(true)
    expect(toast()).toBeNull()
    run(30000)
  })
  it('Turbo Training completes with the same toast and Run policy leaves the Turbo dashboard for the grid', () => {
    mount()
    fireEvent.change(screen.getByTestId('training-mode'), { target: { value: 'turbo' } })
    start(15, true)
    expect(engine.getSnapshot().status).toBe('idle')
    expect(screen.getByTestId('completion-message').textContent).toBe('15번 학습 완료!')
    fireEvent.click(screen.getByTestId('completion-run-policy'))
    expect(engine.getSnapshot().isGreedyRun).toBe(true)
    expect(screen.queryByTestId('turbo-dashboard')).toBeNull()
    expect(screen.getAllByTestId('agent-marker').length).toBeGreaterThan(0)
  })
  it.each([
    ['a user stop', () => { act(() => engine.run({ episodes: 100000 })); run(60); act(() => engine.restartEpisode()); run(2000) }],
    ['a pause', () => { act(() => engine.run({ episodes: 100000 })); run(60); act(() => engine.pause()); run(2000) }],
    ['greedy playback', () => { act(() => engine.run({ episodes: 1, greedy: true })); run(30000) }],
    ['a single episode', () => { act(() => engine.runEpisode()); run(30000) }],
    ['a reset', () => { act(() => engine.run({ episodes: 100000 })); run(60); act(() => engine.reset({ envConfig: config })); run(2000) }],
  ])('never appears for %s', (_name, action) => {
    mount(); action()
    expect(toast()).toBeNull()
    expect(engine.getSnapshot().completedRun).toBeUndefined()
  })
  it('does not appear for a resource-limit pause, but does once the resumed run finishes', () => {
    engine.reset({ envConfig: { ...config, width: 6, height: 6, goals: [{ x: 5, y: 5 }], bombs: [] } })
    engine.setResourceBudget({ maxQStates: 12, maxEpisodeSteps: 30 })
    mount(); start(300)
    expect(engine.getSnapshot().status).toBe('paused'); expect(toast()).toBeNull()
    act(() => { engine.setResourceBudget({ maxQStates: 1000 }); engine.resume() }); run()
    expect(screen.getByTestId('completion-message').textContent).toBe('300번 학습 완료!')
  })
  it('does not announce a completion that happened before the page was mounted', () => {
    start(5)
    expect(engine.getSnapshot().completedRun?.id).toBeGreaterThan(0)
    mount(); run(500)
    expect(toast()).toBeNull()
  })
})
