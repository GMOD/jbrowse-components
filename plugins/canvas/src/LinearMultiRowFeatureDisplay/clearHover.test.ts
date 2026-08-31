import { createTestEnvironment } from './testEnv.ts'

import type { MultiRowHit } from './model.ts'

// The painting is a sticky canvas: nothing in the DOM travels with a block, so
// when the content moves and the pointer doesn't, the browser fires no
// `mousemove` and no `mouseleave`. The component's handlers therefore cover only
// the axis where the *pointer* is what moved, and a stored `hoveredFeature`
// survives every other one — leaving the tooltip and `MultiRowHoverHighlight`
// describing a block that has scrolled out from under the cursor.
//
// Four axes, not one. Three move the content: zoom is the obvious one,
// `offsetPx` moves on a side-scroll or a locstring pan with no pointer event at
// all, and `scrollTop` is the display's own. The fourth removes it —
// `regionTooLarge` replaces the whole subtree with the banner. Same rule and
// same installer as alignments, canvas features, Manhattan and the wiggle family
// — see `installClearHoverOnViewportChange`, and ARCHITECTURE.md "Don't
// **store** a hover without clearing it on viewport change".
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

// The third axis, covered but currently inert *here*: this display grows to its
// content rather than scrolling a fixed viewport (ROW_HEIGHT_AND_FIT.md, "canvas
// is the exception"), so it overrides no `scrollableHeight`, renders no
// `VerticalScrollbar`, and `scrollTop` stays 0 in practice. Kept because the
// axis is one `scrollableHeight` override away from being live, and because the
// installer is shared — this asserts what the other row displays depend on.
test('the display scrolling under the cursor clears the hover', () => {
  const { display } = hovering()
  display.setScrollTop(40)
  expect(display.hoveredFeature).toBeUndefined()
})

// The fourth axis, and the one this display never had. Nothing draws the stale
// hover while the banner is up; Force load brings the subtree back and
// `MultiRowHoverHighlight`, positioned from the layout rather than the pointer,
// paints a box on a block the cursor is nowhere near.
test('the too-large banner clears the hover', () => {
  const { display } = hovering()
  display.setByteEstimate({
    bytes: 500_000_000,
    viewport: display.gateViewport!,
  })
  expect(display.regionTooLarge).toBe(true)
  expect(display.hoveredFeature).toBeUndefined()
})

test('force load releasing the banner clears it too', () => {
  const { display } = hovering()
  display.setByteEstimate({
    bytes: 500_000_000,
    viewport: display.gateViewport!,
  })
  display.setHoveredFeature(HIT)

  display.setForceLoadTrack(true)
  expect(display.regionTooLarge).toBe(false)
  expect(display.hoveredFeature).toBeUndefined()
})

// The reaction reads hover state in its effect to skip a no-op clear. As an
// autorun that read would be a dependency, so *setting* a hover would re-fire
// the body and clear it again immediately — a hover that can never be set.
test('setting a hover does not clear it', () => {
  const { display } = hovering()
  expect(display.hoveredFeature).toEqual(HIT)
})
