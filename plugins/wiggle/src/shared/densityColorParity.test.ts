import { rampLutOf } from '@jbrowse/core/util/colorRamp'
import { COLOR_RAMP_LUT_ENTRIES } from '@jbrowse/render-core/colorRampLut'
import { paintMarkBlocks } from '@jbrowse/render-core/marks'
import { rampMidNorm } from '@jbrowse/render-core/scoreScale'
import { rampMidT } from '@jbrowse/render-core/shaders/colorRampLut'
import { normalizeScore } from '@jbrowse/render-core/shaders/scoreScale'
import {
  RENDERING_TYPE_SCATTER,
  RENDERING_TYPE_XYPLOT,
  SCALE_TYPE_LINEAR,
  SCALE_TYPE_LOG,
  SCALE_TYPE_SYMLOG,
} from '@jbrowse/wiggle-core'

import { makeDensityLutFillFn } from './getDensityColor.ts'
import {
  GLSL_FRAGMENT as FILL_GLSL_FRAGMENT,
  GLSL_VERTEX as FILL_GLSL_VERTEX,
} from './shaders/wiggle.glsl.generated.ts'
import { WGSL_SOURCE as FILL_WGSL_SOURCE } from './shaders/wiggle.wgsl.generated.ts'
import { GLSL_FRAGMENT } from './shaders/wiggleDensity.glsl.generated.ts'
import { WGSL_SOURCE } from './shaders/wiggleDensity.wgsl.generated.ts'
import { WIGGLE_MARKS } from './wiggleMarks.ts'

import type { MarkContext2D } from '@jbrowse/render-core/marks'
import type { ScaleTypeCode } from '@jbrowse/render-core/scoreScale'
import type { WiggleRenderingType } from '@jbrowse/wiggle-core'

// The named-ramp (LUT) mode's GPU side: the generated normalizer, then
// colorRampLut.slang's `rampMidT` against the `rampMidNorm` uniform, then
// wiggleDensity.slang's fragment samples the ramp texture through
// colorRampLut.slang — a linear-filter, clamp-to-edge SampleLevel that both
// HALs configure identically, mirrored here texel for texel. `rampColor` maps
// t into texel space so entry i lands on its own texel center, which is why
// the texel coordinate below is `t * (N - 1)` and not `t * N - 0.5`.
function gpuLutChannels(
  lut: Uint8Array,
  score: number,
  domainMin: number,
  domainMax: number,
  scaleType: ScaleTypeCode,
  symlogConstant: number,
  rampMid: number | undefined,
) {
  const t = rampMidT(
    normalizeScore(score, domainMin, domainMax, scaleType, symlogConstant),
    rampMidNorm(domainMin, domainMax, scaleType, rampMid, symlogConstant),
  )
  const u = Math.min(Math.max(t, 0), 1) * (COLOR_RAMP_LUT_ENTRIES - 1)
  const i0 = Math.floor(u)
  const frac = u - i0
  const lo = Math.min(Math.max(i0, 0), 255) * 4
  const hi = Math.min(Math.max(i0 + 1, 0), 255) * 4
  return [0, 1, 2].map(c => lut[lo + c]! * (1 - frac) + lut[hi + c]! * frac)
}

