import { SCALE_TYPE_LINEAR, SCALE_TYPE_LOG } from '@jbrowse/wiggle-core'

import {
  computeCoverageTicks,
  coverageDepthDomain,
} from '@jbrowse/alignments-core'
import { makeScoreNormalizer } from '@jbrowse/wiggle-core'

import { normalizeDepthScalar } from '../../shaders/slang/alignmentsUniforms.js.generated.ts'
import { makeCoverageScale } from './coverageScale.ts'

// The coverage band's depth scale, checked across the three places it is
// applied: the GPU (alignmentsUniforms.slang's normalizeDepthScalar, imported
// here as the emitted scalar twin — adr-051), the Canvas2D draws
// (makeCoverageScale), and the y-axis ticks (computeCoverageTicks).
//
// They had drifted in two directions at once. The min was dropped by all three,
// so a `minScore` bound changed nothing on screen while the menu reported it in
// force; and the GPU's linear branch was an unclamped `relDepth * depthScale`
// against Canvas2D's clamped one, so a region whose peak exceeded the nice
// rounded domain drew past the top of its band on one backend only.

const DOMAINS: [number, number][] = [
  [0, 100],
  [0, 1],
  [10, 60],
  [1, 1024],
  [0.01, 0.5],
]

const DEPTHS = [0, 0.5, 1, 5, 9, 10, 11, 37, 60, 99, 100, 1024, 5000]

describe.each(DOMAINS)('domain [%f, %f]', (min, max) => {
  test.each([false, true])('shader twin matches makeScoreNormalizer (log %s)', isLog => {
    const normalize = makeScoreNormalizer(
      min,
      max,
      isLog ? SCALE_TYPE_LOG : SCALE_TYPE_LINEAR,
    )
    for (const depth of DEPTHS) {
      expect(normalizeDepthScalar(depth, min, max, isLog)).toBeCloseTo(
        normalize(depth),
        6,
      )
    }
  })

  test.each([false, true])(
    'the Canvas2D scale is that same normalizer (log %s)',
    isLog => {
      const scale = makeCoverageScale({
        coverageMinDepth: min,
        coverageMaxDepth: max,
        coverageIsLog: isLog,
      })!
      const normalize = makeScoreNormalizer(
        min,
        max,
        isLog ? SCALE_TYPE_LOG : SCALE_TYPE_LINEAR,
      )
      for (const depth of DEPTHS) {
        expect(scale.normalize(depth)).toBeCloseTo(normalize(depth), 9)
      }
      // the raw max the count-ratio layers (interbase) need, carried alongside
      expect(scale.domainMax).toBe(max)
    },
  )

  test.each(['linear', 'log'])('every tick lands on its own data (%s)', scaleType => {
    const height = 150
    const { items, yBottom } = computeCoverageTicks([min, max], height, scaleType)
    const normalize = makeScoreNormalizer(
      min,
      max,
      scaleType === 'log' ? SCALE_TYPE_LOG : SCALE_TYPE_LINEAR,
    )
    // effectiveH for a 150px band with the 5px label inset at both ends
    const effectiveH = height - 10
    expect(items.length).toBeGreaterThan(0)
    for (const { value, y } of items) {
      expect(y).toBeCloseTo(yBottom - normalize(value) * effectiveH, 9)
    }
  })
})

// The gate and the scale are one value, so a layer cannot be drawn against a
// domain that has not resolved.
test('there is no scale until the debounced autoscale resolves', () => {
  expect(
    makeCoverageScale({
      coverageMinDepth: undefined,
      coverageMaxDepth: undefined,
      coverageIsLog: false,
    }),
  ).toBeUndefined()
})

// What the whole change is for: the bound moves the baseline, on the axis and
// in the pixels, rather than being computed and thrown away.
describe('a minScore bound', () => {
  test('moves the depth that draws flat', () => {
    const scale = makeCoverageScale({
      coverageMinDepth: 10,
      coverageMaxDepth: 60,
      coverageIsLog: false,
    })!
    expect(scale.normalize(10)).toBe(0)
    expect(scale.normalize(60)).toBe(1)
    expect(scale.normalize(35)).toBeCloseTo(0.5, 9)
    // below the bound clamps to the baseline rather than going negative
    expect(scale.normalize(0)).toBe(0)
  })

  test('moves the axis with it', () => {
    const bounded = computeCoverageTicks([10, 60], 150).items.map(t => t.value)
    expect(bounded[0]).toBe(10)
    expect(bounded.at(-1)).toBeLessThanOrEqual(60)
    // unbounded, the same band still starts at 0
    expect(computeCoverageTicks([0, 60], 150).items[0]!.value).toBe(0)
  })

  test('a bound that swallows the data leaves one honest tick', () => {
    // minScore above the visible peak: every bar is flat, so there is nothing to
    // ladder between
    const { items } = computeCoverageTicks([200, 60], 150)
    expect(items.map(t => t.value)).toEqual([60])
  })
})

// Depth is a count of whole reads, which is what separates this axis from a
// wiggle track's. getNiceDomain deliberately keeps a log domain under 1 — for a
// mappability track or a methylation fraction that is right — and a single-read
// pileup nices to exactly that. Reading the min without this floor put eight
// fractional read counts on the axis (0.0078125, 0.015625, …).
describe('a log depth domain floors at one read', () => {
  test('a shallow domain is pulled up to 1', () => {
    expect(coverageDepthDomain([0.0078125, 1], 'log')).toEqual([1, 1])
    expect(computeCoverageTicks(
      coverageDepthDomain([0.0078125, 1], 'log'),
      150,
      'log',
    ).items.map(t => t.value)).toEqual([1])
  })

  test('an ordinary log domain is untouched, and so is any linear one', () => {
    expect(coverageDepthDomain([1, 128], 'log')).toEqual([1, 128])
    // linear depth legitimately starts at 0 — no reads — and a minScore bound
    // there is a whole-read count already
    expect(coverageDepthDomain([0, 100], 'linear')).toEqual([0, 100])
    expect(coverageDepthDomain([0.5, 100], 'linear')).toEqual([0.5, 100])
  })

  test('the octave ladder is unchanged for every autoscaled log domain', () => {
    for (const [domain, expected] of [
      [[1, 2], [1, 2]],
      [[1, 8], [1, 2, 4, 8]],
      [[1, 128], [1, 2, 4, 8, 16, 32, 64, 128]],
    ] as [[number, number], number[]][]) {
      expect(
        computeCoverageTicks(
          coverageDepthDomain(domain, 'log'),
          150,
          'log',
        ).items.map(t => t.value),
      ).toEqual(expected)
    }
  })
})
