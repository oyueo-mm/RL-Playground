// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { beginStroke, cellsBetween, elementAt, extendStroke, moveElement, placeElement } from './editorOperations'
import { defaultDraft, validateDraft, type GridEditorDraft } from './envEditorDraft'
import { EnvEditor } from './EnvEditor'
import { GridWorldEnv, createDefaultGridWorldConfig } from '../../core/environments/gridworld/GridWorldEnv'
import type { GridWorldConfig } from '../../core/environments/gridworld/types'

class FakePointerEvent extends MouseEvent {
  pointerId: number; pointerType: string
  constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerId = init.pointerId ?? 1; this.pointerType = init.pointerType ?? 'mouse' }
}
beforeEach(() => vi.stubGlobal('PointerEvent', FakePointerEvent))
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

const kinds = (d: GridEditorDraft, cells: [number, number][]) => cells.map(([x, y]) => elementAt(d, { x, y })?.kind ?? null)

describe('V4 stroke operations', () => {
  it('interpolates skipped cells without gaps or repeats', () => {
    expect(cellsBetween({ x: 0, y: 0 }, { x: 4, y: 0 })).toEqual([1, 2, 3, 4].map(x => ({ x, y: 0 })))
    const diagonal = cellsBetween({ x: 0, y: 0 }, { x: 3, y: 5 })
    expect(diagonal.at(-1)).toEqual({ x: 3, y: 5 })
    for (const [i, cell] of diagonal.entries()) {
      const previous = i ? diagonal[i - 1] : { x: 0, y: 0 }
      expect(Math.max(Math.abs(cell.x - previous.x), Math.abs(cell.y - previous.y))).toBe(1)
    }
  })
  it('paints walls continuously, fills only empty cells and processes each cell once', () => {
    const d = { ...defaultDraft(), bombs: [{ x: 3, y: 1 }] }
    let stroke = beginStroke(d, { x: 1, y: 1 }, { kind: 'wall' })
    stroke = extendStroke(stroke, { x: 5, y: 1 })
    stroke = extendStroke(stroke, { x: 1, y: 1 }) // dragging back over visited cells is a no-op
    expect(kinds(stroke.draft, [[1, 1], [2, 1], [3, 1], [4, 1], [5, 1]])).toEqual(['wall', 'wall', 'bomb', 'wall', 'wall'])
    expect(stroke.draft.walls).toHaveLength(4)
    expect(validateDraft(stroke.draft)).toEqual([])
  })
  it('removes same-kind elements when the stroke starts on one and protects start / last goal on erase', () => {
    let d = defaultDraft()
    for (const x of [1, 2, 3]) d = placeElement(d, { x, y: 2 }, { kind: 'wall' }).draft
    const remove = extendStroke(beginStroke(d, { x: 1, y: 2 }, { kind: 'wall' }), { x: 4, y: 2 })
    expect(remove.intent).toBe('remove')
    expect(remove.draft.walls).toEqual([])
    const erase = extendStroke(extendStroke(beginStroke(d, { x: 3, y: 2 }, null), { x: 0, y: 2 }), { x: 0, y: 0 })
    expect(erase.draft.start).toEqual({ x: 0, y: 0 })
    expect(erase.draft.walls).toEqual([])
    expect(erase.error).toBe('start')
    const goal = extendStroke(beginStroke(defaultDraft(), { x: 5, y: 6 }, null), { x: 6, y: 6 })
    expect(goal.draft.goals).toHaveLength(1)
  })
  it('places goals and bombs without duplicates and keeps portals / start / switches single-cell', () => {
    const goals = extendStroke(beginStroke(defaultDraft(), { x: 1, y: 3 }, { kind: 'goal' }), { x: 4, y: 3 })
    expect(goals.draft.goals).toHaveLength(5)
    expect(new Set(goals.draft.goals.map(g => `${g.x},${g.y}`)).size).toBe(5)
    for (const kind of ['portal', 'start', 'switch'] as const) {
      const stroke = extendStroke(beginStroke(defaultDraft(), { x: 1, y: 1 }, { kind, portalId: 'P1', groupId: 'G1' }), { x: 4, y: 1 })
      expect(kinds(stroke.draft, [[2, 1], [3, 1], [4, 1]])).toEqual([null, null, null])
    }
  })
  it('cycles a toggle wall’s initial state on re-click but never flips walls crossed by a drag', () => {
    let d = placeElement(defaultDraft(), { x: 2, y: 2 }, { kind: 'toggleWall', groupId: 'G1' }).draft
    d = placeElement(d, { x: 3, y: 2 }, { kind: 'toggleWall', groupId: 'G1' }).draft
    d = placeElement(d, { x: 2, y: 2 }, { kind: 'toggleWall', groupId: 'G1' }).draft
    expect(d.toggleWalls?.[0]).toEqual({ x: 2, y: 2, groupId: 'G1', initialOpen: true })
    d = placeElement(d, { x: 2, y: 2 }, { kind: 'toggleWall', groupId: 'G1' }).draft
    expect(d.toggleWalls?.[0]).toEqual({ x: 2, y: 2, groupId: 'G1' })
    const stroke = extendStroke(extendStroke(beginStroke(d, { x: 1, y: 2 }, { kind: 'toggleWall', groupId: 'G1' }), { x: 5, y: 2 }), { x: 2, y: 2 })
    expect(stroke.draft.toggleWalls?.filter(tile => tile.initialOpen)).toEqual([])
    expect(stroke.draft.toggleWalls).toHaveLength(5)
  })
  it('keeps per-element values when elements are moved', () => {
    const d = { ...defaultDraft(), goals: [{ x: 6, y: 6, reward: 50 }], bombs: [{ x: 2, y: 2, penalty: -40 }], switches: [{ x: 1, y: 1, groupId: 'G1' }], toggleWalls: [{ x: 3, y: 3, groupId: 'G1', initialOpen: true }] }
    expect(moveElement(d, { x: 6, y: 6 }, { x: 5, y: 5 }).draft.goals).toEqual([{ x: 5, y: 5, reward: 50 }])
    expect(moveElement(d, { x: 2, y: 2 }, { x: 4, y: 4 }).draft.bombs).toEqual([{ x: 4, y: 4, penalty: -40 }])
    expect(moveElement(d, { x: 3, y: 3 }, { x: 4, y: 3 }).draft.toggleWalls).toEqual([{ x: 4, y: 3, groupId: 'G1', initialOpen: true }])
  })
  it('paints a 64×64 map quickly', () => {
    const d = { ...defaultDraft(), width: 64, height: 64, goals: [{ x: 63, y: 63 }] }
    const started = performance.now()
    let stroke = beginStroke(d, { x: 1, y: 0 }, { kind: 'wall' })
    for (let y = 0; y < 64; y += 2) for (const to of [{ x: 62, y }, { x: 62, y: y + 1 }, { x: 1, y: y + 1 }, { x: 1, y: y + 2 }]) stroke = extendStroke(stroke, to)
    expect(stroke.draft.walls.length).toBeGreaterThan(3000)
    expect(performance.now() - started).toBeLessThan(5000)
  })
})

