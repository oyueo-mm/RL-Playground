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

test('a normally finished run opens the completion dialog with this run’s real numbers, once', async ({ page }) => {
  test.setTimeout(120000)
  page.on('dialog', d => d.accept()); await page.goto('./')
  await loadMap(page, config(3, 3)); await fastTraining(page); await setEpisodes(page, 25)
  await page.getByTestId('playback-run-episode').click()
  const box = page.getByTestId('training-complete')
  await expect(box).toBeVisible()
  await expect(box).toContainText('학습 완료!'); await expect(box).toContainText('25개 에피소드')
  await expect(page.getByTestId('completion-episodes')).toHaveText('25')
  const success = (await page.getByTestId('completion-success').textContent())!, [, hit, total] = /\((\d+) \/ (\d+)\)/.exec(success)!
  expect(Number(total)).toBe(25); expect(success).toContain(`${(Number(hit) / 25 * 100).toFixed(1)}%`)
  expect(await page.getByTestId('completion-reward').textContent()).toMatch(/^[+−]?\d+\.\d{2}$/)
  // The dialog stays closed on its own afterwards and across navigation.
  await page.keyboard.press('Escape'); await expect(box).toHaveCount(0)
  await navigate(page, 'results'); await navigate(page, 'environment'); await page.waitForTimeout(800)
  await expect(box).toHaveCount(0)
  // A second request reports only itself.
  await setEpisodes(page, 10); await page.getByTestId('playback-run-episode').click()
  await expect(page.getByTestId('completion-episodes')).toHaveText('10')
  // View results: navigates and keeps the learned data.
  const rows = await page.evaluate(() => document.querySelector('[data-testid=q-state-count]')?.textContent ?? '')
  await page.getByTestId('completion-results').click()
  await expect(page.getByTestId('nav-results')).toHaveAttribute('aria-current', 'page'); await expect(box).toHaveCount(0)
  await navigate(page, 'environment'); expect(await page.evaluate(() => document.querySelector('[data-testid=q-state-count]')?.textContent ?? '')).toBe(rows)
})

test('Turbo Training finishes with the same dialog', async ({ page }) => {
  test.setTimeout(120000)
  page.on('dialog', d => d.accept()); await page.goto('./')
  await loadMap(page, config(4, 4)); await setEpisodes(page, 40)
  await page.getByTestId('training-mode').selectOption('turbo'); await page.getByTestId('playback-run-episode').click()
  await expect(page.getByTestId('training-complete')).toBeVisible()
  await expect(page.getByTestId('completion-episodes')).toHaveText('40'); await expect(page.getByTestId('training-complete')).toContainText('Turbo')
  await page.getByTestId('completion-close').click()
  await expect(page.getByTestId('turbo-dashboard')).toContainText('완료')
})

test('stopping, pausing and greedy replay never show the dialog', async ({ page }) => {
  test.setTimeout(120000)
  page.on('dialog', d => d.accept()); await page.goto('./')
  await loadMap(page, config(9, 9)); await setEpisodes(page, 100000)
  const dialog = page.getByTestId('training-complete')
  await page.getByTestId('playback-run-episode').click(); await page.waitForTimeout(500)
  await page.getByTestId('playback-pause').click(); await page.waitForTimeout(600); await expect(dialog).toHaveCount(0)
  await page.getByTestId('playback-resume').click(); await page.waitForTimeout(300)
  await page.getByTestId('playback-stop').click(); await page.waitForTimeout(600); await expect(dialog).toHaveCount(0)
  await page.getByTestId('playback-run-greedy').click(); await page.waitForTimeout(800); await page.getByTestId('playback-stop').click()
  await expect(dialog).toHaveCount(0)
})

test('the dialog fits phones and desktop, and keyboard users reach its actions', async ({ page }, info) => {
  test.setTimeout(120000)
  const sizes = info.project.name === 'mobile' ? PHONES : [[1440, 900]] as const
  page.on('dialog', d => d.accept()); await page.goto('./'); await loadMap(page, config(3, 3)); await fastTraining(page)
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height }); await setEpisodes(page, 8)
    await page.getByTestId('playback-run-episode').click()
    const box = page.getByTestId('training-complete'); await expect(box).toBeVisible()
    const b = (await box.boundingBox())!
    expect(b.x).toBeGreaterThanOrEqual(0); expect(b.x + b.width).toBeLessThanOrEqual(width + 1); expect(b.y).toBeGreaterThanOrEqual(0); expect(b.y + b.height).toBeLessThanOrEqual(height + 1)
    for (const id of ['completion-close', 'completion-results']) expect((await page.getByTestId(id).boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await expect(page.getByTestId('completion-results')).toBeFocused()
    await page.keyboard.press('Tab'); await expect(page.getByTestId('completion-close')).toBeFocused() // wraps inside the modal
    await page.keyboard.press('Shift+Tab'); await expect(page.getByTestId('completion-results')).toBeFocused()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await page.screenshot({ animations: 'disabled', path: `docs/screenshots/v51/completion-${width}x${height}.png` })
    await page.keyboard.press('Escape'); await expect(box).toHaveCount(0)
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
