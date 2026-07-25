import {
  generateColorRamp,
  getLegendStops,
  makeHicFillStyleLut,
  mapHicCount,
} from './colorRamp.ts'

import type { HicColorScheme } from './colorRamp.ts'

const SCHEMES: HicColorScheme[] = ['juicebox', 'fall', 'viridis']

function alphaAt(scheme: HicColorScheme, t: number) {
  const ramp = generateColorRamp(scheme)
  return ramp[Math.round(t * 255) * 4 + 3]!
}

// mapHicCount mirrors hic.slang's fragment shader so the Canvas2D and SVG paths
// color identically to the GPU. These pin the guards that mirror is built on —
// `max(colorMaxScore, 2)` for log and `max(colorMaxScore, 0.001)` for linear —
// since a divergence here shows up only as an export that doesn't match screen.
describe('mapHicCount', () => {
  test('linear maps count/colorMaxScore into [0,1]', () => {
    expect(mapHicCount(0, 100, false)).toBe(0)
    expect(mapHicCount(50, 100, false)).toBe(0.5)
    expect(mapHicCount(100, 100, false)).toBe(1)
  })

  test('log maps log2(count)/log2(colorMaxScore)', () => {
    // counts below 1 clamp up to 1 first, so the ramp starts at t=0
    expect(mapHicCount(0, 256, true)).toBe(0)
    expect(mapHicCount(1, 256, true)).toBe(0)
    expect(mapHicCount(16, 256, true)).toBe(0.5)
    expect(mapHicCount(256, 256, true)).toBe(1)
  })

  test('clamps a count above the saturation point instead of overflowing', () => {
    expect(mapHicCount(1e6, 100, false)).toBe(1)
    expect(mapHicCount(1e6, 256, true)).toBe(1)
  })

  test('a negative count floors at 0 rather than sampling off the ramp', () => {
    expect(mapHicCount(-5, 100, false)).toBe(0)
    expect(mapHicCount(-5, 256, true)).toBe(0)
  })

  test.each([0, 1, 1.5])(
    'log floors the denominator at 2, so colorMaxScore=%p cannot divide by log2(1)=0',
    max => {
      const t = mapHicCount(1.2, max, true)
      expect(Number.isFinite(t)).toBe(true)
      expect(t).toBeGreaterThanOrEqual(0)
      expect(t).toBeLessThanOrEqual(1)
    },
  )

  test('linear floors the denominator so colorMaxScore=0 does not divide by zero', () => {
    // 0/0 would be NaN; the 0.001 floor makes any positive count saturate
    expect(mapHicCount(0, 0, false)).toBe(0)
    expect(mapHicCount(5, 0, false)).toBe(1)
  })
})

// The alpha cutoff lives in the hic-specific LUT rather than the shared
// render-core primitive: the juicebox scheme fades alpha 0->255, and returning
// undefined is what tells drawHicBlocks to skip a bin entirely instead of
// painting a fully transparent rect.
describe('makeHicFillStyleLut', () => {
  test('skips a bin where the juicebox ramp is effectively transparent', () => {
    const lut = makeHicFillStyleLut(generateColorRamp('juicebox'))
    expect(alphaAt('juicebox', 0)).toBe(0)
    expect(lut(0)).toBeUndefined()
    expect(lut(1)).toBe('rgba(255,0,0,1.000)')
  })

  test.each(['fall', 'viridis'] as const)(
    'paints every stop of the fully-opaque %s scheme',
    scheme => {
      const lut = makeHicFillStyleLut(generateColorRamp(scheme))
      for (let i = 0; i <= 10; i++) {
        expect(lut(i / 10)).toBeDefined()
      }
    },
  )

  test('clamps t outside [0,1] to the ramp ends rather than reading out of bounds', () => {
    const lut = makeHicFillStyleLut(generateColorRamp('fall'))
    expect(lut(-1)).toBe(lut(0))
    expect(lut(2)).toBe(lut(1))
  })
})

describe('color ramps', () => {
  test.each(SCHEMES)('%s builds a 256-entry RGBA ramp', scheme => {
    expect(generateColorRamp(scheme)).toHaveLength(256 * 4)
  })

  test.each(SCHEMES)(
    '%s legend samples the same source as the ramp',
    scheme => {
      const stops = getLegendStops(scheme)
      const ramp = generateColorRamp(scheme)
      expect(stops).toHaveLength(11)
      expect(stops[0]!.offset).toBe(0)
      expect(stops[10]!.offset).toBe(1)
      // legend endpoints must equal the ramp endpoints, or the legend advertises
      // a color the heatmap never paints
      for (const i of [0, 10]) {
        const o = (i === 0 ? 0 : 255) * 4
        expect(stops[i]!.rgba).toEqual([
          ramp[o]!,
          ramp[o + 1]!,
          ramp[o + 2]!,
          ramp[o + 3]!,
        ])
      }
    },
  )
})
