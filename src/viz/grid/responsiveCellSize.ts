// Phase 54 — pure sizing math shared by App.tsx (the live Grid) and, if needed,
// EnvEditor.tsx's Draft preview: given how tall the grid is (in cells) and how much
// vertical pixel space is actually available, picks the largest cell size that still
// keeps the WHOLE grid within that budget, never smaller than `minCellSize` (so a very
// large grid on a short viewport stays legible/clickable rather than shrinking to
// near-nothing) and never larger than `defaultCellSize` (so small grids on a tall
// viewport render exactly as before — this only ever shrinks, never grows, a grid).
//
// This is intentionally a plain function (no React) — the horizontal half of
// responsive sizing already lives entirely in CSS (Phase 37/39/42's w-full + maxWidth
// wrapper, completely untouched by this Phase); this only supplies the NEW input this
// Phase adds (how tall the viewport actually is) into that same existing mechanism, by
// changing what "the grid's own natural full size" means per render.

export interface ResponsiveCellSizeOptions {
  defaultCellSize: number
  minCellSize: number
  gridHeightCells: number
  /** Vertical pixels actually available for the grid to render in, already net of
   * whatever fixed chrome (headings, margins, etc.) sits above/below it. */
  availableHeightPx: number
}

export function computeResponsiveCellSize({
  defaultCellSize,
  minCellSize,
  gridHeightCells,
  availableHeightPx,
}: ResponsiveCellSizeOptions): number {
  if (gridHeightCells <= 0) return defaultCellSize
  const fitCellSize = Math.floor(availableHeightPx / gridHeightCells)
  return Math.max(minCellSize, Math.min(defaultCellSize, fitCellSize))
}
