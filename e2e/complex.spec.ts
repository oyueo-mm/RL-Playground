import { expect, test, type Page } from '@playwright/test'
import { navigate, expectFits } from './helpers'

async function drag(page: Page, from: string, to: string, touch = false, cancel = false) {
  const editor = page.getByTestId('env-editor')
  const source = (await editor.getByTestId(`cell-${from}`).boundingBox())!
  const target = (await editor.getByTestId(`cell-${to}`).boundingBox())!
  const start = { x: source.x + source.width / 2, y: source.y + source.height / 2 }
  const end = { x: target.x + target.width / 2, y: target.y + target.height / 2 }
  if (touch) {
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...start, id: 1 }] })
    for (let i = 1; i <= 5; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + (end.x - start.x) * i / 5, y: start.y + (end.y - start.y) * i / 5, id: 1 }] })
    await expect(editor.getByTestId('drag-preview')).toBeVisible()
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await cdp.detach()
  } else {
    await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(end.x, end.y, { steps: 6 })
    await expect(editor.getByTestId('drag-preview')).toBeVisible()
    if (cancel) await page.keyboard.press('Escape')
    await page.mouse.up()
  }
}

test('element drag, touch, overwrite, automatic links and undo preserve the experiment', async ({ page }, info) => {
  await page.goto('./'); await navigate(page, 'editor')
  const e = page.getByTestId('env-editor')
  await e.getByTestId('cell-1,1').click(); await e.getByTestId('env-editor-mode-select').click()
  if (info.project.name === 'mobile') await e.getByTestId('touch-move-mode').click()
  await drag(page, '1,1', '3,3', info.project.name === 'mobile')
  await expect(e.getByTestId('cell-3,3')).toHaveAttribute('data-cell-kind', 'wall')
  await expect(e.getByTestId('selected-cell-outline')).toHaveAttribute('x', '144')
  await e.getByTestId('editor-undo').click(); await expect(e.getByTestId('cell-1,1')).toHaveAttribute('data-cell-kind', 'wall')
  await e.getByTestId('editor-redo').click()
  await drag(page, '3,3', '4,4', false, true)
  await expect(e.getByTestId('cell-3,3')).toHaveAttribute('data-cell-kind', 'wall')
  await drag(page, '0,0', '0,1')
  await expect(e.getByTestId('cell-0,1')).toHaveAttribute('data-cell-kind', 'start')
  await e.getByTestId('env-editor-mode-portal').click()
  for (const cell of ['1,2','5,2','1,4','5,4']) await e.getByTestId(`cell-${cell}`).click()
  await expect(e.getByTestId('current-link-id')).toContainText('P3')
  await e.getByTestId('env-editor-mode-select').click(); await drag(page, '1,2', '2,4')
  await expect(e.getByTestId('portal-2,4')).toContainText('P1')
  await e.getByRole('button', { name: 'Zoom in' }).click(); await e.getByRole('button', { name: 'Zoom in' }).click()
  await drag(page, '2,4', '3,4')
  await expect(e.getByTestId('portal-3,4')).toContainText('P1')
  await e.getByRole('button', { name: 'Fit entire map' }).click()
  await e.getByTestId('env-editor-mode-switch').click(); await e.getByTestId('cell-1,3').click()
  await e.getByTestId('env-editor-mode-toggleWall').click(); await e.getByTestId('cell-2,3').click()
  await expect(e.getByTestId('current-link-id')).toHaveText('G2')
  await e.getByTestId('env-editor-mode-select').click(); await drag(page, '1,3', '1,5')
  await expect(e.getByTestId('switch-1,5')).toContainText('G1')
  await e.getByTestId('env-editor-mode-bomb').click(); await e.getByTestId('cell-4,1').click()
  await e.getByTestId('env-editor-mode-wall').click(); await e.getByTestId('cell-4,1').click()
  await expect(e.getByTestId('cell-4,1')).toHaveAttribute('data-cell-kind', 'wall')
  await e.getByTestId('editor-undo').click(); await expect(e.getByTestId('cell-4,1')).toHaveAttribute('data-cell-kind', 'bomb')
  await e.getByTestId('editor-redo').click()
  await e.getByTestId('cell-5,2').click()
  await expect(e.getByTestId('env-editor-apply')).toBeDisabled()
  await e.getByTestId('editor-undo').click(); await expect(e.getByTestId('env-editor-apply')).toBeEnabled()
  await expectFits(page, 'env-editor')
  await page.screenshot({ animations: 'disabled', path: info.outputPath(`complex-editor-${info.project.name}.png`) })
  await navigate(page, 'environment')
  await expect(page.getByTestId('q-state-count')).toHaveText('0')
})

