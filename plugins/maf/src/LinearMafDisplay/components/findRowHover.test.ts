import { findRowHoverAtBp } from './findRowHover.ts'

import type {
  MafBlock,
  MafRegionData,
} from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'

const enc = new TextEncoder()

function region(blocks: MafBlock[]): MafRegionData {
  return {
    blocks,
    coverage: {
      coverageDepths: new Float32Array(0),
      coverageStartPos: 0,
      coverageMaxDepth: 0,
      mismatchPositions: new Uint32Array(0),
      mismatchBases: new Uint8Array(0),
      coveragePackedBuffer: new ArrayBuffer(0),
      snpPackedBuffer: new ArrayBuffer(0),
      interbasePackedBuffer: new ArrayBuffer(0),
      interbaseMaxCount: 0,
      indicatorPackedBuffer: new ArrayBuffer(0),
    },
  }
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
  expect(findRowHoverAtBp(r, 102, 0, false)).toMatchObject({
    kind: 'cell',
    base: 'g',
    chr: 'chrX',
    pos: 102,
    strand: 1,
  })
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
  expect(findRowHoverAtBp(r, 100, 0, false)).toMatchObject({ pos: 899 })
})

test('passes i-line context through on the cell hit', () => {
  const context = { leftStatus: 'I' as const, leftCount: 9 }
  const r = region([
    {
      startBp: 100,
      endBp: 101,
      refSeqBytes: enc.encode('A'),
      rows: [
        { rowIndex: 0, alignmentBytes: enc.encode('c'), context },
      ],
      empties: [],
    },
  ])
  expect(findRowHoverAtBp(r, 100, 0, false)).toMatchObject({ context })
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
  expect(findRowHoverAtBp(r, 101, 1, false)).toEqual({
    kind: 'empty',
    status: 'I',
    chr: 'mm.chr1',
    start: 5,
    size: 13,
    strand: 1,
  })
})

test('returns undefined for gap cells and out-of-block positions', () => {
  const r = region([
    {
      startBp: 100,
      endBp: 103,
      refSeqBytes: enc.encode('AAA'),
      rows: [{ rowIndex: 0, alignmentBytes: enc.encode('a-g') }],
      empties: [],
    },
  ])
  expect(findRowHoverAtBp(r, 101, 0, false)).toBeUndefined()
  expect(findRowHoverAtBp(r, 500, 0, false)).toBeUndefined()
  expect(findRowHoverAtBp(r, 100, 9, false)).toBeUndefined()
})
