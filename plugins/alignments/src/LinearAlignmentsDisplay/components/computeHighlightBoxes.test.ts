import { computeHighlightBoxes } from './computeHighlightBoxes.ts'

import type { HighlightSection } from './computeHighlightBoxes.ts'
import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'

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
