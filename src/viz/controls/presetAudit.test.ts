import { describe, expect, it } from 'vitest'
import auditJSON from '../../../benchmarks/results/preset-audit-usability.json?raw'
import { COMPLEX_PRESETS } from './complexPresets'
const audit = JSON.parse(auditJSON)
import { auditPreset } from './presetAudit'

describe('Open complex preset geometry', () => {
  it.each(COMPLEX_PRESETS)('$id has broad reachable space, branches and multiple goals', preset => {
    const metrics = auditPreset(preset.draft)
    expect(metrics.wallRatio).toBeLessThan(.45)
    expect(metrics.potentialReachable / (metrics.cells - metrics.walls)).toBeGreaterThan(.9)
    expect(metrics.branches).toBeGreaterThan(30)
    expect(metrics.goals).toBeGreaterThan(1)
  })
  it('keeps the checked-in audit aligned with actual presets and preserved baseline', () => {
    expect(audit.baseline).toBe('535c33d')
    expect(audit.results).toHaveLength(9)
    for (const [index, preset] of COMPLEX_PRESETS.entries()) {
      expect(audit.results[index].id).toBe(preset.id)
      expect(audit.results[index].after).toEqual(auditPreset(preset.draft))
    }
  })
})
