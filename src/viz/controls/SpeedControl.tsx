import { useId, useState } from 'react'
import type { SpeedSetting } from '../../core/engine/Scheduler'
import { translations, type Dictionary } from '../../ui/i18n'
import { sliderToSpeed, speedToSlider } from './speedSlider'

export interface SpeedControlProps {
  speed: SpeedSetting
  onChange: (speed: SpeedSetting) => void
  t?: Dictionary
}

export function SpeedControl({ speed, onChange, t = translations.en }: SpeedControlProps) {
  const id = useId()
  // Several neighboring positions can map to the same integer batch size.
  // Keep the user's exact position so ArrowRight can cross those plateaus.
  const [lastChoice, setLastChoice] = useState<{ speed: SpeedSetting; value: number } | null>(null)
  const value = lastChoice?.speed === speed ? lastChoice.value : speedToSlider(speed)
  const label = value < 30 ? t.speed.slow : value < 60 ? t.speed.normal : value < 86 ? t.speed.fast : t.speed.veryFast
  const detail = speed.mode === 'interval'
    ? `${speed.intervalMs} ${t.speed.intervalUnit}`
    : `${speed.stepsPerFrame} ${t.speed.batchUnit}`
  return <div className="speed-slider" data-testid="speed-control">
    <div className="speed-slider-heading"><label htmlFor={id}>{t.speed.label} <strong>{label}</strong></label><output htmlFor={id}>{detail}</output></div>
    <input id={id} type="range" min={1} max={100} step={1} value={value} aria-valuetext={`${label}, ${detail}`} data-testid="speed-slider" onChange={event => {
      const position = Number(event.target.value)
      const next = sliderToSpeed(position)
      setLastChoice({ speed: next, value: position })
      onChange(next)
    }} />
    <div className="speed-slider-scale" aria-hidden="true"><span>{t.speed.slow}</span><span>{t.speed.normal}</span><span>{t.speed.veryFast}</span></div>
  </div>
}
