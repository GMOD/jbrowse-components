import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { createView, doBeforeEach, expectCanvasMatch, hts, setup } from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 30000 }
const opts = [{}, delay]

// TODO: fix this test - floating labels not rendering in test environment
xtest('toggle subfeature labels to below and verify eden.1 label appears', async () => {
  const user = userEvent.setup()
  const { view, findAllByTestId } = await createView()

  // Navigate to the region with gene features
  await view.navToLocString('ctgA:907..15,319')

  // Load the gff3tabix_genes track
  await user.click(await screen.findByTestId(hts('gff3tabix_genes'), ...opts))

  // Wait for the track to render initially (wait for done state)
  await findAllByTestId(/prerendered_canvas.*done/, ...opts)

  // Open track menu
  await user.click(await screen.findByTestId('track_menu_icon', ...opts))

  // Navigate to Show... -> Subfeature labels -> below
  await user.click(await screen.findByText('Show...', ...opts))
  await user.click(await screen.findByText('Subfeature labels', ...opts))
  await user.click(await screen.findByText('below', ...opts))

  // Wait for re-render after setting change
  await findAllByTestId(/prerendered_canvas.*done/, ...opts)

  // Verify that eden.1 label appears in the DOM (floating label)
  await screen.findByText('EDEN.1', ...opts)

  // Take canvas snapshot to verify rendering with subfeature labels
  const canvases = await findAllByTestId(/prerendered_canvas/, ...opts)
  expectCanvasMatch(canvases[0]!)
}, 50000)
