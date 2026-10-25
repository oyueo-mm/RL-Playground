// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { RewardInfo } from './RewardInfo'
import { GridWorldEnv, createDefaultGridWorldConfig } from '../../core/environments/gridworld/GridWorldEnv'
afterEach(cleanup)
it.each(['ko','en'] as const)('%s explains real configured rewards only on demand, closes by button, Escape and outside click',locale=>{
  const model=new GridWorldEnv({...createDefaultGridWorldConfig(),goalReward:17,wallPenalty:-.25,bombPenalty:-15}).getRenderModel()
  render(<RewardInfo model={model} locale={locale}/>)
  expect(screen.queryByRole('dialog')).toBeNull()
  const button=screen.getByTestId('reward-info-button')
  fireEvent.click(button);expect(screen.getByRole('dialog').textContent).toContain('+17');expect(screen.getByRole('dialog').textContent).toContain('-15')
  fireEvent.keyDown(document,{key:'Escape'});expect(screen.queryByRole('dialog')).toBeNull();expect(document.activeElement).toBe(button)
  fireEvent.click(button);fireEvent.click(document.body);expect(screen.queryByRole('dialog')).toBeNull()
  fireEvent.click(button);fireEvent.click(screen.getByRole('button',{name:locale==='ko'?'보상 설명 닫기':'Close reward explanation'}));expect(screen.queryByRole('dialog')).toBeNull()
})
