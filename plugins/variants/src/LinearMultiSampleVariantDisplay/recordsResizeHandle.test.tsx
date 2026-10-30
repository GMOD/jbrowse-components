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

test('a band that is off has no handle', () => {
  const { display } = createTestEnvironment().createDisplay()
  render(<RecordsBandOverlay model={display} />)

  expect(screen.queryByTestId('records_band_resize_handle')).toBeNull()
})
