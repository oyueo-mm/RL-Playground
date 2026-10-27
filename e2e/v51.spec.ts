import { expect, test, type Page } from '@playwright/test'
import { config, loadMap, navigate, openSheet } from './helpers'

const PHONES = [[320, 568], [390, 844], [430, 932]] as const
const swampMap = { ...config(5, 5), version: 4, terrains: [{ x: 2, y: 2, cost: -3 }], terrainCost: -2 }

async function setEpisodes(page: Page, n: number) {
  await page.getByRole('button', { name: '설정', exact: true }).click()
  await page.getByTestId('episode-count-input').fill(String(n))
  await page.getByRole('button', { name: '설정', exact: true }).click()
}
async function fastTraining(page: Page) { await page.getByTestId('speed-slider').fill('100') }

test('a normally finished run shows a small grid toast with the real episode count, once', async ({ page }) => {
  test.setTimeout(120000)
  page.on('dialog', d => d.accept()); await page.goto('./')
  await loadMap(page, config(3, 3)); await fastTraining(page); await setEpisodes(page, 25)
  await page.getByTestId('playback-run-episode').click()
  const toast = page.getByTestId('training-complete')
  await expect(toast).toBeVisible()
  await expect(page.getByTestId('completion-message')).toHaveText('25번 학습 완료!')
  expect(await page.locator('dialog[open]').count()).toBe(0) // no modal and no dimmed backdrop
  // the grid stays usable while the toast is open
  await page.getByTestId('learning-grid').getByTestId('grid-svg').click({ position: { x: 5, y: 5 }, force: true })
  await expect(toast).toBeVisible()
  await page.getByTestId('completion-close').click(); await expect(toast).toHaveCount(0)
  await navigate(page, 'results'); await navigate(page, 'environment'); await page.waitForTimeout(800)
  await expect(toast).toHaveCount(0)
  // a second request reports only itself
  await setEpisodes(page, 10); await page.getByTestId('playback-run-episode').click()
  await expect(page.getByTestId('completion-message')).toHaveText('10번 학습 완료!')
})

test('the toast closes itself after about eight seconds', async ({ page }) => {
  test.setTimeout(60000)
  page.on('dialog', d => d.accept()); await page.goto('./')
  await loadMap(page, config(3, 3)); await fastTraining(page); await setEpisodes(page, 5)
  await page.getByTestId('playback-run-episode').click()
  await expect(page.getByTestId('training-complete')).toBeVisible()
  await expect(page.getByTestId('training-complete')).toHaveCount(0, { timeout: 12000 })
})

test('Run policy plays the learned policy on the same grid without leaving the page', async ({ page }) => {
  test.setTimeout(120000)
  page.on('dialog', d => d.accept()); await page.goto('./')
  await loadMap(page, config(4, 4)); await fastTraining(page); await setEpisodes(page, 60)
  await page.getByTestId('playback-run-episode').click()
  await expect(page.getByTestId('training-complete')).toBeVisible()
  const marker = page.getByTestId('learning-grid').getByTestId('agent-marker'), at = () => marker.evaluate(n => n.getAttribute('cx') + ',' + n.getAttribute('cy'))
  const before = await at()
  await page.getByTestId('completion-run-policy').click()
  await expect(page.getByTestId('training-complete')).toHaveCount(0)
  await expect(page.getByTestId('nav-environment')).toHaveAttribute('aria-current', 'page') // still on the learning screen
  await expect.poll(at, { timeout: 8000 }).not.toBe(before) // the agent really walks
  await expect(page.getByTestId('playback-run-greedy')).toBeEnabled({ timeout: 15000 }) // greedy replay ended
  await page.waitForTimeout(600)
  await expect(page.getByTestId('training-complete')).toHaveCount(0) // ending the replay does not announce again
})

test('Turbo Training shows the same toast and Run policy plays on the normal grid', async ({ page }) => {
  test.setTimeout(120000)
  page.on('dialog', d => d.accept()); await page.goto('./')
  await loadMap(page, config(4, 4)); await setEpisodes(page, 40)
  await page.getByTestId('training-mode').selectOption('turbo'); await page.getByTestId('playback-run-episode').click()
  await expect(page.getByTestId('completion-message')).toHaveText('40번 학습 완료!')
  await expect(page.getByTestId('turbo-dashboard')).toContainText('완료')
  await page.getByTestId('completion-run-policy').click()
  await expect(page.getByTestId('training-complete')).toHaveCount(0)
  await expect(page.getByTestId('learning-grid').getByTestId('agent-marker')).toBeVisible()
  await expect(page.getByTestId('nav-environment')).toHaveAttribute('aria-current', 'page')
  await expect(page.getByTestId('playback-run-greedy')).toBeEnabled({ timeout: 15000 })
  await page.waitForTimeout(600)
  await expect(page.getByTestId('training-complete')).toHaveCount(0)
})