function parseRgba(s: string): [number, number, number] {
  const m = /^rgba\((\d+),(\d+),(\d+),1\.000\)$/.exec(s)
  if (!m) {
    throw new Error(`not an opaque rgba string: ${s}`)
  }
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

// One LUT bucket, stated as bytes: the GPU's bilinear sample sits between two
// adjacent entries while the Canvas2D LUT rounds to one of them, so the two
// backends can differ by at most the ramp's steepest adjacent-entry step (for
// viridis, a couple of 8-bit units), never by a re-derived ramp's tens.
function maxAdjacentStep(lut: Uint8Array) {
  let max = 0
  for (let i = 0; i < 255; i++) {
    for (let c = 0; c < 3; c++) {
      max = Math.max(max, Math.abs(lut[(i + 1) * 4 + c]! - lut[i * 4 + c]!))
    }
  }
  return max
}

// Domain, scale, origin triples covering what the plan's gate names: the three
// scale types, an origin off zero (origin), a domain crossing zero with
// negative scores, and a degenerate domain.
const CASES: {
  name: string
  domain: [number, number]
  scaleType: ScaleTypeCode
  symlogConstant: number
  origin: number
}[] = [
  {
    name: 'linear, origin 0',
    domain: [0, 100],
    scaleType: SCALE_TYPE_LINEAR,
    symlogConstant: 1,
    origin: 0,
  },
  {
    name: 'linear, origin off zero',
    domain: [0, 100],
    scaleType: SCALE_TYPE_LINEAR,
    symlogConstant: 1,
    origin: 25,
  },
  {
    name: 'linear crossing zero, negative scores',
    domain: [-40, 60],
    scaleType: SCALE_TYPE_LINEAR,
    symlogConstant: 1,
    origin: 0,
  },
  {
    name: 'log',
    domain: [1, 1000],
    scaleType: SCALE_TYPE_LOG,
    symlogConstant: 1,
    origin: 0,
  },
  {
    name: 'log, domain under 1',
    domain: [0.01, 0.5],
    scaleType: SCALE_TYPE_LOG,
    symlogConstant: 1,
    origin: 0,
  },
  {
    name: 'symlog crossing zero',
    domain: [-40, 60],
    scaleType: SCALE_TYPE_SYMLOG,
    symlogConstant: 1,
    origin: 0,
  },
  {
    name: 'symlog, origin off zero',
    domain: [0, 1000],
    scaleType: SCALE_TYPE_SYMLOG,
    symlogConstant: 2,
    origin: 10,
  },
  {
    name: 'degenerate domain',
    domain: [5, 5],
    scaleType: SCALE_TYPE_LINEAR,
    symlogConstant: 1,
    origin: 0,
  },
]

// A unit either side too, so a degenerate domain's sweep straddles its step.
function samples([min, max]: [number, number]) {
  const span = max - min
  return [
    min - span,
    min - 1,
    ...[0, 0.001, 0.1, 0.25, 0.5, 0.75, 0.999, 1].map(f => min + f * span),
    max + span / 2,
    max + 1,
  ]
}

// A heatmap's unset color is a ramp through white at the origin
// (`paintedWiggleColor`), which replaced a white fade the shader computed per
// instance. `retiredFade` is that fade's arithmetic: the distance from the
// origin as a fraction of the origin's distance to the farther domain end,
// lerped from white to the side's color. `rampMidT` through a three-stop LUT
// is the same function, so both backends land within the LUT's own step of it.
function retiredFade(
  score: number,
  [min, max]: [number, number],
  scaleType: ScaleTypeCode,
  symlogConstant: number,
  origin: number,
  [neg, pos]: [number, number, number][],
) {
  const norm = normalizeScore(score, min, max, scaleType, symlogConstant)
  const zeroNorm = normalizeScore(origin, min, max, scaleType, symlogConstant)
  const t = Math.abs(norm - zeroNorm) / Math.max(zeroNorm, 1 - zeroNorm)
  const side = norm < zeroNorm ? neg! : pos!
  return side.map(c => 255 + (c - 255) * t)
}

describe('the default heatmap ramp draws the fade it replaced', () => {
  const NEG: [number, number, number] = [224, 30, 38]
  const POS: [number, number, number] = [0, 104, 209]
  const lut = rampLutOf({
    range: ['rgb(224,30,38)', '#ffffff', 'rgb(0,104,209)'],
  })
  const step = maxAdjacentStep(lut)

  test('one LUT step is a few channel units', () => {
    expect(step).toBeGreaterThan(0)
    expect(step).toBeLessThanOrEqual(3)
  })

  describe.each(CASES.filter(c => c.domain[1] > c.domain[0]))(
    '$name',
    ({ domain, scaleType, symlogConstant, origin }) => {
      const [min, max] = domain
      const canvasFn = makeDensityLutFillFn(
        min,
        max,
        scaleType,
        lut,
        origin,
        symlogConstant,
      )
      test.each(samples(domain))('score %p, on both backends', score => {
        const fade = retiredFade(
          score,
          domain,
          scaleType,
          symlogConstant,
          origin,
          [NEG, POS],
        )
        const gpu = gpuLutChannels(
          lut,
          score,
          min,
          max,
          scaleType,
          symlogConstant,
          origin,
        )
        const canvas = parseRgba(canvasFn(score))
        for (let i = 0; i < 3; i++) {
          expect(Math.abs(gpu[i]! - fade[i]!)).toBeLessThanOrEqual(step)
          expect(Math.abs(canvas[i]! - fade[i]!)).toBeLessThanOrEqual(step)
        }
      })
    },
  )
})

// The named-ramp gauge (agent-docs/architecture-decision-records/adr-095-a-shape-composes-a-scale-at-compile-time.md): a named
// ramp on a density track colors both backends through ONE 256-entry LUT —
// the same bytes the GPU uploads as the density pass's texture and the
// Canvas2D/SVG painter indexes as a fillStyle LUT — with each side landing
// within one bucket of the other, and exactly together at the pivot end.
describe('named-ramp (LUT) density mode', () => {
  const lut = rampLutOf({ scheme: 'viridis' })
  const bucketStep = maxAdjacentStep(lut)

  test('the viridis LUT resolves, stably, one table per ramp and direction', () => {
    expect(lut).toHaveLength(256 * 4)
    expect(rampLutOf({ scheme: 'viridis' })).toBe(lut)
    expect(rampLutOf({ scheme: 'viridis', reverse: true })).not.toBe(lut)
    // viridis really is a LUT a lerp can't fake: adjacent entries move by a
    // few 8-bit units at most, so the one-bucket bound below has teeth
    expect(bucketStep).toBeGreaterThan(0)
    expect(bucketStep).toBeLessThanOrEqual(4)
  })

  const LUT_CASES = CASES.flatMap(c => [
    { ...c, name: `${c.name}, no domainMid`, rampMid: undefined },
    { ...c, name: `${c.name}, domainMid at the origin`, rampMid: c.origin },
  ])

  describe.each(LUT_CASES)(
    '$name',
    ({ domain, scaleType, symlogConstant, rampMid }) => {
      const [min, max] = domain
      const canvasFn = makeDensityLutFillFn(
        min,
        max,
        scaleType,
        lut,
        rampMid,
        symlogConstant,
      )
      const gpuAt = (score: number) =>
        gpuLutChannels(lut, score, min, max, scaleType, symlogConstant, rampMid)
      const entry = (i: number) => [lut[i * 4], lut[i * 4 + 1], lut[i * 4 + 2]]
      const withinBucket = (got: number[], want: number[]) => {
        for (const [i, c] of want.entries()) {
          expect(Math.abs(got[i]! - c)).toBeLessThanOrEqual(bucketStep)
        }
      }

      test.each(samples(domain))(
        'both backends land within one LUT bucket at score %p',
        score => {
          withinBucket(parseRgba(canvasFn(score)), gpuAt(score))
        },
      )

      // Both sides of the middle on one scale: the farther domain end reaches
      // its ramp end, and the nearer lands on its own side, not folded over.
      test('the farther domain end reaches its ramp end on both backends', () => {
        if (max > min) {
          const mid = rampMidNorm(min, max, scaleType, rampMid, symlogConstant)
          const [far, near, farEntry] =
            1 - mid >= mid ? [max, min, 255] : [min, max, 0]
          expect(gpuAt(far)).toEqual(entry(farEntry))
          withinBucket(parseRgba(canvasFn(far)), entry(farEntry) as number[])
          if (mid > 0 && mid < 1) {
            expect(gpuAt(near)).not.toEqual(gpuAt(far))
          }
        }
      })

      test('domainMid sits on the middle stop', () => {
        if (rampMid !== undefined && rampMid > min && rampMid < max) {
          withinBucket(gpuAt(rampMid), entry(127) as number[])
          withinBucket(parseRgba(canvasFn(rampMid)), entry(127) as number[])
        }
      })
    },
  )
})

// Wiggle's `rampMidNorm` clamps a middle out of view onto the domain's end, so
// a ramp whose middle is off the plot reads from that end.
test.each([-0.5, 0, 0.2, 0.5, 0.8, 1, 1.5])(
  'rampMidNorm clamps a middle at %p onto the domain',
  mid => {
    expect(rampMidNorm(0, 1, SCALE_TYPE_LINEAR, mid)).toBe(
      Math.min(1, Math.max(0, mid)),
    )
  },
)

test('an unset domainMid runs the ramp straight across the domain', () => {
  const midNorm = rampMidNorm(-4, 12, SCALE_TYPE_LINEAR, undefined)
  expect(midNorm).toBe(0.5)
  for (const norm of [0, 0.1, 0.25, 0.5, 0.7, 1]) {
    expect(rampMidT(norm, midNorm)).toBeCloseTo(norm, 9)
  }
})

// The sweeps above model `rampColor`'s texel mapping rather than reading it, so
// an edit to colorRampLut.slang alone is invisible to them — the mirror agrees
// with itself. This one reads the emitted source.
//
// The sabotage is sampling at bare `t`, which is what shipped until this test
// existed. A linear-filtered N-wide texture puts entry i's center at
// (i + 0.5)/N while the builder defines it at i/(N - 1), so every entry but the
// two ends comes back a blend of its neighbours — half a step off the table the
// Canvas2D and SVG twins index, and on HiC's alpha gate that is a contact one
// backend paints and the other discards.
describe('the emitted ramp sample lands entry i on its own texel', () => {
  function sampleBody(src: string) {
    const open = src.indexOf('{', src.indexOf('rampColor_0'))
    return src.slice(open, src.indexOf('}', open))
  }

  test.each([
    ['density WGSL', WGSL_SOURCE],
    ['density GLSL', GLSL_FRAGMENT],
    ['fill WGSL', FILL_WGSL_SOURCE],
    ['fill GLSL', FILL_GLSL_FRAGMENT],
  ])('%s remaps t into texel space', (_lang, src) => {
    const body = sampleBody(src)
    expect(body).toContain(`${COLOR_RAMP_LUT_ENTRIES - 1}.0`)
    expect(body).toContain(`/ ${COLOR_RAMP_LUT_ENTRIES}.0`)
  })
})

// Bars and points under a gradient: the fill pass's vertex stage places each
// instance on the ramp through the same two decisions density does, and its
// fragment samples the same texture, so the GPU side is the density mirror
// above. The emitted source is read to hold the shader to that; the Canvas2D
// side is painted through the mark list, which is also the SVG export.
describe('bars and points under a gradient', () => {
  const lut = rampLutOf({ scheme: 'viridis' })
  const bucketStep = maxAdjacentStep(lut)

  test.each([
    ['WGSL', FILL_WGSL_SOURCE],
    ['GLSL', FILL_GLSL_VERTEX],
  ])(
    '%s places each instance on the ramp as density does, under the flag alone',
    (_lang, src) => {
      expect(src).toMatch(
        /rampLut_0\) == (i32\()?1\)?\)[^}]*rampMidT_0\(normalizeScore_0\([^;]*score[^;]*\), u_0\.rampMidNorm_0\);/,
      )
    },
  )

  test.each([
    ['WGSL', FILL_WGSL_SOURCE],
    ['GLSL', FILL_GLSL_FRAGMENT],
  ])('%s samples the ramp only under the flag', (_lang, src) => {
    expect(src).toMatch(/rampLut_0\) == (i32\()?1\)?\)[^}]*rampColor_0\(/)
  })

  function paintedFills(
    renderingType: WiggleRenderingType,
    scores: number[],
    domainY: [number, number],
    rampLut: Uint8Array | undefined,
  ) {
    const fills: string[] = []
    const record = () => fills.push(ctx.fillStyle)
    const ctx = {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      fillRect: record,
      rect: record,
      arc: record,
      save() {},
      restore() {},
      beginPath() {},
      moveTo() {},
      lineTo() {},
      closePath() {},
      fill() {},
      stroke() {},
      clip() {},
    }
    const positions = new Uint32Array(
      scores.flatMap((_, i) => [i * 10, i * 10 + 10]),
    )
    paintMarkBlocks(
      ctx as unknown as MarkContext2D,
      WIGGLE_MARKS,
      new Map([
        [
          0,
          [
            {
              featurePositions: positions,
              featureScores: new Float32Array(scores),
              numFeatures: scores.length,
              color: [0.5, 0.5, 0.5],
              rowIndex: 0,
              renderingType,
            },
          ],
        ],
      ]),
      [
        {
          displayedRegionIndex: 0,
          start: 0,
          end: scores.length * 10,
          screenStartPx: 0,
          screenEndPx: 800,
          reversed: false,
        },
      ],
      {
        canvasWidth: 800,
        canvasHeight: 100,
        renderingType,
        scaleType: SCALE_TYPE_LINEAR,
        symlogConstant: 1,
        domainY,
        numRows: 1,
        diameterPx: 4,
        lineWidth: 1,
        origin: domainY[1],
        pivot: domainY[1],
        cuts: [domainY[1]],
        innerColors: [],
        rampLut,
      },
    )
    // the block's clip rect, drawn before any fill is set
    return fills.filter(fill => fill !== '')
  }

  describe.each([
    ['xyplot', RENDERING_TYPE_XYPLOT],
    ['scatter', RENDERING_TYPE_SCATTER],
  ] as const)('%s', (_name, renderingType) => {
    const domainY: [number, number] = [-900, 0]
    const scores = [-900, -700, -450, -200, -1, 0]

    test('both backends land within one LUT bucket for every instance', () => {
      const fills = paintedFills(renderingType, scores, domainY, lut)
      expect(fills).toHaveLength(scores.length)
      for (const [i, score] of scores.entries()) {
        const gpu = gpuLutChannels(
          lut,
          score,
          domainY[0],
          domainY[1],
          SCALE_TYPE_LINEAR,
          1,
          undefined,
        )
        const canvas = parseRgba(fills[i]!)
        for (const [c, v] of gpu.entries()) {
          expect(Math.abs(canvas[c]! - v)).toBeLessThanOrEqual(bucketStep)
        }
      }
      expect(parseRgba(fills[0]!)).toEqual([lut[0], lut[1], lut[2]])
      expect(parseRgba(fills.at(-1)!)).toEqual([
        lut[255 * 4],
        lut[255 * 4 + 1],
        lut[255 * 4 + 2],
      ])
    })

    test('without a gradient every instance paints the layer color', () => {
      const fills = paintedFills(renderingType, scores, domainY, undefined)
      expect(new Set(fills)).toEqual(new Set(['rgb(128,128,128)']))
    })
  })
})
