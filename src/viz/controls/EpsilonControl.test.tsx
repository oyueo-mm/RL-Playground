// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { translations } from '../../ui/i18n'
import { EpsilonControl } from './EpsilonControl'

afterEach(cleanup)

describe('EpsilonControl', () => {
  it('displays the current epsilon value (English default)', () => {
    render(<EpsilonControl epsilon={0.1} onChange={vi.fn()} />)
    expect(screen.getByText('Epsilon (ε): 0.10')).toBeTruthy()
    expect((screen.getByTestId('epsilon-slider') as HTMLInputElement).value).toBe('0.1')
    expect((screen.getByTestId('epsilon-number') as HTMLInputElement).value).toBe('0.1')
  })

  it('displays the current epsilon value in Korean', () => {
    render(<EpsilonControl epsilon={0.1} onChange={vi.fn()} t={translations.ko} locale="ko" />)
    expect(screen.getByText('엡실론 (ε): 0.10')).toBeTruthy()
  })

  it('epsilon=0 shows the "fully greedy" description (English)', () => {
    render(<EpsilonControl epsilon={0} onChange={vi.fn()} />)
    expect(screen.getByTestId('epsilon-description').textContent).toBe('No exploration — fully greedy')
  })

  it('epsilon=1 shows the "always exploring" description (English)', () => {
    render(<EpsilonControl epsilon={1} onChange={vi.fn()} />)
    expect(screen.getByTestId('epsilon-description').textContent).toBe('Always exploring')
  })

  it('an intermediate epsilon shows a percentage description (English)', () => {
    render(<EpsilonControl epsilon={0.3} onChange={vi.fn()} />)
    expect(screen.getByTestId('epsilon-description').textContent).toBe('About 30% exploration')
  })

  it('epsilon=0/1/intermediate descriptions in Korean', () => {
    const { rerender } = render(<EpsilonControl epsilon={0} onChange={vi.fn()} t={translations.ko} locale="ko" />)
    expect(screen.getByTestId('epsilon-description').textContent).toBe('탐험 없음 — 완전히 Greedy')

    rerender(<EpsilonControl epsilon={1} onChange={vi.fn()} t={translations.ko} locale="ko" />)
    expect(screen.getByTestId('epsilon-description').textContent).toBe('항상 Exploration')

    rerender(<EpsilonControl epsilon={0.3} onChange={vi.fn()} t={translations.ko} locale="ko" />)
    expect(screen.getByTestId('epsilon-description').textContent).toBe('약 30% 확률로 Exploration')
  })

  it('changing the slider reports the new value via onChange', () => {
    const onChange = vi.fn()
    render(<EpsilonControl epsilon={0.1} onChange={onChange} />)
    fireEvent.change(screen.getByTestId('epsilon-slider'), { target: { value: '0.5' } })
    expect(onChange).toHaveBeenCalledWith(0.5)
  })

  it('changing the number input reports the new value via onChange', () => {
    const onChange = vi.fn()
    render(<EpsilonControl epsilon={0.1} onChange={onChange} />)
    fireEvent.change(screen.getByTestId('epsilon-number'), { target: { value: '0.75' } })
    expect(onChange).toHaveBeenCalledWith(0.75)
  })

  it.each(['-0.1', '1.1', 'abc', ''])('rejects out-of-range/invalid value %j (onChange not called)', (invalid) => {
    const onChange = vi.fn()
    render(<EpsilonControl epsilon={0.5} onChange={onChange} />)
    fireEvent.change(screen.getByTestId('epsilon-number'), { target: { value: invalid } })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('accepts the boundary values 0 and 1', () => {
    const onChange = vi.fn()
    render(<EpsilonControl epsilon={0.5} onChange={onChange} />)
    fireEvent.change(screen.getByTestId('epsilon-number'), { target: { value: '0' } })
    fireEvent.change(screen.getByTestId('epsilon-number'), { target: { value: '1' } })
    expect(onChange).toHaveBeenNthCalledWith(1, 0)
    expect(onChange).toHaveBeenNthCalledWith(2, 1)
  })
})
