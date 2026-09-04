import { capsuleDistPx } from '@jbrowse/render-core/shaders/capsule'

import {
  buildDotplotPickIndex,
  featureSegmentRange,
  pickDotplotFeature,
} from './dotplotPickEngine.ts'
import { fakeDotplotInstanceData } from './testUtils.ts'

import type { DotplotPickTransform } from './dotplotPickEngine.ts'
import type { DotplotInstanceData } from './dotplotRenderingBackendTypes.ts'

// Segments as [x1, y1, x2, y2, featureIdx], in absolute cumBp — the space the
// display's geometry is actually in.
function makeData(
  segments: [number, number, number, number, number][],
): DotplotInstanceData {
  const data = fakeDotplotInstanceData(segments.length)
  segments.forEach(([x1, y1, x2, y2, f], i) => {
    data.x1[i] = x1
    data.y1[i] = y1
    data.x2[i] = x2
    data.y2[i] = y2
    data.instanceFeatureIdx[i] = f
  })
  return data
}

// 1 bp per px on both axes, viewport at the origin, so cumBp and px agree on x
// and y is flipped through the height — the simplest frame to reason in.
const UNIT: DotplotPickTransform = {
  viewBpH: 0,
  viewBpV: 0,
  bpPerPxHInv: 1,
  bpPerPxVInv: 1,
  viewHeight: 100,
}

function pick(
  data: DotplotInstanceData,
  x: number,
  y: number,
  transform = UNIT,
  tolerancePx = 3,
) {
  return pickDotplotFeature({ data, x, y, transform, tolerancePx })
}

describe('featureSegmentRange', () => {
  // buildLineSegments walks features in ascending order and writes each one's
  // segments consecutively, which is the whole reason a binary search can stand
  // in for a per-feature offsets array.
  const idx = new Uint32Array([0, 0, 0, 2, 5, 5])

  test('brackets a feature with several segments', () => {
    expect(featureSegmentRange(idx, 6, 0)).toEqual([0, 3])
    expect(featureSegmentRange(idx, 6, 5)).toEqual([4, 6])
  })

  test('brackets a feature with one segment', () => {
    expect(featureSegmentRange(idx, 6, 2)).toEqual([3, 4])
  })

  // A feature filtered out by minAlignmentLength emits no segments, so its
  // range is empty rather than its neighbour's.
  test('an absent feature gets an empty range', () => {
    expect(featureSegmentRange(idx, 6, 1)).toEqual([3, 3])
    expect(featureSegmentRange(idx, 6, 9)).toEqual([6, 6])
  })
})

describe('buildDotplotPickIndex', () => {
  test('one box per feature, not per segment', () => {
    const data = makeData([
      [0, 0, 10, 10, 0],
      [10, 10, 20, 20, 0],
      [50, 50, 60, 60, 1],
    ])
    const index = buildDotplotPickIndex(data)
    expect(index?.featureIdx).toEqual(new Uint32Array([0, 1]))
  })

  // Flatbush throws on an empty index, and there is nothing to hit anyway.
  test('empty geometry has no index', () => {
    expect(buildDotplotPickIndex(makeData([]))).toBeUndefined()
  })
})

