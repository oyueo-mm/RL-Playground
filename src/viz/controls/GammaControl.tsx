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
// Phase 30 — expanded from 1 to 2.0, an intentionally non-standard range for this
// experimentation Playground (epsilon/alpha ranges are unaffected, unchanged elsewhere).
const GAMMA_MAX = 2
const GAMMA_STEP = 0.01

export function GammaControl({ gamma, onChange, t = translations.en, locale = 'en' }: GammaControlProps) {
  function commit(raw: string) {
    const parsed = Number(raw)
    if (raw === '' || Number.isNaN(parsed) || parsed < GAMMA_MIN || parsed > GAMMA_MAX) return
    onChange(parsed)
  }

  return (
    // Phase 36: `flex-col` (was `flex flex-wrap` with the slider row and description as
    // sibling flex items on one line) — description length now can never affect the
    // slider row's own layout, since it always renders on its own line below rather
    // than sharing a wrap-able row with the slider/number input. The `gamma > 1`
    // description (Phase 30) is materially longer than the other branches and used to
    // push the slider row itself onto a second line at moderate widths, shifting every
    // control below it whenever gamma crossed 1.0 mid-interaction.
    //
    // Phase 39: `w-full` — this div is a direct child of App.tsx's `items-center`
    // left column (Phase 37 audit: no explicit width elsewhere in that chain either),
    // so without an explicit width it shrink-to-fits its own widest content and gets
    // re-centered by items-center whenever that content's width changes. `flex-col`
    // above only stopped the slider row from wrapping onto its own second line; it never
    // stopped THIS div's own box from growing/shrinking with the description's length,
    // so the whole control (slider + number input) was still visibly jumping ~50px left/
    // right whenever gamma crossed 1.0 (see the Phase 38 Audit's real-browser
    // measurement). `w-full` pins this div's width to its parent's (stable, Grid-size-
    // driven, gamma-independent) available width instead — the same pattern grid-stack
    // and the two-column row already use for the identical class of bug (Phase 14/37).
    <div className="w-full flex flex-col gap-1 text-sm" data-testid="gamma-control">
      <label className="flex flex-wrap items-center gap-2">
        {/* Phase 36: `tabular-nums` — digits at proportional width (e.g. "1" narrower
            than "0"/"9") made this label's own rendered width vary by value, shifting the
            slider next to it by a sub-pixel amount on every gamma change even after the
            flex-col fix above. Fixed-width digits make the label's width value-independent. */}
        <span className="text-gray-600 tabular-nums">
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
