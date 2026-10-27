// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EnvEditor } from './EnvEditor'
import { cyclePortalAt } from './editorOperations'
import { defaultDraft } from './envEditorDraft'
import { draftToExportFile, parseEnvImport, serializeEnvExport } from './envEditorIO'
import { GridWorldEnv, createDefaultGridWorldConfig } from '../../core/environments/gridworld/GridWorldEnv'
import type { GridWorldConfig } from '../../core/environments/gridworld/types'
import { ManualPlay } from '../../ui/ManualPlay'
import { translations } from '../../ui/i18n'

class FakePointerEvent extends MouseEvent {
  pointerId: number; pointerType: string
  constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerId = init.pointerId ?? 1; this.pointerType = init.pointerType ?? 'mouse' }
}
beforeEach(() => vi.stubGlobal('PointerEvent', FakePointerEvent))
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

function setup(config: Partial<GridWorldConfig> = {}, props: Partial<Parameters<typeof EnvEditor>[0]> = {}) {
  const apply = vi.fn()
  render(<EnvEditor fullscreen confirmApply={() => true} currentRenderModel={new GridWorldEnv({ ...createDefaultGridWorldConfig(), ...config }).getRenderModel()} onApply={apply} locale="ko" t={translations.ko} {...props} />)
  const svg = screen.getByTestId('grid-svg')
  vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, width: 700, height: 700, right: 700, bottom: 700, toJSON: () => ({}) })
  return { apply, svg }
}
const click = (id: string) => fireEvent.click(screen.getByTestId(id))
const at = (x: number, y: number, init: PointerEventInit = {}) => ({ clientX: x * 100 + 50, clientY: y * 100 + 50, button: 0, ...init })
const role = (key: string) => screen.getByTestId(`portal-${key}`).getAttribute('data-portal-role')
const pair = () => { const { apply } = setup(); return apply }
const placePair = () => { click('env-editor-mode-portal'); click('cell-1,1'); click('cell-5,1') }
const dirOf = (apply: ReturnType<typeof vi.fn>) => { click('env-editor-apply'); return apply.mock.calls.at(-1)![0].portals }

describe('portal click states (pure operation)', () => {
  const two = () => ({ ...defaultDraft(), portals: [{ id: 'P1', ends: [{ x: 1, y: 1 }, { x: 5, y: 1 }] }] })
  it('follows A↔B → B→A → A→B → A↔B, always making the clicked end the destination', () => {
    const A = { x: 1, y: 1 }, B = { x: 5, y: 1 }
    let d = cyclePortalAt(two(), A)
    expect(d.portals).toEqual([{ id: 'P1', ends: [B, A], directed: true }]) // A is the destination: B → A
    d = cyclePortalAt(d, B)
    expect(d.portals).toEqual([{ id: 'P1', ends: [A, B], directed: true }]) // B clicked: A → B
    d = cyclePortalAt(d, B)
    expect(d.portals).toEqual([{ id: 'P1', ends: [A, B] }]) // clicking the destination again: two-way
    expect(cyclePortalAt(d, B).portals).toEqual([{ id: 'P1', ends: [A, B], directed: true }].map(p => ({ ...p, ends: [A, B] })))
  })
  it('leaves incomplete pairs and unrelated cells alone and never duplicates an end', () => {
    const half = { ...defaultDraft(), portals: [{ id: 'P1', ends: [{ x: 1, y: 1 }] }] }
    expect(cyclePortalAt(half, { x: 1, y: 1 })).toBe(half)
    expect(cyclePortalAt(two(), { x: 3, y: 3 })).toEqual(two())
    const other = { ...two(), portals: [...two().portals, { id: 'Q', ends: [{ x: 2, y: 4 }, { x: 4, y: 4 }] }] }
    expect(cyclePortalAt(other, { x: 2, y: 4 }).portals?.[0]).toEqual(two().portals[0]) // only the clicked pair changes
    expect(cyclePortalAt(other, { x: 2, y: 4 }).portals?.[1]).toEqual({ id: 'Q', ends: [{ x: 4, y: 4 }, { x: 2, y: 4 }], directed: true })
  })
})

