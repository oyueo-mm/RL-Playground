import type { SpeedSetting } from '../../core/engine/Scheduler'

// 1–80: 1000–20 ms/step (logarithmic). 81–100: 1–100 steps/frame.
// The boundary changes from 50 steps/s to roughly 60 steps/s on a 60 Hz display.
export function sliderToSpeed(position: number): SpeedSetting {
  const value = Math.max(1, Math.min(100, Number.isFinite(position) ? position : 1))
  return value <= 80
    ? { mode: 'interval', intervalMs: Math.round(1000 * Math.pow(0.02, (value - 1) / 79)) }
    : { mode: 'batch', stepsPerFrame: Math.round(Math.pow(100, (value - 81) / 19)) }
}

export function speedToSlider(speed: SpeedSetting): number {
  const position = speed.mode === 'interval'
    ? 1 + 79 * Math.log(Math.max(20, speed.intervalMs) / 1000) / Math.log(0.02)
    : 81 + 19 * Math.log(Math.max(1, speed.stepsPerFrame)) / Math.log(100)
  return Math.max(1, Math.min(100, Math.round(position)))
}
