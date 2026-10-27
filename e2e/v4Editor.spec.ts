import { expect, test, type Page } from '@playwright/test'
import { navigate } from './helpers'

const SIZES = [[390, 844], [768, 1024], [1366, 768], [1440, 900], [1920, 1080]] as const
const gateMap = {
  version: 3, type: 'gridworld', width: 7, height: 5, start: { x: 0, y: 0 },
  goals: [{ x: 6, y: 4, reward: 50 }, { x: 0, y: 4 }], walls: [{ x: 0, y: 2 }, { x: 1, y: 2 }, { x: 4, y: 2 }, { x: 5, y: 2 }, { x: 6, y: 2 }], bombs: [{ x: 3, y: 0, penalty: -40 }],
  stepReward: -0.1, wallPenalty: -1, goalReward: 10, bombPenalty: -10,
  switches: [{ x: 1, y: 0, groupId: 'G1' }], toggleWalls: [{ x: 2, y: 2, groupId: 'G1' }, { x: 3, y: 2, groupId: 'G1', initialOpen: true }],
}

async function openEditor(page: Page, data?: object) {
  page.on('dialog', dialog => dialog.accept())
  await page.goto('./')
  await navigate(page, 'editor')
  const editor = page.getByTestId('env-editor')
  if (data) {
    await editor.getByRole('button', { name: /속성 \/ 파일/ }).click()
    await editor.getByTestId('env-editor-import-input').setInputFiles({ name: 'v4.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) })
    await editor.getByRole('button', { name: '속성 닫기' }).click()
  }
  return editor
}
async function center(page: Page, key: string) {
  const box = (await page.getByTestId('env-editor').getByTestId(`cell-${key}`).boundingBox())!
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}
const kind = (page: Page, key: string) => page.getByTestId('env-editor').getByTestId(`cell-${key}`).getAttribute('data-cell-kind')

test('mouse drag paints one undoable stroke, interpolates fast moves and never selects arrow text', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'mouse drag; touch is covered separately')
  const editor = await openEditor(page)
  await editor.getByTestId('env-editor-mode-wall').click()
  const from = await center(page, '1,2'), to = await center(page, '5,4')
  await page.mouse.move(from.x, from.y); await page.mouse.down()
  await page.mouse.move(to.x, from.y, { steps: 1 }) // one jump across three cells
  await page.mouse.move(to.x, to.y, { steps: 3 }); await page.mouse.up()
  for (const key of ['1,2', '2,2', '3,2', '4,2', '5,2', '5,3', '5,4']) expect(await kind(page, key)).toBe('wall')
  await editor.getByTestId('editor-undo').click()
  for (const key of ['1,2', '3,2', '5,4']) expect(await kind(page, key)).toBe('empty')
  await editor.getByTestId('editor-redo').click()
  expect(await kind(page, '3,2')).toBe('wall')
  // Space + drag pans the camera instead of painting.
  const pan0 = await page.getByTestId('env-editor').getByTestId('grid-viewport').getAttribute('data-pan-x')
  const a = await center(page, '1,5'), b = await center(page, '4,5')
  await page.keyboard.down('Space'); await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 4 }); await page.mouse.up(); await page.keyboard.up('Space')
  expect(await kind(page, '2,5')).toBe('empty')
  expect(await page.getByTestId('env-editor').getByTestId('grid-viewport').getAttribute('data-pan-x')).not.toBe(pan0)
  await page.getByTestId('env-editor').getByRole('button', { name: 'Fit entire map' }).click()
  // Repeated one-way clicks rotate without painting a text selection.
  await editor.getByTestId('env-editor-mode-oneWay').click()
  await editor.getByTestId('cell-3,4').click() // places → (3)
  for (const expected of ['1', '2', '0', '3']) { await editor.getByTestId('cell-3,4').click(); await expect(editor.getByTestId('one-way-3,4')).toHaveAttribute('data-direction', expected) }
  expect(await page.evaluate(() => getSelection()?.toString() ?? '')).toBe('')
  await editor.getByTestId('cell-3,4').dblclick()
  expect(await page.evaluate(() => getSelection()?.toString() ?? '')).toBe('')
})

