import { expect, test } from '@playwright/test'

test('home, demo, workspace, editor and results work under the Pages base path', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('./')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('강화학습 시뮬레이터')
  await expect(page.getByTestId('experiment-workspace')).toBeHidden()
  await page.getByRole('button', { name: '한 칸 이동' }).click()
  await expect(page.getByRole('img')).toHaveAttribute('aria-label', /1번 이동/)
  await page.screenshot({ path: testInfo.outputPath('home.png'), fullPage: true })
  await page.getByRole('button', { name: /학습 시작하기/ }).click()
  await page.getByTestId('cell-1,1').focus()
  await page.keyboard.press('Enter')
  await page.getByTestId('playback-step').click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  const inspected = await page.getByTestId('inspector-state').textContent()
  const nav = async (item: string) => {
    if (testInfo.project.name === 'mobile') await page.locator('#mobile-menu').click()
    await page.getByTestId(`nav-${item}`).click()
  }
  await nav('home')
  await nav('results')
  await expect(page.getByTestId('inspector-state')).toHaveText(inspected!)
  await expect(page.getByTestId('qvalue-bars')).toContainText('1,1')
  await nav('editor')
  await expect(page.locator('#environment-editor')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('editor.png'), fullPage: true })
  await nav('home')
  await page.getByTestId('language-selector').filter({ visible: true }).selectOption('en')
  await expect(page.getByRole('button', { name: /Start learning/ })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(errors).toEqual([])
})

test('keyboard navigation and reduced motion', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('./')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('강화학습 시뮬레이터')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: '본문으로 이동' })).toBeFocused()
  expect(await page.locator('.demo-agent').evaluate(element => getComputedStyle(element).transitionDuration)).toBe('0s')
  if (testInfo.project.name === 'mobile') {
    await page.keyboard.press('Tab')
    await expect(page.locator('#mobile-menu')).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('.collapse-button')).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(page.locator('#mobile-menu')).toBeFocused()
    await expect(page.locator('.sidebar')).not.toBeInViewport()
  } else {
    await page.locator('.collapse-button').click()
    await expect(page.locator('.app-shell')).toHaveClass(/is-collapsed/)
    await expect(page.getByTestId('nav-environment')).toHaveAccessibleName('학습 환경')
  }
})
