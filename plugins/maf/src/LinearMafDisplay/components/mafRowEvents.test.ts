import { emptyMafCoverage } from './coverageTestFixture.ts'
import { regionInvertedRows } from './mafRowEvents.ts'

import type { MafRegionData } from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { StrandConsensus } from './computeVisibleInversions.ts'

const enc = new TextEncoder()

function block(startBp: number, refSeq: string, alignments: string[]) {
  return {
    startBp,
    endBp: startBp + refSeq.replaceAll('-', '').length,
    refSeqBytes: enc.encode(refSeq),
    rows: alignments.map((alignment, rowIndex) => ({
      rowIndex,
      alignmentBytes: enc.encode(alignment),
    })),
    empties: [],
  }
}

function region(blocks: ReturnType<typeof block>[]): MafRegionData {
  return { blocks, coverage: emptyMafCoverage(100) }
}

const forward: StrandConsensus = new Map([
  [0, new Map([['chr1', 1]])],
  [1, new Map([['chr1', 1]])],
  [2, new Map([['chr1', 1]])],
])
const reverse: StrandConsensus = new Map([[0, new Map([['chr1', -1]])]])

function minusStrand(startBp: number) {
  const base = block(startBp, 'AAAA', ['AAAA'])
  return {
    ...base,
    rows: base.rows.map(row => ({ ...row, chr: 'chr1', strand: -1 })),
  }
}

test('a block is walked once, however many times it is asked for', () => {
  const invertedRows = regionInvertedRows(region([minusStrand(100)]), forward)
  expect(invertedRows(0)).toBe(invertedRows(0))
})

test('only rows whose strand differs from their consensus are inverted', () => {
  const base = block(0, 'AAAA', ['AAAA', 'AAAA', 'AAAA', 'AAAA'])
  const rows = [
    { ...base.rows[0]!, chr: 'chr1', strand: -1 },
    { ...base.rows[1]!, chr: 'chr1', strand: 1 },
    { ...base.rows[2]!, chr: 'chr1' },
    { ...base.rows[3]!, strand: -1 },
  ]
  expect(regionInvertedRows(region([{ ...base, rows }]), forward)(0)).toEqual([
    0,
  ])
})

// `consensusStrandByRowChr` is scored across every loaded region, so a region
// landing elsewhere can flip which of this one's blocks read as inverted — the
// cache has to belong to the consensus that built it.
test('inverted rows are keyed by consensus as well as region', () => {
  const data = region([minusStrand(100)])
  expect(regionInvertedRows(data, forward)(0)).toEqual([0])
  expect(regionInvertedRows(data, reverse)(0)).toEqual([])
  expect(regionInvertedRows(data, forward)).not.toBe(
    regionInvertedRows(data, reverse),
  )
})
