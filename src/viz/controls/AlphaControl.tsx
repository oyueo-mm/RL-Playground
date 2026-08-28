// Phase 22 — lets the user observe and adjust the Algorithm's α (learning rate) at
// runtime. Same pattern as EpsilonControl.tsx (Phase 18): presentational only, reports
// the user's choice via onChange; the caller (App.tsx) is the one that actually calls
// engine.setHyperparams({ alpha }). Reads its current value from EngineSnapshot (passed
// down as the `alpha` prop) rather than mirroring its own copy, so it can never drift
// from the Engine's actual value across reset()/setHyperparams().

import type { ChangeEvent } from 'react'
import { translations, describeAlpha, type Dictionary, type Locale } from '../../ui/i18n'

export interface AlphaControlProps {
  alpha: number
  onChange: (alpha: number) => void
  t?: Dictionary
  locale?: Locale
}

const ALPHA_MIN = 0
const ALPHA_MAX = 1
const ALPHA_STEP = 0.01

export function AlphaControl({ alpha, onChange, t = translations.en, locale = 'en' }: AlphaControlProps) {
  function commit(raw: string) {
    const parsed = Number(raw)
    // Reject (ignore) out-of-range/non-numeric input rather than clamping or flagging an
    // error state — same pattern as EpsilonControl.tsx / the Episode count input.
    if (raw === '' || Number.isNaN(parsed) || parsed < ALPHA_MIN || parsed > ALPHA_MAX) return
    onChange(parsed)
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="alpha-control">
      <label className="flex items-center gap-2">
        <span className="text-gray-600">
          {t.alpha.label}: {alpha.toFixed(2)}
        </span>
        <input
          type="range"
          min={ALPHA_MIN}
          max={ALPHA_MAX}
          step={ALPHA_STEP}
          value={alpha}
          onChange={(e: ChangeEvent<HTMLInputElement>) => commit(e.target.value)}
          data-testid="alpha-slider"
          className="w-32"
        />
        <input
          type="number"
          min={ALPHA_MIN}
          max={ALPHA_MAX}
          step={ALPHA_STEP}
          value={alpha}
          onChange={(e: ChangeEvent<HTMLInputElement>) => commit(e.target.value)}
          data-testid="alpha-number"
          className="w-16 rounded border border-gray-300 px-1 py-0.5"
        />
      </label>
      <span className="text-xs text-gray-500" data-testid="alpha-description">
        {describeAlpha(alpha, locale)}
      </span>
    </div>
  )
}