test('stopping, pausing and greedy replay never show the toast', async ({ page }) => {
  test.setTimeout(120000)
  page.on('dialog', d => d.accept()); await page.goto('./')
  await loadMap(page, config(9, 9)); await setEpisodes(page, 100000)
  const toast = page.getByTestId('training-complete')
  await page.getByTestId('playback-run-episode').click(); await page.waitForTimeout(500)
  await page.getByTestId('playback-pause').click(); await page.waitForTimeout(600); await expect(toast).toHaveCount(0)
  await page.getByTestId('playback-resume').click(); await page.waitForTimeout(300)
  await page.getByTestId('playback-stop').click(); await page.waitForTimeout(600); await expect(toast).toHaveCount(0)
  await page.getByTestId('playback-run-greedy').click(); await page.waitForTimeout(800); await page.getByTestId('playback-stop').click()
  await expect(toast).toHaveCount(0)
})

test('the toast fits every viewport, stays clear of the toolbar and shows no backdrop', async ({ page }, info) => {
  test.setTimeout(150000)
  const sizes = info.project.name === 'mobile' ? PHONES : [[768, 1024], [1440, 900]] as const
  page.on('dialog', d => d.accept()); await page.goto('./'); await loadMap(page, config(3, 3)); await fastTraining(page)
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height }); await setEpisodes(page, 8)
    await page.getByTestId('playback-run-episode').click()
    const toast = page.getByTestId('training-complete'); await expect(toast).toBeVisible()
    const b = (await toast.boundingBox())!
    expect(b.x).toBeGreaterThanOrEqual(0); expect(b.x + b.width).toBeLessThanOrEqual(width + 1); expect(b.y).toBeGreaterThanOrEqual(0); expect(b.y + b.height).toBeLessThanOrEqual(height + 1)
    expect(b.height).toBeLessThan(110)
    const bar = await page.getByTestId('learning-grid').locator('.floating-toolbar').boundingBox()
    if (bar) expect(b.y).toBeGreaterThanOrEqual(bar.y + bar.height - 1)
    for (const id of ['completion-run-policy', 'completion-close']) expect((await page.getByTestId(id).boundingBox())!.height).toBeGreaterThanOrEqual(30)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await page.screenshot({ animations: 'disabled', path: `docs/screenshots/v51/toast-${width}x${height}.png` })
    await page.getByTestId('completion-close').click(); await expect(toast).toHaveCount(0)
  }
})

