import { readHighlightInk } from './readHighlightInk.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { RenderState } from '../renderers/rendererTypes.ts'
import type { HighlightSection } from './readHighlightInk.ts'

// Two reads on row 0: read 0 is spliced into two segments, read 1 abuts it.
// Only what the read mark's ink reads is here.
const rpcData = {
  readPositions: new Uint32Array([10, 60, 70, 90]),
  readYs: new Uint16Array([0, 0]),
  readStrands: new Int8Array([0, 0]),
  readFlags: new Uint16Array([0, 0]),
  readInterchrom: new Uint8Array([0, 0]),
  readInsertSizes: new Float32Array([0, 0]),
  segmentPositions: new Uint32Array([10, 30, 40, 60, 70, 90]),
  segmentReadIndices: new Uint32Array([0, 0, 1]),
  segmentEdgeFlags: new Uint8Array([0, 0, 0]),
} as unknown as PileupDataResult

// 1000 bp over 100 px, so a bp is a tenth of a pixel.
const blocks = [
  {
    displayedRegionIndex: 0,
    start: 0,
    end: 1000,
    screenStartPx: 0,
    screenEndPx: 100,
    reversed: false,
  },
]

const state = {
  featureHeight: 10,
  featureSpacing: 2,
  scrollTop: 0,
  canvasHeight: 1000,
  chainMode: false,
  colorScheme: 0,
} as RenderState

const readIdIndexMap = new Map([
  ['read0', { displayedRegionIndex: 0, groupKey: 'g', idx: 0 }],
  ['read1', { displayedRegionIndex: 0, groupKey: 'g', idx: 1 }],
])

function run(
  ids: string[],
  section: HighlightSection,
  {
    sections = [section],
    scrollTop = 0,
    strong = false,
  }: {
    sections?: HighlightSection[]
    scrollTop?: number
    strong?: boolean
  } = {},
) {
  return readHighlightInk({
    blocks,
    sections,
    readIdIndexMap,
    ids,
    state: { ...state, scrollTop },
    scroll: { isGrouped: sections.length > 1, scrollTop, canvasHeight: 1000 },
    strong,
  })
}

const open: HighlightSection = {
  groupKey: 'g',
  laidOutPileupMap: { get: () => rpcData },
  topOffset: 100,
  pileupHeight: 500,
}

test('a spliced read is one box over its segments and the intron between', () => {
  expect(run(['read0'], open)).toEqual([
    { left: 1, top: 100, width: 5, height: 10, strong: false },
  ])
})

test('a chain merges its members on the row, in the strong shade', () => {
  expect(run(['read0', 'read1'], open, { strong: true })).toEqual([
    { left: 1, top: 100, width: 8, height: 10, strong: true },
  ])
})

test('a collapsed section (pileupHeight 0) lights nothing', () => {
  expect(run(['read0'], { ...open, pileupHeight: 0 })).toEqual([])
})

test('a grouped section near the top of its band stays lit after scrolling', () => {
  // Group 2's band starts at content-space 400; scrolling down by 200 brings
  // its row 0 to screen 200, which must clear the band's scrolled top (200),
  // not its unscrolled one (400).
  const section = { ...open, topOffset: 400, pileupHeight: 1000 }
  const empty: HighlightSection = {
    groupKey: 'empty',
    laidOutPileupMap: { get: () => undefined },
    topOffset: 0,
    pileupHeight: 0,
  }
  expect(
    run(['read0'], section, { sections: [empty, section], scrollTop: 200 }),
  ).toEqual([{ left: 1, top: 200, width: 5, height: 10, strong: false }])
})

test('ungrouped, a row scrolling under the sticky coverage band is clipped to the band', () => {
  expect(run(['read0'], open, { scrollTop: 3 })).toEqual([
    { left: 1, top: 100, width: 5, height: 7, strong: false },
  ])
})
