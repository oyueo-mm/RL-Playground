import { expect, test } from '@playwright/test'
import { navigate } from './helpers'

const SIZES = [[390, 844], [768, 1024], [1366, 768], [1440, 900], [1920, 1080]] as const
const rgb = (hex: string) => { const n = parseInt(hex.slice(1), 16); return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})` }

test('home shows only the title, two actions and four demos with the blue palette at every size', async ({ page }, info) => {
  test.setTimeout(120000)
  const sizes = info.project.name === 'mobile' ? SIZES.slice(0, 1) : SIZES.slice(1)
  const errors: string[] = [], bad: string[] = []
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', e => errors.push(e.message))
  page.on('response', r => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`) })
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height }); await page.goto('./')
    const home = page.locator('.home-page')
    await expect(home.locator('.hero-copy h2')).toBeVisible()
    // nothing but the title and two actions in the hero; the removed copy is gone from the DOM
    expect(await page.locator('.hero-copy').evaluate(el => el.children.length)).toBe(2)
    const text = await page.evaluate(() => { const h = document.querySelector('.home-page')!.cloneNode(true) as HTMLElement; h.querySelector('.demo-card')!.remove(); return h.textContent ?? '' })
    for (const gone of ['INTERACTIVE', '작은 움직임', '스스로 탐험', '설치 없이', 'Q-Learning', 'SARSA', 'GridWorld', 'BUILT FOR', '탐험하고, 이해하고']) expect(text).not.toContain(gone)
    expect(await page.evaluate(() => document.body.textContent!.includes('Workspace'))).toBe(false)
    await expect(page.locator('.mini-demo')).toHaveCount(4)
    // palette
    const colors = await page.evaluate(() => {
      const h2 = document.querySelector('.hero-copy h2')!, span = h2.querySelector('span')!, cta = document.querySelector('.hero-actions .primary-button')!
      return { page: getComputedStyle(document.documentElement).backgroundColor, first: getComputedStyle(h2).color, second: getComputedStyle(span).color, cta: getComputedStyle(cta).backgroundColor, ctaText: getComputedStyle(cta).color, sidebar: getComputedStyle(document.querySelector('.sidebar')!).backgroundColor, card: getComputedStyle(document.querySelector('.demo-card')!).backgroundColor, cardBorder: getComputedStyle(document.querySelector('.demo-card')!).borderTopColor }
    })
    expect(colors).toEqual({ page: rgb('#FAFBFD'), first: rgb('#171A20'), second: rgb('#0754A5'), cta: rgb('#0754A5'), ctaText: rgb('#FFFFFF'), sidebar: rgb('#FFFFFF'), card: rgb('#FFFFFF'), cardBorder: rgb('#E1E6ED') })
    // layout: title not clipped, no horizontal scroll, CTA comfortably tappable
    const title = (await page.locator('.hero-copy h2').boundingBox())!
    expect(title.x).toBeGreaterThanOrEqual(0); expect(title.x + title.width).toBeLessThanOrEqual(width + 1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    expect((await page.locator('.hero-actions .primary-button').boundingBox())!.height).toBeGreaterThanOrEqual(44)
    expect(await page.evaluate(() => [...document.querySelectorAll('.hero-copy h2')].every(h => h.scrollWidth <= h.clientWidth + 1))).toBe(true)
    await page.screenshot({ animations: 'disabled', path: info.outputPath(`blue-home-${width}x${height}.png`) })
  }
  expect(bad).toEqual([]); expect(errors).toEqual([])
})

test('keyboard focus is visible and blue, selection states use the blue tint, and no green interface color remains', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'keyboard pass on desktop')
  await page.goto('./')
  await page.locator('.hero-actions .primary-button').focus()
  const ring = await page.locator('.hero-actions .primary-button').evaluate(el => { const c = getComputedStyle(el); return { color: c.outlineColor, width: c.outlineWidth, style: c.outlineStyle } })
  expect(ring).toEqual({ color: rgb('#2479D8'), width: '3px', style: 'solid' })
  await expect.poll(() => page.getByTestId('nav-home').evaluate(el => getComputedStyle(el).backgroundColor)).toBe(rgb('#EAF2FC'))
  await navigate(page, 'environment')
  await expect.poll(() => page.locator('[data-testid=nav-environment]').evaluate(el => getComputedStyle(el).color)).toBe(rgb('#0754A5')) // after the .15s transition
  await page.screenshot({ animations: 'disabled', path: info.outputPath('blue-environment-desktop.png') })
  // the interface (not the grid) carries no sage-green: scan computed colors of visible chrome elements
  const green = await page.evaluate(() => {
    const out: string[] = []
    for (const el of document.querySelectorAll('.sidebar *, .floating-toolbar *, .topbar *, .zoom-controls *')) {
      const s = getComputedStyle(el)
      for (const value of [s.color, s.backgroundColor, s.borderTopColor]) {
        const m = /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/.exec(value); if (!m || (m[4] !== undefined && Number(m[4]) === 0)) continue
        const [r, g, b] = [+m[1], +m[2], +m[3]]; const max = Math.max(r, g, b), min = Math.min(r, g, b)
        if (max - min > 12 && g === max && g - Math.max(r, b) > 8) out.push(`${el.className} ${value}`)
      }
    }
    return out
  })
  expect(green).toEqual([])
})

test('mobile menu and language switching keep working on the simplified home', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'mobile-only')
  await page.goto('./')
  await expect(page.locator('header.topbar')).toBeVisible()
  expect(await page.locator('header.topbar').innerText()).not.toContain('Workspace')
  await page.locator('#mobile-menu').click()
  await expect(page.getByTestId('nav-guide')).toBeVisible()
  await page.getByTestId('nav-guide').click()
  await expect(page.locator('#chapter-0')).toBeVisible()
  await page.locator('#mobile-menu').click(); await page.getByTestId('nav-home').click()
  await page.locator('.mobile-language [data-testid=language-selector]').selectOption('en')
  await expect(page.locator('.hero-copy h2')).toContainText('Reinforcement')
  await expect(page.getByRole('button', { name: /Start learning/ })).toBeVisible()
  await page.screenshot({ animations: 'disabled', path: info.outputPath('blue-home-en-390x844.png') })
})