test('touch editing keeps taps, separates touch painting from scrolling and ignores pinches', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'touch device project only')
  const editor = await openEditor(page)
  await editor.getByTestId('env-editor-mode-wall').click()
  await editor.getByTestId('cell-1,1').tap()
  expect(await kind(page, '1,1')).toBe('wall')
  const svg = editor.getByTestId('grid-svg')
  const touch = async (type: string, key: string, pointerId = 7) => { const p = await center(page, key); await svg.dispatchEvent(type, { pointerType: 'touch', pointerId, isPrimary: pointerId === 7, button: 0, buttons: 1, clientX: p.x, clientY: p.y }) }
  // Touch paint off: a finger drag does not paint.
  await touch('pointerdown', '1,3'); await touch('pointermove', '4,3'); await touch('pointerup', '4,3')
  expect(await kind(page, '2,3')).toBe('empty')
  await editor.getByTestId('touch-paint-mode').click()
  await expect(editor.getByTestId('touch-paint-mode')).toHaveAttribute('aria-pressed', 'true')
  await touch('pointerdown', '1,3'); await touch('pointermove', '4,3'); await touch('pointerup', '4,3')
  for (const key of ['1,3', '2,3', '3,3', '4,3']) expect(await kind(page, key)).toBe('wall')
  // A second finger turns the gesture into a pinch and discards the stroke.
  await touch('pointerdown', '1,5'); await touch('pointermove', '3,5')
  const second = await center(page, '5,5')
  await page.getByTestId('env-editor').getByTestId('grid-viewport').dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 8, isPrimary: false, button: 0, clientX: second.x, clientY: second.y })
  await touch('pointerup', '3,5')
  expect(await kind(page, '2,5')).toBe('empty')
  await page.screenshot({ animations: 'disabled', path: 'docs/screenshots/v4/touch-paint-390x844.png' })
})

test('element inspector edits per-element values and mixed initial gate states at every target size', async ({ page }, info) => {
  test.setTimeout(180000)
  const sizes = info.project.name === 'mobile' ? SIZES.slice(0, 1) : SIZES.slice(1)
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height })
    const editor = await openEditor(page, gateMap)
    await expect(editor.getByTestId('toggle-2,2')).toHaveAttribute('data-open', 'false')
    await expect(editor.getByTestId('toggle-3,2')).toHaveAttribute('data-open', 'true')
    await editor.getByTestId('env-editor-mode-select').click()
    await editor.getByTestId('cell-6,4').click()
    const inspector = editor.getByTestId('element-inspector')
    await expect(inspector).toBeVisible(); await expect(inspector).toBeInViewport()
    await expect(inspector).toHaveAttribute('data-kind', 'goal')
    await expect(editor.getByTestId('element-value-input')).toHaveValue('50')
    if (width === 1366 || width === 390) await page.screenshot({ animations: 'disabled', path: `docs/screenshots/v4/inspector-goal-${width}x${height}.png` })
    await editor.getByTestId('cell-2,2').click()
    await expect(inspector).toHaveAttribute('data-kind', 'toggleWall')
    await editor.getByTestId('toggle-initial-open').click()
    await expect(editor.getByTestId('toggle-2,2')).toHaveAttribute('data-open', 'true')
    await editor.getByTestId('toggle-initial-closed').click()
    await expect(editor.getByTestId('toggle-2,2')).toHaveAttribute('data-open', 'false')
    await expect(editor.getByTestId('element-links')).toContainText('(3, 2)')
    await page.screenshot({ animations: 'disabled', path: `docs/screenshots/v4/inspector-gate-${width}x${height}.png` })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
})

test('draft play and the applied environment honour per-element rewards and inverted doors', async ({ page }) => {
  const editor = await openEditor(page, gateMap)
  await editor.getByTestId('manual-play-start').click()
  const play = page.getByTestId('manual-play')
  const grid = play.getByTestId('grid-svg')
  await expect(grid.getByTestId('toggle-3,2')).toHaveAttribute('data-open', 'true')
  await page.keyboard.press('ArrowRight') // onto the switch at (1,0)
  await expect(grid.getByTestId('toggle-3,2')).toHaveAttribute('data-open', 'false')
  await expect(grid.getByTestId('toggle-2,2')).toHaveAttribute('data-open', 'true')
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown') // through the now-open (2,2)
  await expect(grid.getByTestId('agent-marker')).toHaveAttribute('cx', String(2 * 48 + 24))
  await expect(grid.getByTestId('agent-marker')).toHaveAttribute('cy', String(2 * 48 + 24))
  // Restart restores initial door states; the bomb at (3,0) pays its own -40.
  await page.keyboard.press('r')
  await expect(grid.getByTestId('toggle-3,2')).toHaveAttribute('data-open', 'true')
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight')
  await expect(play.getByTestId('manual-progress')).toContainText('-40.2')
  await expect(play.getByTestId('manual-progress')).toContainText('Bomb')
  await page.keyboard.press('Escape')
})

