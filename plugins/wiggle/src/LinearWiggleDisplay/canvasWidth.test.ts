import { createTestEnvironment } from './testEnv.ts'

// The canvas a display renders into is the TRACK box, not the viewport:
// TrackRenderingContainer insets its rendering component by the 2px track
// outline and applies `contain: strict`, so a `view.width`-wide canvas overhangs
// its own container and the browser clips the overhang away. It renders almost
// identically, which is how MAF drifted onto `view.width` and nothing caught it
// — this is here so the next display to copy the wrong neighbour does not
// repeat that. The invariant lives on MultiRegionDisplayMixin's `canvasWidthPx`;
// wiggle is one of the displays that reads it.

test('the canvas box is the viewport inset by the track outline', () => {
  const { view, display } = createTestEnvironment().createDisplay()

  expect(view.width).toBe(800)
  expect(view.showTrackOutlines).toBe(true)
  expect(display.canvasWidthPx).toBe(798)
})

// Not a hardcoded `width - 2`: with the outline off there is nothing to inset
// for, and a display that subtracted anyway would undershoot its container.
test('and follows the outline setting rather than pinning the inset', () => {
  const { view, display } = createTestEnvironment().createDisplay()

  view.setShowTrackOutlines(false)

  expect(display.canvasWidthPx).toBe(800)
  expect(display.canvasWidthPx).toBe(view.width)
})

test('the width handed to the renderer is that box', () => {
  const { display } = createTestEnvironment().createDisplay()

  expect(display.renderState.canvasWidth).toBe(display.canvasWidthPx)
})
