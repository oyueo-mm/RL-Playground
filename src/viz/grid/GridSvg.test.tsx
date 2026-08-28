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
  start: '0,0',
  goal: '2,1',
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

  it('renders exactly one agent marker', () => {
    render(<GridSvg renderModel={model} />)
    expect(screen.queryByTestId('agent-marker')).not.toBeNull()
  })

  it('moves the agent marker position when agentPos changes', () => {
    const { rerender } = render(<GridSvg renderModel={model} cellSize={10} />)
    const before = screen.getByTestId('agent-marker').getAttribute('cx')

    rerender(<GridSvg renderModel={{ ...model, agentPos: '2,1' }} cellSize={10} />)
    const after = screen.getByTestId('agent-marker').getAttribute('cx')

    expect(after).not.toBe(before)
  })

  // --- Phase 4: State selection ---

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
})
