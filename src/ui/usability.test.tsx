// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { Notice } from './Notice'
import { ManualPlay } from './ManualPlay'
import { HOME_SCENARIOS } from './homeScenarios'
import App from './App'
import { engine } from './engine'
import { DEFAULT_RESOURCE_BUDGET } from '../core/engine/resources'
import { createDefaultGridWorldConfig } from '../core/environments/gridworld/GridWorldEnv'

afterEach(() => { cleanup(); vi.restoreAllMocks(); engine.reset(); engine.setResourceBudget(DEFAULT_RESOURCE_BUDGET) })
it('dismisses a notification once per event and supports keyboard activation', () => {
  const { rerender } = render(<Notice eventKey="first" title="Problem" kind="error" />)
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }))
  rerender(<Notice eventKey="first" title="Problem" kind="error" />)
  expect(screen.queryByRole('alert')).toBeNull()
  rerender(<Notice eventKey="second" title="Problem" kind="error" />)
  expect(screen.getByRole('alert')).toBeTruthy()
  screen.getByRole('button').focus(); expect(document.activeElement).toBe(screen.getByRole('button'))
})
it.each(HOME_SCENARIOS)('manual play uses actual $id rules, completes, restarts and never touches Q', scenario => {
  const before = engine.getSnapshot(), close = vi.fn()
  render(<ManualPlay config={scenario.config} locale="en" active onClose={close} />)
  const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
  for (const action of scenario.explore) fireEvent.keyDown(window, { key: keys[action] })
  expect(screen.getByTestId('manual-progress').textContent).toContain('Success')
  fireEvent.keyDown(window, { key: 'r' })
  expect(screen.getByTestId('manual-progress').textContent).toContain('0 steps')
  fireEvent.keyDown(window, { key: 'Escape' }); expect(close).toHaveBeenCalledOnce()
  expect(engine.getSnapshot()).toEqual(before)
})
it('manual play ignores repeat/input keys and provides touch-sized directional controls', () => {
  render(<><input aria-label="field" /><ManualPlay config={HOME_SCENARIOS[0].config} locale="en" active onClose={() => {}} /></>)
  fireEvent.keyDown(window, { key: 'ArrowRight', repeat: true })
  fireEvent.keyDown(screen.getByLabelText('field'), { key: 'ArrowRight' })
  expect(screen.getByTestId('manual-progress').textContent).toContain('0 steps')
  fireEvent.click(screen.getByRole('button', { name: /^Right$/ }))
  expect(screen.getByTestId('manual-progress').textContent).toContain('1 steps')
})
it('returns to the same editor draft, selected tool and undo history', () => {
  render(<App />); fireEvent.click(screen.getByTestId('nav-editor'))
  const editor = screen.getByTestId('env-editor')
  fireEvent.click(within(editor).getByTestId('cell-2,2'))
  const before = engine.getSnapshot()
  fireEvent.click(screen.getByTestId('manual-play-start'))
  fireEvent.keyDown(window, { key: 'd' }); fireEvent.keyDown(window, { key: 'Escape' })
  expect(screen.queryByTestId('manual-play')).toBeNull()
  expect(within(editor).getByTestId('cell-2,2').getAttribute('data-cell-kind')).toBe('wall')
  expect(screen.getByTestId('env-editor-mode-wall').getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(screen.getByTestId('editor-undo'))
  expect(within(editor).getByTestId('cell-2,2').getAttribute('data-cell-kind')).not.toBe('wall')
  expect(engine.getSnapshot()).toEqual(before)
})
it('keeps structural validation active after dismissing its message', () => {
  render(<App />); fireEvent.click(screen.getByTestId('nav-editor'))
  const editor = screen.getByTestId('env-editor')
  fireEvent.click(screen.getByTestId('env-editor-mode-portal'))
  fireEvent.click(within(editor).getByTestId('cell-1,1'))
  expect((screen.getByTestId('manual-play-start') as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(within(screen.getByTestId('env-editor-errors')).getByRole('button', { name: '알림 닫기' }))
  expect(screen.queryByTestId('env-editor-errors')).toBeNull()
  expect((screen.getByTestId('env-editor-apply') as HTMLButtonElement).disabled).toBe(true)
  expect((screen.getByTestId('manual-play-start') as HTMLButtonElement).disabled).toBe(true)
})
it('keeps a selected summary safe when its trajectory expires during subsequent training', () => {
  engine.reset({ envConfig: { ...createDefaultGridWorldConfig(), start: { x: 0, y: 1 }, goals: [{ x: 0, y: 0 }] }, hyperparams: { alpha: .1, gamma: .9, epsilon: 0 } })
  engine.setResourceBudget({ maxDetailedEpisodes: 1 }); engine.step()
  render(<App />); fireEvent.click(screen.getByTestId('nav-results'))
  fireEvent.click(screen.getByTestId('episode-history-row-1'))
  expect(screen.getByTestId('step-viewer')).toBeTruthy()
  fireEvent.click(screen.getByTestId('nav-environment'))
  fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
  engine.setSpeed({ mode: 'batch', stepsPerFrame: 100 })
  fireEvent.click(screen.getByTestId('playback-run-episode'))
  fireEvent.click(screen.getByTestId('nav-results'))
  expect(screen.getByTestId('trajectory-expired')).toBeTruthy()
  expect(screen.queryByTestId('step-viewer')).toBeNull()
  expect(screen.getByTestId('episode-history-row-1').getAttribute('data-selected')).toBe('true')
})
it('ends manual play on a bomb and discards the terminal state on restart', () => {
  render(<ManualPlay config={{ ...HOME_SCENARIOS[0].config, bombs: [{ x: 1, y: 4 }] }} locale="en" active onClose={() => {}} />)
  fireEvent.keyDown(window, { key: 'd' })
  expect(screen.getByTestId('manual-progress').textContent).toContain('Bomb')
  expect((screen.getByRole('button', { name: /^Right$/ }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.keyDown(window, { key: 'r' })
  expect(screen.getByTestId('manual-progress').textContent).toContain('0 steps')
})
