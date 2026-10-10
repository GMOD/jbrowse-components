// The strand arrowhead is ink outside the read's bp span, so the body test
// alone left a hover on the tip reporting nothing — and on a reverse-strand
// read that tip sits BEFORE the read's start, which a screen-side test written
// for the forward case gets wrong on a reversed region. The hit test now asks
// readChevron.slang's own containment predicate, in bp, so both strands and
// both orientations are one case.
import {
  RC_FWD_STRAND,
  RC_PLAIN,
} from '../../shaders/slang/read.consts.generated.ts'
import { CHEVRON_PX } from '../../shaders/slang/readChevron.generated.ts'
import { chevronContains } from '../../shaders/slang/readChevron.js.generated.ts'
import { hitTestFeature } from './hitTest.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { CigarCoords, ResolvedBlock } from '../../shared/hitTestTypes.ts'
import type { ChevronFrame } from './mark.ts'

const FEATURE_HEIGHT = 10

// One read on row 0, in a block at 1 px/bp so a bp offset reads as px. A
// strand fill by default, so direction is informative and the arrowhead needs
// no minimum width.
function oneRead({
  start,
  end,
  strand,
  edgeFlags = 0b11,
  category = RC_FWD_STRAND,
}: {
  start: number
  end: number
  strand: number
  edgeFlags?: number
  category?: number
}): ResolvedBlock {
  const rpcData = {
    readPositions: new Uint32Array([start, end]),
    readYs: new Uint16Array([0]),
    readKeys: ['r'],
    readStrands: new Int8Array([strand]),
    readFlags: new Uint16Array([0]),
    readInterchrom: new Uint8Array([0]),
    readInsertSizes: new Float32Array([0]),
    segmentPositions: new Uint32Array([start, end]),
    segmentReadIndices: new Uint32Array([0]),
    segmentEdgeFlags: new Uint8Array([edgeFlags]),
    readColorCategories: new Uint8Array([category]),
  } as unknown as PileupDataResult
  return {
    rpcData,
    bpRange: [0, 200],
    blockStartPx: 0,
    blockWidth: 200,
    refName: 'chr1',
    reversed: false,
  }
}

function at(genomicPos: number, yWithinRow: number): CigarCoords {
  return {
    bpPerPx: 1,
    genomicPos,
    basePos: Math.floor(genomicPos),
    row: 0,
    adjustedY: yWithinRow,
    yWithinRow,
  }
}

const STRAND_SCHEME: ChevronFrame = {
  pxPerBp: 1,
  chainMode: false,
  featureHeight: FEATURE_HEIGHT,
}

const MID_ROW = FEATURE_HEIGHT / 2

test('a reverse-strand read is hit on the arrowhead before its start', () => {
  const block = oneRead({ start: 100, end: 160, strand: -1 })
  expect(hitTestFeature(block, at(96, MID_ROW), STRAND_SCHEME)).toEqual({
    id: 'r',
    index: 0,
  })
  expect(hitTestFeature(block, at(164, MID_ROW), STRAND_SCHEME)).toBeUndefined()
})

test('a forward-strand read is hit on the arrowhead past its end', () => {
  const block = oneRead({ start: 100, end: 160, strand: 1 })
  expect(hitTestFeature(block, at(164, MID_ROW), STRAND_SCHEME)).toEqual({
    id: 'r',
    index: 0,
  })
  expect(hitTestFeature(block, at(96, MID_ROW), STRAND_SCHEME)).toBeUndefined()
})

test('the arrowhead tapers: its corners past the edge are not ink', () => {
  const block = oneRead({ start: 100, end: 160, strand: 1 })
  // 4 px out the head is half its height, so mid-row hits and the row's top
  // row of pixels does not; past CHEVRON_PX nothing does.
  expect(hitTestFeature(block, at(164, MID_ROW), STRAND_SCHEME)).toBeDefined()
  expect(hitTestFeature(block, at(164, 0.5), STRAND_SCHEME)).toBeUndefined()
  expect(
    hitTestFeature(block, at(160 + CHEVRON_PX + 1, MID_ROW), STRAND_SCHEME),
  ).toBeUndefined()
})

test('no arrowhead, no hit: strand-less, region-clipped, or gated off', () => {
  expect(
    hitTestFeature(
      oneRead({ start: 100, end: 160, strand: 0 }),
      at(164, MID_ROW),
      STRAND_SCHEME,
    ),
  ).toBeUndefined()
  // A read whose start the region clipped has no first segment to cap.
  expect(
    hitTestFeature(
      oneRead({ start: 100, end: 160, strand: -1, edgeFlags: 0b10 }),
      at(96, MID_ROW),
      STRAND_SCHEME,
    ),
  ).toBeUndefined()
  // A plain-filled read narrower than CHEVRON_DIRLESS_MIN_WIDTH_PX draws no
  // arrowhead, and the same `showChevron` says so here.
  expect(
    hitTestFeature(
      oneRead({ start: 100, end: 120, strand: 1, category: RC_PLAIN }),
      at(124, MID_ROW),
      STRAND_SCHEME,
    ),
  ).toBeUndefined()
})

// The generated predicate against the triangle both painters place: the read's
// two corners on the capped edge and an apex CHEVRON_PX out at mid-row.
test('chevronContains is the triangle the painters trace', () => {
  const halfH = FEATURE_HEIGHT / 2
  for (let dx = -2; dx <= CHEVRON_PX + 2; dx += 0.25) {
    for (let dy = -halfH - 1; dy <= halfH + 1; dy += 0.25) {
      const inTriangle =
        dx >= 0 && Math.abs(dy) <= halfH * (1 - dx / CHEVRON_PX) + 1e-9
      expect({
        dx,
        dy,
        inside: chevronContains(dx, dy, FEATURE_HEIGHT),
      }).toEqual({ dx, dy, inside: inTriangle })
    }
  }
})

// Zoomed out past a bp per px, the painter floors a read at 1px grown away
// from its start, and the hover answers on that whole sliver.
test('a read narrower than a pixel answers across its painted 1px', () => {
  const block = oneRead({ start: 100, end: 101, strand: 1, category: RC_PLAIN })
  const frame = { ...STRAND_SCHEME, pxPerBp: 1 / 50 }
  const zoomedOut = (genomicPos: number) => ({
    ...at(genomicPos, MID_ROW),
    bpPerPx: 50,
  })
  expect(hitTestFeature(block, zoomedOut(140), frame)?.id).toBeDefined()
  expect(hitTestFeature(block, zoomedOut(151), frame)).toBeUndefined()
  expect(hitTestFeature(block, zoomedOut(99), frame)).toBeUndefined()
})
