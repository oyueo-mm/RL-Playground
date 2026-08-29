import { describe, expect, it } from 'vitest'
import { parseStateKey, toStateKey } from './stateKey'

describe('parseStateKey / toStateKey', () => {
  it('parses a plain "x,y" StateKey', () => {
    expect(parseStateKey('3,4')).toEqual({ x: 3, y: 4 })
  })

  it('toStateKey is the inverse of parseStateKey for a plain "x,y" key', () => {
    expect(toStateKey({ x: 3, y: 4 })).toBe('3,4')
    expect(parseStateKey(toStateKey({ x: 5, y: 2 }))).toEqual({ x: 5, y: 2 })
  })

  // Phase 34 Test 11 — GridWorld's real State/StateKey is now "x,y,mask" (see
  // GridWorldEnv.ts's file header). Grid-position-only consumers (PolicyOverlay,
  // ValueHeatmap, GridSvg's selection outline) still only need `{x, y}`, so
  // parseStateKey() must keep working correctly on the new, richer format without any
  // code change — this pins that forward-compatibility down as an explicit regression
  // test rather than leaving it as an untested assumption.
  describe('Phase 34 — forward compatibility with "x,y,mask" StateKeys', () => {
    it('extracts the correct position from an "x,y,mask" StateKey, ignoring the mask', () => {
      expect(parseStateKey('3,4,0')).toEqual({ x: 3, y: 4 })
      expect(parseStateKey('3,4,5')).toEqual({ x: 3, y: 4 })
      expect(parseStateKey('3,4,7')).toEqual({ x: 3, y: 4 })
    })

    it('the same position with different masks parses to the identical {x, y}', () => {
      const a = parseStateKey('1,0,1')
      const b = parseStateKey('1,0,3')
      expect(a).toEqual(b)
      expect(a).toEqual({ x: 1, y: 0 })
    })

    it('does not crash, return NaN, or return undefined for a mask-suffixed key', () => {
      const result = parseStateKey('6,6,7')
      expect(Number.isNaN(result.x)).toBe(false)
      expect(Number.isNaN(result.y)).toBe(false)
      expect(result.x).toBe(6)
      expect(result.y).toBe(6)
    })
  })
})
