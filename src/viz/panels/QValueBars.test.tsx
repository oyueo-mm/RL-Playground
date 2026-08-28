// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { AgentSnapshot } from '../../core/types/render'
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
})
