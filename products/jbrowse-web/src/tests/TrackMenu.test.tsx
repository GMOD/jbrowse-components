import { screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import {
  createView,
  doBeforeEach,
  findDisplayPainted,
  hts,
  setup,
  volvoxConfigWithTracks,
} from './util.tsx'

setup()

// only the track this suite opens, so createView doesn't mount a
// selector row for the other ~120 - see volvoxConfigWithTracks
const config = volvoxConfigWithTracks(['volvox_cram'])

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 30000 }
const opts = [{}, delay]

test('check pin track', async () => {
  const user = userEvent.setup()
  await createView(config)
  await user.click(await screen.findByTestId(hts('volvox_cram'), ...opts))
  // Wait for the track's RPC fetch to settle before continuing: otherwise the
  // test ends while it's still in flight, and its resolution after teardown
  // throws "require a file after the Jest environment has been torn down"
  // from RenderAlignmentData's dynamic import.
  await findDisplayPainted('pileup-display', delay)
  await user.click(await screen.findByTestId('track_menu_icon', ...opts))
  await user.click(await screen.findByText('Track order', ...opts))
  await user.click(await screen.findByText('Pin track', ...opts))
}, 50000)
