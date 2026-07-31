import { computeVisibleEmptyLines } from './computeVisibleEmptyLines.ts'
import { emptyMafCoverage } from './coverageTestFixture.ts'

import type {
  MafBlock,
  MafRegionData,
} from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'

const enc = new TextEncoder()

function emptyRow(
  rowIndex: number,
  status: MafBlock['empties'][number]['status'],
) {
  return {
    rowIndex,
    status,
    chr: 'c',
    start: 0,
    size: 10,
    strand: 1,
    srcSize: 1,
  }
}

function regionData(blocks: MafBlock[]): MafRegionData {
  return { blocks, coverage: emptyMafCoverage() }
}

const view = {
  bpPerPx: 1,
  visibleRegions: [
    {
      displayedRegionIndex: 0,
      start: 100,
      end: 200,
      screenStartPx: 0,
      reversed: false,
    },
  ],
}

test('positions an empty-row segment across the block extent', () => {
  const data = regionData([
    {
      startBp: 100,
      endBp: 110,
      refSeqBytes: enc.encode('AAAAAAAAAA'),
      rows: [],
      empties: [emptyRow(2, 'C')],
    },
  ])
  const segs = computeVisibleEmptyLines({
    view,
    rpcDataMap: { get: () => data },
    rowHeight: 15,
    rowProportion: 0.8,
    scrollTop: 0,
    viewportHeight: 1000,
  })
  // h = 12, offset = 1.5, rowTop = 1.5 + 15*2; x spans bp 100..110 at scale 1
  expect(segs).toEqual([{ x: 0, width: 10, rowTop: 31.5, h: 12, status: 'C' }])
})

test('emits nothing for blocks without empties', () => {
  const data = regionData([
    {
      startBp: 100,
      endBp: 110,
      refSeqBytes: enc.encode('AAAAAAAAAA'),
      rows: [],
      empties: [],
    },
  ])
  const segs = computeVisibleEmptyLines({
    view,
    rpcDataMap: { get: () => data },
    rowHeight: 15,
    rowProportion: 0.8,
    scrollTop: 0,
    viewportHeight: 1000,
  })
  expect(segs).toHaveLength(0)
})

test('mirrors x for reversed regions', () => {
  const data = regionData([
    {
      startBp: 100,
      endBp: 110,
      refSeqBytes: enc.encode('AAAAAAAAAA'),
      rows: [],
      empties: [emptyRow(0, 'I')],
    },
  ])
  const segs = computeVisibleEmptyLines({
    view: {
      bpPerPx: 1,
      visibleRegions: [
        {
          displayedRegionIndex: 0,
          start: 100,
          end: 200,
          screenStartPx: 0,
          reversed: true,
        },
      ],
    },
    rpcDataMap: { get: () => data },
    rowHeight: 15,
    rowProportion: 0.8,
    scrollTop: 0,
    viewportHeight: 1000,
  })
  // reversed: x = end - bp → bp 100..110 maps to px 100..90; left=90, width=10
  expect(segs[0]).toMatchObject({ x: 90, width: 10, status: 'I' })
})

// The rows area is a fixed-size canvas painted at `-scrollTop` (there is no DOM
// scroller), so every overlay has to place its markers in screen space and drop
// the rows scrolled off the viewport — or a scrolled track shows the right
// glyphs at the wrong rows.
describe('scrolled rows', () => {
  const rows = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
  const data = regionData([
    {
      startBp: 100,
      endBp: 110,
      refSeqBytes: enc.encode('AAAAAAAAAA'),
      rows: [],
      empties: rows.map(r => emptyRow(r, 'C')),
    },
  ])
  const compute = (scrollTop: number, viewportHeight: number) =>
    computeVisibleEmptyLines({
      view,
      rpcDataMap: { get: () => data },
      rowHeight: 10,
      rowProportion: 1,
      scrollTop,
      viewportHeight,
    })

  it('shifts every marker up by the scroll offset', () => {
    expect(compute(0, 1000).map(s => s.rowTop)).toEqual([
      0, 10, 20, 30, 40, 50, 60, 70, 80, 90,
    ])
    // rows 0 and 1 have scrolled off the top; the rest come back 25px higher
    expect(compute(25, 1000).map(s => s.rowTop)).toEqual([
      -5, 5, 15, 25, 35, 45, 55, 65,
    ])
  })

  it('emits only the rows the viewport shows', () => {
    // rows 2..5 straddle or fill [25, 55) — the partially scrolled ones at each
    // edge still draw
    expect(compute(25, 30).map(s => s.rowTop)).toEqual([-5, 5, 15, 25])
  })
})
