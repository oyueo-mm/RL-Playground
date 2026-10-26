import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { expect, it } from 'vitest'
import inventory from '../docs/v2-source-inventory.json'

it('preserves all 36 V2 maps, solutions and PNGs byte for byte', () => {
  expect(inventory).toHaveLength(36)
  for (const entry of inventory.filter(item => !/(?:^|\/)(?:2[5-9]|30)_/.test(item.path))) expect(createHash('sha256').update(readFileSync(entry.path)).digest('hex')).toBe(entry.sha256)
})
