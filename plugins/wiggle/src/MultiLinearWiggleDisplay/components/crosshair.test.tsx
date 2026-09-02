import { act, fireEvent, render, waitFor } from '@testing-library/react'

import { createTestEnvironment, makeMultiWiggleData } from '../testEnv.ts'
import MultiWiggleComponent from './MultiWiggleComponent.tsx'

// A mounted display whose fetch has landed on two sources with no bins in them,
// so any pointer over the plot has no feature under it.
async function loadedDisplay() {
  const env = createTestEnvironment()
  env.mockRpcCall.mockResolvedValue(makeMultiWiggleData('a', 'b'))
  const { display } = env.createDisplay()

  render(<MultiWiggleComponent model={display} />)
  await waitFor(() => {
    expect(display.numSources).toBe(2)
  })
  return display
}

// The pointer measurement is rAF-coalesced, so the move needs a frame before
// anything reads it.
async function hoverAt(x: number, y: number) {
  await act(async () => {
    fireEvent.mouseMove(
      document.querySelector('[data-testid="multi-wiggle-display"]')!,
      { clientX: x, clientY: y },
    )
    await new Promise(resolve => setTimeout(resolve, 60))
  })
}

// `Crosshairs` draws the genomic guide as the one full-height vertical line,
// at the pointer's x. jsdom measures every box at the origin, so client x is
// container x.
function fullHeightGuides(height: number) {
  return [...document.querySelectorAll('line')].filter(
    line =>
      line.getAttribute('x1') === line.getAttribute('x2') &&
      line.getAttribute('y1') === '0' &&
      line.getAttribute('y2') === String(height),
  )
}

// The crosshair used to be gated on `hoveredFeature`, which drops it over every
// base with no bin — exactly where the row guide is needed to say which row
// the cursor is on. It is drawn for the pointer.
test('the crosshair draws for a pointer over a base with no feature', async () => {
  const display = await loadedDisplay()
  const x = 300
  expect(x).toBeLessThan(display.canvasWidthPx)

  await hoverAt(x, 20)

  expect(display.hoveredFeature).toBeUndefined()
  const guides = fullHeightGuides(display.height)
  expect(guides).toHaveLength(1)
  expect(guides[0]!.getAttribute('x1')).toBe(String(x))
}, 30000)

test('no pointer, no crosshair', async () => {
  const display = await loadedDisplay()

  expect(fullHeightGuides(display.height)).toHaveLength(0)
}, 30000)
