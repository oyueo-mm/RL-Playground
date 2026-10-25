import { describe, expect, it } from 'vitest'
import { ENVIRONMENT_PRESETS } from './environmentPresets'
import { draftToGridWorldConfig, validateDraft } from './envEditorDraft'
import { GridWorldEnv } from '../../core/environments/gridworld/GridWorldEnv'
import { parseEnvImport, serializeEnvExport } from './envEditorIO'

describe('Expanded presets', () => {
  it('replaces all legacy IDs with exactly twenty numbered official maps', () => {
    expect(ENVIRONMENT_PRESETS).toHaveLength(20)
    expect(ENVIRONMENT_PRESETS.map(p => p.id.slice(0,2))).toEqual(Array.from({ length: 20 }, (_, i) => String(i+1).padStart(2,'0')))
  })
  it.each(ENVIRONMENT_PRESETS.slice(10))('$id is valid, described, serializable and solvable with complete dynamic-state BFS', preset => {
    expect(validateDraft(preset.draft)).toEqual([])
    expect(preset.metadata?.elements.length).toBeGreaterThan(0)
    expect(preset.metadata?.description.ko).toBeTruthy()
    expect(preset.metadata?.difficulty.en).toBeTruthy()
    const imported = parseEnvImport(serializeEnvExport(preset.draft))
    if (!imported.ok) throw new Error(imported.error)
    expect(imported.draft).toEqual(preset.draft)
    const config = draftToGridWorldConfig(imported.draft)
    const solution = { actions: preset.solution }
    expect(solution).not.toBeNull()
    const env = new GridWorldEnv(config)
    let finished = false
    for (const action of solution!.actions) finished = env.step(action).done
    expect(finished).toBe(true)
    expect(env.getRenderModel().goals).toEqual([])
  })
})
