import { computeOverlayRect, overlayItemRect } from './highlightUtils.ts'

// 1000bp of region across 1000px of screen — 1bp per px, so bp and px read the
// same and the clamping is what the assertions are about.
const REGION = { start: 0, end: 1000, screenStartPx: 0, screenEndPx: 1000 }
const ROW = { topPx: 10, bottomPx: 20 }

describe('overlayItemRect', () => {
  test('maps a contained feature to its screen span', () => {
    expect(
      overlayItemRect({ startBp: 100, endBp: 200, ...ROW }, REGION),
    ).toEqual({ leftPx: 100, width: 100, topPx: 10, heightPx: 10 })
  })

  test('clamps a feature running past the region to the region edge', () => {
    expect(
      overlayItemRect({ startBp: 900, endBp: 5000, ...ROW }, REGION),
    ).toEqual({ leftPx: 900, width: 100, topPx: 10, heightPx: 10 })
  })

  test('drops a feature that only touches the region start', () => {
    // the shape at every displayed-region boundary: this feature is drawn (and
    // boxed) entirely in the PREVIOUS region, so a zero-width rect here becomes
    // a phantom stripe once computeOverlayRect adds padding + label overhang
    expect(
      overlayItemRect({ startBp: -500, endBp: 0, ...ROW }, REGION),
    ).toBeUndefined()
  })

  test('drops a feature that only touches the region end', () => {
    expect(
      overlayItemRect({ startBp: 1000, endBp: 1500, ...ROW }, REGION),
    ).toBeUndefined()
  })

  test('keeps a sub-pixel feature inside the region', () => {
    const rect = overlayItemRect(
      { startBp: 500, endBp: 500.01, ...ROW },
      REGION,
    )
    expect(rect?.leftPx).toBeCloseTo(500)
    expect(rect?.width).toBeGreaterThan(0)
  })

  test('keeps a zero-length feature, whose width is genuinely 0', () => {
    expect(
      overlayItemRect({ startBp: 500, endBp: 500, ...ROW }, REGION),
    ).toEqual({ leftPx: 500, width: 0, topPx: 10, heightPx: 10 })
  })

  test('drops a zero-length feature scrolled outside the region', () => {
    // a selected insertion panned out of view: both edges clamp to the same
    // region bound from the wrong side, so an unguarded rect has negative width
    expect(
      overlayItemRect({ startBp: -500, endBp: -500, ...ROW }, REGION),
    ).toBeUndefined()
    expect(
      overlayItemRect({ startBp: 1500, endBp: 1500, ...ROW }, REGION),
    ).toBeUndefined()
  })

  test('reversed region mirrors the span but keeps left < right', () => {
    expect(
      overlayItemRect(
        { startBp: 100, endBp: 200, ...ROW },
        { ...REGION, reversed: true },
      ),
    ).toEqual({ leftPx: 800, width: 100, topPx: 10, heightPx: 10 })
  })
})

describe('computeOverlayRect', () => {
  const rect = { leftPx: 100, topPx: 50, width: 30, heightPx: 10 }

  test('outsets the box by xPadding/yPadding and adds label extraWidth', () => {
    expect(computeOverlayRect(rect, 12, 2, 2)).toEqual({
      left: 98,
      top: 48,
      width: 46,
      height: 14,
    })
  })

  test('top-row feature: clamps top to 0 so the outset top border stays in view', () => {
    // topPx≈0 outset by 2 would place the top border at y=-2, clipped by
    // ScrollLockedOverlay's y=0 edge — clamp keeps it at 0
    const box = computeOverlayRect({ ...rect, topPx: 0 }, 0, 2, 2)
    expect(box.top).toBe(0)
  })

  test('top-row clamp keeps the bottom edge fixed', () => {
    const unclamped = computeOverlayRect(rect, 0, 2, 2)
    const topRow = computeOverlayRect({ ...rect, topPx: 0 }, 0, 2, 2)
    // bottom = top + height is (topPx - yPadding) + heightPx + 2*yPadding =
    // topPx + heightPx + yPadding; independent of the clamp
    expect(unclamped.top + unclamped.height).toBe(50 + 10 + 2)
    expect(topRow.top + topRow.height).toBe(0 + 10 + 2)
  })

  test('no padding is a plain rect passthrough', () => {
    expect(computeOverlayRect(rect, 0, 0, 0)).toEqual({
      left: 100,
      top: 50,
      width: 30,
      height: 10,
    })
  })
})
