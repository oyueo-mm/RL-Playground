// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { translations } from '../../ui/i18n'
import { AlphaControl } from './AlphaControl'

afterEach(cleanup)

describe('AlphaControl', () => {
  it('displays the current alpha value (English default)', () => {
    render(<AlphaControl alpha={0.1} onChange={vi.fn()} />)
    expect(screen.getByText('Alpha (α): 0.10')).toBeTruthy()
    expect((screen.getByTestId('alpha-slider') as HTMLInputElement).value).toBe('0.1')
    expect((screen.getByTestId('alpha-number') as HTMLInputElement).value).toBe('0.1')
  })

  it('displays the current alpha value in Korean', () => {
    render(<AlphaControl alpha={0.1} onChange={vi.fn()} t={translations.ko} locale="ko" />)
    expect(screen.getByText('알파 (α): 0.10')).toBeTruthy()
  })

  it('alpha=0 shows the "not learned at all" description (English)', () => {
    render(<AlphaControl alpha={0} onChange={vi.fn()} />)
    expect(screen.getByTestId('alpha-description').textContent).toBe('New experience is not learned at all')
  })

  it('alpha=1 shows the "fully overwrites" description (English)', () => {
    render(<AlphaControl alpha={1} onChange={vi.fn()} />)
    expect(screen.getByTestId('alpha-description').textContent).toBe('New experience fully overwrites the old estimate')
  })

  it('an intermediate alpha shows a percentage description (English)', () => {
    render(<AlphaControl alpha={0.3} onChange={vi.fn()} />)
    expect(screen.getByTestId('alpha-description').textContent).toBe('New experience blended in at about 30%')
  })

  it('alpha=0/1/intermediate descriptions in Korean', () => {
    const { rerender } = render(<AlphaControl alpha={0} onChange={vi.fn()} t={translations.ko} locale="ko" />)
    expect(screen.getByTestId('alpha-description').textContent).toBe('새로운 경험을 학습에 반영하지 않음')

    rerender(<AlphaControl alpha={1} onChange={vi.fn()} t={translations.ko} locale="ko" />)
    expect(screen.getByTestId('alpha-description').textContent).toBe('새로운 경험이 이전 추정값을 완전히 대체함')

    rerender(<AlphaControl alpha={0.3} onChange={vi.fn()} t={translations.ko} locale="ko" />)
    expect(screen.getByTestId('alpha-description').textContent).toBe('새로운 경험을 약 30% 반영')
  })

  it('changing the slider reports the new value via onChange', () => {
    const onChange = vi.fn()
    render(<AlphaControl alpha={0.1} onChange={onChange} />)
    fireEvent.change(screen.getByTestId('alpha-slider'), { target: { value: '0.5' } })
    expect(onChange).toHaveBeenCalledWith(0.5)
  })

  it('changing the number input reports the new value via onChange (range <-> number stay in sync via the shared alpha prop)', () => {
    const onChange = vi.fn()
    const { rerender } = render(<AlphaControl alpha={0.1} onChange={onChange} />)
    fireEvent.change(screen.getByTestId('alpha-number'), { target: { value: '0.75' } })
    expect(onChange).toHaveBeenCalledWith(0.75)

    // Simulate the caller committing the new value back down as a prop (as App.tsx does
    // via the Engine snapshot) — both inputs should reflect it.
    rerender(<AlphaControl alpha={0.75} onChange={onChange} />)
    expect((screen.getByTestId('alpha-slider') as HTMLInputElement).value).toBe('0.75')
    expect((screen.getByTestId('alpha-number') as HTMLInputElement).value).toBe('0.75')
  })

  it.each(['-0.1', '1.1', 'abc', ''])('rejects out-of-range/invalid value %j (onChange not called)', (invalid) => {
    const onChange = vi.fn()
    render(<AlphaControl alpha={0.5} onChange={onChange} />)
    fireEvent.change(screen.getByTestId('alpha-number'), { target: { value: invalid } })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('accepts the boundary values 0 and 1', () => {
    const onChange = vi.fn()
    render(<AlphaControl alpha={0.5} onChange={onChange} />)
    fireEvent.change(screen.getByTestId('alpha-number'), { target: { value: '0' } })
    fireEvent.change(screen.getByTestId('alpha-number'), { target: { value: '1' } })
    expect(onChange).toHaveBeenNthCalledWith(1, 0)
    expect(onChange).toHaveBeenNthCalledWith(2, 1)
  })

  it('calls Engine setHyperparams({ alpha }) — verified via the onChange contract the caller (App.tsx) wires to it', () => {
    const setHyperparams = vi.fn()
    render(<AlphaControl alpha={0.1} onChange={(alpha) => setHyperparams({ alpha })} />)
    fireEvent.change(screen.getByTestId('alpha-number'), { target: { value: '0.42' } })
    expect(setHyperparams).toHaveBeenCalledWith({ alpha: 0.42 })
  })
})
