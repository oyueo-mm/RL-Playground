import { describe, expect, it } from 'vitest'
import { computeResponsiveCellSize } from './responsiveCellSize'

describe('computeResponsiveCellSize', () => {
  it('returns defaultCellSize when the grid already fits within availableHeightPx', () => {
    const result = computeResponsiveCellSize({
      defaultCellSize: 48,
      minCellSize: 24,
      gridHeightCells: 7,
      availableHeightPx: 1000,
    })
    expect(result).toBe(48)
  })

  it('shrinks below defaultCellSize when the grid would not otherwise fit', () => {
    const result = computeResponsiveCellSize({
      defaultCellSize: 48,
      minCellSize: 24,
      gridHeightCells: 20,
      availableHeightPx: 568, // matches the App.test.tsx Phase 54 fixture (700 - 92 - 40)
    })
    expect(result).toBe(28) // floor(568 / 20)
  })

  it('never returns less than minCellSize, even when the fit size would be smaller', () => {
    const result = computeResponsiveCellSize({
      defaultCellSize: 48,
      minCellSize: 24,
      gridHeightCells: 20,
      availableHeightPx: 68, // floor(68/20) = 3, well under the 24px floor
    })
    expect(result).toBe(24)
  })

  it('never returns more than defaultCellSize, even when there is abundant vertical space', () => {
    const result = computeResponsiveCellSize({
      defaultCellSize: 48,
      minCellSize: 24,
      gridHeightCells: 3,
      availableHeightPx: 4000,
    })
    expect(result).toBe(48)
  })

  it('exactly at the boundary (available height == natural full size) returns the default, not a smaller size', () => {
    const result = computeResponsiveCellSize({
      defaultCellSize: 48,
      minCellSize: 24,
      gridHeightCells: 10,
      availableHeightPx: 480, // exactly 10 * 48
    })
    expect(result).toBe(48)
  })

  it('one pixel under the boundary shrinks by exactly one cell-size unit (floor semantics)', () => {
    const result = computeResponsiveCellSize({
      defaultCellSize: 48,
      minCellSize: 24,
      gridHeightCells: 10,
      availableHeightPx: 479,
    })
    expect(result).toBe(47) // floor(479/10) = 47
  })

  it('falls back to defaultCellSize for a degenerate (non-positive) grid height', () => {
    expect(computeResponsiveCellSize({ defaultCellSize: 48, minCellSize: 24, gridHeightCells: 0, availableHeightPx: 100 })).toBe(48)
  })

  it('handles a non-square grid using only its height dimension (width handled separately by the existing CSS shrink)', () => {
    // A 3-wide, 20-tall grid: only height feeds into this function, matching how App.tsx
    // calls it (gridHeightCells = envRenderModel.height, never width).
    const result = computeResponsiveCellSize({
      defaultCellSize: 48,
      minCellSize: 24,
      gridHeightCells: 20,
      availableHeightPx: 568,
    })
    expect(result).toBe(28)
  })
})