test('greedy result playback starts at 205 ms/step and hands back the training speed', async ({ page }) => {
  page.on('dialog', dialog => dialog.accept())
  await page.goto('./'); await navigate(page, 'environment')
  const slider = page.getByTestId('speed-slider')
  await slider.fill('70')
  const before = await page.getByTestId('speed-control').locator('output').textContent()
  await page.getByTestId('playback-run-greedy').click()
  await expect(slider).toHaveValue('33')
  await expect(page.getByTestId('speed-control').locator('output')).toHaveText(/^205 ms/)
  await slider.fill('50'); await expect(slider).toHaveValue('50')
  await page.getByTestId('playback-stop').click()
  await expect(page.getByTestId('speed-control').locator('output')).toHaveText(before!)
})

test('algorithm guide shows chapter navigation before references on every target size', async ({ page }, info) => {
  const sizes = info.project.name === 'mobile' ? SIZES.slice(0, 1) : SIZES.slice(1)
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height }); await page.goto('./'); await navigate(page, 'guide')
    const section = page.locator('#chapter-0')
    const pager = section.locator('.chapter-pager'), refs = section.locator('.study-resources')
    await expect(pager).toBeVisible()
    expect((await pager.boundingBox())!.y).toBeLessThan((await refs.boundingBox())!.y)
    await pager.getByRole('button', { name: /다음 장/ }).click()
    await expect(page.locator('#chapter-1 > h2')).toBeFocused()
    await page.locator('#chapter-1 .chapter-pager').scrollIntoViewIfNeeded()
    if (width === 390 || width === 1440) await page.screenshot({ animations: 'disabled', path: `docs/screenshots/v4/guide-pager-${width}x${height}.png` })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
})

test('a 64×64 map stays responsive while dragging long strokes', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'desktop timing sample')
  const editor = await openEditor(page, { version: 2, type: 'gridworld', width: 64, height: 64, start: { x: 0, y: 0 }, goals: [{ x: 63, y: 63 }], walls: [], bombs: [], stepReward: -0.1, wallPenalty: -1, goalReward: 10, bombPenalty: -10 })
  await editor.getByTestId('env-editor-mode-wall').click()
  await editor.getByRole('button', { name: 'Zoom in' }).click()
  await editor.getByRole('button', { name: 'Fit entire map' }).click()
  const from = await center(page, '2,10'), to = await center(page, '60,10')
  const started = Date.now()
  await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(to.x, to.y, { steps: 60 }); await page.mouse.up()
  const elapsed = Date.now() - started
  const walls = await page.getByTestId('env-editor').locator('[data-cell-kind=wall]').evaluateAll(cells => cells.map(cell => cell.getAttribute('data-testid')))
  expect(walls.filter(id => !/^cell-\d+,10$/.test(id!))).toEqual([])
  expect(walls.length, walls.join(' ')).toBe(59)
  info.annotations.push({ type: 'drag-64x64-ms', description: String(elapsed) })
  // In-page cost per newly crossed cell: dispatch one move, then let React render and commit.
  const frames = await page.getByTestId('env-editor').getByTestId('grid-svg').evaluate(async svg => {
    const box = svg.getBoundingClientRect(), size = box.width / 64, y = box.top + size * 20.5, times: number[] = []
    const fire = (type: string, x: number) => svg.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 9, pointerType: 'mouse', button: 0, clientX: box.left + x * size, clientY: y }))
    fire('pointerdown', 2.5)
    for (let x = 3; x < 61; x++) {
      const t0 = performance.now(); fire('pointermove', x + .5)
      await new Promise(resolve => setTimeout(resolve, 0)); await new Promise(resolve => setTimeout(resolve, 0)) // React render + commit, before paint
      times.push(performance.now() - t0)
    }
    fire('pointerup', 60.5)
    times.sort((a, b) => a - b)
    return { median: times[times.length >> 1], p95: times[Math.floor(times.length * .95)], max: times.at(-1)! }
  })
  console.log(`drag-64x64 in-page per cell: ${JSON.stringify(frames)}`)
  expect(await kind(page, '30,20')).toBe('wall')
  console.log(`drag-64x64: 59 cells, 60 pointer moves in ${elapsed} ms`)
  expect(elapsed).toBeLessThan(15000)
})
