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
  bombs: [],
  bombPenalty: -10,
  start: '0,0',
  goals: ['2,2'],
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

  describe('Phase 36 — multiple masks at the same position', () => {
    it('renders exactly one arrow at a position with two distinct-mask Q-table entries, matching the current mask', () => {
      const agentSnapshot: AgentSnapshot = {
        kind: 'Q',
        qTable: {
          '0,0,0': [1, 0, 0, 0], // Up — mask 0 (no goals collected)
          '0,0,1': [0, 0, 0, 1], // Right — mask 1 (one goal collected)
        },
      }
      render(<PolicyOverlay renderModel={renderModel} agentSnapshot={agentSnapshot} currentState="0,0,1" />)

      expect(screen.getAllByTestId(/^policy-arrow-/)).toHaveLength(1)
      expect(screen.getByTestId('policy-arrow-0,0,1').textContent).toBe('→')
      expect(screen.queryByTestId('policy-arrow-0,0,0')).toBeNull()
    })

    it('switches which entry is shown as the live mask changes, never showing both at once', () => {
      const agentSnapshot: AgentSnapshot = {
        kind: 'Q',
        qTable: {
          '0,0,0': [1, 0, 0, 0], // Up
          '0,0,1': [0, 0, 0, 1], // Right
        },
      }
      const { rerender } = render(
        <PolicyOverlay renderModel={renderModel} agentSnapshot={agentSnapshot} currentState="0,0,0" />,
      )
      expect(screen.getAllByTestId(/^policy-arrow-/)).toHaveLength(1)
      expect(screen.getByTestId('policy-arrow-0,0,0').textContent).toBe('↑')

      rerender(<PolicyOverlay renderModel={renderModel} agentSnapshot={agentSnapshot} currentState="0,0,1" />)
      expect(screen.getAllByTestId(/^policy-arrow-/)).toHaveLength(1)
      expect(screen.getByTestId('policy-arrow-0,0,1').textContent).toBe('→')
    })

    it('omitting currentState falls back to matching only plain "x,y" (no-mask) entries', () => {
      const agentSnapshot: AgentSnapshot = {
        kind: 'Q',
        qTable: {
          '0,0': [1, 0, 0, 0], // legacy plain-position key, no mask
          '0,0,1': [0, 0, 0, 1], // mask-suffixed key
        },
      }
      render(<PolicyOverlay renderModel={renderModel} agentSnapshot={agentSnapshot} />)

      expect(screen.getAllByTestId(/^policy-arrow-/)).toHaveLength(1)
      expect(screen.getByTestId('policy-arrow-0,0').textContent).toBe('↑')
    })
  })
})
