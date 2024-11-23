import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// locals
import {
  setup,
  expectCanvasMatch,
  doBeforeEach,
  createView,
  hts,
  pv,
} from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 30000 }
const opts = [{}, delay]

test('gccontent', async () => {
  const user = userEvent.setup()
  const { view } = await createView()
  view.setNewView(0.465, 85055)
  await user.click(await screen.findByTestId(hts('volvox_gc'), ...opts))
  const f1 = within(await screen.findByTestId('wiggle-rendering-test', ...opts))
  expectCanvasMatch(await f1.findByTestId(pv('39433..39804-0'), ...opts))
}, 50000)
