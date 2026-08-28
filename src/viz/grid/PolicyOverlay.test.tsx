// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { AgentSnapshot, EnvRenderModel } from '../../core/types/render'
import { PolicyOverlay } from './PolicyOverlay'

afterEach(cleanup)

const renderModel: Extract<EnvRenderModel, { kind: 'grid' }> = {
  kind: 'grid',
  width: 3,
  height: 3,
  walls: [],
  start: '0,0',
  goal: '2,2',
  agentPos: '0,0',
}

describe('PolicyOverlay', () => {
  it('computes and shows the greedy (argmax) action for a visited State', () => {
    // [Up, Down, Left, Right] -> Down (index 1) is the max.
    const agentSnapshot: AgentSnapshot = { kind: 'Q', qTable: { '0,0': [0.1, 0.9, 0.2, 0.3] } }
    render(<PolicyOverlay renderModel={renderModel} agentSnapshot={agentSnapshot} />)

    expect(screen.getByTestId('policy-arrow-0,0').getAttribute('data-action')).toBe('1')
    expect(screen.getByTestId('policy-arrow-0,0').textContent).toBe('↓')
  })

  it('shows the correct arrow for each of the four directions', () => {
    const agentSnapshot: AgentSnapshot = {
      kind: 'Q',
      qTable: {
        '0,0': [1, 0, 0, 0], // Up
        '1,0': [0, 1, 0, 0], // Down
        '2,0': [0, 0, 1, 0], // Left
        '0,1': [0, 0, 0, 1], // Right
      },
    }
    render(<PolicyOverlay renderModel={renderModel} agentSnapshot={agentSnapshot} />)

    expect(screen.getByTestId('policy-arrow-0,0').textContent).toBe('↑')
    expect(screen.getByTestId('policy-arrow-1,0').textContent).toBe('↓')
    expect(screen.getByTestId('policy-arrow-2,0').textContent).toBe('←')
    expect(screen.getByTestId('policy-arrow-0,1').textContent).toBe('→')
  })

  it('breaks ties by the lowest action index, matching Core epsilon-greedy', () => {
    // All four tied at 0.5 -> index 0 (Up) wins.
    const agentSnapshot: AgentSnapshot = { kind: 'Q', qTable: { '1,1': [0.5, 0.5, 0.5, 0.5] } }
    render(<PolicyOverlay renderModel={renderModel} agentSnapshot={agentSnapshot} />)

    expect(screen.getByTestId('policy-arrow-1,1').getAttribute('data-action')).toBe('0')
  })

  it('draws nothing for a State absent from the Q-table (never visited)', () => {
    const agentSnapshot: AgentSnapshot = { kind: 'Q', qTable: { '0,0': [1, 0, 0, 0] } }
    render(<PolicyOverlay renderModel={renderModel} agentSnapshot={agentSnapshot} />)

    expect(screen.queryByTestId('policy-arrow-2,2')).toBeNull()
    // Only the one visited state should have an arrow.
    expect(screen.getAllByTestId(/^policy-arrow-/)).toHaveLength(1)
  })

  it('draws nothing at all for a ValueAgent snapshot (kind "V" has no per-action policy)', () => {
    const agentSnapshot: AgentSnapshot = { kind: 'V', vTable: { '0,0': 1 } }
    render(<PolicyOverlay renderModel={renderModel} agentSnapshot={agentSnapshot} />)

    expect(screen.queryAllByTestId(/^policy-arrow-/)).toHaveLength(0)
  })

  it('changes the displayed policy when the Q-values change', () => {
    const before: AgentSnapshot = { kind: 'Q', qTable: { '0,0': [1, 0, 0, 0] } } // Up
    const { rerender } = render(<PolicyOverlay renderModel={renderModel} agentSnapshot={before} />)
    expect(screen.getByTestId('policy-arrow-0,0').textContent).toBe('↑')

    const after: AgentSnapshot = { kind: 'Q', qTable: { '0,0': [0, 0, 0, 1] } } // Right
    rerender(<PolicyOverlay renderModel={renderModel} agentSnapshot={after} />)
    expect(screen.getByTestId('policy-arrow-0,0').textContent).toBe('→')
  })
})
