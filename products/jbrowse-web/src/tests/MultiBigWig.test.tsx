import { fireEvent } from '@testing-library/react'

import {
  setup,
  doBeforeEach,
  expectCanvasMatch,
  createView,
  pc,
  hts,
} from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 20000 }
const opts = [{}, delay]

test('open a multibigwig track', async () => {
  const { view, findByTestId, findByText } = createView()
  await findByText('Help')
  view.setNewView(5, 0)
  fireEvent.click(await findByTestId(hts('volvox_microarray_multi'), ...opts))
  expectCanvasMatch(await findByTestId(pc('{volvox}ctgA:1..4000-0'), ...opts))
}, 25000)
