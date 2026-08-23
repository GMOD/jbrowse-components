import { blockScreenRect } from './blockScreenRect.ts'
import { MULTI_ROW_MIN_CELL_PX } from './rowBand.ts'

import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

// 100bp over 100px, so 1bp = 1px
const block: RenderBlock = {
  displayedRegionIndex: 0,
  start: 100,
  end: 200,
  screenStartPx: 0,
  screenEndPx: 100,
  reversed: false,
}

type Args = Parameters<typeof blockScreenRect>[0]

function rect(overrides: Partial<Args> = {}) {
  return blockScreenRect({
    hit: { regionIndex: 0, rowIndex: 2, start: 120, end: 130 },
    blocks: [block],
    rowHeight: 10,
    rowProportion: 1,
    ...overrides,
  })
}

test('box spans the block on its row', () => {
  expect(rect()).toEqual({ left: 20, width: 10, top: 20, height: 10 })
})

test('rowProportion insets the box the way the painter insets the block', () => {
  expect(rect({ rowProportion: 0.5 })).toEqual({
    left: 20,
    width: 10,
    top: 22.5,
    height: 5,
  })
})

test('a reversed block mirrors the box instead of running backwards', () => {
  expect(rect({ blocks: [{ ...block, reversed: true }] })).toEqual({
    left: 70,
    width: 10,
    top: 20,
    height: 10,
  })
})

test('the box clamps to the region rather than bleeding past its edge', () => {
  expect(rect({ hit: rowHit({ start: 180, end: 400 }) })).toEqual({
    left: 80,
    width: 20,
    top: 20,
    height: 10,
  })
})

// A block drawn entirely in the previous region merely touches this one's edge; a
// box there would be a phantom stripe for something painted elsewhere
test('no box where the block contributes no pixels', () => {
  expect(rect({ hit: rowHit({ start: 50, end: 100 }) })).toBeUndefined()
})

test('no box while the hovered region is off screen', () => {
  expect(rect({ hit: rowHit({ regionIndex: 1 }) })).toBeUndefined()
})

// One px wider than the block's own floor, so the border reads around a
// sub-pixel block rather than replacing it
test('a sub-pixel block keeps a visible box', () => {
  expect(rect({ hit: rowHit({ end: 120.2 }) })?.width).toBe(
    MULTI_ROW_MIN_CELL_PX + 1,
  )
})

// A sub-pixel block widens away from its START edge, which is the right edge on a
// reversed region — the same anchoring spanLeft gives the painted block
test('the widened box anchors where the painter anchors it', () => {
  const forward = rect({ hit: rowHit({ end: 120.2 }) })
  const reversed = rect({
    hit: rowHit({ end: 120.2 }),
    blocks: [{ ...block, reversed: true }],
  })
  expect(forward?.left).toBe(20)
  expect(reversed?.left).toBe(80 - (MULTI_ROW_MIN_CELL_PX + 1))
})

function rowHit(overrides: Partial<Args['hit']>) {
  return { regionIndex: 0, rowIndex: 2, start: 120, end: 130, ...overrides }
}
