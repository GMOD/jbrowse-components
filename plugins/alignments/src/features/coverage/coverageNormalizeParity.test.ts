import {
  SCALE_TYPE_LINEAR,
  SCALE_TYPE_LOG,
  SCALE_TYPE_SYMLOG,
  getNiceDomain,
  makeScoreNormalizer,
  resolveSymlogConstant,
  scaleTypeFromString,
} from '@jbrowse/wiggle-core'

import {
  computeCoverageTicks,
  coverageDepthDomain,
  normalizeDepthScalar,
} from '@jbrowse/alignments-core'

import { makeCoverageScale } from './coverageScale.ts'

// The coverage band's depth scale, checked across the three places it is
// applied: the GPU (coverageBand.slang's normalizeDepthScalar, imported
// here as the emitted scalar twin — adr-051), the Canvas2D draws
// (makeCoverageScale), and the y-axis ticks (computeCoverageTicks).
//
// They had drifted in two directions at once. The min was dropped by all three,
// so a `minScore` bound changed nothing on screen while the menu reported it in
// force; and the GPU's linear branch was unclamped against Canvas2D's clamped
// one, so a region whose peak exceeded the nice rounded domain drew past the top
// of its band on one backend only.

const DOMAINS: [number, number][] = [
  [0, 100],
  [0, 1],
  [10, 60],
  [1, 1024],
  [0.01, 0.5],
]

const DEPTHS = [0, 0.5, 1, 5, 9, 10, 11, 37, 60, 99, 100, 1024, 5000]

// symlog's case on a coverage band: the depths log cannot separate. On a log
// domain floored to [1, max] a depth of 1 normalizes to 0 — the same height as
// no coverage at all — so a single-read position is invisible. These sweep the
// GPU twin against the CPU one across exactly that range.
describe.each(DOMAINS)('symlog domain [%f, %f]', (min, max) => {
  const c = resolveSymlogConstant(min, max, 0)
  test('shader twin matches makeScoreNormalizer', () => {
    const normalize = makeScoreNormalizer(min, max, SCALE_TYPE_SYMLOG, c)
    for (const depth of DEPTHS) {
      expect(
        normalizeDepthScalar(depth, min, max, SCALE_TYPE_SYMLOG, c),
      ).toBeCloseTo(normalize(depth), 6)
    }
  })

  // Only where the domain actually starts below a depth of 1. Where it starts
  // AT 1 (a `minScore` bound of 1, say) a depth of 1 is the baseline on every
  // scale, and drawing it flat is correct rather than a bug.
  test('a depth of 1 is not flattened onto the baseline', () => {
    if (max <= 1 || min >= 1) {
      return
    }
    const normalize = makeScoreNormalizer(min, max, SCALE_TYPE_SYMLOG, c)
    // what log does with the same domain: floored to [1, max], so a depth of 1
    // lands on 0 — indistinguishable from a position with no reads at all
    const log = makeScoreNormalizer(Math.max(min, 1), max, SCALE_TYPE_LOG)
    expect(log(1)).toBe(0)
    expect(normalize(1)).toBeGreaterThan(0)
  })
})

describe.each(DOMAINS)('domain [%f, %f]', (min, max) => {
  test.each([false, true])('shader twin matches makeScoreNormalizer (log %s)', isLog => {
    const normalize = makeScoreNormalizer(
      min,
      max,
      isLog ? SCALE_TYPE_LOG : SCALE_TYPE_LINEAR,
    )
    for (const depth of DEPTHS) {
      expect(normalizeDepthScalar(
        depth,
        min,
        max,
        isLog ? SCALE_TYPE_LOG : SCALE_TYPE_LINEAR,
        1,
      )).toBeCloseTo(
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
        coverageScaleType: isLog ? SCALE_TYPE_LOG : SCALE_TYPE_LINEAR,
        coverageSymlogConstant: 1,
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

  // symlog is in this sweep because it was the one scale left out of it: the
  // display passed no constant, `computeCoverageTicks` defaulted the RESOLVED
  // one to 1, and the axis labelled log(depth + 1) over bars normalized against
  // a thousandth of the visible max. It now takes the raw slot and resolves it
  // the way the renderer does, which is what this asserts.
  test.each(['linear', 'log', 'symlog'])(
    'every tick lands on its own data (%s)',
    scaleType => {
      const height = 150
      const { items, yBottom } = computeCoverageTicks(
        [min, max],
        height,
        scaleType,
      )
      const normalize = makeScoreNormalizer(
        min,
        max,
        scaleTypeFromString(scaleType),
        resolveSymlogConstant(min, max, 0),
      )
      // effectiveH for a 150px band with the 5px label inset at both ends
      const effectiveH = height - 10
      expect(items.length).toBeGreaterThan(0)
      for (const { value, y } of items) {
        expect(y).toBeCloseTo(yBottom - normalize(value) * effectiveH, 9)
      }
    },
  )
})

// The gate and the scale are one value, so a layer cannot be drawn against a
// domain that has not resolved.
test('there is no scale until the debounced autoscale resolves', () => {
  expect(
    makeCoverageScale({
      coverageMinDepth: undefined,
      coverageMaxDepth: undefined,
      coverageScaleType: 0 as const,
    coverageSymlogConstant: 1,
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
      coverageScaleType: 0 as const,
    coverageSymlogConstant: 1,
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

  test('a bound above the visible peak flattens the bars onto the baseline', () => {
    // minScore 200 against an autoscaled peak of 60. `getNiceDomain` widens the
    // autoscaled TOP rather than handing anything a descending domain — which
    // the two normalizers used to answer in opposite directions, so the same
    // band drew empty on the GPU and solid full-height in an SVG export.
    const domain = getNiceDomain({
      scaleType: 'linear',
      domain: [0, 60],
      bounds: [200, undefined],
    })
    expect(domain[1]).toBeGreaterThan(domain[0])

    const { items } = computeCoverageTicks(domain, 150)
    expect(items[0]!.value).toBe(200)

    // and every depth the data actually holds sits at the baseline, on both
    // backends — flat at the BOTTOM, which the old `[200, 60]` pin could not
    // tell apart from flat at the top
    const scale = makeCoverageScale({
      coverageMinDepth: domain[0],
      coverageMaxDepth: domain[1],
      coverageScaleType: SCALE_TYPE_LINEAR,
      coverageSymlogConstant: 1,
    })!
    for (const depth of [0, 1, 10, 30, 60]) {
      expect(scale.normalize(depth)).toBe(0)
      expect(
        normalizeDepthScalar(depth, domain[0], domain[1], SCALE_TYPE_LINEAR, 1),
      ).toBe(0)
    }
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