function setup(config: Partial<GridWorldConfig> = {}) {
  const apply = vi.fn()
  render(<EnvEditor fullscreen confirmApply={() => true} currentRenderModel={new GridWorldEnv({ ...createDefaultGridWorldConfig(), ...config }).getRenderModel()} onApply={apply} />)
  const svg = screen.getByTestId('grid-svg')
  vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, width: 700, height: 700, right: 700, bottom: 700, toJSON: () => ({}) })
  return { apply, svg }
}
const click = (id: string) => fireEvent.click(screen.getByTestId(id))
const kind = (key: string) => screen.getByTestId(`cell-${key}`).getAttribute('data-cell-kind')
const at = (x: number, y: number, init: PointerEventInit = {}) => ({ clientX: x * 100 + 50, clientY: y * 100 + 50, button: 0, ...init })

describe('V4 drag painting in the editor', () => {
  it('paints a fast drag as one undo step, redoes it and swallows the trailing click', () => {
    const { svg } = setup()
    click('env-editor-mode-wall')
    fireEvent.pointerDown(screen.getByTestId('cell-1,2'), at(1, 2))
    fireEvent.pointerMove(svg, at(5, 2)) // one event skipping three cells
    expect(screen.getByTestId('env-editor-grid').getAttribute('data-painting')).toBe('true')
    fireEvent.pointerUp(svg, at(5, 2))
    fireEvent.click(screen.getByTestId('cell-1,2')) // the browser's click after pointerup
    expect(['1,2', '2,2', '3,2', '4,2', '5,2'].map(kind)).toEqual(Array(5).fill('wall'))
    click('editor-undo')
    expect(['1,2', '2,2', '3,2', '4,2', '5,2'].map(kind)).toEqual(Array(5).fill('empty'))
    click('editor-redo')
    expect(['1,2', '5,2'].map(kind)).toEqual(['wall', 'wall'])
    click('editor-undo'); click('editor-undo')
    expect((screen.getByTestId('editor-undo') as HTMLButtonElement).disabled).toBe(true)
  })
  it('swallows the trailing click even after a drag longer than the click window', () => {
    vi.useFakeTimers()
    try {
      const { svg } = setup()
      click('env-editor-mode-wall')
      fireEvent.pointerDown(screen.getByTestId('cell-1,1'), at(1, 1))
      vi.advanceTimersByTime(2000)
      fireEvent.pointerMove(svg, at(3, 1)); fireEvent.pointerUp(svg, at(3, 1))
      fireEvent.click(screen.getByTestId('cell-1,1')) // captured cell receives the click
      expect(['1,1', '2,1', '3,1'].map(kind)).toEqual(['wall', 'wall', 'wall'])
      vi.advanceTimersByTime(600)
      click('env-editor-mode-select'); click('cell-2,1') // a later select click is never swallowed
      expect(screen.getByTestId('element-inspector').getAttribute('data-kind')).toBe('wall')
    } finally { vi.useRealTimers() }
  })
  it('erases by drag and keeps keyboard placement working', () => {
    const { svg } = setup({ walls: [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }] })
    click('env-editor-mode-erase')
    fireEvent.pointerDown(screen.getByTestId('cell-1,1'), at(1, 1)); fireEvent.pointerMove(svg, at(3, 1)); fireEvent.pointerUp(svg, at(3, 1))
    expect(['1,1', '2,1', '3,1'].map(kind)).toEqual(['empty', 'empty', 'empty'])
    click('env-editor-mode-bomb')
    fireEvent.keyDown(screen.getByTestId('cell-4,4'), { key: 'Enter' })
    expect(kind('4,4')).toBe('bomb')
  })
  it('discards strokes on pointer cancel, Escape and a camera pan', () => {
    const { svg } = setup()
    click('env-editor-mode-wall')
    fireEvent.pointerDown(screen.getByTestId('cell-1,1'), at(1, 1)); fireEvent.pointerMove(svg, at(3, 1)); fireEvent.pointerCancel(svg, at(3, 1))
    expect(kind('1,1')).toBe('empty')
    fireEvent.pointerDown(screen.getByTestId('cell-1,1'), at(1, 1)); fireEvent.pointerMove(svg, at(3, 1)); fireEvent.keyDown(window, { key: 'Escape' }); fireEvent.pointerUp(svg, at(3, 1))
    expect(kind('2,1')).toBe('empty')
    fireEvent.keyDown(window, { code: 'Space', key: ' ' })
    fireEvent.pointerDown(screen.getByTestId('cell-1,1'), at(1, 1)); fireEvent.pointerMove(svg, at(3, 1)); fireEvent.pointerUp(svg, at(3, 1))
    fireEvent.keyUp(window, { code: 'Space', key: ' ' })
    expect(kind('1,1')).toBe('empty')
    expect((screen.getByTestId('editor-undo') as HTMLButtonElement).disabled).toBe(true)
  })
  it('discards a one-finger stroke when a second finger starts a pinch', () => {
    const { svg } = setup()
    click('env-editor-mode-wall')
    fireEvent.pointerDown(screen.getByTestId('cell-1,1'), at(1, 1, { pointerType: 'mouse', pointerId: 1 }))
    fireEvent.pointerMove(svg, at(2, 1, { pointerId: 1 }))
    fireEvent.pointerDown(screen.getByTestId('cell-4,4'), at(4, 4, { pointerType: 'touch', pointerId: 2 }))
    fireEvent.pointerDown(screen.getByTestId('cell-4,5'), at(4, 5, { pointerType: 'touch', pointerId: 3 }))
    fireEvent.pointerUp(svg, at(2, 1, { pointerId: 1 }))
    expect(['1,1', '2,1', '4,4', '4,5'].map(kind)).toEqual(['empty', 'empty', 'empty', 'empty'])
  })
})

