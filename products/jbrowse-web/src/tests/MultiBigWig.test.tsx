import { cleanup, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, test } from 'vitest'

import {
  createView,
  doBeforeEach,
  expectCanvasMatch,
  hts,
  pv,
  setup,
} from './util'

afterEach(() => {
  cleanup()
})
setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 50000 }
const opts = [{}, delay]

test('open a multibigwig track', async () => {
  const { view, findByTestId } = await createView()
  view.setNewView(5, 0)
  fireEvent.click(await findByTestId(hts('volvox_microarray_multi'), ...opts))
  expectCanvasMatch(await findByTestId(pv('1..4000-0'), ...opts))
}, 50000)
