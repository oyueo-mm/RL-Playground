import { useState } from 'react'
import type { Locale } from '../i18n'

import { calculateUpdate } from './calculateUpdate'
export function UpdateCalculator({ locale }: { locale: Locale }) {
  const ko = locale === 'ko'
  const [values, setValues] = useState({ q: 2, reward: -1, alpha: .5, gamma: .9, max: 4, selected: 1 })
  const [terminal, setTerminal] = useState(false)
  const labels = { q: 'Q(s,a)', reward: ko ? '보상 r' : 'Reward r', alpha: 'α', gamma: 'γ', max: 'max Q(s′,·)', selected: 'Q(s′,a′)' }
  return <section className="update-calculator" aria-label={ko ? '교육용 업데이트 계산기' : 'Educational update calculator'}>
    <h3>{ko ? '같은 경험, 두 가지 업데이트' : 'One experience, two updates'}</h3>
    <p>{ko ? '교육용 예제 · 실제 학습 데이터와 독립적입니다.' : 'Educational example · independent of actual training data.'}</p>
    <div className="calculator-inputs">{(Object.keys(values) as (keyof typeof values)[]).map(key => <label key={key}>{labels[key]}<input aria-label={labels[key]} type={key === 'alpha' || key === 'gamma' ? 'range' : 'number'} min={key === 'alpha' || key === 'gamma' ? 0 : -1000} max={key === 'alpha' ? 1 : key === 'gamma' ? 2 : 1000} step={.01} value={values[key]} onChange={event => { const value = Number(event.target.value); if (Number.isFinite(value) && value >= (key === 'alpha' || key === 'gamma' ? 0 : -1000) && value <= (key === 'alpha' ? 1 : key === 'gamma' ? 2 : 1000)) setValues(previous => ({ ...previous, [key]: value })) }} /><output>{values[key]}</output></label>)}</div>
    <label><input type="checkbox" checked={terminal} onChange={event => setTerminal(event.target.checked)} />{ko ? '종료 전이: 미래 가치 제외' : 'Terminal transition: omit future value'}</label>
    {values.selected > values.max && <p role="status">{ko ? '선택 Q값이 최대 Q값보다 큽니다. 일관된 예제를 위해 조정하세요.' : 'Selected Q exceeds the maximum. Adjust for a consistent example.'}</p>}
    <div className="calculation-results">{[['Q-Learning', values.max], ['SARSA', values.selected]].map(([name, next]) => {
      const result = calculateUpdate(values.q, values.reward, values.alpha, values.gamma, Number(next), terminal)
      return <article key={name}><h4>{name}</h4><p>{ko ? '목표' : 'Target'} = {values.reward} + {terminal ? '0' : `${values.gamma} × ${next}`} = {result.target.toFixed(2)}</p><p>δ = {result.target.toFixed(2)} − {values.q} = {result.error.toFixed(2)}</p><p>Q ← {values.q} + {values.alpha} × ({result.error.toFixed(2)})</p><output data-testid={name === 'SARSA' ? 'sarsa-result' : 'qlearning-result'}>{result.updated.toFixed(2)}</output></article>
    })}</div>
  </section>
}
