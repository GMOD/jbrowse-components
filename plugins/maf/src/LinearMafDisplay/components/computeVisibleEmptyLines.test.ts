import { computeVisibleEmptyLines } from './computeVisibleEmptyLines.ts'

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
  })
  // reversed: x = end - bp → bp 100..110 maps to px 100..90; left=90, width=10
  expect(segs[0]).toMatchObject({ x: 90, width: 10, status: 'I' })
})
