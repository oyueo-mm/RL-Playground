import { useEffect, useState } from 'react'
import type { Locale } from './i18n'

const exploration = [24, 25, 24, 18, 12, 18, 24, 25, 26, 27, 21, 15, 21, 27, 28, 29, 23, 17, 11, 5]
const exploitation = [24, 25, 26, 27, 28, 29, 23, 17, 11, 5]
const walls = [7, 8, 9, 13, 19, 20]

export function Home({ locale, onStart, onGuide, guideOnly = false }: { locale: Locale; onStart: () => void; onGuide: () => void; guideOnly?: boolean }) {
  const ko = locale === 'ko'
  return <div className="home-page">
    {!guideOnly && <>
      <div className="home-eyebrow"><span className="status-dot" /> INTERACTIVE LEARNING LAB <span className="eyebrow-line" /></div>
      <div className="hero-layout">
        <section className="hero-copy" aria-label={ko ? '소개' : 'Introduction'}>
          <div className="hero-kicker">{ko ? '작은 움직임, 더 나은 선택.' : 'Small steps. Better decisions.'}</div>
          <h2>{ko ? <>강화학습<br /><span>시뮬레이터</span><span className="heading-dot">.</span></> : <>Learn through<br /><span>reinforcement</span><span className="heading-dot">.</span></>}</h2>
          <p className="hero-description">{ko ? '스스로 탐험하고, 보상으로 배우는 AI.\n눈앞에서 펼쳐지는 강화학습의 원리를 발견하세요.' : 'Explore, receive rewards, and learn. Discover how an agent turns experience into better decisions.'}</p>
          <div className="hero-actions"><button className="primary-button" onClick={onStart}>{ko ? '학습 시작하기' : 'Start learning'} ↗</button><button className="text-button" onClick={onGuide}>{ko ? '알고리즘 알아보기' : 'Explore algorithms'} →</button></div>
          <div className="hero-meta">↳ {ko ? '설치 없이, 브라우저에서 바로 실험하세요.' : 'Your next experiment starts in your browser.'}</div>
          <div className="algorithm-tags"><span>Q-Learning</span><span>SARSA</span><span>GridWorld</span></div>
        </section>
        <GridDemo locale={locale} />
      </div>
      <section className="concept-section" aria-labelledby="concept-title"><div className="section-heading"><div><span className="section-number">01 / THE BASICS</span><h2 id="concept-title">{ko ? '경험이 쌓이면, 선택이 달라집니다.' : 'More experience. Better decisions.'}</h2></div><p>{ko ? '강화학습을 이루는 세 가지 연결고리' : 'Three connected ideas'}</p></div><div className="concept-grid">
        {[
          ['◎', 'AGENT', ko ? '스스로 선택하는 에이전트' : 'An agent that chooses', ko ? '현재 상태를 관찰하고 다음 행동을 선택합니다. 때로는 새로운 길을 탐험하죠.' : 'Observes the current state and chooses an action, sometimes exploring a new path.'],
          ['▦', 'ENVIRONMENT', ko ? '가능성이 펼쳐지는 환경' : 'An environment to explore', ko ? '행동에 따라 상태가 바뀌는 세계입니다. 벽, 목표, 위험이 있는 나만의 맵을 만들어 보세요.' : 'Actions change the world. Build a map with walls, goals, and risks.'],
          ['✧', 'REWARD', ko ? '더 나은 행동을 위한 보상' : 'A reward that guides', ko ? '보상과 페널티를 통해, 장기적인 누적 보상을 높이는 방향으로 배웁니다.' : 'Rewards and penalties guide learning toward greater long-term return.'],
        ].map(([icon, label, title, text]) => <article className="concept-card" key={label}><div className="concept-top"><span>{icon}</span><small>{label}</small></div><h3>{title}</h3><p>{text}</p></article>)}
      </div></section>
    </>}
    <section className="algorithm-section" aria-labelledby="algorithm-title"><div><span className="section-number">02 / LEARNING METHODS</span><h2 id="algorithm-title">{ko ? '같은 환경, 서로 다른 학습 방식.' : 'One world. Different ways to learn.'}</h2><p>{ko ? '행동의 가치를 업데이트하는 두 알고리즘을 비교해 보세요.' : 'Compare two ways to update the value of an action.'}</p></div><div className="algorithm-grid"><article><span className="algorithm-badge">OFF-POLICY</span><h3>Q-Learning ↗</h3><p>{ko ? '다음 상태에서 가장 높은 Q값을 기준으로 학습합니다. 실제 탐험 행동과 별개로 최선의 선택을 평가합니다.' : 'Learns from the highest next-state Q-value, independently of the action explored.'}</p><code>r + γ max Q(s′, a′)</code></article><article><span className="algorithm-badge">ON-POLICY</span><h3>SARSA ↗</h3><p>{ko ? '다음 상태에서 실제 선택한 행동의 Q값으로 학습합니다. 탐험을 포함한 현재 정책의 영향을 반영합니다.' : 'Learns from the next action actually selected, reflecting the current policy including exploration.'}</p><code>r + γ Q(s′, a′)</code></article></div><button className="text-button" onClick={onStart}>{ko ? '실험실에서 직접 비교하기' : 'Compare in the lab'} →</button></section>
    <footer className="home-footer"><span>RL Playground</span><span>{ko ? '탐험하고, 이해하고, 발견하세요.' : 'Explore. Understand. Discover.'}</span><span>BUILT FOR CURIOSITY ↗</span></footer>
  </div>
}

