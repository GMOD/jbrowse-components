import { computeAutoscaleDomain, computeScoreExtent } from './autoscale.ts'

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

describe('computeScoreExtent', () => {
  it('returns the true unclipped [min, max]', () => {
    expect(computeScoreExtent('avg', [entry([2, 2, 2, 3, 1])])).toEqual([1, 3])
  })

  it('returns undefined for no visible features', () => {
    expect(computeScoreExtent('avg', [])).toBeUndefined()
  })

  it('only counts features overlapping the visible window', () => {
    // features at [0,1],[1,2],[2,3],[3,4],[4,5]; window [3,5) keeps the last two
    const e = entry([2, 2, 2, 3, 5], { visStart: 3, visEnd: 5 })
    expect(computeScoreExtent('avg', [e])).toEqual([3, 5])
  })
})

describe('clip detection (score legend indicator)', () => {
  // The scenario the density legend flags: copy number sits at the diploid
  // baseline (2) with a rare gain (3). localpercentile discards that <1% tail as
  // an outlier, pinning the domain max below the true max — so the legend shows
  // the true extent (↑3). `local` keeps the full range, so nothing clips.
  const copyNumber = [entry([...Array(99).fill(2), 3])]

  it('localpercentile clips the rare gain below the true extent', () => {
    const extent = computeScoreExtent('avg', copyNumber)!
    const domain = computeAutoscaleDomain(
      'localpercentile',
      'avg',
      3,
      copyNumber,
    )!
    expect(extent[1]).toBe(3)
    expect(domain[1]).toBeLessThan(extent[1])
  })

  it('local autoscale does not clip', () => {
    const extent = computeScoreExtent('avg', copyNumber)!
    const domain = computeAutoscaleDomain('local', 'avg', 3, copyNumber)!
    expect(domain).toEqual(extent)
  })
})
