import { expect, test, type Page } from '@playwright/test'
import { navigate, openSheet } from './helpers'

const PHONES = [[320, 568], [390, 844], [430, 932]] as const
const config = (extra: object) => ({ version: 4, type: 'gridworld', width: 7, height: 7, start: { x: 0, y: 0 }, goals: [{ x: 6, y: 6 }], walls: [], bombs: [], stepReward: -0.1, wallPenalty: -1, goalReward: 10, bombPenalty: -10, ...extra })

async function openEditor(page: Page, data?: object) {
  page.on('dialog', dialog => dialog.accept())
  await page.goto('./')
  await navigate(page, 'editor')
  const editor = page.getByTestId('env-editor')
  if (data) {
    await openSheet(editor, 'file')
    await editor.getByTestId('env-editor-import-input').setInputFiles({ name: 'v5.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) })
    await editor.getByRole('button', { name: '속성 닫기' }).click()
  }
  return editor
}
const center = async (page: Page, key: string) => { const b = (await page.getByTestId('env-editor').getByTestId(`cell-${key}`).boundingBox())!; return { x: b.x + b.width / 2, y: b.y + b.height / 2 } }
const kind = (page: Page, key: string) => page.getByTestId('env-editor').getByTestId(`cell-${key}`).getAttribute('data-cell-kind')
async function touchDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 6) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] })
  for (let i = 1; i <= steps; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + (to.x - from.x) * i / steps, y: from.y + (to.y - from.y) * i / steps }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

test('phone editor puts the grid first at 320, 390 and 430 wide', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'phone layout')
  test.setTimeout(120000)
  const editor = await openEditor(page)
  for (const [width, height] of PHONES) {
    await page.setViewportSize({ width, height }); await page.waitForTimeout(300)
    const m = await page.evaluate(() => {
      const r = (s: string) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null }
      const [strip, status, actions, grid] = ['[data-testid=tool-strip]', '.mobile-status', '.mobile-actions', '[data-testid=env-editor] [data-testid=grid-stack]'].map(r)
      const scroller = document.querySelector('[data-testid=tool-strip]')!
      return { strip, status, actions, grid, scrolls: scroller.scrollWidth > scroller.clientWidth, overflowX: document.documentElement.scrollWidth > innerWidth + 1, overflowY: document.documentElement.scrollHeight > innerHeight + 1, more: document.querySelector('.tool-strip')!.getAttribute('data-more-right') }
    })
    expect(m.overflowX, `${width}: horizontal overflow`).toBe(false)
    expect(m.overflowY, `${width}: page scroll`).toBe(false)
    expect(m.grid!.width, `${width}: grid fills the width`).toBeGreaterThanOrEqual(width * 0.9)
    expect(m.strip!.height, `${width}: one tool row`).toBeLessThanOrEqual(80)
    expect(m.actions!.height).toBeLessThanOrEqual(80)
    expect(m.grid!.y).toBeGreaterThanOrEqual(m.status!.bottom - 1)
    expect(m.grid!.bottom).toBeLessThanOrEqual(m.actions!.y + 1)
    expect(m.scrolls && m.more === 'true', `${width}: scroll hint`).toBe(true)
    // everything the user needs stays reachable: the last tools by swiping, the action bar fully inside the screen
    await editor.getByTestId('env-editor-mode-terrain').scrollIntoViewIfNeeded()
    await editor.getByTestId('env-editor-mode-terrain').click()
    await expect(editor.getByTestId('mobile-active-tool')).toContainText('늪')
    expect(m.actions!.bottom).toBeLessThanOrEqual(height + 1)
    await page.screenshot({ animations: 'disabled', path: `docs/screenshots/v5/mobile-editor-${width}x${height}.png` })
    await editor.getByTestId('env-editor-mode-wall').scrollIntoViewIfNeeded()
  }
})

