// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { SimulationEngine } from '../../core/engine/SimulationEngine'
import { createDefaultGridWorldConfig } from '../../core/environments/gridworld/GridWorldEnv'
import { RewardVisualization } from './RewardVisualization'

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })
const config = {...createDefaultGridWorldConfig(),width:3,height:3,start:{x:0,y:1},goals:[{x:0,y:0},{x:2,y:2}],walls:[],wallPenalty:-1,stepReward:-.1}
it('shows actual first goal, collected-goal revisit, wall collision, and reset rewards in both languages', () => {
  const engine = new SimulationEngine({envConfig:config,hyperparams:{alpha:0,gamma:.9,epsilon:0}})
  const view = render(<RewardVisualization snapshot={engine.getSnapshot()} locale="en" live legend />)
  expect(screen.getByTestId('last-reward').textContent).toBe('—')
  engine.step() // first goal
  view.rerender(<RewardVisualization snapshot={engine.getSnapshot()} locale="en" live legend />)
  expect(screen.getByTestId('last-reward').textContent).toBe('+10')
  expect(screen.getByTestId('episode-reward').textContent).toBe('+10')
  engine.step() // boundary collision
  view.rerender(<RewardVisualization snapshot={engine.getSnapshot()} locale="ko" live legend />)
  expect(screen.getByTestId('last-reward').textContent).toBe('−1')
  expect(screen.getByText(/이동 실패/)).toBeTruthy()
  // Force down then up by deterministic exploration, using the actual engine.
  engine.setHyperparams({epsilon:1})
  const rng=vi.spyOn(Math,'random').mockReturnValue(.3);engine.step();rng.mockReturnValue(0);engine.step();rng.mockRestore()
  view.rerender(<RewardVisualization snapshot={engine.getSnapshot()} locale="ko" live />)
  expect(screen.getByTestId('last-reward').textContent).toBe('−0.1')
  expect(screen.getByTestId('episode-reward').textContent).toBe('+8.8')
  engine.reset();view.rerender(<RewardVisualization snapshot={engine.getSnapshot()} locale="en" live />)
  expect(screen.getByTestId('last-reward').textContent).toBe('—')
  expect(screen.getByTestId('episode-reward').textContent).toBe('0')
})
it.each(['goal','bomb'])('retains completed %s reward until a new action instead of flashing zero', kind => {
  const engine = new SimulationEngine({envConfig:{...config,goals:kind==='goal'?[{x:0,y:0}]:config.goals.slice(1),bombs:kind==='bomb'?[{x:0,y:0}]:[]}})
  engine.step()
  const snapshot=engine.getSnapshot()
  expect(snapshot.stats.episodeReward).toBe(0)
  render(<RewardVisualization snapshot={snapshot} locale="en" live />)
  expect(screen.getByTestId('episode-reward').textContent).toBe(kind==='goal'?'+10':'−10')
  expect(screen.getByText(/Last completed episode/)).toBeTruthy()
})
it('samples a single animated transition, expires it and clears on reset/toggle', () => {
  vi.useFakeTimers()
  const engine=new SimulationEngine({envConfig:config});engine.step()
  const view=render(<RewardVisualization snapshot={engine.getSnapshot()} locale="en" animate />)
  expect(screen.getAllByTestId('reward-animation')).toHaveLength(1)
  act(()=>vi.advanceTimersByTime(651));expect(screen.queryByTestId('reward-animation')).toBeNull()
  engine.step();view.rerender(<RewardVisualization snapshot={engine.getSnapshot()} locale="en" animate />)
  expect(screen.getAllByTestId('reward-animation')).toHaveLength(1)
  view.rerender(<RewardVisualization snapshot={engine.getSnapshot()} locale="en" />)
  expect(screen.queryByTestId('reward-animation')).toBeNull()
})
it('only labels remaining goals and bombs when zoom makes cells legible, never walls', () => {
  vi.stubGlobal('ResizeObserver',class { observe(){} disconnect(){} })
  vi.spyOn(SVGElement.prototype,'getBoundingClientRect').mockReturnValue({width:144} as DOMRect)
  const engine=new SimulationEngine({envConfig:config});engine.step()
  const view=render(<RewardVisualization snapshot={engine.getSnapshot()} locale="en" map />)
  expect(screen.getByTestId('map-rewards').querySelectorAll('text')).toHaveLength(1)
  expect(screen.getByTestId('map-rewards').textContent).toBe('+10')
  view.rerender(<RewardVisualization snapshot={engine.getSnapshot()} locale="en" />)
  expect(screen.queryByTestId('map-rewards')).toBeNull()
  vi.restoreAllMocks()
})
