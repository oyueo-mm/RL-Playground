// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { engine } from './engine'
import { createDefaultGridWorldConfig } from '../core/environments/gridworld/GridWorldEnv'
import { TooltipButton } from './TooltipButton'
import { useDraftHistory } from './hooks/useDraftHistory'
import { defaultDraft } from '../viz/controls/envEditorDraft'
import { serializeEnvExport } from '../viz/controls/envEditorIO'

beforeEach(() => { engine.reset({ envConfig: createDefaultGridWorldConfig() }); engine.setSpeed({ mode: 'interval', intervalMs: 100000 }) })
afterEach(() => { cleanup(); engine.reset(); vi.useRealTimers(); vi.restoreAllMocks() })
const click = (id: string) => fireEvent.click(screen.getByTestId(id))
const editor = () => within(screen.getByTestId('env-editor'))
const cell = (key: string) => editor().getByTestId(`cell-${key}`)
const wall = (key: string) => cell(key).getAttribute('data-cell-kind') === 'wall'

describe('Preset and settings workflow', () => {
  it('opens presets from home and guide, preserves engine while previewing and switches analysis panels', () => {
    render(<App />)
    const before = engine.getSnapshot()
    click('nav-presets')
    expect(document.getElementById('preset-panel')).toBeTruthy()
    expect(screen.getAllByTestId(/^preset-/)).toHaveLength(16)
    click('preset-maze')
    expect(engine.getSnapshot()).toEqual(before)
    click('toggle-analysis')
    expect(document.getElementById('preset-panel')).toBeNull()
    expect(screen.getByTestId('analysis-panel').hidden).toBe(false)
    click('nav-presets')
    expect(screen.getByTestId('analysis-panel').hidden).toBe(true)
    fireEvent.keyDown(document.getElementById('preset-panel')!, { key: 'Escape' })
    click('nav-guide'); click('nav-presets')
    expect(screen.getByTestId('learning-grid').hidden).toBe(false)
    expect(engine.getSnapshot()).toEqual(before)
  })
  it('confirms real environment apply and supports cancellation', () => {
    render(<App />); click('nav-environment'); click('nav-presets'); click('preset-portalMaze')
    const before = engine.getSnapshot()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    fireEvent.click(screen.getByRole('button', { name: '맵 적용' }))
    expect(engine.getSnapshot()).toEqual(before)
    confirm.mockReturnValue(true)
    click('nav-presets'); click('preset-portalMaze'); fireEvent.click(screen.getByRole('button', { name: '맵 적용' }))
    expect(engine.getSnapshot().envRenderModel.features?.portals).toHaveLength(1)
  })
  it('loads a preset into draft only with confirmation and undo preserves the prior draft', () => {
    render(<App />); click('nav-editor')
    fireEvent.click(cell('1,1'))
    const before = engine.getSnapshot()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    click('nav-presets'); click('preset-portalMaze')
    fireEvent.click(screen.getByRole('button', { name: '편집기로 불러오기' }))
    expect(editor().getAllByTestId(/^portal-/).length).toBeGreaterThan(0)
    expect(engine.getSnapshot()).toEqual(before)
    click('editor-undo'); expect(wall('1,1')).toBe(true)
    expect(editor().queryByTestId('portal-2,3')).toBeNull()
    click('editor-redo'); expect(editor().getByTestId('portal-2,3')).toBeTruthy()
    expect(engine.getSnapshot()).toEqual(before)
  })
  it('keeps visual settings and 250 episode default across tabs and navigation', () => {
    render(<App />); click('nav-environment')
    expect((screen.getByTestId('episode-count-input') as HTMLInputElement).value).toBe('250')
    expect(screen.queryByTestId('open-map-gallery')).toBeNull()
    expect(screen.queryByRole('button', { name: '시각화' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '설정' }))
    fireEvent.click(screen.getByRole('tab', { name: '시각화 설정' }))
    expect((screen.getByTestId('toggle-policy') as HTMLInputElement).checked).toBe(true)
    click('toggle-policy'); click('nav-home'); click('nav-environment')
    expect((screen.getByTestId('toggle-policy') as HTMLInputElement).checked).toBe(false)
    fireEvent.click(screen.getByRole('tab', { name: '학습 설정' }))
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1000' } })
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '0' } })
    expect((screen.getByTestId('episode-count-input') as HTMLInputElement).value).toBe('1000')
  })
})

