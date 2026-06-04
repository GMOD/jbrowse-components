import { computeVisibleLabels } from './computeVisibleLabels.ts'

import type { MafRegionData } from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'

const enc = new TextEncoder()

function regionData(refSeq: string, alignment: string): MafRegionData {
  return {
    blocks: [
      {
        startBp: 100,
        endBp: 100 + refSeq.replace(/-/g, '').length,
        refSeqBytes: enc.encode(refSeq),
        rows: [{ rowIndex: 0, alignmentBytes: enc.encode(alignment) }],
        empties: [],
      },
    ],
    coverage: {
      coverageDepths: new Float32Array(0),
      coverageStartPos: 100,
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
  visibleRegions: [
    {
      displayedRegionIndex: 0,
      start: 100,
      end: 110,
      screenStartPx: 0,
      reversed: false,
    },
  ],
  // small bpPerPx → scale >= CHAR_SIZE_WIDTH so labels are computed
  bpPerPx: 0.05,
}

test('mismatched bases produce labels', () => {
  const rpcDataMap = new Map<number, MafRegionData>([
    [0, regionData('AAAAA', 'ACGTA')],
  ])
  const labels = computeVisibleLabels({
    view,
    rpcDataMap,
    rowHeight: 15,
    rowProportion: 0.8,
    showAllLetters: false,
    showAsUpperCase: false,
  })
  expect(labels.map(l => l.text)).toEqual(['C', 'G', 'T'])
})

test('space chars in alignment are treated as gaps, not labeled', () => {
  // Some adapters emit ' ' for missing bases in a sub-block. Renderers treat
  // these as gap cells (resolveCellColor.ts). The label overlay must agree —
  // otherwise users see a phantom space character drawn over a gap.
  const rpcDataMap = new Map<number, MafRegionData>([
    [0, regionData('AAAAA', 'A   A')],
  ])
  const labels = computeVisibleLabels({
    view,
    rpcDataMap,
    rowHeight: 15,
    rowProportion: 0.8,
    showAllLetters: true,
    showAsUpperCase: false,
  })
  // Only the two 'A' matches would produce labels (with showAllLetters=true);
  // the 3 spaces should NOT be labeled.
  expect(labels.map(l => l.text)).toEqual(['A', 'A'])
})

test('dashes in alignment are treated as gaps', () => {
  const rpcDataMap = new Map<number, MafRegionData>([
    [0, regionData('AAAAA', 'A---A')],
  ])
  const labels = computeVisibleLabels({
    view,
    rpcDataMap,
    rowHeight: 15,
    rowProportion: 0.8,
    showAllLetters: true,
    showAsUpperCase: false,
  })
  expect(labels.map(l => l.text)).toEqual(['A', 'A'])
})
