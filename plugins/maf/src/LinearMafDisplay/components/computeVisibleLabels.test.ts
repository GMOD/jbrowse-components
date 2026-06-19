import { computeVisibleLabels } from './computeVisibleLabels.ts'
import { emptyMafCoverage } from './coverageTestFixture.ts'

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
    coverage: emptyMafCoverage(100),
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
  // Cell centers: scale = 1/0.05 = 20, center = (bp + 0.5 - start) * 20.
  // C at bp 101 → 30, G at 102 → 50, T at 103 → 70.
  expect(labels.map(l => l.x)).toEqual([30, 50, 70])
})

test('reversed region mirrors label x positions through the region end', () => {
  const rpcDataMap = new Map<number, MafRegionData>([
    [0, regionData('AAAAA', 'ACGTA')],
  ])
  const labels = computeVisibleLabels({
    view: { ...view, visibleRegions: [{ ...view.visibleRegions[0]!, reversed: true }] },
    rpcDataMap,
    rowHeight: 15,
    rowProportion: 0.8,
    showAllLetters: false,
    showAsUpperCase: false,
  })
  expect(labels.map(l => l.text)).toEqual(['C', 'G', 'T'])
  // Reversed: center = (end - (bp + 0.5)) * 20, end = 110.
  // C at bp 101 → 170, G at 102 → 150, T at 103 → 130.
  expect(labels.map(l => l.x)).toEqual([170, 150, 130])
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
