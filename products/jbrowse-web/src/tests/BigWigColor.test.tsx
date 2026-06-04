import { fireEvent } from '@testing-library/react'

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

    const display = view.tracks[0]!.displays[0] as {
      setColor: (c: string) => void
    }
    display.setColor(color)

    await new Promise(res => setTimeout(res, 2000))
    expectCanvasMatch(await waitForRenderedCanvas(findAllByTestId))
  },
  40000,
)
