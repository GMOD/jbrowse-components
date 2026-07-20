import { computeHighlightBoxes } from './computeHighlightBoxes.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { HighlightSection } from './computeHighlightBoxes.ts'

// computeHighlightBoxes only reads readPositions/readYs off the rpc data.
const rpcData = {
  readPositions: new Uint32Array([10, 20]),
  readYs: new Uint16Array([0]),
} as PileupDataResult

function run(pileupHeight: number) {
  const section: HighlightSection = {
    groupKey: 'g',
    laidOutPileupMap: { get: () => rpcData },
    topOffset: 100,
    pileupHeight,
  }
  return computeHighlightBoxes({
    view: {
      visibleRegions: [
        { displayedRegionIndex: 0, start: 0, end: 1000, screenStartPx: 0 },
      ],
      bpPerPx: 0.1,
    },
    sections: [section],
    readIdIndexMap: new Map([
      ['read1', { displayedRegionIndex: 0, groupKey: 'g', idx: 0 }],
    ]),
    ids: ['read1'],
    height: 1000,
    featureHeight: 10,
    featureSpacing: 2,
    scrollTop: 0,
  })
}

test('hovered read in an open section yields a box', () => {
  expect(run(500)).toHaveLength(1)
})

test('a collapsed section (pileupHeight 0) yields no highlight box', () => {
  expect(run(0)).toHaveLength(0)
})

test('a grouped section near the top of its band stays visible after scrolling', () => {
  // Group 2's pileup band starts at content-space topOffset 400; scrolling
  // down by 200px brings its row 0 (screen top ~200) into view, which must
  // satisfy the lower bound topOffset - scrollTop (200), not the unscrolled
  // topOffset (400).
  const section: HighlightSection = {
    groupKey: 'g',
    laidOutPileupMap: { get: () => rpcData },
    topOffset: 400,
    pileupHeight: 1000,
  }
  const boxes = computeHighlightBoxes({
    view: {
      visibleRegions: [
        { displayedRegionIndex: 0, start: 0, end: 1000, screenStartPx: 0 },
      ],
      bpPerPx: 0.1,
    },
    // Two sections so the grouped (scroll-as-a-unit) path is used.
    sections: [
      {
        groupKey: 'empty',
        laidOutPileupMap: { get: () => undefined },
        topOffset: 0,
        pileupHeight: 0,
      },
      section,
    ],
    readIdIndexMap: new Map([
      ['read1', { displayedRegionIndex: 0, groupKey: 'g', idx: 0 }],
    ]),
    ids: ['read1'],
    height: 1000,
    featureHeight: 10,
    featureSpacing: 2,
    scrollTop: 200,
  })
  expect(boxes).toHaveLength(1)
})
