// Phase 13 — native <select> language switcher. Presentational only: takes the current
// locale and reports the user's choice via onChange, same pattern as SpeedControl.tsx.
// Option labels are always shown in their own language ("English" / "한국어") regardless
// of the currently active locale — a standard language-switcher convention — while the
// surrounding label text (`t.language.selectorLabel`) follows the active locale.

import type { Dictionary, Locale } from '../../ui/i18n'

export interface LanguageSelectorProps {
  locale: Locale
  onChange: (locale: Locale) => void
  t: Dictionary
}

export function LanguageSelector({ locale, onChange, t }: LanguageSelectorProps) {
  return (
    <label className="flex items-center gap-1 text-sm text-gray-600">
      {t.language.selectorLabel}
      <select
        value={locale}
        onChange={(e) => onChange(e.target.value as Locale)}
        data-testid="language-selector"
        className="rounded border border-gray-300 px-1 py-0.5"
      >
        <option value="en">English</option>
        <option value="ko">한국어</option>
      </select>
    </label>
  )
}
