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

  // The inversion case. A crossed ribbon pulls a tick's two ends apart, so one
  // leaves the band while the other is still on screen — and the per-edge rule
  // then deleted the leading half of the fan while the ribbon under it stayed
  // drawn.
  //
  // A NARROWER OVERDRAW than the view is wide, because that is the configuration
  // in which the hull rule and the travel cap below both have something to say: a
  // tick reaching past a band padded by a whole view width has already travelled
  // further than the cap allows, so at the 1000px default the hull rule's cases
  // are the cap's cases. The overdraw slider goes well below the view width.
  const NARROW_OVERDRAW = 200

  test('a marker with one end outside the band is kept while the other is on screen', () => {
    expect(
      isRibbonCulled(marker(-400, 500), VIEW_WIDTH, NARROW_OVERDRAW, true),
    ).toBe(false)
    expect(
      isRibbonCulled(marker(500, 1400), VIEW_WIDTH, NARROW_OVERDRAW, true),
    ).toBe(false)
  })

  test('the same marker geometry as a ribbon is still culled per edge', () => {
    expect(
      isRibbonCulled(marker(-400, 500), VIEW_WIDTH, NARROW_OVERDRAW, false),
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

  // The travel cap, which is the marker rule that replaces the per-edge test
  // rather than an addition to the hull one. Asked here (and in the shader's
  // isCulled) rather than where the worker emits the tick, because the distance
  // moves with the two views' relative pan and they drift by up to a pan buffer
  // without refetching: a fetch-time answer left near-horizontal ticks on screen
  // after a one-row pan, and kept dropped ones dropped after a pan brought their
  // ends together.
  test('a marker travelling further than the view is wide is dropped', () => {
    expect(isRibbonCulled(marker(100, 1200), VIEW_WIDTH, OVERDRAW, true)).toBe(
      true,
    )
  })

  test('a marker travelling less than a view width is kept', () => {
    expect(isRibbonCulled(marker(100, 900), VIEW_WIDTH, OVERDRAW, true)).toBe(
      false,
    )
  })

  // The case the two marker rules disagree on, and the cap wins: both ends
  // outside the band in OPPOSITE directions is the shape the hull rule exists to
  // keep, and it can only be reached by travelling at least the width of the
  // padded band.
  test('a marker straddling the whole band travels too far to be kept', () => {
    expect(
      isRibbonCulled(marker(-1500, 2500), VIEW_WIDTH, OVERDRAW, true),
    ).toBe(true)
  })
})
