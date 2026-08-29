// Phase 4 — Q-value bar chart for a selected State. Reads only from
// EngineSnapshot.agentSnapshot (the public AgentSnapshot union from
// src/core/types/render.ts, produced by TabularQAgent.toSnapshot()) — never touches
// TabularQAgent's private Map or calls a live Agent method.

import type { StateKey } from '../../core/types/rl'
import type { AgentSnapshot } from '../../core/types/render'
import { GRIDWORLD_ACTION_ARROWS, GRIDWORLD_ACTION_LABELS } from '../grid/actionLabels'
import { argmaxLowestIndex } from '../grid/policy'
import { useHighlightOnChange } from '../hooks/useHighlightOnChange'
import { translations, translateActionLabel, type Dictionary, type Locale } from '../../ui/i18n'

export interface QValueBarsProps {
  selectedState: StateKey | null
  agentSnapshot: AgentSnapshot
  /**
   * Phase 34 — the Engine's current RL State (`EngineSnapshot.currentState`), e.g.
   * GridWorld's `"x,y,mask"`. `selectedState` (above) is a plain grid-cell position
   * reported by GridSvg's click callback (rendering-only, deliberately never carries a
   * mask — see GridWorldEnv.ts's file header), so it can no longer be used by itself as a
   * Q-table key now that real keys carry a mask suffix. This supplies the mask to
   * reattach, always read live off the Engine (never mirrored into local state), so the
   * displayed Q-values track the current Episode's Goal-collection progress as it
   * changes. Optional/defaults to `selectedState` for pre-Phase-34 callers/tests that
   * don't pass it — falling back to "no mask suffix" (the environment's own default when
   * a StateKey doesn't have a 3rd segment; see `resolveQVector` below).
   */
  currentState?: StateKey | null
  /** Phase 13 — defaults to English so every pre-existing caller/test is unaffected. */
  t?: Dictionary
  locale?: Locale
}

// AgentSnapshot.qTable (Record<StateKey, number[]>) only contains states the agent has
// actually visited (TabularQAgent lazily initializes on first access — see
// src/core/agents/TabularQAgent.ts). A selected-but-unvisited state is therefore absent
// from the snapshot even though its real Q-vector is conceptually all zeros (the same
// default TabularQAgent itself would lazily create). Rendering an explicit zero-vector
// here mirrors that documented default without calling any Agent method.
//
// EngineSnapshot has no `getActionSpace()`-equivalent field, so the action count used
// for that fallback vector is GRIDWORLD_ACTION_LABELS.length (4) — correct for the only
// environment that exists in Phase 4, but see the Phase 4 report's "발견된 문제".
//
// Phase 34: `selectedState` is a plain "x,y" grid position (from GridSvg); the Q-table's
// real keys are now "x,y,mask" (see GridWorldEnv.ts). `currentState` supplies the live
// mask suffix to look up "what the Q-values would be for this position under the current
// Episode's Goal-collection progress" — re-derived on every call (never cached), so this
// naturally stays correct as Goals get collected mid-Episode.
function resolveQVector(agentSnapshot: AgentSnapshot, selectedState: StateKey, currentState: StateKey): number[] {
  if (agentSnapshot.kind !== 'Q') {
    return new Array(GRIDWORLD_ACTION_LABELS.length).fill(0)
  }
  const mask = currentState.split(',')[2]
  const key = mask === undefined ? selectedState : `${selectedState},${mask}`
  return agentSnapshot.qTable[key] ?? new Array(GRIDWORLD_ACTION_LABELS.length).fill(0)
}

