// Phase 23 — lets the user pick which registered Algorithm the Engine uses. Native
// <select>, same pattern as LanguageSelector.tsx. Presentational only: reports the
// user's choice via onChange; the caller (App.tsx) is the one that actually calls
// engine.reset({ algorithmId }) — the existing ResetOverrides.algorithmId path (already
// present since Phase 1/2) already gives a fresh Agent/stats/hyperparams for the newly
// selected Algorithm, so this component adds no new Core semantics, only exposes the
// existing one.
//
// The option list is read from the real Algorithm Registry (listAlgorithms()) rather
// than a hardcoded id list, so a future third registered Algorithm would appear here
// automatically. listAlgorithms() has no displayName concept (Algorithm.ts intentionally
// doesn't carry a human-readable name — ARCHITECTURE.md §4.3), so ALGORITHM_DISPLAY_NAMES
// below is a small, viz-only lookup (same precedent as actionLabels.ts's GridWorld action
// labels) with a graceful fallback to the raw id for anything unmapped.

import { listAlgorithms } from '../../core/algorithms/registry'
import { translations, type Dictionary } from '../../ui/i18n'

export interface AlgorithmSelectorProps {
  algorithmId: string
  onChange: (algorithmId: string) => void
  disabled?: boolean
  t?: Dictionary
}

// "Q-Learning"/"SARSA" are proper algorithm names — deliberately not translated (Phase
// 23 spec §11), shown as-is regardless of locale.
const ALGORITHM_DISPLAY_NAMES: Record<string, string> = {
  'q-learning': 'Q-Learning',
  sarsa: 'SARSA',
}

function displayName(id: string): string {
  return ALGORITHM_DISPLAY_NAMES[id] ?? id
}

function description(id: string, t: Dictionary): string {
  if (id === 'sarsa') return t.algorithm.sarsaDescription
  if (id === 'q-learning') return t.algorithm.qLearningDescription
  return ''
}

export function AlgorithmSelector({
  algorithmId,
  onChange,
  disabled = false,
  t = translations.en,
}: AlgorithmSelectorProps) {
  const algorithmIds = listAlgorithms().map((algorithm) => algorithm.id)

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="algorithm-selector">
      <label className="flex items-center gap-1">
        {t.algorithm.label}
        <select
          value={algorithmId}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          data-testid="algorithm-select"
          className="rounded border border-gray-300 px-1 py-0.5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {algorithmIds.map((id) => (
            <option key={id} value={id}>
              {displayName(id)}
            </option>
          ))}
        </select>
      </label>
      <span className="text-xs text-gray-500" data-testid="algorithm-description">
        {description(algorithmId, t)}
      </span>
    </div>
  )
}