test('home real-rule scenarios and one guide scroll container fit all requested sizes', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
  for (const [width, height] of info.project.name === 'mobile' ? [[390,844]] : [[1366,768],[1440,900],[1920,1080],[768,1024]]) {
    await page.setViewportSize({ width, height }); await page.goto('./')
    await page.getByRole('button', { name: '일시정지', exact: true }).click()
    if (width >= 1200) {
      const copy = (await page.locator('.hero-copy').boundingBox())!, demo = (await page.locator('.demo-card').boundingBox())!
      expect(Math.abs(copy.y - demo.y)).toBeLessThan(1)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await page.screenshot({ animations: 'disabled', path: info.outputPath(`complex-home-${width}x${height}.png`) })
    const demo = page.locator('.demo-card')
    await expect(demo.locator('.mini-demo')).toHaveCount(4)
    const ids = await demo.locator('.mini-demo').evaluateAll(cards => cards.map(card => card.getAttribute('data-scenario')))
    expect(new Set(ids).size).toBe(4)
    await demo.getByRole('button', { name: '한 칸 이동' }).click()
    for (const card of await demo.locator('.mini-demo').all()) await expect(card).toHaveAttribute('data-step', /^[1-9]\d*$/)
    await demo.getByRole('button', { name: '맵 섞기' }).click()
    const next = await demo.locator('.mini-demo').evaluateAll(cards => cards.map(card => card.getAttribute('data-scenario')))
    expect(next.some(id => ids.includes(id))).toBe(false)
    await page.screenshot({ animations: 'disabled', path: info.outputPath(`catalog-gallery-${width}x${height}.png`) })
    await navigate(page, 'guide')
    const heading = page.locator('.guide-heading'), scroll = page.locator('.guide-page')
    const scrollTop = (await scroll.boundingBox())!.y
    await scroll.evaluate(el => el.scrollTo(0, 300))
    await expect.poll(async () => { const box = (await heading.locator('h2').boundingBox())!; return box.y + box.height }).toBeLessThanOrEqual(scrollTop + 1)
    await page.getByRole('navigation', { name: '단원 목차' }).getByRole('button').nth(4).click()
    await page.getByTestId('sarsa-result').scrollIntoViewIfNeeded()
    await expect(page.getByTestId('sarsa-result')).toHaveText('0.95')
    await page.screenshot({ animations: 'disabled', path: info.outputPath(`complex-guide-${width}x${height}.png`) })
    expect(await page.locator('#sidebar-navigation').evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await page.getByTestId('language-selector').filter({ visible: true }).selectOption('en')
    await expect(page.getByRole('navigation', { name: 'Chapter contents' })).toBeVisible()
  }
  expect(errors).toEqual([])
})

test('huge presets are applicable and actual budgets safely pause with distinct truncation', async ({ page }, info) => {
  page.on('dialog', d => d.accept()); await page.goto('./'); await navigate(page, 'presets')
  await page.getByTestId('preset-search').fill('붕괴하는 군도')
  await expect(page.locator('.gallery-thumbnails > button')).toHaveCount(1)
  await page.getByTestId('preset-21_collapsing_archipelago').click(); await page.getByRole('button', { name: '맵 적용하기' }).click()
  await navigate(page, 'editor'); await page.getByRole('button', { name: '속성 / 파일' }).click()
  await expect(page.getByTestId('env-editor-apply')).toBeEnabled()
  await expect(page.locator('.complexity-warning')).toBeVisible()
  await expect(page.getByTestId('state-space-estimate')).not.toContainText(/Infinity|NaN/)
  await page.getByRole('button', { name: '속성 닫기' }).click()
  await navigate(page, 'environment'); await page.getByRole('button', { name: '설정', exact: true }).click()
  await page.getByTestId('resource-info').locator('summary').click()
  await page.getByTestId('budget-maxRecordedSteps').fill('5'); await page.getByTestId('budget-maxEpisodeSteps').fill('2')
  await page.getByRole('button', { name: '설정', exact: true }).click()
  await page.getByTestId('speed-slider').focus(); await page.keyboard.press('End')
  await page.getByTestId('playback-run-episode').click()
  await expect.poll(async () => Number(await page.getByTestId('resource-total-steps').getAttribute('data-total-steps'))).toBeGreaterThan(5)
  await expect(page.getByTestId('resource-pause-reason')).toHaveCount(0)
  await expect(page.getByTestId('playback-run-episode')).toBeEnabled()
  const rows = await page.getByTestId('q-state-count').textContent()
  await page.getByRole('button', { name: '설정', exact: true }).click()
  await page.getByTestId('budget-maxRecordedSteps').fill('20')
  await page.getByRole('button', { name: '설정', exact: true }).click()
  await expect(page.getByTestId('q-state-count')).toHaveText(rows!)
  await page.getByTestId('toggle-analysis').click()
  await expect(page.getByTestId('termination-chart-bar-truncated')).toContainText('스텝 제한')
  await page.screenshot({ animations: 'disabled', path: info.outputPath(`complex-resource-${info.project.name}.png`) })
})

test('30-second production UI run samples heap, frame delays and pause/resume/stop response', async ({ page }, info) => {
  test.setTimeout(90000)
  if (info.project.name === 'mobile') await page.setViewportSize({ width: 390, height: 844 })
  page.on('dialog', d => d.accept()); await page.goto('./'); await navigate(page, 'presets')
  await page.getByTestId('preset-search').fill('최종 시험장'); await page.getByTestId('preset-23_final_proving_grounds').click(); await page.getByRole('button', { name: '맵 적용하기' }).click()
  await page.getByRole('button', { name: '설정', exact: true }).click(); await page.getByTestId('episode-count-input').fill('1000000'); await page.getByTestId('epsilon-number').fill('0.3')
  await page.getByRole('button', { name: '설정', exact: true }).click()
  await page.getByTestId('speed-slider').focus(); await page.keyboard.press('End')
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('HeapProfiler.collectGarbage'); const before = await cdp.send('Runtime.getHeapUsage')
  await page.evaluate(() => {
    const state = { values: [] as number[], last: performance.now(), id: 0 }
    Object.defineProperty(window, '__frameSamples', { value: state, configurable: true })
    const frame = () => { const now = performance.now(); state.values.push(now - state.last); state.last = now; state.id = requestAnimationFrame(frame) }
    state.id = requestAnimationFrame(frame)
  })
  const started = Date.now(); const samples = []; let pauseMs = 0, resumeMs = 0
  await page.getByTestId('playback-run-episode').click()
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(5000)
    samples.push({ elapsedMs: Date.now() - started, heap: (await cdp.send('Runtime.getHeapUsage')).usedSize, qStates: await page.getByTestId('q-state-count').textContent(), steps: await page.getByTestId('resource-total-steps').getAttribute('data-total-steps'), episodes: await page.getByTestId('resource-episodes').textContent() })
    if (i === 2) {
      const at = Date.now(); await page.getByTestId('playback-pause').click(); await expect(page.getByTestId('playback-resume')).toBeVisible(); pauseMs = Date.now() - at
      const resume = Date.now(); await page.getByTestId('playback-resume').click(); await expect(page.getByTestId('playback-pause')).toBeVisible(); resumeMs = Date.now() - resume
    }
  }
  const frames = await page.evaluate(() => { const s = (window as unknown as { __frameSamples: { values: number[]; id: number } }).__frameSamples; cancelAnimationFrame(s.id); return s.values })
  const qRows = await page.getByTestId('q-state-count').textContent()
  const stop = Date.now(); await page.getByTestId('playback-stop').click(); await expect(page.getByTestId('playback-run-episode')).toBeEnabled(); const stopMs = Date.now() - stop
  // The running scheduler may add rows between reading the UI and the Stop click.
  // Stop must retain those rows too; after stopping the count must remain stable.
  const stoppedRows = await page.getByTestId('q-state-count').textContent()
  expect(Number(stoppedRows!.replaceAll(',', ''))).toBeGreaterThanOrEqual(Number(qRows!.replaceAll(',', '')))
  await expect(page.getByTestId('q-state-count')).toHaveText(stoppedRows!)
  await cdp.send('HeapProfiler.collectGarbage'); const afterStop = await cdp.send('Runtime.getHeapUsage')
  for (let i = 0; i < 10; i++) { await navigate(page, 'editor'); await navigate(page, 'environment') }
  await cdp.send('HeapProfiler.collectGarbage'); const afterCycles = await cdp.send('Runtime.getHeapUsage')
  const sorted = frames.slice().sort((a,b) => a-b)
  const result = { project: info.project.name, samples, pauseMs, resumeMs, stopMs, frameCount: frames.length, meanFrameGapMs: frames.reduce((a,b) => a+b, 0)/frames.length, p95FrameGapMs: sorted[Math.floor(sorted.length*.95)], beforeBytes: before.usedSize, afterStopGcBytes: afterStop.usedSize, after10CyclesGcBytes: afterCycles.usedSize }
  console.log('SUSTAINED_UI_SAMPLE', JSON.stringify(result))
  await info.attach('sustained-ui-sample', { body: JSON.stringify(result, null, 2), contentType: 'application/json' })
  await expectFits(page)
  await page.screenshot({ animations: 'disabled', path: info.outputPath(`complex-trained-${info.project.name}.png`) })
})
