import { fireEvent, waitFor } from '@testing-library/react'

import { createView, doBeforeEach, expectCanvasMatch, hts, pv, setup } from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

test('open a bigwig track and change posColor', async () => {
  const { view, findByTestId } = await createView()
  view.setNewView(5, 0)

  // Open the track
  fireEvent.click(await findByTestId(hts('volvox_microarray'), {}, { timeout: 20000 }))

  // Wait for the track to render
  const canvas1 = await findByTestId(pv('1..4000-0'), {}, { timeout: 20000 })
  expectCanvasMatch(canvas1)

  // Get the display model and change color
  const track = view.tracks[0]!
  const display = track.displays[0] as {
    setPosColor: (c: string) => void
    posColor: string | undefined
  }

  // Verify initial state
  console.log('[test] before setPosColor, display.posColor =', display.posColor)

  // Change the positive color
  display.setPosColor('green')

  // Verify the state changed
  console.log('[test] after setPosColor, display.posColor =', display.posColor)
  expect(display.posColor).toBe('green')

  // Wait for re-render with new color
  await waitFor(
    async () => {
      const canvas2 = await findByTestId(pv('1..4000-0'), {}, { timeout: 10000 })
      // The canvas should be different now (green instead of blue)
      expectCanvasMatch(canvas2)
    },
    { timeout: 20000 },
  )
}, 40000)

test('open a bigwig track and change negColor', async () => {
  const { view, findByTestId } = await createView()
  view.setNewView(5, 0)

  // Open the track
  fireEvent.click(await findByTestId(hts('volvox_microarray'), {}, { timeout: 20000 }))

  // Wait for the track to render
  const canvas1 = await findByTestId(pv('1..4000-0'), {}, { timeout: 20000 })
  expectCanvasMatch(canvas1)

  // Get the display model and change color
  const track = view.tracks[0]!
  const display = track.displays[0] as { setNegColor: (c: string) => void }

  // Change the negative color
  display.setNegColor('purple')

  // Wait for re-render with new color
  await waitFor(
    async () => {
      const canvas2 = await findByTestId(pv('1..4000-0'), {}, { timeout: 10000 })
      expectCanvasMatch(canvas2)
    },
    { timeout: 20000 },
  )
}, 40000)
