import { computeVisibleInversions } from './computeVisibleInversions.ts'
import { emptyMafCoverage } from './coverageTestFixture.ts'

import type {
  MafAlignedRow,
  MafRegionData,
} from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'

const enc = new TextEncoder()

// One block at [start, start+len) with the given rows (chr/strand drive the
// inversion call; the sequence bytes are irrelevant here).
function block(start: number, len: number, rows: Partial<MafAlignedRow>[]) {
  return {
    startBp: start,
    endBp: start + len,
    refSeqBytes: enc.encode('A'.repeat(len)),
    rows: rows.map((r, rowIndex) => ({
      rowIndex,
      alignmentBytes: enc.encode('A'.repeat(len)),
      ...r,
    })),
    empties: [],
  }
}

function region(blocks: MafRegionData['blocks']): MafRegionData {
  return { blocks, coverage: emptyMafCoverage(blocks[0]!.startBp) }
}

const view = {
  visibleRegions: [
    {
      displayedRegionIndex: 0,
      start: 100,
      end: 400,
      screenStartPx: 0,
      reversed: false,
    },
  ],
  bpPerPx: 1,
}

const opts = { rowHeight: 10, rowProportion: 1 }

test('flags the block that bucks its scaffold consensus, not the majority', () => {
  // row 0: two + blocks on chrA, one − block on chrA → the − block is inverted
  const rpcDataMap = new Map([
    [
      0,
      region([
        block(100, 30, [{ chr: 'chrA', strand: 1 }]),
        block(150, 30, [{ chr: 'chrA', strand: -1 }]),
        block(200, 30, [{ chr: 'chrA', strand: 1 }]),
      ]),
    ],
  ])
  const markers = computeVisibleInversions({ view, rpcDataMap, ...opts })
  expect(markers).toHaveLength(1)
  // the inverted block is the one at 150..180 → px is region-relative (bp − 100)
  expect(markers[0]).toMatchObject({ xLeft: 50, width: 30 })
})

test('a wholly reverse-oriented scaffold is NOT all inversions', () => {
  // every block of this scaffold is −, so − is its consensus → nothing flagged
  const rpcDataMap = new Map([
    [
      0,
      region([
        block(100, 30, [{ chr: 'scaf9', strand: -1 }]),
        block(150, 30, [{ chr: 'scaf9', strand: -1 }]),
      ]),
    ],
  ])
  expect(computeVisibleInversions({ view, rpcDataMap, ...opts })).toHaveLength(
    0,
  )
})

test('consensus is per (row, source chromosome)', () => {
  // one row, two scaffolds: chrA mostly + (one − = inversion), chrB mostly −
  // (one + = inversion) → exactly one inverted block per scaffold
  const rpcDataMap = new Map([
    [
      0,
      region([
        block(100, 40, [{ chr: 'chrA', strand: 1 }]),
        block(150, 10, [{ chr: 'chrA', strand: -1 }]), // inverted vs chrA (+)
        block(200, 40, [{ chr: 'chrB', strand: -1 }]),
        block(250, 10, [{ chr: 'chrB', strand: 1 }]), // inverted vs chrB (−)
      ]),
    ],
  ])
  const markers = computeVisibleInversions({ view, rpcDataMap, ...opts })
  // inverted blocks at 150 and 250 → region-relative px 50 and 150
  expect(markers.map(m => m.xLeft).sort((a, b) => a - b)).toEqual([50, 150])
})

test('rows without strand or chr are ignored', () => {
  const rpcDataMap = new Map([
    [0, region([block(100, 30, [{ strand: -1 }, { chr: 'chrA' }])])],
  ])
  expect(computeVisibleInversions({ view, rpcDataMap, ...opts })).toHaveLength(
    0,
  )
})
