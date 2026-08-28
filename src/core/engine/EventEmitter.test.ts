import { describe, expect, it, vi } from 'vitest'
import { EventEmitter } from './EventEmitter'

describe('EventEmitter', () => {
  it('delivers emitted values to subscribers', () => {
    const emitter = new EventEmitter<number>()
    const listener = vi.fn()
    emitter.subscribe(listener)

    emitter.emit(42)

    expect(listener).toHaveBeenCalledWith(42)
  })

  it('delivers to multiple subscribers', () => {
    const emitter = new EventEmitter<number>()
    const a = vi.fn()
    const b = vi.fn()
    emitter.subscribe(a)
    emitter.subscribe(b)

    emitter.emit(1)

    expect(a).toHaveBeenCalledWith(1)
    expect(b).toHaveBeenCalledWith(1)
  })

  it('stops delivering after unsubscribe() is called directly', () => {
    const emitter = new EventEmitter<number>()
    const listener = vi.fn()
    emitter.subscribe(listener)
    emitter.unsubscribe(listener)

    emitter.emit(1)

    expect(listener).not.toHaveBeenCalled()
  })

  it('stops delivering after the subscribe() return value is called', () => {
    const emitter = new EventEmitter<number>()
    const listener = vi.fn()
    const unsubscribe = emitter.subscribe(listener)
    unsubscribe()

    emitter.emit(1)

    expect(listener).not.toHaveBeenCalled()
  })
})
