import { fireEvent, waitFor } from '@testing-library/react'

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

function getCanvasData(canvas: HTMLElement) {
  const ctx = (canvas as HTMLCanvasElement).getContext('2d')
  return ctx?.getImageData(0, 0, 100, 100).data.toString()
}

test('open a bigwig track and change to green color', async () => {
  const { view, findByTestId } = await createView()
  view.setNewView(5, 0)

  // Open the track
  fireEvent.click(
    await findByTestId(hts('volvox_microarray'), {}, { timeout: 20000 }),
  )

  // Wait for the track to render
  const canvas1 = await findByTestId(pv('1..4000-0'), {}, { timeout: 20000 })
  expectCanvasMatch(canvas1)

  // Capture initial canvas state
  const initialData = getCanvasData(canvas1)

  // Get the display model and change color
  const track = view.tracks[0]!
  const display = track.displays[0] as {
    setColor: (c: string) => void
    color: string | undefined
  }

  // Change the color - this should trigger a re-render
  display.setColor('green')

  // Wait for the canvas content to change
  await waitFor(
    () => {
      const canvas = document.querySelector(
        `[data-testid="${pv('1..4000-0')}"]`,
      ) as HTMLCanvasElement | null
      if (!canvas) {
        throw new Error('Canvas not found')
      }
      const currentData = getCanvasData(canvas)
      if (currentData === initialData) {
        throw new Error('Canvas content has not changed yet')
      }
    },
    { timeout: 10000 },
  )

  // Get the updated canvas and verify
  const canvas2 = await findByTestId(pv('1..4000-0'), {}, { timeout: 20000 })
  expectCanvasMatch(canvas2)
}, 40000)

test('open a bigwig track and change to purple color', async () => {
  const { view, findByTestId } = await createView()
  view.setNewView(5, 0)

  // Open the track
  fireEvent.click(
    await findByTestId(hts('volvox_microarray'), {}, { timeout: 20000 }),
  )

  // Wait for the track to render
  const canvas1 = await findByTestId(pv('1..4000-0'), {}, { timeout: 20000 })
  expectCanvasMatch(canvas1)

  // Capture initial canvas state
  const initialData = getCanvasData(canvas1)

  // Get the display model and change color
  const track = view.tracks[0]!
  const display = track.displays[0] as { setColor: (c: string) => void }

  // Change the color - this should trigger a re-render
  display.setColor('purple')

  // Wait for the canvas content to change
  await waitFor(
    () => {
      const canvas = document.querySelector(
        `[data-testid="${pv('1..4000-0')}"]`,
      ) as HTMLCanvasElement | null
      if (!canvas) {
        throw new Error('Canvas not found')
      }
      const currentData = getCanvasData(canvas)
      if (currentData === initialData) {
        throw new Error('Canvas content has not changed yet')
      }
    },
    { timeout: 10000 },
  )

  // Get the updated canvas and verify
  const canvas2 = await findByTestId(pv('1..4000-0'), {}, { timeout: 20000 })
  expectCanvasMatch(canvas2)
}, 40000)
