import { useEffect, useRef, useState } from 'react'
import { GridWorldEnv } from '../core/environments/gridworld/GridWorldEnv'
import type { GridWorldConfig } from '../core/environments/gridworld/types'
import { GridSvg } from '../viz/grid/GridSvg'
import { GridViewport } from './GridViewport'
import type { Locale } from './i18n'

/** Intentionally receives no engine, agent, apply callback or mutable editor draft. */
export function ManualPlay({ config, locale, active, onClose }: { config: GridWorldConfig; locale: Locale; active: boolean; onClose: () => void }) {
  const [env] = useState(() => new GridWorldEnv(structuredClone(config)))
  const [progress, setProgress] = useState({ steps: 0, reward: 0, done: false })
  const root = useRef<HTMLDivElement>(null)
  const ko = locale === 'ko'
  const restart = () => { env.reset(); setProgress({ steps: 0, reward: 0, done: false }) }
  const move = (action: number) => {
    if (env.isTerminal(env.getState())) return
    const result = env.step(action)
    setProgress(previous => ({ steps: previous.steps + 1, reward: previous.reward + result.reward, done: result.done }))
  }
  useEffect(() => { root.current?.focus() }, [])
  useEffect(() => {
    if (!active) return
    const handle = (event: KeyboardEvent) => {
      if (event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable="true"]')) return
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return
      const key = event.key.toLowerCase()
      const direction = ({ arrowup: 0, w: 0, arrowdown: 1, s: 1, arrowleft: 2, a: 2, arrowright: 3, d: 3 } as Record<string, number>)[key]
      if (direction !== undefined) { event.preventDefault(); move(direction) }
      else if (key === 'r') { event.preventDefault(); restart() }
      else if (key === 'escape') { event.preventDefault(); onClose() }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  })
  const model = env.getRenderModel()
  const bomb = model.bombs.includes(model.agentPos)
  return <div className="manual-play" tabIndex={-1} ref={root} data-testid="manual-play" aria-label={ko ? '독립 직접 플레이' : 'Independent manual play'}>
    <div className="manual-controls"><strong>{ko ? '직접 플레이' : 'Manual play'}</strong><span data-testid="manual-progress" data-steps={progress.steps} aria-live="polite">{progress.steps} {ko ? '스텝' : 'steps'} · {progress.reward.toFixed(1)} {ko ? '보상' : 'reward'} · {(model.allGoals?.length ?? 0) - model.goals.length}/{model.allGoals?.length} {ko ? '목표' : 'goals'} · {progress.done ? bomb ? 'Bomb' : ko ? '성공' : 'Success' : ko ? '진행 중' : 'Playing'}</span><button onClick={restart}>{ko ? '다시 시작 (R)' : 'Restart (R)'}</button><button onClick={onClose}>{ko ? '편집으로 돌아가기 (Esc)' : 'Back to editor (Esc)'}</button></div>
    <GridViewport width={model.width} height={model.height} active={active}><GridSvg className="stage-grid" renderModel={model} cellSize={48} /></GridViewport>
    <div className="direction-pad" aria-label={ko ? '이동 방향' : 'Movement'}>{[0, 2, 1, 3].map(action => <button key={action} disabled={progress.done} aria-label={(ko ? ['위', '아래', '왼쪽', '오른쪽'] : ['Up', 'Down', 'Left', 'Right'])[action]} onClick={() => move(action)}>{['↑', '↓', '←', '→'][action]}</button>)}</div>
  </div>
}
