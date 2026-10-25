import { chromium } from '@playwright/test'
import { writeFileSync } from 'node:fs'
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const samples = []
try {
 for (const [course, lesson] of [['1534717','1'],['1534717','3'],['1536047','10'],['1536047','11'],['1536047','19'],['1536047','20']]) {
  const page = await browser.newPage(), media = []
  page.on('response', response => { if (/\.mp4|\.m3u8/.test(response.url())) media.push({ host: new URL(response.url()).host, status: response.status() }) })
  try {
   await page.goto(`http://www.kocw.net/home/search/kemView.do?kemId=${course}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
   await page.locator('#aTitle'+lesson).click()
   await page.waitForFunction(() => [...document.querySelectorAll('video')].some(video => video.readyState >= 2), {}, { timeout: 15000 })
   samples.push({ course, lesson, title: (await page.locator('.vodInfo').first().innerText()).trim(), playbackVerified: true, media, video: await page.locator('video').evaluateAll(nodes => nodes.map(video => ({ readyState: video.readyState, paused: video.paused }))) })
  } catch (error) { samples.push({ course, lesson, playbackVerified: false, error: String(error) }) }
  finally { await page.close() }
 }
} finally { await browser.close() }
const result = { checked: new Date().toISOString().slice(0,10), scope: 'Guest playback samples only; not every lecture or full course completion.', samples }
writeFileSync('docs/korean-resource-verification.json', JSON.stringify(result, null, 2))
console.log(JSON.stringify(samples.map(({course,lesson,title,playbackVerified}) => ({course,lesson,title,playbackVerified}))))
