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

  // Phase 30 — range expanded from 0-1 to 0-2.0; '1.1' (previously out-of-range) is now
  // a valid gamma, so the invalid-value fixture uses '2.1' instead to stay genuinely
  // out-of-range under the new bounds.
  it.each(['-0.1', '2.1', 'abc', ''])('rejects out-of-range/invalid value %j (onChange not called)', (invalid) => {
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

  // Phase 30 §2 — gamma range expanded to 0-2.0 (epsilon/alpha ranges are unaffected).
  describe('Phase 30 — expanded gamma range (0-2.0)', () => {
    it.each(['0', '0.9', '1', '2'])('accepts gamma=%s', (value) => {
      const onChange = vi.fn()
      render(<GammaControl gamma={0.5} onChange={onChange} />)
      fireEvent.change(screen.getByTestId('gamma-number'), { target: { value } })
      expect(onChange).toHaveBeenCalledWith(Number(value))
    })

    it('rejects gamma > 2', () => {
      const onChange = vi.fn()
      render(<GammaControl gamma={0.5} onChange={onChange} />)
      fireEvent.change(screen.getByTestId('gamma-number'), { target: { value: '2.5' } })
      expect(onChange).not.toHaveBeenCalled()
    })

    it('rejects gamma < 0', () => {
      const onChange = vi.fn()
      render(<GammaControl gamma={0.5} onChange={onChange} />)
      fireEvent.change(screen.getByTestId('gamma-number'), { target: { value: '-1' } })
      expect(onChange).not.toHaveBeenCalled()
    })

    it('the range slider and number input share the same min/max bounds', () => {
      render(<GammaControl gamma={0.5} onChange={vi.fn()} />)
      const slider = screen.getByTestId('gamma-slider') as HTMLInputElement
      const number = screen.getByTestId('gamma-number') as HTMLInputElement
      expect(slider.min).toBe('0')
      expect(slider.max).toBe('2')
      expect(number.min).toBe('0')
      expect(number.max).toBe('2')
    })

    it('gamma > 1 shows a distinct description from gamma === 1 (English)', () => {
      const { rerender } = render(<GammaControl gamma={1.5} onChange={vi.fn()} />)
      const above1 = screen.getByTestId('gamma-description').textContent
      rerender(<GammaControl gamma={1} onChange={vi.fn()} />)
      const at1 = screen.getByTestId('gamma-description').textContent
      expect(above1).not.toBe(at1)
      expect(above1).toBe('Future reward matters more than immediate reward (an experimental setting)')
    })

    it('gamma > 1 shows a distinct description in Korean too', () => {
      render(<GammaControl gamma={1.5} onChange={vi.fn()} t={translations.ko} locale="ko" />)
      expect(screen.getByTestId('gamma-description').textContent).toBe(
        '미래 보상을 현재 보상보다 더 중요하게 취급 (실험적 설정)',
      )
    })
  })

  it('calls Engine setHyperparams({ gamma }) — verified via the onChange contract the caller (App.tsx) wires to it', () => {
    const setHyperparams = vi.fn()
    render(<GammaControl gamma={0.9} onChange={(gamma) => setHyperparams({ gamma })} />)
    fireEvent.change(screen.getByTestId('gamma-number'), { target: { value: '0.42' } })
    expect(setHyperparams).toHaveBeenCalledWith({ gamma: 0.42 })
  })
})
