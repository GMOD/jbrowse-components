import { emptyMafCoverage } from './coverageTestFixture.ts'
import { findRowHoverAtBp, insertionForwardStart } from './findRowHover.ts'

import type {
  MafBlock,
  MafRegionData,
} from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'

const enc = new TextEncoder()

function region(blocks: MafBlock[]): MafRegionData {
  return { blocks, coverage: emptyMafCoverage() }
}

// A cursor on a forward region, where the base under the pixel is the floor of
// the fractional coordinate. `mafPointerAt` is what pairs the two for real, and
// pivots them apart on a reversed region — see `HoverBp`.
function at(gposFrac: number) {
  return { gposFrac, baseBp: Math.floor(gposFrac) }
}

test('returns cell hit with base + forward-strand position', () => {
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
          start: 100,
          strand: 1,
        },
      ],
      empties: [],
    },
  ])
  expect(findRowHoverAtBp(r, at(102), 0, false, 1)).toMatchObject({
    kind: 'cell',
    base: 'g',
    chr: 'chrX',
    pos: 102,
    strand: 1,
  })
})

test('resolves an insertion (reference-gap columns) over the abutting base', () => {
  // ref has two gaps after the first base → this sample carries a 2bp insertion
  // anchored before genomic 101. Inserted bases are 'cc'.
  const r = region([
    {
      startBp: 100,
      endBp: 102,
      refSeqBytes: enc.encode('A--A'),
      rows: [
        {
          rowIndex: 0,
          alignmentBytes: enc.encode('accA'),
          chr: 'chrX',
          start: 100,
          strand: 1,
        },
      ],
      empties: [],
    },
  ])
  // cursor right at the insertion anchor (genomic 101), wide cells (bpPerPx<1)
  expect(findRowHoverAtBp(r, at(101), 0, false, 0.1)).toMatchObject({
    kind: 'insertion',
    length: 2,
    sequence: 'cc',
    chr: 'chrX',
    // first inserted base is the 2nd non-gap base of the sample → start + 1
    pos: 101,
  })
  // cursor a full bp away from the marker → falls back to the plain base
  expect(findRowHoverAtBp(r, at(101.9), 0, false, 0.1)).toMatchObject({
    kind: 'cell',
  })
})

test('a minus-row insertion runs leftward from the reported position', () => {
  // Same 2bp insertion as above on a '-' row: the columns are still the
  // reference's left-to-right, so the first inserted base has the HIGHEST
  // forward coordinate and the run covers [897, 899).
  const r = region([
    {
      startBp: 100,
      endBp: 102,
      refSeqBytes: enc.encode('A--A'),
      rows: [
        {
          rowIndex: 0,
          alignmentBytes: enc.encode('accA'),
          chr: 'chrY',
          start: 100,
          strand: -1,
          srcSize: 1000,
        },
      ],
      empties: [],
    },
  ])
  const hit = findRowHoverAtBp(r, at(101), 0, false, 0.1)
  expect(hit).toMatchObject({
    kind: 'insertion',
    length: 2,
    sequence: 'cc',
    // srcSize - 1 - start - baseOffset = 1000 - 1 - 100 - 1
    pos: 898,
    strand: -1,
  })
  expect(insertionForwardStart(898, 2, -1)).toBe(897)
  expect(insertionForwardStart(898, 2, 1)).toBe(898)
})

test('mirrors position through srcSize for reverse-strand rows', () => {
  const r = region([
    {
      startBp: 100,
      endBp: 103,
      refSeqBytes: enc.encode('AAA'),
      rows: [
        {
          rowIndex: 0,
          alignmentBytes: enc.encode('acg'),
          chr: 'chrY',
          start: 100,
          strand: -1,
          srcSize: 1000,
        },
      ],
      empties: [],
    },
  ])
  // baseOffset 0 → srcSize - 1 - start - 0 = 1000 - 1 - 100 = 899
  expect(findRowHoverAtBp(r, at(100), 0, false, 1)).toMatchObject({ pos: 899 })
})

test('passes i-line context through on the cell hit', () => {
  const context = { leftStatus: 'I' as const, leftCount: 9 }
  const r = region([
    {
      startBp: 100,
      endBp: 101,
      refSeqBytes: enc.encode('A'),
      rows: [{ rowIndex: 0, alignmentBytes: enc.encode('c'), context }],
      empties: [],
    },
  ])
  expect(findRowHoverAtBp(r, at(100), 0, false, 1)).toMatchObject({ context })
})

test('returns empty hit when the row is bridged (e line) at this block', () => {
  const r = region([
    {
      startBp: 100,
      endBp: 103,
      refSeqBytes: enc.encode('AAA'),
      rows: [{ rowIndex: 0, alignmentBytes: enc.encode('acg') }],
      empties: [
        {
          rowIndex: 1,
          status: 'I',
          chr: 'mm.chr1',
          start: 5,
          size: 13,
          strand: 1,
          srcSize: 999,
        },
      ],
    },
  ])
  expect(findRowHoverAtBp(r, at(101), 1, false, 1)).toEqual({
    kind: 'empty',
    status: 'I',
    chr: 'mm.chr1',
    start: 5,
    size: 13,
    strand: 1,
  })
})

test('resolves a deletion run on a gap cell', () => {
  const r = region([
    {
      startBp: 100,
      endBp: 104,
      // sample deletes the two reference bases at 101-102
      refSeqBytes: enc.encode('AAAA'),
      rows: [{ rowIndex: 0, alignmentBytes: enc.encode('a--g') }],
      empties: [],
    },
  ])
  expect(findRowHoverAtBp(r, at(101), 0, false, 1)).toEqual({
    kind: 'deletion',
    length: 2,
  })
  expect(findRowHoverAtBp(r, at(102), 0, false, 1)).toEqual({
    kind: 'deletion',
    length: 2,
  })
  // a non-gap base in the same row is still a cell, not the deletion
  expect(findRowHoverAtBp(r, at(103), 0, false, 1)).toMatchObject({
    kind: 'cell',
  })
})

test('returns undefined for out-of-block and out-of-row positions', () => {
  const r = region([
    {
      startBp: 100,
      endBp: 103,
      refSeqBytes: enc.encode('AAA'),
      rows: [{ rowIndex: 0, alignmentBytes: enc.encode('a-g') }],
      empties: [],
    },
  ])
  expect(findRowHoverAtBp(r, at(500), 0, false, 1)).toBeUndefined()
  expect(findRowHoverAtBp(r, at(100), 9, false, 1)).toBeUndefined()
})
