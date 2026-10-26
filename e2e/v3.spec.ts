import { expect, test } from '@playwright/test'
import { expectFits, navigate } from './helpers'

const V3 = [
  ['25_obsidian_citadel', '24 × 24', '6 목표', 211],
  ['26_abyssal_fortress', '28 × 24', '8 목표', 234],
  ['27_fractured_metropolis', '32 × 32', '9 목표', 190],
  ['28_nemesis_complex', '31 × 25', '6 목표', 202],
  ['29_empire_of_oblivion', '40 × 40', '10 목표', 324],
  ['30_the_endless_labyrinth', '48 × 40', '12 목표', 419],
] as const

test('V3 very-hard gallery shows six maps with real previews, metadata and applies each', async ({ page }, info) => {
  test.setTimeout(240000); page.on('dialog', d => d.accept())
  const sizes = info.project.name === 'mobile' ? [[390, 844]] : [[1366, 768], [1440, 900], [1920, 1080], [768, 1024]]
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height }); await page.goto('./')
    await navigate(page, 'presets')
    const gallery = page.locator('#preset-panel')
    await gallery.getByRole('tab', { name: /매우 어려움/ }).click()
    await expect(gallery.locator('.gallery-thumbnails > button')).toHaveCount(6)
    for (const img of await gallery.locator('.gallery-thumbnails img').all()) expect(await img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true)
    for (const [stem, size, goals, steps] of V3) {
      await gallery.getByTestId(`preset-${stem}`).click()
      const preview = gallery.locator('.gallery-preview')
      await expect(preview).toContainText(size); await expect(preview).toContainText(goals); await expect(preview).toContainText('매우 어려움')
      await expect(preview).toContainText(`${steps} 스텝`)
      await expect(preview).toContainText('필수 여부 미검증')
      if (stem === '25_obsidian_citadel' || stem === '30_the_endless_labyrinth') await page.screenshot({ animations: 'disabled', path: `docs/screenshots/v3/gallery-${stem.slice(0, 2)}-${width}x${height}.png` })
    }
    // Search / difficulty filter sanity: a V3 tier tab never shows other tiers.
    await gallery.getByTestId('preset-27_fractured_metropolis').click()
    await gallery.getByRole('button', { name: '편집기로 불러오기' }).click()
    await expect(page.getByTestId('env-editor')).toBeVisible()
    await navigate(page, 'presets'); await gallery.getByRole('tab', { name: /매우 어려움/ }).click()
    for (const [stem] of V3) {
      await gallery.getByTestId(`preset-${stem}`).click()
      await gallery.getByRole('button', { name: '맵 적용하기', exact: true }).click()
      await expectFits(page)
      await expect(page.getByTestId('episode-count-input')).toHaveValue('2000')
      if (stem === '30_the_endless_labyrinth') await page.screenshot({ animations: 'disabled', path: `docs/screenshots/v3/learning-30-${width}x${height}.png` })
      await navigate(page, 'presets'); await gallery.getByRole('tab', { name: /매우 어려움/ }).click()
    }
  }
})

test('V3 maps: manual play, Q-Learning and SARSA turbo start/stop, greedy run', async ({ page }, info) => {
  test.setTimeout(240000); page.on('dialog', d => d.accept()); await page.goto('./')
  for (const [stem] of [V3[0], V3[4], V3[5]]) {
    await navigate(page, 'presets'); await page.getByTestId(`preset-${stem}`).click(); await page.getByRole('button', { name: '맵 적용하기', exact: true }).click()
    for (const algo of ['q-learning', 'sarsa']) {
      await page.getByRole('button', { name: '설정', exact: true }).click()
      await page.getByTestId('algorithm-select').selectOption(algo)
      await page.getByRole('button', { name: '설정', exact: true }).click()
      await page.getByTestId('training-mode').selectOption('turbo')
      await page.getByTestId('playback-run-episode').click()
      await expect(page.getByTestId('turbo-dashboard')).toBeVisible()
      await page.waitForTimeout(1500)
      await expect(page.getByTestId('turbo-episodes')).not.toHaveText('0')
      await page.getByTestId('playback-stop').click()
      await expect(page.getByTestId('turbo-dashboard')).toContainText('중단')
      await page.getByTestId('playback-run-greedy').click()
      await expect(page.getByTestId('learning-grid').getByTestId('grid-svg')).toBeVisible()
      await page.getByTestId('playback-stop').click()
    }
    if (stem.startsWith('30')) await page.screenshot({ animations: 'disabled', path: `docs/screenshots/v3/turbo-30-${info.project.name}.png` })
    await navigate(page, 'editor')
    await page.getByTestId('manual-play-start').click()
    const manual = page.getByTestId('manual-play'); await expect(manual.getByTestId('grid-svg')).toBeVisible()
    await page.keyboard.down('d'); await page.waitForTimeout(300); await page.keyboard.up('d')
    expect(Number(await manual.getByTestId('manual-progress').getAttribute('data-steps'))).toBeGreaterThanOrEqual(1)
    await manual.getByRole('button', { name: '편집으로 돌아가기 (Esc)' }).click()
  }
})
