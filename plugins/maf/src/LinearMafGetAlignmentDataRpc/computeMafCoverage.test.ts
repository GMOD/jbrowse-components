import { computeMafCoverage } from './computeMafCoverage.ts'

import type { MafBlock } from '../LinearMafRenderer/mafRenderingBackendTypes.ts'

const enc = new TextEncoder()

function row(rowIndex: number, alignment: string) {
  return { rowIndex, alignmentBytes: enc.encode(alignment) }
}

function block(
  startBp: number,
  refSeq: string,
  rows: { rowIndex: number; alignmentBytes: Uint8Array }[],
): MafBlock {
  return {
    startBp,
    endBp: startBp + refSeq.replace(/-/g, '').length,
    refSeqBytes: enc.encode(refSeq),
    rows,
    empties: [],
  }
}

test('counts per-position depth across sample rows', () => {
  const blocks: MafBlock[] = [
    block(10, 'ACGT', [row(0, 'ACGT'), row(1, 'A-GT'), row(2, 'A-G-')]),
  ]
  const r = computeMafCoverage(blocks, 10, 14)
  expect(Array.from(r.depths)).toEqual([3, 1, 3, 2])
  expect(r.maxDepth).toBe(3)
  expect(r.startPos).toBe(10)
  expect(r.mismatches).toEqual([])
})

test('emits mismatches for sample bases that differ from reference', () => {
  const blocks: MafBlock[] = [
    block(100, 'ACGT', [row(0, 'ATGT'), row(1, 'AAGC')]),
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
    block(50, 'AC-GT', [row(0, 'ACTGT'), row(1, 'AC-GT')]),
  ]
  const r = computeMafCoverage(blocks, 50, 54)
  // Per-ref-bp depths cover positions 50..53 (A C G T)
  expect(Array.from(r.depths)).toEqual([2, 2, 2, 2])
  expect(r.mismatches).toEqual([])
})

test('case-insensitive base comparison: matching bases emit no mismatch', () => {
  const blocks: MafBlock[] = [
    block(0, 'aCgT', [row(0, 'ACGT'), row(1, 'acgt')]),
  ]
  const r = computeMafCoverage(blocks, 0, 4)
  expect(r.mismatches).toEqual([])
})

test('sample N is a mismatch (base 78) against a known reference', () => {
  const blocks: MafBlock[] = [
    block(0, 'ACGT', [row(0, 'ACGT'), row(1, 'NCNT'), row(2, 'ACNN')]),
  ]
  const r = computeMafCoverage(blocks, 0, 4)
  // row1: N at pos 0 and 2; row2: N at pos 2 and 3. All vs known ref bases.
  expect(r.mismatches).toContainEqual({ position: 0, base: 78, strand: 1 })
  expect(r.mismatches).toContainEqual({ position: 2, base: 78, strand: 1 })
  expect(r.mismatches).toContainEqual({ position: 3, base: 78, strand: 1 })
  expect(r.mismatches).toHaveLength(4)
})

test('reference N column emits no mismatch even when samples differ', () => {
  const blocks: MafBlock[] = [
    block(0, 'NCGT', [row(0, 'ACGT'), row(1, 'GCGT')]),
  ]
  const r = computeMafCoverage(blocks, 0, 4)
  // pos 0 ref is N: A and G samples there are unclassifiable, not mismatches.
  expect(r.mismatches).toEqual([])
})

test('multi-column insertion emits one entry per row with the correct length', () => {
  // Ref has a 3-column insertion at refPos=51. Row0 has bases in all 3
  // insertion columns; row1 has a gap in the middle column so its insertion
  // length is 2; row2 has gaps throughout so it emits nothing.
  const blocks: MafBlock[] = [
    block(50, 'A---T', [row(0, 'AGCTT'), row(1, 'AG-TT'), row(2, 'A---T')]),
  ]
  const r = computeMafCoverage(blocks, 50, 52)
  expect(r.insertions).toEqual([
    { position: 51, length: 3 },
    { position: 51, length: 2 },
  ])
})

test('clamps to region bounds — bases outside [regionStart, regionEnd) are ignored', () => {
  const blocks: MafBlock[] = [block(100, 'ACGTAC', [row(0, 'ACGTAC')])]
  const r = computeMafCoverage(blocks, 102, 105)
  expect(Array.from(r.depths)).toEqual([1, 1, 1])
  expect(r.startPos).toBe(102)
})

// row 0 is the reference (its sequence equals refSeq); refRowIndex=0 excludes
// its trivial self-match from identity.
test('identity excludes the reference row from numerator and denominator', () => {
  const blocks: MafBlock[] = [
    block(0, 'ACGT', [row(0, 'ACGT'), row(1, 'ACGT'), row(2, 'ATGT')]),
  ]
  const r = computeMafCoverage(blocks, 0, 4, 0)
  // pos1: of the two non-ref rows, one matches (C) and one differs (T) → 0.5,
  // not 2/3 — the reference's self-match is excluded.
  expect(Array.from(r.identity)).toEqual([1, 0.5, 1, 1])
})

test('without a reference row index, identity counts every row', () => {
  const blocks: MafBlock[] = [
    block(0, 'AC', [row(0, 'AC'), row(1, 'AC'), row(2, 'AT')]),
  ]
  const r = computeMafCoverage(blocks, 0, 2)
  // pos1: 2 of 3 rows match C (the inflated value the ref-exclusion fixes).
  expect(r.identity[0]).toBe(1)
  expect(r.identity[1]).toBeCloseTo(2 / 3, 5)
})

test('sample gaps are excluded from the identity denominator (NaN when none left)', () => {
  const blocks: MafBlock[] = [block(0, 'AC', [row(0, 'AC'), row(1, 'A-')])]
  const r = computeMafCoverage(blocks, 0, 2, 0)
  // pos1: only non-ref row is a gap → no classifiable base → NaN.
  expect(r.identity[0]).toBe(1)
  expect(r.identity[1]).toBeNaN()
})

test('reference N columns are unclassifiable (identity NaN)', () => {
  const blocks: MafBlock[] = [block(0, 'NC', [row(0, 'NC'), row(1, 'AC')])]
  const r = computeMafCoverage(blocks, 0, 2, 0)
  expect(r.identity[0]).toBeNaN()
  expect(r.identity[1]).toBe(1)
})

test('sample N counts against identity (it is a mismatch to a known ref)', () => {
  const blocks: MafBlock[] = [block(0, 'AC', [row(0, 'AC'), row(1, 'NC')])]
  const r = computeMafCoverage(blocks, 0, 2, 0)
  // pos0: the lone non-ref base is N → 0 matches of 1 classifiable.
  expect(r.identity[0]).toBe(0)
  expect(r.identity[1]).toBe(1)
})

test('positions with no non-reference aligned base are NaN', () => {
  const blocks: MafBlock[] = [block(0, 'ACGT', [row(0, 'ACGT'), row(1, 'AC--')])]
  const r = computeMafCoverage(blocks, 0, 4, 0)
  // single non-ref row covers pos0-1 only; pos2-3 have no classifiable base.
  expect(r.identity[0]).toBe(1)
  expect(r.identity[1]).toBe(1)
  expect(r.identity[2]).toBeNaN()
  expect(r.identity[3]).toBeNaN()
})

test('a block of only the reference row yields all-NaN identity', () => {
  const blocks: MafBlock[] = [block(0, 'AC', [row(0, 'AC')])]
  const r = computeMafCoverage(blocks, 0, 2, 0)
  expect(r.identity[0]).toBeNaN()
  expect(r.identity[1]).toBeNaN()
})
