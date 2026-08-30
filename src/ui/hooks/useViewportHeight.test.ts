// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useViewportHeight } from './useViewportHeight'

afterEach(cleanup)

describe('useViewportHeight', () => {
  it('returns window.innerHeight on first render', () => {
    const original = window.innerHeight
    Object.defineProperty(window, 'innerHeight', { value: 812, writable: true, configurable: true })
    const { result } = renderHook(() => useViewportHeight())
    expect(result.current).toBe(812)
    Object.defineProperty(window, 'innerHeight', { value: original, writable: true, configurable: true })
  })

  it('updates when the window resizes', () => {
    const original = window.innerHeight
    Object.defineProperty(window, 'innerHeight', { value: 900, writable: true, configurable: true })
    const { result } = renderHook(() => useViewportHeight())
    expect(result.current).toBe(900)

    act(() => {
      Object.defineProperty(window, 'innerHeight', { value: 600, writable: true, configurable: true })
      window.dispatchEvent(new Event('resize'))
    })
    expect(result.current).toBe(600)

    Object.defineProperty(window, 'innerHeight', { value: original, writable: true, configurable: true })
  })
})
