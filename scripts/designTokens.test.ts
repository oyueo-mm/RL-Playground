import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('Design tokens', () => {
  const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')
  it('reads a non-empty stylesheet (guards against vacuous checks)', () => { expect(css.length).toBeGreaterThan(10000) })
  const token = (name: string) => new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`).exec(css)?.[1].toUpperCase()
  it('defines the white / deep-blue / black palette', () => {
    expect({ bg: token('bg-app'), surface: token('surface'), line: token('line'), text: token('text-primary'), navy: token('navy'), primary: token('primary'), accent: token('accent'), soft: token('primary-soft'), secondary: token('text-secondary') })
      .toEqual({ bg: '#FAFBFD', surface: '#FFFFFF', line: '#E1E6ED', text: '#171A20', navy: '#102B50', primary: '#0754A5', accent: '#2479D8', soft: '#EAF2FC', secondary: '#5F6B7A' })
  })
  it('leaves no sage/green interface colors in the stylesheet', () => {
    const offenders = new Set<string>()
    for (const hex of css.match(/#[0-9a-fA-F]{6}\b/g) ?? []) {
      const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
      const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
      if (d < 0.04) continue
      const h = max === r ? ((g - b) / d + 6) % 6 * 60 : max === g ? ((b - r) / d + 2) * 60 : ((r - g) / d + 4) * 60
      if (h >= 60 && h <= 190) offenders.add(hex)
    }
    expect([...offenders]).toEqual([])
  })
  it('uses a control border that meets 3:1 on every surface a control sits on (WCAG 1.4.11), while dividers stay light', () => {
    const lum = (hex: string) => { const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2] }
    const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05) }
    const control = token('control-border')!
    for (const surface of ['surface', 'bg-app', 'surface-muted', 'primary-soft', 'hover']) expect(ratio(control, token(surface)!), `control-border on ${surface}`).toBeGreaterThanOrEqual(3)
    expect(ratio(token('line')!, token('surface')!)).toBeLessThan(2) // decorative divider is deliberately not darkened
    expect(css).toMatch(/input:not\(\[type=checkbox\]\)[^{]*\{ border-color: var\(--control-border\)/)
  })
  it('sets no interface text below 10px in the stylesheet', () => {
    const small = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(m => /font-size:\s*(\d+(?:\.\d+)?)px/.test(m[2]) && Number(/font-size:\s*(\d+(?:\.\d+)?)px/.exec(m[2])![1]) < 10).map(m => m[1].trim())
    expect(small).toEqual([])
  })
  it('meets WCAG AA for the main text/background pairs', () => {
    const lum = (hex: string) => { const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2] }
    const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05) }
    const t = (n: string) => token(n)!
    for (const [fg, bg, min] of [
      ['text-primary', 'bg-app', 7], ['text-primary', 'surface', 7], ['text-body', 'surface', 7], ['text-secondary', 'surface', 4.5], ['text-secondary', 'bg-app', 4.5],
      ['text-secondary', 'primary-soft', 4.5], ['primary', 'surface', 4.5], ['primary', 'bg-app', 4.5], ['primary', 'primary-soft', 4.5], ['surface', 'primary', 4.5], ['surface', 'primary-hover', 4.5], ['navy', 'surface', 7],
    ] as const) expect(ratio(t(fg), t(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(min)
    for (const [fg, bg] of [['accent', 'surface'], ['focus-ring', 'surface'], ['focus-ring', 'bg-app']] as const) expect(ratio(t(fg), t(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(3)
  })
})
