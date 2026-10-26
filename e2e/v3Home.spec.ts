import { expect, test } from '@playwright/test'

test('home demo plays map 30 to its 419th action, shows success, then swaps in another map', async ({ page }, info) => {
  test.setTimeout(120000)
  await page.addInitScript(() => { Math.random = () => .999999 })
  await page.clock.install()
  const [width, height] = info.project.name === 'mobile' ? [390, 844] : [1440, 900]
  await page.setViewportSize({ width, height }); await page.goto('./')
  await page.getByRole('button', { name: '일시정지', exact: true }).click()
  for (let i = 0; i < 7; i++) await page.getByRole('button', { name: '맵 섞기' }).click()
  const demo = page.locator('.mini-demo[data-scenario="30_the_endless_labyrinth"]')
  await expect(demo).toBeVisible(); await expect(demo).toHaveAttribute('data-step', '0')
  await expect(demo).toContainText('0/419')
  await page.getByRole('button', { name: '시연 재생', exact: true }).click()
  let previous = 0, seenDone = false, swapped = false
  for (let tick = 0; tick < 400 && !swapped; tick++) {
    await page.clock.runFor(500)
    if (await demo.count() === 0) { swapped = true; break }
    const step = Number(await demo.getAttribute('data-step'))
    expect(step).toBeGreaterThanOrEqual(previous); expect(step).toBeLessThanOrEqual(419); previous = step
    if (await demo.getAttribute('data-done') === 'true') {
      if (!seenDone) { seenDone = true; expect(step).toBe(419); await expect(demo).toContainText('✓'); await page.screenshot({ animations: 'disabled', path: `docs/screenshots/v3/home-demo-30-done-${info.project.name}.png` }) }
    }
  }
  expect(seenDone).toBe(true)
  expect(swapped).toBe(true)
  await expect(page.locator('.mini-demo')).toHaveCount(4)
  await expect(page.locator('.mini-demo[data-scenario="30_the_endless_labyrinth"]')).toHaveCount(0)
})
