import { describe, expect, it } from 'vitest'
import auditJSON from '../../../benchmarks/results/preset-audit-usability.json?raw'
import { ENVIRONMENT_PRESETS as COMPLEX_PRESETS } from './environmentPresets'
import { parseEnvImport } from './envEditorIO'
const historicalMaps = import.meta.glob<string>('../../../docs/preset-source/json/*.json', { query: '?raw', import: 'default', eager: true })
const historicalPresets = Object.entries(historicalMaps).map(([id,raw]) => { const parsed=parseEnvImport(raw); if(!parsed.ok)throw new Error(parsed.error);return {id,draft:parsed.draft} })
const audit = JSON.parse(auditJSON)
import { auditPreset } from './presetAudit'
import catalogJSON from '../../data/presets/catalog.json?raw'

describe('Open complex preset geometry', () => {
  it.each(historicalPresets)('$id has broad reachable space, branches and multiple goals', preset => {
    const metrics = auditPreset(preset.draft, true)
    expect(metrics.wallRatio).toBeLessThan(.45)
    expect(metrics.potentialReachable / (metrics.cells - metrics.walls)).toBeGreaterThan(.9)
    expect(metrics.branches).toBeGreaterThan(30)
    expect(metrics.goals).toBeGreaterThan(1)
  })
  it('keeps the checked-in audit aligned with actual presets and preserved baseline', () => {
    expect(audit.baseline).toBe('535c33d')
    expect(audit.results).toHaveLength(9)
    const catalog = JSON.parse(catalogJSON)
    expect(COMPLEX_PRESETS).toHaveLength(30)
    for (const [index, preset] of COMPLEX_PRESETS.entries()) {
      const source = catalog[index]
      const measured = auditPreset(preset.draft)
      expect(preset.sourceFile).toBe(source.mapFile.split('/').at(-1))
      expect(measured.cells).toBe(source.width * source.height)
      expect(measured.walls).toBe(source.walls)
      expect(measured.goals).toBe(source.goals)
    }
  })
})
