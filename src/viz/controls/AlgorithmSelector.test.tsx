// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { translations } from '../../ui/i18n'
import { AlgorithmSelector } from './AlgorithmSelector'

afterEach(cleanup)

describe('AlgorithmSelector', () => {
  it('shows the current algorithm as the selected option (English default)', () => {
    render(<AlgorithmSelector algorithmId="q-learning" onChange={vi.fn()} />)
    expect((screen.getByTestId('algorithm-select') as HTMLSelectElement).value).toBe('q-learning')
    expect(screen.getByRole('option', { name: 'Q-Learning' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'SARSA' })).toBeTruthy()
  })

  it('reflects sarsa as selected when algorithmId="sarsa"', () => {
    render(<AlgorithmSelector algorithmId="sarsa" onChange={vi.fn()} />)
    expect((screen.getByTestId('algorithm-select') as HTMLSelectElement).value).toBe('sarsa')
  })

  it('selecting SARSA reports "sarsa" via onChange', () => {
    const onChange = vi.fn()
    render(<AlgorithmSelector algorithmId="q-learning" onChange={onChange} />)
    fireEvent.change(screen.getByTestId('algorithm-select'), { target: { value: 'sarsa' } })
    expect(onChange).toHaveBeenCalledWith('sarsa')
  })

  it('selecting Q-Learning reports "q-learning" via onChange', () => {
    const onChange = vi.fn()
    render(<AlgorithmSelector algorithmId="sarsa" onChange={onChange} />)
    fireEvent.change(screen.getByTestId('algorithm-select'), { target: { value: 'q-learning' } })
    expect(onChange).toHaveBeenCalledWith('q-learning')
  })

  it('shows the correct short description per algorithm (English)', () => {
    const { rerender } = render(<AlgorithmSelector algorithmId="q-learning" onChange={vi.fn()} />)
    expect(screen.getByTestId('algorithm-description').textContent).toBe(
      'Off-policy — learns from the best possible next action',
    )
    rerender(<AlgorithmSelector algorithmId="sarsa" onChange={vi.fn()} />)
    expect(screen.getByTestId('algorithm-description').textContent).toBe(
      'On-policy — learns from the action actually taken next',
    )
  })

  it('translates the label and description to Korean, but keeps "Q-Learning"/"SARSA" untranslated', () => {
    render(<AlgorithmSelector algorithmId="sarsa" onChange={vi.fn()} t={translations.ko} />)
    expect(screen.getByText('알고리즘')).toBeTruthy()
    expect(screen.getByTestId('algorithm-description').textContent).toBe(
      '온-정책 — 실제로 선택한 다음 Action을 기준으로 학습',
    )
    expect(screen.getByRole('option', { name: 'Q-Learning' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'SARSA' })).toBeTruthy()
  })

  it('is disabled when the disabled prop is true (RUNNING/PAUSED)', () => {
    render(<AlgorithmSelector algorithmId="q-learning" onChange={vi.fn()} disabled />)
    expect((screen.getByTestId('algorithm-select') as HTMLSelectElement).disabled).toBe(true)
  })

  it('is enabled by default (IDLE)', () => {
    render(<AlgorithmSelector algorithmId="q-learning" onChange={vi.fn()} />)
    expect((screen.getByTestId('algorithm-select') as HTMLSelectElement).disabled).toBe(false)
  })
})