describe('portal click states in the editor', () => {
  it('cycles on plain clicks even when the tool is set to a different portal ID', () => {
    const apply = pair(); placePair()
    fireEvent.change(screen.getByTestId('portal-id'), { target: { value: 'ZZ' } })
    click('cell-1,1')
    expect(role('1,1')).toBe('exit'); expect(role('5,1')).toBe('entrance') // B → A: A is the destination
    expect(dirOf(apply)).toEqual([{ id: 'P1', ends: [{ x: 5, y: 1 }, { x: 1, y: 1 }], directed: true }])
    click('cell-5,1')
    expect(role('5,1')).toBe('exit'); expect(role('1,1')).toBe('entrance')
    click('cell-5,1')
    expect(role('1,1')).toBeNull(); expect(role('5,1')).toBeNull()
    expect(screen.getAllByTestId(/^portal-\d/)).toHaveLength(2) // still exactly two ends
  })
  it('one mouse click = one transition (pointer stroke plus trailing click is not a double toggle)', () => {
    const apply = pair(); const { svg } = { svg: screen.getByTestId('grid-svg') }; placePair()
    fireEvent.pointerDown(screen.getByTestId('cell-1,1'), at(1, 1)); fireEvent.pointerUp(svg, at(1, 1)); fireEvent.click(screen.getByTestId('cell-1,1'))
    expect(role('1,1')).toBe('exit')
    fireEvent.pointerDown(screen.getByTestId('cell-1,1'), at(1, 1)); fireEvent.pointerUp(svg, at(1, 1)); fireEvent.click(screen.getByTestId('cell-1,1'))
    expect(role('1,1')).toBeNull() // exactly one more step: destination clicked → two-way
    click('editor-undo'); expect(role('1,1')).toBe('exit') // one undo per click
    expect(dirOf(apply)).toEqual([{ id: 'P1', ends: [{ x: 5, y: 1 }, { x: 1, y: 1 }], directed: true }])
  })
  it('touch taps and keyboard activation each advance one state', () => {
    pair(); const svg = screen.getByTestId('grid-svg'); placePair()
    fireEvent.pointerDown(screen.getByTestId('cell-5,1'), at(5, 1, { pointerType: 'touch', pointerId: 3 })); fireEvent.pointerUp(svg, at(5, 1, { pointerType: 'touch', pointerId: 3 })); fireEvent.click(screen.getByTestId('cell-5,1'))
    expect(role('5,1')).toBe('exit') // A → B
    fireEvent.keyDown(screen.getByTestId('cell-5,1'), { key: 'Enter' })
    expect(role('5,1')).toBeNull()
    fireEvent.keyDown(screen.getByTestId('cell-1,1'), { key: ' ' })
    expect(role('1,1')).toBe('exit')
  })
  it('does not add or remove ends when clicking the only end of an unfinished pair', () => {
    pair(); click('env-editor-mode-portal'); click('cell-1,1'); click('cell-1,1'); click('cell-1,1')
    expect(screen.getAllByTestId(/^portal-\d/)).toHaveLength(1)
    expect((screen.getByTestId('env-editor-apply') as HTMLButtonElement).disabled).toBe(true)
  })
  it('keeps the inspector direction controls and the new click states consistent', () => {
    pair(); placePair(); click('cell-5,1') // A → B
    click('env-editor-mode-select'); click('cell-5,1')
    expect(screen.getByTestId('portal-exit').textContent).toContain('B')
    click('portal-flip'); expect(role('1,1')).toBe('exit')
    click('portal-two-way'); expect(role('1,1')).toBeNull()
    click('portal-one-way'); expect(role('5,1')).toBe('entrance') // the flipped order [B-cell, A-cell] is kept: (5,1) → (1,1)
    expect(role('1,1')).toBe('exit')
  })
  it('keeps moves, deletes and undo/redo of an end consistent with the pair', () => {
    const apply = pair(); const svg = screen.getByTestId('grid-svg'); placePair(); click('cell-5,1') // A → B
    click('env-editor-mode-select')
    fireEvent.pointerDown(screen.getByTestId('cell-5,1'), at(5, 1)); fireEvent.pointerMove(svg, at(6, 3)); fireEvent.pointerUp(svg, at(6, 3))
    expect(role('6,3')).toBe('exit'); expect(role('1,1')).toBe('entrance')
    click('cell-6,3'); fireEvent.keyDown(window, { key: 'Backspace' }) // delete the exit
    expect(screen.queryByTestId('portal-6,3')).toBeNull()
    expect((screen.getByTestId('env-editor-apply') as HTMLButtonElement).disabled).toBe(true)
    click('editor-undo'); expect(role('6,3')).toBe('exit')
    click('editor-redo'); expect(screen.queryByTestId('portal-6,3')).toBeNull()
    click('editor-undo')
    expect(dirOf(apply)).toEqual([{ id: 'P1', ends: [{ x: 1, y: 1 }, { x: 6, y: 3 }], directed: true }])
  })
  it('exports and re-imports the click-made direction as v4 without drift', () => {
    const base = { ...defaultDraft(), portals: [{ id: 'P1', ends: [{ x: 5, y: 1 }, { x: 1, y: 1 }], directed: true as const }] }
    expect(draftToExportFile(base).version).toBe(4)
    expect(parseEnvImport(serializeEnvExport(base))).toEqual({ ok: true, draft: base })
    const legacy = JSON.parse(serializeEnvExport({ ...base, portals: [{ id: 'P1', ends: base.portals[0].ends }] }))
    expect(legacy.version).toBe(2)
    expect(parseEnvImport(JSON.stringify(legacy))).toMatchObject({ ok: true })
    expect(parseEnvImport(JSON.stringify({ ...JSON.parse(serializeEnvExport(base)), version: 3 }))).toMatchObject({ ok: false })
  })
})

