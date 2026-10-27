import { expect, type Locator, type Page } from '@playwright/test'

export async function navigate(page: Page, item: string) {
  if (item !== 'presets' && await page.locator('#preset-panel').isVisible()) await page.locator('#preset-panel > header button').click()
  const menu = page.locator('#mobile-menu')
  if (await menu.isVisible()) await menu.click()
  await page.getByTestId(`nav-${item}`).click()
}

export const config = (width: number, height: number) => ({ version: 1, type: 'gridworld', width, height, start: { x: 0, y: 0 }, goals: [{ x: width - 1, y: height - 1 }], walls: [], bombs: [], stepReward: -0.1, wallPenalty: -1, goalReward: 10, bombPenalty: -10 })
export async function loadMap(page: Page, data: object) {
  await navigate(page, 'editor')
  const editor = page.getByTestId('env-editor')
  await openSheet(editor, 'file')
  await editor.getByTestId('env-editor-import-input').setInputFiles({ name: 'map.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) })
  await editor.getByTestId('env-editor-apply').click()
  await expect(page.getByTestId('learning-grid')).toBeVisible()
  await expectFits(page)
}
export async function expectFits(page: Page, scope = 'learning-grid') {
  const grid = page.getByTestId(scope).getByTestId('grid-stack')
  await expect(grid).toBeVisible()
  await expect.poll(async () => {
    const box = await grid.boundingBox()
    const viewport = page.viewportSize()!
    const area = await page.getByTestId(scope).getByTestId('grid-viewport').boundingBox()
    // Desktop floats a toolbar over the stage; the phone editor stacks tool row, status row and action bar around it.
    const top = page.getByTestId(scope).locator('.floating-toolbar, .mobile-status'), bottom = page.getByTestId(scope).locator('.mobile-actions')
    const toolbar = (await top.count()) ? await top.first().boundingBox() : null
    const actions = (await bottom.count()) ? await bottom.first().boundingBox() : null
    const svg = page.getByTestId(scope).getByTestId('grid-svg')
    const columns = Number(await svg.getAttribute('width')) / 48
    const rows = Number(await svg.getAttribute('height')) / 48
    if (!box || !area) return false
    const cellSize = Math.min((area.width - 8) / columns, (area.height - 8) / rows)
    return box.width > 0 && box.x >= -1 && box.y >= -1 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1
      && Math.abs(box.width - columns * cellSize) < 1 && Math.abs(box.height - rows * cellSize) < 1
      && Math.abs(box.x - area.x - (area.width - box.width) / 2) < 1 && Math.abs(box.y - area.y - (area.height - box.height) / 2) < 1
      && (!toolbar || box.y >= toolbar.y + toolbar.height - 1)
      && (!actions || box.y + box.height <= actions.y + 1)
  }).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
}

/**
 * Opens the editor's settings panel and, on phones, switches the bottom sheet to the wanted tab
 * (desktop has a single properties panel, so the tab step is skipped there).
 */
export async function openSheet(scope: Locator, tab: 'map' | 'element' | 'file' = 'file') {
  // Idempotent: the panel keeps its open state between steps, and the button toggles it.
  if (!(await scope.locator('#editor-properties').isVisible())) await scope.getByRole('button', { name: /^(속성 \/ 파일|설정 · 파일)$/ }).click()
  const tabButton = scope.getByTestId(`sheet-tab-${tab}`)
  if (await tabButton.count()) await tabButton.click()
}
