import ChromeLegend from '@jbrowse/display-kit/ChromeLegend'
import { FLOATING_LEGEND_TOP_PX, TrackOverlaySlot } from '@jbrowse/display-ui'
import { fireEvent, render, screen } from '@testing-library/react'

import RecordsBandOverlay from './components/RecordsBandOverlay.tsx'
import { KIT, recordsDisplayAt } from './recordsBand.fixture.ts'
import { createTestEnvironment } from './testEnv.ts'
import { MIN_RECORDS_HEIGHT } from './variantTopBands.ts'

function drag(handle: HTMLElement, dy: number) {
  fireEvent.pointerDown(handle, { clientY: 0, pointerId: 1 })
  fireEvent.pointerMove(handle, { clientY: dy, pointerId: 1 })
  fireEvent.pointerUp(handle, { clientY: dy, pointerId: 1 })
}

test('a drag up on the seam caps the band below its stack', () => {
  const { display } = recordsDisplayAt(KIT, 51)
  const natural = display.topBands.recordsHeight
  render(<RecordsBandOverlay model={display} />)

  drag(screen.getByTestId('records_band_resize_handle'), -30)

  expect(display.recordsGrowMaxHeight).toBe(natural - 30)
  expect(display.topBands.recordsHeight).toBe(natural - 30)
})

// The cap sits above the stack, so the drag measures from the band drawn and
// a band cannot grow past what its records need.
test('a drag down past the stack sets the cap and leaves the band its stack', () => {
  const { display } = recordsDisplayAt(KIT, 51)
  const natural = display.topBands.recordsHeight
  render(<RecordsBandOverlay model={display} />)

  drag(screen.getByTestId('records_band_resize_handle'), 20)

  expect(display.recordsGrowMaxHeight).toBe(natural + 20)
  expect(display.topBands.recordsHeight).toBe(natural)
})

test('a band dragged shut stops at the floor and stays grabbable', () => {
  const { display } = recordsDisplayAt(KIT, 51)
  render(<RecordsBandOverlay model={display} />)

  drag(screen.getByTestId('records_band_resize_handle'), -500)

  expect(display.recordsGrowMaxHeight).toBe(MIN_RECORDS_HEIGHT)
  expect(screen.getByTestId('records_band_resize_handle')).toBeTruthy()
})

// The handle is `width: 100%` of a box whose children are all absolute, so
// the box carries the band's width or the seam is 0px wide and ungrabbable.
test('the seam spans the band', () => {
  const { display } = recordsDisplayAt(KIT, 51)
  render(<RecordsBandOverlay model={display} />)

  expect(screen.getByTestId('records_band_box').style.width).toBe(
    `${display.canvasWidthPx}px`,
  )
})

// The key and the band share the display box's origin, and the key sits one
// inset under the band's bottom edge even beside an in-flow track label, which
// it would otherwise climb into and back over the band.
test('the key sits an inset under the band, beside a track label', () => {
  const { display } = recordsDisplayAt(KIT, 51)
  render(
    <TrackOverlaySlot zIndex={1} labelBand={31}>
      <RecordsBandOverlay model={display} />
      <ChromeLegend model={display} />
    </TrackOverlaySlot>,
  )
  const band = screen.getByTestId('records_band_box').style
  expect(screen.getByTestId('floating-legend').style.top).toBe(
    `${Number.parseFloat(band.top) + Number.parseFloat(band.height) + FLOATING_LEGEND_TOP_PX}px`,
  )
})

test('a band that is off has no handle', () => {
  const { display } = createTestEnvironment().createDisplay()
  render(<RecordsBandOverlay model={display} />)

  expect(screen.queryByTestId('records_band_resize_handle')).toBeNull()
})
