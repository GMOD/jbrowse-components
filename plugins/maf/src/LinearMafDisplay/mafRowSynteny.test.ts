import { buildMafRowSynteny } from './mafRowSynteny.ts'

import type {
  MafAlignedRow,
  MafBlock,
  MafRegionData,
} from '../LinearMafRenderer/mafRenderingBackendTypes.ts'

const enc = new TextEncoder()

function block(
  startBp: number,
  ref: string,
  rows: (Partial<MafAlignedRow> & { aln: string })[],
): MafBlock {
  const refSeqBytes = enc.encode(ref)
  const refLen = ref.replaceAll('-', '').length
  return {
    startBp,
    endBp: startBp + refLen,
    refSeqBytes,
    rows: rows.map(({ aln, ...rest }, rowIndex) => ({
      rowIndex,
      alignmentBytes: enc.encode(aln),
      chr: 'chr2',
      start: 1000,
      strand: 1,
      srcSize: 5000,
      ...rest,
    })),
    empties: [],
  }
}

function region(...blocks: MafBlock[]): MafRegionData {
  return { blocks, coverage: {} as MafRegionData['coverage'] }
}

const build = (
  region: MafRegionData,
  startBp: number,
  endBp: number,
  rowIndex = 0,
) =>
  buildMafRowSynteny({
    region,
    startBp,
    endBp,
    rowIndex,
    refName: 'chr1',
    mateAssembly: 'sample',
    idPrefix: 't',
  })

// ref  A C - G T
// row  A - T G T   -> 1M 1D 1I 2M ; row bases at offsets 0,1,2,3
test('the gapped columns become a CIGAR and both spans', () => {
  const out = build(region(block(100, 'AC-GT', [{ aln: 'A-TGT' }])), 0, 1000)!
  expect(out.features).toHaveLength(1)
  expect(out.features[0]).toMatchObject({
    refName: 'chr1',
    start: 100,
    end: 104,
    strand: 1,
    CIGAR: '1M1D1I2M',
    mate: { refName: 'chr2', start: 1000, end: 1004, assemblyName: 'sample' },
  })
  expect(out).toMatchObject({ refName: 'chr2', start: 1000, end: 1004 })
})

// Clipping to the selection: only reference bases inside [startBp, endBp)
// count, and an insertion after the last included base falls outside.
test('the selection clips the block on both axes, half-open', () => {
  const out = build(region(block(100, 'ACG-T', [{ aln: 'ACGAT' }])), 101, 103)!
  expect(out.features[0]).toMatchObject({
    start: 101,
    end: 103,
    CIGAR: '2M',
    mate: { start: 1001, end: 1003 },
  })
})

// A `-` row: MAF states its start on the reverse strand, and forwardPos
// mirrors it through srcSize. Walking the columns forward walks the row's
// forward coordinates DOWN, so the mate is [min, max+1] and the feature is on
// the minus strand.
test('a minus-strand row is a minus-strand feature with a forward mate span', () => {
  const out = build(
    region(
      block(100, 'ACGT', [
        { aln: 'ACGT', strand: -1, start: 10, srcSize: 100 },
      ]),
    ),
    0,
    1000,
  )!
  // forwardPos(offset) = 100 - 1 - 10 - offset: offsets 0..3 -> 89..86
  expect(out.features[0]).toMatchObject({
    strand: -1,
    CIGAR: '4M',
    mate: { start: 86, end: 90 },
  })
  expect(out.reversed).toBe(true)
})

test('one feature per block, and a block where the row is all gap yields none', () => {
  const out = build(
    region(
      block(100, 'AC', [{ aln: 'AC' }]),
      block(200, 'GG', [{ aln: '--' }]),
      block(300, 'TT', [{ aln: 'TT', start: 2000 }]),
    ),
    0,
    1000,
  )!
  expect(out.features.map(f => [f.start, f.mate.start, f.syntenyId])).toEqual([
    [100, 1000, 0],
    [300, 2000, 1],
  ])
  expect(out).toMatchObject({ start: 1000, end: 2002 })
})

test('a row with no coordinates, or none in range, is nothing to launch', () => {
  expect(
    build(region(block(100, 'AC', [{ aln: 'AC', start: undefined }])), 0, 1000),
  ).toBeUndefined()
  expect(
    build(region(block(100, 'AC', [{ aln: 'AC' }])), 500, 600),
  ).toBeUndefined()
})