describe('Backspace / Delete removes the last clicked element with any tool', () => {
  const key = (name = 'Backspace') => fireEvent.keyDown(window, { key: name })
  const kind = (k: string) => screen.getByTestId(`cell-${k}`).getAttribute('data-cell-kind')
  it.each([['wall', 'wall'], ['bomb', 'bomb']] as const)('deletes a %s placed with its own tool, then Undo restores it', (tool, expected) => {
    setup(); click(`env-editor-mode-${tool}`); click('cell-2,2'); expect(kind('2,2')).toBe(expected)
    key(); expect(kind('2,2')).toBe('empty')
    click('editor-undo'); expect(kind('2,2')).toBe(expected)
    click('editor-redo'); expect(kind('2,2')).toBe('empty')
  })
  it('works for goals, fragile, one-way, switch, toggle wall, swamp and portal ends', () => {
    setup()
    click('env-editor-mode-goal'); click('cell-3,3'); key('Delete'); expect(kind('3,3')).toBe('empty')
    for (const [tool, id] of [['fragile', 'fragile'], ['oneWay', 'one-way'], ['switch', 'switch'], ['toggleWall', 'toggle'], ['terrain', 'terrain']] as const) {
      click(`env-editor-mode-${tool}`); click('cell-2,4'); expect(screen.getByTestId(`${id}-2,4`)).toBeTruthy()
      key(); expect(screen.queryByTestId(`${id}-2,4`)).toBeNull()
    }
    click('env-editor-mode-portal'); click('cell-1,1'); click('cell-4,4')
    click('cell-4,4'); key() // the third click selected (4,4) and cycled the pair; Backspace removes that end
    expect(screen.queryByTestId('portal-4,4')).toBeNull()
    expect(screen.getAllByTestId(/^portal-\d/)).toHaveLength(1)
    expect((screen.getByTestId('env-editor-apply') as HTMLButtonElement).disabled).toBe(true) // pair now incomplete
  })
  it('works from the eraser and the select tool, and with a drag-painted first cell', () => {
    const { svg } = setup(); click('env-editor-mode-wall')
    fireEvent.pointerDown(screen.getByTestId('cell-1,5'), at(1, 5)); fireEvent.pointerMove(svg, at(3, 5)); fireEvent.pointerUp(svg, at(3, 5)); fireEvent.click(screen.getByTestId('cell-1,5'))
    key(); expect(kind('1,5')).toBe('empty'); expect(kind('2,5')).toBe('wall') // only the target cell
    click('env-editor-mode-select'); click('cell-2,5'); key(); expect(kind('2,5')).toBe('empty')
  })
  it('protects the start and the last goal and reports why; empty targets do nothing', () => {
    setup(); click('env-editor-mode-wall'); click('cell-0,0'); key()
    expect(kind('0,0')).toBe('start'); expect(screen.getByTestId('env-editor-errors').textContent).toContain('시작점')
    click('cell-6,6'); key()
    expect(kind('6,6')).toBe('goal'); expect(screen.getByTestId('env-editor-errors').textContent).toContain('마지막 목표')
    click('cell-2,2'); click('cell-2,2') // placed, then removed by the second tap: the selected cell is now empty
    expect(kind('2,2')).toBe('empty')
    key(); key('Delete') // nothing to delete
    expect(kind('2,2')).toBe('empty')
    click('editor-undo'); click('editor-undo') // exactly the two taps were recorded
    expect((screen.getByTestId('editor-undo') as HTMLButtonElement).disabled).toBe(true)
  })
  it('leaves text editing alone: Backspace in inputs, numbers and the portal ID only edits the text', () => {
    setup(); click('env-editor-mode-wall'); click('cell-2,2')
    fireEvent.click(screen.getByRole('button', { name: '속성 / 파일' }))
    for (const id of ['env-editor-width-input', 'env-editor-step-reward-input']) {
      const input = screen.getByTestId(id) as HTMLInputElement
      input.focus(); fireEvent.keyDown(input, { key: 'Backspace' }); fireEvent.keyDown(input, { key: 'Delete' })
      expect(kind('2,2'), id).toBe('wall')
    }
    click('env-editor-mode-portal')
    const portalId = screen.getByTestId('portal-id') as HTMLInputElement
    portalId.focus(); fireEvent.keyDown(portalId, { key: 'Backspace' })
    expect(kind('2,2')).toBe('wall')
    fireEvent.keyDown(window, { key: 'Backspace' }) // focus outside text fields: the selected wall goes
    expect(kind('2,2')).toBe('empty')
  })
  it('does nothing while the editor is inactive or a direct play session is open', () => {
    setup({}, { active: false }); click('env-editor-mode-wall'); click('cell-2,2'); key()
    expect(kind('2,2')).toBe('wall'); cleanup()
    setup(); click('env-editor-mode-wall'); click('cell-2,2'); click('manual-play-start'); key()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(kind('2,2')).toBe('wall')
  })
})

