import { useEffect, useMemo, useRef, useState } from 'react'
import type { Locale } from './i18n'
import { HOME_SCENARIOS, scenarioFrames } from './homeScenarios'
import { GridSvg } from '../viz/grid/GridSvg'

export function GridDemo({ locale }: { locale: Locale }) {
  const ko = locale === 'ko'
  const [mode, setMode] = useState<'explore' | 'learned'>('explore')
  const [playback, setPlayback] = useState({ scenario: 0, step: 0, hold: 0 })
  const [playing, setPlaying] = useState(() => !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  const [visible, setVisible] = useState(true)
  const root = useRef<HTMLElement>(null)
  const scenario = HOME_SCENARIOS[playback.scenario]
  const allFrames = useMemo(() => HOME_SCENARIOS.map(item => scenarioFrames(item, mode)), [mode])
  const frames = allFrames[playback.scenario]
  const frame = frames[Math.min(playback.step, frames.length - 1)]
  const finished = playback.step >= frames.length - 1
  useEffect(() => {
    if (!playing || !visible) return
    const id = window.setInterval(() => setPlayback(previous => previous.step < allFrames[previous.scenario].length - 1 ? { ...previous, step: previous.step + 1 } : previous.hold < 2 ? { ...previous, hold: previous.hold + 1 } : { scenario: (previous.scenario + 1) % HOME_SCENARIOS.length, step: 0, hold: 0 }), 600)
    return () => window.clearInterval(id)
  }, [playing, visible, allFrames, playback.scenario])
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const reduce = () => { if (media?.matches) setPlaying(false) }
    const visibility = () => setVisible(!document.hidden)
    media?.addEventListener('change', reduce); document.addEventListener('visibilitychange', visibility)
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => setVisible(entries[0].isIntersecting && !document.hidden))
    if (root.current) observer?.observe(root.current)
    return () => { media?.removeEventListener('change', reduce); document.removeEventListener('visibilitychange', visibility); observer?.disconnect() }
  }, [])
  const choose = (index: number) => setPlayback({ scenario: index, step: 0, hold: 0 })
  const [x, y] = frame.model.agentPos.split(',').map(Number)
  const previous = frames[Math.max(0, playback.step - 1)]
  const teleported = Math.abs(x - Number(previous.model.agentPos.split(',')[0])) + Math.abs(y - Number(previous.model.agentPos.split(',')[1])) > 1
  const blocked = playback.step > 0 && frame.model.agentPos === previous.model.agentPos
  return <section ref={root} className="demo-card" aria-label={ko ? '강화학습 설명용 시연' : 'Reinforcement learning illustrative demo'} data-scenario={scenario.id}>
    <div className="demo-heading"><span>GRIDWORLD / {scenario.name[locale]}</span><span className="demo-label">{ko ? '설명용 시연' : 'SCRIPTED DEMO'}</span></div>
    <div className="scenario-tabs" role="group" aria-label={ko ? '시연 환경' : 'Demo environment'}>{HOME_SCENARIOS.map((item, index) => <button key={item.id} aria-pressed={playback.scenario === index} onClick={() => choose(index)} data-testid={`demo-${item.id}`}>{item.name[locale]}</button>)}</div>
    <div className="demo-tabs" role="group" aria-label={ko ? '행동 비교' : 'Compare behavior'}><button aria-pressed={mode === 'explore'} onClick={() => { setMode('explore'); choose(playback.scenario) }}>{ko ? '학습 전 · 탐색' : 'Before · exploration'}</button><button aria-pressed={mode === 'learned'} onClick={() => { setMode('learned'); choose(playback.scenario) }}>{ko ? '학습 후 · 경로 활용' : 'After · exploitation'}</button></div>
    <div className={`scenario-grid ${teleported ? 'is-teleport' : ''}`} data-testid="home-demo-grid"><GridSvg renderModel={frame.model} cellSize={48} ariaLabel={ko ? `${frame.model.width}×${frame.model.height} 맵, 에이전트 ${y + 1}행 ${x + 1}열, ${playback.step}번 이동` : `${frame.model.width} by ${frame.model.height} map. Agent row ${y + 1}, column ${x + 1}. ${playback.step} moves.`} /></div>
    <div className="demo-playback"><button className="demo-play" onClick={() => { if (finished && !playing) choose(playback.scenario); setPlaying(!playing) }}>{playing ? (ko ? '일시정지' : 'Pause') : (ko ? '시연 재생' : 'Play demo')}</button><button onClick={() => { setPlaying(false); setPlayback(value => ({ ...value, step: Math.min(value.step + 1, frames.length - 1) })) }} disabled={finished}>{ko ? '한 칸 이동' : 'Step'}</button><button aria-label={ko ? '시연 초기화' : 'Reset demo'} onClick={() => { setPlaying(false); choose(playback.scenario) }}>↺</button><span>{String(playback.step).padStart(2, '0')} <small>STEPS</small></span></div>
    <p className="demo-insight" aria-live="polite">{frame.done ? (ko ? '모든 목표 수집! +10 보상.' : 'All goals collected! +10 reward.') : blocked ? (ko ? `이동 차단 · ${frame.reward} 페널티. ` : `Blocked · ${frame.reward} penalty. `) + scenario.insight[locale] : scenario.insight[locale]}</p>
    <p className="demo-disclaimer">{ko ? '실제 환경 규칙으로 검증한 설명용 경로입니다. 실제 학습 결과가 아닙니다. Q-Learning·SARSA는 학습 환경에서 실행하세요.' : 'Scripted paths verified by real environment transitions, not actual training results. Run Q-Learning or SARSA in the lab.'}</p>
  </section>
}
