import { stageByteEstimate } from '@jbrowse/display-test-utils'

import { createTestEnvironment } from './testEnv.ts'

import type { MultiRowHit } from './model.ts'

// The painting is a sticky canvas: nothing in the DOM travels with a block, so
// when the content moves and the pointer does not, the browser fires no
// `mousemove` and no `mouseleave`, and a stored `hoveredFeature` survives to
// describe a block that has scrolled out from under the cursor.
const HIT: MultiRowHit = {
  id: 'f1',
  regionIndex: 0,
  rowName: 'a',
  name: 'block',
  refName: 'ctgA',
  start: 100,
  end: 200,
}

function hovering() {
  const { display, view } = createTestEnvironment().createDisplay()
  display.setHoveredFeature(HIT)
  expect(display.hoveredFeature).toBeDefined()
  return { display, view }
}

test('a zoom clears the hover', () => {
  const { display, view } = hovering()
  view.zoomTo(view.bpPerPx * 2)
  expect(display.hoveredFeature).toBeUndefined()
})

test('a pan clears the hover, with no zoom change', () => {
  const { display, view } = hovering()
  const { bpPerPx } = view
  view.horizontalScroll(100)
  expect(view.bpPerPx).toBe(bpPerPx)
  expect(display.hoveredFeature).toBeUndefined()
})

// Covered but inert here: this display grows to its content rather than
// scrolling, so `scrollTop` stays 0 — the installer is shared, so this asserts
// what the other row displays depend on.
test('the display scrolling under the cursor clears the hover', () => {
  const { display } = hovering()
  display.setScrollTop(40)
  expect(display.hoveredFeature).toBeUndefined()
})

// Nothing draws the stale hover while the banner is up, but Force load brings
// the subtree back and the highlight, positioned from the layout rather than the
// pointer, paints a box on a block the cursor is nowhere near.
test('the too-large banner clears the hover', () => {
  const { display } = hovering()
  stageByteEstimate(display, 500_000_000)
  expect(display.regionTooLarge).toBe(true)
  expect(display.hoveredFeature).toBeUndefined()
})

test('force load releasing the banner clears it too', () => {
  const { display } = hovering()
  stageByteEstimate(display, 500_000_000)
  display.setHoveredFeature(HIT)

  display.setForceLoadTrack(true)
  expect(display.regionTooLarge).toBe(false)
  expect(display.hoveredFeature).toBeUndefined()
})

// The reaction reads hover state in its effect to skip a no-op clear. As an
// autorun that read would be a dependency, so setting a hover would re-fire the
// body and clear it again immediately.
test('setting a hover does not clear it', () => {
  const { display } = hovering()
  expect(display.hoveredFeature).toEqual(HIT)
})
