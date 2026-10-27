import { expect, test, type Page } from '@playwright/test'
import { config, loadMap, navigate } from './helpers'

async function settings(page:Page) {
  await page.getByRole('button',{name:'설정',exact:true}).click()
  await page.getByRole('tab',{name:'시각화 설정',exact:true}).click()
}
async function centered(page:Page) {
  const grid=page.getByTestId('learning-grid'),view=grid.getByTestId('grid-viewport')
  await expect(view).toHaveAttribute('data-follow','true')
  await expect.poll(async()=>{
    const area=await view.boundingBox(),marker=await grid.getByTestId('agent-marker').boundingBox()
    return area&&marker?Math.hypot(marker.x+marker.width/2-area.x-area.width/2,marker.y+marker.height/2-area.y-area.height/2):Infinity
  }).toBeLessThan(2)
}

test('follow retains zoom for wheel/buttons/pinch, centers moving agents and resize, and releases only on pan',async({page},info)=>{
  page.on('dialog',d=>d.accept());await page.goto('./');await loadMap(page,{...config(64,64),start:{x:32,y:40}})
  const grid=page.getByTestId('learning-grid'),view=grid.getByTestId('grid-viewport')
  await grid.getByRole('button',{name:'따라가기',exact:true}).click();await centered(page)
  const box=(await view.boundingBox())!;await page.mouse.move(box.x+box.width*.75,box.y+box.height*.6);await page.mouse.wheel(0,-480)
  await expect.poll(async()=>Number(await view.getAttribute('data-zoom'))).toBeGreaterThan(1)
  await centered(page)
  await page.mouse.wheel(0,120);await centered(page)
  await grid.getByRole('button',{name:'Zoom in',exact:true}).click();await grid.getByRole('button',{name:'Zoom out',exact:true}).click();await centered(page)
  if(info.project.name==='mobile'){
    const cdp=await page.context().newCDPSession(page),x=box.x+box.width/2,y=box.y+box.height/2,zoom=Number(await view.getAttribute('data-zoom'))
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-25,y,id:1},{x:x+25,y,id:2}]})
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-55,y:y+5,id:1},{x:x+55,y:y+5,id:2}]})
    await expect.poll(async()=>Number(await view.getAttribute('data-zoom'))).toBeGreaterThan(zoom)
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-30,y:y+10,id:1},{x:x+30,y:y+10,id:2}]})
    await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await cdp.detach();await centered(page)
  }
  const zoom=await view.getAttribute('data-zoom')
  await page.getByTestId('playback-run-greedy').click();await page.getByTestId('playback-pause').click();await centered(page);await expect(view).toHaveAttribute('data-zoom',zoom!)
  await page.getByTestId('toggle-analysis').click();await centered(page);await expect(view).toHaveAttribute('data-zoom',zoom!)
  await page.getByRole('button',{name:'분석 닫기',exact:true}).click()
  const newBox=(await view.boundingBox())!;await page.mouse.move(newBox.x+newBox.width/2,newBox.y+newBox.height/2);await page.mouse.down();await page.mouse.move(newBox.x+newBox.width/2+35,newBox.y+newBox.height/2+15,{steps:4});await page.mouse.up()
  await expect(view).toHaveAttribute('data-follow','false');await page.getByTestId('playback-stop').click()
})

