import { rampLutOf } from '@jbrowse/core/util/colorRamp'
import { colord } from '@jbrowse/core/util/colord'

import { PLAIN_READ_CATEGORY } from '../../shaders/slang/packedColorQuad.consts.generated.ts'
import { RC_PLAIN } from '../../shaders/slang/read.consts.generated.ts'
import { BASE_QUALITY_RAMP_MAX } from '../../shared/qualityRamps.ts'
import {
  BASE_QUALITY_UNAVAILABLE,
  qualityAbgr,
  qualityPaintCss,
  qualityRampCss,
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
  expect(rgbOf(qualityRampCss[0]!)).toEqual(lutRgb(0))
  expect(rgbOf(qualityRampCss[20]!)).toEqual(lutRgb(0.5))
  for (const score of [BASE_QUALITY_RAMP_MAX, 41, 93, 254]) {
    expect(rgbOf(qualityRampCss[score]!)).toEqual(lutRgb(1))
  }
})

test('a missing quality packs 0, which the shader paints as the plain read fill', () => {
  expect(qualityAbgr[BASE_QUALITY_UNAVAILABLE]).toBe(0)
  expect(PLAIN_READ_CATEGORY).toBe(RC_PLAIN)
  expect(qualityPaintCss('rgb(176,176,176)')[BASE_QUALITY_UNAVAILABLE]).toBe(
    'rgb(176,176,176)',
  )
  expect(qualityPaintCss('rgb(211,211,211)')[BASE_QUALITY_UNAVAILABLE]).toBe(
    'rgb(211,211,211)',
  )
})

test('the packed table and the CSS table are one colour per score', () => {
  const css = qualityPaintCss('rgb(0,0,0)')
  for (let score = 0; score < BASE_QUALITY_UNAVAILABLE; score++) {
    const c = qualityAbgr[score]!
    expect(c).not.toBe(0)
    expect([c & 255, (c >>> 8) & 255, (c >>> 16) & 255]).toEqual(
      rgbOf(css[score]!),
    )
  }
})
