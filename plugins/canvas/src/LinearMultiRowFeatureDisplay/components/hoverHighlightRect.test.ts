import { hoverHighlightRect } from './hoverHighlightRect.ts'

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

const hit = { regionIndex: 0, rowIndex: 2, start: 120, end: 130 }

test('box spans the feature on its row', () => {
  expect(
    hoverHighlightRect({
      hit,
      blocks: [block],
      rowHeight: 10,
      rowProportion: 1,
    }),
  ).toEqual({ left: 20, width: 10, top: 20, height: 10 })
})

test('rowProportion insets the box the way the render paths inset the block', () => {
  expect(
    hoverHighlightRect({
      hit,
      blocks: [block],
      rowHeight: 10,
      rowProportion: 0.5,
    }),
  ).toEqual({ left: 20, width: 10, top: 22.5, height: 5 })
})

test('a reversed block mirrors the box instead of running backwards', () => {
  expect(
    hoverHighlightRect({
      hit,
      blocks: [{ ...block, reversed: true }],
      rowHeight: 10,
      rowProportion: 1,
    }),
  ).toEqual({ left: 70, width: 10, top: 20, height: 10 })
})

test('the box clamps to the region rather than bleeding past its edge', () => {
  expect(
    hoverHighlightRect({
      hit: { ...hit, start: 180, end: 400 },
      blocks: [block],
      rowHeight: 10,
      rowProportion: 1,
    }),
  ).toEqual({ left: 80, width: 20, top: 20, height: 10 })
})

// A feature drawn entirely in the previous region merely touches this one's
// edge; a box there would be a phantom stripe for something painted elsewhere
test('no box where the feature contributes no pixels', () => {
  expect(
    hoverHighlightRect({
      hit: { ...hit, start: 50, end: 100 },
      blocks: [block],
      rowHeight: 10,
      rowProportion: 1,
    }),
  ).toBeUndefined()
})

test('no box while the hovered region is off screen', () => {
  expect(
    hoverHighlightRect({
      hit: { ...hit, regionIndex: 1 },
      blocks: [block],
      rowHeight: 10,
      rowProportion: 1,
    }),
  ).toBeUndefined()
})

test('a sub-pixel feature keeps a visible box', () => {
  const rect = hoverHighlightRect({
    hit: { ...hit, start: 120, end: 120.2 },
    blocks: [block],
    rowHeight: 10,
    rowProportion: 1,
  })
  expect(rect?.width).toBe(2)
})
