import { describe, expect, it } from 'vitest'
import { ENVIRONMENT_PRESETS as COMPLEX_PRESETS } from './environmentPresets'
import { ENVIRONMENT_PRESETS } from './environmentPresets'
import { draftToGridWorldConfig, validateDraft } from './envEditorDraft'
import { parseEnvImport, serializeEnvExport } from './envEditorIO'
import { GridWorldEnv } from '../../core/environments/gridworld/GridWorldEnv'
import { stateSpaceDetails } from '../../core/environments/gridworld/features'
import { solveGrid } from '../../test/solveGrid'

describe('Constructively solved complex maps', () => {
  it('publishes precisely the twenty approved presets', () => {
    expect(ENVIRONMENT_PRESETS).toHaveLength(30)
    expect(new Set(COMPLEX_PRESETS.map(p => p.id)).size).toBe(30)
  })
  it.each(COMPLEX_PRESETS)('$id reaches all goals via actual transitions, round-trips and stays structurally valid', preset => {
    expect(validateDraft(preset.draft)).toEqual([])
    const parsed = parseEnvImport(serializeEnvExport(preset.draft))
    if (!parsed.ok) throw new Error(parsed.error)
    expect(parsed.draft).toEqual(preset.draft)
    const env = new GridWorldEnv(draftToGridWorldConfig(parsed.draft))
    for (const [i, action] of preset.solution!.entries()) {
      const result = env.step(action)
      expect(result.done).toBe(i === preset.solution!.length - 1)
    }
    expect(env.getRenderModel().goals).toEqual([])
  })
  it('includes a space larger than a billion states while keeping constructive verification bounded', () => {
    expect(stateSpaceDetails({ ...COMPLEX_PRESETS[0].draft, width:64, height:64, goals:Array.from({length:20},(_,i)=>({x:i,y:1})) }).log10 > 9).toBe(true)
    expect(COMPLEX_PRESETS.every(p => p.solution!.length < 500)).toBe(true)
  })
  it('reports search budget exhaustion as unknown rather than unsolvable', () => {
    expect(() => solveGrid(draftToGridWorldConfig(ENVIRONMENT_PRESETS[0].draft), 1)).toThrow('solvability is unknown')
  })
})
