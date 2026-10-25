import type { TurboProgress } from '../core/engine/turbo'
import type { Locale } from './i18n'
import { trainingCopy } from './trainingCopy'

export function TurboDashboard({progress:p,locale,onReset}:{progress:TurboProgress;locale:Locale;onReset:()=>void}) {
  const l=trainingCopy[locale]
  const seconds=Math.floor(p.elapsedMs/1000),elapsed=`${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`
  return <section className="turbo-dashboard" aria-label={l.title} data-testid="turbo-dashboard">
    <div className="turbo-heading"><span className="status-dot"/><h2>{l[p.state]}</h2></div>
    <p data-testid="turbo-episodes">{l.episodes} <strong>{p.completedEpisodes.toLocaleString()} / {p.targetEpisodes.toLocaleString()}</strong></p>
    <progress value={p.progress} max={1} aria-label={l.progress}/><p data-testid="turbo-progress">{(p.progress*100).toFixed(1)}%</p>
    <dl>{[[l.stepsRate,p.stepsPerSecond.toFixed(0)],[l.episodesRate,p.episodesPerSecond.toFixed(1)],[l.reward,p.recentMeanReward.toFixed(2)],[l.recentSuccess,`${(p.recentSuccessRate*100).toFixed(1)}%`],[l.elapsed,elapsed],[l.steps,p.totalSteps.toLocaleString()],[l.success,`${p.successes.toLocaleString()} (${(p.successRate*100).toFixed(1)}%)`]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <p className="turbo-scope">{l.scope} ({p.recentEpisodes})</p>
    <p>{p.active?l.locked:l.hint}</p>
    <button onClick={onReset}>{l.reset}</button>
  </section>
}
