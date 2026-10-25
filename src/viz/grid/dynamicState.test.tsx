// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { PolicyOverlay } from './PolicyOverlay'
import { ValueHeatmap } from './ValueHeatmap'
import { QValueBars } from '../panels/QValueBars'
import { GridSvg } from './GridSvg'
import { createDefaultGridWorldConfig, GridWorldEnv } from '../../core/environments/gridworld/GridWorldEnv'
import type { AgentSnapshot } from '../../core/types/render'
import { visibleQEntries } from './visibleQEntries'

afterEach(cleanup)
it('bounds rendering work by map cells instead of enumerating accumulated dynamic states', () => {
  let lookups = 0
  const table = new Proxy<Record<string, number[]>>({ '1,1,0,1,0': [0, 0, 0, 1] }, { get(target, key: string) { lookups++; return target[key] }, ownKeys() { throw new Error('Must not enumerate the historical Q-table') } })
  const model = new GridWorldEnv(createDefaultGridWorldConfig()).getRenderModel()
  expect(visibleQEntries(model, { kind: 'Q', qTable: table }, '0,0,0,1,0')).toHaveLength(1)
  expect(lookups).toBeLessThanOrEqual(50)
})
it('policy, value and inspector resolve the same complete dynamic suffix', () => {
  const model = new GridWorldEnv(createDefaultGridWorldConfig()).getRenderModel()
  const agent: AgentSnapshot = { kind: 'Q', qTable: { '1,1,0,0,0': [0, 7, 0, 0], '1,1,0,1,0': [0, 0, 0, 9] } }
  render(<><PolicyOverlay renderModel={model} agentSnapshot={agent} currentState="0,0,0,1,0" /><ValueHeatmap renderModel={model} agentSnapshot={agent} currentState="0,0,0,1,0" /><QValueBars selectedState="1,1" currentState="0,0,0,1,0" agentSnapshot={agent} /></>)
  expect(screen.getAllByTestId(/^policy-arrow-/)).toHaveLength(1)
  expect(screen.getByTestId('policy-arrow-1,1,0,1,0').textContent).toBe('→')
  expect(screen.getByTestId('value-cell-1,1,0,1,0').getAttribute('data-value')).toBe('9')
  expect(screen.getByTestId('greedy-value').textContent).toContain('9.0000')
})
it('renders all features with initial/dynamic distinctions and a flat non-scaling selection', () => {
  const env = new GridWorldEnv({ ...createDefaultGridWorldConfig(), portals: [{ id: 'P', ends: [{ x: 1, y: 0 }, { x: 4, y: 4 }] }], oneWays: [{ x: 2, y: 0, direction: 3 }], fragiles: [{ x: 3, y: 0 }], switches: [{ x: 4, y: 0, groupId: 'G' }], toggleWalls: [{ x: 5, y: 0, groupId: 'G' }] })
  render(<GridSvg renderModel={env.getRenderModel()} selectedState="1,0" />)
  expect(screen.getByTestId('portal-1,0')).toBeTruthy()
  expect(screen.getByTestId('one-way-2,0').textContent).toContain('→')
  expect(screen.getByTestId('fragile-3,0').getAttribute('data-collapsed')).toBe('false')
  expect(screen.getByTestId('toggle-5,0').getAttribute('data-open')).toBe('false')
  const outline = screen.getByTestId('selected-cell-outline')
  expect(outline.getAttribute('rx')).toBe('0')
  expect(outline.getAttribute('stroke-width')).toBe('2.5')
  expect(outline.getAttribute('vector-effect')).toBe('non-scaling-stroke')
})
