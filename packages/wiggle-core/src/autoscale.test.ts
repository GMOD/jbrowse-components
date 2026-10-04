import { computeAutoscaleDomain } from './autoscale.ts'

import type { FeatureArrays } from './autoscale.ts'

// Build one autoscale dataset entry from a flat score list. Each feature spans
// [i, i+1] by default; the summary arrays mirror featureScores (no whiskers).
function entry(
  scores: number[],
  { visStart = 0, visEnd = scores.length } = {},
): { data: FeatureArrays; visStart: number; visEnd: number } {
  const featureScores = new Float32Array(scores)
  const featurePositions = new Uint32Array(scores.flatMap((_, i) => [i, i + 1]))
  return {
    data: {
      featurePositions,
      featureScores,
      featureMinScores: featureScores,
      featureMaxScores: featureScores,
      numFeatures: scores.length,
      hasSummaryScores: false,
    },
    visStart,
    visEnd,
  }
}

// A quantile below 1 fences the extremes rather than replacing them: copy
// number at the diploid baseline (2) keeps its rare gain (3), which is signal,
// and loses only a spike that would take over half the axis.
describe('outlier fence', () => {
  const copyNumber = [entry([...new Array(99).fill(2), 3])]
  const spiked = [entry([...new Array(99).fill(2), 50])]

  it('keeps a rare gain the baseline leaves room for', () => {
    expect(computeAutoscaleDomain(0.99, 'avg', copyNumber, true)).toEqual([
      2, 3,
    ])
  })

  it('fences a spike at twice the axis the rest need, 0 included', () => {
    expect(computeAutoscaleDomain(0.99, 'avg', spiked, true)).toEqual([2, 4])
  })

  // Off 0, the quantile ends' own span sets the fence; ends that meet span
  // their own size.
  it('fences off 0 at the span of the quantile ends', () => {
    expect(computeAutoscaleDomain(0.99, 'avg', spiked, false)).toEqual([2, 4])
    expect(
      computeAutoscaleDomain(
        0.99,
        'avg',
        [entry([100, ...new Array(97).fill(105), 110, 500])],
        false,
      ),
    ).toEqual([100, 115])
  })

  it('a quantile of 1 does not clip', () => {
    expect(computeAutoscaleDomain(1, 'avg', copyNumber, true)).toEqual([2, 3])
  })

  it('only counts features overlapping the visible window', () => {
    // features at [0,1],[1,2],[2,3],[3,4],[4,5]; window [3,5) keeps the last two
    expect(
      computeAutoscaleDomain(
        1,
        'avg',
        [entry([2, 2, 2, 3, 5], { visStart: 3, visEnd: 5 })],
        true,
      ),
    ).toEqual([3, 5])
  })
})

// The two autoscale passes clip to the visible window by binary search rather
// than testing every fetched feature — a fetch covers half a screen of buffer
// on each side, and a clipped domain walks it twice. What that must not
// change is the answer, including for a feature straddling either edge.
describe('visible-window clipping matches a full scan', () => {
  // spans [i*10, i*10+10), so a window can land inside a feature rather than on
  // a boundary
  function wideEntry(
    scores: number[],
    { visStart = 0, visEnd = scores.length * 10 } = {},
  ) {
    const featureScores = new Float32Array(scores)
    const featurePositions = new Uint32Array(
      scores.flatMap((_, i) => [i * 10, i * 10 + 10]),
    )
    return {
      data: {
        featurePositions,
        featureScores,
        featureMinScores: featureScores,
        featureMaxScores: featureScores,
        numFeatures: scores.length,
        hasSummaryScores: false,
      },
      visStart,
      visEnd,
    }
  }

  // 0 and 100 are the outliers the window must exclude, 50 the one inside it
  const scores = [0, 1, 2, 50, 3, 4, 100]

  it('keeps a feature straddling the left edge', () => {
    // window opens inside feature 3 ([30,40)), so its 50 counts
    expect(
      computeAutoscaleDomain(
        1,
        'avg',
        [wideEntry(scores, { visStart: 35, visEnd: 60 })],
        true,
      ),
    ).toEqual([3, 50])
  })

  it('keeps a feature straddling the right edge', () => {
    // window closes inside feature 3, which still overlaps
    expect(
      computeAutoscaleDomain(
        1,
        'avg',
        [wideEntry(scores, { visStart: 10, visEnd: 35 })],
        true,
      ),
    ).toEqual([1, 50])
  })

  it('excludes a feature that ends exactly at the window start', () => {
    expect(
      computeAutoscaleDomain(
        1,
        'avg',
        [wideEntry(scores, { visStart: 30, visEnd: 40 })],
        true,
      ),
    ).toEqual([50, 50])
  })

  it('agrees with an unclipped scan over every window of random data', () => {
    // deterministic pseudo-random scores; no Math.random so a failure repeats
    let seed = 12345
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed / 2147483648
    }
    const random = Array.from({ length: 200 }, () => rand() * 100 - 50)
    for (let visStart = 0; visStart < 2000; visStart += 137) {
      for (const width of [1, 15, 200, 1500]) {
        const visEnd = visStart + width
        const clipped = computeAutoscaleDomain(
          1,
          'avg',
          [wideEntry(random, { visStart, visEnd })],
          true,
        )
        // the same question asked without any window, over exactly the features
        // that overlap it
        // fround because the scan reads them back out of a Float32Array
        const overlapping = random
          .filter((_, i) => i * 10 < visEnd && i * 10 + 10 > visStart)
          .map(v => Math.fround(v))
        const expected = overlapping.length
          ? [Math.min(...overlapping), Math.max(...overlapping)]
          : undefined
        expect(clipped).toEqual(expected)
      }
    }
  })
})

// A wig or bigwig file can carry a NaN score. Folded into the running min/max
// it turns both NaN, the domain is discarded, and the display falls back to the
// [0, 1] stub — a whole track flattened by one bad bin.
describe('non-finite scores', () => {
  it('scales to the real scores around a NaN', () => {
    expect(
      computeAutoscaleDomain(1, 'avg', [entry([2, Number.NaN, 5, 3])], true),
    ).toEqual([2, 5])
  })

  it('has no domain when every score is NaN', () => {
    expect(
      computeAutoscaleDomain(1, 'avg', [entry([Number.NaN, Number.NaN])], true),
    ).toBeUndefined()
  })
})

// A window holding one sign keeps both its ends under a quantile: a log-ratio
// track panned into a depleted stretch clips its top among the least negative
// values, where the extremes arm already put it, and never at 0.
describe('one-signed windows', () => {
  it('an all-negative window keeps a negative top', () => {
    expect(
      computeAutoscaleDomain(0.99, 'avg', [entry([-4, -3, -2, -1])], true)![1],
    ).toBeLessThan(0)
  })

  it('empty bins lower no top', () => {
    expect(
      computeAutoscaleDomain(0.99, 'avg', [entry([0, 0, 0, 5, 5, 5])], true),
    ).toEqual([0, 5])
  })

  it('empty bins beside negatives keep the top at 0, where the extremes put it', () => {
    const scores = [...new Array(90).fill(0), -1, -2, -3, -1, -2, -3]
    expect(computeAutoscaleDomain(0.99, 'avg', [entry(scores)], true)).toEqual([
      -3, 0,
    ])
  })
})
