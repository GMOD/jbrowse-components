import { setConf } from '@jbrowse/core/configuration'
import { fireEvent, render, screen } from '@testing-library/react'

import {
  DEFAULT_VARIANT_LANE_HEIGHT,
  MIN_VARIANT_LANE_HEIGHT,
} from '../shared/variantTopBands.ts'
import VariantLaneOverlay from './components/VariantLaneOverlay.tsx'
import { createTestEnvironment } from './testEnv.ts'

function laneDisplay() {
  const { display } = createTestEnvironment().createDisplay()
  display.setShowVariantLane(true)
  return display
}

function drag(handle: HTMLElement, dy: number) {
  fireEvent.pointerDown(handle, { clientY: 0, pointerId: 1 })
  fireEvent.pointerMove(handle, { clientY: dy, pointerId: 1 })
  fireEvent.pointerUp(handle, { clientY: dy, pointerId: 1 })
}

test('a drag on the lane seam lands on the height slot', () => {
  const display = laneDisplay()
  render(<VariantLaneOverlay model={display} />)

  drag(screen.getByTestId('variant_lane_resize_handle'), 30)

  expect(display.variantLaneHeight).toBe(DEFAULT_VARIANT_LANE_HEIGHT + 30)
  expect(display.topBands.laneHeight).toBe(DEFAULT_VARIANT_LANE_HEIGHT + 30)
})

test('a lane dragged shut stops at the floor and stays grabbable', () => {
  const display = laneDisplay()
  render(<VariantLaneOverlay model={display} />)

  drag(screen.getByTestId('variant_lane_resize_handle'), -500)

  expect(display.variantLaneHeight).toBe(MIN_VARIANT_LANE_HEIGHT)
  expect(screen.getByTestId('variant_lane_resize_handle')).toBeTruthy()
})

test('a slot above the ceiling drags from the reserved height, not the slot', () => {
  const display = laneDisplay()
  setConf(display, 'variantLaneHeight', 500)
  render(<VariantLaneOverlay model={display} />)

  drag(screen.getByTestId('variant_lane_resize_handle'), -10)

  expect(display.variantLaneHeight).toBe(display.topBands.laneHeight)
  expect(display.topBands.laneHeight).toBe(110)
})

test('a lane that is off has no handle', () => {
  const { display } = createTestEnvironment().createDisplay()
  render(<VariantLaneOverlay model={display} />)

  expect(screen.queryByTestId('variant_lane_resize_handle')).toBeNull()
})
