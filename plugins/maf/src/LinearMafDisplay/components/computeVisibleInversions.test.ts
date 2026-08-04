import {
  computeVisibleInversions,
  consensusStrandByRowChr,
} from './computeVisibleInversions.ts'
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

const opts = {
  rowHeight: 10,
  rowProportion: 1,
  scrollTop: 0,
  viewportHeight: 1000,
}

// The pairing the model makes: the consensus over every loaded region, then the
// markers for the visible one. Composed here so these tests exercise the same
// two steps the display does rather than a hand-written consensus.
function visibleInversions(
  rpcDataMap: ReadonlyMap<number, MafRegionData>,
  v = view,
) {
  return computeVisibleInversions({
    view: v,
    rpcDataMap,
    consensus: consensusStrandByRowChr(rpcDataMap),
    ...opts,
  })
}

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
  const markers = visibleInversions(rpcDataMap)
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
  expect(visibleInversions(rpcDataMap)).toHaveLength(0)
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
  const markers = visibleInversions(rpcDataMap)
  // inverted blocks at 150 and 250 → region-relative px 50 and 150
  expect(markers.map(m => m.xLeft).sort((a, b) => a - b)).toEqual([50, 150])
})

test('rows without strand or chr are ignored', () => {
  const rpcDataMap = new Map([
    [0, region([block(100, 30, [{ strand: -1 }, { chr: 'chrA' }])])],
  ])
  expect(visibleInversions(rpcDataMap)).toHaveLength(0)
})

// The buffered region extends past the visible one, and its blocks are skipped
// before they are walked. Both halves matter: the off-screen block emits no
// marker, but it still votes in the consensus — which is the whole reason the
// consensus is computed over the loaded map rather than the visible blocks.
test('blocks outside the visible span emit no marker but still set consensus', () => {
  const narrow = {
    ...view,
    visibleRegions: [{ ...view.visibleRegions[0]!, start: 100, end: 140 }],
  }
  const rpcDataMap = new Map([
    [
      0,
      region([
        // visible, − strand
        block(100, 30, [{ chr: 'chrA', strand: -1 }]),
        // off-screen, and enough + bp to make + the scaffold consensus
        block(300, 300, [{ chr: 'chrA', strand: 1 }]),
      ]),
    ],
  ])
  const markers = visibleInversions(rpcDataMap, narrow)
  expect(markers).toHaveLength(1)
  expect(markers[0]).toMatchObject({ xLeft: 0, width: 30 })
})

// A block straddling the visible edge must survive the skip — the bound tests
// its end against the region start, not its start.
test('a block straddling the visible start still draws', () => {
  const narrow = {
    ...view,
    visibleRegions: [{ ...view.visibleRegions[0]!, start: 200, end: 400 }],
  }
  const rpcDataMap = new Map([
    [
      0,
      region([
        // starts before the visible span, ends inside it
        block(150, 100, [{ chr: 'chrA', strand: -1 }]),
        block(300, 300, [{ chr: 'chrA', strand: 1 }]),
      ]),
    ],
  ])
  expect(visibleInversions(rpcDataMap, narrow)).toHaveLength(1)
})
