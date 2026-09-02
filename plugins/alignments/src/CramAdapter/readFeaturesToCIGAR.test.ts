import {
  CramRecord,
  NEXT_UNKNOWN,
  TagColumn,
  arenaFromReadFeatures,
} from '@gmod/cram'
import { numericCigarToString } from '@jbrowse/cigar-utils'

import { TYPED_CIGAR_MIN_OPS, packCigar } from './packCigar.ts'

import type { ReadFeature } from '@gmod/cram'

// The CIGAR *walk* is @gmod/cram's CramRecord.forEachCigarOp, tested there
// against an independent generator and against samtools output — including the
// htslib edge cases this file used to own ('b' verbatim bases, trailing
// insertions with no trailing matches, c2#pad's insertions either side of a
// deletion, a Q between two single-base insertions, xx#minimal's zero-length
// ops). What is left here is the packing, which is this repo's memory decision.

// a one-record slice carrying just the fields the CIGAR walk reads
function makeRecord(
  readFeatures: ReadFeature[],
  alignmentStart: number,
  readLen: number,
) {
  const arena = arenaFromReadFeatures(readFeatures)
  return new CramRecord({
    flags: 0,
    cramFlags: 0,
    start: alignmentStart,
    readLength: readLen,
    sequenceId: 0,
    readGroupId: 0,
    uniqueId: 0,
    nextSequenceId: NEXT_UNKNOWN,
    nextStart: -1,
    qualityStart: -1,
    readFeatureArena: arena,
    readFeatureStart: 0,
    readFeatureCount: arena.length,
    tagColumn: new TagColumn(),
    tagStart: 0,
    tagCount: 0,
  })
}

function cigarOf(
  readFeatures: ReadFeature[],
  alignmentStart: number,
  readLen: number,
) {
  return numericCigarToString(
    packCigar(makeRecord(readFeatures, alignmentStart, readLen)),
  )
}

test('cram read features to CIGAR', () => {
  expect(
    // from ctgA_15140_15565_0:0:1_1:0:0_2e8 in volvox-sorted.cram
    cigarOf([{ code: 'i', data: 'C', pos: 24, refPos: 15163 }], 15139, 100),
  ).toMatchSnapshot()
})

test('packs each op as (length << 4) | opIndex', () => {
  const packed = packCigar(
    makeRecord([{ code: 'D', data: 2, pos: 4, refPos: 4 }], 0, 10),
  )
  // 4M 2D 6M, with M=0 and D=2 in the SAM op numbering
  expect(Array.from(packed)).toEqual([(4 << 4) | 0, (2 << 4) | 2, (6 << 4) | 0])
})

// A long read crosses TYPED_CIGAR_MIN_OPS and comes back as a Uint32Array
// instead of a plain array — same packed values either way, but half the
// retained bytes. Both branches have to agree, and every consumer takes
// ArrayLike<number>, so nothing downstream should notice.
test('a long read switches to a Uint32Array without changing the CIGAR', () => {
  // 80 deletions, each preceded by a match run: 160 ops, well over the cutoff
  const many: ReadFeature[] = []
  for (let i = 0; i < 80; i++) {
    many.push({ code: 'D', data: 2, pos: 0 + i * 5, refPos: 0 + i * 7 })
  }
  // few enough features to stay under the cutoff, so both branches get exercised
  const short = packCigar(makeRecord(many.slice(0, 3), 0, 500))
  const long = packCigar(makeRecord(many, 0, 500))

  expect(short.length).toBeLessThan(TYPED_CIGAR_MIN_OPS)
  expect(Array.isArray(short)).toBe(true)
  expect(long.length).toBeGreaterThanOrEqual(TYPED_CIGAR_MIN_OPS)
  expect(long).toBeInstanceOf(Uint32Array)

  // the first deletion sits at the alignment start, so it leads; each later one
  // is 7bp on from the last, 2 of which the previous deletion consumed, leaving
  // a 5bp match run. 79 of those leave 105 read bases for a trailing match.
  const expected = `2D${'5M2D'.repeat(79)}105M`
  expect(numericCigarToString(long)).toBe(expected)
  expect(Array.from(long)).toHaveLength(160)
})
