import { findMultiWiggleHit, findOverlayHit, findRowHit } from './findHit.ts'

import type { WiggleFeatureArrays, WiggleSourceData } from '../../util.ts'
import type { MultiWiggleHitModel } from './findHit.ts'

function makeSource(
  name: string,
  features: {
    start: number
    end: number
    score: number
    min?: number
    max?: number
  }[],
): WiggleSourceData {
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
    hasSummaryScores: false,
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
      rows: [
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
    expect(result?.rows).toHaveLength(1)
    expect(result?.rows[0]?.source).toBe('s1')
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
    expect(result?.rows).toHaveLength(1)
    expect(result?.rows[0]?.source).toBe('s1')
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
    const result = findOverlayHit(
      data,
      [{ name: 's1' }],
      50,
      'chr1',
      'whiskers',
    )
    expect(result?.rows[0]).toEqual({
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
    expect(result?.rows[0]).toEqual({ source: 's1', score: 5 })
  })

  test('omits summary fields when min/max equal score (not a real summary)', () => {
    const data = {
      sources: [
        makeSource('s1', [{ start: 0, end: 100, score: 5, min: 5, max: 5 }]),
      ],
    }
    const result = findOverlayHit(
      data,
      [{ name: 's1' }],
      50,
      'chr1',
      'whiskers',
    )
    expect(result?.rows[0]).toEqual({ source: 's1', score: 5 })
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
      rows: [{ source: 's2', score: 10 }],
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
    expect(result?.rows[0]).toMatchObject({
      summary: true,
      minScore: 1,
      maxScore: 9,
    })
  })
})

describe('findMultiWiggleHit', () => {
  const regions = [
    {
      refName: 'chr1',
      screenStartPx: 0,
      screenEndPx: 100,
      start: 0,
      end: 100,
      displayedRegionIndex: 0,
    },
  ]

  function makeModel(over: Partial<MultiWiggleHitModel> = {}) {
    return {
      rowHeight: 20,
      sources: [{ name: 's1' }],
      rpcDataMap: new Map([
        [
          0,
          { sources: [makeSource('s1', [{ start: 0, end: 100, score: 5 }])] },
        ],
      ]),
      summaryScoreMode: 'avg',
      isOverlay: false,
      showTree: false,
      treeAreaWidth: 0,
      ...over,
    }
  }

  test('finds the feature under the cursor', () => {
    const hit = findMultiWiggleHit(makeModel(), regions, 50, 5)
    expect(hit?.rows[0]?.score).toBe(5)
  })

  test('returns undefined with no sources', () => {
    const model = makeModel({ sources: [] })
    expect(findMultiWiggleHit(model, regions, 50, 5)).toBeUndefined()
  })

  // The tree sidebar overlays the left of the same container the mouse handlers
  // are bound to and does not stop propagation, so without this gate a click on
  // a tree node also opens a feature widget behind the node menu.
  test('ignores cursor positions over the tree sidebar', () => {
    const model = makeModel({
      showTree: true,
      hierarchy: {},
      treeAreaWidth: 40,
    })
    // 40 wide + a resize handle, so 40 is still sidebar and 50 is plot
    expect(findMultiWiggleHit(model, regions, 10, 5)).toBeUndefined()
    expect(findMultiWiggleHit(model, regions, 40, 5)).toBeUndefined()
    expect(findMultiWiggleHit(model, regions, 50, 5)?.rows[0]?.score).toBe(5)
  })

  test('hit-tests the full width when the tree is hidden', () => {
    const model = makeModel({ showTree: false, treeAreaWidth: 40 })
    expect(findMultiWiggleHit(model, regions, 10, 5)?.rows[0]?.score).toBe(5)
  })

  test('a hierarchy-less model has no sidebar to exclude', () => {
    const model = makeModel({ showTree: true, treeAreaWidth: 40 })
    expect(findMultiWiggleHit(model, regions, 10, 5)?.rows[0]?.score).toBe(5)
  })

  test('overlay mode collects a row per source at the cursor bp', () => {
    const model = makeModel({
      isOverlay: true,
      sources: [{ name: 's1' }, { name: 's2' }],
      rpcDataMap: new Map([
        [
          0,
          {
            sources: [
              makeSource('s1', [{ start: 0, end: 100, score: 5 }]),
              makeSource('s2', [{ start: 0, end: 100, score: 9 }]),
            ],
          },
        ],
      ]),
    })
    const hit = findMultiWiggleHit(model, regions, 50, 5)
    expect(hit?.rows.map(r => r.score)).toEqual([5, 9])
  })

  test('row mode past the last row is a miss, not the last source', () => {
    const model = makeModel({ rowHeight: 20 })
    expect(findMultiWiggleHit(model, regions, 50, 25)).toBeUndefined()
  })

  test('a zero-height display is a miss rather than NaN row math', () => {
    const model = makeModel({ rowHeight: 0 })
    expect(findMultiWiggleHit(model, regions, 50, 0)).toBeUndefined()
  })
})
