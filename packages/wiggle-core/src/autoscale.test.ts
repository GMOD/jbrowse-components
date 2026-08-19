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
