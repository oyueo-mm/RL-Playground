// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EnvEditor } from './EnvEditor'
import { GridWorldEnv, createDefaultGridWorldConfig } from '../../core/environments/gridworld/GridWorldEnv'
import type { GridWorldConfig } from '../../core/environments/gridworld/types'
import { keyboardInset } from '../../ui/hooks/useKeyboardInset'
import { translations } from '../../ui/i18n'

class FakePointerEvent extends MouseEvent {
  pointerId: number; pointerType: string
  constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerId = init.pointerId ?? 1; this.pointerType = init.pointerType ?? 'mouse' }
}
const stubPhone = (matches: boolean) => vi.stubGlobal('matchMedia', (query: string) => ({ matches: matches && /max-width: 760px/.test(query), media: query, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} }))
beforeEach(() => vi.stubGlobal('PointerEvent', FakePointerEvent))
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

function setup(config: Partial<GridWorldConfig> = {}, props: Partial<Parameters<typeof EnvEditor>[0]> = {}) {
  const apply = vi.fn()
  render(<EnvEditor fullscreen confirmApply={() => true} currentRenderModel={new GridWorldEnv({ ...createDefaultGridWorldConfig(), ...config }).getRenderModel()} onApply={apply} locale="ko" t={translations.ko} {...props} />)
  const svg = screen.getByTestId('grid-svg')
  vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, width: 700, height: 700, right: 700, bottom: 700, toJSON: () => ({}) })
  return { apply, svg }
}
const click = (id: string) => fireEvent.click(screen.getByTestId(id))
const at = (x: number, y: number, init: PointerEventInit = {}) => ({ clientX: x * 100 + 50, clientY: y * 100 + 50, button: 0, ...init })

describe('swamp tiles in the editor', () => {
  it('places by tap, paints by drag in one undo step, erases and removes by re-tap', () => {
    const { svg } = setup()
    click('env-editor-mode-terrain')
    click('cell-2,2'); expect(screen.getByTestId('terrain-2,2').getAttribute('data-cost')).toBe('-1')
    fireEvent.pointerDown(screen.getByTestId('cell-1,4'), at(1, 4)); fireEvent.pointerMove(svg, at(5, 4)); fireEvent.pointerUp(svg, at(5, 4)); fireEvent.click(screen.getByTestId('cell-1,4')) // the click a browser sends after pointer-up
    expect(['1,4', '2,4', '3,4', '4,4', '5,4'].every(k => screen.queryByTestId(`terrain-${k}`))).toBe(true)
    click('editor-undo'); expect(screen.queryByTestId('terrain-3,4')).toBeNull(); expect(screen.getByTestId('terrain-2,2')).toBeTruthy()
    click('editor-redo'); expect(screen.getByTestId('terrain-3,4')).toBeTruthy()
    click('cell-2,2'); expect(screen.queryByTestId('terrain-2,2')).toBeNull()
    click('env-editor-mode-erase'); click('cell-4,4'); expect(screen.queryByTestId('terrain-4,4')).toBeNull()
  })
  it('edits a tile’s own cost and the map default; blocks positive costs; applies and round-trips', () => {
    const { apply } = setup()
    click('env-editor-mode-terrain'); click('cell-2,2'); click('cell-3,2')
    click('env-editor-mode-select'); click('cell-3,2')
    expect(screen.getByTestId('element-inspector').getAttribute('data-kind')).toBe('terrain')
    expect((screen.getByTestId('element-value-input') as HTMLInputElement).disabled).toBe(true)
    click('element-value-custom')
    fireEvent.change(screen.getByTestId('element-value-input'), { target: { value: '-5' } })
    fireEvent.change(screen.getByTestId('env-editor-terrain-cost-input'), { target: { value: '-2' } })
    expect(screen.getByTestId('terrain-3,2').getAttribute('data-cost')).toBe('-5')
    expect(screen.getByTestId('terrain-2,2').getAttribute('data-cost')).toBe('-2')
    click('env-editor-apply')
    expect(apply.mock.calls[0][0]).toMatchObject({ terrains: [{ x: 2, y: 2 }, { x: 3, y: 2, cost: -5 }], terrainCost: -2 })
    fireEvent.change(screen.getByTestId('element-value-input'), { target: { value: '3' } })
    expect((screen.getByTestId('env-editor-apply') as HTMLButtonElement).disabled).toBe(true)
    expect(within(screen.getByTestId('element-inspector')).getByRole('alert').textContent).toContain('0 이하')
    click('editor-undo'); expect((screen.getByTestId('env-editor-apply') as HTMLButtonElement).disabled).toBe(false)
    fireEvent.change(screen.getByTestId('env-editor-terrain-cost-input'), { target: { value: '4' } })
    expect((screen.getByTestId('env-editor-apply') as HTMLButtonElement).disabled).toBe(true)
  })
  it('keeps swamp data when the editor is reseeded from the live environment', () => {
    setup({ terrains: [{ x: 1, y: 1, cost: -3 }, { x: 2, y: 1 }], terrainCost: -2 })
    expect(screen.getByTestId('terrain-1,1').getAttribute('data-cost')).toBe('-3')
    expect(screen.getByTestId('terrain-2,1').getAttribute('data-cost')).toBe('-2')
    expect((screen.getByTestId('env-editor-terrain-cost-input') as HTMLInputElement).value).toBe('-2')
  })
})

