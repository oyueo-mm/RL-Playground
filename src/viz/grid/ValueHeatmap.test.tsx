// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { AgentSnapshot, EnvRenderModel } from '../../core/types/render'
import { ValueHeatmap } from './ValueHeatmap'

afterEach(cleanup)

const renderModel: Extract<EnvRenderModel, { kind: 'grid' }> = {
  kind: 'grid',
  width: 3,
  height: 3,
  walls: [],
  bombs: [],
  bombPenalty: -10,
  start: '0,0',
  goal: '2,2',
  agentPos: '0,0',
}

describe('ValueHeatmap', () => {
  it('computes V(s) = max_a Q(s,a) for a visited State', () => {
    const agentSnapshot: AgentSnapshot = { kind: 'Q', qTable: { '0,0': [1, 5, -2, 3] } }
    render(<ValueHeatmap renderModel={renderModel} agentSnapshot={agentSnapshot} />)

    expect(screen.getByTestId('value-cell-0,0').getAttribute('data-value')).toBe('5')
  })

  it('handles a State whose max value is negative', () => {
    const agentSnapshot: AgentSnapshot = { kind: 'Q', qTable: { '0,0': [-1, -5, -2, -3] } }
    render(<ValueHeatmap renderModel={renderModel} agentSnapshot={agentSnapshot} />)

    expect(screen.getByTestId('value-cell-0,0').getAttribute('data-value')).toBe('-1')
  })

  it('renders a distinct fill for positive vs. negative values (relative difference is visible)', () => {
    const agentSnapshot: AgentSnapshot = {
      kind: 'Q',
      // '1,1' values are ALL negative so max_a Q(s,a) itself is negative (not just one
      // negative entry among a positive max).
      qTable: { '0,0': [10, 0, 0, 0], '1,1': [-10, -9, -8, -7] },
    }
    render(<ValueHeatmap renderModel={renderModel} agentSnapshot={agentSnapshot} />)

    const positiveFill = screen.getByTestId('value-cell-0,0').getAttribute('fill')
    const negativeFill = screen.getByTestId('value-cell-1,1').getAttribute('fill')
    expect(positiveFill).toContain('34, 197, 94') // green
    expect(negativeFill).toContain('239, 68, 68') // red
    expect(positiveFill).not.toBe(negativeFill)
  })

  it('shows a stronger color for a larger |value| relative to other visited States', () => {
    const agentSnapshot: AgentSnapshot = {
      kind: 'Q',
      qTable: { '0,0': [10, 0, 0, 0], '1,1': [1, 0, 0, 0] },
    }
    render(<ValueHeatmap renderModel={renderModel} agentSnapshot={agentSnapshot} />)

    const strong = screen.getByTestId('value-cell-0,0').getAttribute('fill') ?? ''
    const weak = screen.getByTestId('value-cell-1,1').getAttribute('fill') ?? ''
    const opacityOf = (rgba: string) => Number(rgba.match(/[\d.]+(?=\))/)?.[0] ?? '0')
    expect(opacityOf(strong)).toBeGreaterThan(opacityOf(weak))
  })

  it('draws nothing for a never-visited State (absent from the Q-table)', () => {
    const agentSnapshot: AgentSnapshot = { kind: 'Q', qTable: { '0,0': [1, 0, 0, 0] } }
    render(<ValueHeatmap renderModel={renderModel} agentSnapshot={agentSnapshot} />)

    expect(screen.queryByTestId('value-cell-2,2')).toBeNull()
    expect(screen.getAllByTestId(/^value-cell-/)).toHaveLength(1)
  })

  it('updates when the Q-values change', () => {
    const before: AgentSnapshot = { kind: 'Q', qTable: { '0,0': [1, 0, 0, 0] } }
    const { rerender } = render(<ValueHeatmap renderModel={renderModel} agentSnapshot={before} />)
    expect(screen.getByTestId('value-cell-0,0').getAttribute('data-value')).toBe('1')

    const after: AgentSnapshot = { kind: 'Q', qTable: { '0,0': [7, 0, 0, 0] } }
    rerender(<ValueHeatmap renderModel={renderModel} agentSnapshot={after} />)
    expect(screen.getByTestId('value-cell-0,0').getAttribute('data-value')).toBe('7')
  })
})
