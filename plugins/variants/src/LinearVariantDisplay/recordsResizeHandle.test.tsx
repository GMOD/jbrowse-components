import ChromeLegend from '@jbrowse/display-kit/ChromeLegend'
import { TrackOverlaySlot } from '@jbrowse/display-ui'
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

  expect(display.recordsMaxHeight).toBe(natural - 30)
  expect(display.topBands.recordsHeight).toBe(natural - 30)
})

// A band as tall as its stack cannot grow, and a drag down must not lower the
// cap to the stack, which a later, taller stack would then be squeezed under.
test('a drag down on a band shorter than its cap keeps the cap', () => {
  const { display } = recordsDisplayAt(KIT, 51)
  const natural = display.topBands.recordsHeight
  const cap = display.recordsMaxHeight
  expect(natural).toBeLessThan(cap)
  render(<RecordsBandOverlay model={display} />)

  drag(screen.getByTestId('records_band_resize_handle'), 20)

  expect(display.recordsMaxHeight).toBe(cap)
  expect(display.topBands.recordsHeight).toBe(natural)
})

test('a drag down on a band at its cap raises the cap', () => {
  const { display } = recordsDisplayAt(KIT, 51, { maxHeight: 30 })
  render(<RecordsBandOverlay model={display} />)

  drag(screen.getByTestId('records_band_resize_handle'), 20)

  expect(display.recordsMaxHeight).toBe(50)
  expect(display.topBands.recordsHeight).toBe(50)
})

test('a band dragged shut stops at the floor and stays grabbable', () => {
  const { display } = recordsDisplayAt(KIT, 51)
  render(<RecordsBandOverlay model={display} />)

  drag(screen.getByTestId('records_band_resize_handle'), -500)

  expect(display.recordsMaxHeight).toBe(MIN_RECORDS_HEIGHT)
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

// The key floats at the top of the records band, where a feature track's
// sits, whatever the band holds, rather than under it over the rows.
test('the key sits at the top of the band, beside a track label', () => {
  const keyTop = (show: boolean) => {
    const { display } = recordsDisplayAt(KIT, 51, { show })
    const { unmount } = render(
      <TrackOverlaySlot zIndex={1} labelBand={31}>
        <RecordsBandOverlay model={display} />
        <ChromeLegend model={display} />
      </TrackOverlaySlot>,
    )
    const top = screen.getByTestId('floating-legend').style.top
    unmount()
    return top
  }
  expect(keyTop(true)).toBe(keyTop(false))
})

test('a band that is off has no handle', () => {
  const { display } = createTestEnvironment().createDisplay()
  render(<RecordsBandOverlay model={display} />)

  expect(screen.queryByTestId('records_band_resize_handle')).toBeNull()
})