test('phone: touch painting is one undo, panning never paints, pinch-free zoom works', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'phone layout')
  const editor = await openEditor(page, config({ width: 20, height: 20, goals: [{ x: 19, y: 19 }] }))
  await editor.getByTestId('env-editor-mode-wall').click()
  const a = await center(page, '2,2'), b = await center(page, '5,2')
  await touchDrag(page, a, b)
  const painted = await Promise.all(['2,2', '3,2', '4,2', '5,2'].map(k => kind(page, k)))
  expect(painted.every(v => v === 'wall')).toBe(true)
  await editor.getByTestId('editor-undo').click()
  expect(await Promise.all(['2,2', '5,2'].map(k => kind(page, k)))).toEqual(['empty', 'empty'])
  // pan mode: the same swipe moves the camera, paints nothing
  await editor.getByTestId('touch-pan-mode').click()
  await editor.getByRole('button', { name: 'Zoom in' }).click(); await editor.getByRole('button', { name: 'Zoom in' }).click()
  const viewport = editor.getByTestId('grid-viewport'), zoom = await viewport.getAttribute('data-zoom'), panX = await viewport.getAttribute('data-pan-x')
  expect(Number(zoom)).toBeGreaterThan(1)
  const from = await center(page, '10,10')
  await touchDrag(page, from, { x: from.x - 60, y: from.y })
  expect(await viewport.getAttribute('data-pan-x')).not.toBe(panX)
  expect((await page.getByTestId('env-editor').locator('[data-cell-kind=wall]').count())).toBe(0)
  await editor.getByRole('button', { name: 'Fit entire map' }).click()
  expect(await viewport.getAttribute('data-zoom')).toBe('1')
})

test('phone: property sheet opens on selection, keeps the cell visible and keeps inputs reachable', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'phone layout')
  const editor = await openEditor(page)
  await editor.getByTestId('env-editor-mode-select').click()
  const target = await center(page, '6,6'); await page.touchscreen.tap(target.x, target.y)
  const sheet = page.locator('#editor-properties')
  await expect(sheet).toBeVisible()
  await expect(editor.getByTestId('element-inspector')).toHaveAttribute('data-kind', 'goal')
  const sheetBox = (await sheet.boundingBox())!, cell = (await editor.getByTestId('cell-6,6').boundingBox())!, actions = (await page.locator('.mobile-actions').boundingBox())!
  expect(cell.y + cell.height, 'selected cell stays above the sheet').toBeLessThanOrEqual(sheetBox.y + 1)
  expect(sheetBox.y + sheetBox.height).toBeLessThanOrEqual(actions.y + 1)
  expect(sheetBox.height).toBeLessThanOrEqual(page.viewportSize()!.height * 0.5)
  await editor.getByTestId('sheet-handle').click()
  await expect(sheet).toHaveAttribute('data-sheet', 'expanded')
  await editor.getByTestId('element-value-custom').click()
  const input = editor.getByTestId('element-value-input'); await input.focus(); await input.fill('42')
  const inputBox = (await input.boundingBox())!, sheetNow = (await sheet.boundingBox())!
  expect(inputBox.y).toBeGreaterThanOrEqual(sheetNow.y - 1)
  expect(inputBox.y + inputBox.height).toBeLessThanOrEqual(actions.y + 1)
  await expect(editor.getByTestId('value-badge-6,6')).toHaveText('+42')
  await page.getByRole('button', { name: '속성 닫기' }).click()
  await expect(sheet).toBeHidden()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true)
})

test('phone: apply and play from the action bar', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'phone layout')
  const editor = await openEditor(page)
  await editor.getByTestId('env-editor-mode-wall').click(); await editor.getByTestId('cell-3,3').tap()
  await editor.getByTestId('manual-play-start').click()
  await expect(page.getByTestId('manual-play')).toBeVisible()
  await page.keyboard.press('Escape')
  await editor.getByTestId('env-editor-apply').click()
  await expect(page.getByTestId('learning-grid')).toBeVisible()
})

test('swamp cost reaches independent play and the learning environment', async ({ page }) => {
  const editor = await openEditor(page, config({ terrains: [{ x: 1, y: 0 }, { x: 2, y: 0, cost: -4 }], terrainCost: -2 }))
  await expect(editor.getByTestId('terrain-2,0')).toHaveAttribute('data-cost', '-4')
  await editor.getByTestId('manual-play-start').click()
  const progress = page.getByTestId('manual-progress')
  await page.keyboard.press('ArrowRight'); await expect(progress).toContainText('-2.0 보상') // default cost
  await page.keyboard.press('ArrowRight'); await expect(progress).toContainText('-6.0 보상') // own cost -4
  await page.keyboard.press('ArrowRight'); await expect(progress).toContainText('-6.1 보상') // ordinary step
  await page.keyboard.press('Escape')
  await editor.getByTestId('env-editor-apply').click()
  await expect(page.getByTestId('learning-grid').getByTestId('terrain-1,0')).toBeVisible()
  await page.getByTestId('speed-slider').fill('100'); await page.getByTestId('playback-run-episode').click(); await page.waitForTimeout(1200)
  await expect(page.getByTestId('learning-grid')).toBeVisible()
})