test('phone: Settings · Files is always reachable and its three tabs work', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'phone layout')
  test.setTimeout(150000)
  page.on('dialog', d => d.accept()); await page.goto('./'); await navigate(page, 'editor')
  const editor = page.getByTestId('env-editor')
  for (const [index, [width, height]] of PHONES.entries()) {
    await page.setViewportSize({ width, height }); await page.waitForTimeout(250)
    await editor.getByTestId('env-editor-mode-wall').scrollIntoViewIfNeeded(); await editor.getByTestId('env-editor-mode-wall').tap() // the Select tool shows its own hint instead
    const button = editor.getByRole('button', { name: '설정 · 파일' })
    await expect(button).toBeVisible(); await expect(button).toHaveText('설정 · 파일')
    // not hidden or pushed off screen by the neighbouring action buttons
    const boxes = await Promise.all((await editor.locator('.mobile-actions button').all()).map(async b => ({ name: await b.getAttribute('data-testid'), box: (await b.boundingBox())! })))
    for (const { name, box } of boxes) { expect(box.x, name!).toBeGreaterThanOrEqual(0); expect(box.x + box.width, name!).toBeLessThanOrEqual(width + 1); expect(box.height).toBeGreaterThanOrEqual(40) }
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const a = boxes[i].box, c = boxes[j].box; expect(a.x + a.width <= c.x + 1 || c.x + c.width <= a.x + 1, `${boxes[i].name} overlaps ${boxes[j].name}`).toBe(true) }
    expect(await button.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'label is not clipped').toBe(true)
    // open without touching the grid
    await button.tap()
    const sheet = page.locator('#editor-properties'); await expect(sheet).toBeVisible()
    // First opening starts on Map settings; later openings resume the last tab (Files).
    await expect(editor.getByTestId(index === 0 ? 'sheet-tab-map' : 'sheet-tab-file')).toHaveAttribute('aria-selected', 'true')
    await editor.getByTestId('sheet-tab-map').tap()
    const sb = (await sheet.boundingBox())!, ab = (await editor.locator('.mobile-actions').boundingBox())!
    expect(sb.y + sb.height).toBeLessThanOrEqual(ab.y + 1); expect(sb.x).toBeGreaterThanOrEqual(-1); expect(sb.x + sb.width).toBeLessThanOrEqual(width + 1)
    // map tab
    for (const id of ['env-editor-width-input', 'env-editor-step-reward-input', 'env-editor-terrain-cost-input']) await expect(editor.getByTestId(id)).toBeAttached()
    if ((await sheet.getAttribute('data-sheet')) !== 'expanded') await editor.getByTestId('sheet-handle').tap() // the sheet remembers its size between openings
    await expect(sheet).toHaveAttribute('data-sheet', 'expanded')
    const input = editor.getByTestId('env-editor-goal-reward-input'); await input.scrollIntoViewIfNeeded(); await input.focus()
    const ib = (await input.boundingBox())!, sb2 = (await sheet.boundingBox())!
    expect(ib.y).toBeGreaterThanOrEqual(sb2.y - 1); expect(ib.y + ib.height).toBeLessThanOrEqual(ab.y + 1)
    // element tab (empty), then a real selection
    await editor.getByTestId('sheet-tab-element').tap(); await expect(editor.getByTestId('element-tab-empty')).toBeVisible()
    await editor.getByTestId('element-tab-select-tool').tap(); await page.screenshot({ animations: 'disabled', path: `docs/screenshots/v51/sheet-element-${width}x${height}.png` })
    // file tab
    await editor.getByTestId('sheet-tab-file').tap()
    for (const id of ['env-editor-import', 'env-editor-export', 'env-editor-reset']) await expect(editor.getByTestId(id)).toBeVisible()
    await page.screenshot({ animations: 'disabled', path: `docs/screenshots/v51/sheet-files-${width}x${height}.png` })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true)
    await page.getByRole('button', { name: '속성 닫기' }).tap(); await expect(sheet).toBeHidden()
  }
})

test('phone: JSON import, export and reset from the Files tab', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'phone layout')
  page.on('dialog', d => d.accept()); await page.goto('./'); await navigate(page, 'editor')
  const editor = page.getByTestId('env-editor')
  await openSheet(editor, 'file')
  await editor.getByTestId('env-editor-import-input').setInputFiles({ name: 'swamp.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(swampMap)) })
  await expect(editor.getByTestId('terrain-2,2')).toHaveAttribute('data-cost', '-3')
  const download = page.waitForEvent('download'); await editor.getByTestId('env-editor-export').tap()
  const saved = JSON.parse(await (await import('node:fs/promises')).readFile((await (await download).path())!, 'utf8'))
  expect(saved).toMatchObject({ version: 4, width: 5, height: 5, terrains: [{ x: 2, y: 2, cost: -3 }], terrainCost: -2 })
  await editor.getByTestId('env-editor-import-input').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{') })
  await expect(page.getByTestId('env-editor-errors')).toBeVisible(); await expect(editor.getByTestId('terrain-2,2')).toBeVisible()
  await page.getByRole('button', { name: '알림 닫기' }).tap().catch(() => {})
  await editor.getByTestId('env-editor-reset').tap()
  await expect(editor.getByTestId('terrain-2,2')).toHaveCount(0)
  for (const version of [1, 2, 3]) {
    await editor.getByTestId('env-editor-import-input').setInputFiles({ name: `v${version}.json`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...config(4, 4), version })) })
    await expect(editor.getByTestId('cell-3,3')).toHaveAttribute('data-cell-kind', 'goal')
    await editor.getByTestId('env-editor-reset').tap()
  }
})

