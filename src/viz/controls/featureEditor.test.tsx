// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EnvEditor } from './EnvEditor'
import { GridWorldEnv, createDefaultGridWorldConfig } from '../../core/environments/gridworld/GridWorldEnv'
import { cropFeatures, validateDraft, draftFromRenderModel } from './envEditorDraft'
import { serializeEnvExport, parseEnvImport } from './envEditorIO'

afterEach(cleanup)
describe('Expanded editor', () => {
  it('places pairs, direction, fragile and group elements, blocks invalid links and supports deletion', () => {
    const apply = vi.fn()
    render(<EnvEditor fullscreen currentRenderModel={new GridWorldEnv(createDefaultGridWorldConfig()).getRenderModel()} onApply={apply} confirmApply={() => true} />)
    fireEvent.click(screen.getByTestId('env-editor-mode-portal'))
    fireEvent.click(screen.getByTestId('cell-1,1'))
    expect((screen.getByTestId('env-editor-apply') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByTestId('cell-2,2'))
    fireEvent.click(screen.getByTestId('env-editor-mode-oneWay'))
    fireEvent.change(screen.getByTestId('one-way-direction'), { target: { value: '0' } })
    fireEvent.keyDown(screen.getByTestId('cell-3,1'), { key: 'Enter' })
    fireEvent.click(screen.getByTestId('env-editor-mode-fragile'))
    fireEvent.click(screen.getByTestId('cell-4,1'))
    fireEvent.click(screen.getByTestId('env-editor-mode-switch'))
    fireEvent.click(screen.getByTestId('cell-1,3'))
    expect((screen.getByTestId('env-editor-apply') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByTestId('env-editor-mode-toggleWall'))
    fireEvent.click(screen.getByTestId('cell-2,3'))
    fireEvent.click(screen.getByTestId('env-editor-apply'))
    expect(apply).toHaveBeenCalledOnce()
    expect(apply.mock.calls[0][0]).toMatchObject({ portals: [{ id: 'P1', ends: [{ x: 1, y: 1 }, { x: 2, y: 2 }] }], oneWays: [{ x: 3, y: 1, direction: 0 }], fragiles: [{ x: 4, y: 1 }], switches: [{ x: 1, y: 3, groupId: 'G1' }] })
    fireEvent.click(screen.getByTestId('env-editor-mode-erase'))
    fireEvent.click(screen.getByTestId('cell-2,2'))
    expect((screen.getByTestId('env-editor-apply') as HTMLButtonElement).disabled).toBe(true)
  })
  it('keeps broken pair/group survivors after resize and surfaces validation', () => {
    const config = { ...createDefaultGridWorldConfig(), portals: [{ id: 'P', ends: [{ x: 1, y: 1 }, { x: 5, y: 5 }] }], switches: [{ x: 2, y: 1, groupId: 'G' }], toggleWalls: [{ x: 5, y: 1, groupId: 'G' }] }
    const draft = draftFromRenderModel(new GridWorldEnv(config).getRenderModel())
    const cropped = { ...draft, ...cropFeatures(draft, 4, 7), width: 4, goals: [{ x: 3, y: 6 }] }
    const errors = validateDraft(cropped)
    expect(cropped.portals?.[0].ends).toHaveLength(1)
    expect(errors.some(error => error.includes('two endpoints'))).toBe(true)
    expect(errors.some(error => error.includes('group'))).toBe(true)
  })
  it('accepts v1 legacy maps, rejects new fields in v1 and rejects malformed v2 fields', () => {
    const legacy = JSON.parse(serializeEnvExport(draftFromRenderModel(new GridWorldEnv(createDefaultGridWorldConfig()).getRenderModel())))
    expect(parseEnvImport(JSON.stringify({ ...legacy, version: 1 })).ok).toBe(true)
    expect(parseEnvImport(JSON.stringify({ ...legacy, version: 1, fragiles: [{ x: 1, y: 1 }] })).ok).toBe(false)
    for (const extras of [{ portals: 'P' }, { oneWays: [{ x: 1, y: 1, direction: 7 }] }, { switches: [{ x: 1, y: 1, groupId: '!' }] }, { fragiles: [{ x: .5, y: 1 }] }]) expect(parseEnvImport(JSON.stringify({ ...legacy, ...extras })).ok).toBe(false)
  })
})
