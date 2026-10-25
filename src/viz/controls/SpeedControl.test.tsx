// @vitest-environment jsdom
import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SimulationEngine } from '../../core/engine/SimulationEngine'
import type { SpeedSetting } from '../../core/engine/Scheduler'
import { SpeedControl } from './SpeedControl'
import { sliderToSpeed, speedToSlider } from './speedSlider'
import { translations } from '../../ui/i18n'

afterEach(cleanup)

describe('Speed slider', () => {
  it('offers a labelled, bounded range and describes the actual speed', () => {
    render(<SpeedControl speed={{ mode: 'interval', intervalMs: 500 }} onChange={() => {}} />)
    const slider = screen.getByRole('slider', { name: /Speed/ })
    expect(slider.getAttribute('min')).toBe('1')
    expect(slider.getAttribute('max')).toBe('100')
    expect(slider.getAttribute('aria-valuetext')).toContain('500 ms / step')
  })

  it('updates controlled values and supports Korean labels', () => {
    function Wired() {
      const [speed, setSpeed] = useState<SpeedSetting>({ mode: 'interval', intervalMs: 200 })
      return <SpeedControl speed={speed} onChange={setSpeed} t={translations.ko} />
    }
    render(<Wired />)
    fireEvent.change(screen.getByRole('slider'), { target: { value: '100' } })
    expect(screen.getByRole('slider').getAttribute('aria-valuetext')).toBe('매우 빠름, 100 스텝 / 프레임')
    fireEvent.change(screen.getByRole('slider'), { target: { value: '82' } })
    expect((screen.getByRole('slider') as HTMLInputElement).value).toBe('82')
    expect(screen.getByRole('slider').getAttribute('aria-valuetext')).toContain('1 스텝 / 프레임')
    fireEvent.change(screen.getByRole('slider'), { target: { value: '1' } })
    expect(screen.getByRole('slider').getAttribute('aria-valuetext')).toBe('느림, 1000 ms / 스텝')
  })

  it('maps increasing positions to nondecreasing scheduler throughput across modes', () => {
    let previous = 0
    for (let value = 1; value <= 100; value++) {
      const speed = sliderToSpeed(value)
      const throughput = speed.mode === 'interval' ? 1000 / speed.intervalMs : 60 * speed.stepsPerFrame
      expect(throughput).toBeGreaterThanOrEqual(previous)
      previous = throughput
      expect(Math.abs(speedToSlider(speed) - value)).toBeLessThanOrEqual(2)
    }
    expect(sliderToSpeed(1)).toEqual({ mode: 'interval', intervalMs: 1000 })
    expect(sliderToSpeed(80)).toEqual({ mode: 'interval', intervalMs: 20 })
    expect(sliderToSpeed(81)).toEqual({ mode: 'batch', stepsPerFrame: 1 })
    expect(sliderToSpeed(100)).toEqual({ mode: 'batch', stepsPerFrame: 100 })
  })

  it('bounds external speeds and out-of-range input safely', () => {
    expect(speedToSlider({ mode: 'interval', intervalMs: 100000 })).toBe(1)
    expect(speedToSlider({ mode: 'batch', stepsPerFrame: 100000 })).toBe(100)
    expect(sliderToSpeed(-50)).toEqual(sliderToSpeed(1))
    expect(sliderToSpeed(500)).toEqual(sliderToSpeed(100))
    expect(sliderToSpeed(NaN)).toEqual(sliderToSpeed(1))
  })

  it('changes a running real Engine without resetting its experiment or stepping immediately', () => {
    const engine = new SimulationEngine()
    engine.setSpeed({ mode: 'interval', intervalMs: 100000 })
    engine.run({ episodes: 1000 })
    const before = engine.getSnapshot()
    const setSpeed = vi.spyOn(engine, 'setSpeed')
    function Wired() {
      const [speed, setSpeed] = useState(engine.getSpeed())
      return <SpeedControl speed={speed} onChange={next => { engine.setSpeed(next); setSpeed(next) }} />
    }
    render(<Wired />)
    fireEvent.change(screen.getByRole('slider'), { target: { value: '100' } })
    expect(setSpeed).toHaveBeenCalledWith({ mode: 'batch', stepsPerFrame: 100 })
    expect(engine.getSpeed()).toEqual({ mode: 'batch', stepsPerFrame: 100 })
    expect(engine.getSnapshot()).toEqual(before)
    fireEvent.change(screen.getByRole('slider'), { target: { value: '1' } })
    expect(engine.getSpeed()).toEqual({ mode: 'interval', intervalMs: 1000 })
    expect(engine.getSnapshot()).toEqual(before)
    engine.reset()
  })
})
