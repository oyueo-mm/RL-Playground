import { useEffect, useRef, useState } from 'react'
import type { EngineSnapshot } from '../../core/engine/types'
import { translations, type Locale } from '../../ui/i18n'

const formatReward = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(Number(value.toFixed(3)))}`

/** One sampled transition per UI publication; no per-engine-step DOM allocation. */
export function RewardVisualization({ snapshot, locale, live = false, legend = false, map = false, animate = false }: {
  snapshot: EngineSnapshot; locale: Locale; live?: boolean; legend?: boolean; map?: boolean; animate?: boolean
}) {
  const t = translations[locale].rewards
  const model = snapshot.envRenderModel
  const transition = snapshot.lastTransition
  const [visible, setVisible] = useState(false)
  const svg = useRef<SVGSVGElement>(null)
  const [legible, setLegible] = useState(false)
  useEffect(() => {
    if (!map || !svg.current || typeof ResizeObserver === 'undefined') return
    const element = svg.current
    const update = () => setLegible(element.getBoundingClientRect().width / model.width >= 28)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [map, model.width])
  useEffect(() => {
    if (!animate || !transition) { setVisible(false); return }
    setVisible(true)
    const timer = window.setTimeout(() => setVisible(false), 650)
    return () => window.clearTimeout(timer)
  }, [transition, animate])
  if (live || legend) return <div className="reward-readout" data-testid="reward-readout">
    {live && <><span>{t.last}: <strong data-testid="last-reward">{transition ? formatReward(transition.reward) : '—'}</strong></span><span>{t.episode}: <strong data-testid="episode-reward">{formatReward(snapshot.stats.episodeLength === 0 && transition && (transition.done || transition.truncated) ? snapshot.stats.latestEpisodeStats?.totalReward ?? 0 : snapshot.stats.episodeReward)}</strong></span>
      {snapshot.stats.latestEpisodeStats && <span>{t.completed}: {formatReward(snapshot.stats.latestEpisodeStats.totalReward)}</span>}</>}
    {legend && <small>Goal: {formatReward(model.goalReward ?? 0)} · Bomb: {formatReward(model.bombPenalty)} · {t.step}: {formatReward(model.stepReward ?? 0)} · {t.wall}: {formatReward(model.wallPenalty ?? 0)} · {t.firstGoal}</small>}
  </div>
  if (!map && !animate) return null
  const [x, y] = (transition?.nextState ?? model.agentPos).split(',').map(Number)
  return <svg ref={svg} className="stage-overlay reward-overlay" viewBox={`0 0 ${model.width * 48} ${model.height * 48}`} aria-label={t.map}>
    {map && legible && <g className="map-reward-numbers" data-testid="map-rewards">{[...model.goals.map(pos => ({pos, value:model.goalReward ?? 0})), ...model.bombs.map(pos => ({pos, value:model.bombPenalty}))].map(({pos,value}) => {
      const [gx,gy] = pos.split(',').map(Number)
      return <text key={pos} x={(gx+.5)*48} y={(gy+.91)*48} textAnchor="middle" fontSize="12" fill={value >= 0 ? '#135c32' : '#91281c'}>{formatReward(value)}</text>
    })}</g>}
    {animate && visible && transition && <text key={snapshot.resources?.totalSteps} className="reward-float" data-testid="reward-animation" x={(x+.5)*48} y={(y+.25)*48} textAnchor="middle" fontSize="18" fontWeight="bold" fill={transition.reward >= 0 ? '#135c32' : '#91281c'} stroke="white" strokeWidth="3" paintOrder="stroke">{formatReward(transition.reward)}</text>}
  </svg>
}
