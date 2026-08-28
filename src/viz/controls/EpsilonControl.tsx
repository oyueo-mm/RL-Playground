// Phase 18 — lets the user observe and adjust the Algorithm's ε (exploration rate) at
// runtime. Presentational only, same pattern as SpeedControl.tsx: reports the user's
// choice via onChange; the caller (App.tsx) is the one that actually calls
// engine.setHyperparams({ epsilon }). Reads its current value from EngineSnapshot
// (passed down as the `epsilon` prop) rather than mirroring its own copy, so it can
// never drift from the Engine's actual value across reset()/setHyperparams().

import type { ChangeEvent } from 'react'
import { translations, describeEpsilon, type Dictionary, type Locale } from '../../ui/i18n'

export interface EpsilonControlProps {
  epsilon: number
  onChange: (epsilon: number) => void
  t?: Dictionary
  locale?: Locale
}

const EPSILON_MIN = 0
const EPSILON_MAX = 1
const EPSILON_STEP = 0.01

export function EpsilonControl({ epsilon, onChange, t = translations.en, locale = 'en' }: EpsilonControlProps) {
  function commit(raw: string) {
    const parsed = Number(raw)
    // Reject (ignore) out-of-range/non-numeric input rather than clamping or flagging an
    // error state — same "invalid keystroke never becomes the committed value" pattern
    // as the Episode count input (PlaybackControls.tsx, Phase 15).
    if (raw === '' || Number.isNaN(parsed) || parsed < EPSILON_MIN || parsed > EPSILON_MAX) return
    onChange(parsed)
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="epsilon-control">
      <label className="flex items-center gap-2">
        <span className="text-gray-600">
          {t.epsilon.label}: {epsilon.toFixed(2)}
        </span>
        <input
          type="range"
          min={EPSILON_MIN}
          max={EPSILON_MAX}
          step={EPSILON_STEP}
          value={epsilon}
          onChange={(e: ChangeEvent<HTMLInputElement>) => commit(e.target.value)}
          data-testid="epsilon-slider"
          className="w-32"
        />
        <input
          type="number"
          min={EPSILON_MIN}
          max={EPSILON_MAX}
          step={EPSILON_STEP}
          value={epsilon}
          onChange={(e: ChangeEvent<HTMLInputElement>) => commit(e.target.value)}
          data-testid="epsilon-number"
          className="w-16 rounded border border-gray-300 px-1 py-0.5"
        />
      </label>
      <span className="text-xs text-gray-500" data-testid="epsilon-description">
        {describeEpsilon(epsilon, locale)}
      </span>
    </div>
  )
}