describe('one-way portals in the editor', () => {
  const place = () => {
    const ui = setup()
    click('env-editor-mode-portal')
    fireEvent.click(screen.getByTestId('portal-directed-tool'))
    click('cell-1,1'); click('cell-5,1')
    return ui
  }
  it('creates a directed pair with a distinct entrance and exit', () => {
    const { apply } = place()
    expect(screen.getByTestId('portal-1,1').getAttribute('data-portal-role')).toBe('entrance')
    expect(screen.getByTestId('portal-5,1').getAttribute('data-portal-role')).toBe('exit')
    click('env-editor-apply')
    expect(apply.mock.calls[0][0].portals).toEqual([{ id: 'P1', ends: [{ x: 1, y: 1 }, { x: 5, y: 1 }], directed: true }])
  })
  it('shows A/B in the inspector, flips the direction and toggles back to two-way', () => {
    const { apply } = place()
    click('env-editor-mode-select'); click('cell-5,1')
    expect(screen.getByTestId('portal-exit').textContent).toContain('B')
    expect(screen.getByTestId('portal-entrance').textContent).toContain('A')
    click('portal-flip')
    expect(screen.getByTestId('portal-1,1').getAttribute('data-portal-role')).toBe('exit')
    expect(screen.getByTestId('portal-5,1').getAttribute('data-portal-role')).toBe('entrance')
    click('editor-undo'); expect(screen.getByTestId('portal-1,1').getAttribute('data-portal-role')).toBe('entrance')
    click('editor-redo')
    click('portal-two-way')
    expect(screen.getByTestId('portal-1,1').getAttribute('data-portal-role')).toBeNull()
    expect(screen.queryByTestId('portal-flip')).toBeNull()
    click('env-editor-apply')
    expect(apply.mock.calls[0][0].portals).toEqual([{ id: 'P1', ends: [{ x: 5, y: 1 }, { x: 1, y: 1 }] }])
  })
  it('keeps direction and slots when an endpoint is dragged to another cell', () => {
    const { svg, apply } = place()
    click('env-editor-mode-select')
    fireEvent.pointerDown(screen.getByTestId('cell-1,1'), at(1, 1)); fireEvent.pointerMove(svg, at(2, 3)); fireEvent.pointerUp(svg, at(2, 3))
    expect(screen.getByTestId('portal-2,3').getAttribute('data-portal-role')).toBe('entrance')
    expect(screen.getByTestId('portal-5,1').getAttribute('data-portal-role')).toBe('exit')
    click('env-editor-apply')
    expect(apply.mock.calls[0][0].portals).toEqual([{ id: 'P1', ends: [{ x: 2, y: 3 }, { x: 5, y: 1 }], directed: true }])
  })
  it('refuses to apply an incomplete one-way pair and says why', () => {
    setup()
    click('env-editor-mode-portal'); fireEvent.click(screen.getByTestId('portal-directed-tool')); click('cell-1,1')
    expect((screen.getByTestId('env-editor-apply') as HTMLButtonElement).disabled).toBe(true)
    click('env-editor-mode-select'); click('cell-1,1')
    expect(within(screen.getByTestId('element-inspector')).getByRole('alert').textContent).toContain('끝점')
  })
})

