import { findOverlayHit, findRowHit } from './findHit.ts'

import type { MultiWiggleSourceData } from '../../RenderMultiWiggleDataRPC/types.ts'
import type { WiggleFeatureArrays } from '../../util.ts'

function makeSource(
  name: string,
  features: { start: number; end: number; score: number; min?: number; max?: number }[],
): MultiWiggleSourceData {
  const n = features.length
  const positions = new Uint32Array(n * 2)
  const scores = new Float32Array(n)
  const minScores = new Float32Array(n)
  const maxScores = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const f = features[i]!
    positions[i * 2] = f.start
    positions[i * 2 + 1] = f.end
    scores[i] = f.score
    minScores[i] = f.min ?? f.score
    maxScores[i] = f.max ?? f.score
  }
  const featureArrays: WiggleFeatureArrays = {
    featurePositions: positions,
    featureScores: scores,
    featureMinScores: minScores,
    featureMaxScores: maxScores,
    numFeatures: n,
    posFeaturePositions: new Uint32Array(0),
    posFeatureScores: new Float32Array(0),
    posNumFeatures: 0,
    negFeaturePositions: new Uint32Array(0),
    negFeatureScores: new Float32Array(0),
    negNumFeatures: 0,
  }
  return { name, ...featureArrays }
}

describe('findOverlayHit', () => {
  test('collects every visible source with a feature at bp', () => {
    const data = {
      sources: [
        makeSource('s1', [{ start: 0, end: 100, score: 5 }]),
        makeSource('s2', [{ start: 0, end: 100, score: 10 }]),
        makeSource('s3', [{ start: 0, end: 100, score: 15 }]),
      ],
    }
    const result = findOverlayHit(
      data,
      [{ name: 's1' }, { name: 's2' }, { name: 's3' }],
      50,
      'chr1',
      'avg',
    )
    expect(result).toEqual({
      refName: 'chr1',
      start: 50,
      end: 50,
      score: 0,
      source: '',
      allSources: [
        { source: 's1', score: 5 },
        { source: 's2', score: 10 },
        { source: 's3', score: 15 },
      ],
    })
  })

  test('skips sources not in the visible set', () => {
    const data = {
      sources: [
        makeSource('s1', [{ start: 0, end: 100, score: 5 }]),
        makeSource('s2', [{ start: 0, end: 100, score: 10 }]),
      ],
    }
    const result = findOverlayHit(data, [{ name: 's1' }], 50, 'chr1', 'avg')
    expect(result?.allSources).toHaveLength(1)
    expect(result?.allSources?.[0]?.source).toBe('s1')
  })

  test('skips sources with no feature at bp', () => {
    const data = {
      sources: [
        makeSource('s1', [{ start: 0, end: 100, score: 5 }]),
        makeSource('s2', [{ start: 200, end: 300, score: 10 }]),
      ],
    }
    const result = findOverlayHit(
      data,
      [{ name: 's1' }, { name: 's2' }],
      50,
      'chr1',
      'avg',
    )
    expect(result?.allSources).toHaveLength(1)
    expect(result?.allSources?.[0]?.source).toBe('s1')
  })

  test('returns undefined when no visible source has a feature at bp', () => {
    const data = {
      sources: [makeSource('s1', [{ start: 200, end: 300, score: 5 }])],
    }
    const result = findOverlayHit(data, [{ name: 's1' }], 50, 'chr1', 'avg')
    expect(result).toBeUndefined()
  })

  test('attaches summary fields when score has min/max and mode is not avg', () => {
    const data = {
      sources: [
        makeSource('s1', [{ start: 0, end: 100, score: 5, min: 1, max: 9 }]),
      ],
    }
    const result = findOverlayHit(data, [{ name: 's1' }], 50, 'chr1', 'whiskers')
    expect(result?.allSources?.[0]).toEqual({
      source: 's1',
      score: 5,
      summary: true,
      minScore: 1,
      maxScore: 9,
    })
  })

  test('omits summary fields when mode is avg', () => {
    const data = {
      sources: [
        makeSource('s1', [{ start: 0, end: 100, score: 5, min: 1, max: 9 }]),
      ],
    }
    const result = findOverlayHit(data, [{ name: 's1' }], 50, 'chr1', 'avg')
    expect(result?.allSources?.[0]).toEqual({ source: 's1', score: 5 })
  })

  test('omits summary fields when min/max equal score (not a real summary)', () => {
    const data = {
      sources: [
        makeSource('s1', [{ start: 0, end: 100, score: 5, min: 5, max: 5 }]),
      ],
    }
    const result = findOverlayHit(data, [{ name: 's1' }], 50, 'chr1', 'whiskers')
    expect(result?.allSources?.[0]).toEqual({ source: 's1', score: 5 })
  })
})

describe('findRowHit', () => {
  const sources = [{ name: 's1' }, { name: 's2' }, { name: 's3' }]

  test('cursor Y picks the row → that source', () => {
    const data = {
      sources: [
        makeSource('s1', [{ start: 0, end: 100, score: 5 }]),
        makeSource('s2', [{ start: 0, end: 100, score: 10 }]),
        makeSource('s3', [{ start: 0, end: 100, score: 15 }]),
      ],
    }
    // rowHeight=20, offsetY=25 → row 1 (s2)
    const result = findRowHit(data, sources, 50, 25, 20, 'chr1', 'avg')
    expect(result).toEqual({
      refName: 'chr1',
      start: 0,
      end: 100,
      score: 10,
      source: 's2',
    })
  })

  test('returns undefined when offsetY is outside the rows', () => {
    const data = {
      sources: [makeSource('s1', [{ start: 0, end: 100, score: 5 }])],
    }
    const aboveAll = findRowHit(data, sources, 50, -1, 20, 'chr1', 'avg')
    const belowAll = findRowHit(data, sources, 50, 200, 20, 'chr1', 'avg')
    expect(aboveAll).toBeUndefined()
    expect(belowAll).toBeUndefined()
  })

  test('returns undefined when picked source has no data in the region', () => {
    const data = {
      sources: [makeSource('s1', [{ start: 0, end: 100, score: 5 }])],
    }
    // row 1 (s2) but data only has s1
    const result = findRowHit(data, sources, 50, 25, 20, 'chr1', 'avg')
    expect(result).toBeUndefined()
  })

  test('returns undefined when no feature at bp in the picked source', () => {
    const data = {
      sources: [makeSource('s1', [{ start: 200, end: 300, score: 5 }])],
    }
    const result = findRowHit(data, [{ name: 's1' }], 50, 5, 20, 'chr1', 'avg')
    expect(result).toBeUndefined()
  })

  test('returns the picked source feature interval, not the cursor bp', () => {
    const data = {
      sources: [makeSource('s1', [{ start: 100, end: 500, score: 7 }])],
    }
    // bp 250 falls inside the [100, 500] feature
    const result = findRowHit(data, [{ name: 's1' }], 250, 5, 20, 'chr1', 'avg')
    expect(result?.start).toBe(100)
    expect(result?.end).toBe(500)
  })

  test('attaches summary fields in non-avg mode', () => {
    const data = {
      sources: [
        makeSource('s1', [{ start: 0, end: 100, score: 5, min: 1, max: 9 }]),
      ],
    }
    const result = findRowHit(data, [{ name: 's1' }], 50, 5, 20, 'chr1', 'min')
    expect(result).toMatchObject({
      summary: true,
      minScore: 1,
      maxScore: 9,
    })
  })
})
