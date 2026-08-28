// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { translations } from '../../ui/i18n'
import { LanguageSelector } from './LanguageSelector'

afterEach(cleanup)

describe('LanguageSelector', () => {
  it('renders a native <select> with English and Korean options', () => {
    render(<LanguageSelector locale="en" onChange={vi.fn()} t={translations.en} />)
    const select = screen.getByTestId('language-selector')
    expect(select.tagName).toBe('SELECT')
    expect(screen.getByRole('option', { name: 'English' })).toBeTruthy()
    expect(screen.getByRole('option', { name: '한국어' })).toBeTruthy()
  })

  it('reflects the current locale as the selected value', () => {
    render(<LanguageSelector locale="ko" onChange={vi.fn()} t={translations.ko} />)
    expect((screen.getByTestId('language-selector') as HTMLSelectElement).value).toBe('ko')
  })

  it('calls onChange with the newly selected locale when changed', () => {
    const onChange = vi.fn()
    render(<LanguageSelector locale="en" onChange={onChange} t={translations.en} />)
    fireEvent.change(screen.getByTestId('language-selector'), { target: { value: 'ko' } })
    expect(onChange).toHaveBeenCalledWith('ko')
  })

  // Phase 13 §9: must be Tab-reachable — a real native <select> always is, unlike a
  // custom dropdown widget, so this just pins that it stays a genuine <select> with no
  // accessibility-breaking tabIndex/disabled overrides.
  it('is a real, enabled native <select> (keyboard/Tab accessible)', () => {
    render(<LanguageSelector locale="en" onChange={vi.fn()} t={translations.en} />)
    const select = screen.getByTestId('language-selector') as HTMLSelectElement
    expect(select.tagName).toBe('SELECT')
    expect(select.disabled).toBe(false)
    expect(select.tabIndex).not.toBe(-1)
  })

  it('the surrounding label text follows the current locale, while option text stays each language\'s own name', () => {
    const { rerender } = render(<LanguageSelector locale="en" onChange={vi.fn()} t={translations.en} />)
    expect(screen.getByText('Language')).toBeTruthy()

    rerender(<LanguageSelector locale="ko" onChange={vi.fn()} t={translations.ko} />)
    expect(screen.getByText('언어')).toBeTruthy()
    expect(screen.getByRole('option', { name: 'English' })).toBeTruthy()
    expect(screen.getByRole('option', { name: '한국어' })).toBeTruthy()
  })
})
