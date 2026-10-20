import { rampLutOf } from '@jbrowse/core/util/colorRamp'
import { normalizeScore } from '@jbrowse/render-core/shaders/scoreScale'
import { SCALE_TYPE_LINEAR, SCALE_TYPE_LOG } from '@jbrowse/wiggle-core'

import { makeDensityLutFillFn } from './getDensityColor.ts'
import { GLSL_FRAGMENT as BAND_GLSL } from './shaders/wiggleBand.glsl.generated.ts'
import { WGSL_SOURCE as BAND_WGSL } from './shaders/wiggleBand.wgsl.generated.ts'
import { GLSL_FRAGMENT as LINE_GLSL } from './shaders/wiggleLine.glsl.generated.ts'
import { WGSL_SOURCE as LINE_WGSL } from './shaders/wiggleLine.wgsl.generated.ts'
import { GLSL_FRAGMENT as CENTER_GLSL } from './shaders/wiggleLineCenter.glsl.generated.ts'
import { WGSL_SOURCE as CENTER_WGSL } from './shaders/wiggleLineCenter.wgsl.generated.ts'
import { RAMP_LINE_BANDS, rampAsBands } from './wiggleDrawFunctions.ts'

import type { RowDraw } from './wiggleDrawFunctions.ts'
import type { ScaleTypeCode } from '@jbrowse/render-core/scoreScale'
import type { SourceRenderData } from '@jbrowse/wiggle-core'

// The GPU colors a line under a gradient by the ramp at each fragment's
// score; Canvas2D and the SVG export stroke it in RAMP_LINE_BANDS bands. A
// score's band has to be the ramp's color there, within the step a band
// spans, or the two backends draw the line in different colors.

const lut = rampLutOf({ scheme: 'viridis' })

function row(
  domainY: [number, number],
  scaleType: ScaleTypeCode,
  rampMid?: number,
) {
  return {
    domainY,
    scaleType,
    symlogConstant: 1,
    rampLut: lut,
    rampMid,
    cuts: [0],
    innerColors: [],
    source: { color: [1, 0, 0], negColor: [0, 0, 1] } as SourceRenderData,
  } as unknown as RowDraw
}

function bandColorOf(banded: RowDraw, score: number) {
  const k = banded.cuts.filter(cut => cut <= score).length
  const colors = [
    banded.source.negColor!,
    ...banded.innerColors,
    banded.source.color,
  ]
  return colors[k]!.map(c => Math.round(c * 255))
}

function parseRgba(s: string) {
  return /rgba\((\d+),(\d+),(\d+)/.exec(s)!.slice(1, 4).map(Number)
}

test.each([
  ['linear', [0, 100] as [number, number], SCALE_TYPE_LINEAR, undefined],
  [
    'linear, middle off-center',
    [0, 100] as [number, number],
    SCALE_TYPE_LINEAR,
    20,
  ],
  ['log', [1, 1000] as [number, number], SCALE_TYPE_LOG, undefined],
])(
  '%s: each score strokes within a band of the ramp',
  (_, domainY, scaleType, rampMid) => {
    const banded = rampAsBands(row(domainY, scaleType, rampMid))
    expect(banded.cuts).toHaveLength(RAMP_LINE_BANDS - 1)
    const ramp = makeDensityLutFillFn(
      domainY[0],
      domainY[1],
      scaleType,
      lut,
      rampMid,
    )
    // a score sits at most half a band from its middle, and viridis moves at
    // most 4 a channel per LUT entry
    const tolerance = (4 * (256 / RAMP_LINE_BANDS)) / 2 + 1
    for (let f = 0; f <= 1; f += 0.01) {
      const score =
        scaleType === SCALE_TYPE_LOG
          ? domainY[0] * (domainY[1] / domainY[0]) ** f
          : domainY[0] + f * (domainY[1] - domainY[0])
      expect(
        normalizeScore(score, domainY[0], domainY[1], scaleType, 1),
      ).toBeCloseTo(f, 6)
      const want = parseRgba(ramp(score))
      const got = bandColorOf(banded, score)
      for (let c = 0; c < 3; c++) {
        expect(Math.abs(got[c]! - want[c]!)).toBeLessThanOrEqual(tolerance)
      }
    }
  },
)

test.each([
  ['step line WGSL', LINE_WGSL],
  ['step line GLSL', LINE_GLSL],
  ['center line WGSL', CENTER_WGSL],
  ['center line GLSL', CENTER_GLSL],
  ['band WGSL', BAND_WGSL],
  ['band GLSL', BAND_GLSL],
])('the %s fragment samples the ramp along the line', (_, src) => {
  expect(src).toMatch(/rampMidT_0\(rowYPxToNorm_0\(/)
})

test('a row with no ramp passes through', () => {
  const plain = { ...row([0, 1], SCALE_TYPE_LINEAR), rampLut: null }
  expect(rampAsBands(plain as unknown as RowDraw)).toBe(plain)
})
