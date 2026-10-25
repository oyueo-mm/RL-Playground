import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { HeldMovement } from './heldMovement'
beforeEach(()=>vi.useFakeTimers());afterEach(()=>vi.useRealTimers())
it('moves immediately, repeats after 200ms then every 100ms, and stops on release',()=>{
 const move=vi.fn(()=>true),held=new HeldMovement(move)
 held.press('d',3);expect(move).toHaveBeenCalledTimes(1)
 vi.advanceTimersByTime(199);expect(move).toHaveBeenCalledTimes(1)
 vi.advanceTimersByTime(301);expect(move).toHaveBeenCalledTimes(5)
 held.release('d');vi.advanceTimersByTime(1000);expect(move).toHaveBeenCalledTimes(5);expect(vi.getTimerCount()).toBe(0)
})
it('prioritizes the latest direction and returns to a still-held previous key with only one timer',()=>{
 const move=vi.fn(()=>true),held=new HeldMovement(move)
 held.press('w',0);held.press('d',3);expect(move.mock.lastCall).toEqual([3]);expect(vi.getTimerCount()).toBe(1)
 held.release('d');vi.advanceTimersByTime(100);expect(move.mock.lastCall).toEqual([0])
 const count=move.mock.calls.length;held.press('ArrowUp',0);held.press('w',0);expect(move).toHaveBeenCalledTimes(count);expect(vi.getTimerCount()).toBe(1)
 held.release('w');held.release('ArrowUp');expect(vi.getTimerCount()).toBe(0)
})
it('stops immediately on success/failure and clears keys for restart',()=>{
 const move=vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false),held=new HeldMovement(move)
 held.press('d',3);vi.advanceTimersByTime(2000);expect(move).toHaveBeenCalledTimes(2);expect(vi.getTimerCount()).toBe(0)
 move.mockReturnValue(true);held.press('d',3);expect(move).toHaveBeenCalledTimes(3);held.clear();expect(vi.getTimerCount()).toBe(0)
})
