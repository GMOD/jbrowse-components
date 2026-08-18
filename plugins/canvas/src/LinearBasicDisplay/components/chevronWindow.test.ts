import {
  chevronCount,
  chevronOffset,
} from '../passes/shaders/chevron.js.generated.ts'
import { visibleChevronRange } from './Canvas2DFeatureRenderer.ts'
import { CHEVRON_W_PX } from './sharedRendererConstants.ts'

const HALF_W = CHEVRON_W_PX / 2

// The window's whole contract: iterate exactly the chevrons whose arms reach the
// canvas. `drawLines` positions chevron `c` at `minX + chevronOffset(…, c)` and
// strokes ±CHEVRON_W_PX/2 around it, so that is what "on screen" has to mean.
function inkOnCanvas(cx: number, canvasWidth: number) {
  return cx + HALF_W >= 0 && cx - HALF_W <= canvasWidth
}

function centers(lineWidthPx: number, minX: number) {
  const total = chevronCount(lineWidthPx)
  return Array.from({ length: total }, (_, c) => ({
    c,
    cx: minX + chevronOffset(lineWidthPx, total, c),
  }))
}

const CANVAS_WIDTH = 800
// A line long enough to hold many chevrons, placed so it runs off the left, sits
// wholly inside, straddles the right edge, and finally misses the canvas either
// way.
const OFFSETS = [-5000, -400, -2, 0, 1, 300, 795, 800, 1200, -1e6]

test('the window admits exactly the chevrons that put ink on the canvas', () => {
  const lineWidthPx = 1000
  const total = chevronCount(lineWidthPx)
  const spacing = chevronOffset(lineWidthPx, total, 0)
  for (const minX of OFFSETS) {
    const [first, last] = visibleChevronRange(
      minX,
      spacing,
      total,
      CANVAS_WIDTH,
    )
    const drawn = new Set<number>()
    for (let c = first; c <= last; c++) {
      drawn.add(c)
    }
    for (const { c, cx } of centers(lineWidthPx, minX)) {
      // Iterating one extra chevron just off-screen is free (the stroke is
      // clipped); skipping one that would have shown is the bug this pins, so
      // only the one direction is asserted as an equality.
      if (inkOnCanvas(cx, CANVAS_WIDTH)) {
        expect(drawn.has(c)).toBe(true)
      }
    }
  }
})

test('a chevron straddling a canvas edge is drawn, not skipped', () => {
  const lineWidthPx = 1000
  const total = chevronCount(lineWidthPx)
  const spacing = chevronOffset(lineWidthPx, total, 0)
  // Put chevron 0 one pixel left of the canvas: its apex/arms still reach x >= 0.
  const minX = -spacing - 1
  expect(visibleChevronRange(minX, spacing, total, CANVAS_WIDTH)[0]).toBe(0)
  // And the same at the right edge.
  const lastCx = spacing * total
  const rightMinX = CANVAS_WIDTH + 1 - lastCx
  expect(visibleChevronRange(rightMinX, spacing, total, CANVAS_WIDTH)[1]).toBe(
    total - 1,
  )
})

test('a line entirely off the canvas yields an empty range', () => {
  const lineWidthPx = 1000
  const total = chevronCount(lineWidthPx)
  const spacing = chevronOffset(lineWidthPx, total, 0)
  const [first, last] = visibleChevronRange(-1e6, spacing, total, CANVAS_WIDTH)
  expect(first).toBeGreaterThan(last)
})

test('the window never runs past the chevrons that exist', () => {
  for (const lineWidthPx of [20, 40, 100, 1000, 1e6]) {
    const total = chevronCount(lineWidthPx)
    const spacing = chevronOffset(lineWidthPx, total, 0)
    for (const minX of OFFSETS) {
      const [first, last] = visibleChevronRange(
        minX,
        spacing,
        total,
        CANVAS_WIDTH,
      )
      expect(first).toBeGreaterThanOrEqual(0)
      expect(last).toBeLessThanOrEqual(total - 1)
    }
  }
})
