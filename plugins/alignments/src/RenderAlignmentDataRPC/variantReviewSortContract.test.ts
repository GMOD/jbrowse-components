// The column the variant-review plugin sorts on for a VCF record, checked
// against this sort's own reading of that column. It lives here, not in
// plugins/variant-review, because a change on this side (the deletion-cover
// test, where an insertion is recorded) is what would break it.
import { sortCoordinate } from '../../../variant-review/src/candidates/sortCoordinate.ts'
import { GAP_DELETION } from '../shaders/slang/gap.consts.generated.ts'
import { INTERBASE_INSERTION } from '../shared/types.ts'
import { computeSortedLayout } from './sortLayout.ts'
import { baseWorkerPileupData } from './testPileupData.ts'

import type { SortedBy } from '../shared/types.ts'
import type { WorkerPileupData } from './types.ts'

// Six reads over [0, 300), so every one overlaps the sort column; reads 4 and
// 5 come first in canonical order, so a sort that keys nobody leaves them on
// top, and the carriers rising above them is the sort taking effect.
const NUM_READS = 6
const CARRIERS = [0, 1, 2]

function pileup(overrides: Partial<WorkerPileupData>): WorkerPileupData {
  const readPositions = new Uint32Array(NUM_READS * 2)
  for (let i = 0; i < NUM_READS; i++) {
    readPositions[i * 2] = i >= 4 ? 0 : 10
    readPositions[i * 2 + 1] = 300
  }
  return {
    ...baseWorkerPileupData(NUM_READS),
    readKeys: Array.from({ length: NUM_READS }, (_, i) => `r${i}`),
    readPositions,
    ...overrides,
  }
}

// What a CIGAR walk records for a deletion of [start, end) on each carrier.
function withDeletion(start: number, end: number) {
  return pileup({
    gapPositions: Uint32Array.from(CARRIERS.flatMap(() => [start, end])),
    gapTypes: new Uint8Array(CARRIERS.length).fill(GAP_DELETION),
    gapReadIndices: Uint32Array.from(CARRIERS),
    gapFrequencies: new Uint8Array(CARRIERS.length),
  })
}

// What a CIGAR walk records for an insertion: `emitInsertion` puts it at the
// reference base following the inserted bases.
function withInsertion(followingBase: number) {
  return pileup({
    interbasePositions: new Uint32Array(CARRIERS.length).fill(followingBase),
    interbaseLengths: new Uint32Array(CARRIERS.length).fill(3),
    interbaseTypes: new Uint8Array(CARRIERS.length).fill(INTERBASE_INSERTION),
    interbaseReadIndices: Uint32Array.from(CARRIERS),
    interbaseFrequencies: new Uint8Array(CARRIERS.length),
  })
}

function topRows(data: WorkerPileupData, sortedBy: SortedBy) {
  const { readYs } = computeSortedLayout(data, sortedBy)
  return [...readYs.keys()]
    .sort((a, b) => readYs[a]! - readYs[b]!)
    .slice(0, CARRIERS.length)
    .sort((a, b) => a - b)
}

function sortedByFor(start0: number, ref: string, alt: string): SortedBy {
  const sort = sortCoordinate(start0, ref, [alt])
  if (!sort) {
    throw new Error(`no sort for ${ref}>${alt}`)
  }
  return { ...sort, refName: 'ctgA' }
}

test('an anchored deletion sorts its carriers first', () => {
  // VCF POS 101 (start0 100) REF ACGT ALT A deletes [101, 104)
  const data = withDeletion(101, 104)
  expect(topRows(data, sortedByFor(100, 'ACGT', 'A'))).toEqual(CARRIERS)
  // the anchor column itself does not: the gap starts after it
  expect(
    topRows(data, { type: 'basePair', pos: 100, refName: 'ctgA' }),
  ).not.toEqual(CARRIERS)
})

test('an unanchored (k = 0) deletion sorts its carriers first', () => {
  // REF ACGT ALT T at start0 100: the aligner's gap covers [100, 103)
  const data = withDeletion(100, 103)
  expect(topRows(data, sortedByFor(100, 'ACGT', 'T'))).toEqual(CARRIERS)
})

test('an anchored insertion sorts its carriers first', () => {
  // VCF POS 101 (start0 100) REF A ALT ACCC inserts between 100 and 101
  const data = withInsertion(101)
  expect(topRows(data, sortedByFor(100, 'A', 'ACCC'))).toEqual(CARRIERS)
  // one base to the left, at the anchor, finds nothing
  expect(
    topRows(data, { type: 'insertion', pos: 100, refName: 'ctgA' }),
  ).not.toEqual(CARRIERS)
})
