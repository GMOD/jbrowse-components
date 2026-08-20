import { render } from '@testing-library/react'

import OverlayCanvas from './OverlayCanvas.tsx'

// A canvas is a REPLACED element, so it takes its INTRINSIC size wherever CSS
// leaves width/height auto — and `prepareCanvas` sets that intrinsic size to the
// DPR-scaled backing store. An overlay positioned with `inset: 0` and no CSS
// size therefore lays out at twice the band on a retina display, drawing every
// mark at twice its x with the right half off the edge, and looking plausible
// while it does it. That is not hypothetical: the synteny off-screen-mate
// overlay shipped that way, hand-rolled, until a figure of it disagreed with the
// data behind it.
test('the canvas lays out at the size asked for, not at its backing store', () => {
  const { getByTestId } = render(
    <OverlayCanvas
      data-testid="overlay"
      width={800}
      height={100}
      draw={() => {}}
    />,
  )
  const canvas = getByTestId('overlay')
  expect(canvas.style.width).toBe('800px')
  expect(canvas.style.height).toBe('100px')
})

test('and stays out of the way of the hit test underneath it', () => {
  const { getByTestId } = render(
    <OverlayCanvas
      data-testid="overlay"
      width={800}
      height={100}
      draw={() => {}}
    />,
  )
  expect(getByTestId('overlay').style.pointerEvents).toBe('none')
})