describe('Editor history and keyboard', () => {
  it('keeps draft undo after applying while leaving the applied live environment intact', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<App />); click('nav-editor'); fireEvent.click(cell('1,1')); click('env-editor-apply')
    const applied = engine.getSnapshot()
    expect(applied.envRenderModel.walls).toContain('1,1')
    click('editor-undo'); expect(wall('1,1')).toBe(false)
    expect(engine.getSnapshot()).toEqual(applied)
  })
  it.each(['start', 'goal', 'bomb', 'portal', 'fragile', 'switch', 'toggleWall'] as const)('undoes and redoes %s placement without changing the engine', tool => {
    render(<App />); click('nav-editor')
    const before = engine.getSnapshot()
    click(`env-editor-mode-${tool}`)
    const prior = cell('1,1').getAttribute('aria-label')
    fireEvent.click(cell('1,1'))
    const after = cell('1,1').getAttribute('aria-label')
    expect(after).not.toBe(prior)
    click('editor-undo'); expect(cell('1,1').getAttribute('aria-label')).toBe(prior)
    click('editor-redo'); expect(cell('1,1').getAttribute('aria-label')).toBe(after)
    expect(engine.getSnapshot()).toEqual(before)
  })
  it('undoes a JSON import and draft reset without applying either to the live map', async () => {
    render(<App />); click('nav-editor'); fireEvent.click(cell('1,1'))
    const before = engine.getSnapshot()
    const draft = { ...defaultDraft(), walls: [{ x: 2, y: 2 }] }
    const file = new File([serializeEnvExport(draft)], 'test.json', { type: 'application/json' })
    fireEvent.change(screen.getByTestId('env-editor-import-input'), { target: { files: [file] } })
    await waitFor(() => expect(wall('2,2')).toBe(true))
    expect(wall('1,1')).toBe(false)
    click('editor-undo'); expect(wall('1,1')).toBe(true)
    click('editor-redo'); expect(wall('2,2')).toBe(true)
    click('env-editor-reset'); expect(wall('2,2')).toBe(false)
    click('editor-undo'); expect(wall('2,2')).toBe(true)
    expect(engine.getSnapshot()).toEqual(before)
  })
  it('restores group edits, reward values and broken group links', () => {
    render(<App />); click('nav-editor'); click('env-editor-mode-switch'); fireEvent.click(cell('1,1')); click('env-editor-mode-toggleWall'); fireEvent.click(cell('2,2'))
    click('env-editor-mode-select'); fireEvent.click(cell('1,1'))
    const group = screen.getByTestId('group-id') as HTMLInputElement
    fireEvent.change(group, { target: { value: 'G2' } }); fireEvent.blur(group)
    expect((screen.getByTestId('env-editor-apply') as HTMLButtonElement).disabled).toBe(true)
    click('editor-undo'); expect(group.value).toBe('G1')
    expect((screen.getByTestId('env-editor-apply') as HTMLButtonElement).disabled).toBe(false)
    const reward = screen.getByTestId('env-editor-goal-reward-input') as HTMLInputElement
    fireEvent.change(reward, { target: { value: '12' } }); fireEvent.change(reward, { target: { value: '123' } }); fireEvent.blur(reward)
    click('editor-undo'); expect(reward.value).toBe('10')
    click('editor-redo'); expect(reward.value).toBe('123')
    fireEvent.keyDown(cell('1,1'), { key: 'Delete' })
    expect((screen.getByTestId('env-editor-apply') as HTMLButtonElement).disabled).toBe(true)
    click('editor-undo'); expect((screen.getByTestId('env-editor-apply') as HTMLButtonElement).disabled).toBe(false)
  })
  it('shows 11 tools, undoes multiple edits, clears redo on new edit and retains history after navigation', () => {
    render(<App />); click('nav-editor')
    expect(editor().getAllByTestId(/^env-editor-mode-/)).toHaveLength(11)
    expect(screen.queryByTestId('special-tools-toggle')).toBeNull()
    expect((screen.getByTestId('editor-undo') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(cell('1,1')); fireEvent.click(cell('2,2'))
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true }); expect(wall('2,2')).toBe(false)
    fireEvent.keyDown(window, { key: 'y', ctrlKey: true }); expect(wall('2,2')).toBe(true)
    click('nav-home'); click('nav-editor'); click('editor-undo'); click('editor-undo')
    expect(wall('1,1')).toBe(false)
    fireEvent.click(cell('3,3'))
    expect((screen.getByTestId('editor-redo') as HTMLButtonElement).disabled).toBe(true)
  })
  it('rotates clockwise with synced properties and undo/redo for each click', () => {
    render(<App />); click('nav-editor'); click('env-editor-mode-oneWay')
    fireEvent.click(cell('1,1'))
    for (const expected of ['1', '2', '0', '3']) { fireEvent.click(cell('1,1')); expect((screen.getByTestId('one-way-direction') as HTMLSelectElement).value).toBe(expected) }
    click('editor-undo'); expect((screen.getByTestId('one-way-direction') as HTMLSelectElement).value).toBe('0')
    click('editor-redo'); expect((screen.getByTestId('one-way-direction') as HTMLSelectElement).value).toBe('3')
  })
  it.each(['Backspace', 'Delete'])('deletes selected elements with %s, protects start and last goal, ignores inputs and inactive editor', key => {
    render(<App />); click('nav-editor'); fireEvent.click(cell('1,1')); click('env-editor-mode-select'); fireEvent.click(cell('1,1'))
    fireEvent.keyDown(screen.getByTestId('portal-id'), { key }); expect(wall('1,1')).toBe(true)
    fireEvent.keyDown(window, { key }); expect(wall('1,1')).toBe(false)
    click('editor-undo'); expect(wall('1,1')).toBe(true)
    fireEvent.click(cell('0,0')); fireEvent.keyDown(window, { key }); expect(screen.getByTestId('env-editor-errors').textContent).toContain('시작점')
    fireEvent.click(cell('6,6')); fireEvent.keyDown(window, { key }); expect(cell('6,6').getAttribute('data-cell-kind')).toBe('goal')
    fireEvent.click(cell('1,1')); click('nav-environment'); fireEvent.keyDown(window, { key }); click('nav-editor'); expect(wall('1,1')).toBe(true)
  })
  it('retains orphan portal validation after deletion and restores by undo', () => {
    render(<App />); click('nav-editor'); click('env-editor-mode-portal'); fireEvent.click(cell('1,1')); fireEvent.click(cell('2,2'))
    click('env-editor-mode-select'); fireEvent.click(cell('2,2')); fireEvent.keyDown(window, { key: 'Delete' })
    expect((screen.getByTestId('env-editor-apply') as HTMLButtonElement).disabled).toBe(true)
    click('editor-undo'); expect((screen.getByTestId('env-editor-apply') as HTMLButtonElement).disabled).toBe(false)
  })
  it('groups text/reward changes until blur and includes dimensions in history', () => {
    render(<App />); click('nav-editor')
    const width = screen.getByTestId('env-editor-width-input') as HTMLInputElement
    fireEvent.change(width, { target: { value: '10' } }); fireEvent.change(width, { target: { value: '12' } }); fireEvent.blur(width)
    click('editor-undo'); expect(width.value).toBe('7'); click('editor-redo'); expect(width.value).toBe('12')
    click('env-editor-mode-portal'); fireEvent.click(cell('1,1')); fireEvent.click(cell('2,2')); click('env-editor-mode-select'); fireEvent.click(cell('1,1'))
    const id = screen.getByTestId('portal-id') as HTMLInputElement
    fireEvent.change(id, { target: { value: 'A' } }); fireEvent.change(id, { target: { value: 'ABC' } }); fireEvent.blur(id)
    click('editor-undo'); expect(id.value).toBe('P1'); click('editor-redo'); expect(id.value).toBe('ABC')
  })
  it('bounds history at 100 and does not record no-op edits', () => {
    function Harness() { const h = useDraftHistory(() => 0); return <><output data-testid="value">{h.draft}</output><button onClick={() => h.set(n => n + 1)}>add</button><button onClick={() => h.set(n => n)}>same</button><button onClick={h.undo}>undo</button></> }
    render(<Harness />)
    fireEvent.click(screen.getByText('same'))
    for (let i = 0; i < 110; i++) fireEvent.click(screen.getByText('add'))
    for (let i = 0; i < 110; i++) fireEvent.click(screen.getByText('undo'))
    expect(screen.getByTestId('value').textContent).toBe('10')
  })
})

describe('Explanatory tooltip', () => {
  it('waits 350ms, closes on leave/click/Escape and describes disabled controls on keyboard focus', () => {
    vi.useFakeTimers()
    render(<TooltipButton disabled tip="Needs edit history">Undo</TooltipButton>)
    const wrapper = screen.getByText('Undo').parentElement!
    fireEvent.mouseEnter(wrapper); act(() => vi.advanceTimersByTime(349)); expect(screen.queryByRole('tooltip')).toBeNull()
    act(() => vi.advanceTimersByTime(1)); expect(screen.getByRole('tooltip').textContent).toBe('Needs edit history')
    fireEvent.mouseLeave(wrapper); expect(screen.queryByRole('tooltip')).toBeNull()
    fireEvent.focus(wrapper); expect(wrapper.getAttribute('aria-describedby')).toBe(screen.getByRole('tooltip').id)
    fireEvent.keyDown(window, { key: 'Escape' }); expect(screen.queryByRole('tooltip')).toBeNull()
    fireEvent.focus(wrapper); fireEvent.click(wrapper); expect(screen.queryByRole('tooltip')).toBeNull()
  })
})
