// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EnvEditor } from './EnvEditor'
import { GridWorldEnv, createDefaultGridWorldConfig } from '../../core/environments/gridworld/GridWorldEnv'
import type { GridWorldConfig } from '../../core/environments/gridworld/types'
import { translations } from '../../ui/i18n'
import { defaultDraft } from './envEditorDraft'
import { serializeEnvExport } from './envEditorIO'

beforeEach(() => vi.stubGlobal('matchMedia', (query: string) => ({ matches: /max-width: 760px/.test(query), media: query, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} })))
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

function setup(config: Partial<GridWorldConfig> = {}) {
  const apply = vi.fn()
  render(<EnvEditor fullscreen confirmApply={() => true} currentRenderModel={new GridWorldEnv({ ...createDefaultGridWorldConfig(), ...config }).getRenderModel()} onApply={apply} locale="ko" t={translations.ko} />)
  return { apply }
}
const click = (id: string) => fireEvent.click(screen.getByTestId(id))
const sheet = () => document.querySelector('#editor-properties') as HTMLElement
const selected = () => screen.getAllByRole('tab').find(tab => tab.getAttribute('aria-selected') === 'true')!.getAttribute('data-testid')
const upload = (name: string, text: string) => fireEvent.change(screen.getByTestId('env-editor-import-input'), { target: { files: [new File([text], name, { type: 'application/json' })] } })

