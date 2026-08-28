// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { translations } from '../../ui/i18n'
import { GammaControl } from './GammaControl'

afterEach(cleanup)

describe('GammaControl', () => {
  it('displays the current gamma value (English default)', () => {
    render(<GammaControl gamma={0.9} onChange={vi.fn()} />)
    expect(screen.getByText('Gamma (γ): 0.90')).toBeTruthy()
    expect((screen.getByTestId('gamma-slider') as HTMLInputElement).value).toBe('0.9')
    expect((screen.getByTestId('gamma-number') as HTMLInputElement).value).toBe('0.9')
  })

  it('displays the current gamma value in Korean', () => {
    render(<GammaControl gamma={0.9} onChange={vi.fn()} t={translations.ko} locale="ko" />)
    expect(screen.getByText('감마 (γ): 0.90')).toBeTruthy()
  })

  it('gamma=0 shows the "only immediate reward" description (English)', () => {
    render(<GammaControl gamma={0} onChange={vi.fn()} />)
    expect(screen.getByTestId('gamma-description').textContent).toBe('Only the immediate reward matters')
  })

  it('gamma=1 shows the "future matters as much" description (English)', () => {
    render(<GammaControl gamma={1} onChange={vi.fn()} />)
    expect(screen.getByTestId('gamma-description').textContent).toBe('Future reward matters as much as immediate reward')
  })

  it('an intermediate gamma shows a percentage description (English)', () => {
    render(<GammaControl gamma={0.3} onChange={vi.fn()} />)
    expect(screen.getByTestId('gamma-description').textContent).toBe('About 30% weight on future reward')
  })

  it('gamma=0/1/intermediate descriptions in Korean', () => {
    const { rerender } = render(<GammaControl gamma={0} onChange={vi.fn()} t={translations.ko} locale="ko" />)
    expect(screen.getByTestId('gamma-description').textContent).toBe('현재 보상만 고려')

    rerender(<GammaControl gamma={1} onChange={vi.fn()} t={translations.ko} locale="ko" />)
    expect(screen.getByTestId('gamma-description').textContent).toBe('미래 보상을 현재 보상만큼 중요하게 취급')

    rerender(<GammaControl gamma={0.3} onChange={vi.fn()} t={translations.ko} locale="ko" />)
    expect(screen.getByTestId('gamma-description').textContent).toBe('미래 보상을 약 30% 반영')
  })

  it('changing the slider reports the new value via onChange', () => {
    const onChange = vi.fn()
    render(<GammaControl gamma={0.9} onChange={onChange} />)
    fireEvent.change(screen.getByTestId('gamma-slider'), { target: { value: '0.5' } })
    expect(onChange).toHaveBeenCalledWith(0.5)
  })

  it('changing the number input reports the new value via onChange (range <-> number stay in sync via the shared gamma prop)', () => {
    const onChange = vi.fn()
    const { rerender } = render(<GammaControl gamma={0.9} onChange={onChange} />)
    fireEvent.change(screen.getByTestId('gamma-number'), { target: { value: '0.75' } })
    expect(onChange).toHaveBeenCalledWith(0.75)

    rerender(<GammaControl gamma={0.75} onChange={onChange} />)
    expect((screen.getByTestId('gamma-slider') as HTMLInputElement).value).toBe('0.75')
    expect((screen.getByTestId('gamma-number') as HTMLInputElement).value).toBe('0.75')
  })

  it.each(['-0.1', '1.1', 'abc', ''])('rejects out-of-range/invalid value %j (onChange not called)', (invalid) => {
    const onChange = vi.fn()
    render(<GammaControl gamma={0.5} onChange={onChange} />)
    fireEvent.change(screen.getByTestId('gamma-number'), { target: { value: invalid } })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('accepts the boundary values 0 and 1', () => {
    const onChange = vi.fn()
    render(<GammaControl gamma={0.5} onChange={onChange} />)
    fireEvent.change(screen.getByTestId('gamma-number'), { target: { value: '0' } })
    fireEvent.change(screen.getByTestId('gamma-number'), { target: { value: '1' } })
    expect(onChange).toHaveBeenNthCalledWith(1, 0)
    expect(onChange).toHaveBeenNthCalledWith(2, 1)
  })

  it('calls Engine setHyperparams({ gamma }) — verified via the onChange contract the caller (App.tsx) wires to it', () => {
    const setHyperparams = vi.fn()
    render(<GammaControl gamma={0.9} onChange={(gamma) => setHyperparams({ gamma })} />)
    fireEvent.change(screen.getByTestId('gamma-number'), { target: { value: '0.42' } })
    expect(setHyperparams).toHaveBeenCalledWith({ gamma: 0.42 })
  })
})
