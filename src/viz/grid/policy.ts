/**
 * Tie-break rule mirrored from src/core/agents/policies/epsilonGreedy.ts's internal
 * `argmax` ("Lowest index among the maximal Q-values wins ties — deterministic,
 * testable"). That function is not exported by Core, and Phase 5 does not modify
 * src/core/** at all (including to add an export) — so this is a deliberate, minimal
 * duplication rather than a reuse of the Core function. If Core's tie-break rule ever
 * changes, this must be updated to match (see Phase 5 report "발견된 문제").
 */
export function argmaxLowestIndex(values: number[]): number {
  let bestIndex = 0
  let bestValue = values[0]
  for (let i = 1; i < values.length; i++) {
    if (values[i] > bestValue) {
      bestValue = values[i]
      bestIndex = i
    }
  }
  return bestIndex
}
