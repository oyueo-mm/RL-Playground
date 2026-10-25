// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { elementAt, moveElement, placeElement, nextPortalId, nextGroupId, type ElementKind } from './editorOperations'
import { defaultDraft, validateDraft } from './envEditorDraft'
import { EnvEditor } from './EnvEditor'
import { GridWorldEnv, createDefaultGridWorldConfig } from '../../core/environments/gridworld/GridWorldEnv'
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
const map = () => ({ ...defaultDraft(), goals: [{ x: 6, y: 6 }, { x: 5, y: 6 }], walls: [{ x: 1, y: 1 }], bombs: [{ x: 2, y: 1 }], portals: [{ id: 'Pair', ends: [{ x: 1, y: 2 }, { x: 5, y: 2 }] }], oneWays: [{ x: 2, y: 2, direction: 2 as const }], fragiles: [{ x: 3, y: 2 }], switches: [{ x: 1, y: 3, groupId: 'Gate' }], toggleWalls: [{ x: 2, y: 3, groupId: 'Gate' }] })
const positions: [ElementKind, number, number][] = [['start',0,0],['goal',6,6],['wall',1,1],['bomb',2,1],['portal',1,2],['oneWay',2,2],['fragile',3,2],['switch',1,3],['toggleWall',2,3]]

describe('Atomic editor operations', () => {
  it.each(positions)('moves %s with metadata intact', (kind, x, y) => {
    const draft = map(), from = { x, y }, to = { x: 4, y: 4 }
    const element = elementAt(draft, from)
    const result = moveElement(draft, from, to)
    expect(result.error).toBeUndefined()
    expect(elementAt(result.draft, to)).toEqual(element)
    expect(elementAt(result.draft, from)).toBeNull()
    expect(elementAt(draft, from)?.kind).toBe(kind)
    expect(validateDraft(result.draft)).toEqual([])
  })
  it('overwrites in one immutable change, retains broken relationship survivors and protects start/last goal', () => {
    const draft = map()
    expect(elementAt(placeElement(draft, { x: 1, y: 1 }, { kind: 'goal' }).draft, { x: 1, y: 1 })?.kind).toBe('goal')
    const replaced = placeElement(draft, { x: 1, y: 2 }, { kind: 'wall' }).draft
    expect(replaced.portals?.[0].ends).toEqual([{ x: 5, y: 2 }])
    expect(validateDraft(replaced).some(error => error.includes('two endpoints'))).toBe(true)
    expect(placeElement(draft, { x: 0, y: 0 }, { kind: 'bomb' }).error).toBe('start')
    expect(placeElement(defaultDraft(), { x: 6, y: 6 }, { kind: 'wall' }).error).toBe('last-goal')
    expect(moveElement(draft, { x: 1, y: 2 }, { x: 5, y: 2 }).error).toBe('portal-merge')
    expect(moveElement(draft, { x: 1, y: 1 }, { x: 30, y: 1 }).error).toBe('bounds')
  })
  it('rotates clockwise and never duplicates special elements on repeated clicks', () => {
    let draft = map()
    for (const expected of [0, 3, 1, 2]) { draft = placeElement(draft, { x: 2, y: 2 }, { kind: 'oneWay' }).draft as typeof draft; expect(draft.oneWays[0].direction).toBe(expected) }
    expect(placeElement(draft, { x: 1, y: 3 }, { kind: 'switch', groupId: 'Other' }).draft).toBe(draft)
  })
  it('chooses free IDs and unfinished links from the actual undoable draft', () => {
    let d = defaultDraft()
    d = placeElement(d, { x: 1, y: 1 }, { kind: 'portal', portalId: nextPortalId(d) }).draft
    expect(nextPortalId(d)).toBe('P1')
    d = placeElement(d, { x: 2, y: 2 }, { kind: 'portal', portalId: nextPortalId(d) }).draft
    expect(nextPortalId(d)).toBe('P2')
    d = placeElement(d, { x: 3, y: 3 }, { kind: 'toggleWall', groupId: nextGroupId(d) }).draft
    expect(nextGroupId(d)).toBe('G1')
    d = placeElement(d, { x: 4, y: 4 }, { kind: 'switch', groupId: nextGroupId(d) }).draft
    expect(nextGroupId(d)).toBe('G2')
  })
})

