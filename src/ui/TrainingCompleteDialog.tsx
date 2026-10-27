import { useEffect, useRef, useState } from 'react'
import type { TrainingRunSummary } from '../core/engine/types'
import { engine } from './engine'
import { useSimulationEngine } from './hooks/useSimulationEngine'
import type { Locale } from './i18n'

const pct = (value: number) => `${(value * 100).toFixed(1)}%`
const reward = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(2)}`

/**
 * Announces a normally finished training request exactly once. The engine only publishes
 * `completedRun` when a `run({ episodes })` request reached its target (never for pause, stop,
 * resource limits, greedy playback or resets); this component remembers the last id it showed
 * so re-renders, navigation and later snapshots cannot re-open it.
 */
export function TrainingCompleteDialog({ locale, onViewResults }: { locale: Locale; onViewResults: () => void }) {
  const snapshot = useSimulationEngine(engine)
  const shown = useRef(snapshot.completedRun?.id ?? 0)
  const [run, setRun] = useState<TrainingRunSummary | null>(null)
  const id = snapshot.completedRun?.id
  useEffect(() => {
    const completed = snapshot.completedRun
    if (completed && completed.id > shown.current) { shown.current = completed.id; setRun(completed) }
  }, [id, snapshot.completedRun])
  if (!run) return null
  return <CompletionDialog run={run} locale={locale} onClose={() => setRun(null)} onViewResults={() => { setRun(null); onViewResults() }} />
}

function CompletionDialog({ run, locale, onClose, onViewResults }: { run: TrainingRunSummary; locale: Locale; onClose: () => void; onViewResults: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const ko = locale === 'ko'
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const dialog = ref.current!
    if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '')
    dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    return () => { dialog.close?.(); if (previous?.isConnected) previous.focus() }
  }, [])
  return <dialog ref={ref} className="completion-dialog" aria-labelledby="completion-title" aria-describedby="completion-body" data-testid="training-complete" data-run-id={run.id} onCancel={event => { event.preventDefault(); onClose() }} onKeyDown={event => {
    // Keep Tab / Shift+Tab inside the modal: wrap between its first and last action.
    if (event.key !== 'Tab') return
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>('button')], first = items[0], last = items.at(-1)
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }}>
    <h2 id="completion-title">{ko ? '학습 완료!' : 'Training complete!'}</h2>
    <p id="completion-body">{ko ? `설정한 ${run.targetEpisodes.toLocaleString()}개 에피소드의 학습이 끝났습니다.` : `All ${run.targetEpisodes.toLocaleString()} requested episodes have finished.`}{run.turbo ? (ko ? ' (Turbo)' : ' (Turbo)') : ''}</p>
    <dl className="completion-stats">
      <div><dt>{ko ? '완료한 에피소드' : 'Episodes completed'}</dt><dd data-testid="completion-episodes">{run.completedEpisodes.toLocaleString()}</dd></div>
      <div><dt>{ko ? '목표 달성 성공률' : 'Goal success rate'}</dt><dd data-testid="completion-success">{pct(run.successRate)} <small>({run.successes.toLocaleString()} / {run.completedEpisodes.toLocaleString()})</small></dd></div>
      <div><dt>{ko ? '평균 누적 보상' : 'Mean total reward'}</dt><dd data-testid="completion-reward">{reward(run.meanReward)}</dd></div>
    </dl>
    <p className="completion-note">{ko ? '이번 실행의 통계입니다. 학습이 끝났다는 뜻이며 최적 정책에 수렴했다는 뜻은 아닙니다.' : 'Statistics for this run only. Finished training does not mean the policy has converged.'}</p>
    <div className="completion-actions">
      <button type="button" onClick={onClose} data-testid="completion-close">{ko ? '닫기' : 'Close'}</button>
      <button type="button" className="primary-button" onClick={onViewResults} data-autofocus data-testid="completion-results">{ko ? '학습 결과 보기' : 'View results'}</button>
    </div>
  </dialog>
}
