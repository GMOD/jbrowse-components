import ChromeLegend from '@jbrowse/display-kit/ChromeLegend'
import { TrackOverlaySlot } from '@jbrowse/display-ui'
import { act, fireEvent, render, screen } from '@testing-library/react'

import RecordsBandOverlay from './components/RecordsBandOverlay.tsx'
import { KIT, recordsDisplayAt } from './recordsBand.fixture.ts'
import { createTestEnvironment } from './testEnv.ts'
import { MIN_RECORDS_HEIGHT } from './variantTopBands.ts'

function drag(handle: HTMLElement, dy: number) {
  fireEvent.pointerDown(handle, { clientY: 0, pointerId: 1 })
  fireEvent.pointerMove(handle, { clientY: dy, pointerId: 1 })
  fireEvent.pointerUp(handle, { clientY: dy, pointerId: 1 })
}

test('a drag up on the seam sets the band below its stack', () => {
  const { display } = recordsDisplayAt(KIT, 51)
  const natural = display.topBands.recordsHeight
  render(<RecordsBandOverlay model={display} />)

  drag(screen.getByTestId('records_band_resize_handle'), -30)

  expect(display.recordsHeight).toBe(natural - 30)
  expect(display.topBands.recordsHeight).toBe(natural - 30)
})

test('a drag down on the seam sets the band past its stack', () => {
  const { display } = recordsDisplayAt(KIT, 51)
  const natural = display.topBands.recordsHeight
  render(<RecordsBandOverlay model={display} />)

  drag(screen.getByTestId('records_band_resize_handle'), 20)

  expect(display.recordsHeight).toBe(natural + 20)
  expect(display.topBands.recordsHeight).toBe(natural + 20)
})

test('a band dragged shut stops at the floor and stays grabbable', () => {
  const { display } = recordsDisplayAt(KIT, 51)
  render(<RecordsBandOverlay model={display} />)

  drag(screen.getByTestId('records_band_resize_handle'), -500)

  expect(display.recordsHeight).toBe(MIN_RECORDS_HEIGHT)
  expect(screen.getByTestId('records_band_resize_handle')).toBeTruthy()
})

// a drag past the floor banks the pointer's travel, so the seam stays at the
// floor until the pointer comes back to it rather than growing the band from
// wherever the pointer turned
describe('a drag past the floor and back', () => {
  let frames: FrameRequestCallback[] = []
  const realRaf = window.requestAnimationFrame
  beforeEach(() => {
    frames = []
    window.requestAnimationFrame = cb => frames.push(cb)
  })
  afterEach(() => {
    window.requestAnimationFrame = realRaf
  })
  function moveTo(handle: HTMLElement, clientY: number) {
    fireEvent.pointerMove(handle, { clientY, pointerId: 1 })
    const pending = frames
    frames = []
    act(() => {
      for (const cb of pending) {
        cb(0)
      }
    })
  }

  test('keeps the seam under the pointer', () => {
    const { display } = recordsDisplayAt(KIT, 51)
    const natural = display.topBands.recordsHeight
    render(<RecordsBandOverlay model={display} />)
    const handle = screen.getByTestId('records_band_resize_handle')

    fireEvent.pointerDown(handle, { clientY: 0, pointerId: 1 })
    moveTo(handle, -500)
    expect(display.topBands.recordsHeight).toBe(MIN_RECORDS_HEIGHT)
    moveTo(handle, -400)
    expect(display.topBands.recordsHeight).toBe(MIN_RECORDS_HEIGHT)
    moveTo(handle, 10 - natural)
    expect(display.topBands.recordsHeight).toBe(10)
    fireEvent.pointerUp(handle, { clientY: 10 - natural, pointerId: 1 })
  })
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