describe('phone Settings · Files sheet', () => {
  it('has an always-visible button; opening it needs no tap on the grid and starts on Map settings', () => {
    setup()
    const bar = document.querySelector('.mobile-actions') as HTMLElement
    const button = within(bar).getByTestId('properties-toggle')
    expect(button.textContent).toBe('설정 · 파일'); expect(button.getAttribute('aria-label')).toBe('설정 · 파일')
    expect(sheet().hidden).toBe(true)
    fireEvent.click(button)
    expect(sheet().hidden).toBe(false); expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getAllByRole('tab').map(t => t.textContent)).toEqual(['맵 설정', '요소 속성', '파일'])
    expect(selected()).toBe('sheet-tab-map')
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe('sheet-tab-map')
  })
  it('Map tab holds the map settings, and nothing from the other tabs', () => {
    setup(); click('properties-toggle')
    for (const id of ['env-editor-width-input', 'env-editor-height-input', 'env-editor-step-reward-input', 'env-editor-wall-penalty-input', 'env-editor-goal-reward-input', 'env-editor-bomb-penalty-input', 'env-editor-terrain-cost-input', 'state-space-estimate']) expect(screen.getByTestId(id), id).toBeTruthy()
    for (const id of ['env-editor-import', 'env-editor-export', 'env-editor-reset', 'element-inspector', 'env-editor-import-input']) expect(screen.queryByTestId(id), id).toBeNull()
    fireEvent.change(screen.getByTestId('env-editor-terrain-cost-input'), { target: { value: '4' } })
    expect((screen.getByTestId('env-editor-apply') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/적용 \/ 플레이 불가 이유/)).toBeTruthy() // the error explanation sits in the same tab
    fireEvent.change(screen.getByTestId('env-editor-width-input'), { target: { value: '9' } })
    expect((screen.getByTestId('env-editor-width-input') as HTMLInputElement).value).toBe('9')
  })
  it('Element tab explains an empty selection and can switch to the Select tool', () => {
    setup(); click('properties-toggle'); click('sheet-tab-element')
    expect(selected()).toBe('sheet-tab-element')
    expect(screen.getByTestId('element-tab-empty').textContent).toContain('선택된 요소가 없습니다')
    click('element-tab-select-tool')
    expect(screen.getByTestId('env-editor-mode-select').getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByTestId('element-tab-empty')).toBeNull()
    expect(screen.getByTestId('element-inspector-hint')).toBeTruthy()
  })
  it('selecting an element jumps to the Element tab with its goal/bomb/swamp/portal/one-way/door properties', () => {
    setup({ goals: [{ x: 6, y: 6 }, { x: 5, y: 6 }], bombs: [{ x: 3, y: 3 }], terrains: [{ x: 1, y: 1 }], oneWays: [{ x: 2, y: 2, direction: 0 }], portals: [{ id: 'P1', ends: [{ x: 1, y: 3 }, { x: 5, y: 3 }] }], switches: [{ x: 1, y: 5, groupId: 'G1' }], toggleWalls: [{ x: 3, y: 5, groupId: 'G1' }] })
    click('properties-toggle'); expect(selected()).toBe('sheet-tab-map')
    click('env-editor-mode-select')
    const expectPanel = (cell: string, kind: string, testId: string) => { click(`cell-${cell}`); expect(selected()).toBe('sheet-tab-element'); expect(screen.getByTestId('element-inspector').getAttribute('data-kind')).toBe(kind); expect(screen.getByTestId(testId), `${kind} → ${testId}`).toBeTruthy() }
    expectPanel('5,6', 'goal', 'element-value-custom')
    expectPanel('3,3', 'bomb', 'element-value-input')
    expectPanel('1,1', 'terrain', 'element-value-input')
    expectPanel('1,3', 'portal', 'portal-one-way')
    expectPanel('2,2', 'oneWay', 'one-way-direction')
    expectPanel('3,5', 'toggleWall', 'toggle-initial-open')
    expectPanel('1,5', 'switch', 'group-id')
    expect(screen.getByTestId('element-links').textContent).toContain('(3, 5)') // the switch lists the doors it opens
  })
  it('Element tab shows tool settings for the active placement tool', () => {
    setup(); click('env-editor-mode-portal'); click('properties-toggle'); click('sheet-tab-element')
    expect(screen.getByTestId('portal-id')).toBeTruthy(); expect(screen.getByTestId('portal-directed-tool')).toBeTruthy()
    expect(screen.queryByTestId('element-tab-empty')).toBeNull()
  })
  it('Files tab exports valid v2 JSON, imports a file, rejects a bad one, and resets', async () => {
    const blobs: Blob[] = []
    vi.stubGlobal('URL', { ...URL, createObjectURL: (blob: Blob) => { blobs.push(blob); return 'blob:test' }, revokeObjectURL: () => {} })
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    setup(); click('properties-toggle'); click('sheet-tab-file')
    expect(selected()).toBe('sheet-tab-file')
    expect(screen.queryByTestId('env-editor-width-input')).toBeNull()
    click('env-editor-export')
    expect(clicked).toHaveBeenCalledOnce()
    expect(JSON.parse(await blobs[0].text())).toMatchObject({ version: 2, type: 'gridworld', width: 7, height: 7 })
    // import: a v4 map with a swamp tile reaches the draft
    upload('swamp.json', serializeEnvExport({ ...defaultDraft(), width: 5, height: 5, goals: [{ x: 4, y: 4 }], terrains: [{ x: 2, y: 2, cost: -3 }] }))
    await waitFor(() => expect(screen.getByTestId('terrain-2,2').getAttribute('data-cost')).toBe('-3'))
    expect(screen.getByTestId('cell-4,4').getAttribute('data-cell-kind')).toBe('goal') // the imported 5x5 map replaced the draft
    // import: invalid JSON leaves the draft alone and says why
    upload('broken.json', '{')
    await waitFor(() => expect(screen.getByTestId('env-editor-errors').textContent).toMatch(/JSON/))
    expect(screen.getByTestId('terrain-2,2')).toBeTruthy()
    // reset: back to the default 7x7 map
    click('env-editor-reset')
    expect(screen.queryByTestId('terrain-2,2')).toBeNull()
    expect(screen.getByTestId('cell-6,6').getAttribute('data-cell-kind')).toBe('goal')
  })
  it('refuses to export an invalid map and still reads old file versions', async () => {
    setup(); click('properties-toggle'); click('sheet-tab-map')
    fireEvent.change(screen.getByTestId('env-editor-terrain-cost-input'), { target: { value: '1' } })
    click('sheet-tab-file')
    expect((screen.getByTestId('env-editor-export') as HTMLButtonElement).disabled).toBe(true)
    for (const version of [1, 2, 3]) {
      upload(`v${version}.json`, JSON.stringify({ ...JSON.parse(serializeEnvExport(defaultDraft())), version, width: 4, height: 4, goals: [{ x: 3, y: 3 }] }))
      await waitFor(() => expect(screen.getByTestId('cell-3,3').getAttribute('data-cell-kind')).toBe('goal'))
      click('sheet-tab-map'); expect((screen.getByTestId('env-editor-width-input') as HTMLInputElement).value).toBe('4'); click('sheet-tab-file')
      click('env-editor-reset'); expect(screen.getByTestId('cell-6,6').getAttribute('data-cell-kind')).toBe('goal')
    }
  })
  it('arrow keys move between tabs (roving tabindex) and the sheet collapses, expands and closes', () => {
    setup(); click('properties-toggle')
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map(t => t.getAttribute('tabindex'))).toEqual(['0', '-1', '-1'])
    fireEvent.keyDown(tabs[0], { key: 'ArrowRight' }); expect(selected()).toBe('sheet-tab-element')
    fireEvent.keyDown(screen.getByTestId('sheet-tab-element'), { key: 'ArrowRight' }); expect(selected()).toBe('sheet-tab-file')
    fireEvent.keyDown(screen.getByTestId('sheet-tab-file'), { key: 'ArrowRight' }); expect(selected()).toBe('sheet-tab-map')
    fireEvent.keyDown(screen.getByTestId('sheet-tab-map'), { key: 'ArrowLeft' }); expect(selected()).toBe('sheet-tab-file')
    expect(sheet().getAttribute('data-sheet')).toBe('peek')
    click('sheet-handle'); expect(sheet().getAttribute('data-sheet')).toBe('expanded')
    click('sheet-handle'); expect(sheet().getAttribute('data-sheet')).toBe('peek')
    fireEvent.click(screen.getByRole('button', { name: '속성 닫기' })); expect(sheet().hidden).toBe(true)
    click('properties-toggle'); expect(selected()).toBe('sheet-tab-file') // reopens where the user left off
    fireEvent.keyDown(window, { key: 'Escape' }); expect(sheet().hidden).toBe(true)
  })
  it('keeps the large grid and the horizontal tool row when the sheet is open', () => {
    setup(); click('properties-toggle')
    expect(screen.getByTestId('tool-strip')).toBeTruthy()
    expect(screen.getAllByTestId(/^env-editor-mode-/)).toHaveLength(12)
    expect(screen.getByTestId('env-editor-grid').contains(screen.getByTestId('grid-svg'))).toBe(true)
  })
})

describe('desktop keeps its single properties panel', () => {
  it('shows map settings and the file buttons together with no tabs', () => {
    cleanup(); vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {} }))
    setup(); fireEvent.click(screen.getByRole('button', { name: '속성 / 파일' }))
    expect(screen.queryByRole('tablist')).toBeNull()
    for (const id of ['env-editor-width-input', 'env-editor-import', 'env-editor-export', 'env-editor-reset', 'env-editor-import-input']) expect(screen.getByTestId(id), id).toBeTruthy()
  })
})
