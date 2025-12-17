import { fireEvent, waitForElementToBeRemoved } from '@testing-library/react'

import {
  createView,
  doBeforeEach,
  expectCanvasMatch,
  hts,
  pv,
  setup,
} from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

test('open a bigwig track and change to green color', async () => {
  const { view, findByTestId, queryByTestId } = await createView()
  view.setNewView(5, 0)

  // Open the track
  fireEvent.click(
    await findByTestId(hts('volvox_microarray'), {}, { timeout: 20000 }),
  )

  // Wait for the track to render
  const canvas1 = await findByTestId(pv('1..4000-0'), {}, { timeout: 20000 })
  expectCanvasMatch(canvas1)

  // Get the display model and change color
  const track = view.tracks[0]!
  const display = track.displays[0] as {
    setColor: (c: string) => void
    color: string | undefined
  }

  // Change the color - this should trigger a re-render
  display.setColor('green')

  // Wait for the canvas to be removed (re-render starts)
  await waitForElementToBeRemoved(() => queryByTestId(pv('1..4000-0')), {
    timeout: 10000,
  })

  // Wait for the new canvas to appear (re-render completes)
  const canvas2 = await findByTestId(pv('1..4000-0'), {}, { timeout: 20000 })

  // Small delay to ensure canvas content is fully rendered
  await new Promise(resolve => setTimeout(resolve, 100))

  expectCanvasMatch(canvas2)
}, 40000)

test('open a bigwig track and change to purple color', async () => {
  const { view, findByTestId, queryByTestId } = await createView()
  view.setNewView(5, 0)

  // Open the track
  fireEvent.click(
    await findByTestId(hts('volvox_microarray'), {}, { timeout: 20000 }),
  )

  // Wait for the track to render
  const canvas1 = await findByTestId(pv('1..4000-0'), {}, { timeout: 20000 })
  expectCanvasMatch(canvas1)

  // Get the display model and change color
  const track = view.tracks[0]!
  const display = track.displays[0] as { setColor: (c: string) => void }

  // Change the color - this should trigger a re-render
  display.setColor('purple')

  // Wait for the canvas to be removed (re-render starts)
  await waitForElementToBeRemoved(() => queryByTestId(pv('1..4000-0')), {
    timeout: 10000,
  })

  // Wait for the new canvas to appear (re-render completes)
  const canvas2 = await findByTestId(pv('1..4000-0'), {}, { timeout: 20000 })
  expectCanvasMatch(canvas2)
}, 40000)
