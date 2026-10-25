// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { GridViewport } from './GridViewport'

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('fits actual measured width AND height, reacts to pane/sidebar resizing, and disconnects its observer', () => {
  let bounds = { width: 900, height: 500 }
  let resize = () => {}
  const disconnect = vi.fn()
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => bounds as DOMRect)
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { resize = callback }
    observe() {}
    disconnect = disconnect
  })
  const result = render(<GridViewport width={20} height={10}><span>map</span></GridViewport>)
  const drawing = screen.getByTestId('grid-stack')
  expect(drawing.style.width).toBe('892px')
  expect(drawing.style.height).toBe('446px')
  bounds = { width: 400, height: 500 }
  act(resize)
  expect(drawing.style.width).toBe('392px')
  expect(drawing.style.height).toBe('196px')
  result.unmount()
  expect(disconnect).toHaveBeenCalledTimes(1)
})
