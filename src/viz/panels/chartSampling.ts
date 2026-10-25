/** Display-only sampling. Raw episode records and TD updates are never sampled. */
export const CHART_POINT_LIMIT = 800
export function plotIndices(length: number, extra: number[] = []): number[] {
  if (length <= CHART_POINT_LIMIT) return Array.from({ length }, (_, i) => i)
  const indices = new Set([0, length - 1, ...extra.filter(i => i >= 0 && i < length)])
  const stride = Math.ceil(length / (CHART_POINT_LIMIT - indices.size))
  for (let i = 0; i < length; i += stride) indices.add(i)
  return [...indices].sort((a, b) => a - b)
}
export function extent(values: number[]) {
  let min = Infinity, max = -Infinity, minIndex = -1, maxIndex = -1
  values.forEach((value, index) => { if (value < min) { min = value; minIndex = index } if (value > max) { max = value; maxIndex = index } })
  return { min, max, minIndex, maxIndex }
}
