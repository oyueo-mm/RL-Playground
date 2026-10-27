import { GridDemo } from './GridDemo'
import type { Locale } from './i18n'
import type { EnvironmentPreset } from '../data/presets/manifest'

export function Home({ locale, onStart, onEditor, onGuide, onExperiment }: { locale: Locale; onStart: () => void; onEditor: () => void; onGuide: () => void; onExperiment?: (preset: EnvironmentPreset) => void }) {
  const ko = locale === 'ko'
  return <div className="home-page">
    <div className="hero-layout">
      <section className="hero-copy" aria-label={ko ? '소개' : 'Introduction'}>
        <h2 className={ko ? undefined : 'is-en'}>{ko ? <>강화학습<br /><span>시뮬레이터</span></> : <>Reinforcement<br /><span>learning simulator</span></>}</h2>
        <div className="hero-actions"><button className="primary-button" onClick={onStart}>{ko ? '학습 시작하기' : 'Start learning'} ↗</button><button className="secondary-button" onClick={onEditor} data-testid="home-make-map">{ko ? '맵 만들기' : 'Make a map'}</button><button className="text-button" onClick={onGuide}>{ko ? '알고리즘 알아보기' : 'Explore algorithms'} →</button></div>
      </section>
      <GridDemo locale={locale} onExperiment={onExperiment} />
    </div>
  </div>
}
