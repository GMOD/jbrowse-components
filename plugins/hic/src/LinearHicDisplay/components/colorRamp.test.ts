import {
  generateColorRamp,
  getLegendStops,
  makeHicFillStyleLut,
} from './colorRamp.ts'
import { MIN_VISIBLE_ALPHA } from './shaders/hic.consts.generated.ts'

import type { HicColorScheme } from './colorRamp.ts'

const SCHEMES: HicColorScheme[] = ['juicebox', 'fall', 'viridis']

function alphaAt(scheme: HicColorScheme, t: number) {
  const ramp = generateColorRamp(scheme)
  return ramp[Math.round(t * 255) * 4 + 3]!
}

// mapHicCount used to live in colorRamp.ts as a hand-written mirror of
// hic.slang's fragment shader; it is now generated from the shader itself, and
// its behavior is pinned in hicShaderParity.test.ts.

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

  // The fragment discards on the same test (hic.slang), so this is a boundary
  // between backends, not a Canvas2D detail: a bin either exists in all three
  // paths or none of them. Walking the exact alpha the ramp carries at each
  // entry is what says the LUT switches where MIN_VISIBLE_ALPHA says, rather
  // than somewhere close to it.
  test('skips exactly the bins the shader discards', () => {
    const ramp = generateColorRamp('juicebox')
    const lut = makeHicFillStyleLut(ramp)
    let below = 0
    for (let i = 0; i < 256; i++) {
      const t = i / 255
      const transparent = ramp[i * 4 + 3]! / 255 < MIN_VISIBLE_ALPHA
      expect(lut(t) === undefined).toBe(transparent)
      if (transparent) {
        below++
      }
    }
    // and the juicebox fade really does put bins on both sides of it, so the
    // agreement above is about a live threshold rather than a vacuous one
    expect(below).toBeGreaterThan(0)
    expect(below).toBeLessThan(256)
  })
})

describe('color ramps', () => {
  test.each(SCHEMES)('%s builds a 256-entry RGBA ramp', scheme => {
    expect(generateColorRamp(scheme)).toHaveLength(256 * 4)
  })

  // The pixels themselves, at five points across each scheme. The stop tables
  // and the shared interpolation (`@jbrowse/core/util/colorRamp`, which the LD
  // ramp builds through too) can both be edited without any other test here
  // noticing: these entries are what says the heatmap still paints the colors
  // it painted, byte for byte.
  const RAMP_BYTES: [HicColorScheme, number[][]][] = [
    [
      'juicebox',
      [
        [255, 0, 0, 0],
        [255, 0, 0, 64],
        [255, 0, 0, 128],
        [255, 0, 0, 192],
        [255, 0, 0, 255],
      ],
    ],
    [
      'fall',
      [
        [255, 255, 255, 255],
        [254, 227, 139, 255],
        [253, 140, 60, 255],
        [207, 12, 33, 255],
        [0, 0, 0, 255],
      ],
    ],
    [
      'viridis',
      [
        [68, 1, 84, 255],
        [59, 82, 139, 255],
        [33, 145, 140, 255],
        [94, 201, 98, 255],
        [253, 231, 37, 255],
      ],
    ],
  ]

  test.each(RAMP_BYTES)('%s paints these bytes', (scheme, expected) => {
    const ramp = generateColorRamp(scheme)
    expect(
      [0, 64, 128, 192, 255].map(i => [...ramp.slice(i * 4, i * 4 + 4)]),
    ).toEqual(expected)
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
