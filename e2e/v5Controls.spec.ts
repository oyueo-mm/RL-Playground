import { expect, test, type Page } from '@playwright/test'
import { navigate, openSheet } from './helpers'

const PHONES = [[320, 568], [390, 844], [430, 932]] as const
const map = (extra: object) => ({ version: 4, type: 'gridworld', width: 7, height: 7, start: { x: 0, y: 0 }, goals: [{ x: 6, y: 6 }], walls: [], bombs: [], stepReward: -0.1, wallPenalty: -1, goalReward: 10, bombPenalty: -10, ...extra })

async function openEditor(page: Page, data?: object) {
  page.on('dialog', dialog => dialog.accept())
  await page.goto('./')
  await navigate(page, 'editor')
  const editor = page.getByTestId('env-editor')
  if (data) {
    await openSheet(editor, 'file')
    await editor.getByTestId('env-editor-import-input').setInputFiles({ name: 'm.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) })
    await editor.getByRole('button', { name: '속성 닫기' }).click()
  }
  return editor
}
const cellBox = async (page: Page, key: string) => (await page.getByTestId('env-editor').getByTestId(`cell-${key}`).boundingBox())!
const press = async (page: Page, key: string, isPhone: boolean) => { const b = await cellBox(page, key); if (isPhone) await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); else await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2) }

test('home offers learn, make a map and algorithms without overflow at 320, 390 and 1440', async ({ page }, info) => {
  const sizes = info.project.name === 'mobile' ? [[320, 568], [390, 844]] : [[1440, 900]]
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height }); await page.goto('./')
    const buttons = page.locator('.hero-actions button')
    await expect(buttons).toHaveText(['학습 시작하기 ↗', '맵 만들기', '알고리즘 알아보기 →'])
    for (const box of await Promise.all((await buttons.all()).map(b => b.boundingBox()))) {
      expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1)
      if (width < 761) expect(box!.height).toBeGreaterThanOrEqual(44)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    expect(await page.locator('.hero-copy').evaluate(el => el.children.length)).toBe(2)
    await page.screenshot({ animations: 'disabled', path: `docs/screenshots/v5b/home-${width}x${height}.png` })
    await page.getByTestId('home-make-map').click()
    await expect(page.getByTestId('nav-editor')).toHaveAttribute('aria-current', 'page')
    await expect(page.getByTestId('env-editor')).toBeVisible()
  }
})

test('phone D-pad is a thumb-sized cross whose buttons move the agent, repeat while held and stop on release', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'phone layout')
  test.setTimeout(120000)
  const editor = await openEditor(page)
  for (const [width, height] of PHONES) {
    await page.setViewportSize({ width, height }); await page.waitForTimeout(300)
    await editor.getByTestId('manual-play-start').click()
    const play = page.getByTestId('manual-play'), agent = play.getByTestId('agent-marker')
    const boxes = Object.fromEntries(await Promise.all(([['up', '위'], ['left', '왼쪽'], ['down', '아래'], ['right', '오른쪽']] as const).map(async ([k, name]) => [k, (await play.getByRole('button', { name, exact: true }).boundingBox())!])))
    const mid = (b: { x: number; width: number }) => b.x + b.width / 2
    expect(boxes.up.y + boxes.up.height, `${width}: up above middle row`).toBeLessThanOrEqual(boxes.left.y + 1)
    expect(Math.abs(boxes.left.y - boxes.right.y)).toBeLessThan(1)
    expect(boxes.down.y).toBeGreaterThanOrEqual(boxes.left.y + boxes.left.height - 1)
    expect(Math.abs(mid(boxes.up) - mid(boxes.down))).toBeLessThan(1)
    expect(Math.abs(mid(boxes.up) - (mid(boxes.left) + mid(boxes.right)) / 2)).toBeLessThan(1)
    expect(boxes.right.x - (boxes.left.x + boxes.left.width), 'empty centre cell').toBeGreaterThan(boxes.up.width * 0.9)
    for (const b of Object.values(boxes)) { expect(b.width).toBeGreaterThanOrEqual(48); expect(b.height).toBeGreaterThanOrEqual(46); expect(b.x).toBeGreaterThanOrEqual(0); expect(b.x + b.width).toBeLessThanOrEqual(width + 1); expect(b.y + b.height).toBeLessThanOrEqual(height + 1) }
    const grid = (await play.getByTestId('grid-stack').boundingBox())!
    expect(grid.height, `${width}: grid keeps its space`).toBeGreaterThanOrEqual(height * 0.36)
    expect(grid.y + grid.height).toBeLessThanOrEqual(boxes.up.y + 1)
    const center = async (k: keyof typeof boxes) => ({ x: boxes[k].x + boxes[k].width / 2, y: boxes[k].y + boxes[k].height / 2 })
    const at = async () => [Number(await agent.getAttribute('cx')), Number(await agent.getAttribute('cy'))]
    expect(await at()).toEqual([24, 24])
    const r = await center('right'); await page.touchscreen.tap(r.x, r.y); expect(await at()).toEqual([72, 24])
    const d = await center('down'); await page.touchscreen.tap(d.x, d.y); expect(await at()).toEqual([72, 72])
    const l = await center('left'); await page.touchscreen.tap(l.x, l.y); expect(await at()).toEqual([24, 72])
    const u = await center('up'); await page.touchscreen.tap(u.x, u.y); expect(await at()).toEqual([24, 24])
    // Long press with real touch events: repeats, then stops the moment the finger lifts.
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.x, y: r.y }] })
    await page.waitForTimeout(700)
    const held = Number(await play.getByTestId('manual-progress').getAttribute('data-steps'))
    expect(held, 'repeated while held').toBeGreaterThanOrEqual(4)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    const after = await play.getByTestId('manual-progress').getAttribute('data-steps')
    await page.waitForTimeout(500)
    expect(await play.getByTestId('manual-progress').getAttribute('data-steps')).toBe(after)
    expect(await page.evaluate(() => getSelection()?.toString() ?? '')).toBe('')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true)
    await page.screenshot({ animations: 'disabled', path: `docs/screenshots/v5b/dpad-${width}x${height}.png` })
    await page.keyboard.press('Escape'); await expect(play).toHaveCount(0)
  }
})

