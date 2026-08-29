// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EnvRenderModel } from '../../core/types/render'
import { GridSvg } from './GridSvg'

afterEach(cleanup)

const model: Extract<EnvRenderModel, { kind: 'grid' }> = {
  kind: 'grid',
  width: 3,
  height: 2,
  walls: ['1,0'],
  bombs: [],
  bombPenalty: -10,
  start: '0,0',
  goals: ['2,1'],
  agentPos: '0,0',
}

describe('GridSvg', () => {
  it('renders exactly one cell per grid position', () => {
    render(<GridSvg renderModel={model} />)
    expect(screen.getAllByTestId(/^cell-/)).toHaveLength(model.width * model.height)
  })

  it('marks the wall cell distinctly from ordinary cells', () => {
    render(<GridSvg renderModel={model} />)
    expect(screen.getByTestId('cell-1,0').getAttribute('data-cell-kind')).toBe('wall')
    expect(screen.getByTestId('cell-1,1').getAttribute('data-cell-kind')).toBe('empty')
  })

  it('marks the start cell', () => {
    render(<GridSvg renderModel={model} />)
    expect(screen.getByTestId('cell-0,0').getAttribute('data-cell-kind')).toBe('start')
  })

  it('marks the goal cell', () => {
    render(<GridSvg renderModel={model} />)
    expect(screen.getByTestId('cell-2,1').getAttribute('data-cell-kind')).toBe('goal')
  })

  it('marks every cell in a multi-Goal renderModel as a goal cell (Phase 30)', () => {
    const multiGoalModel = { ...model, goals: ['1,1', '2,1'] }
    render(<GridSvg renderModel={multiGoalModel} />)
    expect(screen.getByTestId('cell-1,1').getAttribute('data-cell-kind')).toBe('goal')
    expect(screen.getByTestId('cell-2,1').getAttribute('data-cell-kind')).toBe('goal')
  })

  it('renders exactly one agent marker', () => {
    render(<GridSvg renderModel={model} />)
    expect(screen.queryByTestId('agent-marker')).not.toBeNull()
  })

  // Phase 37 — the agent-marker <circle> previously had no pointerEvents="none", so a
  // real browser's hit-test would resolve it (not the cell <rect> beneath) as the click
  // target for whichever cell the Agent currently occupies, silently swallowing the
  // click. jsdom has no real layout/hit-testing engine (elementFromPoint is not
  // implemented), so a coordinate-based click-through cannot be verified here — these
  // checks cover what jsdom CAN verify (the attribute is actually set to "none", not
  // merely present as a differently-valued attribute, and the cell's own click handler
  // keeps working normally with the marker sitting on top of it); the actual real-browser
  // click-through behavior is verified separately via production-build Playwright
  // verification (see the Phase 37 report).
  describe('Phase 37 — agent-marker does not intercept cell clicks', () => {
    it('the agent-marker has pointerEvents set to "none"', () => {
      render(<GridSvg renderModel={model} />)
      expect(screen.getByTestId('agent-marker').getAttribute('pointer-events')).toBe('none')
    })

    it('a cell the Agent currently occupies is still clickable for selection (Start, agentPos "0,0")', () => {
      const onStateSelect = vi.fn()
      render(<GridSvg renderModel={model} onStateSelect={onStateSelect} />)

      fireEvent.click(screen.getByTestId('cell-0,0'))

      expect(onStateSelect).toHaveBeenCalledWith('0,0')
    })

    it('a cell the Agent does NOT occupy is unaffected (regression baseline)', () => {
      const onStateSelect = vi.fn()
      render(<GridSvg renderModel={model} onStateSelect={onStateSelect} />)

      fireEvent.click(screen.getByTestId('cell-1,1'))

      expect(onStateSelect).toHaveBeenCalledTimes(1)
      expect(onStateSelect).toHaveBeenCalledWith('1,1')
    })

    it('clicking the cell the Agent occupies fires selection exactly once (no duplicate event from the marker)', () => {
      const onStateSelect = vi.fn()
      render(<GridSvg renderModel={model} onStateSelect={onStateSelect} />)

      fireEvent.click(screen.getByTestId('cell-0,0'))

      expect(onStateSelect).toHaveBeenCalledTimes(1)
    })
  })

  it('moves the agent marker position when agentPos changes', () => {
    const { rerender } = render(<GridSvg renderModel={model} cellSize={10} />)
    const before = screen.getByTestId('agent-marker').getAttribute('cx')

    rerender(<GridSvg renderModel={{ ...model, agentPos: '2,1' }} cellSize={10} />)
    const after = screen.getByTestId('agent-marker').getAttribute('cx')

    expect(after).not.toBe(before)
  })

  // --- Phase 4: State selection ---

  // Phase 37 — the new className prop (used by App.tsx for responsive sizing, see the
  // Phase 37 report). Optional/undefined by default so EnvEditor.tsx's Draft preview
  // (which never passes it) renders exactly as before.
  it('forwards an optional className to the root <svg>, and renders without one by default', () => {
    const { rerender } = render(<GridSvg renderModel={model} />)
    expect(screen.getByTestId('grid-svg').getAttribute('class')).toBeNull()

    rerender(<GridSvg renderModel={model} className="block h-auto w-full" />)
    expect(screen.getByTestId('grid-svg').getAttribute('class')).toBe('block h-auto w-full')
  })

  it('renders without a selection callback (stays non-interactive when omitted)', () => {
    expect(() => render(<GridSvg renderModel={model} />)).not.toThrow()
    expect(screen.getAllByTestId(/^cell-/)).toHaveLength(model.width * model.height)
  })

  it('calls onStateSelect with the exact StateKey of the clicked cell', () => {
    const onStateSelect = vi.fn()
    render(<GridSvg renderModel={model} onStateSelect={onStateSelect} />)

    fireEvent.click(screen.getByTestId('cell-2,1'))

    expect(onStateSelect).toHaveBeenCalledTimes(1)
    expect(onStateSelect).toHaveBeenCalledWith('2,1')
  })

  it('calls onStateSelect for a plain (non-wall/start/goal) cell too', () => {
    const onStateSelect = vi.fn()
    render(<GridSvg renderModel={model} onStateSelect={onStateSelect} />)

    fireEvent.click(screen.getByTestId('cell-1,1'))

    expect(onStateSelect).toHaveBeenCalledWith('1,1')
  })

  it('shows a selection outline for the selectedState prop, and only one', () => {
    render(<GridSvg renderModel={model} selectedState="1,1" />)
    expect(screen.getAllByTestId('selected-cell-outline')).toHaveLength(1)
  })

  it('shows no selection outline when selectedState is null', () => {
    render(<GridSvg renderModel={model} selectedState={null} />)
    expect(screen.queryByTestId('selected-cell-outline')).toBeNull()
  })

  it('existing Wall/Start/Goal/Agent rendering is unaffected by selection support', () => {
    render(<GridSvg renderModel={model} selectedState="1,1" onStateSelect={() => {}} />)
    expect(screen.getByTestId('cell-1,0').getAttribute('data-cell-kind')).toBe('wall')
    expect(screen.getByTestId('cell-0,0').getAttribute('data-cell-kind')).toBe('start')
    expect(screen.getByTestId('cell-2,1').getAttribute('data-cell-kind')).toBe('goal')
    expect(screen.queryByTestId('agent-marker')).not.toBeNull()
  })

  // Phase 20 — Bomb cells
  describe('Bomb', () => {
    const modelWithBomb: Extract<EnvRenderModel, { kind: 'grid' }> = { ...model, bombs: ['1,1'] }

    it('marks a bomb cell distinctly from ordinary/wall/start/goal cells', () => {
      render(<GridSvg renderModel={modelWithBomb} />)
      expect(screen.getByTestId('cell-1,1').getAttribute('data-cell-kind')).toBe('bomb')
      // Untouched cells from `model` still resolve exactly as before.
      expect(screen.getByTestId('cell-1,0').getAttribute('data-cell-kind')).toBe('wall')
      expect(screen.getByTestId('cell-0,0').getAttribute('data-cell-kind')).toBe('start')
    })

    it('renders a visible bomb glyph on top of the bomb cell', () => {
      render(<GridSvg renderModel={modelWithBomb} />)
      expect(screen.getByTestId('bomb-marker-1,1')).toBeTruthy()
    })

    it('does not render a bomb glyph on non-bomb cells', () => {
      render(<GridSvg renderModel={modelWithBomb} />)
      expect(screen.queryByTestId('bomb-marker-0,0')).toBeNull()
      expect(screen.queryByTestId('bomb-marker-1,0')).toBeNull()
    })

    it('a bomb cell is still clickable for selection (the glyph does not intercept clicks)', () => {
      const onStateSelect = vi.fn()
      render(<GridSvg renderModel={modelWithBomb} onStateSelect={onStateSelect} />)

      fireEvent.click(screen.getByTestId('cell-1,1'))

      expect(onStateSelect).toHaveBeenCalledWith('1,1')
    })
  })
})
