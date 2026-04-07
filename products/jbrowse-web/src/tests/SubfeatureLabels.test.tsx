import { screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import {
  createView,
  doBeforeEach,
  expectCanvasMatch,
  findCanvasIn,
  hts,
  setup,
} from './util.tsx'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 30000 }
const opts = [{}, delay]

test('toggle subfeature labels to below and verify eden.1 label appears', async () => {
  const user = userEvent.setup()
  const { view, findAllByTestId } = await createView()

  // Navigate to the region with gene features
  await view.navToLocString('ctgA:907..15,319')

  // Load the gff3tabix_genes track
  await user.click(await screen.findByTestId(hts('gff3tabix_genes'), ...opts))

  // Wait for the track to render
  await findAllByTestId(/^display-.*-done$/, ...opts)

  // Open track menu
  await user.click(await screen.findByTestId('track_menu_icon', ...opts))

  // Navigate to Subfeature labels -> Below
  await user.click(await screen.findByText('Subfeature labels', ...opts))
  await user.click(await screen.findByText('Below', ...opts))

  // Verify that eden.1 label appears in the DOM (floating label)
  await screen.findByText('EDEN.1', ...opts)

  // Take canvas snapshot to verify rendering with subfeature labels
  const displays = await findAllByTestId(/^display-.*-done$/, ...opts)
  expectCanvasMatch(findCanvasIn(displays[0]!))
}, 50000)