test('desktop direct play keeps arrow keys and WASD', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'keyboard')
  const editor = await openEditor(page)
  await editor.getByTestId('manual-play-start').click()
  const agent = page.getByTestId('manual-play').getByTestId('agent-marker')
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('d'); await page.keyboard.press('s'); await page.keyboard.press('ArrowDown')
  expect([await agent.getAttribute('cx'), await agent.getAttribute('cy')]).toEqual(['120', '120'])
  await page.keyboard.press('a'); await page.keyboard.press('w')
  expect([await agent.getAttribute('cx'), await agent.getAttribute('cy')]).toEqual(['72', '72'])
})

test('portal clicks cycle A↔B, B→A, A→B exactly once per click (mouse and touch)', async ({ page }, info) => {
  const phone = info.project.name === 'mobile'
  const editor = await openEditor(page)
  await editor.getByTestId('env-editor-mode-portal').scrollIntoViewIfNeeded()
  await editor.getByTestId('env-editor-mode-portal').click()
  await press(page, '1,1', phone); await press(page, '5,1', phone)
  const role = (k: string) => editor.getByTestId(`portal-${k}`).getAttribute('data-portal-role')
  expect([await role('1,1'), await role('5,1')]).toEqual([null, null]) // two-way
  await press(page, '1,1', phone); expect([await role('1,1'), await role('5,1')]).toEqual(['exit', 'entrance']) // B → A
  await press(page, '5,1', phone); expect([await role('1,1'), await role('5,1')]).toEqual(['entrance', 'exit']) // A → B
  await press(page, '5,1', phone); expect([await role('1,1'), await role('5,1')]).toEqual([null, null]) // back to two-way
  await expect(page.getByTestId('env-editor').locator('[data-testid^="portal-"][data-testid*=","]')).toHaveCount(2)
  await editor.getByTestId('editor-undo').click(); expect(await role('5,1')).toBe('exit')
  await page.screenshot({ animations: 'disabled', path: info.outputPath(`portal-click-${info.project.name}.png`) })
})

test('Backspace deletes the last clicked tile with any tool but never eats text editing', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'hardware keyboard')
  const editor = await openEditor(page)
  const kind = (k: string) => editor.getByTestId(`cell-${k}`).getAttribute('data-cell-kind')
  for (const tool of ['wall', 'bomb']) { await editor.getByTestId(`env-editor-mode-${tool}`).click(); await editor.getByTestId('cell-2,2').click(); expect(await kind('2,2')).toBe(tool); await page.keyboard.press('Backspace'); expect(await kind('2,2')).toBe('empty') }
  await editor.getByTestId('env-editor-mode-fragile').click(); await editor.getByTestId('cell-3,3').click()
  await page.keyboard.press('Delete'); await expect(editor.getByTestId('fragile-3,3')).toHaveCount(0)
  await editor.getByTestId('editor-undo').click(); await expect(editor.getByTestId('fragile-3,3')).toHaveCount(1)
  await editor.getByTestId('cell-0,0').click(); await page.keyboard.press('Backspace')
  expect(await kind('0,0')).toBe('start')
  await editor.getByTestId('env-editor-mode-wall').click(); await editor.getByTestId('cell-4,4').click()
  await openSheet(editor, 'file')
  const step = editor.getByTestId('env-editor-step-reward-input'); await step.click(); await page.keyboard.press('End'); await page.keyboard.press('Backspace')
  expect(await kind('4,4')).toBe('wall') // the text field consumed the key
  await expect(step).not.toHaveValue('-0.1') // the digit was deleted from the field
  await page.keyboard.press('Tab')
  await editor.getByTestId('cell-4,4').click(); await page.keyboard.press('Backspace')
  expect(await kind('4,4')).toBe('empty')
})

test('the cracked-slab fragile icon and map tile are distinct from a bolt, and collapse changes the tile', async ({ page }, info) => {
  const editor = await openEditor(page, map({ fragiles: [{ x: 1, y: 0 }] }))
  const icon = editor.getByTestId('env-editor-mode-fragile').locator('svg[data-icon=fragile] path')
  const d = await icon.getAttribute('d')
  expect(d).toContain('M12 11'); expect((d!.match(/M/g) ?? []).length).toBeGreaterThanOrEqual(4) // slab + several separate cracks, not one polyline
  const intact = await editor.getByTestId('fragile-1,0').evaluate(el => ({ collapsed: el.getAttribute('data-collapsed'), fill: el.querySelector('rect')!.getAttribute('fill') }))
  expect(intact).toEqual({ collapsed: 'false', fill: '#fff4db' })
  await editor.getByTestId('manual-play-start').click()
  const tile = page.getByTestId('manual-play').getByTestId('fragile-1,0')
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight') // onto the slab and off it
  await expect(tile).toHaveAttribute('data-collapsed', 'true')
  expect(await tile.locator('rect').getAttribute('fill')).toBe('#707975')
  await page.screenshot({ animations: 'disabled', path: info.outputPath(`fragile-collapsed-${info.project.name}.png`) })
  await page.keyboard.press('Escape')
  if (info.project.name !== 'mobile') await editor.getByTestId('env-editor-mode-fragile').screenshot({ path: 'docs/screenshots/v5b/fragile-tool-icon.png' })
})
