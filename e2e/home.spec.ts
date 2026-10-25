import { expect, test, type Page } from '@playwright/test'

async function navigate(page: Page, item: string) {
  const menu = page.locator('#mobile-menu')
  if (await menu.isVisible()) await menu.click()
  await page.getByTestId(`nav-${item}`).click()
}

const config = (width: number, height: number) => ({ version: 1, type: 'gridworld', width, height, start: { x: 0, y: 0 }, goals: [{ x: width - 1, y: height - 1 }], walls: [], bombs: [], stepReward: -0.1, wallPenalty: -1, goalReward: 10, bombPenalty: -10 })
async function loadMap(page: Page, data: object) {
  await navigate(page, 'editor')
  const editor = page.getByTestId('env-editor')
  await editor.getByRole('button', { name: /속성 \/ 파일/ }).click()
  await editor.getByTestId('env-editor-import-input').setInputFiles({ name: 'map.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) })
  await editor.getByTestId('env-editor-apply').click()
  await expectFits(page, 'env-editor')
  await editor.getByRole('button', { name: '속성 닫기' }).click()
  await expectFits(page, 'env-editor')
}
async function expectFits(page: Page, scope = 'learning-grid') {
  const grid = page.getByTestId(scope).getByTestId('grid-stack')
  await expect(grid).toBeVisible()
  await expect.poll(async () => {
    const box = await grid.boundingBox()
    const viewport = page.viewportSize()!
    const area = await page.getByTestId(scope).getByTestId('grid-viewport').boundingBox()
    const toolbar = await page.getByTestId(scope).locator('.floating-toolbar').boundingBox()
    const svg = page.getByTestId(scope).getByTestId('grid-svg')
    const columns = Number(await svg.getAttribute('width')) / 48
    const rows = Number(await svg.getAttribute('height')) / 48
    if (!box || !area) return false
    const cellSize = Math.min((area.width - 8) / columns, (area.height - 8) / rows)
    return box.width > 0 && box.x >= -1 && box.y >= -1 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1
      && Math.abs(box.width - columns * cellSize) < 1 && Math.abs(box.height - rows * cellSize) < 1
      && Math.abs(box.x - area.x - (area.width - box.width) / 2) < 1 && Math.abs(box.y - area.y - (area.height - box.height) / 2) < 1
      && (!toolbar || box.y >= toolbar.y + toolbar.height - 1)
  }).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
}

test('full-map fit across desktop sizes, map ratios, sidebar and analysis changes', async ({ page }, info) => {
  page.on('dialog', dialog => dialog.accept())
  await page.goto('./')
  for (const [width, height] of info.project.name === 'mobile' ? [[390, 664], [360, 640]] : [[1366, 768], [1440, 900], [1920, 1080]]) {
    await page.setViewportSize({ width, height })
    for (const [columns, rows] of [[3, 3], [20, 20], [3, 20], [20, 3]]) {
      await loadMap(page, config(columns, rows))
      await expectFits(page, 'env-editor')
      await navigate(page, 'environment')
      await expectFits(page)
      const box = (await page.getByTestId('learning-grid').getByTestId('grid-stack').boundingBox())!
      expect(box.width / box.height).toBeCloseTo(columns / rows, 2)
    }
    await loadMap(page, { ...config(20, 20), walls: [{ x: 4, y: 4 }, { x: 4, y: 5 }, { x: 4, y: 6 }, { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 12, y: 9 }, { x: 12, y: 10 }, { x: 12, y: 11 }], bombs: [{ x: 13, y: 13 }] })
    await navigate(page, 'environment')
    await expectFits(page)
    await page.screenshot({ animations: 'disabled', path: info.outputPath(`${info.project.name}-${width}x${height}.png`) })
  }
  await loadMap(page, config(20, 20))
  await navigate(page, 'environment')
  if (info.project.name === 'desktop') await page.locator('.collapse-button').click()
  await expectFits(page)
  const before = (await page.getByTestId('learning-grid').getByTestId('grid-stack').boundingBox())!.width
  await page.getByTestId('toggle-analysis').click()
  await expect(page.getByTestId('analysis-panel')).toBeVisible()
  await expectFits(page)
  const panelBox = (await page.getByTestId('analysis-panel').boundingBox())!
  const gridBox = (await page.getByTestId('learning-grid').getByTestId('grid-stack').boundingBox())!
  if (info.project.name === 'mobile') expect(gridBox.y + gridBox.height).toBeLessThanOrEqual(panelBox.y + 1)
  else expect(gridBox.x + gridBox.width).toBeLessThanOrEqual(panelBox.x + 1)
  expect((await page.getByTestId('learning-grid').getByTestId('grid-stack').boundingBox())!.width).toBeLessThanOrEqual(before)
  await page.screenshot({ animations: 'disabled', path: info.outputPath('desktop-analysis.png') })
  await page.getByRole('button', { name: '분석 닫기' }).click()
  await page.getByTestId('learning-grid').getByRole('button', { name: 'Zoom in' }).click()
  const viewport = page.getByTestId('learning-grid').getByTestId('grid-viewport')
  expect(await viewport.evaluate(element => element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight)).toBe(true)
  await viewport.evaluate(element => element.scrollTo(100, 100))
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true)
  await page.getByTestId('learning-grid').getByRole('button', { name: 'Fit entire map' }).click()
  await expectFits(page)
})

test('20x20 high speed training remains controllable and stop preserves learned values', async ({ page }, info) => {
  page.on('dialog', dialog => dialog.accept())
  await page.goto('./')
  await loadMap(page, config(20, 20))
  await navigate(page, 'environment')
  await page.getByTestId('speed-slider').focus()
  await page.keyboard.press('End')
  await page.getByTestId('playback-run-episode').click()
  await page.getByTestId('playback-pause').click()
  await expect(page.getByTestId('playback-resume')).toBeVisible()
  const count = await page.getByTestId('policy-overlay').locator('text').count()
  expect(count).toBeGreaterThan(0)
  await page.getByTestId('playback-stop').click()
  expect(await page.getByTestId('policy-overlay').locator('text').count()).toBe(count)
  await expectFits(page)
  await page.screenshot({ animations: 'disabled', path: info.outputPath(`${info.project.name}-trained-20x20.png`) })
})

test('floating controls, state preservation, stop, real rewards and independent editor', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('dialog', dialog => dialog.accept())
  await page.goto('./')
  await loadMap(page, { ...config(3, 3), start: { x: 0, y: 1 } })
  await page.screenshot({ animations: 'disabled', path: info.outputPath(`${info.project.name}-editor.png`) })
  await navigate(page, 'environment')
  await expectFits(page)
  await expect(page.getByRole('button', { name: /^스텝$|^초기화$|^Step$|^Reset$/ })).toHaveCount(0)
  await expect(page.locator('.page-heading:visible, .experiment-note:visible, .lab-toolbar:visible, .brand:visible')).toHaveCount(0)
  await page.getByRole('button', { name: '시각화', exact: true }).click()
  await expect(page.getByTestId('toggle-policy')).toBeChecked()
  await expect(page.getByTestId('toggle-value')).toBeChecked()
  await page.getByRole('button', { name: '설정', exact: true }).click()
  await page.getByTestId('epsilon-number').fill('0')
  await page.getByTestId('episode-count-input').fill('3')
  await page.getByRole('button', { name: '설정', exact: true }).click()
  await page.getByTestId('speed-slider').focus()
  await page.keyboard.press('Home')
  await page.getByTestId('learning-grid').getByTestId('cell-1,1').focus()
  await page.keyboard.press('Enter')
  await page.getByTestId('playback-run-episode').click()
  await page.getByTestId('playback-pause').click()
  await page.getByTestId('toggle-analysis').click()
  await expect(page.getByTestId('inspector-reward')).toHaveText('-0.100')
  const qBefore = await page.getByTestId('qvalue-bars').textContent()
  await page.getByRole('button', { name: '분석 닫기' }).click()
  await navigate(page, 'home')
  await navigate(page, 'results')
  await expect(page.getByTestId('qvalue-bars')).toHaveText(qBefore!)
  await navigate(page, 'environment')
  await page.getByTestId('playback-stop').click()
  await expect(page.getByTestId('playback-run-episode')).toBeEnabled()
  await page.getByTestId('toggle-analysis').click()
  await expect(page.getByTestId('qvalue-bars')).toHaveText(qBefore!)
  await page.getByRole('button', { name: '분석 닫기' }).click()
  await navigate(page, 'editor')
  const editor = page.getByTestId('env-editor')
  await editor.getByTestId('env-editor-mode-wall').click()
  await editor.getByTestId('cell-1,1').click()
  await navigate(page, 'home')
  await navigate(page, 'editor')
  await expect(editor.getByTestId('cell-1,1')).toHaveAttribute('data-cell-kind', 'wall')
  await expectFits(page, 'env-editor')
  await navigate(page, 'environment')
  await expectFits(page)
  await page.screenshot({ animations: 'disabled', path: info.outputPath(`${info.project.name}-learning.png`) })
  expect(errors).toEqual([])
})

test('11 visual presets preview without applying, and selected draft can be applied', async ({ page }) => {
  page.on('dialog', dialog => dialog.accept())
  await page.goto('./')
  await navigate(page, 'editor')
  const editor = page.getByTestId('env-editor')
  await editor.getByTestId('open-map-gallery').click()
  const thumbnails = page.locator('.gallery-thumbnails > button')
  await expect(thumbnails).toHaveCount(11)
  for (let index = 0; index < 11; index++) {
    await thumbnails.nth(index).click()
    await expect(thumbnails.nth(index)).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('.gallery-preview svg')).toBeVisible()
  }
  await page.getByRole('button', { name: '이 맵 선택' }).click()
  await editor.getByTestId('env-editor-apply').click()
  await expectFits(page, 'env-editor')
})

test('home auto animation loops and reduced motion remains paused', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('button', { name: '일시정지', exact: true })).toBeVisible()
  const demo = page.getByRole('img')
  const initial = await demo.getAttribute('aria-label')
  await expect.poll(() => demo.getAttribute('aria-label')).not.toBe(initial)
  await page.getByRole('button', { name: '일시정지', exact: true }).click()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await expect(page.getByRole('button', { name: '시연 재생' })).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: '본문으로 이동' })).toBeFocused()
})
