import { SimpleFeature } from '@jbrowse/core/util'

import { featureScoreRange, filterByScore } from './scoreFilter.ts'

import type { Feature } from '@jbrowse/core/util'

function feat(uniqueId: string, score?: number): Feature {
  return new SimpleFeature({
    uniqueId,
    refName: 'ctgA',
    start: 0,
    end: 100,
    ...(score === undefined ? {} : { score }),
  })
}

describe('featureScoreRange', () => {
  it('spans the numeric scores present', () => {
    expect(
      featureScoreRange([feat('a', 3), feat('b', 9), feat('c', 5)]),
    ).toEqual({ min: 3, max: 9 })
  })

  it('ignores features carrying no score', () => {
    expect(featureScoreRange([feat('a', 3), feat('b'), feat('c', 9)])).toEqual({
      min: 3,
      max: 9,
    })
  })

  // both are a slider with nothing to say: the menu drops the row rather than
  // drawing one whose two ends filter identically
  it('is undefined with no scores at all', () => {
    expect(featureScoreRange([feat('a'), feat('b')])).toBeUndefined()
  })

  it('is undefined when every score is the same', () => {
    expect(featureScoreRange([feat('a', 4), feat('b', 4)])).toBeUndefined()
  })
})

describe('filterByScore', () => {
  it('keeps the features at or above the threshold', () => {
    const features = [feat('a', 1), feat('b', 5), feat('c', 10)]
    expect(filterByScore(features, 5).map(f => f.id())).toEqual(['b', 'c'])
  })

  // the threshold is a statement about an attribute, so a feature that doesn't
  // carry it isn't a candidate for it — a mixed file would otherwise blank its
  // scoreless half the moment the slider left 0
  it('always keeps a feature with no score', () => {
    const features = [feat('a', 1), feat('b')]
    expect(filterByScore(features, 500).map(f => f.id())).toEqual(['b'])
  })

  it('keeps everything at 0 when the scores are counts', () => {
    const features = [feat('a', 0), feat('b', 1), feat('c')]
    expect(filterByScore(features, 0)).toHaveLength(3)
  })
})
