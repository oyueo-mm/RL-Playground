// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AlgorithmGuide } from './AlgorithmGuide'
import { calculateUpdate } from './calculateUpdate'
import { qLearning } from '../../core/algorithms/qLearning'
import { sarsa } from '../../core/algorithms/sarsa'
import { TabularQAgent } from '../../core/agents/TabularQAgent'
afterEach(cleanup)

describe('Algorithm curriculum', () => {
  it.each(['ko', 'en'] as const)('has six navigable %s lessons, formulas, calculator and lab action', locale => {
    const start = vi.fn(); render(<AlgorithmGuide locale={locale} onStart={start} />)
    const chapters = screen.getByRole('navigation').querySelectorAll('button')
    expect(chapters).toHaveLength(6)
    chapters.forEach((button, index) => { fireEvent.click(button); expect(document.getElementById(`chapter-${index}`)?.hidden).toBe(false) })
    fireEvent.click(chapters[4])
    expect(screen.getByTestId('qlearning-result').textContent).toBe('2.30')
    expect(screen.getByTestId('sarsa-result').textContent).toBe('0.95')
    fireEvent.change(screen.getByLabelText('Q(s,a)'), { target: { value: '4' } })
    expect(screen.getByTestId('qlearning-result').textContent).toBe('3.30')
    fireEvent.click(screen.getByRole('checkbox'))
    expect(screen.getByTestId('qlearning-result').textContent).toBe('1.50')
    expect(screen.getByTestId('sarsa-result').textContent).toBe('1.50')
    fireEvent.click(screen.getAllByRole('button', { name: /실험실에서|Try it/ })[0]); expect(start).toHaveBeenCalledOnce()
  })
  it.each([false, true])('matches production updates (terminal=%s)', done => {
    const agent = new TabularQAgent(4)
    for (const [state, action, value] of [['s', 0, 2], ['next', 0, 4], ['next', 1, 1]] as const) agent.applyUpdate(state, action, { algorithm: 'seed', target: value, targetFormula: '', previousEstimate: 0, updatedEstimate: value, error: value })
    const transition = { state: 's', action: 0, reward: -1, nextState: 'next', done }
    const hp = { alpha: .5, gamma: .9, epsilon: .1 }
    expect(calculateUpdate(2, -1, .5, .9, 4, done).updated).toBeCloseTo(qLearning.computeUpdate(transition, agent, hp).updatedEstimate)
    expect(calculateUpdate(2, -1, .5, .9, 1, done).updated).toBeCloseTo(sarsa.computeUpdate(transition, agent, hp, { action: 1, wasExploration: true, candidateValues: [4, 1, 0, 0] }).updatedEstimate)
  })
})
