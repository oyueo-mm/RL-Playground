import { describe, expect, it } from 'vitest'
import { defaultDraft, validateDraft, type GridEditorDraft } from './envEditorDraft'
import { draftToExportFile, ENV_EXPORT_TYPE, ENV_EXPORT_VERSION, parseEnvImport, serializeEnvExport } from './envEditorIO'

function sampleDraft(overrides: Partial<GridEditorDraft> = {}): GridEditorDraft {
  return {
    width: 4,
    height: 4,
    start: { x: 0, y: 0 },
    goals: [{ x: 3, y: 3 }],
    walls: [{ x: 1, y: 1 }],
    bombs: [{ x: 2, y: 2 }],
    stepReward: -0.1,
    wallPenalty: -1,
    goalReward: 10,
    bombPenalty: -10,
    ...overrides,
  }
}

describe('envEditorIO — draftToExportFile / serializeEnvExport', () => {
  it('draftToExportFile carries version/type plus every Draft field', () => {
    const file = draftToExportFile(sampleDraft())
    expect(file.version).toBe(ENV_EXPORT_VERSION)
    expect(file.type).toBe(ENV_EXPORT_TYPE)
    expect(file.width).toBe(4)
    expect(file.height).toBe(4)
    expect(file.start).toEqual({ x: 0, y: 0 })
    expect(file.goals).toEqual([{ x: 3, y: 3 }])
    expect(file.walls).toEqual([{ x: 1, y: 1 }])
    expect(file.bombs).toEqual([{ x: 2, y: 2 }])
    expect(file.stepReward).toBe(-0.1)
    expect(file.wallPenalty).toBe(-1)
    expect(file.goalReward).toBe(10)
    expect(file.bombPenalty).toBe(-10)
  })

  it('serializeEnvExport produces valid, re-parseable JSON', () => {
    const json = serializeEnvExport(sampleDraft())
    expect(() => JSON.parse(json)).not.toThrow()
  })
})

describe('envEditorIO — round trip (export -> import produces an identical Draft)', () => {
  it('a Draft serialized then parsed back is deeply equal to the original', () => {
    const original = sampleDraft()
    const result = parseEnvImport(serializeEnvExport(original))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.draft).toEqual(original)
  })

  it('round-trips the project default Draft too', () => {
    const original = defaultDraft()
    const result = parseEnvImport(serializeEnvExport(original))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.draft).toEqual(original)
  })

  it('round-trips a Draft with no walls/bombs (both empty arrays survive)', () => {
    const original = sampleDraft({ walls: [], bombs: [] })
    const result = parseEnvImport(serializeEnvExport(original))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.draft.walls).toEqual([])
      expect(result.draft.bombs).toEqual([])
    }
  })

  it('round-trips a Multi-Goal Draft (more than one Goal)', () => {
    const original = sampleDraft({ goals: [{ x: 3, y: 3 }, { x: 0, y: 3 }, { x: 3, y: 0 }] })
    const result = parseEnvImport(serializeEnvExport(original))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.draft.goals).toEqual(original.goals)
  })
})

describe('envEditorIO — parseEnvImport rejects invalid input', () => {
  it('rejects malformed JSON', () => {
    const result = parseEnvImport('{ not valid json')
    expect(result.ok).toBe(false)
  })

  it('rejects a JSON array (not an object)', () => {
    const result = parseEnvImport('[1, 2, 3]')
    expect(result.ok).toBe(false)
  })

  it('rejects a wrong version', () => {
    const file = { ...JSON.parse(serializeEnvExport(sampleDraft())), version: 999 }
    const result = parseEnvImport(JSON.stringify(file))
    expect(result.ok).toBe(false)
  })

  it('rejects a wrong/missing type', () => {
    const file = { ...JSON.parse(serializeEnvExport(sampleDraft())), type: 'not-gridworld' }
    const result = parseEnvImport(JSON.stringify(file))
    expect(result.ok).toBe(false)
  })

  it('rejects a non-numeric width/height', () => {
    const file = { ...JSON.parse(serializeEnvExport(sampleDraft())), width: 'four' }
    const result = parseEnvImport(JSON.stringify(file))
    expect(result.ok).toBe(false)
  })

  it('rejects an out-of-range grid size (delegates to validateDraft())', () => {
    const file = { ...JSON.parse(serializeEnvExport(sampleDraft())), width: 999, height: 999 }
    const result = parseEnvImport(JSON.stringify(file))
    expect(result.ok).toBe(false)
  })

  it('rejects a malformed Start (missing y)', () => {
    const file = { ...JSON.parse(serializeEnvExport(sampleDraft())), start: { x: 0 } }
    const result = parseEnvImport(JSON.stringify(file))
    expect(result.ok).toBe(false)
  })

  it('rejects Goals that are not an array', () => {
    const file = { ...JSON.parse(serializeEnvExport(sampleDraft())), goals: 'oops' }
    const result = parseEnvImport(JSON.stringify(file))
    expect(result.ok).toBe(false)
  })

  it('rejects an empty Goals array (delegates to validateDraft()\'s "at least one Goal" rule)', () => {
    const file = { ...JSON.parse(serializeEnvExport(sampleDraft())), goals: [] }
    const result = parseEnvImport(JSON.stringify(file))
    expect(result.ok).toBe(false)
  })

  it('rejects Start/Goal occupying the same cell (delegates to validateDraft())', () => {
    const file = { ...JSON.parse(serializeEnvExport(sampleDraft())), start: { x: 3, y: 3 }, goals: [{ x: 3, y: 3 }] }
    const result = parseEnvImport(JSON.stringify(file))
    expect(result.ok).toBe(false)
  })

  it('rejects duplicate/conflicting positions (a Wall on the Start cell)', () => {
    const file = { ...JSON.parse(serializeEnvExport(sampleDraft())), walls: [{ x: 0, y: 0 }] } // same as start
    const result = parseEnvImport(JSON.stringify(file))
    expect(result.ok).toBe(false)
  })

  it('rejects an out-of-bounds Goal', () => {
    const file = { ...JSON.parse(serializeEnvExport(sampleDraft())), goals: [{ x: 99, y: 99 }] }
    const result = parseEnvImport(JSON.stringify(file))
    expect(result.ok).toBe(false)
  })

  it('a rejected import never throws — always returns an ok:false result', () => {
    expect(() => parseEnvImport('')).not.toThrow()
    expect(() => parseEnvImport('null')).not.toThrow()
    expect(() => parseEnvImport('42')).not.toThrow()
    expect(() => parseEnvImport('"just a string"')).not.toThrow()
  })

  it('accepts a file missing optional walls/bombs (defaults to empty arrays)', () => {
    const withoutWallsBombs = JSON.parse(serializeEnvExport(sampleDraft()))
    delete withoutWallsBombs.walls
    delete withoutWallsBombs.bombs
    const result = parseEnvImport(JSON.stringify(withoutWallsBombs))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.draft.walls).toEqual([])
      expect(result.draft.bombs).toEqual([])
    }
  })

  it('every accepted result also independently satisfies validateDraft() with zero errors', () => {
    const result = parseEnvImport(serializeEnvExport(sampleDraft()))
    expect(result.ok).toBe(true)
    if (result.ok) expect(validateDraft(result.draft)).toEqual([])
  })
})
