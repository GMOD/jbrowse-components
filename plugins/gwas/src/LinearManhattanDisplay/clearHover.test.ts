import { createTestEnvironment } from './testEnv.ts'

import type { ManhattanHit } from './findManhattanHit.ts'

// `HoverHighlight` is a DOM ring positioned from the hit's screenX/screenY,
// captured when the pointer last moved. A painted canvas fires neither mousemove
// nor mouseleave when the content moves under a stationary cursor, so without an
// explicit clear the ring stays parked on empty space while the tooltip beside
// it names a SNP that has moved. Both axes are pinned because a locstring or
// side-scroll pan moves offsetPx without touching bpPerPx — the case a
// zoom-only guard misses.
const hit: ManhattanHit = {
  refName: 'ctgA',
  start: 100,
  end: 101,
  score: 9,
  r2: undefined,
  screenX: 250,
  screenY: 40,
}

describe('LinearManhattanDisplay clears its hover when the content moves', () => {
  it('clears on a pan that changes offsetPx alone', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    display.setFeatureUnderMouse(hit)
    expect(display.featureUnderMouse).toBeDefined()

    view.scrollTo(view.offsetPx + 100)

    expect(display.featureUnderMouse).toBeUndefined()
  })

  it('clears on a zoom', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    display.setFeatureUnderMouse(hit)
    expect(display.featureUnderMouse).toBeDefined()

    // zoom IN: the harness opens at showAllRegions, i.e. already at
    // maxBpPerPx, so zooming out is clamped to a no-op
    view.zoomTo(view.bpPerPx / 2)

    expect(display.featureUnderMouse).toBeUndefined()
  })

  it('leaves the hover alone while the viewport is still', () => {
    // the reaction skips its initial run, so merely setting a hover must not
    // clear it — as an autorun reading hover state it would have
    const { display } = createTestEnvironment().createDisplay()
    display.setFeatureUnderMouse(hit)
    expect(display.featureUnderMouse).toBeDefined()
  })
})
