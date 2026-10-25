import { describe, expect, it } from 'vitest'
import { defaultDraft } from './envEditorDraft'
import { parseEnvImport, serializeEnvExport } from './envEditorIO'
import { GridWorldEnv, createDefaultGridWorldConfig } from '../../core/environments/gridworld/GridWorldEnv'

describe('Retired reward field compatibility', () => {
  it('continues to read maps with no retired field', () => { expect(parseEnvImport(serializeEnvExport(defaultDraft())).ok).toBe(true) })
  it('accepts an explicitly empty retired field', () => { expect(parseEnvImport(JSON.stringify({ ...JSON.parse(serializeEnvExport(defaultDraft())), rewardTiles: [] })).ok).toBe(true) })
  it('rejects nonempty retired data instead of silently discarding it', () => {
    const result = parseEnvImport(JSON.stringify({ ...JSON.parse(serializeEnvExport(defaultDraft())), rewardTiles: [{ x: 1, y: 1, reward: 2 }] }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('no longer supported')
  })
  it('rejects malformed retired data', () => { expect(parseEnvImport(JSON.stringify({ ...JSON.parse(serializeEnvExport(defaultDraft())), rewardTiles: null })).ok).toBe(false) })
  it('also protects the engine configuration boundary', () => { expect(() => new GridWorldEnv({ ...createDefaultGridWorldConfig(), rewardTiles: [{ x: 1, y: 1, reward: 2 }] })).toThrow('no longer supported') })
  it('does not export retired data', () => { expect(serializeEnvExport(defaultDraft())).not.toContain('rewardTiles') })
})
