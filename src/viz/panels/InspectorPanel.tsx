// Phase 4 — read-only display of the Engine's last step. Consumes only
// EngineSnapshot.lastTransition/lastActionSelection/lastTdInfo (ARCHITECTURE.md §5.6,
// as actually implemented in src/core/engine/types.ts) — no RL computation happens
// here, and targetFormula is shown exactly as Core produced it.

import type { ActionSelection, TDInfo, Transition } from '../../core/types/rl'
import { actionLabel } from '../grid/actionLabels'
import { useHighlightOnChange } from '../hooks/useHighlightOnChange'

export interface InspectorPanelProps {
  lastTransition: Transition | null
  lastActionSelection: ActionSelection | null
  lastTdInfo: TDInfo | null
}

function formatNumber(value: number): string {
  return Number.isFinite(value) ? value.toFixed(3) : String(value)
}

export function InspectorPanel({ lastTransition, lastActionSelection, lastTdInfo }: InspectorPanelProps) {
  // Called unconditionally (before the empty-state early return) to respect the Rules
  // of Hooks; a null lastTdInfo just means "nothing to highlight yet".
  const highlightEstimate = useHighlightOnChange(lastTdInfo?.updatedEstimate ?? 0)

  if (!lastTransition || !lastActionSelection || !lastTdInfo) {
    return (
      <div
        className="w-full max-w-md rounded border border-gray-200 p-4 text-sm text-gray-500"
        data-testid="inspector-empty"
      >
        Step을 실행하면 업데이트 정보가 표시됩니다.
      </div>
    )
  }

  return (
    <div className="w-full max-w-md space-y-3 rounded border border-gray-200 p-4 text-sm" data-testid="inspector-panel">
      <section>
        <h2 className="font-semibold text-gray-700">State</h2>
        <p data-testid="inspector-state">
          {lastTransition.state} <span aria-hidden>→</span>{' '}
          <span className="font-medium">{lastTransition.nextState}</span>
        </p>
      </section>

      <section>
        <h2 className="font-semibold text-gray-700">Action</h2>
        <p data-testid="inspector-action">
          {actionLabel(lastTransition.action)}{' '}
          <span className="text-gray-500">
            ({lastActionSelection.wasExploration ? 'exploration' : 'exploitation'})
          </span>
        </p>
        {lastActionSelection.candidateValues.length > 0 && (
          <p className="text-gray-500" data-testid="inspector-candidates">
            candidates: {lastActionSelection.candidateValues.map((v) => formatNumber(v)).join(', ')}
          </p>
        )}
      </section>

      <section>
        <h2 className="font-semibold text-gray-700">Reward</h2>
        <p data-testid="inspector-reward">{formatNumber(lastTransition.reward)}</p>
      </section>

      <section>
        <h2 className="font-semibold text-gray-700">TD Target</h2>
        <p data-testid="inspector-target">{formatNumber(lastTdInfo.target)}</p>
        <p className="break-words text-xs text-gray-500" data-testid="inspector-target-formula">
          {lastTdInfo.targetFormula}
        </p>
      </section>

      <section>
        <h2 className="font-semibold text-gray-700">TD Error</h2>
        <p data-testid="inspector-error">{formatNumber(lastTdInfo.error)}</p>
      </section>

      <section>
        <h2 className="font-semibold text-gray-700">Estimate</h2>
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
    </div>
  )
}