test('desktop keeps the single properties panel with files next to the map settings', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'desktop layout')
  page.on('dialog', d => d.accept()); await page.goto('./'); await navigate(page, 'editor')
  const editor = page.getByTestId('env-editor')
  await editor.getByRole('button', { name: '속성 / 파일' }).click()
  await expect(editor.getByRole('tablist')).toHaveCount(0)
  for (const id of ['env-editor-width-input', 'env-editor-import', 'env-editor-export', 'env-editor-reset']) await expect(editor.getByTestId(id)).toBeVisible()
})

type Box = { x: number; y: number; width: number; height: number }
const same = (a: Box, b: Box, what: string) => { for (const k of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(a[k] - b[k]), `${what}.${k}: ${a[k]} vs ${b[k]}`).toBeLessThanOrEqual(1) }

test('the completion toast floats over the grid: grid, camera and toolbar never move or resize', async ({ page }, info) => {
  test.setTimeout(150000)
  const sizes = info.project.name === 'mobile' ? PHONES : [[768, 1024], [1440, 900]] as const
  page.on('dialog', d => d.accept()); await page.goto('./'); await loadMap(page, config(5, 5)); await fastTraining(page)
  const area = page.getByTestId('learning-grid')
  const measure = async () => {
    const box = async (loc: ReturnType<Page['locator']>) => (await loc.boundingBox())!
    return { stack: await box(area.getByTestId('grid-stack')), viewport: await box(area.getByTestId('grid-viewport')), toolbar: await box(area.locator('.floating-toolbar')), zoom: await area.getByTestId('grid-stack').evaluate(el => getComputedStyle(el).transform + getComputedStyle(el).width) }
  }
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height }); await page.waitForTimeout(300); await setEpisodes(page, 8)
    await expect(page.getByTestId('environment-applied')).toBeVisible() // the map-applied notice is still showing
    const before = await measure()
    await page.screenshot({ animations: 'disabled', path: `docs/screenshots/v51/fixed-before-${width}x${height}.png` })
    await page.getByTestId('playback-run-episode').click()
    const toast = page.getByTestId('training-complete'); await expect(toast).toBeVisible()
    const during = await measure()
    same(before.stack, during.stack, 'grid'); same(before.viewport, during.viewport, 'viewport'); same(before.toolbar, during.toolbar, 'toolbar'); expect(during.zoom).toBe(before.zoom)
    // top centre of the grid area, below the toolbar, inside the screen
    const t = (await toast.boundingBox())!, v = during.viewport
    expect(Math.abs(t.x + t.width / 2 - (v.x + v.width / 2))).toBeLessThanOrEqual(width <= 430 ? 40 : 6)
    expect(t.y).toBeGreaterThanOrEqual(during.toolbar.y + during.toolbar.height - 1); expect(t.x).toBeGreaterThanOrEqual(0); expect(t.x + t.width).toBeLessThanOrEqual(width + 1)
    await page.screenshot({ animations: 'disabled', path: `docs/screenshots/v51/fixed-during-${width}x${height}.png` })
    await page.getByTestId('completion-close').click(); await expect(toast).toHaveCount(0)
    const after = await measure()
    same(before.stack, after.stack, 'grid after close'); same(before.viewport, after.viewport, 'viewport after close'); same(before.toolbar, after.toolbar, 'toolbar after close')
  }
})

test('Turbo completion toast does not move the dashboard or toolbar either', async ({ page }) => {
  test.setTimeout(120000)
  page.on('dialog', d => d.accept()); await page.goto('./'); await loadMap(page, config(4, 4)); await setEpisodes(page, 40)
  const area = page.getByTestId('learning-grid')
  await page.getByTestId('training-mode').selectOption('turbo')
  const bars = async () => ({ bar: (await area.locator('.floating-toolbar').boundingBox())!, stage: (await area.locator('.workspace-stage').boundingBox())! })
  const before = await bars()
  await page.getByTestId('playback-run-episode').click()
  const toast = page.getByTestId('training-complete'); await expect(toast).toBeVisible()
  const dash = page.getByTestId('turbo-dashboard'); await expect(dash).toContainText('완료')
  const during = await bars(), dashBox = (await dash.boundingBox())!
  same(before.bar, during.bar, 'toolbar'); same(before.stage, during.stage, 'stage')
  await page.waitForTimeout(300); same(dashBox, (await dash.boundingBox())!, 'dashboard')
  await page.getByTestId('completion-close').click(); await expect(toast).toHaveCount(0)
  same(dashBox, (await dash.boundingBox())!, 'dashboard after close')
})
