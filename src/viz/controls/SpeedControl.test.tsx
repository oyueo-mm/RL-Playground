// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SimulationEngine } from '../../core/engine/SimulationEngine'
import type { SpeedSetting } from '../../core/engine/Scheduler'
import { SpeedControl } from './SpeedControl'

afterEach(cleanup)

describe('SpeedControl', () => {
  it('shows the current speed as the active preset', () => {
    render(<SpeedControl speed={{ mode: 'interval', intervalMs: 500 }} onChange={() => {}} />)
    expect(screen.getByTestId('speed-slow').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('speed-normal').getAttribute('aria-pressed')).toBe('false')
  })

  it('calls onChange with the exact SpeedSetting value of the clicked preset', () => {
    const onChange = vi.fn()
    render(<SpeedControl speed={{ mode: 'interval', intervalMs: 500 }} onChange={onChange} />)

    fireEvent.click(screen.getByTestId('speed-fast'))

    expect(onChange).toHaveBeenCalledTimes(1)
    const passed: SpeedSetting = onChange.mock.calls[0][0]
    expect(passed).toEqual({ mode: 'batch', stepsPerFrame: 10 })
  })

  it('reflects a batch-mode speed as active too (not just interval mode)', () => {
    render(<SpeedControl speed={{ mode: 'batch', stepsPerFrame: 100 }} onChange={() => {}} />)
    expect(screen.getByTestId('speed-very-fast').getAttribute('aria-pressed')).toBe('true')
  })

  it('connected to a real Engine, clicking a preset calls engine.setSpeed()', () => {
    const engine = new SimulationEngine()
    const setSpeedSpy = vi.spyOn(engine, 'setSpeed')

    function Wired() {
      return <SpeedControl speed={engine.getSpeed()} onChange={(speed) => engine.setSpeed(speed)} />
    }
    render(<Wired />)

    fireEvent.click(screen.getByTestId('speed-very-fast'))

    expect(setSpeedSpy).toHaveBeenCalledTimes(1)
    expect(setSpeedSpy).toHaveBeenCalledWith({ mode: 'batch', stepsPerFrame: 100 })
  })

  it('engine.setSpeed() can be called while the engine is RUNNING (no throw)', () => {
    const engine = new SimulationEngine()
    engine.run({ episodes: 1000 })
    expect(engine.getSnapshot().status).toBe('running')

    expect(() => engine.setSpeed({ mode: 'batch', stepsPerFrame: 5 })).not.toThrow()
    expect(engine.getSpeed()).toEqual({ mode: 'batch', stepsPerFrame: 5 })

    engine.pause() // avoid leaving a dangling scheduled callback after the test
  })
})
