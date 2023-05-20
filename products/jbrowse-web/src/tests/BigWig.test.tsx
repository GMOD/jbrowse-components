import { fireEvent } from '@testing-library/react'

import {
  setup,
  doBeforeEach,
  expectCanvasMatch,
  createView,
  pv,
  hts,
} from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 20000 }
const opts = [{}, delay]

test('open a bigwig track', async () => {
  const { view, findByTestId } = await createView()
  view.setNewView(5, 0)
  fireEvent.click(await findByTestId(hts('volvox_microarray'), ...opts))
  expectCanvasMatch(await findByTestId(pv('1..4000-0'), ...opts))
}, 25000)

test('open a bigwig line track 2', async () => {
  const { view, findByTestId } = await createView()
  view.setNewView(10, 0)
  fireEvent.click(await findByTestId(hts('volvox_microarray_line'), ...opts))
  expectCanvasMatch(await findByTestId(pv('1..8000-0'), ...opts))
}, 25000)

test('open a bigwig density track', async () => {
  const { view, findByTestId } = await createView()
  view.setNewView(5, 0)
  fireEvent.click(await findByTestId(hts('volvox_microarray_density'), ...opts))
  expectCanvasMatch(await findByTestId(pv('1..4000-0'), ...opts))
}, 25000)
