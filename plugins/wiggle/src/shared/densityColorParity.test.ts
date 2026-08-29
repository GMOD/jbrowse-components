import { normalizeScore } from '@jbrowse/render-core/shaders/scoreScale'
import {
  SCALE_TYPE_LINEAR,
  SCALE_TYPE_LOG,
  SCALE_TYPE_SYMLOG,
} from '@jbrowse/wiggle-core'

import { densityRampLut } from './densityColorRamp.ts'
import {
  makeDensityLutFillFn,
  makeDensityRgbStringFn,
} from './getDensityColor.ts'
import { densityGradientT } from './shaders/wiggleCommon.js.generated.ts'

import type { WiggleScaleType } from '@jbrowse/wiggle-core'

// Gate C of agent-docs/architecture-decision-records/adr-095-a-shape-composes-a-scale-at-compile-time.md: both backends land on
// the same density colour, swept across every scale type. The GPU path is
// wiggleDensity.slang's vertex stage —
//
//   lerp(white, trackColor, densityGradientT(
//     normalizeScore(score, ...), normalizeScore(origin, ...)))
//
// — and both of its decisions are the generated twins imported here:
// `normalizeScore` from scoreScale.slang (swept against the hand-written
// factory by normalizeScoreParity.test.ts) and `densityGradientT` from
// wiggleCommon.slang (swept by densityGradientParity.test.ts). The Canvas2D and
// SVG path is `makeDensityRgbStringFn`, which quantizes the same t into a
// 256-bucket string LUT. So the two sides can differ by at most one LUT bucket
// — under one 8-bit channel step — and at the ramp's ends, where t is exactly 0
// or 1, they must agree exactly.
//
// The one piece of the shader chain with no generated twin is the final
// per-channel lerp, `255 + (channel - 255) * t`, mirrored below; a lifted twin
// would need vec3 support the codegen refuses by name (wgslToJs.ts). Its two
// endpoints are pinned exactly instead.

function gpuDensityChannels(
  score: number,
  domainMin: number,
  domainMax: number,
  scaleType: number,
  symlogConstant: number,
  origin: number,
  rgb: [number, number, number],
) {
  const norm = normalizeScore(
    score,
    domainMin,
    domainMax,
    scaleType,
    symlogConstant,
  )
  const zeroNorm = normalizeScore(
    origin,
    domainMin,
    domainMax,
    scaleType,
    symlogConstant,
  )
  const t = densityGradientT(norm, zeroNorm)
  return rgb.map(c => 255 + (c - 255) * t)
}

