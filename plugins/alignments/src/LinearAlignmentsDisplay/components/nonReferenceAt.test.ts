import { baseWorkerPileupData } from '../../RenderAlignmentDataRPC/testPileupData.ts'
import { GAP_DELETION } from '../../shaders/slang/gap.consts.generated.ts'
import { INTERBASE_INSERTION } from '../../shared/types.ts'
import { nonReferenceAt } from './tooltipUtils.ts'

import type { WorkerPileupData } from '../../RenderAlignmentDataRPC/types.ts'

// coverage over [90, 110): ten reads deep, and eight at 101-103 where two
// reads carry a deletion and so leave the depth
function pileup(overrides: Partial<WorkerPileupData> = {}): WorkerPileupData {
  const coverageDepths = new Float32Array(20).fill(10)
  coverageDepths.fill(8, 11, 14)
  return {
    ...baseWorkerPileupData(10),
    coverageStartPos: 90,
    coverageDepths,
    gapPositions: Uint32Array.from([101, 104, 101, 104]),
    gapTypes: new Uint8Array(2).fill(GAP_DELETION),
    gapReadIndices: Uint32Array.from([0, 1]),
    gapFrequencies: new Uint8Array(2),
    ...overrides,
  }
}

test('counts the mismatches at a base over its depth', () => {
  const data = pileup({
    mismatchPositions: Uint32Array.from([95, 95, 95, 96]),
    mismatchBases: Uint8Array.from([67, 67, 84, 71]),
  })
  expect(nonReferenceAt({ type: 'basePair', pos: 95 }, data)).toEqual({
    count: 3,
    depth: 10,
  })
  expect(nonReferenceAt({ type: 'basePair', pos: 97 }, data)).toEqual({
    count: 0,
    depth: 10,
  })
})

test('counts a deleted read as differing and as spanning', () => {
  expect(nonReferenceAt({ type: 'basePair', pos: 101 }, pileup())).toEqual({
    count: 2,
    depth: 10,
  })
})

test('counts the insertions ahead of a base', () => {
  const data = pileup({
    interbasePositions: Uint32Array.from([95, 95]),
    interbaseLengths: Uint32Array.from([3, 3]),
    interbaseTypes: new Uint8Array(2).fill(INTERBASE_INSERTION),
    interbaseReadIndices: Uint32Array.from([0, 1]),
    interbaseFrequencies: new Uint8Array(2),
    numInsertions: 2,
  })
  expect(nonReferenceAt({ type: 'insertion', pos: 95 }, data)).toEqual({
    count: 2,
    depth: 10,
  })
  expect(nonReferenceAt({ type: 'insertion', pos: 96 }, data)).toEqual({
    count: 0,
    depth: 10,
  })
})

test('answers nothing for a column the data does not reach', () => {
  expect(
    nonReferenceAt({ type: 'basePair', pos: 110 }, pileup()),
  ).toBeUndefined()
  expect(
    nonReferenceAt({ type: 'basePair', pos: 89 }, pileup()),
  ).toBeUndefined()
})

test('given the allele, counts the reads with that base and no other', () => {
  const data = pileup({
    mismatchPositions: Uint32Array.from([95, 95, 95, 96]),
    mismatchBases: Uint8Array.from([67, 67, 84, 71]),
  })
  const at = (base: string, pos = 95) =>
    nonReferenceAt({ type: 'basePair', pos }, data, { base })
  expect(at('C')).toEqual({ count: 2, depth: 10 })
  expect(at('T')).toEqual({ count: 1, depth: 10 })
  expect(at('G')).toEqual({ count: 0, depth: 10 })
  // a deletion is the allele `*`, and a mismatch beside it is not
  expect(at('*', 101)).toEqual({ count: 2, depth: 10 })
  expect(at('C', 101)).toEqual({ count: 0, depth: 10 })
})

test("given a deletion's least length, counts the gaps that long and keeps every gap in the depth", () => {
  // a read missing three bases at the first base of a 2 kb deletion does not
  // carry the deletion
  const data = pileup({
    gapPositions: Uint32Array.from([101, 104, 101, 2101]),
  })
  const at = (minDeletion?: number) =>
    nonReferenceAt({ type: 'basePair', pos: 101 }, data, {
      base: '*',
      minDeletion,
    })
  expect(at()).toEqual({ count: 2, depth: 10 })
  expect(at(1000)).toEqual({ count: 1, depth: 10 })
  expect(at(2001)).toEqual({ count: 0, depth: 10 })
})

test('given an insertion allele, counts each read with one long enough, near enough', () => {
  // two reads with the 300-base insertion 40 bases off the caller's position,
  // one of them with a second piece of it, and a one-base insertion on it
  const data = pileup({
    interbasePositions: Uint32Array.from([95, 99, 99, 105]),
    interbaseLengths: Uint32Array.from([1, 300, 290, 200]),
    interbaseTypes: new Uint8Array(4).fill(INTERBASE_INSERTION),
    interbaseReadIndices: Uint32Array.from([4, 0, 1, 1]),
    interbaseFrequencies: new Uint8Array(4),
    numInsertions: 4,
  })
  const at = (minInsertion: number, within: number) =>
    nonReferenceAt({ type: 'insertion', pos: 95 }, data, {
      minInsertion,
      within,
    })
  expect(at(150, 0)).toEqual({ count: 0, depth: 10 })
  expect(at(150, 10)).toEqual({ count: 2, depth: 10 })
  expect(at(150, 3)).toEqual({ count: 0, depth: 10 })
  expect(at(1, 0)).toEqual({ count: 1, depth: 10 })
})