test('one-way portal teleports A to B and never back', async ({ page }) => {
  const editor = await openEditor(page, config({ portals: [{ id: 'P1', ends: [{ x: 2, y: 0 }, { x: 4, y: 3 }], directed: true }] }))
  await expect(editor.getByTestId('portal-2,0')).toHaveAttribute('data-portal-role', 'entrance')
  await expect(editor.getByTestId('portal-4,3')).toHaveAttribute('data-portal-role', 'exit')
  await editor.getByTestId('manual-play-start').click()
  const agent = page.getByTestId('manual-play').getByTestId('agent-marker')
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight') // into A (2,0)
  await expect(agent).toHaveAttribute('cx', String(4 * 48 + 24)); await expect(agent).toHaveAttribute('cy', String(3 * 48 + 24))
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowRight') // step off B and back onto it
  await expect(agent).toHaveAttribute('cx', String(4 * 48 + 24)); await expect(agent).toHaveAttribute('cy', String(3 * 48 + 24)) // no return to A
  await page.keyboard.press('Escape')
})

test('swamp and one-way portal survive export and import', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'desktop file flow')
  const editor = await openEditor(page, config({ terrains: [{ x: 1, y: 1, cost: -3 }], terrainCost: -2, portals: [{ id: 'P1', ends: [{ x: 2, y: 4 }, { x: 5, y: 4 }], directed: true }] }))
  await openSheet(editor, 'file')
  const download = page.waitForEvent('download'); await editor.getByTestId('env-editor-export').click()
  const path = await (await download).path()
  const saved = JSON.parse(await (await import('node:fs/promises')).readFile(path!, 'utf8'))
  expect(saved.version).toBe(4)
  expect(saved.terrains).toEqual([{ x: 1, y: 1, cost: -3 }]); expect(saved.terrainCost).toBe(-2)
  expect(saved.portals).toEqual([{ id: 'P1', ends: [{ x: 2, y: 4 }, { x: 5, y: 4 }], directed: true }])
  // an old-version file that contains the new fields is refused, not silently stripped
  await editor.getByTestId('env-editor-import-input').setInputFiles({ name: 'old.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...saved, version: 3 })) })
  await expect(page.getByTestId('env-editor-errors')).toContainText('버전 4')
})

test('desktop: swamp tool, inspector cost and portal flip', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'desktop layout')
  const editor = await openEditor(page)
  await editor.getByTestId('env-editor-mode-terrain').click()
  const a = await center(page, '1,3'), b = await center(page, '5,3')
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 4 }); await page.mouse.up()
  for (const k of ['1,3', '3,3', '5,3']) await expect(editor.getByTestId(`terrain-${k}`)).toBeVisible()
  await editor.getByTestId('editor-undo').click(); await expect(editor.getByTestId('terrain-3,3')).toHaveCount(0)
  await editor.getByTestId('editor-redo').click()
  await editor.getByTestId('env-editor-mode-select').click(); await editor.getByTestId('cell-3,3').click()
  await editor.getByTestId('element-value-custom').click(); await editor.getByTestId('element-value-input').fill('-5')
  await expect(editor.getByTestId('terrain-3,3')).toHaveAttribute('data-cost', '-5')
  await editor.getByTestId('env-editor-mode-portal').click()
  await editor.getByTestId('portal-directed-tool').check()
  await editor.getByTestId('cell-1,5').click(); await editor.getByTestId('cell-5,5').click()
  await editor.getByTestId('env-editor-mode-select').click(); await editor.getByTestId('cell-5,5').click()
  await expect(editor.getByTestId('portal-exit')).toBeVisible()
  await editor.getByTestId('portal-flip').click()
  await expect(editor.getByTestId('portal-5,5')).toHaveAttribute('data-portal-role', 'entrance')
  await page.screenshot({ animations: 'disabled', path: info.outputPath('v5-desktop-editor.png') })
})
