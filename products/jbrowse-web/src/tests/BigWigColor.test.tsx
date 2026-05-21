import { fireEvent, waitFor } from '@testing-library/react'

import {
  createView,
  doBeforeEach,
  expectCanvasMatch,
  hts,
  setup,
  waitForRenderedCanvas,
} from './util.tsx'

setup()

beforeEach(() => {
  doBeforeEach()
})

function getCanvasData(canvas: Element) {
  const ctx = (canvas as HTMLCanvasElement).getContext('2d')
  return ctx?.getImageData(0, 0, 100, 100).data.toString()
}

test.each(['green', 'purple'])(
  'open a bigwig track and change to %s color',
  async color => {
    const { view, findByTestId, findAllByTestId } = await createView()
    view.setNewView(5, 0)

    fireEvent.click(
      await findByTestId(hts('volvox_microarray'), {}, { timeout: 20000 }),
    )

    const canvas1 = await waitForRenderedCanvas(findAllByTestId)
    expectCanvasMatch(canvas1)

    const initialData = getCanvasData(canvas1)
    const display = view.tracks[0]!.displays[0] as {
      setColor: (c: string) => void
    }
    display.setColor(color)

    await waitFor(
      () => {
        const displayEl = document.querySelector(
          '[data-testid^="display-"][data-testid$="-done"]',
        )
        if (!displayEl) {
          throw new Error('Display not found')
        }
        const canvas = displayEl.querySelector('canvas')
        if (!canvas) {
          throw new Error('Canvas not found')
        }
        if (getCanvasData(canvas) === initialData) {
          throw new Error('Canvas content has not changed yet')
        }
      },
      { timeout: 10000 },
    )

    expectCanvasMatch(await waitForRenderedCanvas(findAllByTestId))
  },
  40000,
)
