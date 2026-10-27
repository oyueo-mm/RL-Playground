import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { Locale } from './i18n'
import { DemoPlayback, demoInterval, type DemoView } from './demoPlayback'
import type { EnvironmentPreset } from '../data/presets/manifest'
import { GridSvg } from '../viz/grid/GridSvg'
import { GridWorldEnv } from '../core/environments/gridworld/GridWorldEnv'
import { draftToGridWorldConfig } from '../viz/controls/envEditorDraft'

const Terrain = memo(function Terrain({ model, label }: { model: DemoView['model']; label: string }) {
  return <GridSvg renderModel={model} showAgent={false} cellSize={40} ariaLabel={label} />
}, (previous, next) => previous.label === next.label && Object.keys(previous.model).length === Object.keys(next.model).length && (Object.keys(previous.model) as (keyof DemoView['model'])[]).every(key => key === 'agentPos' || Object.is(previous.model[key], next.model[key])))

const DemoCard = memo(function DemoCard({ view, locale, onOpen }: { view: DemoView; locale: Locale; onOpen: (view: DemoView) => void }) {
  const ko = locale === 'ko'
  const [x,y] = view.model.agentPos.split(',').map(Number)
  return <div className="mini-demo" data-scenario={view.preset.id} data-step={view.step} data-done={view.done}>
    <header><strong>{view.preset.metadata.name[locale]}</strong><span>{view.preset.metadata.difficulty[locale]} · {view.done ? '✓' : `${view.step}/${view.preset.solution.length}`}</span></header>
    <button className={`scenario-grid ${view.teleport ? 'is-teleport' : ''}`} style={{ width: `min(100%, calc(var(--mini-size) * ${view.model.width/view.model.height}))` }} onClick={() => onOpen(view)} aria-label={`${ko ? '크게 보기' : 'Enlarge'}: ${view.preset.metadata.name[locale]}`} data-testid="home-demo-grid"><Terrain model={view.model} label={`${view.preset.metadata.name[locale]} · ${ko ? '검증 경로 시연' : 'Verified witness demo'}`} /><svg className="mini-agent" viewBox={`0 0 ${view.model.width*40} ${view.model.height*40}`} aria-hidden="true"><circle data-testid="agent-marker" cx={x*40+20} cy={y*40+20} r={12} fill="#ef4444" stroke="white" strokeWidth={3} style={{ transitionDuration: `${Math.min(250, demoInterval(view.preset.solution.length) * .8)}ms` }} /></svg></button>
  </div>
})

function Preview({ view, locale, onClose, onExperiment }: { view: DemoView; locale: Locale; onClose: () => void; onExperiment?: (preset: EnvironmentPreset) => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const ko = locale === 'ko'
  const [step, setStep] = useState(view.step)
  const frame = useMemo(() => {
    const env = new GridWorldEnv(draftToGridWorldConfig(view.preset.draft)), trail = [env.getRenderModel().agentPos]
    for (const action of view.preset.solution.slice(0, step)) { env.step(action); trail.push(env.getRenderModel().agentPos) }
    return { model: env.getRenderModel(), trail }
  }, [view.preset, step])
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const dialog = ref.current!
    if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '')
    return () => { dialog.close?.(); if (previous?.isConnected) previous.focus() }
  }, [])
  const points = frame.trail.map(key => { const [x,y] = key.split(',').map(Number); return `${x*40+20},${y*40+20}` }).join(' ')
  return <dialog ref={ref} className="demo-preview" onCancel={event => { event.preventDefault(); onClose() }} aria-label={view.preset.metadata.name[locale]}>
    <header><h2>{view.preset.metadata.name[locale]}</h2><button onClick={onClose} aria-label={ko ? '미리보기 닫기' : 'Close preview'}>×</button></header>
    <p>{view.preset.metadata.difficulty[locale]} · {view.model.width}×{view.model.height} · {view.step}/{view.preset.solution.length} · {ko ? '설명용 검증 경로' : 'Scripted witness path'}</p>
    <div className="demo-preview-grid" style={{ aspectRatio: `${view.model.width}/${view.model.height}` }}><GridSvg renderModel={frame.model} cellSize={40} className="stage-grid" /><svg className="stage-overlay" viewBox={`0 0 ${view.model.width*40} ${view.model.height*40}`} aria-label={ko ? '실행한 경로' : 'Executed path'}><polyline points={points} fill="none" stroke="#0754A5" strokeWidth={3} strokeDasharray="5 4" opacity={.65} /></svg></div>
    <label>{ko ? '검증 경로 탐색' : 'Explore witness path'} · {step}/{view.preset.solution.length}<input type="range" min={0} max={view.preset.solution.length} value={step} onChange={event => setStep(Number(event.target.value))} /></label>
    <p>{view.preset.metadata.description[locale]}</p>
    <button className="primary-button" onClick={() => onExperiment?.(view.preset)}>{ko ? '이 맵으로 실험하기' : 'Experiment with this map'} ↗</button>
  </dialog>
}

export function GridDemo({ locale, onExperiment }: { locale: Locale; onExperiment?: (preset: EnvironmentPreset) => void }) {
  const ko = locale === 'ko'
  const [playback] = useState(() => new DemoPlayback(Math.random, performance.now()))
  const [views, setViews] = useState(() => playback.views())
  const [playing, setPlaying] = useState(() => !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  const [visible, setVisible] = useState(!document.hidden)
  const [preview, setPreview] = useState<DemoView | null>(null)
  const root = useRef<HTMLElement>(null), inView = useRef(true)
  useEffect(() => {
    if (!playing || !visible || preview) return
    const id = window.setInterval(() => { if (playback.tick(performance.now())) setViews(playback.views()) }, 80)
    return () => window.clearInterval(id)
  }, [playing, visible, preview, playback])
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const reduce = () => { if (media?.matches) setPlaying(false) }
    const visibility = () => setVisible(inView.current && !document.hidden)
    media?.addEventListener('change', reduce); document.addEventListener('visibilitychange', visibility)
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => { inView.current = entries[0].isIntersecting; visibility() })
    if (root.current) observer?.observe(root.current)
    return () => { media?.removeEventListener('change', reduce); document.removeEventListener('visibilitychange', visibility); observer?.disconnect() }
  }, [])
  return <section ref={root} className="demo-card demo-gallery" aria-label={ko ? '강화학습 설명용 시연' : 'Reinforcement learning illustrative demo'}>
    <div className="demo-heading"><span className="demo-label">{ko ? '설명용 시연' : 'SCRIPTED DEMO'}</span></div>
    <div className="demo-grid-gallery">{views.map((view,index) => <DemoCard key={index} view={view} locale={locale} onOpen={setPreview} />)}</div>
    <div className="demo-playback"><button onClick={() => setPlaying(!playing)}>{playing ? ko ? '일시정지' : 'Pause' : ko ? '시연 재생' : 'Play demo'}</button><button onClick={() => { playback.shuffle(performance.now()); setViews(playback.views()) }}>{ko ? '맵 섞기' : 'Shuffle maps'}</button><button onClick={() => { setPlaying(false); playback.tick(performance.now(), true); setViews(playback.views()) }}>{ko ? '한 칸 이동' : 'Step'}</button><details><summary>{ko ? '시연 안내' : 'About these demos'}</summary><p>{ko ? '실제 환경 전이로 검증한 성공 경로입니다. 실제 학습 결과가 아닙니다.' : 'Success paths verified by actual transitions, not Q-Learning/SARSA training results.'}</p></details></div>
    {preview && <Preview view={preview} locale={locale} onClose={() => setPreview(null)} onExperiment={onExperiment} />}
  </section>
}
