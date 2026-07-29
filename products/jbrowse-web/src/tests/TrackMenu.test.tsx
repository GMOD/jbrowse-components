import { screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import { createView, doBeforeEach, hts, setup } from './util.tsx'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 30000 }
const opts = [{}, delay]

test('check pin track', async () => {
  const user = userEvent.setup()
  await createView()
  await user.click(await screen.findByTestId(hts('volvox_cram'), ...opts))
  // Wait for the track's RPC fetch to settle before continuing: otherwise the
  // test ends while it's still in flight, and its resolution after teardown
  // throws "require a file after the Jest environment has been torn down"
  // from RenderAlignmentData's dynamic import.
  await screen.findByTestId('pileup-display-done', ...opts)
  await user.click(await screen.findByTestId('track_menu_icon', ...opts))
  await user.click(await screen.findByText('Track order', ...opts))
  await user.click(await screen.findByText('Pin track', ...opts))
}, 50000)
