import '@testing-library/jest-dom'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { createView, doBeforeEach, hts, setup } from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 30000 }
const opts = [{}, delay]

test('click on subfeature label (EDEN.1) opens feature details', async () => {
  const user = userEvent.setup()
  const { view, findAllByTestId } = await createView()

  // Navigate to the region with gene features
  await view.navToLocString('ctgA:907..15,319')

  // Load the gff3tabix_genes track
  await user.click(await screen.findByTestId(hts('gff3tabix_genes'), ...opts))

  // Wait for the track to render
  await findAllByTestId(/prerendered_canvas.*done/, ...opts)

  // Open track menu and enable subfeature labels
  await user.click(await screen.findByTestId('track_menu_icon', ...opts))
  await user.click(await screen.findByText('Show...'))
  await user.click(await screen.findByText('Subfeature labels'))
  await user.click(await screen.findByText('below'))

  // Wait for EDEN.1 label to appear (floating label)
  const edenLabel = await screen.findByText('EDEN.1', ...opts)

  // Click on the EDEN.1 label
  fireEvent.click(edenLabel)

  // Verify the feature details widget opens with EDEN.1 information
  await screen.findByText('Eden splice form 1', ...opts)
}, 60000)
