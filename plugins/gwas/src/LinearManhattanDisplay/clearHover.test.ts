import { manhattanFixture } from './manhattanFixture.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { ManhattanHit } from './findManhattanHit.ts'

// The hover is the instance under the pointer when it last moved. A painted
// canvas fires neither mousemove nor mouseleave when the content moves under a
// stationary cursor, so without an explicit clear the tooltip keeps naming a
// SNP that has moved out from under it. Both axes are pinned because a
// locstring or side-scroll pan moves offsetPx without touching bpPerPx — the
// case a zoom-only guard misses.
const hit: ManhattanHit = {
  refName: 'ctgA',
  start: 100,
  end: 101,
  score: 9,
  r2: undefined,
  regionIndex: 0,
  instance: 0,
}

describe('LinearManhattanDisplay clears its hover when the content moves', () => {
  it('clears on a pan that changes offsetPx alone', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    display.setHoveredFeature(hit)
    expect(display.hoveredFeature).toBeDefined()

    view.scrollTo(view.offsetPx + 100)

    expect(display.hoveredFeature).toBeUndefined()
  })

  it('clears on a zoom', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    display.setHoveredFeature(hit)
    expect(display.hoveredFeature).toBeDefined()

    // zoom IN: the harness opens at showAllRegions, i.e. already at
    // maxBpPerPx, so zooming out is clamped to a no-op
    view.zoomTo(view.bpPerPx / 2)

    expect(display.hoveredFeature).toBeUndefined()
  })

  it('leaves the hover alone while the viewport is still', () => {
    // the reaction skips its initial run, so merely setting a hover must not
    // clear it — as an autorun reading hover state it would have
    const { display } = createTestEnvironment().createDisplay()
    display.setHoveredFeature(hit)
    expect(display.hoveredFeature).toBeDefined()
  })
})

describe('the hovered point lights as a ring', () => {
  it('is the glyph box grown to the ring radius, inset by the plot top', () => {
    const { display } = createTestEnvironment().createDisplay()
    display.setRpcData(
      0,
      manhattanFixture({ x: [100, 200], y: [5, 8], indexFound: true }),
      { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 10_000 },
    )
    expect(display.hoverInk).toEqual([])
    display.setHoveredFeature({ ...hit, instance: 1 })
    const [ring] = display.hoverInk
    const r = Math.max(6, display.scatterPointSize / 2 + 4)
    expect(ring).toMatchObject({ width: 2 * r, height: 2 * r })
    expect(display.highlightStyle).toBe('ring')
    display.clearHoveredFeature()
    expect(display.hoverInk).toEqual([])
  })
})
