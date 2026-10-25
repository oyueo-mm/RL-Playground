import { useEffect, useMemo, useRef, useState } from 'react'
import type { Locale } from './i18n'
import { HOME_SCENARIOS, scenarioFrames } from './homeScenarios'
import { GridSvg } from '../viz/grid/GridSvg'

export function GridDemo({ locale }: { locale: Locale }) {
  const ko = locale === 'ko'
  const [mode, setMode] = useState<'explore' | 'learned'>('explore')
  const [ticks, setTicks] = useState([0, 0, 0, 0])
  const [playing, setPlaying] = useState(() => !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  const [visible, setVisible] = useState(!document.hidden)
  const root = useRef<HTMLElement>(null)
  const inView = useRef(true)
  const frames = useMemo(() => HOME_SCENARIOS.slice(0, 4).map(item => scenarioFrames(item, mode)), [mode])
  useEffect(() => {
    if (!playing || !visible) return
    const id = window.setInterval(() => setTicks(previous => previous.map((tick, i) => (tick + 1) % (frames[i].length + 3))), 650)
    return () => window.clearInterval(id)
  }, [playing, visible, frames])
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const reduce = () => { if (media?.matches) setPlaying(false) }
    const visibility = () => setVisible(inView.current && !document.hidden)
    media?.addEventListener('change', reduce)
    document.addEventListener('visibilitychange', visibility)
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => { inView.current = entries[0].isIntersecting; visibility() })
    if (root.current) observer?.observe(root.current)
    return () => { media?.removeEventListener('change', reduce); document.removeEventListener('visibilitychange', visibility); observer?.disconnect() }
  }, [])
  return <section ref={root} className="demo-card demo-gallery" aria-label={ko ? '강화학습 설명용 시연' : 'Reinforcement learning illustrative demo'}>
    <div className="demo-heading"><span>GRIDWORLD / LIVE EXAMPLES</span><span className="demo-label">{ko ? '설명용 시연' : 'SCRIPTED DEMO'}</span></div>
    <div className="demo-tabs"><button aria-pressed={mode === 'explore'} onClick={() => { setMode('explore'); setTicks([0, 0, 0, 0]) }}>{ko ? '탐색 행동' : 'Exploration'}</button><button aria-pressed={mode === 'learned'} onClick={() => { setMode('learned'); setTicks([0, 0, 0, 0]) }}>{ko ? '경로 활용' : 'Route exploitation'}</button></div>
    <div className="demo-grid-gallery">{frames.map((sequence, i) => {
      const frame = sequence[Math.min(ticks[i], sequence.length - 1)]
      const scenario = HOME_SCENARIOS[i]
      const previous = sequence[Math.max(0, Math.min(ticks[i] - 1, sequence.length - 1))].model.agentPos.split(',').map(Number)
      const position = frame.model.agentPos.split(',').map(Number)
      const teleport = Math.abs(previous[0] - position[0]) + Math.abs(previous[1] - position[1]) > 1
      return <div className="mini-demo" key={scenario.id} data-scenario={scenario.id} data-step={ticks[i]}>
        <header><strong>{scenario.name[locale]}</strong><span>{frame.done ? '✓' : `${Math.min(ticks[i], sequence.length - 1)} steps`}</span></header>
        <div className={`scenario-grid ${teleport ? 'is-teleport' : ''}`} data-testid="home-demo-grid"><GridSvg renderModel={frame.model} cellSize={40} ariaLabel={`${scenario.name[locale]} · ${ko ? '설명용 경로' : 'Scripted path'}`} /></div>
        <details><summary aria-label={`${scenario.name[locale]} ${ko ? '시연 설명' : 'demo explanation'}`}>ⓘ {ko ? '원리' : 'How it works'}</summary><p>{scenario.insight[locale]}</p></details>
      </div>
    })}</div>
    <div className="demo-playback"><button onClick={() => setPlaying(!playing)}>{playing ? ko ? '일시정지' : 'Pause' : ko ? '시연 재생' : 'Play demo'}</button><button onClick={() => { setPlaying(false); setTicks(previous => previous.map((tick, i) => (tick + 1) % (frames[i].length + 3))) }}>{ko ? '한 칸 이동' : 'Step'}</button><button aria-label={ko ? '시연 초기화' : 'Reset demo'} onClick={() => { setPlaying(false); setTicks([0, 0, 0, 0]) }}>↺</button><details><summary>{ko ? '시연 안내' : 'About these demos'}</summary><p>{ko ? '실제 환경 규칙으로 검증한 미리 정해진 경로입니다. 실제 학습 결과가 아닙니다. Q-Learning·SARSA는 학습 환경에서 실행하세요.' : 'Scripted paths verified by real environment transitions, not actual training results. Run Q-Learning or SARSA in the lab.'}</p></details></div>
  </section>
}
