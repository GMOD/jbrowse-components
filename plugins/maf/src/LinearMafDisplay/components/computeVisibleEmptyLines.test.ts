import { computeVisibleEmptyLines } from './computeVisibleEmptyLines.ts'
import { emptyMafCoverage } from './coverage.fixture.ts'

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
    srcRefName: 'c',
    srcStart: 0,
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
    viewportHeight: 1000,
  })
  // reversed: x = end - bp → bp 100..110 maps to px 100..90; left=90, width=10
  expect(segs[0]).toMatchObject({ x: 90, width: 10, status: 'I' })
})

describe('the rows area', () => {
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
  const compute = (viewportHeight: number) =>
    computeVisibleEmptyLines({
      view,
      rpcDataMap: { get: () => data },
      rowHeight: 10,
      rowProportion: 1,
      viewportHeight,
    })

  it('places every marker at its row', () => {
    expect(compute(1000).map(s => s.rowTop)).toEqual([
      0, 10, 20, 30, 40, 50, 60, 70, 80, 90,
    ])
  })

  it('emits only the rows the area shows, the last one partly', () => {
    expect(compute(25).map(s => s.rowTop)).toEqual([0, 10, 20])
  })
})

describe('two visible regions', () => {
  const twoRegions = (reversed: boolean) => ({
    bpPerPx: 1,
    visibleRegions: [
      {
        displayedRegionIndex: 0,
        start: 100,
        end: 200,
        screenStartPx: 0,
        reversed,
      },
      {
        displayedRegionIndex: 1,
        start: 5000,
        end: 5100,
        screenStartPx: 102,
        reversed,
      },
    ],
  })
  const data = regionData([
    {
      startBp: 150,
      endBp: 600,
      refSeqBytes: enc.encode('A'.repeat(450)),
      rows: [],
      empties: [emptyRow(0, 'C')],
    },
  ])
  const segmentsIn = (reversed: boolean) =>
    computeVisibleEmptyLines({
      view: twoRegions(reversed),
      rpcDataMap: { get: i => (i === 0 ? data : undefined) },
      rowHeight: 15,
      rowProportion: 0.8,
      viewportHeight: 1000,
    })

  it('stops a line at its region edge', () => {
    expect(segmentsIn(false)).toMatchObject([{ x: 50, width: 50 }])
  })

  it('stops a line at the edge of a reversed region', () => {
    expect(segmentsIn(true)).toMatchObject([{ x: 0, width: 50 }])
  })
})
