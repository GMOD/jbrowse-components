import { rampLutOf } from '@jbrowse/core/util/colorRamp'
import { colord } from '@jbrowse/core/util/colord'

import { BASE_QUALITY_RAMP_MAX } from '../../shared/qualityRamps.ts'
import {
  BASE_QUALITY_UNAVAILABLE,
  BASE_QUALITY_UNAVAILABLE_COLOR,
  qualityAbgr,
  qualityCssColors,
} from './colors.ts'

function rgbOf(css: string) {
  const { r, g, b } = colord(css).toRgb()
  return [r, g, b]
}

function lutRgb(t: number) {
  const lut = rampLutOf({ scheme: 'cividis' })
  const o = Math.round(t * (lut.length / 4 - 1)) * 4
  return [lut[o], lut[o + 1], lut[o + 2]]
}

test('base quality is core cividis over 0 to 40 and flat past it', () => {
  expect(rgbOf(qualityCssColors[0]!)).toEqual(lutRgb(0))
  expect(rgbOf(qualityCssColors[20]!)).toEqual(lutRgb(0.5))
  for (const score of [BASE_QUALITY_RAMP_MAX, 41, 93, 254]) {
    expect(rgbOf(qualityCssColors[score]!)).toEqual(lutRgb(1))
  }
})

test('a missing quality paints its own flat colour, off the ramp', () => {
  const unavailable = rgbOf(qualityCssColors[BASE_QUALITY_UNAVAILABLE]!)
  expect(unavailable).toEqual(rgbOf(BASE_QUALITY_UNAVAILABLE_COLOR))
  const ramp = new Set(
    qualityCssColors
      .slice(0, BASE_QUALITY_RAMP_MAX + 1)
      .map(css => rgbOf(css).join(',')),
  )
  expect(ramp.has(unavailable.join(','))).toBe(false)
})

test('the packed table and the CSS table are one colour per score', () => {
  for (let score = 0; score < 256; score++) {
    const c = qualityAbgr[score]!
    expect([c & 255, (c >>> 8) & 255, (c >>> 16) & 255]).toEqual(
      rgbOf(qualityCssColors[score]!),
    )
  }
})
