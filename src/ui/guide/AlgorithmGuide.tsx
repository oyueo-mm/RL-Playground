import { useRef, useState } from 'react'
import type { Locale } from '../i18n'
import { chapterTitles, lessons, pseudocode } from './content'
import { UpdateCalculator } from './UpdateCalculator'

export function AlgorithmGuide({ locale, onStart }: { locale: Locale; onStart: () => void }) {
  const [chapter, setChapter] = useState(0)
  const content = useRef<HTMLDivElement>(null)
  const ko = locale === 'ko'
  return <div className="guide-page" ref={content}>
    <header className="guide-heading"><span>RL / FIELD NOTES</span><h2>{ko ? '알고리즘 가이드' : 'Algorithm guide'}</h2><p>{ko ? '개념에서 계산으로, 계산에서 실험으로.' : 'From concepts to calculations to experiments.'}</p></header>
    <nav className="chapter-navigation" aria-label={ko ? '단원 목차' : 'Chapter contents'}>{chapterTitles[locale].map((title, index) => <button key={index} aria-current={chapter === index ? 'step' : undefined} aria-controls={`chapter-${index}`} onClick={() => { setChapter(index); content.current?.scrollTo?.(0, content.current.querySelector('.guide-heading')?.clientHeight ?? 0) }}><small>0{index + 1}</small>{title}</button>)}</nav>
    <article className="guide-content">
      {lessons[locale].map((lesson, index) => <section id={`chapter-${index}`} key={index} hidden={chapter !== index}>
        <span className="section-number">0{index + 1} / 06</span><h2>{chapterTitles[locale][index]}</h2><p className="lesson-intro">{lesson.intro}</p>
        {index === 0 && <><div className="transition-diagram" role="img" aria-label="State → Action → Environment → Reward and next state"><span>sₜ<br />{ko ? '상태' : 'State'}</span><b>→</b><span>aₜ<br />{ko ? '행동' : 'Action'}</span><b>→</b><span>{ko ? '환경' : 'Environment'}</span><b>→</b><span>rₜ₊₁, sₜ₊₁<br />{ko ? '피드백' : 'Feedback'}</span></div><p className="math-formula">Gₜ = Rₜ₊₁ + γRₜ₊₂ + γ²Rₜ₊₃ + …</p></>}
        {lesson.paragraphs.map((text, i) => <p key={i}>{text}</p>)}
        {index === 1 && <div className="guide-table"><table><caption>{ko ? '교육용 Q-table · 최댓값 강조' : 'Example Q-table · maxima highlighted'}</caption><thead><tr>{(ko ? ['상태', '위', '아래', '왼쪽', '오른쪽'] : ['State', 'Up', 'Down', 'Left', 'Right']).map(text => <th key={text}>{text}</th>)}</tr></thead><tbody>{[[.2, .4, -.1, .8], [-.3, .6, .1, .2]].map((row, i) => <tr key={i}><th>s{i + 1}</th>{row.map((value, a) => <td key={a} className={value === Math.max(...row) ? 'greedy-value' : ''}>{value}{value === Math.max(...row) ? ' ★' : ''}</td>)}</tr>)}</tbody></table></div>}
        {(index === 2 || index === 3) && <><p className="math-formula">Q(s,a) ← Q(s,a) + α[r + γ{index === 2 ? ' max Q(s′,·)' : 'Q(s′,a′)'} − Q(s,a)]</p><p className="math-formula">{ko ? '종료 전이' : 'Terminal'}: Q(s,a) ← Q(s,a) + α[r − Q(s,a)]</p><h3>{ko ? '한 걸음씩 따라가기' : 'Follow one step at a time'}</h3><pre>{pseudocode(ko, index === 3)}</pre></>}
        {index === 4 && <><UpdateCalculator locale={locale} /><div className="guide-table"><table><caption>{ko ? '정책과 목표의 차이' : 'Policy and target differences'}</caption><thead><tr><th>{ko ? '구분' : 'Aspect'}</th><th>Q-Learning</th><th>SARSA</th></tr></thead><tbody>{[
          [ko ? '정책' : 'Policy', 'Off-policy', 'On-policy'], [ko ? '다음 가치' : 'Next value', 'max Q(s′,·)', 'Q(s′,a′)'], [ko ? '탐험 행동' : 'Exploration', ko ? '목표는 탐욕 행동' : 'Target stays greedy', ko ? '실제 다음 행동이 목표에 반영' : 'Actual next action enters target'], [ko ? '주의' : 'Caution', ko ? '탐험 중 성과와 목표 가치 차이' : 'Behavior and target can differ', ko ? '탐험 정책에 의존' : 'Depends on behavior policy'],
        ].map(row => <tr key={row[0]}>{row.map((cell, i) => i === 0 ? <th key={i}>{cell}</th> : <td key={i}>{cell}</td>)}</tr>)}</tbody></table></div></>}
        {index === 5 && <ExplorationSlider ko={ko} />}
        <button className="primary-button" onClick={onStart}>{ko ? '실험실에서 직접 확인하기' : 'Try it in the lab'} ↗</button>
      </section>)}
      <footer className="guide-sources"><p>{ko ? '참고: Sutton & Barto (2018), 2·3·6장. 설명은 이 프로젝트의 실제 동률 처리와 종료 규칙에 맞췄습니다.' : 'Reference: Sutton & Barto (2018), Chapters 2, 3 and 6. Tie handling and termination descriptions match this app.'}</p><a href="https://msdnaa.eecs.berkeley.edu/~cs188/fa19/assets/files/SuttonBartoIPRLBook2ndEd.pdf" target="_blank" rel="noreferrer">Reinforcement Learning: An Introduction, 2nd ed.</a></footer>
    </article>
  </div>
}
function ExplorationSlider({ ko }: { ko: boolean }) {
  const [epsilon, setEpsilon] = useState(.1)
  return <section className="exploration-example"><h3>{ko ? 'ε-greedy 선택 확률' : 'ε-greedy action probabilities'}</h3><label>ε = {epsilon.toFixed(2)}<input type="range" min={0} max={1} step={.01} value={epsilon} onChange={event => setEpsilon(Number(event.target.value))} /></label><p>{ko ? '유일한 탐욕 행동이 하나인 4방향 상태의 교육용 계산입니다.' : 'Educational calculation for four actions with one unique greedy action.'}</p><div className="probability-bar"><span style={{ width: `${(1 - epsilon + epsilon / 4) * 100}%` }} /></div><p>{ko ? '탐욕 행동 확률' : 'Greedy action probability'}: 1 − ε + ε/4 = {((1 - epsilon + epsilon / 4) * 100).toFixed(1)}% · {ko ? '각 다른 행동' : 'Each other action'}: {(epsilon / 4 * 100).toFixed(1)}%</p></section>
}
