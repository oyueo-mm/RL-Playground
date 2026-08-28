import { describe, expect, it } from 'vitest'

// Phase 0 smoke test — proves the Vitest toolchain runs. Real RL-logic
// tests land in src/core/**/*.test.ts starting Phase 1.
describe('toolchain', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
