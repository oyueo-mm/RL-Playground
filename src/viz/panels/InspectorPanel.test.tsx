// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ActionSelection, TDInfo, Transition } from '../../core/types/rl'
import { InspectorPanel } from './InspectorPanel'

afterEach(cleanup)

const transition: Transition = {
  state: '0,0',
  action: 3, // right
  nextState: '1,0',
  reward: -0.1,
  done: false,
}

const actionSelection: ActionSelection = {
  action: 3,
  wasExploration: true,
  candidateValues: [0.1, 0.2, 0.3, 0.4],
}

const tdInfo: TDInfo = {
  algorithm: 'q-learning',
  target: 1.7,
  targetFormula: "target = r + γ·max Q(s',·) = -0.1 + 0.9 × 2 = 1.7",
  previousEstimate: 0,
  updatedEstimate: 0.5,
  error: 1.7,
}

describe('InspectorPanel', () => {
  it('shows the empty state when there is no last transition/action/TD info yet', () => {
    render(<InspectorPanel lastTransition={null} lastActionSelection={null} lastTdInfo={null} />)
    expect(screen.getByTestId('inspector-empty').textContent).toMatch(/Step을 실행하면/)
    expect(screen.queryByTestId('inspector-panel')).toBeNull()
  })

  it('displays the transition (state -> nextState)', () => {
    render(
      <InspectorPanel lastTransition={transition} lastActionSelection={actionSelection} lastTdInfo={tdInfo} />,
    )
    const text = screen.getByTestId('inspector-state').textContent ?? ''
    expect(text).toContain('0,0')
    expect(text).toContain('1,0')
  })

  it('displays the selected action and exploration/exploitation info', () => {
    render(
      <InspectorPanel lastTransition={transition} lastActionSelection={actionSelection} lastTdInfo={tdInfo} />,
    )
    const text = screen.getByTestId('inspector-action').textContent ?? ''
    expect(text).toContain('Right') // action index 3, per GridWorldEnv's encoding
    expect(text).toContain('exploration')
  })

  it('displays the reward', () => {
    render(
      <InspectorPanel lastTransition={transition} lastActionSelection={actionSelection} lastTdInfo={tdInfo} />,
    )
    expect(screen.getByTestId('inspector-reward').textContent).toBe('-0.100')
  })

  it('displays the TD target and the exact targetFormula string from Core', () => {
    render(
      <InspectorPanel lastTransition={transition} lastActionSelection={actionSelection} lastTdInfo={tdInfo} />,
    )
    expect(screen.getByTestId('inspector-target').textContent).toBe('1.700')
    expect(screen.getByTestId('inspector-target-formula').textContent).toBe(tdInfo.targetFormula)
  })

  it('displays the TD error', () => {
    render(
      <InspectorPanel lastTransition={transition} lastActionSelection={actionSelection} lastTdInfo={tdInfo} />,
    )
    expect(screen.getByTestId('inspector-error').textContent).toBe('1.700')
  })

  it('displays both previousEstimate and updatedEstimate, distinguished', () => {
    render(
      <InspectorPanel lastTransition={transition} lastActionSelection={actionSelection} lastTdInfo={tdInfo} />,
    )
    const text = screen.getByTestId('inspector-estimate').textContent ?? ''
    expect(text).toContain('0.000')
    expect(text).toContain('0.500')
  })
})
