import { emptyMafCoverage } from '../LinearMafDisplay/components/coverageTestFixture.ts'
import { placeMafRegionData } from '../LinearMafDisplay/placeMafRows.ts'
import { packTestWire } from './testWire.ts'

import type { TestWireBlock, TestWireRow } from './testWire.ts'

/**
 * The wire's actual contract, which nothing else pins: `MafWirePacker` followed
 * by `placeMafRegionData` is lossless.
 *
 * `mafWirePacker.test.ts` checks the encoding's invariants (offsets, interning,
 * growth) and `placeMafRows.test.ts` checks placement (row index, dropped
 * genomes, arena views), but between them sits the claim the whole columnar
 * switch rests on — that the rows coming out equal the rows that went in, field
 * for field. A fence off by one, a dictionary index read from the wrong column,
 * an `i`-line status decoded one slot over: none of those throw. They produce a
 * plausible row carrying another species' bases at another species' coordinates,
 * which is exactly the failure the parser's entry-boundary check exists to
 * prevent, one layer up.
 */

const decoder = new TextDecoder()

// Deliberately awkward: species and contig names that repeat across blocks (so
// the dictionaries are exercised), rows present in some blocks and not others,
// blocks with no empties beside blocks with several, one row carrying context
// and its neighbours not, reverse strands, and a reference with insertion
// columns so `endBp` is not the column count.
const BLOCKS: TestWireBlock[] = [
  {
    startBp: 1000,
    refSeq: 'ACGT-ACGTA',
    rows: [
      {
        sampleId: 'hg38',
        seq: 'ACGT-ACGTA',
        chr: 'chr1',
        start: 5,
        srcSize: 99,
      },
      {
        sampleId: 'mm39',
        seq: 'ACGTTAC--A',
        chr: 'chr7',
        start: 60,
        strand: -1,
        srcSize: 700,
        context: {
          leftStatus: 'C',
          leftCount: 3,
          rightStatus: 'N',
          rightCount: 9,
        },
      },
      {
        sampleId: 'rn7',
        seq: 'A-GTTACGTA',
        chr: 'chr1',
        start: 12,
        srcSize: 42,
      },
    ],
    empties: [
      {
        sampleId: 'galGal6',
        status: 'I',
        chr: 'chrZ',
        start: 3,
        size: 11,
        strand: 1,
        srcSize: 55,
      },
    ],
  },
  {
    startBp: 2000,
    refSeq: 'TTTTTT',
    // mm39 absent here; rn7 truncated short of the reference
    rows: [
      { sampleId: 'hg38', seq: 'TTTTTT', chr: 'chr1', start: 900, srcSize: 99 },
      { sampleId: 'rn7', seq: 'TTT', chr: 'chr1', start: 901, srcSize: 42 },
    ],
  },
  {
    startBp: 3000,
    refSeq: 'GG--GG',
    rows: [
      {
        sampleId: 'mm39',
        seq: 'GGTTGG',
        chr: 'chr7',
        start: 77,
        strand: -1,
        srcSize: 700,
      },
    ],
    empties: [
      {
        sampleId: 'galGal6',
        status: 'n',
        chr: 'chrZ',
        start: 8,
        size: 2,
        strand: -1,
        srcSize: 55,
      },
      {
        sampleId: 'hg38',
        status: 'M',
        chr: 'chr1',
        start: 950,
        size: 4,
        strand: 1,
        srcSize: 99,
      },
    ],
  },
]

const ORDER = ['hg38', 'mm39', 'rn7', 'galGal6']
const rowIndexBySrc = new Map(ORDER.map((id, i) => [id, i]))

function place(blocks: TestWireBlock[], order = rowIndexBySrc) {
  return placeMafRegionData(
    {
      ...packTestWire(blocks),
      coverage: emptyMafCoverage(),
      refSampleId: 'hg38',
    },
    order,
  )
}

test('pack then place round-trips every aligned row field', () => {
  const placed = place(BLOCKS)
  expect(placed.blocks.length).toBe(BLOCKS.length)
  for (const [b, block] of BLOCKS.entries()) {
    const got = placed.blocks[b]!
    expect(got.startBp).toBe(block.startBp)
    expect(decoder.decode(got.refSeqBytes)).toBe(block.refSeq)
    // endBp counts reference *bases*, not columns
    expect(got.endBp - got.startBp).toBe(
      block.refSeq.replaceAll('-', '').length,
    )
    expect(got.rows.length).toBe(block.rows.length)
    for (const [r, want] of block.rows.entries()) {
      const row = got.rows[r]!
      expect(row.sampleId).toBe(want.sampleId)
      expect(row.rowIndex).toBe(rowIndexBySrc.get(want.sampleId))
      expect(decoder.decode(row.alignmentBytes)).toBe(want.seq)
      expect(row.chr).toBe(want.chr)
      expect(row.start).toBe(want.start)
      expect(row.strand).toBe(want.strand ?? 1)
      expect(row.srcSize).toBe(want.srcSize)
      expect(row.context).toEqual(want.context)
    }
  }
})

test('pack then place round-trips every e-line row field', () => {
  const placed = place(BLOCKS)
  for (const [b, block] of BLOCKS.entries()) {
    const got = placed.blocks[b]!
    const want = block.empties ?? []
    expect(got.empties.length).toBe(want.length)
    for (const [e, expected] of want.entries()) {
      const empty = got.empties[e]!
      expect(empty.sampleId).toBe(expected.sampleId)
      expect(empty.rowIndex).toBe(rowIndexBySrc.get(expected.sampleId))
      expect(empty.status).toBe(expected.status)
      expect(empty.chr).toBe(expected.chr)
      expect(empty.start).toBe(expected.start)
      expect(empty.size).toBe(expected.size)
      expect(empty.strand).toBe(expected.strand)
      expect(empty.srcSize).toBe(expected.srcSize)
    }
  }
})

// The bug this whole test exists for: a row must read its own bases and stop,
// even though the next row's bytes sit immediately after it in the arena.
test('no row reads into its neighbour, at any block boundary', () => {
  const placed = place(BLOCKS)
  for (const [b, block] of BLOCKS.entries()) {
    for (const [r, want] of block.rows.entries()) {
      expect(placed.blocks[b]!.rows[r]!.alignmentBytes.length).toBe(
        want.seq.length,
      )
    }
  }
})

// Placement drops genomes the display isn't drawing. The rows that survive must
// still carry their own bases — a dropped row shifts every column index behind
// it, which is precisely how an off-by-one fence would go unnoticed.
test('round-trips when a genome is not drawn', () => {
  const partial = new Map([
    ['hg38', 0],
    ['rn7', 1],
  ])
  const placed = place(BLOCKS, partial)
  const survivors: TestWireRow[][] = BLOCKS.map(block =>
    block.rows.filter(row => partial.has(row.sampleId)),
  )
  for (const [b, want] of survivors.entries()) {
    const got = placed.blocks[b]!
    expect(got.rows.map(r => r.sampleId)).toEqual(want.map(r => r.sampleId))
    for (const [r, expected] of want.entries()) {
      expect(decoder.decode(got.rows[r]!.alignmentBytes)).toBe(expected.seq)
      expect(got.rows[r]!.rowIndex).toBe(partial.get(expected.sampleId))
    }
  }
})
