import { emptyMafCoverage } from './coverageTestFixture.ts'
import { findRowSpans } from './findRowSpan.ts'

import type {
  MafBlock,
  MafRegionData,
} from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'

const enc = new TextEncoder()

function region(blocks: MafBlock[]): MafRegionData {
  return { blocks, coverage: emptyMafCoverage() }
}

// One row's span out of the batch every caller asks for.
function findRowSpan(
  r: MafRegionData,
  startBp: number,
  endBp: number,
  rowIndex: number,
) {
  return findRowSpans(r, startBp, endBp, new Set([rowIndex])).get(rowIndex)
}

const plusStrand = region([
  {
    startBp: 100,
    endBp: 105,
    refSeqBytes: enc.encode('AAAAA'),
    rows: [
      {
        rowIndex: 0,
        alignmentBytes: enc.encode('acgta'),
        chr: 'chrX',
        start: 500,
        strand: 1,
      },
    ],
    empties: [],
  },
])

test('span of a + strand row is its own coordinates over the ref range', () => {
  expect(findRowSpan(plusStrand, 101, 104, 0)).toEqual({
    chr: 'chrX',
    start: 501,
    end: 504,
  })
})

test('gaps in the sample are excluded from the span', () => {
  const r = region([
    {
      startBp: 100,
      endBp: 105,
      refSeqBytes: enc.encode('AAAAA'),
      rows: [
        {
          rowIndex: 0,
          alignmentBytes: enc.encode('--gt-'),
          chr: 'chrX',
          start: 500,
          strand: 1,
        },
      ],
      empties: [],
    },
  ])
  expect(findRowSpan(r, 100, 105, 0)).toEqual({
    chr: 'chrX',
    start: 500,
    end: 502,
  })
})

test('a − strand row mirrors through srcSize', () => {
  const r = region([
    {
      startBp: 100,
      endBp: 105,
      refSeqBytes: enc.encode('AAAAA'),
      rows: [
        {
          rowIndex: 0,
          alignmentBytes: enc.encode('acgta'),
          chr: 'chrX',
          start: 10,
          strand: -1,
          srcSize: 1000,
        },
      ],
      empties: [],
    },
  ])
  // baseOffsets 1..3 map to 1000-1-10-offset = 988..986
  expect(findRowSpan(r, 101, 104, 0)).toEqual({
    chr: 'chrX',
    start: 986,
    end: 989,
  })
})

test('span extends across adjacent blocks on the same chromosome', () => {
  const r = region([
    {
      startBp: 100,
      endBp: 102,
      refSeqBytes: enc.encode('AA'),
      rows: [
        {
          rowIndex: 0,
          alignmentBytes: enc.encode('ac'),
          chr: 'chrX',
          start: 500,
          strand: 1,
        },
      ],
      empties: [],
    },
    {
      startBp: 110,
      endBp: 112,
      refSeqBytes: enc.encode('AA'),
      rows: [
        {
          rowIndex: 0,
          alignmentBytes: enc.encode('gt'),
          chr: 'chrX',
          start: 600,
          strand: 1,
        },
      ],
      empties: [],
    },
  ])
  expect(findRowSpan(r, 100, 112, 0)).toEqual({
    chr: 'chrX',
    start: 500,
    end: 602,
  })
})

test('a block on a different chromosome does not extend the span', () => {
  const r = region([
    {
      startBp: 100,
      endBp: 102,
      refSeqBytes: enc.encode('AA'),
      rows: [
        {
          rowIndex: 0,
          alignmentBytes: enc.encode('ac'),
          chr: 'chrX',
          start: 500,
          strand: 1,
        },
      ],
      empties: [],
    },
    {
      startBp: 110,
      endBp: 112,
      refSeqBytes: enc.encode('AA'),
      rows: [
        {
          rowIndex: 0,
          alignmentBytes: enc.encode('gt'),
          chr: 'chr7',
          start: 900,
          strand: 1,
        },
      ],
      empties: [],
    },
  ])
  expect(findRowSpan(r, 100, 112, 0)).toEqual({
    chr: 'chrX',
    start: 500,
    end: 502,
  })
})

test('no aligned base in range returns undefined', () => {
  expect(findRowSpan(plusStrand, 200, 300, 0)).toBeUndefined()
  expect(findRowSpan(plusStrand, 100, 105, 1)).toBeUndefined()
})
