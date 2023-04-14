import { fireEvent } from '@testing-library/react'

import {
  setup,
  doBeforeEach,
  expectCanvasMatch,
  createView,
  hts,
  pv,
} from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 20000 }
const opts = [{}, delay]

test('open a multibigwig track', async () => {
  const { view, findByTestId, findByText } = await createView()
  await findByText('Help')
  view.setNewView(5, 0)
  fireEvent.click(await findByTestId(hts('volvox_microarray_multi'), ...opts))
  expectCanvasMatch(await findByTestId(pv('1..4000-0'), ...opts))
}, 25000)
