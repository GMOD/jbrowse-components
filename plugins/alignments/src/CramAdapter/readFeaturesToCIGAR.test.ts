import { arenaFromReadFeatures } from '@gmod/cram'
import { numericCigarToString } from '@jbrowse/cigar-utils'

import { readFeaturesToNumericCIGAR } from './readFeaturesToNumericCIGAR.ts'

import type { ReadFeature } from '@gmod/cram'

// pack plain fixture features into a one-record arena, the shape the walk reads
function numericOf(
  readFeatures: ReadFeature[],
  alignmentStart: number,
  readLen: number,
) {
  const arena = arenaFromReadFeatures(readFeatures)
  return readFeaturesToNumericCIGAR(
    arena,
    0,
    arena.length,
    alignmentStart,
    readLen,
  )
}

function cigarOf(
  readFeatures: ReadFeature[],
  alignmentStart: number,
  readLen: number,
) {
  return numericCigarToString(numericOf(readFeatures, alignmentStart, readLen))
}

test('cram read features to CIGAR', () => {
  expect(
    // from ctgA_15140_15565_0:0:1_1:0:0_2e8 in volvox-sorted.cram
    cigarOf([{ code: 'i', data: 'C', pos: 25, refPos: 15164 }], 15140, 100),
  ).toMatchSnapshot()
})

test("'b' verbatim bases align as matches (one M column per base)", () => {
  // Documents 'b' semantics: data is a decoded base string ("ACGT" = 4 match
  // columns), then a 2bp deletion, then 6 trailing matches to fill readLength.
  expect(
    cigarOf(
      [
        { code: 'b', data: 'ACGT', pos: 1, refPos: 1 },
        { code: 'D', data: 2, pos: 5, refPos: 5 },
      ],
      1,
      10,
    ),
  ).toBe('4M2D6M')
})

test('trailing single-base insertions are not dropped when remaining=0', () => {
  // 3M then two 'i' insertions consuming all readLen=5 bases → remaining=0
  // bug: original `if (remaining && insLen)` silently dropped the insertions
  expect(
    cigarOf(
      [
        { code: 'i', data: 'A', pos: 3, refPos: 3 },
        { code: 'i', data: 'C', pos: 4, refPos: 3 },
      ],
      0,
      5,
    ),
  ).toBe('3M2I')
})

// The features of htslib's c2#pad s4, whose CIGAR samtools gives as 4M1I1D1I4M.
// bug: flushing the pending 'i' only on a match region merged the two
// insertions across the deletion and emitted them after it, as 4M1D2I4M
test('single-base insertions either side of a deletion stay separate', () => {
  expect(
    cigarOf(
      [
        { code: 'i', data: 'A', pos: 5, refPos: 5 },
        { code: 'D', data: 1, pos: 6, refPos: 5 },
        { code: 'i', data: 'C', pos: 6, refPos: 6 },
      ],
      1,
      10,
    ),
  ).toBe('4M1I1D1I4M')
})

// q/Q report where a quality score sits in the *read*, so a Q following an
// insertion carries a refPos behind it — see RF_POSITIONAL in @gmod/cram.
// bug: letting Q through flushed the pending insertion and gave 2M1I1I2M
test('a Q between two single-base insertions does not split them', () => {
  expect(
    cigarOf(
      [
        { code: 'i', data: 'A', pos: 3, refPos: 3 },
        { code: 'Q', data: 36, pos: 3, refPos: 2 },
        { code: 'i', data: 'C', pos: 4, refPos: 3 },
      ],
      1,
      5,
    ),
  ).toBe('2M2I1M')
})

// htslib's xx#minimal a1 (two hard clips, samtools gives 10H) and a2 (hard
// clips around a zero-length insertion and deletion, samtools gives 5H10M5H)
test('zero-length ops are dropped and same-op runs merge', () => {
  expect(
    cigarOf(
      [
        { code: 'H', data: 5, pos: 1, refPos: 4 },
        { code: 'H', data: 5, pos: 1, refPos: 4 },
      ],
      4,
      0,
    ),
  ).toBe('10H')
  expect(
    cigarOf(
      [
        { code: 'H', data: 5, pos: 1, refPos: 4 },
        { code: 'I', data: '', pos: 1, refPos: 4 },
        { code: 'D', data: 0, pos: 11, refPos: 14 },
        { code: 'H', data: 5, pos: 11, refPos: 14 },
      ],
      4,
      10,
    ),
  ).toBe('5H10M5H')
})

// A long read crosses TYPED_CIGAR_MIN_OPS and comes back as a Uint32Array
// instead of a plain array — same packed values either way, but half the
// retained bytes. Both branches have to agree, and every consumer takes
// ArrayLike<number>, so nothing downstream should notice.
test('a long read switches to a Uint32Array without changing the CIGAR', () => {
  // 80 deletions, each preceded by a match run: 160 ops, well over the cutoff
  const many: ReadFeature[] = []
  for (let i = 0; i < 80; i++) {
    many.push({ code: 'D', data: 2, pos: 1 + i * 5, refPos: 1 + i * 7 })
  }
  // few enough features to stay under the cutoff, so both branches get exercised
  const short = numericOf(many.slice(0, 3), 1, 500)
  const long = numericOf(many, 1, 500)

  expect(Array.isArray(short)).toBe(true)
  expect(long).toBeInstanceOf(Uint32Array)

  // the first deletion sits at the alignment start, so it leads; each later one
  // is 7bp on from the last, 2 of which the previous deletion consumed, leaving
  // a 5bp match run. 79 of those leave 105 read bases for a trailing match.
  const expected = `2D${'5M2D'.repeat(79)}105M`
  expect(numericCigarToString(long)).toBe(expected)
  expect(Array.from(long)).toHaveLength(160)
})
