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

// What localpercentile is for, on the distribution it was added for: copy
// number sits at the diploid baseline (2) with a rare gain (3), and clipping
// the <1% tail keeps the baseline readable instead of spending the axis on one
// bin. `local` keeps the full range.
describe('localpercentile clipping', () => {
  const copyNumber = [entry([...new Array(99).fill(2), 3])]

  it('clips the rare gain off the top', () => {
    expect(
      computeAutoscaleDomain('localpercentile', 'avg', 3, copyNumber)![1],
    ).toBeLessThan(3)
  })

  it('local autoscale does not clip', () => {
    expect(computeAutoscaleDomain('local', 'avg', 3, copyNumber)).toEqual([
      2, 3,
    ])
  })

  it('only counts features overlapping the visible window', () => {
    // features at [0,1],[1,2],[2,3],[3,4],[4,5]; window [3,5) keeps the last two
    expect(
      computeAutoscaleDomain('local', 'avg', 3, [
        entry([2, 2, 2, 3, 5], { visStart: 3, visEnd: 5 }),
      ]),
    ).toEqual([3, 5])
  })
})

// The two autoscale passes clip to the visible window by binary search rather
// than testing every fetched feature — a fetch covers half a screen of buffer
// on each side, and localpercentile walks it more than once. What that must not
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
      computeAutoscaleDomain('local', 'avg', 3, [
        wideEntry(scores, { visStart: 35, visEnd: 60 }),
      ]),
    ).toEqual([3, 50])
  })

  it('keeps a feature straddling the right edge', () => {
    // window closes inside feature 3, which still overlaps
    expect(
      computeAutoscaleDomain('local', 'avg', 3, [
        wideEntry(scores, { visStart: 10, visEnd: 35 }),
      ]),
    ).toEqual([1, 50])
  })

  it('excludes a feature that ends exactly at the window start', () => {
    expect(
      computeAutoscaleDomain('local', 'avg', 3, [
        wideEntry(scores, { visStart: 30, visEnd: 40 }),
      ]),
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
        const clipped = computeAutoscaleDomain('local', 'avg', 3, [
          wideEntry(random, { visStart, visEnd }),
        ])
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
