import { isRibbonCulled } from './syntenyRibbonPath.ts'

import type { ProjectedCorners } from './syntenyRibbonPath.ts'

const VIEW_WIDTH = 1000
const OVERDRAW = 1000

// A ribbon from (top sx1..sx2) to (bottom sx3..sx4) in screen px.
function corners(
  sx1: number,
  sx2: number,
  sx3: number,
  sx4: number,
): ProjectedCorners {
  return { sx1, sx2, sx3, sx4 }
}

// A marker is a point on each axis.
const marker = (top: number, bottom: number) =>
  corners(top, top, bottom, bottom)

describe('isRibbonCulled', () => {
  test('a ribbon with one edge past the overdraw band is culled', () => {
    // top edge at -1500, well outside; bottom edge mid-view
    expect(
      isRibbonCulled(corners(-1500, -1400, 400, 500), VIEW_WIDTH, OVERDRAW),
    ).toBe(true)
  })

  test('a ribbon inside the band is kept', () => {
    expect(
      isRibbonCulled(corners(100, 200, 300, 400), VIEW_WIDTH, OVERDRAW),
    ).toBe(false)
  })

  // The inversion case. A crossed ribbon pulls a tick's two ends apart by up to
  // the frame width, so panning puts one end outside the band while the other
  // is still on screen — and the per-edge rule then deleted the leading half of
  // the fan while the ribbon under it stayed drawn.
  test('a marker with one end outside the band is kept while the other is on screen', () => {
    expect(isRibbonCulled(marker(-1500, 500), VIEW_WIDTH, OVERDRAW, true)).toBe(
      false,
    )
    expect(isRibbonCulled(marker(500, 2600), VIEW_WIDTH, OVERDRAW, true)).toBe(
      false,
    )
  })

  test('the same marker geometry as a ribbon is still culled per edge', () => {
    expect(
      isRibbonCulled(marker(-1500, 500), VIEW_WIDTH, OVERDRAW, false),
    ).toBe(true)
  })

  test('a marker with both ends outside the band is culled', () => {
    expect(
      isRibbonCulled(marker(-1500, -1200), VIEW_WIDTH, OVERDRAW, true),
    ).toBe(true)
    expect(isRibbonCulled(marker(2500, 3000), VIEW_WIDTH, OVERDRAW, true)).toBe(
      true,
    )
  })
})
