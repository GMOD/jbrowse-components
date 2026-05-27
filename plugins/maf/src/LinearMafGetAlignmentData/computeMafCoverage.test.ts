import { computeMafCoverage } from './computeMafCoverage.ts'

import type { MafBlock } from '../LinearMafRenderer/mafBackendTypes.ts'

const enc = new TextEncoder()

function row(rowIndex: number, alignment: string) {
  return { rowIndex, alignmentBytes: enc.encode(alignment) }
}

function block(startBp: number, refSeq: string, rows: { rowIndex: number; alignmentBytes: Uint8Array }[]): MafBlock {
  return { startBp, refSeqBytes: enc.encode(refSeq), rows }
}

test('counts per-position depth across sample rows', () => {
  const blocks: MafBlock[] = [
    block(10, 'ACGT', [
      row(0, 'ACGT'),
      row(1, 'A-GT'),
      row(2, 'A-G-'),
    ]),
  ]
  const r = computeMafCoverage(blocks, 10, 14)
  expect(Array.from(r.depths)).toEqual([3, 1, 3, 2])
  expect(r.maxDepth).toBe(3)
  expect(r.startPos).toBe(10)
  expect(r.mismatches).toEqual([])
})

test('emits mismatches for sample bases that differ from reference', () => {
  const blocks: MafBlock[] = [
    block(100, 'ACGT', [
      row(0, 'ATGT'),
      row(1, 'AAGC'),
    ]),
  ]
  const r = computeMafCoverage(blocks, 100, 104)
  expect(r.mismatches).toContainEqual({ position: 101, base: 84, strand: 1 })
  expect(r.mismatches).toContainEqual({ position: 101, base: 65, strand: 1 })
  expect(r.mismatches).toContainEqual({ position: 103, base: 67, strand: 1 })
  expect(r.mismatches).toHaveLength(3)
})

test('skips reference-insertion columns and never increments refPos for them', () => {
  // Ref insertion at col 2 (ref char is '-'), so the column maps to no ref bp.
  const blocks: MafBlock[] = [
    block(50, 'AC-GT', [
      row(0, 'ACTGT'),
      row(1, 'AC-GT'),
    ]),
  ]
  const r = computeMafCoverage(blocks, 50, 54)
  // Per-ref-bp depths cover positions 50..53 (A C G T)
  expect(Array.from(r.depths)).toEqual([2, 2, 2, 2])
  expect(r.mismatches).toEqual([])
})

test('case-insensitive base comparison; N never counts as a mismatch', () => {
  const blocks: MafBlock[] = [
    block(0, 'aCgT', [
      row(0, 'ACGT'),
      row(1, 'NCNT'),
      row(2, 'ACNN'),
    ]),
  ]
  const r = computeMafCoverage(blocks, 0, 4)
  expect(r.mismatches).toEqual([])
})

test('clamps to region bounds — bases outside [regionStart, regionEnd) are ignored', () => {
  const blocks: MafBlock[] = [
    block(100, 'ACGTAC', [row(0, 'ACGTAC')]),
  ]
  const r = computeMafCoverage(blocks, 102, 105)
  expect(Array.from(r.depths)).toEqual([1, 1, 1])
  expect(r.startPos).toBe(102)
})