describe('direct play D-pad', () => {
  const config = { ...createDefaultGridWorldConfig(), start: { x: 3, y: 3 } }
  const agent = () => { const marker = screen.getByTestId('agent-marker'); return [(Number(marker.getAttribute('cx')) - 24) / 48, (Number(marker.getAttribute('cy')) - 24) / 48] }
  const pad = (name: string) => screen.getByRole('button', { name })
  beforeEach(() => vi.useFakeTimers())
  const show = () => render(<ManualPlay config={config} locale="ko" active onClose={() => {}} />)
  it('has up / left / down / right cells with the cross placement classes', () => {
    show()
    expect([...document.querySelectorAll('.direction-pad button')].map(b => b.className)).toEqual(['dpad-up', 'dpad-left', 'dpad-down', 'dpad-right'])
    expect([...document.querySelectorAll('.direction-pad button')].map(b => b.textContent)).toEqual(['↑', '←', '↓', '→'])
  })
  it.each([['위', [3, 2]], ['아래', [3, 4]], ['왼쪽', [2, 3]], ['오른쪽', [4, 3]]] as const)('%s moves one cell the right way', (name, expected) => {
    show(); fireEvent.pointerDown(pad(name), { button: 0, pointerId: 5 }); fireEvent.pointerUp(pad(name), { pointerId: 5 })
    expect(agent()).toEqual(expected)
  })
  it('repeats while held and stops on pointer up, cancel, lost capture and when the game ends', () => {
    show()
    fireEvent.pointerDown(pad('오른쪽'), { button: 0, pointerId: 6 }); expect(agent()).toEqual([4, 3])
    act(() => { vi.advanceTimersByTime(200) }); expect(agent()).toEqual([5, 3])
    act(() => { vi.advanceTimersByTime(100) }); expect(agent()).toEqual([6, 3])
    fireEvent.pointerUp(pad('오른쪽'), { pointerId: 6 })
    act(() => { vi.advanceTimersByTime(1000) }); expect(agent()).toEqual([6, 3])
    fireEvent.pointerDown(pad('왼쪽'), { button: 0, pointerId: 7 }); fireEvent.pointerCancel(pad('왼쪽'), { pointerId: 7 })
    const x = agent()[0]; act(() => { vi.advanceTimersByTime(1000) }); expect(agent()[0]).toBe(x)
    fireEvent.pointerDown(pad('위'), { button: 0, pointerId: 8 }); fireEvent.blur(window)
    const y = agent()[1]; act(() => { vi.advanceTimersByTime(1000) }); expect(agent()[1]).toBe(y)
  })
  it('ignores a secondary button and keeps keyboard play', () => {
    show()
    fireEvent.pointerDown(pad('위'), { button: 2, pointerId: 9 }); expect(agent()).toEqual([3, 3])
    fireEvent.keyDown(window, { key: 'ArrowDown' }); fireEvent.keyUp(window, { key: 'ArrowDown' }); expect(agent()).toEqual([3, 4])
    fireEvent.keyDown(window, { key: 'a' }); fireEvent.keyUp(window, { key: 'a' }); expect(agent()).toEqual([2, 4])
  })
})
