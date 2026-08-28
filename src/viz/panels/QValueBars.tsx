// Phase 4 — Q-value bar chart for a selected State. Reads only from
// EngineSnapshot.agentSnapshot (the public AgentSnapshot union from
// src/core/types/render.ts, produced by TabularQAgent.toSnapshot()) — never touches
// TabularQAgent's private Map or calls a live Agent method.

import type { StateKey } from '../../core/types/rl'
import type { AgentSnapshot } from '../../core/types/render'
import { GRIDWORLD_ACTION_LABELS } from '../grid/actionLabels'
import { useHighlightOnChange } from '../hooks/useHighlightOnChange'
import { translations, translateActionLabel, type Dictionary, type Locale } from '../../ui/i18n'

export interface QValueBarsProps {
  selectedState: StateKey | null
  agentSnapshot: AgentSnapshot
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
function resolveQVector(agentSnapshot: AgentSnapshot, state: StateKey): number[] {
  if (agentSnapshot.kind !== 'Q') {
    return new Array(GRIDWORLD_ACTION_LABELS.length).fill(0)
  }
  return agentSnapshot.qTable[state] ?? new Array(GRIDWORLD_ACTION_LABELS.length).fill(0)
}

export function QValueBars({ selectedState, agentSnapshot, t = translations.en, locale = 'en' }: QValueBarsProps) {
  if (!selectedState) {
    return (
      <div
        className="w-full max-w-md rounded border border-gray-200 p-4 text-sm text-gray-500"
        data-testid="qvalue-bars-empty"
      >
        {t.qvalues.empty}
      </div>
    )
  }

  const values = resolveQVector(agentSnapshot, selectedState)
  const maxAbs = Math.max(1e-6, ...values.map((v) => Math.abs(v)))

  return (
    <div className="w-full max-w-md space-y-2 rounded border border-gray-200 p-4 text-sm" data-testid="qvalue-bars">
      <h2 className="font-semibold text-gray-700">
        {t.qvalues.heading} — {selectedState}
      </h2>
      {values.map((value, action) => {
        // Canonical (untranslated) label — GRIDWORLD_ACTION_LABELS ('Up'/'Down'/...) —
        // drives the data-testid, exactly as before. Only the visible text is localized.
        const canonicalLabel = GRIDWORLD_ACTION_LABELS[action] ?? `Action ${action}`
        return (
          <QValueBarRow
            key={action}
            testIdLabel={canonicalLabel}
            displayLabel={translateActionLabel(canonicalLabel, locale)}
            value={value}
            maxAbs={maxAbs}
          />
        )
      })}
    </div>
  )
}

interface QValueBarRowProps {
  testIdLabel: string
  displayLabel: string
  value: number
  maxAbs: number
}

function QValueBarRow({ testIdLabel, displayLabel, value, maxAbs }: QValueBarRowProps) {
  const highlight = useHighlightOnChange(value)
  // Bar width is relative to the largest |value| among the currently displayed
  // actions, and capped at 50% of the track (each side of the zero-line) — so bars
  // never overflow regardless of how large or negative a Q-value gets.
  const widthPercent = Math.min(50, (Math.abs(value) / maxAbs) * 50)
  const isPositive = value >= 0

  return (
    <div className="flex items-center gap-2" data-testid={`qvalue-row-${testIdLabel.toLowerCase()}`}>
      <span className="w-14 shrink-0 text-gray-600">{displayLabel}</span>
      <div className="relative h-4 flex-1 overflow-hidden rounded bg-gray-100">
        <div className="absolute top-0 left-1/2 h-full w-px bg-gray-300" />
        <div
          className={`absolute top-0 h-full transition-all duration-300 ${
            isPositive ? 'left-1/2' : 'right-1/2'
          } ${highlight ? 'bg-amber-400' : 'bg-blue-500'}`}
          style={{ width: `${widthPercent}%` }}
        />
      </div>
      <span className="w-16 shrink-0 text-right tabular-nums" data-testid={`qvalue-${testIdLabel.toLowerCase()}`}>
        {value.toFixed(3)}
      </span>
    </div>
  )
}