test('reward defaults, on-demand rules and layout slots fit all requested map sizes and viewports',async({page},info)=>{
  test.setTimeout(120000);page.on('dialog',d=>d.accept())
  for(const [width,height] of info.project.name==='mobile'?[[390,844]]:[[768,1024],[1366,768],[1440,900],[1920,1080]]) {
    await page.setViewportSize({width,height});await page.goto('./')
    for(const [columns,rows] of [[20,20],[48,40],[64,64]]) {
      await loadMap(page,config(columns,rows));const grid=page.getByTestId('learning-grid')
      const notice=page.getByTestId('environment-applied'),noticeBox=(await notice.boundingBox())!,titleBox=(await notice.locator('strong').boundingBox())!
      expect(titleBox.y+titleBox.height).toBeLessThanOrEqual(noticeBox.y+noticeBox.height)
      await expect(page.getByTestId('reward-readout')).toHaveCount(0)
      await expect(page.getByTestId('reward-info-popover')).toHaveCount(0)
      await settings(page)
      await expect(page.getByTestId('toggle-rewards')).toBeChecked();await expect(page.getByTestId('toggle-live-rewards')).not.toBeChecked();await expect(page.getByTestId('toggle-reward-animation')).toBeChecked()
      await page.getByTestId('reward-info-button').click();await expect(page.getByTestId('reward-info-popover')).toContainText('최초 수집')
      await page.getByRole('button',{name:'보상 설명 닫기'}).click();await page.getByTestId('reward-info-button').click();await page.keyboard.press('Escape');await expect(page.getByTestId('reward-info-popover')).toHaveCount(0)
      await page.getByTestId('reward-info-button').click();await page.getByTestId('toggle-live-rewards').click();await expect(page.getByTestId('reward-info-popover')).toHaveCount(0)
      await page.getByRole('button',{name:'설정',exact:true}).click()
      const mini=(await grid.locator('.camera-minimap').boundingBox())!,hud=(await grid.getByTestId('reward-readout').boundingBox())!,controls=(await grid.locator('.zoom-controls').boundingBox())!
      const overlaps=(a:typeof mini,b:typeof mini)=>a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height
      expect(overlaps(mini,hud)).toBe(false);expect(overlaps(hud,controls)).toBe(false);expect(overlaps(mini,controls)).toBe(false)
      if(columns===64)await page.screenshot({path:`docs/screenshots/turbo-hud-${width}x${height}.png`,animations:'disabled'})
      await settings(page);await page.getByTestId('toggle-live-rewards').uncheck();await page.getByRole('button',{name:'설정',exact:true}).click()
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
  }
})

test('difficulty defaults, turbo controls, navigation safety, completion and policy share the trained Q-table',async({page},info)=>{
  test.setTimeout(120000);page.on('dialog',d=>d.accept());await page.goto('./')
  await navigate(page,'presets');await page.getByTestId('preset-30_the_endless_labyrinth').click();await page.getByRole('button',{name:'맵 적용하기',exact:true}).click()
  await expect(page.getByTestId('episode-count-input')).toHaveValue('5000')
  await page.getByTestId('training-mode').selectOption('turbo')
  await page.getByTestId('playback-run-episode').click()
  await expect(page.getByTestId('turbo-dashboard')).toBeVisible();await expect(page.getByTestId('learning-grid').getByTestId('grid-svg')).toHaveCount(0)
  await expect(page.getByTestId('training-mode')).toBeDisabled();await expect(page.getByTestId('speed-slider')).toBeDisabled()
  await page.getByTestId('playback-pause').click();await expect(page.getByTestId('turbo-dashboard')).toContainText('일시정지')
  const paused=await page.getByTestId('turbo-episodes').textContent();await page.waitForTimeout(800);await expect(page.getByTestId('turbo-episodes')).toHaveText(paused!)
  await page.screenshot({path:`docs/screenshots/turbo-dashboard-${info.project.name}.png`,animations:'disabled'})
  await page.getByTestId('playback-resume').click();await navigate(page,'home');await navigate(page,'environment');await expect(page.getByTestId('turbo-dashboard')).toContainText('일시정지')
  await navigate(page,'results');await expect(page.getByTestId('turbo-results')).toContainText('일시정지')
  await page.getByRole('button',{name:'학습 중단 후 분석 보기',exact:true}).click();await expect(page.getByTestId('analysis-panel')).toBeVisible()
  await navigate(page,'environment');await expect(page.getByTestId('turbo-dashboard')).toContainText('중단')
  await page.getByTestId('playback-run-greedy').click();await expect(page.getByTestId('turbo-dashboard')).toHaveCount(0);await expect(page.getByTestId('speed-slider')).toHaveValue('33');await expect(page.getByTestId('learning-grid').getByTestId('grid-svg')).toBeVisible()
  await page.getByTestId('playback-stop').click()
  await loadMap(page,{...config(3,3),start:{x:0,y:1},goals:[{x:0,y:0}]})
  await page.getByRole('button',{name:'설정',exact:true}).click();await page.getByTestId('episode-count-input').fill('5');await page.getByTestId('epsilon-number').fill('0');await page.getByRole('button',{name:'설정',exact:true}).click()
  await page.getByTestId('playback-run-episode').click();await expect(page.getByTestId('turbo-dashboard')).toContainText('완료');await expect(page.getByTestId('turbo-progress')).toHaveText('100.0%')
  // Turbo finished its 5 requested episodes: the completion dialog reports exactly this run, then gets out of the way.
  await expect(page.getByTestId('training-complete')).toBeVisible();await expect(page.getByTestId('completion-message')).toHaveText('5번 학습 완료!')
  await page.getByTestId('completion-close').click();await expect(page.getByTestId('training-complete')).toHaveCount(0)
  await page.getByTestId('training-mode').selectOption('normal');await expect(page.getByTestId('learning-grid').getByTestId('grid-svg')).toBeVisible()
  await settings(page);await expect(page.getByTestId('toggle-rewards')).toBeChecked();await expect(page.getByTestId('toggle-reward-animation')).toBeChecked();await expect(page.getByTestId('toggle-live-rewards')).not.toBeChecked()
})
