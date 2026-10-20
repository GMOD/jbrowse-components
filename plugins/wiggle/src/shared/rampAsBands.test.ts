import { rampLutOf } from '@jbrowse/core/util/colorRamp'
import { rampMidNorm } from '@jbrowse/render-core/scoreScale'
import { rampMidT } from '@jbrowse/render-core/shaders/colorRampLut'
import {
  normalizeScore,
  normalizeScoreUnclamped,
} from '@jbrowse/render-core/shaders/scoreScale'
import {
  SCALE_TYPE_LINEAR,
  SCALE_TYPE_LOG,
  SCALE_TYPE_SYMLOG,
} from '@jbrowse/wiggle-core'

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
// score; Canvas2D and the SVG export stroke it in RAMP_LINE_BANDS bands. Each
// score has to land in the band its normalized position names, painted the
// LUT entry at that band's middle, or the two backends draw the line in
// different colors.

const lut = rampLutOf({ scheme: 'viridis' })

function row(
  domainY: [number, number],
  scaleType: ScaleTypeCode,
  scores: number[],
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
    source: {
      color: [1, 0, 0],
      negColor: [0, 0, 1],
      featureScores: Float32Array.from(scores),
      numFeatures: scores.length,
    } as unknown as SourceRenderData,
  } as unknown as RowDraw
}

function bandColorOf(banded: RowDraw, score: number) {
  const k = banded.cuts.filter(cut => cut <= score).length
  return [banded.source.negColor!, ...banded.innerColors, banded.source.color][
    k
  ]!.map(c => Math.round(c * 255))
}

function sweep([min, max]: [number, number], scaleType: ScaleTypeCode) {
  return Array.from({ length: 201 }, (_, i) => {
    const f = i / 200
    return scaleType === SCALE_TYPE_LOG
      ? min * (max / min) ** f
      : min + f * (max - min)
  })
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
  ['symlog', [-50, 400] as [number, number], SCALE_TYPE_SYMLOG, 0],
])(
  '%s: each score strokes its own band, in the LUT entry at its middle',
  (_, domainY, scaleType, rampMid) => {
    const [min, max] = domainY
    const scores = sweep(domainY, scaleType)
    const banded = rampAsBands(row(domainY, scaleType, scores, rampMid))
    expect(banded.cuts).toHaveLength(RAMP_LINE_BANDS - 1)
    const mid = rampMidNorm(min, max, scaleType, rampMid, 1)
    for (const score of scores) {
      const norm = normalizeScoreUnclamped(score, min, max, scaleType, 1)
      // a score on a cut, as float arithmetic puts it, may read either side
      if (
        Math.abs(norm * RAMP_LINE_BANDS - Math.round(norm * RAMP_LINE_BANDS)) <
        1e-6
      ) {
        continue
      }
      const k = Math.min(
        Math.floor(norm * RAMP_LINE_BANDS),
        RAMP_LINE_BANDS - 1,
      )
      const entry = Math.round(rampMidT((k + 0.5) / RAMP_LINE_BANDS, mid) * 255)
      expect(bandColorOf(banded, score)).toEqual([
        lut[entry * 4],
        lut[entry * 4 + 1],
        lut[entry * 4 + 2],
      ])
    }
  },
)

test('only the bands the values reach are stroked', () => {
  const banded = rampAsBands(row([0, 100], SCALE_TYPE_LINEAR, [40, 60]))
  // 40 and 60 fall in bands 12 and 19
  expect(banded.cuts).toHaveLength(7)
  expect(banded.innerColors).toHaveLength(6)
})

// The GPU normalizes a score on a domain with no range to a step: 0 at the
// domain, 1 above it.
test('a domain with no range strokes the GPU step', () => {
  const banded = rampAsBands(row([5, 5], SCALE_TYPE_LINEAR, [5, 6]))
  const end = (t: number) => {
    const i = Math.round(rampMidT(t, 0.5) * 255) * 4
    return [lut[i], lut[i + 1], lut[i + 2]]
  }
  expect(normalizeScore(5, 5, 5, SCALE_TYPE_LINEAR, 1)).toBe(0)
  expect(bandColorOf(banded, 5)).toEqual(end(0))
  expect(bandColorOf(banded, 6)).toEqual(end(1))
})

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
  const plain = { ...row([0, 1], SCALE_TYPE_LINEAR, [0]), rampLut: null }
  expect(rampAsBands(plain as unknown as RowDraw)).toBe(plain)
})
