// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ManualPlay } from './ManualPlay'
import { createDefaultGridWorldConfig } from '../core/environments/gridworld/GridWorldEnv'
const config={...createDefaultGridWorldConfig(),width:12,height:12,start:{x:0,y:0},goals:[{x:11,y:11}],walls:[]}
beforeEach(()=>vi.useFakeTimers())
afterEach(()=>{cleanup();vi.useRealTimers();vi.restoreAllMocks()})
const count=()=>Number(screen.getByTestId('manual-progress').getAttribute('data-steps'))
it('clears held input on blur, hidden document, text focus, inactivity and unmount',()=>{
 const {rerender,unmount}=render(<><input aria-label="field"/><ManualPlay config={config} locale="en" active onClose={()=>{}}/></>)
 fireEvent.keyDown(window,{key:'d'});act(()=>vi.advanceTimersByTime(200));expect(count()).toBe(2)
 fireEvent(window,new Event('blur'));act(()=>vi.advanceTimersByTime(500));expect(count()).toBe(2)
 fireEvent.keyDown(window,{key:'s'});screen.getByLabelText('field').focus();act(()=>vi.advanceTimersByTime(500));expect(count()).toBe(3)
 fireEvent.keyDown(screen.getByLabelText('field'),{key:'d'});expect(count()).toBe(3)
 fireEvent.keyDown(window,{key:'d'});const hidden=vi.spyOn(document,'hidden','get').mockReturnValue(true);fireEvent(document,new Event('visibilitychange'));act(()=>vi.advanceTimersByTime(500));expect(count()).toBe(4);hidden.mockRestore()
 rerender(<><input aria-label="field"/><ManualPlay config={config} locale="en" active={false} onClose={()=>{}}/></>);act(()=>vi.advanceTimersByTime(500));expect(count()).toBe(4)
 rerender(<><input aria-label="field"/><ManualPlay config={config} locale="en" active onClose={()=>{}}/></>);act(()=>vi.advanceTimersByTime(500));expect(count()).toBe(4)
 fireEvent.keyDown(window,{key:'s'});unmount();expect(vi.getTimerCount()).toBe(0)
})
it('stops the timer on goal and bomb termination and clears pressed keys on restart',()=>{
 const {rerender}=render(<ManualPlay config={{...config,goals:[{x:2,y:0}]}} locale="en" active onClose={()=>{}}/>)
 fireEvent.keyDown(window,{key:'d'});act(()=>vi.advanceTimersByTime(1000));expect(count()).toBe(2);expect(screen.getByTestId('manual-progress').textContent).toContain('Success');expect(vi.getTimerCount()).toBe(0)
 fireEvent.keyDown(window,{key:'r'});act(()=>vi.advanceTimersByTime(500));expect(count()).toBe(0)
 rerender(<ManualPlay key="bomb" config={{...config,bombs:[{x:1,y:0}]}} locale="en" active onClose={()=>{}}/>);fireEvent.keyDown(window,{key:'d'});act(()=>vi.advanceTimersByTime(1000));expect(count()).toBe(1);expect(screen.getByTestId('manual-progress').textContent).toContain('Bomb');expect(vi.getTimerCount()).toBe(0)
})
