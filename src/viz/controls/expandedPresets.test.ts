import { describe, expect, it } from 'vitest'
import { ENVIRONMENT_PRESETS } from './environmentPresets'
import { draftToGridWorldConfig, validateDraft } from './envEditorDraft'
import { solveGrid } from '../../test/solveGrid'
import { GridWorldEnv } from '../../core/environments/gridworld/GridWorldEnv'
import { parseEnvImport, serializeEnvExport } from './envEditorIO'

describe('Expanded presets', () => {
  it('preserves the original eleven IDs and adds exactly the five requested presets', () => {
    expect(ENVIRONMENT_PRESETS.slice(0, 11).map(preset => preset.id)).toEqual(['basic', 'corridor', 'maze', 'bombField', 'multiGoal', 'treasureHunt', 'obstacleCourse', 'complexMaze', 'deadEndMaze', 'multipleRoute', 'riskyPath'])
    expect(ENVIRONMENT_PRESETS.slice(11, 16).map(preset => preset.id)).toEqual(['portalMaze', 'oneWayLabyrinth', 'fragileBridge', 'switchPuzzle', 'mixedChallenge'])
  })
  it.each(ENVIRONMENT_PRESETS.slice(11, 16))('$id is valid, described, serializable and solvable with complete dynamic-state BFS', preset => {
    expect(validateDraft(preset.draft)).toEqual([])
    expect(preset.metadata?.elements.length).toBeGreaterThan(0)
    expect(preset.metadata?.description.ko).toBeTruthy()
    expect(preset.metadata?.difficulty.en).toBeTruthy()
    const imported = parseEnvImport(serializeEnvExport(preset.draft))
    if (!imported.ok) throw new Error(imported.error)
    expect(imported.draft).toEqual(preset.draft)
    const config = draftToGridWorldConfig(imported.draft)
    const solution = solveGrid(config)
    expect(solution).not.toBeNull()
    const env = new GridWorldEnv(config)
    let finished = false
    for (const action of solution!.actions) finished = env.step(action).done
    expect(finished).toBe(true)
    expect(env.getRenderModel().goals).toEqual([])
  })
})