describe('pickDotplotFeature', () => {
  const data = makeData([[10, 10, 40, 40, 0]])

  test('hits a point on the segment', () => {
    // cumBp (20,20) is px (20, 100-20=80)
    expect(pick(data, 20, 80)?.featureIdx).toBe(0)
  })

  test('hits within the tolerance and misses beyond it', () => {
    expect(pick(data, 22, 80)?.distancePx).toBeCloseTo(Math.SQRT2)
    expect(pick(data, 30, 80)).toBeUndefined()
  })

  test('misses past the end of the segment rather than off its line', () => {
    // (50,50) is on the segment's infinite line but past its endpoint
    expect(pick(data, 50, 50)).toBeUndefined()
  })

  test('a zero-length segment is a hittable dot', () => {
    const dot = makeData([[10, 10, 10, 10, 0]])
    expect(pick(dot, 10, 90)?.featureIdx).toBe(0)
    expect(pick(dot, 15, 90)).toBeUndefined()
  })

  // The shader strokes a capsule, so past an endpoint the ink is a half-disc
  // and the pick measures to the endpoint — the distance capsule.slang's own
  // capsuleDistPx gives in the segment's frame, not a box around the segment.
  test('the end cap is round, and is the shader’s capsule distance', () => {
    // cumBp (42,40) is px (42,60); the endpoint (40,40) is px (40,60).
    const hit = pick(data, 42, 60)
    expect(hit?.distancePx).toBeCloseTo(2)
    const halfLen = Math.hypot(30, 30) / 2
    const along = Math.hypot(2, 0) * Math.cos(Math.PI / 4) + halfLen
    const across = Math.hypot(2, 0) * Math.sin(Math.PI / 4)
    expect(hit?.distancePx).toBeCloseTo(capsuleDistPx(along, across, halfLen))
    // Diagonally off the corner a box would still contain, 3·√2 ≈ 4.2 px away.
    expect(pick(data, 43, 57)).toBeUndefined()
  })

  test('nothing to hit on empty geometry', () => {
    expect(pick(makeData([]), 0, 0)).toBeUndefined()
  })

  test('the nearest feature wins, not the last one drawn', () => {
    const two = makeData([
      [20, 20, 20, 20, 0],
      [24, 20, 24, 20, 1],
    ])
    // 1px from feature 0, 3px from feature 1 — the later-drawn one
    expect(pick(two, 21, 80)?.featureIdx).toBe(0)
    expect(pick(two, 23, 80)?.featureIdx).toBe(1)
  })

  test('a tie goes to the later segment, which is drawn on top', () => {
    const two = makeData([
      [20, 20, 20, 20, 0],
      [20, 20, 20, 20, 1],
    ])
    expect(pick(two, 20, 80)?.featureIdx).toBe(1)
  })

  // Past one Flatbush node the index Hilbert-sorts, and candidates then come
  // back in tree order rather than insertion order — so a tie can arrive with
  // the later segment FIRST, where `<=` alone lets an earlier one overwrite it.
  // Four dots 2px from the cursor, one on each side, decide the answer by draw
  // order alone; the filler is only there to push the index past `nodeSize`,
  // which is what makes it sort at all. A whole-genome plot is nothing but this.
  test('a tie is broken by draw order even when the index reorders them', () => {
    const filler = Array.from(
      { length: 20 },
      (_, i) => [1000 + i * 100, 1000, 1000 + i * 100, 1000, i] as const,
    )
    const ring = makeData([
      ...filler.map(f => [...f] as [number, number, number, number, number]),
      [22, 20, 22, 20, 20],
      [20, 22, 20, 22, 21],
      [18, 20, 18, 20, 22],
      [20, 18, 20, 18, 23],
    ])
    expect(pick(ring, 20, 80)?.featureIdx).toBe(23)
  })

  // The two axes are independently scaled and routinely differ by orders of
  // magnitude (a read-vs-ref plot). A distance measured in bp would answer with
  // whichever feature is nearest in the compressed axis' units, which is not
  // the one under the cursor.
  test('distance is measured in px, not bp', () => {
    const anisotropic: DotplotPickTransform = { ...UNIT, bpPerPxVInv: 1 / 100 }
    // Cursor at px (20, 50), i.e. cumBp (20, 5000). Feature 0 is 2 bp away
    // along h, which is 2px; feature 1 is 100 bp away along v, which is 1px.
    // So px says 1 and bp says 0.
    const data2 = makeData([
      [22, 5000, 22, 5000, 0],
      [20, 5100, 20, 5100, 1],
    ])
    expect(pick(data2, 20, 50, anisotropic)?.featureIdx).toBe(1)
  })

  test('the pan enters through the transform, not a rebuilt index', () => {
    // Same index, two viewports: the feature is under a different px each time.
    expect(pick(data, 20, 80)?.featureIdx).toBe(0)
    expect(pick(data, 20, 80, { ...UNIT, viewBpH: 10 })).toBeUndefined()
    expect(pick(data, 10, 80, { ...UNIT, viewBpH: 10 })?.featureIdx).toBe(0)
  })

  // The segment, not just the feature: it is what the tooltip resolves the CIGAR
  // operator under the cursor from, and one alignment's staircase can hold a
  // dozen of them.
  test('answers which segment of a feature the cursor is nearest', () => {
    const staircase = makeData([
      [10, 10, 20, 10, 0],
      [20, 10, 20, 20, 0],
      [20, 20, 30, 20, 0],
    ])
    expect(pick(staircase, 15, 90)?.segmentIdx).toBe(0)
    expect(pick(staircase, 20, 85)?.segmentIdx).toBe(1)
    expect(pick(staircase, 25, 80)?.segmentIdx).toBe(2)
  })

  test('every segment of a CIGAR-detailed feature is hittable', () => {
    // One feature, a staircase: the pick must test the whole run, not the hull
    const staircase = makeData([
      [10, 10, 20, 10, 0],
      [20, 10, 20, 20, 0],
      [20, 20, 30, 20, 0],
    ])
    expect(pick(staircase, 15, 90)?.featureIdx).toBe(0)
    expect(pick(staircase, 25, 80)?.featureIdx).toBe(0)
    // inside the hull but off every segment
    expect(pick(staircase, 12, 80)).toBeUndefined()
  })
})
