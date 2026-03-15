import { buildSegmentArrays } from './processFeatureAlignments.ts'

import type { FeatureData, GapData } from './webglRpcTypes.ts'

function feat(id: string, start: number, end: number): FeatureData {
  return {
    id,
    name: id,
    start,
    end,
    flags: 0,
    mapq: 60,
    avgBaseQuality: 30,
    insertSize: 0,
    pairOrientation: 0,
    strand: 1,
  }
}

function skip(featureId: string, start: number, end: number): GapData {
  return { featureId, start, end, type: 'skip', strand: 1, featureStrand: 1 }
}

function del(featureId: string, start: number, end: number): GapData {
  return {
    featureId,
    start,
    end,
    type: 'deletion',
    strand: 1,
    featureStrand: 1,
  }
}

function segments(
  features: FeatureData[],
  gaps: GapData[],
  regionStart: number,
  regionEnd: number,
) {
  const idToIdx = new Map<string, number>()
  for (const [i, f] of features.entries()) {
    idToIdx.set(f.id, i)
  }
  const result = buildSegmentArrays(
    features,
    gaps,
    regionStart,
    regionEnd,
    id => idToIdx.get(id) ?? 0,
  )
  const segs = []
  for (let i = 0; i < result.numSegments; i++) {
    segs.push({
      start: result.segmentPositions[i * 2],
      end: result.segmentPositions[i * 2 + 1],
      readIdx: result.segmentReadIndices[i],
      edge: result.segmentEdgeFlags[i],
    })
  }
  return segs
}

