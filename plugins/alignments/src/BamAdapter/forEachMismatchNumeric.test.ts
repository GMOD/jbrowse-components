import { forEachMismatchNumeric } from './forEachMismatchNumeric.ts'
import {
  DELETION_TYPE,
  HARDCLIP_TYPE,
  INSERTION_TYPE,
  MISMATCH_TYPE,
  SKIP_TYPE,
  SOFTCLIP_TYPE,
} from '../shared/forEachMismatchTypes.ts'

import type { MismatchCallback } from '../shared/forEachMismatchTypes.ts'

// Helper to encode a sequence string into BAM's packed 4-bit format
function encodeSeq(seq: string): Uint8Array {
  const SEQ_ENCODE: Record<string, number> = {
    '=': 0,
    A: 1,
    C: 2,
    M: 3,
    G: 4,
    R: 5,
    S: 6,
    V: 7,
    T: 8,
    W: 9,
    Y: 10,
    H: 11,
    K: 12,
    D: 13,
    B: 14,
    N: 15,
  }
  const result = new Uint8Array(Math.ceil(seq.length / 2))
  for (let i = 0; i < seq.length; i += 2) {
    const high = SEQ_ENCODE[seq[i]!.toUpperCase()] ?? 15
    const low =
      i + 1 < seq.length ? (SEQ_ENCODE[seq[i + 1]!.toUpperCase()] ?? 15) : 0
    result[i >> 1] = (high << 4) | low
  }
  return result
}

// Helper to encode CIGAR string to packed Uint32Array format
function encodeCigar(cigar: string): Uint32Array {
  const ops: number[] = []
  const CIGAR_OPS: Record<string, number> = {
    M: 0,
    I: 1,
    D: 2,
    N: 3,
    S: 4,
    H: 5,
    P: 6,
    '=': 7,
    X: 8,
  }
  const regex = /(\d+)([MIDNSHP=X])/g
  let match
  while ((match = regex.exec(cigar)) !== null) {
    const len = parseInt(match[1]!, 10)
    const op = CIGAR_OPS[match[2]!]!
    ops.push((len << 4) | op)
  }
  return new Uint32Array(ops)
}

// Helper to encode MD string to bytes
function encodeMD(md: string): Uint8Array {
  // eslint-disable-next-line @typescript-eslint/no-misused-spread
  return new Uint8Array([...md].map(c => c.charCodeAt(0)))
}

// Helper to collect forEachMismatchNumeric results
function collectMismatches(opts: {
  cigar: string
  seq: string
  md?: string
  ref?: string
  qual?: number[]
}) {
  const results: {
    type: number
    start: number
    length: number
    base: string
    qual: number | undefined
    altbase: number | undefined
    cliplen: number | undefined
  }[] = []

  const callback: MismatchCallback = (
    type,
    start,
    length,
    base,
    qual,
    altbase,
    cliplen,
  ) => {
    results.push({ type, start, length, base, qual, altbase, cliplen })
  }

  forEachMismatchNumeric(
    encodeCigar(opts.cigar),
    encodeSeq(opts.seq),
    opts.seq.length,
    opts.md ? encodeMD(opts.md) : undefined,
    opts.qual ? new Uint8Array(opts.qual) : undefined,
    opts.ref,
    callback,
  )

  return results
}