describe('V4 element inspector', () => {
  it('shows only the selected element’s settings and never edits on selection alone', () => {
    setup({ walls: [{ x: 1, y: 1 }], oneWays: [{ x: 2, y: 2, direction: 0 }] })
    click('env-editor-mode-select'); click('cell-2,2')
    expect(screen.getByTestId('element-inspector').getAttribute('data-kind')).toBe('oneWay')
    expect(screen.getByTestId('element-position').textContent).toContain('(2, 2)')
    expect(screen.queryByTestId('group-id')).toBeNull()
    click('cell-2,2'); click('cell-2,2')
    expect(screen.getByTestId('one-way-2,2').getAttribute('data-direction')).toBe('0')
    fireEvent.change(screen.getByTestId('one-way-direction'), { target: { value: '2' } })
    expect(screen.getByTestId('one-way-2,2').getAttribute('data-direction')).toBe('2')
    click('cell-1,1')
    expect(screen.getByTestId('element-inspector').getAttribute('data-kind')).toBe('wall')
    expect(screen.queryByTestId('one-way-direction')).toBeNull()
    click('element-delete'); expect(kind('1,1')).toBe('empty')
  })
  it('switches goals and bombs between inherited and custom values that reach the applied config', () => {
    const { apply } = setup({ goals: [{ x: 6, y: 6 }, { x: 5, y: 6 }], bombs: [{ x: 3, y: 3 }] })
    click('env-editor-mode-select'); click('cell-5,6')
    expect((screen.getByTestId('element-value-input') as HTMLInputElement).disabled).toBe(true)
    click('element-value-custom')
    fireEvent.change(screen.getByTestId('element-value-input'), { target: { value: '50' } })
    click('cell-3,3'); click('element-value-custom')
    fireEvent.change(screen.getByTestId('element-value-input'), { target: { value: '-75' } })
    expect(screen.getByTestId('value-badge-5,6').textContent).toBe('+50')
    expect(screen.getByTestId('value-badge-3,3').textContent).toBe('-75')
    expect(screen.queryByTestId('value-badge-6,6')).toBeNull() // inherited values show no badge
    click('env-editor-apply')
    expect(apply.mock.calls[0][0]).toMatchObject({ goals: [{ x: 6, y: 6 }, { x: 5, y: 6, reward: 50 }], bombs: [{ x: 3, y: 3, penalty: -75 }] })
    expect(apply.mock.calls[0][0].goals[0]).not.toHaveProperty('reward')
    click('element-value-inherit'); click('env-editor-apply')
    expect(apply.mock.calls[1][0].bombs).toEqual([{ x: 3, y: 3 }])
    click('element-value-custom'); fireEvent.change(screen.getByTestId('element-value-input'), { target: { value: '' } })
    expect((screen.getByTestId('env-editor-apply') as HTMLButtonElement).disabled).toBe(true)
    click('editor-undo')
    expect((screen.getByTestId('env-editor-apply') as HTMLButtonElement).disabled).toBe(false)
  })
  it('sets toggle wall initial states independently within one group, with undo/redo', () => {
    const { apply } = setup({ switches: [{ x: 1, y: 1, groupId: 'G1' }], toggleWalls: [{ x: 2, y: 2, groupId: 'G1' }, { x: 3, y: 2, groupId: 'G1' }] })
    click('env-editor-mode-select'); click('cell-3,2')
    expect(screen.getByTestId('toggle-initial-closed').getAttribute('aria-pressed')).toBe('true')
    click('toggle-initial-open')
    expect(screen.getByTestId('toggle-3,2').getAttribute('data-open')).toBe('true')
    expect(screen.getByTestId('toggle-2,2').getAttribute('data-open')).toBe('false')
    expect(screen.getByTestId('element-links').textContent).toContain('(3, 2)')
    click('editor-undo'); expect(screen.getByTestId('toggle-3,2').getAttribute('data-open')).toBe('false')
    click('editor-redo'); expect(screen.getByTestId('toggle-3,2').getAttribute('data-initial-open')).toBe('true')
    click('env-editor-apply')
    expect(apply.mock.calls[0][0].toggleWalls).toEqual([{ x: 2, y: 2, groupId: 'G1' }, { x: 3, y: 2, groupId: 'G1', initialOpen: true }])
  })
  it('re-clicking with the toggle wall tool cycles the initial state', () => {
    setup()
    click('env-editor-mode-toggleWall'); click('cell-2,2')
    expect(screen.getByTestId('toggle-2,2').getAttribute('data-open')).toBe('false')
    click('cell-2,2'); expect(screen.getByTestId('toggle-2,2').getAttribute('data-open')).toBe('true')
    click('cell-2,2'); expect(screen.getByTestId('toggle-2,2').getAttribute('data-open')).toBe('false')
  })
  it('explains broken switch groups and portal links in words', () => {
    setup({ portals: [{ id: 'P1', ends: [{ x: 1, y: 1 }, { x: 5, y: 1 }] }, { id: 'P2', ends: [{ x: 1, y: 3 }, { x: 5, y: 3 }] }], switches: [{ x: 2, y: 5, groupId: 'G1' }], toggleWalls: [{ x: 3, y: 5, groupId: 'G1' }] })
    click('env-editor-mode-select'); click('cell-1,3')
    expect(screen.getByTestId('element-links').textContent).toContain('(5, 3)')
    fireEvent.change(screen.getByTestId('portal-id'), { target: { value: 'P1' } })
    expect(within(screen.getByTestId('element-inspector')).getByRole('alert').textContent).toMatch(/P1/)
    click('cell-2,5')
    fireEvent.change(screen.getByTestId('group-id'), { target: { value: 'G9' } })
    expect(within(screen.getByTestId('element-inspector')).getByRole('alert').textContent).toContain('G9')
  })
})
