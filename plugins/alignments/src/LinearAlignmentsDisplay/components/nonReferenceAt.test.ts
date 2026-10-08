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