function GridDemo({ locale }: { locale: Locale }) {
  const ko = locale === 'ko'
  const [mode, setMode] = useState<'explore' | 'learned'>('explore')
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const path = mode === 'explore' ? exploration : exploitation
  const finished = step === path.length - 1
  useEffect(() => {
    if (!playing || finished) return
    const id = window.setInterval(() => setStep(value => Math.min(value + 1, path.length - 1)), 600)
    return () => window.clearInterval(id)
  }, [playing, finished, path.length])
  const choose = (next: 'explore' | 'learned') => { setMode(next); setStep(0); setPlaying(false) }
  return <section className="demo-card" aria-label={ko ? '강화학습 설명용 시연' : 'Reinforcement learning illustrative demo'}>
    <div className="demo-heading"><span><span className="status-dot" /> GRIDWORLD</span><span className="demo-label">{ko ? '설명용 시연' : 'SCRIPTED DEMO'}</span></div>
    <div className="demo-tabs" role="group" aria-label={ko ? '행동 비교' : 'Compare behavior'}><button aria-pressed={mode === 'explore'} onClick={() => choose('explore')}>{ko ? '학습 전 · 탐색' : 'Before · exploration'}</button><button aria-pressed={mode === 'learned'} onClick={() => choose('learned')}>{ko ? '학습 후 · 경로 활용' : 'After · exploitation'}</button></div>
    <div className="demo-grid" role="img" aria-label={ko ? `6×5 맵, 에이전트 ${Math.floor(path[step] / 6) + 1}행 ${path[step] % 6 + 1}열, 목표 1행 6열, ${step}번 이동` : `6 by 5 map. Agent row ${Math.floor(path[step] / 6) + 1}, column ${path[step] % 6 + 1}. Goal row 1 column 6. ${step} moves.`}>
      {Array.from({ length: 30 }, (_, i) => <div key={i} className={`demo-cell ${walls.includes(i) ? 'wall' : ''} ${path.slice(0, step + 1).includes(i) ? 'visited' : ''} ${i === 5 ? 'goal' : ''} ${i === 15 ? 'penalty' : ''}`}>{i === 5 ? <><span>⚑</span><small>+10</small></> : i === 15 ? <><span>×</span><small>−5</small></> : i === 24 ? <small>S</small> : walls.includes(i) ? <span className="wall-block" /> : path.slice(0, step).includes(i) ? <span className="trail-dot" /> : null}</div>)}
      <div className="demo-agent" style={{ left: `${(path[step] % 6 + 0.5) * 100 / 6}%`, top: `${(Math.floor(path[step] / 6) + 0.5) * 100 / 5}%` }}><span>◉</span></div>
    </div>
    <div className="demo-legend">{(ko ? ['● 에이전트', '⚑ 목표', '■ 장애물', '× 위험'] : ['● Agent', '⚑ Goal', '■ Wall', '× Risk']).map(x => <span key={x}>{x}</span>)}</div>
    <div className="demo-playback"><button className="demo-play" onClick={() => { if (finished) setStep(0); setPlaying(!playing || finished) }}>{playing && !finished ? (ko ? '일시정지' : 'Pause') : (ko ? '시연 재생' : 'Play demo')}</button><button onClick={() => { setPlaying(false); setStep(value => Math.min(value + 1, path.length - 1)) }} disabled={finished}>{ko ? '한 칸 이동' : 'Step'}</button><button aria-label={ko ? '시연 초기화' : 'Reset demo'} onClick={() => { setPlaying(false); setStep(0) }}>↺</button><span>{String(step).padStart(2, '0')} <small>STEPS</small></span></div>
    <p className="demo-insight" aria-live="polite">{finished ? (ko ? '목표 도달! +10 보상. 이동마다 −0.1 비용이 있어 짧은 경로가 유리합니다.' : 'Goal reached! +10 reward. Each move costs −0.1, favoring shorter routes.') : mode === 'explore' ? (ko ? '탐색: 새로운 길을 시도하며, 같은 곳을 다시 방문하기도 합니다.' : 'Exploration: try new paths, sometimes revisiting the same state.') : (ko ? '활용: 가치가 높은 행동을 선택해 목표까지 짧게 이동합니다.' : 'Exploitation: select valuable actions for a shorter route to the goal.')}</p>
    <p className="demo-disclaimer">{ko ? '미리 정한 경로를 비교하는 애니메이션입니다. 실제 학습 결과가 아닙니다. 실제 Q-Learning·SARSA는 학습 환경에서 실행하세요.' : 'Predefined paths, not actual training results. Run real Q-Learning or SARSA in the learning environment.'}</p>
  </section>
}
