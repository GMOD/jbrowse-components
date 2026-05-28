import { findCellAtBp } from './findCellAtBp.ts'

import type { MafRegionData } from '../../LinearMafRenderer/mafBackendTypes.ts'

const enc = new TextEncoder()

function region(
  blocks: { startBp: number; refSeq: string; rows: [number, string][] }[],
): MafRegionData {
  return {
    blocks: blocks.map(b => ({
      startBp: b.startBp,
      refSeqBytes: enc.encode(b.refSeq),
      rows: b.rows.map(([rowIndex, aln]) => ({
        rowIndex,
        alignmentBytes: enc.encode(aln),
      })),
    })),
    coverage: {
      coverageDepths: new Float32Array(0),
      coverageStartPos: 0,
      coverageMaxDepth: 0,
      mismatchPositions: new Uint32Array(0),
      mismatchBases: new Uint8Array(0),
      coveragePackedBuffer: new ArrayBuffer(0),
      snpPackedBuffer: new ArrayBuffer(0),
      interbasePackedBuffer: new ArrayBuffer(0),
      interbaseMaxCount: 0,
      indicatorPackedBuffer: new ArrayBuffer(0),
    },
  }
}

test('returns base at exact genomic position', () => {
  const r = region([{ startBp: 100, refSeq: 'AAAAA', rows: [[0, 'acgta']] }])
  expect(findCellAtBp(r, 100, 0, false)).toEqual({ base: 'a' })
  expect(findCellAtBp(r, 102, 0, false)).toEqual({ base: 'g' })
  expect(findCellAtBp(r, 104, 0, false)).toEqual({ base: 'a' })
})

test('preserves input case when showAsUpperCase=false', () => {
  // showAsUpperCase=false is the raw-passthrough mode — the function must
  // not silently lowercase uppercase input (or vice versa).
  const lower = region([{ startBp: 100, refSeq: 'AAA', rows: [[0, 'acg']] }])
  const upper = region([{ startBp: 100, refSeq: 'AAA', rows: [[0, 'ACG']] }])
  const mixed = region([{ startBp: 100, refSeq: 'AAA', rows: [[0, 'aCg']] }])
  expect(findCellAtBp(lower, 101, 0, false)).toEqual({ base: 'c' })
  expect(findCellAtBp(upper, 101, 0, false)).toEqual({ base: 'C' })
  expect(findCellAtBp(mixed, 101, 0, false)).toEqual({ base: 'C' })
})

test('showAsUpperCase=true folds any input case to uppercase', () => {
  const lower = region([{ startBp: 100, refSeq: 'AAA', rows: [[0, 'acg']] }])
  const upper = region([{ startBp: 100, refSeq: 'AAA', rows: [[0, 'ACG']] }])
  expect(findCellAtBp(lower, 101, 0, true)).toEqual({ base: 'C' })
  expect(findCellAtBp(upper, 101, 0, true)).toEqual({ base: 'C' })
})

test('returns undefined for gap cells (dash and space)', () => {
  const r = region([{ startBp: 100, refSeq: 'AAAAA', rows: [[0, 'a- ta']] }])
  expect(findCellAtBp(r, 101, 0, false)).toBeUndefined()
  expect(findCellAtBp(r, 102, 0, false)).toBeUndefined()
})

test('returns undefined when bp falls outside any block', () => {
  const r = region([{ startBp: 100, refSeq: 'AAA', rows: [[0, 'acg']] }])
  expect(findCellAtBp(r, 50, 0, false)).toBeUndefined()
  expect(findCellAtBp(r, 200, 0, false)).toBeUndefined()
})

test('returns undefined when no row in block matches rowIndex', () => {
  const r = region([{ startBp: 100, refSeq: 'AAA', rows: [[0, 'acg']] }])
  expect(findCellAtBp(r, 101, 5, false)).toBeUndefined()
})

test('skips reference dashes (insertions) when counting columns', () => {
  // refSeq has a dash at column 2 (an insertion relative to reference).
  // Genomic positions skip that column: bp 100→col0, 101→col1, 102→col3, 103→col4.
  const r = region([{ startBp: 100, refSeq: 'AA-AA', rows: [[0, 'agtct']] }])
  expect(findCellAtBp(r, 100, 0, false)).toEqual({ base: 'a' })
  expect(findCellAtBp(r, 101, 0, false)).toEqual({ base: 'g' })
  expect(findCellAtBp(r, 102, 0, false)).toEqual({ base: 'c' })
  expect(findCellAtBp(r, 103, 0, false)).toEqual({ base: 't' })
})

test('finds the correct block when multiple blocks are present', () => {
  const r = region([
    { startBp: 100, refSeq: 'AAA', rows: [[0, 'acg']] },
    { startBp: 200, refSeq: 'TTT', rows: [[0, 'tgc']] },
  ])
  expect(findCellAtBp(r, 101, 0, false)).toEqual({ base: 'c' })
  expect(findCellAtBp(r, 201, 0, false)).toEqual({ base: 'g' })
})

test('floors fractional bp inputs', () => {
  const r = region([{ startBp: 100, refSeq: 'AAA', rows: [[0, 'acg']] }])
  expect(findCellAtBp(r, 101.7, 0, false)).toEqual({ base: 'c' })
})