function setup() {
  const apply = vi.fn()
  render(<EnvEditor fullscreen currentRenderModel={new GridWorldEnv(createDefaultGridWorldConfig()).getRenderModel()} onApply={apply} />)
  return { apply, editor: within(screen.getByTestId('env-editor')) }
}
const click = (id: string) => fireEvent.click(screen.getByTestId(id))

describe('Connected editor UX', () => {
  it('shows SVG tool silhouettes and auto-advances portal IDs through undo/redo', () => {
    setup()
    expect(document.querySelectorAll('.tool-buttons button svg[data-icon]')).toHaveLength(11)
    click('env-editor-mode-portal'); click('cell-1,1'); click('cell-2,2')
    expect(screen.getByTestId('current-link-id').textContent).toContain('P2')
    click('cell-3,3'); click('cell-4,4')
    expect(screen.getByTestId('current-link-id').textContent).toContain('P3')
    click('editor-undo'); expect(screen.getByTestId('current-link-id').textContent).toContain('P2')
    click('editor-redo'); expect(screen.getByTestId('current-link-id').textContent).toContain('P3')
  })
  it('supports wall-first groups, auto progression and adding multiple walls to a prior group', () => {
    setup(); click('env-editor-mode-switch'); click('cell-1,1'); click('env-editor-mode-toggleWall'); click('cell-2,2')
    expect(screen.getByTestId('current-link-id').textContent).toBe('G2')
    click('cell-3,3'); click('env-editor-mode-switch'); click('cell-4,4')
    expect(screen.getByTestId('current-link-id').textContent).toBe('G3')
    click('keep-group'); click('env-editor-mode-toggleWall'); click('cell-5,5')
    expect(screen.getByTestId('toggle-5,5').textContent).toContain('G2')
    click('editor-undo'); expect(screen.queryByTestId('toggle-5,5')).toBeNull()
  })
  it('moves with a six-pixel threshold, commits one history entry and cancels with Escape', () => {
    vi.stubGlobal('PointerEvent', MouseEvent)
    setup(); click('cell-1,1'); click('env-editor-mode-select')
    const svg = screen.getByTestId('grid-svg')
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, width: 700, height: 700, right: 700, bottom: 700, toJSON: () => ({}) })
    fireEvent.pointerDown(screen.getByTestId('cell-1,1'), { clientX: 150, clientY: 150, button: 0 })
    fireEvent.pointerMove(svg, { clientX: 152, clientY: 150 })
    expect(screen.queryByTestId('drag-preview')).toBeNull()
    fireEvent.pointerMove(svg, { clientX: 350, clientY: 350 })
    expect(screen.getByTestId('drag-preview').getAttribute('data-valid')).toBe('true')
    fireEvent.pointerUp(svg, { clientX: 350, clientY: 350 })
    expect(screen.getByTestId('cell-3,3').getAttribute('data-cell-kind')).toBe('wall')
    click('editor-undo'); expect(screen.getByTestId('cell-1,1').getAttribute('data-cell-kind')).toBe('wall')
    expect(screen.getByTestId('cell-3,3').getAttribute('data-cell-kind')).toBe('empty')
    fireEvent.pointerDown(screen.getByTestId('cell-1,1'), { clientX: 150, clientY: 150, button: 0 })
    fireEvent.pointerMove(svg, { clientX: 450, clientY: 450 }); fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.pointerUp(svg, { clientX: 450, clientY: 450 })
    expect(screen.getByTestId('cell-1,1').getAttribute('data-cell-kind')).toBe('wall')
    expect(screen.queryByTestId('drag-preview')).toBeNull()
  })
})
