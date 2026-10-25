export const HOLD_DELAY_MS = 200
export const HOLD_REPEAT_MS = 100
export class HeldMovement {
  private keys = new Map<string, number>()
  private timer: ReturnType<typeof setTimeout> | null = null
  private move: (direction: number) => boolean
  constructor(move: (direction: number) => boolean) { this.move = move }
  private cancelTimer() { if (this.timer !== null) clearTimeout(this.timer); this.timer = null }
  private current() { return [...this.keys.values()].at(-1) }
  private schedule(delay: number) {
    this.cancelTimer()
    this.timer = setTimeout(() => {
      this.timer = null
      const direction = this.current()
      if (direction === undefined || !this.move(direction)) { this.clear(); return }
      this.schedule(HOLD_REPEAT_MS)
    }, delay)
  }
  press(key: string, direction: number) {
    if (this.keys.has(key)) return
    const old = this.current()
    this.keys.set(key, direction)
    if (old === direction) return
    this.cancelTimer()
    if (!this.move(direction)) { this.clear(); return }
    this.schedule(HOLD_DELAY_MS)
  }
  release(key: string) {
    const old = this.current()
    this.keys.delete(key)
    if (this.current() === undefined) this.clear()
    else if (old !== this.current()) this.schedule(HOLD_REPEAT_MS)
  }
  clear = () => { this.cancelTimer(); this.keys.clear() }
}
