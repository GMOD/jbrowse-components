import { normalizeScore } from '@jbrowse/render-core/shaders/scoreScale'
import {
  SCALE_TYPE_LINEAR,
  SCALE_TYPE_LOG,
  SCALE_TYPE_SYMLOG,
  getNiceDomain,
  makeScoreNormalizer,
  resolveSymlogConstant,
} from '@jbrowse/wiggle-core'

// The two backends' score normalizers, swept against each other.
//
// The shader half is `scoreScale.slang`'s, in render-core: the wiggle renderer
// and the coverage band both normalize through it, and this is the sweep for
// both. The domains come from wiggle-core's `getNiceDomain`, which is what
// actually reaches a display, so the test lives beside the consumer that
// produces them.
//
// Unlike the rest of the `//! js-export` set (adr-051), this one does NOT retire
// its hand-written twin: `makeScoreNormalizer` is a factory that hoists the log
// arithmetic out of a per-feature loop, and the generated function is per-call
// scalar. Keeping both is the point — the generated one is here purely as an
// oracle for the shader, so the branch a reader compares against is the branch
// the GPU actually runs.
//
// It earned the slot by drifting: both floored the log domain at 1, which made
// a domain sitting entirely under 1 normalize to a flat baseline, and fixing it
// meant hand-editing the same rule into `normalize.ts` and `wiggle.slang` with
// nothing checking they agreed afterwards.

const noBounds: [undefined, undefined] = [undefined, undefined]

function nice(scaleType: string, domain: [number, number]) {
  return getNiceDomain({ scaleType, domain, bounds: noBounds })
}

// Domains the app can actually reach, each already through getNiceDomain the
// way a display's `domain` getter delivers it.
const LINEAR_DOMAINS = [
  nice('linear', [0, 1000]),
  nice('linear', [-40, 60]),
  nice('linear', [0, 1]),
]
// symlog exists for the domains scaleLog cannot hold at all: reaching 0, and
// crossing it.
const SYMLOG_DOMAINS = [
  nice('symlog', [0, 1000]),
  nice('symlog', [0, 1]),
  nice('symlog', [-40, 60]),
  nice('symlog', [0, 0.05]),
]
const LOG_DOMAINS = [
  nice('log', [1, 1000]),
  nice('log', [1, 2]),
  // the regression this pairing exists for
  nice('log', [0.01, 0.5]),
  nice('log', [0.00001, 0.02]),
]

// Sampled across and beyond each domain: the clamp at both ends is as much a
// part of the contract as the ramp between them.
function samples([min, max]: [number, number]) {
  const span = max - min
  const inside = [0, 0.001, 0.1, 0.25, 0.5, 0.75, 0.999, 1].map(
    t => min + t * span,
  )
  return [min - span, min - span / 2, ...inside, max + span / 2, 0]
}

describe.each(LINEAR_DOMAINS)('linear domain %j', (min, max) => {
  const normalize = makeScoreNormalizer(min, max, SCALE_TYPE_LINEAR)
  test.each(samples([min, max]))('score %p', score => {
    expect(normalizeScore(score, min, max, SCALE_TYPE_LINEAR, 1)).toBeCloseTo(
      normalize(score),
      6,
    )
  })
})

describe.each(LOG_DOMAINS)('log domain %j', (min, max) => {
  const normalize = makeScoreNormalizer(min, max, SCALE_TYPE_LOG)
  test.each(samples([min, max]))('score %p', score => {
    // 6 places, not bit equality: the shader's log2 is float32 and JS's is
    // float64, so the two agree to about 1e-15 and the tolerance is the
    // standing rule for generated float32 arithmetic.
    expect(normalizeScore(score, min, max, SCALE_TYPE_LOG, 1)).toBeCloseTo(
      normalize(score),
      6,
    )
  })

  test('the domain spans the whole plot', () => {
    expect(normalizeScore(min, min, max, SCALE_TYPE_LOG, 1)).toBeCloseTo(0, 6)
    expect(normalizeScore(max, min, max, SCALE_TYPE_LOG, 1)).toBeCloseTo(1, 6)
  })
})

describe.each(SYMLOG_DOMAINS)('symlog domain %j', (min, max) => {
  const c = resolveSymlogConstant(min, max, 0)
  const normalize = makeScoreNormalizer(min, max, SCALE_TYPE_SYMLOG, c)
  test.each(samples([min, max]))('score %p', score => {
    expect(normalizeScore(score, min, max, SCALE_TYPE_SYMLOG, c)).toBeCloseTo(
      normalize(score),
      6,
    )
  })

  test('zero is a real position, not the floor', () => {
    // the whole point over scaleLog: 0 normalizes to where the domain puts it,
    // and on a domain that crosses zero that is somewhere up the plot.
    const atZero = normalizeScore(0, min, max, SCALE_TYPE_SYMLOG, c)
    expect(atZero).toBeCloseTo(normalize(0), 6)
    if (min < 0) {
      expect(atZero).toBeGreaterThan(0)
    }
  })
})

// A degenerate domain used to be the one place the two disagreed — the shader
// divided by a 1e-6 floor and saturated where JS answered 0. Returning 0 avoids
// the NaN that floor was there for just as well, so both now answer 0 and the
// exception is gone. Pinned because it is the kind of agreement that is only
// visible at an input nothing reaches in production.
describe('a degenerate domain', () => {
  test('both answer 0', () => {
    expect(makeScoreNormalizer(5, 5, SCALE_TYPE_LINEAR)(9)).toBe(0)
    expect(normalizeScore(9, 5, 5, SCALE_TYPE_LINEAR, 1)).toBe(0)
    expect(normalizeScore(9, 5, 5, SCALE_TYPE_LOG, 1)).toBe(0)
    expect(normalizeScore(9, 5, 5, SCALE_TYPE_SYMLOG, 1)).toBe(0)
  })

  test('getNiceDomain never hands a log display one', () => {
    // `max <= min` is widened to `min * 2`, so the log branch above is only
    // ever swept over domains with real span
    for (const raw of [
      [5, 5],
      [0, 0],
      [0.25, 0.25],
    ] as [number, number][]) {
      const [min, max] = nice('log', raw)
      expect(max).toBeGreaterThan(min)
    }
  })
})