describe('forEachMismatchNumeric', () => {
  describe('with MD tag', () => {
    test('finds mismatches from MD tag', () => {
      const mismatches = collectMismatches({
        cigar: '10M',
        seq: 'AAAAAAAAAA',
        md: '5T4', // mismatch at position 5, ref has T, read has A
      })

      expect(mismatches).toHaveLength(1)
      expect(mismatches[0]).toMatchObject({
        type: MISMATCH_TYPE,
        start: 5,
        length: 1,
        base: 'A',
        altbase: 'T'.charCodeAt(0),
      })
    })

    test('finds multiple mismatches from MD tag', () => {
      const mismatches = collectMismatches({
        cigar: '10M',
        seq: 'ACGTACGTAC',
        md: '2A2T4', // mismatches at positions 2 and 5
      })

      expect(mismatches).toHaveLength(2)
      expect(mismatches[0]).toMatchObject({
        type: MISMATCH_TYPE,
        start: 2,
        base: 'G',
        altbase: 'A'.charCodeAt(0),
      })
      expect(mismatches[1]).toMatchObject({
        type: MISMATCH_TYPE,
        start: 5,
        base: 'C',
        altbase: 'T'.charCodeAt(0),
      })
    })
  })

  describe('without MD tag (using reference)', () => {
    test('finds mismatches by comparing to reference sequence', () => {
      const mismatches = collectMismatches({
        cigar: '10M',
        seq: 'AAAAAAAAAA', // read sequence: all A's
        ref: 'AAAAATAAAA', // reference: T at position 5
      })

      expect(mismatches).toHaveLength(1)
      expect(mismatches[0]).toMatchObject({
        type: MISMATCH_TYPE,
        start: 5,
        length: 1,
        base: 'A',
        altbase: 'T'.charCodeAt(0),
      })
    })

    test('finds multiple mismatches by comparing to reference', () => {
      const mismatches = collectMismatches({
        cigar: '10M',
        seq: 'AAAAAAAAAA',
        ref: 'AATAAAAATA', // T at positions 2 and 8
      })

      expect(mismatches).toHaveLength(2)
      expect(mismatches[0]).toMatchObject({
        type: MISMATCH_TYPE,
        start: 2,
        base: 'A',
        altbase: 'T'.charCodeAt(0),
      })
      expect(mismatches[1]).toMatchObject({
        type: MISMATCH_TYPE,
        start: 8,
        base: 'A',
        altbase: 'T'.charCodeAt(0),
      })
    })

    test('handles case-insensitive reference comparison', () => {
      const mismatches = collectMismatches({
        cigar: '10M',
        seq: 'ACGTACGTAC',
        ref: 'acgtacgtac', // lowercase reference, should match
      })

      expect(mismatches).toHaveLength(0)
    })

    test('finds no mismatches when sequences match', () => {
      const mismatches = collectMismatches({
        cigar: '10M',
        seq: 'ACGTACGTAC',
        ref: 'ACGTACGTAC',
      })

      expect(mismatches).toHaveLength(0)
    })

    test('handles all bases mismatching', () => {
      const mismatches = collectMismatches({
        cigar: '4M',
        seq: 'ACGT',
        ref: 'TGCA', // all different
      })

      expect(mismatches).toHaveLength(4)
    })
  })

  describe('without MD tag or reference', () => {
    test('returns no mismatches for M operations', () => {
      const mismatches = collectMismatches({
        cigar: '10M',
        seq: 'AAAAAAAAAA',
      })

      expect(mismatches).toHaveLength(0)
    })
  })

  describe('insertions and deletions', () => {
    test('reports insertions regardless of MD/ref', () => {
      const mismatches = collectMismatches({
        cigar: '5M2I5M',
        seq: 'AAAAATTAAAAA',
      })

      expect(mismatches).toHaveLength(1)
      expect(mismatches[0]).toMatchObject({
        type: INSERTION_TYPE,
        start: 5,
        length: 0,
        base: 'TT',
      })
    })

    test('reports deletions regardless of MD/ref', () => {
      const mismatches = collectMismatches({
        cigar: '5M2D5M',
        seq: 'AAAAAAAAAA',
      })

      expect(mismatches).toHaveLength(1)
      expect(mismatches[0]).toMatchObject({
        type: DELETION_TYPE,
        start: 5,
        length: 2,
        base: '*',
      })
    })

    test('reports soft clips', () => {
      const mismatches = collectMismatches({
        cigar: '3S7M',
        seq: 'TTTAAAAAAA',
      })

      expect(mismatches).toHaveLength(1)
      expect(mismatches[0]).toMatchObject({
        type: SOFTCLIP_TYPE,
        start: 0,
        base: 'S3',
      })
    })

    test('reports hard clips', () => {
      const mismatches = collectMismatches({
        cigar: '5H10M5H',
        seq: 'AAAAAAAAAA',
      })

      expect(mismatches).toHaveLength(2)
      expect(mismatches[0]).toMatchObject({
        type: HARDCLIP_TYPE,
        base: 'H5',
      })
      expect(mismatches[1]).toMatchObject({
        type: HARDCLIP_TYPE,
        base: 'H5',
      })
    })

    test('reports skips (introns)', () => {
      const mismatches = collectMismatches({
        cigar: '5M100N5M',
        seq: 'AAAAAAAAAA',
      })

      expect(mismatches).toHaveLength(1)
      expect(mismatches[0]).toMatchObject({
        type: SKIP_TYPE,
        start: 5,
        length: 100,
        base: 'N',
      })
    })
  })

  describe('complex cases', () => {
    test('combines insertions with ref-based mismatches', () => {
      const mismatches = collectMismatches({
        cigar: '5M2I5M',
        seq: 'AAAAATTAAAAA', // 12 bases total
        ref: 'AATAAAAATAA', // mismatch at position 2 and 8 in ref coords
      })

      const mismatchEvents = mismatches.filter(m => m.type === MISMATCH_TYPE)
      const insertionEvents = mismatches.filter(m => m.type === INSERTION_TYPE)

      expect(insertionEvents).toHaveLength(1)
      expect(mismatchEvents).toHaveLength(2)
    })

    test('handles CIGAR with = (sequence match) operation and ref comparison', () => {
      const mismatches = collectMismatches({
        cigar: '10=', // explicit sequence match
        seq: 'AAAAAAAAAA',
        ref: 'AATAAAAATA', // mismatches at 2 and 8
      })

      expect(mismatches).toHaveLength(2)
    })

    test('handles CIGAR with X (sequence mismatch) operation', () => {
      const mismatches = collectMismatches({
        cigar: '5M1X4M', // explicit mismatch at position 5
        seq: 'AAAAATAAAA',
      })

      expect(mismatches).toHaveLength(1)
      expect(mismatches[0]).toMatchObject({
        type: MISMATCH_TYPE,
        start: 5,
        base: 'T',
      })
    })
  })
})
