import { expect, test } from '@playwright/test'
import { navigate } from './helpers'

test('manual play and dismissible import errors preserve editing across all target sizes', async ({ page }, info) => {
  for (const [width, height] of info.project.name === 'mobile' ? [[390,844]] : [[1366,768],[1440,900],[1920,1080],[768,1024]]) {
    await page.setViewportSize({ width, height }); await page.goto('./'); await navigate(page, 'editor')
    const editor = page.getByTestId('env-editor')
    await editor.getByTestId('cell-2,2').click()
    await editor.getByTestId('manual-play-start').click()
    const play = page.getByTestId('manual-play')
    await expect(play).toBeVisible()
    await play.getByRole('button', { name: '오른쪽', exact: true }).click()
    await page.keyboard.press('s')
    await expect(play.getByTestId('manual-progress')).toHaveAttribute('data-steps', '2')
    const grid = (await play.getByTestId('grid-stack').boundingBox())!
    expect(grid.width).toBeGreaterThan(200)
    const svg = (await play.getByTestId('grid-svg').boundingBox())!
    expect(Math.abs(svg.width - grid.width)).toBeLessThan(1)
    expect(Math.abs(svg.height - grid.height)).toBeLessThan(1)
    expect(grid.y + grid.height).toBeLessThan(height)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await page.screenshot({ animations: 'disabled', path: info.outputPath(`usability-manual-${width}x${height}.png`) })
    await page.keyboard.press('Escape')
    await expect(play).toHaveCount(0)
    await expect(editor.getByTestId('cell-2,2')).toHaveAttribute('data-cell-kind', 'wall')
    await editor.getByTestId('editor-undo').click()
    await expect(editor.getByTestId('cell-2,2')).not.toHaveAttribute('data-cell-kind', 'wall')
    await editor.getByRole('button', { name: '속성 / 파일' }).click()
    const invalid = { name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{') }
    await editor.getByTestId('env-editor-import-input').setInputFiles(invalid)
    const notice = page.getByTestId('env-editor-errors')
    await expect(notice).toBeVisible()
    const box = (await notice.boundingBox())!, sidebar = (await page.locator('.sidebar').boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(Math.max(0, sidebar.x + sidebar.width))
    const toolbar = (await editor.locator('.floating-toolbar, .mobile-status').first().boundingBox())!
    expect(box.y).toBeGreaterThanOrEqual(toolbar.y + toolbar.height)
    await page.screenshot({ animations: 'disabled', path: info.outputPath(`usability-notice-${width}x${height}.png`) })
    await notice.getByRole('button', { name: '알림 닫기' }).focus(); await page.keyboard.press('Enter')
    await expect(notice).toHaveCount(0)
    await editor.getByTestId('env-editor-import-input').setInputFiles(invalid)
    await expect(notice).toBeVisible()
    await notice.getByRole('button', { name: '알림 닫기' }).click()
    await editor.getByRole('button', { name: '속성 닫기' }).click()
    await navigate(page, 'guide')
    await page.getByRole('button', { name: /다음 장/ }).click()
    await expect(page.locator('#chapter-1')).toBeVisible()
    await page.getByRole('navigation', { name: '단원 목차' }).getByRole('button').nth(5).click()
    await page.getByRole('button', { name: '학습 로드맵으로 →' }).click()
    await expect(page.locator('#learning-roadmap')).toBeFocused()
    await page.screenshot({ animations: 'disabled', path: info.outputPath(`usability-roadmap-${width}x${height}.png`) })
  }
})