export function QValueBars({
  selectedState,
  currentState,
  agentSnapshot,
  t = translations.en,
  locale = 'en',
}: QValueBarsProps) {
  if (!selectedState) {
    return (
      <div
        className="w-full max-w-lg rounded border border-gray-200 p-4 text-sm text-gray-500"
        data-testid="qvalue-bars-empty"
      >
        {t.qvalues.empty}
      </div>
    )
  }

  const values = resolveQVector(agentSnapshot, selectedState, currentState ?? selectedState)
  const maxAbs = Math.max(1e-6, ...values.map((v) => Math.abs(v)))

  // Phase 19: "Greedy Value" is V(s) = max_a Q(s,a) — the exact same quantity
  // ValueHeatmap.tsx already renders as color (`Math.max(...qVector)`), and
  // "Greedy Action" is argmax_a Q(s,a) via the same argmaxLowestIndex() tie-break
  // PolicyOverlay.tsx already uses to draw its arrows. Both reused here, not
  // recomputed differently — indexing the SAME position into `values` for both keeps
  // them consistent with each other by construction (never a mismatched pair).
  const greedyActionIndex = argmaxLowestIndex(values)
  const greedyValue = values[greedyActionIndex]
  const greedyActionCanonicalLabel = GRIDWORLD_ACTION_LABELS[greedyActionIndex] ?? `Action ${greedyActionIndex}`

  return (
    <div className="w-full max-w-lg space-y-2 rounded border border-gray-200 p-4 text-sm" data-testid="qvalue-bars">
      <h2 className="font-semibold text-gray-700">
        {t.qvalues.heading} — {selectedState}
      </h2>
      <p className="text-gray-600" data-testid="greedy-action">
        {t.qvalues.greedyAction}:{' '}
        <span className="font-medium">{translateActionLabel(greedyActionCanonicalLabel, locale)}</span>
      </p>
      <p className="text-gray-600" data-testid="greedy-value">
        {t.qvalues.greedyValue}: <span className="font-medium tabular-nums">{greedyValue.toFixed(4)}</span>
      </p>
      {values.map((value, action) => {
        // Canonical (untranslated) label — GRIDWORLD_ACTION_LABELS ('Up'/'Down'/...) —
        // drives the data-testid, exactly as before. Only the visible text is localized.
        const canonicalLabel = GRIDWORLD_ACTION_LABELS[action] ?? `Action ${action}`
        return (
          <QValueBarRow
            key={action}
            testIdLabel={canonicalLabel}
            displayLabel={translateActionLabel(canonicalLabel, locale)}
            arrow={GRIDWORLD_ACTION_ARROWS[canonicalLabel]}
            value={value}
            maxAbs={maxAbs}
            // Phase 36 — marks the row matching the same argmax index already shown in
            // the "Greedy Action"/"Greedy Value" text above, so it's visually obvious
            // which bar the Agent would actually act on from this State.
            isGreedyAction={action === greedyActionIndex}
          />
        )
      })}
    </div>
  )
}

interface QValueBarRowProps {
  testIdLabel: string
  displayLabel: string
  arrow: string | undefined
  value: number
  maxAbs: number
  isGreedyAction: boolean
}

function QValueBarRow({ testIdLabel, displayLabel, arrow, value, maxAbs, isGreedyAction }: QValueBarRowProps) {
  const highlight = useHighlightOnChange(value)
  // Bar width is relative to the largest |value| among the currently displayed
  // actions, and capped at 50% of the track (each side of the zero-line) — so bars
  // never overflow regardless of how large or negative a Q-value gets.
  const widthPercent = Math.min(50, (Math.abs(value) / maxAbs) * 50)
  const isPositive = value >= 0

  return (
    <div
      className={`flex items-center gap-2 rounded px-1 ${isGreedyAction ? 'bg-blue-50' : ''}`}
      data-testid={`qvalue-row-${testIdLabel.toLowerCase()}`}
      data-greedy-action={isGreedyAction ? 'true' : undefined}
    >
      <span className="w-14 shrink-0 text-gray-600">
        {/* Phase 36 — the arrow only appears on the Greedy Action's own row, so it
            doubles as the "this is the selected action" marker requirement asks for,
            without adding a whole new column to every row. */}
        {isGreedyAction && arrow ? (
          <span aria-hidden className="mr-1 font-semibold text-blue-700" data-testid={`qvalue-row-${testIdLabel.toLowerCase()}-greedy-arrow`}>
            {arrow}
          </span>
        ) : null}
        {displayLabel}
      </span>
      <div className="relative h-4 flex-1 overflow-hidden rounded bg-gray-100">
        <div className="absolute top-0 left-1/2 h-full w-px bg-gray-300" />
        <div
          className={`absolute top-0 h-full transition-all duration-300 ${
            isPositive ? 'left-1/2' : 'right-1/2'
          } ${highlight ? 'bg-amber-400' : isGreedyAction ? 'bg-blue-700' : 'bg-blue-500'}`}
          style={{ width: `${widthPercent}%` }}
        />
      </div>
      <span className="w-16 shrink-0 text-right tabular-nums" data-testid={`qvalue-${testIdLabel.toLowerCase()}`}>
        {value.toFixed(3)}
      </span>
    </div>
  )
}
