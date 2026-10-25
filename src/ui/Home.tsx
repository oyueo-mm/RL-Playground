import { GridDemo } from './GridDemo'
import type { Locale } from './i18n'
import type { EnvironmentPreset } from '../data/presets/manifest'

export function Home({ locale, onStart, onGuide, onEditor = onStart, guideOnly = false, onExperiment }: { locale: Locale; onStart: () => void; onGuide: () => void; onEditor?: () => void; guideOnly?: boolean; onExperiment?: (preset: EnvironmentPreset) => void }) {
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
        <GridDemo locale={locale} onExperiment={onExperiment} />
      </div>
      <section className="home-feature-links" aria-label={ko ? '실험실 바로가기' : 'Explore the workspace'}>
        {[
          [ko ? '학습 환경' : 'Learning environment', ko ? 'Q-Learning·SARSA를 실행하고 정책을 관찰하세요.' : 'Run Q-Learning or SARSA and inspect their policies.', onStart],
          [ko ? '맵 편집기' : 'Map editor', ko ? '드래그와 자동 연결로 나만의 환경을 만드세요.' : 'Build a world with drag, overwrite and automatic links.', onEditor],
          [ko ? '알고리즘 가이드' : 'Algorithm guide', ko ? '여섯 단원과 계산기로 개념을 이해하세요.' : 'Learn the ideas through six chapters and a TD calculator.', onGuide],
        ].map(([title, text, action]) => <button key={String(title)} onClick={action as () => void}><strong>{String(title)} ↗</strong><span>{String(text)}</span></button>)}
      </section>
    </>}
    <footer className="home-footer"><span>RL Playground</span><span>{ko ? '탐험하고, 이해하고, 발견하세요.' : 'Explore. Understand. Discover.'}</span><span>BUILT FOR CURIOSITY ↗</span></footer>
  </div>
}
