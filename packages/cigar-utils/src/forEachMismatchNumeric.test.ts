import { encodeSeqNumeric as encodeSeq } from './bamSeqEncoder.ts'
import { forEachMismatchNumeric } from './forEachMismatchNumeric.ts'
import {
  DELETION_TYPE,
  HARDCLIP_TYPE,
  INSERTION_TYPE,
  MISMATCH_TYPE,
  SKIP_TYPE,
  SOFTCLIP_TYPE,
} from './mismatchCallback.ts'
import { packReference } from './packedReference.ts'

import type { MismatchCallback } from './mismatchCallback.ts'

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
    opts.ref === undefined ? undefined : packReference(opts.ref),
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

  // SEQ='*' (secondary alignments) and CIGAR-string-only features take the
  // no-sequence fast path, which reports the ops that need no bases. An --eqx
  // CIGAR's X ops consume the reference there just as M/= do: not advancing
  // past them put every later op that many bases too far left.
  describe('no sequence (fast path)', () => {
    test('X ops advance the reference offset', () => {
      const results: { type: number; start: number; length: number }[] = []
      forEachMismatchNumeric(
        encodeCigar('5=3X5=4D5='),
        new Uint8Array(0),
        0,
        undefined,
        undefined,
        undefined,
        (type, start, length) => {
          results.push({ type, start, length })
        },
      )
      expect(results).toEqual([{ type: DELETION_TYPE, start: 13, length: 4 }])
    })

    test('reports indels and clips with no sequence', () => {
      const results: { type: number; start: number }[] = []
      forEachMismatchNumeric(
        encodeCigar('2S5=2I5=3N5='),
        new Uint8Array(0),
        0,
        undefined,
        undefined,
        undefined,
        (type, start) => {
          results.push({ type, start })
        },
      )
      expect(results).toEqual([
        { type: SOFTCLIP_TYPE, start: 0 },
        { type: INSERTION_TYPE, start: 5 },
        { type: SKIP_TYPE, start: 10 },
      ])
    })
  })

  describe('insertions and deletions', () => {
    test('reports 2-base insertion (len=2 branch, odd soffset)', () => {
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

    test('reports 1-base insertion at even soffset (len=1 branch)', () => {
      // soffset=2 after 2M — even, so base is in high nibble
      const mismatches = collectMismatches({
        cigar: '2M1I5M',
        seq: 'AAGAAAAA',
      })

      expect(mismatches).toHaveLength(1)
      expect(mismatches[0]).toMatchObject({
        type: INSERTION_TYPE,
        start: 2,
        length: 0,
        base: 'G',
      })
    })

    test('reports 1-base insertion at odd soffset (len=1 branch)', () => {
      // soffset=1 after 1M — odd, so base is in low nibble
      const mismatches = collectMismatches({
        cigar: '1M1I5M',
        seq: 'ATAAAAA',
      })

      expect(mismatches).toHaveLength(1)
      expect(mismatches[0]).toMatchObject({
        type: INSERTION_TYPE,
        start: 1,
        length: 0,
        base: 'T',
      })
    })

    test('reports 3-base insertion (general loop path)', () => {
      // len=3 exercises the new Array(len)+join path
      const mismatches = collectMismatches({
        cigar: '3M3I4M',
        seq: 'AAATCGAAAA',
      })

      expect(mismatches).toHaveLength(1)
      expect(mismatches[0]).toMatchObject({
        type: INSERTION_TYPE,
        start: 3,
        length: 0,
        base: 'TCG',
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
      // the clip's length rides in cliplen; `base` is empty because a clip has
      // no bases to report
      expect(mismatches[0]).toMatchObject({
        type: SOFTCLIP_TYPE,
        start: 0,
        cliplen: 3,
        base: '',
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
        cliplen: 5,
        base: '',
      })
      expect(mismatches[1]).toMatchObject({
        type: HARDCLIP_TYPE,
        cliplen: 5,
        base: '',
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

  describe('viewport windowing', () => {
    // A read with mismatches, an insertion, a deletion and a skip spread across
    // reference offsets. Windowing must emit exactly the events whose reference
    // position falls in [windowLo, windowHi) — identical to walking the whole
    // read and filtering afterwards.
    const cigar = '5M2I5M3D5M4N5M'
    // ref (lowercase) vs seq: introduce point mismatches at roffset 2 and 22
    const seq = 'AAGAACCAAAAAAAAAAAGAAA'
    const ref = 'aaaaaaaaaaaaaaaaaaaaaaaaaaa'

    function walk(windowLo?: number, windowHi?: number) {
      const out: { type: number; start: number; length: number }[] = []
      forEachMismatchNumeric(
        encodeCigar(cigar),
        encodeSeq(seq),
        seq.length,
        undefined,
        undefined,
        packReference(ref),
        (type, start, length) => {
          out.push({ type, start, length })
        },
        0,
        windowLo,
        windowHi,
      )
      return out
    }

    test('default (no window) walks whole read', () => {
      const all = walk()
      // mismatch@2, insertion@5, deletion@10(len3), skip@18(len4), mismatch@21
      expect(all.map(m => m.type)).toEqual([
        MISMATCH_TYPE,
        INSERTION_TYPE,
        DELETION_TYPE,
        SKIP_TYPE,
        MISMATCH_TYPE,
      ])
    })

    test('windowed output equals full walk filtered to the window', () => {
      const all = walk()
      for (const [lo, hi] of [
        [0, 5],
        [3, 12],
        [10, 20],
        [21, 30],
        [6, 6],
      ] as const) {
        const windowed = walk(lo, hi)
        // ranged ops (D/N) overlap the window; point ops fall inside it
        const expected = all.filter(m =>
          m.length > 1
            ? m.start < hi && m.start + m.length > lo
            : m.start >= lo && m.start < hi,
        )
        expect(windowed).toEqual(expected)
      }
    })

    test('window fully left/right of all events emits nothing', () => {
      expect(walk(-100, -50)).toEqual([])
      expect(walk(1000, 2000)).toEqual([])
    })
  })

  // The reference comparison packs both the read's SEQ and the reference two
  // bases to a byte and compares a byte at a time, so it has to line the two up
  // itself: a read whose sequence offset and reference offset disagree in
  // parity, an M op of odd length, or a window starting mid-byte all leave
  // single bases at the ends of the paired run. This walks randomized
  // CIGAR/seq/ref/refOffset combinations against a naive per-base oracle, which
  // is where those alignment cases actually live.
  describe('reference comparison vs naive per-base oracle', () => {
    const BASES = 'ACGT'

    // deterministic LCG so a failure is reproducible from its seed
    function makeRandom(seed: number) {
      let state = seed
      return (n: number) => {
        state = (state * 1103515245 + 12345) & 0x7fffffff
        return state % n
      }
    }

    function naiveMismatches(
      cigar: { len: number; op: string }[],
      seq: string,
      ref: string,
      refOffset: number,
    ) {
      const out: { start: number; base: string; altbase: number }[] = []
      let roffset = 0
      let soffset = 0
      for (const { len, op } of cigar) {
        if (op === 'M') {
          for (let j = 0; j < len; j++) {
            const readBase = seq[soffset + j]!
            const refBase = ref[refOffset + roffset + j]!
            if (readBase.toLowerCase() !== refBase.toLowerCase()) {
              out.push({
                start: roffset + j,
                base: readBase,
                altbase: refBase.toUpperCase().charCodeAt(0),
              })
            }
          }
          soffset += len
          roffset += len
        } else if (op === 'I') {
          soffset += len
        } else if (op === 'S') {
          soffset += len
        } else if (op === 'D') {
          roffset += len
        }
      }
      return out
    }

    test.each([1, 2, 3, 4, 5, 6, 7, 8])('seed %i', seed => {
      const random = makeRandom(seed)
      for (let trial = 0; trial < 40; trial++) {
        // a CIGAR mixing odd/even run lengths and both offset-shifting ops
        const ops: { len: number; op: string }[] = []
        const opChoices = ['M', 'M', 'M', 'I', 'D', 'S']
        for (let i = 0; i < 1 + random(5); i++) {
          ops.push({
            len: 1 + random(9),
            op: i === 0 ? 'M' : opChoices[random(opChoices.length)]!,
          })
        }
        const seqLen = ops
          .filter(o => o.op === 'M' || o.op === 'I' || o.op === 'S')
          .reduce((a, b) => a + b.len, 0)
        const refLen = ops
          .filter(o => o.op === 'M' || o.op === 'D')
          .reduce((a, b) => a + b.len, 0)
        const refOffset = random(4)
        let seq = ''
        for (let i = 0; i < seqLen; i++) {
          seq += BASES[random(4)]!
        }
        let ref = ''
        for (let i = 0; i < refOffset + refLen; i++) {
          // mixed case, since the comparison is case-insensitive
          const c = BASES[random(4)]!
          ref += random(2) ? c : c.toLowerCase()
        }

        const cigarString = ops.map(o => `${o.len}${o.op}`).join('')
        const actual: { start: number; base: string; altbase: number }[] = []
        forEachMismatchNumeric(
          encodeCigar(cigarString),
          encodeSeq(seq),
          seq.length,
          undefined,
          undefined,
          packReference(ref),
          (type, start, _length, base, _qual, altbase) => {
            if (type === MISMATCH_TYPE) {
              actual.push({ start, base, altbase: altbase! })
            }
          },
          refOffset,
        )

        expect({ cigarString, seq, ref, refOffset, actual }).toEqual({
          cigarString,
          seq,
          ref,
          refOffset,
          actual: naiveMismatches(ops, seq, ref, refOffset),
        })
      }
    })
  })
})
