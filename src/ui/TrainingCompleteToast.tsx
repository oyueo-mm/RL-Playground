import { useEffect, useRef, useState } from 'react'
import type { TrainingRunSummary } from '../core/engine/types'
import { engine } from './engine'
import { useSimulationEngine } from './hooks/useSimulationEngine'
import type { Locale } from './i18n'

const AUTO_CLOSE_MS = 8000

/**
 * Small, non-blocking note for a normally finished training request. The engine only publishes
 * `completedRun` when a `run({ episodes })` request reached its target (never for pause, stop,
 * resource limits, greedy playback or resets). The last announced id is remembered so re-renders
 * and later snapshots cannot show the same run twice; a completion that happens while the
 * learning screen is hidden is consumed silently, so it never pops up later on return.
 */
export function TrainingCompleteToast({ locale, visible, onRunPolicy }: { locale: Locale; visible: boolean; onRunPolicy: () => void }) {
  const snapshot = useSimulationEngine(engine)
  const completed = snapshot.completedRun
  const seen = useRef(completed?.id ?? 0)
  const [run, setRun] = useState<TrainingRunSummary | null>(null)
  useEffect(() => {
    if (completed && completed.id > seen.current) { seen.current = completed.id; setRun(visible ? completed : null) }
  }, [completed, visible])
  // Leaving the screen, starting another run, greedy playback or a reset (all clear `completedRun`) remove the note.
  useEffect(() => { if (run && (!visible || completed?.id !== run.id)) setRun(null) }, [run, visible, completed?.id])
  if (!run) return null
  return <Toast run={run} locale={locale} onClose={() => setRun(null)} onRunPolicy={() => { setRun(null); onRunPolicy() }} />
}

function Toast({ run, locale, onClose, onRunPolicy }: { run: TrainingRunSummary; locale: Locale; onClose: () => void; onRunPolicy: () => void }) {
  const ko = locale === 'ko'
  const [held, setHeld] = useState(false)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    if (held) return
    const timer = window.setTimeout(() => close.current(), AUTO_CLOSE_MS)
    return () => window.clearTimeout(timer)
  }, [held])
  const count = run.completedEpisodes.toLocaleString()
  return <div className="completion-toast" role="status" aria-live="polite" data-testid="training-complete" data-run-id={run.id}
    onMouseEnter={() => setHeld(true)} onMouseLeave={() => setHeld(false)} onFocus={() => setHeld(true)}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setHeld(false) }}>
    <span className="completion-toast-text"><span aria-hidden="true">✓ </span><span data-testid="completion-message">{ko ? `${count}번 학습 완료!` : `${count} episodes complete!`}</span></span>
    <button type="button" className="completion-toast-run" onClick={onRunPolicy} data-testid="completion-run-policy">{ko ? '학습 결과 실행' : 'Run policy'} <span aria-hidden="true">▶</span></button>
    <button type="button" className="completion-toast-close" onClick={onClose} aria-label={ko ? '알림 닫기' : 'Dismiss'} data-testid="completion-close">×</button>
  </div>
}
