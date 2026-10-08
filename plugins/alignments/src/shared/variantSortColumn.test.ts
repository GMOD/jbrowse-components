import { computeSortedLayout } from '../RenderAlignmentDataRPC/sortLayout.ts'
import { baseWorkerPileupData } from '../RenderAlignmentDataRPC/testPileupData.ts'
import { GAP_DELETION } from '../shaders/slang/gap.consts.generated.ts'
import { INTERBASE_INSERTION } from './types.ts'
import { variantSortColumn } from './variantSortColumn.ts'

import type { WorkerPileupData } from '../RenderAlignmentDataRPC/types.ts'
import type { SortedBy } from './types.ts'

test.each([
  ['SNV', 'G', ['A'], { type: 'basePair', pos: 100 }],
  ['MNV past a shared prefix', 'ACG', ['ACT'], { type: 'basePair', pos: 102 }],
  ['anchored deletion', 'ACGT', ['A'], { type: 'basePair', pos: 101 }],
  ['unanchored deletion', 'ACGT', ['T'], { type: 'basePair', pos: 100 }],
  ['anchored insertion', 'A', ['ACCC'], { type: 'insertion', pos: 101 }],
  [
    'insertion padded to a longer REF',
    'AC',
    ['ATC'],
    { type: 'insertion', pos: 101 },
  ],
  [
    'deletion padded to a longer REF',
    'ACGT',
    ['AT'],
    { type: 'basePair', pos: 101 },
  ],
  ['delins', 'ACG', ['AT'], { type: 'basePair', pos: 101 }],
  ['lower-case alleles', 'ctt', ['ct'], { type: 'basePair', pos: 101 }],
  [
    'leftmost of several ALTs',
    'AC',
    ['ACT', 'GC'],
    { type: 'basePair', pos: 100 },
  ],
])('%s', (_name, ref, alts, expected) => {
  expect(variantSortColumn(100, ref, alts)).toEqual(expected)
})

test.each([['<DEL>'], ['G]17:198982]'], ['*'], ['.'], ['G']])(
  'ALT %s names no column',
  alt => {
    expect(variantSortColumn(100, 'G', [alt])).toBeUndefined()
  },
)

// Six reads over the column. Reads 4 and 5 lead the unsorted order, so the
// carriers 0-2 taking the top rows is the sort keying on them.
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

function withDeletion(start: number, end: number) {
  return pileup({
    gapPositions: Uint32Array.from(CARRIERS.flatMap(() => [start, end])),
    gapTypes: new Uint8Array(CARRIERS.length).fill(GAP_DELETION),
    gapReadIndices: Uint32Array.from(CARRIERS),
    gapFrequencies: new Uint8Array(CARRIERS.length),
  })
}

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

function sortedByFor(ref: string, alt: string): SortedBy {
  return { ...variantSortColumn(100, ref, [alt])!, refName: 'ctgA' }
}

test('an anchored deletion sorts its carriers first, and its anchor does not', () => {
  const data = withDeletion(101, 104)
  expect(topRows(data, sortedByFor('ACGT', 'A'))).toEqual(CARRIERS)
  expect(
    topRows(data, { type: 'basePair', pos: 100, refName: 'ctgA' }),
  ).not.toEqual(CARRIERS)
})

test('an unanchored deletion sorts its carriers first', () => {
  expect(topRows(withDeletion(100, 103), sortedByFor('ACGT', 'T'))).toEqual(
    CARRIERS,
  )
})

test('an insertion sorts its carriers first, and its anchor does not', () => {
  const data = withInsertion(101)
  expect(topRows(data, sortedByFor('A', 'ACCC'))).toEqual(CARRIERS)
  expect(
    topRows(data, { type: 'insertion', pos: 100, refName: 'ctgA' }),
  ).not.toEqual(CARRIERS)
})
