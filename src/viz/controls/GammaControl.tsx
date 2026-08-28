// Phase 22 — lets the user observe and adjust the Algorithm's γ (discount factor) at
// runtime. Same pattern as EpsilonControl.tsx (Phase 18) / AlphaControl.tsx: reads its
// current value from EngineSnapshot (passed down as the `gamma` prop) rather than
// mirroring its own copy, so it can never drift from the Engine's actual value across
// reset()/setHyperparams().

import type { ChangeEvent } from 'react'
import { translations, describeGamma, type Dictionary, type Locale } from '../../ui/i18n'

export interface GammaControlProps {
  gamma: number
  onChange: (gamma: number) => void
  t?: Dictionary
  locale?: Locale
}

const GAMMA_MIN = 0
const GAMMA_MAX = 1
const GAMMA_STEP = 0.01

export function GammaControl({ gamma, onChange, t = translations.en, locale = 'en' }: GammaControlProps) {
  function commit(raw: string) {
    const parsed = Number(raw)
    if (raw === '' || Number.isNaN(parsed) || parsed < GAMMA_MIN || parsed > GAMMA_MAX) return
    onChange(parsed)
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="gamma-control">
      <label className="flex items-center gap-2">
        <span className="text-gray-600">
          {t.gamma.label}: {gamma.toFixed(2)}
        </span>
        <input
          type="range"
          min={GAMMA_MIN}
          max={GAMMA_MAX}
          step={GAMMA_STEP}
          value={gamma}
          onChange={(e: ChangeEvent<HTMLInputElement>) => commit(e.target.value)}
          data-testid="gamma-slider"
          className="w-32"
        />
        <input
          type="number"
          min={GAMMA_MIN}
          max={GAMMA_MAX}
          step={GAMMA_STEP}
          value={gamma}
          onChange={(e: ChangeEvent<HTMLInputElement>) => commit(e.target.value)}
          data-testid="gamma-number"
          className="w-16 rounded border border-gray-300 px-1 py-0.5"
        />
      </label>
      <span className="text-xs text-gray-500" data-testid="gamma-description">
        {describeGamma(gamma, locale)}
      </span>
    </div>
  )
}
