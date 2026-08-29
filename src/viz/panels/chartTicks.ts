// Phase 28 §7 — shared "nice round number" tick computation for RewardChart.tsx and
// LearningProgress.tsx's numeric axis labels. Pure math, no rendering, no React — kept as
// its own tiny module (rather than duplicated in both files) since tick math is genuinely
// reusable and carries no chart-specific identity, unlike each file's own SVG layout/
// padding (which stays intentionally separate, per each file's established Phase 19/25
// reasoning for not sharing rendering code between them).
//
// Standard "nice numbers" algorithm (the same idea most charting libraries use): pick a
// step size that is 1/2/5/10 × a power of ten, close to (range / targetCount), so ticks
// land on round values like -10/-5/0/5/10 instead of an arbitrary division of the range.
// This also naturally keeps the tick COUNT small (~targetCount) regardless of how large
// the data range is — an Episode axis spanning 1..1000 still only gets ~5 ticks, not one
// per Episode, satisfying "tick이 무리하게 겹치지 않도록" without any separate density logic.

export function niceTicks(min: number, max: number, targetCount = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return []
  if (min === max) return [min]

  const range = max - min
  const roughStep = range / Math.max(1, targetCount)
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)))
  const residual = roughStep / magnitude

  let niceResidual: number
  if (residual > 5) niceResidual = 10
  else if (residual > 2) niceResidual = 5
  else if (residual > 1) niceResidual = 2
  else niceResidual = 1

  const step = niceResidual * magnitude
  const niceMin = Math.floor(min / step) * step
  const niceMax = Math.ceil(max / step) * step

  const ticks: number[] = []
  for (let v = niceMin; v <= niceMax + step * 0.5; v += step) {
    // Snap away from float accumulation noise (e.g. 0.30000000000000004).
    ticks.push(Math.round(v / step) * step)
  }
  return ticks
}

/**
 * Ticks clipped to the actual data domain [min, max] — used for axis LABELS so a
 * nice-but-out-of-range tick (niceTicks() intentionally extends slightly past the data
 * for round numbers) never renders outside the plotted area. Point positions themselves
 * are still computed from the real (unrounded) min/max elsewhere — this only affects
 * which tick labels are drawn.
 */
export function niceTicksInDomain(min: number, max: number, targetCount = 4): number[] {
  return niceTicks(min, max, targetCount).filter((v) => v >= min - 1e-9 && v <= max + 1e-9)
}
