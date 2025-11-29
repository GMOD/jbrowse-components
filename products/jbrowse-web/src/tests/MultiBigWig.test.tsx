import { fireEvent } from '@testing-library/react'

import { createView, doBeforeEach, expectCanvasMatch, hts, setup } from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 60000 }
const opts = [{}, delay]

test('open a multibigwig track', async () => {
  const { view, findAllByTestId, findByTestId } = await createView()
  view.setNewView(5, 0)
  fireEvent.click(await findByTestId(hts('volvox_microarray_multi'), ...opts))
  expectCanvasMatch((await findAllByTestId(/prerendered_canvas/, ...opts))[0]!)
}, 60000)
