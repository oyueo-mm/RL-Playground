// @vitest-environment jsdom
import { expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { SimulationEngine } from './SimulationEngine'
import { DEFAULT_RESOURCE_BUDGET } from './resources'
import { GREEDY_PLAYBACK_SLIDER, GREEDY_PLAYBACK_SPEED, speedToSlider } from '../../viz/controls/speedSlider'
import { SpeedControl } from '../../viz/controls/SpeedControl'
import { createDefaultGridWorldConfig } from '../environments/gridworld/GridWorldEnv'
import type { TimerSource } from './Scheduler'

const manual = (): TimerSource => ({ now: () => 0, setTimeout: () => 1, clearTimeout: () => {}, requestAnimationFrame: () => 2, cancelAnimationFrame: () => {} })

it('defaults the Q row budget to 1,000,000 without preallocating rows', () => {
  expect(DEFAULT_RESOURCE_BUDGET.maxQStates).toBe(1_000_000)
  const engine = new SimulationEngine({ timerSource: manual(), envConfig: createDefaultGridWorldConfig() })
  const metrics = engine.getResourceMetrics()
  expect(metrics.budget.maxQStates).toBe(1_000_000)
  expect(metrics.qStates).toBe(0)
  engine.step()
  expect(engine.getResourceMetrics().qStates).toBeLessThanOrEqual(2)
})

it('keeps a user-entered budget through resets and restores the new default when reset to defaults', () => {
  const engine = new SimulationEngine({ timerSource: manual(), envConfig: createDefaultGridWorldConfig() })
  engine.setResourceBudget({ maxQStates: 4321 })
  engine.reset()
  expect(engine.getResourceMetrics().budget.maxQStates).toBe(4321)
  engine.setResourceBudget(DEFAULT_RESOURCE_BUDGET)
  expect(engine.getResourceMetrics().budget.maxQStates).toBe(1_000_000)
})

it('plays Greedy results at 205 ms/step by default and restores the training speed afterwards', () => {
  expect(GREEDY_PLAYBACK_SPEED).toEqual({ mode: 'interval', intervalMs: 205 })
  expect(speedToSlider(GREEDY_PLAYBACK_SPEED)).toBe(GREEDY_PLAYBACK_SLIDER)
  const engine = new SimulationEngine({ timerSource: manual(), envConfig: createDefaultGridWorldConfig(), speed: { mode: 'batch', stepsPerFrame: 7 } })
  engine.run({ episodes: 1, greedy: true })
  expect(engine.getSpeed()).toEqual({ mode: 'interval', intervalMs: 205 })
  render(createElement(SpeedControl, { speed: engine.getSpeed(), onChange: () => {} }))
  expect(screen.getByTestId('speed-control').textContent).toContain('205 ms / step')
  engine.restartEpisode()
  expect(engine.getSpeed()).toEqual({ mode: 'batch', stepsPerFrame: 7 })
})

it('leaves normal and turbo training speeds untouched', () => {
  const engine = new SimulationEngine({ timerSource: manual(), envConfig: createDefaultGridWorldConfig(), speed: { mode: 'interval', intervalMs: 50 } })
  engine.run({ episodes: 1 })
  expect(engine.getSpeed()).toEqual({ mode: 'interval', intervalMs: 50 })
  engine.restartEpisode()
  engine.run({ episodes: 1, turbo: true })
  expect(engine.getSpeed()).toEqual({ mode: 'interval', intervalMs: 50 })
})