describe('compact (phone) editor', () => {
  beforeEach(() => stubPhone(true))
  it('uses one tool row, a status row and an action bar instead of the floating toolbar', () => {
    setup()
    expect(document.querySelector('.mobile-editor')).toBeTruthy()
    expect(document.querySelector('.floating-toolbar')).toBeNull()
    const strip = screen.getByRole('toolbar', { name: '맵 편집 도구' })
    expect(within(strip).getAllByRole('button').map(b => b.getAttribute('data-testid')!.replace('env-editor-mode-', ''))).toEqual(['select', 'wall', 'goal', 'bomb', 'erase', 'start', 'portal', 'oneWay', 'fragile', 'switch', 'toggleWall', 'terrain'])
    expect(screen.getByTestId('mobile-active-tool').textContent).toBe('벽')
    click('env-editor-mode-terrain')
    expect(screen.getByTestId('mobile-active-tool').textContent).toBe('늪')
    expect(screen.getByTestId('env-editor-mode-terrain').getAttribute('aria-pressed')).toBe('true')
    for (const id of ['editor-undo', 'editor-redo', 'properties-toggle', 'manual-play-start', 'env-editor-apply']) expect(within(document.querySelector('.mobile-actions') as HTMLElement).getByTestId(id)).toBeTruthy()
  })
  it('keeps desktop layout when the media query does not match', () => {
    cleanup(); stubPhone(false); setup()
    expect(document.querySelector('.mobile-editor')).toBeNull()
    expect(document.querySelector('.floating-toolbar')).toBeTruthy()
  })
  it('labels the one-finger action and switches between editing and panning', () => {
    setup()
    expect(screen.getByTestId('touch-edit-mode').textContent).toBe('그리기')
    expect(screen.getByTestId('touch-edit-mode').getAttribute('aria-pressed')).toBe('true')
    click('env-editor-mode-select'); expect(screen.getByTestId('touch-edit-mode').textContent).toBe('이동')
    click('env-editor-mode-erase'); expect(screen.getByTestId('touch-edit-mode').textContent).toBe('지우기')
    click('env-editor-mode-wall')
    click('touch-pan-mode')
    expect(screen.getByTestId('touch-pan-mode').getAttribute('aria-pressed')).toBe('true')
    expect(document.querySelector('.touch-element-mode')).toBeNull()
    click('touch-edit-mode'); expect(document.querySelector('.touch-element-mode')).toBeTruthy()
  })
  it('paints by touch drag in one undo step; a pan-mode drag does not paint', () => {
    const { svg } = setup()
    const touch = (type: 'pointerDown' | 'pointerMove' | 'pointerUp', target: Element, x: number, y: number) => fireEvent[type](target, at(x, y, { pointerType: 'touch', pointerId: 4 }))
    touch('pointerDown', screen.getByTestId('cell-1,2'), 1, 2); touch('pointerMove', svg, 4, 2); touch('pointerUp', svg, 4, 2)
    expect(['1,2', '2,2', '3,2', '4,2'].map(k => screen.getByTestId(`cell-${k}`).getAttribute('data-cell-kind'))).toEqual(['wall', 'wall', 'wall', 'wall'])
    click('editor-undo')
    expect(['1,2', '4,2'].map(k => screen.getByTestId(`cell-${k}`).getAttribute('data-cell-kind'))).toEqual(['empty', 'empty'])
    expect((screen.getByTestId('editor-undo') as HTMLButtonElement).disabled).toBe(true)
  })
  it('opens a bottom sheet when an element is selected, expands it, and closes with the button or Escape', () => {
    setup()
    expect(document.querySelector('#editor-properties')!.hasAttribute('hidden')).toBe(true)
    click('env-editor-mode-select'); click('cell-6,6')
    const sheet = document.querySelector('#editor-properties') as HTMLElement
    expect(sheet.hidden).toBe(false)
    expect(sheet.className).toContain('is-sheet')
    expect(sheet.getAttribute('data-sheet')).toBe('peek')
    expect(within(sheet).getByTestId('element-position').textContent).toContain('(6, 6)')
    click('sheet-handle'); expect(sheet.getAttribute('data-sheet')).toBe('expanded')
    expect(screen.getByTestId('sheet-handle').getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: '속성 닫기' })); expect(sheet.hidden).toBe(true)
    click('properties-toggle'); expect(sheet.hidden).toBe(false)
    fireEvent.keyDown(window, { key: 'Escape' }); expect(sheet.hidden).toBe(true)
  })
  it('edits element properties from the sheet, then applies and plays from the action bar', () => {
    const { apply } = setup({ goals: [{ x: 6, y: 6 }, { x: 5, y: 6 }] })
    click('env-editor-mode-select'); click('cell-5,6')
    click('element-value-custom'); fireEvent.change(screen.getByTestId('element-value-input'), { target: { value: '25' } })
    click('env-editor-apply')
    expect(apply.mock.calls[0][0].goals).toEqual([{ x: 6, y: 6 }, { x: 5, y: 6, reward: 25 }])
    click('manual-play-start')
    expect(screen.getByTestId('manual-play')).toBeTruthy()
  })
  it('exposes both new elements to the phone palette', () => {
    setup()
    click('env-editor-mode-terrain'); fireEvent.click(screen.getByTestId('cell-2,2'))
    expect(screen.getByTestId('terrain-2,2')).toBeTruthy()
    click('env-editor-mode-portal')
    expect(screen.getByTestId('current-link-id').textContent).toContain('P1')
  })
})

describe('keyboard inset', () => {
  it('reports the occluded height only for large differences', () => {
    expect(keyboardInset(844, 844, 0)).toBe(0)
    expect(keyboardInset(844, 810, 0)).toBe(0) // browser chrome
    expect(keyboardInset(844, 520, 0)).toBe(324)
    expect(keyboardInset(844, 500, 20)).toBe(324)
  })
})
