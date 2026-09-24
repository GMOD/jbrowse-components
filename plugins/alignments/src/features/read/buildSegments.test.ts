import { buildSegmentArrays } from './buildSegments.ts'

import type { FeatureData, GapData } from '../../shared/webglRpcTypes.ts'

function feat(id: string, start: number, end: number): FeatureData {
  return {
    id,
    start,
    end,
    flags: 0,
    mapq: 60,
    insertSize: 0,
    pairOrientation: 0,
    strand: 1,
  }
}

function skip(readIndex: number, start: number, end: number): GapData {
  return { readIndex, start, end, type: 'skip', strand: 1, featureStrand: 1 }
}

function del(readIndex: number, start: number, end: number): GapData {
  return {
    readIndex,
    start,
    end,
    type: 'deletion',
    strand: 1,
    featureStrand: 1,
  }
}

function segments(features: FeatureData[], gaps: GapData[]) {
  const result = buildSegmentArrays(features, gaps)
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
  test('read without skips is its own first and last segment', () => {
    expect(segments([feat('r1', 1000, 1200)], [])).toEqual([
      { start: 1000, end: 1200, readIdx: 0, edge: 0b11 },
    ])
  })

  test('deletions are ignored (only skips split reads)', () => {
    expect(segments([feat('r1', 1000, 1200)], [del(0, 1050, 1060)])).toEqual([
      { start: 1000, end: 1200, readIdx: 0, edge: 0b11 },
    ])
  })

  test('skips split a read into exons, flagged first and last', () => {
    expect(
      segments(
        [feat('r1', 1000, 5000)],
        [skip(0, 1200, 1800), skip(0, 2100, 4800)],
      ),
    ).toEqual([
      { start: 1000, end: 1200, readIdx: 0, edge: 0b01 },
      { start: 1800, end: 2100, readIdx: 0, edge: 0 },
      { start: 4800, end: 5000, readIdx: 0, edge: 0b10 },
    ])
  })

  test('multiple reads each get their own segments', () => {
    expect(
      segments(
        [feat('r1', 1000, 2000), feat('r2', 1000, 1500)],
        [skip(0, 1200, 1800)],
      ),
    ).toEqual([
      { start: 1000, end: 1200, readIdx: 0, edge: 0b01 },
      { start: 1800, end: 2000, readIdx: 0, edge: 0b10 },
      { start: 1000, end: 1500, readIdx: 1, edge: 0b11 },
    ])
  })

  test('a long spliced read keeps its exons at their true positions', () => {
    expect(segments([feat('r1', 1000, 50000)], [skip(0, 1200, 49800)])).toEqual(
      [
        { start: 1000, end: 1200, readIdx: 0, edge: 0b01 },
        { start: 49800, end: 50000, readIdx: 0, edge: 0b10 },
      ],
    )
  })

  test('unsorted skip gaps are handled correctly', () => {
    expect(
      segments(
        [feat('r1', 1000, 5000)],
        [skip(0, 2100, 4800), skip(0, 1200, 1800)],
      ),
    ).toEqual([
      { start: 1000, end: 1200, readIdx: 0, edge: 0b01 },
      { start: 1800, end: 2100, readIdx: 0, edge: 0 },
      { start: 4800, end: 5000, readIdx: 0, edge: 0b10 },
    ])
  })
})
