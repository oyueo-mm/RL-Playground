import { describe, expect, it } from 'vitest'
import { niceTicks, niceTicksInDomain } from './chartTicks'

describe('niceTicks', () => {
  it('returns a single tick when min === max', () => {
    expect(niceTicks(5, 5)).toEqual([5])
  })

  it('produces round numbers for a -10..10 range', () => {
    const ticks = niceTicks(-10, 10, 4)
    expect(ticks).toContain(-10)
    expect(ticks).toContain(0)
    expect(ticks).toContain(10)
    // Every tick should be a "nice" multiple, not an arbitrary fraction.
    for (const t of ticks) {
      expect(Number.isInteger(t)).toBe(true)
    }
  })

  it('keeps the tick count small (~targetCount) even for a very large range (1..1000)', () => {
    const ticks = niceTicks(1, 1000, 5)
    expect(ticks.length).toBeLessThanOrEqual(8) // generous upper bound, never "one per unit"
    expect(ticks.length).toBeGreaterThanOrEqual(3)
  })

  it('handles a small fractional range without producing NaN/Infinity', () => {
    const ticks = niceTicks(0, 0.05, 4)
    expect(ticks.every((t) => Number.isFinite(t))).toBe(true)
  })

  it('returns an empty array for non-finite input rather than throwing', () => {
    expect(niceTicks(NaN, 10)).toEqual([])
    expect(niceTicks(0, Infinity)).toEqual([])
  })

  it('handles a negative-only range', () => {
    const ticks = niceTicks(-100, -20, 4)
    expect(ticks.every((t) => Number.isFinite(t))).toBe(true)
    expect(Math.min(...ticks)).toBeLessThanOrEqual(-100)
    expect(Math.max(...ticks)).toBeGreaterThanOrEqual(-20)
  })
})

describe('niceTicksInDomain', () => {
  it('excludes ticks that fall outside the actual [min, max] domain', () => {
    // niceTicks(-10,10) will produce niceMin/niceMax possibly beyond the tight domain;
    // pick a tight domain that clearly disqualifies extreme ticks.
    const ticks = niceTicksInDomain(-9, 9, 4)
    for (const t of ticks) {
      expect(t).toBeGreaterThanOrEqual(-9)
      expect(t).toBeLessThanOrEqual(9)
    }
  })

  it('still includes the exact min/max when they are themselves nice values', () => {
    const ticks = niceTicksInDomain(0, 10, 4)
    expect(ticks).toContain(0)
    expect(ticks).toContain(10)
  })

  it('returns at least one tick for a single-point domain', () => {
    expect(niceTicksInDomain(3, 3)).toEqual([3])
  })
})
