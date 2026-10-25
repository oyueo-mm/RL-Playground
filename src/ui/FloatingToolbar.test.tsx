// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { FloatingToolbar } from './FloatingToolbar'

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('reserves measured toolbar space, updates when buttons wrap, and releases inactive observers', () => {
  let height = 48
  let measure = () => {}
  const disconnect = vi.fn()
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({ width: 600, height }) as DOMRect)
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { measure = callback }
    observe() {}
    disconnect = disconnect
  })
  const result = render(<div data-testid="stage"><FloatingToolbar label="Controls"><button>Train</button></FloatingToolbar></div>)
  expect(screen.getByTestId('stage').style.getPropertyValue('--toolbar-space')).toBe('72px')
  height = 82
  measure()
  expect(screen.getByTestId('stage').style.getPropertyValue('--toolbar-space')).toBe('106px')
  result.rerender(<div data-testid="stage"><FloatingToolbar label="Controls" active={false}><button>Train</button></FloatingToolbar></div>)
  expect(disconnect).toHaveBeenCalledTimes(1)
})
