// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { AgentSnapshot } from '../../core/types/render'
import { translations } from '../../ui/i18n'
import { QValueBars } from './QValueBars'

afterEach(cleanup)

const agentSnapshot: AgentSnapshot = {
  kind: 'Q',
  qTable: {
    '0,0': [1, -2, 3, -0.5],
  },
}

describe('QValueBars', () => {
  it('shows an empty state when no State is selected', () => {
    render(<QValueBars selectedState={null} agentSnapshot={agentSnapshot} />)
    // Phase 13: this text was accidentally hardcoded Korean despite the rest of the UI
    // defaulting to English (a pre-existing inconsistency, not an intentional English
    // default) — now it's a real, translated string ("en" by default), so the assertion
    // checks the correct English wording instead. Not a weakening: same specificity,
    // still pinned to the exact empty-state copy via a component-scoped regex.
    expect(screen.getByTestId('qvalue-bars-empty').textContent).toMatch(/Select a State/)
    expect(screen.queryByTestId('qvalue-bars')).toBeNull()
  })

  it('displays the Q-values for the selected State', () => {
    render(<QValueBars selectedState="0,0" agentSnapshot={agentSnapshot} />)
    expect(screen.getByTestId('qvalue-up').textContent).toBe('1.000')
    expect(screen.getByTestId('qvalue-down').textContent).toBe('-2.000')
    expect(screen.getByTestId('qvalue-left').textContent).toBe('3.000')
    expect(screen.getByTestId('qvalue-right').textContent).toBe('-0.500')
  })

  it('renders all four actions', () => {
    render(<QValueBars selectedState="0,0" agentSnapshot={agentSnapshot} />)
    expect(screen.getByTestId('qvalue-row-up')).toBeTruthy()
    expect(screen.getByTestId('qvalue-row-down')).toBeTruthy()
    expect(screen.getByTestId('qvalue-row-left')).toBeTruthy()
    expect(screen.getByTestId('qvalue-row-right')).toBeTruthy()
  })

  it('renders negative Q-values without throwing or producing an invalid bar width', () => {
    render(<QValueBars selectedState="0,0" agentSnapshot={agentSnapshot} />)
    const downText = screen.getByTestId('qvalue-down').textContent
    expect(downText).toBe('-2.000')
  })

  it('falls back to an all-zero vector for a selected but never-visited State', () => {
    render(<QValueBars selectedState="6,6" agentSnapshot={agentSnapshot} />)
    expect(screen.getByTestId('qvalue-up').textContent).toBe('0.000')
    expect(screen.getByTestId('qvalue-right').textContent).toBe('0.000')
  })

  it('reflects updated values when the agentSnapshot prop changes (Q-value update reflected)', () => {
    const { rerender } = render(<QValueBars selectedState="0,0" agentSnapshot={agentSnapshot} />)
    expect(screen.getByTestId('qvalue-up').textContent).toBe('1.000')

    const updatedSnapshot: AgentSnapshot = {
      kind: 'Q',
      qTable: { '0,0': [9, -2, 3, -0.5] },
    }
    rerender(<QValueBars selectedState="0,0" agentSnapshot={updatedSnapshot} />)

    expect(screen.getByTestId('qvalue-up').textContent).toBe('9.000')
  })

  // Phase 19 — Greedy Value/Action reuse the exact quantities already computed
  // elsewhere: max_a Q(s,a) (ValueHeatmap.tsx's `Math.max(...qVector)`) and
  // argmax_a Q(s,a) via policy.ts's argmaxLowestIndex() (PolicyOverlay.tsx's tie-break).
  describe('Phase 19 — Greedy Action / Greedy Value', () => {
    it('shows the Greedy Action (argmax) and Greedy Value (max Q) for the selected State', () => {
      // qTable['0,0'] = [1, -2, 3, -0.5] -> index 2 (Left) has the max value, 3.
      render(<QValueBars selectedState="0,0" agentSnapshot={agentSnapshot} />)
      expect(screen.getByTestId('greedy-action').textContent).toBe('Greedy Action: Left')
      expect(screen.getByTestId('greedy-value').textContent).toBe('Greedy Value: 3.0000')
    })

    it('the lowest-index tie-break applies when multiple actions share the max Q-value', () => {
      const tiedSnapshot: AgentSnapshot = { kind: 'Q', qTable: { '2,2': [5, 5, 1, 0] } }
      render(<QValueBars selectedState="2,2" agentSnapshot={tiedSnapshot} />)
      // Up (index 0) and Down (index 1) tie at 5 -> Up wins (lowest index).
      expect(screen.getByTestId('greedy-action').textContent).toBe('Greedy Action: Up')
      expect(screen.getByTestId('greedy-value').textContent).toBe('Greedy Value: 5.0000')
    })

    it('an unvisited State (all-zero fallback) reports Greedy Value 0', () => {
      render(<QValueBars selectedState="6,6" agentSnapshot={agentSnapshot} />)
      expect(screen.getByTestId('greedy-value').textContent).toBe('Greedy Value: 0.0000')
    })

    it('translates the Greedy Action/Value labels and the action name in Korean', () => {
      render(<QValueBars selectedState="0,0" agentSnapshot={agentSnapshot} t={translations.ko} locale="ko" />)
      expect(screen.getByTestId('greedy-action').textContent).toBe('탐욕적 행동: 왼쪽')
      expect(screen.getByTestId('greedy-value').textContent).toBe('탐욕적 가치: 3.0000')
    })
  })

  describe('Phase 36 — Greedy Action row highlight', () => {
    it('marks only the row matching greedyActionIndex with the highlight attribute and arrow', () => {
      // qTable['0,0'] = [1, -2, 3, -0.5] -> index 2 (Left) is the greedy action.
      render(<QValueBars selectedState="0,0" agentSnapshot={agentSnapshot} />)

      expect(screen.getByTestId('qvalue-row-left').getAttribute('data-greedy-action')).toBe('true')
      expect(screen.getByTestId('qvalue-row-left-greedy-arrow').textContent).toBe('←')

      for (const label of ['up', 'down', 'right']) {
        expect(screen.getByTestId(`qvalue-row-${label}`).getAttribute('data-greedy-action')).toBeNull()
        expect(screen.queryByTestId(`qvalue-row-${label}-greedy-arrow`)).toBeNull()
      }
    })

    it('moves the highlight to the new greedy row when Q-values change', () => {
      const { rerender } = render(<QValueBars selectedState="0,0" agentSnapshot={agentSnapshot} />)
      expect(screen.getByTestId('qvalue-row-left').getAttribute('data-greedy-action')).toBe('true')

      const updatedSnapshot: AgentSnapshot = { kind: 'Q', qTable: { '0,0': [9, -2, 3, -0.5] } }
      rerender(<QValueBars selectedState="0,0" agentSnapshot={updatedSnapshot} />)

      expect(screen.getByTestId('qvalue-row-up').getAttribute('data-greedy-action')).toBe('true')
      expect(screen.getByTestId('qvalue-row-left').getAttribute('data-greedy-action')).toBeNull()
    })
  })
})
