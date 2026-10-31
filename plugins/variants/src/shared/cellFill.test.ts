import { similarColors } from '@jbrowse/core/ui/colors'
import { cssColorToNormalizedRgb } from '@jbrowse/core/util/colorBits'
import { UNIVERSAL_FIELD_PRESETS } from '@jbrowse/core/util/colorScale'
import { colord } from '@jbrowse/core/util/colord'

import { ALT_HUE, HET_DOSAGE, cellFill, shadeByDosage } from './cellFill.ts'
import { NO_CALL_COLOR, REFERENCE_COLOR } from './constants.ts'
import { getAlleleColor } from './drawAlleleCount.ts'

import type * as ColordModuleNs from '@jbrowse/core/util/colord'

type ColordModule = typeof ColordModuleNs

jest.mock('@jbrowse/core/util/colord', () => {
  const actual: ColordModule = jest.requireActual('@jbrowse/core/util/colord')
  return { ...actual, colord: jest.fn(actual.colord) }
})

// Ottosson's sRGB -> OKLab, independent of core's D50 route
function oklch(css: string): [number, number, number] {
  const [r, g, b] = cssColorToNormalizedRgb(css).map(v =>
    v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number]
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return [L, Math.hypot(A, B), ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360]
}

const SV_AND_IMPACT_COLORS = [
  ...UNIVERSAL_FIELD_PRESETS.svType.scale.range,
  ...UNIVERSAL_FIELD_PRESETS.impact.scale.range,
  ALT_HUE,
]

describe('shadeByDosage', () => {
  it('full dosage is the hue itself, by identity', () => {
    expect(shadeByDosage(ALT_HUE, 1)).toBe(ALT_HUE)
    expect(shadeByDosage('#d32f2f', 1)).toBe('#d32f2f')
  })

  it("paints the default mode's het the blue it was under the HSL ramp", () => {
    expect(
      similarColors(shadeByDosage(ALT_HUE, HET_DOSAGE), 'hsl(200,50%,55%)'),
    ).toBe(true)
    expect(shadeByDosage(ALT_HUE, HET_DOSAGE)).toBe('#539fc6')
  })

  it('lifts every class color by one lightness step, holding its hue', () => {
    for (const hue of SV_AND_IMPACT_COLORS) {
      const [l, c, h] = oklch(hue)
      const [hetL, , hetH] = oklch(shadeByDosage(hue, HET_DOSAGE))
      expect(hetL).toBeCloseTo(Math.min(l + 0.209, 0.94), 2)
      if (c > 0.02) {
        const turn = Math.abs(hetH - h) % 360
        expect(Math.min(turn, 360 - turn)).toBeLessThan(2)
      }
    }
  })

  // the HSL ramp painted the insertion purple's het #ff0cff, louder than its hom
  it('never raises chroma, so a dark class color cannot turn neon', () => {
    for (const hue of SV_AND_IMPACT_COLORS) {
      expect(oklch(shadeByDosage(hue, HET_DOSAGE))[1]).toBeLessThanOrEqual(
        oklch(hue)[1] + 0.002,
      )
    }
  })

  it('stops short of white at any dosage', () => {
    for (const hue of ['#fbc02d', '#ff7f00', '#17becf', ALT_HUE]) {
      for (const dosage of [0, 0.25, 1 / 3, 0.5, 0.75, 1]) {
        expect(oklch(shadeByDosage(hue, dosage))[0]).toBeLessThanOrEqual(0.945)
      }
    }
  })

  it("keeps a translucent hue's alpha on the het", () => {
    expect(colord(shadeByDosage('rgba(255,0,0,0.3)', 0.5)).alpha()).toBeCloseTo(
      0.3,
      2,
    )
  })

  it('leaves a hue already lighter than the ceiling as light as it was', () => {
    const pale = 'hsl(200,50%,97%)'
    expect(oklch(shadeByDosage(pale, 0))[0]).toBeCloseTo(oklch(pale)[0], 2)
  })

  it('parses a hue once: the repeat is the memo, not a second parse', () => {
    const parse = jest.mocked(colord)
    const hue = '#123456'
    const first = shadeByDosage(hue, 0.5)
    parse.mockClear()
    expect(shadeByDosage(hue, 0.5)).toBe(first)
    expect(parse).not.toHaveBeenCalled()
  })
})

describe('cellFill', () => {
  it('reads the dosage as the byte a cell carries', () => {
    expect(cellFill('#d32f2f', 128)).toBe(shadeByDosage('#d32f2f', HET_DOSAGE))
    expect(cellFill('#d32f2f', 255)).toBe('#d32f2f')
  })
})

describe('getAlleleColor: dosage over CALLED alleles', () => {
  it('hom ref is the reference fill, hom alt the hue', () => {
    expect(getAlleleColor('0/0')).toBe(REFERENCE_COLOR)
    expect(getAlleleColor('1/1')).toBe(ALT_HUE)
  })

  it('which alt is not on the hue: 1/2 is hom, 0/2 is het', () => {
    expect(getAlleleColor('1/2')).toBe(getAlleleColor('1/1'))
    expect(getAlleleColor('0/2')).toBe(getAlleleColor('0/1'))
    expect(getAlleleColor('0/2')).not.toBe(getAlleleColor('1/2'))
  })

  it('a wholly uncalled genotype is the no-call category, never a blend', () => {
    expect(getAlleleColor('./.')).toBe(NO_CALL_COLOR)
    expect(getAlleleColor('.')).toBe(NO_CALL_COLOR)
  })

  it('a partial call is its dosage over what was called', () => {
    expect(getAlleleColor('./1')).toBe(getAlleleColor('1/1'))
    expect(getAlleleColor('./0')).toBe(REFERENCE_COLOR)
    expect(getAlleleColor('./1/1')).toBe(getAlleleColor('1/1'))
    expect(getAlleleColor('./0/1')).toBe(getAlleleColor('0/1'))
  })

  it('ploidy shows: a triploid single alt is paler than a diploid one', () => {
    const third = colord(getAlleleColor('0/0/1')).toHsl().l
    const half = colord(getAlleleColor('0/1')).toHsl().l
    expect(third).toBeGreaterThan(half)
  })

  it('skips the reference cell where the display asked it to', () => {
    expect(getAlleleColor('0/0', false)).toBe('')
    expect(getAlleleColor('0/1', false)).not.toBe('')
  })
})
