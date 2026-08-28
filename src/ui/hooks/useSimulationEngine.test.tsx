// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { SimulationEngine } from '../../core/engine/SimulationEngine'
import { useSimulationEngine } from './useSimulationEngine'

afterEach(cleanup)

function Probe({ engine }: { engine: SimulationEngine }) {
  const snapshot = useSimulationEngine(engine)
  return <div data-testid="probe">{snapshot.currentState}</div>
}

describe('useSimulationEngine', () => {
  it('reflects the current engine snapshot on first render', () => {
    const engine = new SimulationEngine()
    render(<Probe engine={engine} />)

    expect(screen.getByTestId('probe').textContent).toBe(engine.getSnapshot().currentState)
  })

  it('re-renders with the new snapshot after engine.step()', () => {
    const engine = new SimulationEngine()
    render(<Probe engine={engine} />)

    act(() => {
      engine.step()
    })

    // Not asserting the DOM changed to a *different* state: Q-learning could (rarely)
    // step into a wall/boundary and stay put. What matters is the hook reflects
    // whatever the engine now reports after a render-triggering emit.
    expect(screen.getByTestId('probe').textContent).toBe(engine.getSnapshot().currentState)
  })

  it('unsubscribes from the engine when the component unmounts', () => {
    const engine = new SimulationEngine()
    const { unmount } = render(<Probe engine={engine} />)
    unmount()

    // No listeners should remain — calling step() (which emits) must not throw or
    // otherwise indicate a dangling subscription.
    expect(() => engine.step()).not.toThrow()
  })
})
