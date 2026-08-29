// Phase 4 — read-only display of the Engine's last step. Consumes only
// EngineSnapshot.lastTransition/lastActionSelection/lastTdInfo (ARCHITECTURE.md §5.6,
// as actually implemented in src/core/engine/types.ts) — no RL computation happens
// here, and targetFormula is shown exactly as Core produced it.

import type { ActionSelection, TDInfo, Transition } from '../../core/types/rl'
import { actionLabel } from '../grid/actionLabels'
import { useHighlightOnChange } from '../hooks/useHighlightOnChange'
import { translations, translateActionLabel, type Dictionary } from '../../ui/i18n'

export interface InspectorPanelProps {
  lastTransition: Transition | null
  lastActionSelection: ActionSelection | null
  lastTdInfo: TDInfo | null
  /** Phase 13 — defaults to English so every pre-existing caller/test is unaffected. */
  t?: Dictionary
  locale?: 'en' | 'ko'
}

function formatNumber(value: number): string {
  return Number.isFinite(value) ? value.toFixed(3) : String(value)
}

export function InspectorPanel({
  lastTransition,
  lastActionSelection,
  lastTdInfo,
  t = translations.en,
  locale = 'en',
}: InspectorPanelProps) {
  // Called unconditionally (before the empty-state early return) to respect the Rules
  // of Hooks; a null lastTdInfo just means "nothing to highlight yet".
  const highlightEstimate = useHighlightOnChange(lastTdInfo?.updatedEstimate ?? 0)

  // Phase 36: a Greedy run (SimulationEngine.ts's performOneStep(), `greedy` branch)
  // deliberately sets `lastTdInfo = null` (no TD update happens — Policy
  // Evaluation/exhibition only) but still populates `lastTransition`/
  // `lastActionSelection` unconditionally, exactly like a normal step. Requiring all
  // three previously hid State/Action/Reward during Greedy even though that data was
  // genuinely available. Only `lastTransition`/`lastActionSelection` gate the empty
  // state now; the TD-specific sections below render only when `lastTdInfo` exists,
  // so non-Greedy Step/Run behavior (where all three are always null or all three are
  // always populated together) is completely unchanged.
  if (!lastTransition || !lastActionSelection) {
    return (
      <div
        className="w-full max-w-lg rounded border border-gray-200 p-4 text-sm text-gray-500"
        data-testid="inspector-empty"
      >
        {t.inspector.empty}
      </div>
    )
  }

  return (
    <div className="w-full max-w-lg space-y-3 rounded border border-gray-200 p-4 text-sm" data-testid="inspector-panel">
      <section>
        <h2 className="font-semibold text-gray-700">{t.inspector.state}</h2>
        <p data-testid="inspector-state">
          {lastTransition.state} <span aria-hidden>→</span>{' '}
          <span className="font-medium">{lastTransition.nextState}</span>
        </p>
      </section>

      <section>
        <h2 className="font-semibold text-gray-700">{t.inspector.action}</h2>
        <p data-testid="inspector-action">
          {translateActionLabel(actionLabel(lastTransition.action), locale)}{' '}
          <span className="text-gray-500">
            ({lastActionSelection.wasExploration ? t.inspector.exploration : t.inspector.exploitation})
          </span>
        </p>
        {lastActionSelection.candidateValues.length > 0 && (
          <p className="text-gray-500" data-testid="inspector-candidates">
            {t.inspector.candidates} {lastActionSelection.candidateValues.map((v) => formatNumber(v)).join(', ')}
          </p>
        )}
      </section>

      <section>
        <h2 className="font-semibold text-gray-700">{t.inspector.reward}</h2>
        <p data-testid="inspector-reward">{formatNumber(lastTransition.reward)}</p>
      </section>

      {/* Phase 36: TD Target/Error/Estimate only exist when a real Agent update
          happened — absent during a Greedy run (Policy Evaluation only, no learning).
          Rendered only when lastTdInfo is present, rather than gating the whole panel
          on it, so State/Action/Reward above stay visible during Greedy too. */}
      {lastTdInfo && (
        <>
          <section>
            <h2 className="font-semibold text-gray-700">{t.inspector.tdTarget}</h2>
            <p data-testid="inspector-target">{formatNumber(lastTdInfo.target)}</p>
            <p className="break-words text-xs text-gray-500" data-testid="inspector-target-formula">
              {lastTdInfo.targetFormula}
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-700">{t.inspector.tdError}</h2>
            <p data-testid="inspector-error">{formatNumber(lastTdInfo.error)}</p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-700">{t.inspector.estimate}</h2>
            <p
              data-testid="inspector-estimate"
              className={`inline-block rounded px-1 transition-colors duration-500 ${
                highlightEstimate ? 'bg-amber-200' : 'bg-transparent'
              }`}
            >
              Q(s,a): {formatNumber(lastTdInfo.previousEstimate)} <span aria-hidden>→</span>{' '}
              {formatNumber(lastTdInfo.updatedEstimate)}
            </p>
          </section>
        </>
      )}
    </div>
  )
}