function parseRgb(s: string): [number, number, number] {
  const m = /^rgb\((\d+),(\d+),(\d+)\)$/.exec(s)
  if (!m) {
    throw new Error(`not an rgb string: ${s}`)
  }
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

const TRACK_COLORS: [number, number, number][] = [
  [0, 0, 255],
  [255, 0, 0],
  [37, 118, 189],
]

// The named-ramp (LUT) mode's GPU side: the same generated score→t chain as
// above, then wiggleDensity.slang's fragment samples the 256×1 ramp texture
// through colorRampLut.slang — a linear-filter, clamp-to-edge SampleLevel that
// both HALs configure identically, mirrored here texel for texel. u is the
// texel-space coordinate (texel centers at i + 0.5), so the sample is the
// lerp of the two entries around it, and past either end both taps clamp to
// the end entry.
function gpuLutChannels(
  lut: Uint8Array,
  score: number,
  domainMin: number,
  domainMax: number,
  scaleType: number,
  symlogConstant: number,
  origin: number,
) {
  const t = densityGradientT(
    normalizeScore(score, domainMin, domainMax, scaleType, symlogConstant),
    normalizeScore(origin, domainMin, domainMax, scaleType, symlogConstant),
  )
  const u = Math.min(Math.max(t, 0), 1) * 256 - 0.5
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
// scale types, an origin off zero (bicolorPivot), a domain crossing zero with
// negative scores, and a degenerate domain.
const CASES: {
  name: string
  domain: [number, number]
  scaleType: WiggleScaleType
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

function samples([min, max]: [number, number]) {
  const span = max - min
  return [
    min - span,
    ...[0, 0.001, 0.1, 0.25, 0.5, 0.75, 0.999, 1].map(f => min + f * span),
    max + span / 2,
  ]
}

describe.each(CASES)(
  '$name',
  ({ domain, scaleType, symlogConstant, origin }) => {
    const [min, max] = domain
    describe.each(TRACK_COLORS)('track color rgb(%i,%i,%i)', (r, g, b) => {
      const canvasFn = makeDensityRgbStringFn(
        min,
        max,
        scaleType,
        r,
        g,
        b,
        origin,
        symlogConstant,
      )

      test.each(samples(domain))(
        'both backends land within one LUT bucket at score %p',
        score => {
          const gpu = gpuDensityChannels(
            score,
            min,
            max,
            scaleType,
            symlogConstant,
            origin,
            [r, g, b],
          )
          const canvas = parseRgb(canvasFn(score))
          for (let i = 0; i < 3; i++) {
            // One bucket of the 256-entry LUT moves a channel by at most
            // |c - 255| / 255 <= 1, plus the LUT's own |0 truncation: under 2
            // channel steps end to end, where a diverged normalizer or a
            // wrong-way asymmetric ramp is tens.
            expect(Math.abs(gpu[i]! - canvas[i]!)).toBeLessThan(2)
          }
        },
      )

      test('the pivot is white on both backends, exactly', () => {
        const gpu = gpuDensityChannels(
          origin,
          min,
          max,
          scaleType,
          symlogConstant,
          origin,
          [r, g, b],
        )
        expect(gpu).toEqual([255, 255, 255])
        expect(canvasFn(origin)).toBe('rgb(255,255,255)')
      })

      test('the far end of the domain is the track color', () => {
        // maxDist picks whichever end sits further from the pivot; on a
        // degenerate domain every score normalizes to 0 = zeroNorm, so the far
        // end is white like everything else. The GPU side is exact — t is
        // x / max(x, ...) = 1 — while the Canvas factory hoists the
        // normalizer's reciprocal out of its loop, so its t can land at
        // 0.99999… and one LUT bucket short: within one channel step, not
        // string-equal.
        const far = max === min ? null : origin - min < max - origin ? max : min
        if (far !== null) {
          const gpu = gpuDensityChannels(
            far,
            min,
            max,
            scaleType,
            symlogConstant,
            origin,
            [r, g, b],
          )
          expect(gpu.map(Math.round)).toEqual([r, g, b])
          const canvas = parseRgb(canvasFn(far))
          for (const [i, c] of [r, g, b].entries()) {
            expect(Math.abs(canvas[i]! - c)).toBeLessThanOrEqual(1)
          }
        }
      })
    })
  },
)

// The named-ramp gauge (agent-docs/architecture-decision-records/adr-095-a-shape-composes-a-scale-at-compile-time.md): a named
// ramp on a density track colours both backends through ONE 256-entry LUT —
// the same bytes the GPU uploads as the density pass's texture and the
// Canvas2D/SVG painter indexes as a fillStyle LUT — with each side landing
// within one bucket of the other, and exactly together at the pivot end.
describe('named-ramp (LUT) density mode', () => {
  const lut = densityRampLut('viridis')!
  const bucketStep = maxAdjacentStep(lut)

  test('the viridis LUT resolves, stably, and default resolves to none', () => {
    expect(lut).toHaveLength(256 * 4)
    expect(densityRampLut('viridis')).toBe(lut)
    expect(densityRampLut('default')).toBeNull()
    expect(densityRampLut(undefined)).toBeNull()
    // an unknown name (a stale session value) degrades to the default fade
    expect(densityRampLut('no-such-ramp')).toBeNull()
    // viridis really is a LUT a lerp can't fake: adjacent entries move by a
    // few 8-bit units at most, so the one-bucket bound below has teeth
    expect(bucketStep).toBeGreaterThan(0)
    expect(bucketStep).toBeLessThanOrEqual(4)
  })

  describe.each(CASES)(
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

      test.each(samples(domain))(
        'both backends land within one LUT bucket at score %p',
        score => {
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
            expect(Math.abs(gpu[i]! - canvas[i]!)).toBeLessThanOrEqual(
              bucketStep,
            )
          }
        },
      )

      test('the pivot is the first LUT entry on both backends, exactly', () => {
        const first = [lut[0], lut[1], lut[2]]
        expect(
          gpuLutChannels(
            lut,
            origin,
            min,
            max,
            scaleType,
            symlogConstant,
            origin,
          ),
        ).toEqual(first)
        expect(parseRgba(canvasFn(origin))).toEqual(first)
      })

      test('the far end of the domain is the last LUT entry', () => {
        const far = max === min ? null : origin - min < max - origin ? max : min
        if (far !== null) {
          const last = [lut[255 * 4], lut[255 * 4 + 1], lut[255 * 4 + 2]]
          const gpu = gpuLutChannels(
            lut,
            far,
            min,
            max,
            scaleType,
            symlogConstant,
            origin,
          )
          // GPU-exact: t = 1 puts both bilinear taps on texel 255 under
          // clamp-to-edge. The Canvas side hoists the normalizer's reciprocal,
          // so on symlog its t can land one bucket short (the same
          // pre-existing wrinkle the default mode's sweep documents) — within
          // one bucket, not exact.
          expect(gpu).toEqual(last)
          const canvas = parseRgba(canvasFn(far))
          for (const [i, c] of last.entries()) {
            expect(Math.abs(canvas[i]! - c!)).toBeLessThanOrEqual(bucketStep)
          }
        }
      })
    },
  )
})
