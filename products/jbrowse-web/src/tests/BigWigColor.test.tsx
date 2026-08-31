import { fireEvent } from '@testing-library/react'

import {
  canvasToBuffer,
  createView,
  doBeforeEach,
  expectCanvasMatch,
  hts,
  setup,
  volvoxConfigWithTracks,
  waitForRenderedCanvas,
  waitForRepaintedCanvas,
} from './util.tsx'

setup()

// only the track this suite opens, so createView doesn't mount a
// selector row for the other ~120 - see volvoxConfigWithTracks
const config = volvoxConfigWithTracks(['volvox_microarray'])

beforeEach(() => {
  doBeforeEach()
})

test.each(['green', 'purple'])(
  'open a bigwig track and change to %s color',
  async color => {
    const { view, findByTestId } = await createView(config)
    view.setNewView(5, 0)

    fireEvent.click(
      await findByTestId(hts('volvox_microarray'), {}, { timeout: 20000 }),
    )

    const canvas1 = await waitForRenderedCanvas()
    expectCanvasMatch(canvas1)
    const blue = canvasToBuffer(canvas1)

    const display = view.tracks[0]!.displays[0] as {
      setColor: (c: string) => void
    }
    display.setColor(color)

    // the recolor repaints without refetching, so nothing on the model moves —
    // the pixels leaving the default blue are the signal
    expectCanvasMatch(await waitForRepaintedCanvas(blue))
  },
  40000,
)