describe('buildSegmentArrays', () => {
  test('read without skips produces one segment', () => {
    const result = segments([feat('r1', 1000, 1200)], [], 1000, 1200)
    expect(result).toEqual([{ start: 0, end: 200, readIdx: 0, edge: 0b11 }])
  })

  test('deletions are ignored (only skips split reads)', () => {
    const result = segments(
      [feat('r1', 1000, 1200)],
      [del('r1', 1050, 1060)],
      1000,
      1200,
    )
    expect(result).toEqual([{ start: 0, end: 200, readIdx: 0, edge: 0b11 }])
  })

  test('single skip splits read into two exon segments', () => {
    const result = segments(
      [feat('r1', 1000, 2000)],
      [skip('r1', 1200, 1800)],
      1000,
      2000,
    )
    expect(result).toEqual([
      { start: 0, end: 200, readIdx: 0, edge: 0b01 },
      { start: 800, end: 1000, readIdx: 0, edge: 0b10 },
    ])
  })

  test('multiple skips produce multiple exon segments', () => {
    const result = segments(
      [feat('r1', 1000, 5000)],
      [skip('r1', 1200, 1800), skip('r1', 2100, 4800)],
      1000,
      5000,
    )
    expect(result).toEqual([
      { start: 0, end: 200, readIdx: 0, edge: 0b01 },
      { start: 800, end: 1100, readIdx: 0, edge: 0 },
      { start: 3800, end: 4000, readIdx: 0, edge: 0b10 },
    ])
  })

  test('multiple reads each get their own segments', () => {
    const result = segments(
      [feat('r1', 1000, 2000), feat('r2', 1000, 1500)],
      [skip('r1', 1200, 1800)],
      1000,
      2000,
    )
    expect(result).toEqual([
      { start: 0, end: 200, readIdx: 0, edge: 0b01 },
      { start: 800, end: 1000, readIdx: 0, edge: 0b10 },
      { start: 0, end: 500, readIdx: 1, edge: 0b11 },
    ])
  })

  describe('collapsed intron mode (read extends beyond region)', () => {
    test('segments extend to full feature end (GPU handles clipping)', () => {
      // Read spans 1000-50000 with skip 1200-49800, region is first exon area
      const result = segments(
        [feat('r1', 1000, 50000)],
        [skip('r1', 1200, 49800)],
        1000,
        1300,
      )
      // Both exons are emitted — GPU rasterizer clips off-screen segments
      expect(result).toEqual([
        { start: 0, end: 200, readIdx: 0, edge: 0b01 },
        { start: 48800, end: 49000, readIdx: 0, edge: 0 },
      ])
    })

    test('read starting before region has no first-edge flag', () => {
      // Region covers second exon, read started way before
      const result = segments(
        [feat('r1', 1000, 50000)],
        [skip('r1', 1200, 49800)],
        49700,
        50100,
      )
      // Exon is at [100, 300] relative to regionStart=49700
      expect(result).toEqual([{ start: 100, end: 300, readIdx: 0, edge: 0b10 }])
    })

    test('read entirely intronic produces off-screen exon segments', () => {
      // Region is fully within the intron — exon segments still emitted
      // but will be off-screen (GPU clips them)
      const result = segments(
        [feat('r1', 1000, 50000)],
        [skip('r1', 1200, 49800)],
        5000,
        5300,
      )
      // Exon at offset [0-200] from feature start = [-4000, -3800] from regionStart → clamped
      // Second exon at [44800, 45000] relative to regionStart=5000
      expect(result).toEqual([
        { start: 44800, end: 45000, readIdx: 0, edge: 0 },
      ])
    })

    test('skip gap entirely before region — segment extends to full read end', () => {
      const result = segments(
        [feat('r1', 1000, 50000)],
        [skip('r1', 1200, 1800)],
        2000,
        2300,
      )
      // Skip gap offsets from regionStart=2000: start=max(0,-800)=0, end=max(0,-200)=0
      // Both clamped to 0, so single segment [0, 48000]
      expect(result).toEqual([{ start: 0, end: 48000, readIdx: 0, edge: 0 }])
    })

    test('skip gap entirely after region — full segments emitted', () => {
      const result = segments(
        [feat('r1', 1000, 50000)],
        [skip('r1', 49000, 49800)],
        1000,
        1300,
      )
      // Skip gap offsets: start=48000, end=48800
      // Segments: [0, 48000] and [48800, 49000]
      expect(result).toEqual([
        { start: 0, end: 48000, readIdx: 0, edge: 0b01 },
        { start: 48800, end: 49000, readIdx: 0, edge: 0 },
      ])
    })
  })

  describe('edge flags for chevrons', () => {
    test('read fully within region gets both edge flags', () => {
      const result = segments([feat('r1', 1050, 1150)], [], 1000, 1200)
      expect(result[0]!.edge).toBe(0b11)
    })

    test('read extending left gets no first flag', () => {
      const result = segments([feat('r1', 900, 1150)], [], 1000, 1200)
      expect(result[0]!.edge).toBe(0b10)
    })

    test('read extending right gets no last flag', () => {
      const result = segments([feat('r1', 1050, 1300)], [], 1000, 1200)
      expect(result[0]!.edge).toBe(0b01)
    })

    test('read extending both sides gets no flags', () => {
      const result = segments([feat('r1', 900, 1300)], [], 1000, 1200)
      expect(result[0]!.edge).toBe(0b00)
    })

    test('with skips, first flag on first segment, last flag on last segment', () => {
      const result = segments(
        [feat('r1', 1000, 2000)],
        [skip('r1', 1200, 1800)],
        1000,
        2000,
      )
      expect(result[0]!.edge).toBe(0b01)
      expect(result[1]!.edge).toBe(0b10)
    })
  })

  test('unsorted skip gaps are handled correctly', () => {
    const result = segments(
      [feat('r1', 1000, 5000)],
      [skip('r1', 2100, 4800), skip('r1', 1200, 1800)],
      1000,
      5000,
    )
    expect(result).toEqual([
      { start: 0, end: 200, readIdx: 0, edge: 0b01 },
      { start: 800, end: 1100, readIdx: 0, edge: 0 },
      { start: 3800, end: 4000, readIdx: 0, edge: 0b10 },
    ])
  })
})
