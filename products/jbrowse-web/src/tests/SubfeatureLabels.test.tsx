import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  createView,
  expectCanvasMatch,
  openTrackMenu,
  setupTest,
} from './util'

setupTest()

const delay = { timeout: 30000 }
const opts = [{}, delay] as const

test('toggle subfeature labels to below and verify eden.1 label appears', async () => {
  const user = userEvent.setup()
  const { view, findAllByTestId } = await createView()

  // Navigate to the region with gene features
  await view.navToLocString('ctgA:907..15,319')

  // Load the gff3tabix_genes track and open its menu
  await openTrackMenu(user, 'gff3tabix_genes')

  // Wait for the track to render initially
  await findAllByTestId(/prerendered_canvas/, ...opts)

  // Navigate to Show... -> Subfeature labels -> below
  await user.click(await screen.findByText('Show...'))
  await user.click(await screen.findByText('Subfeature labels'))
  await user.click(await screen.findByText('below'))

  // Verify that eden.1 label appears in the DOM (floating label)
  await screen.findByText('EDEN.1', ...opts)

  // Take canvas snapshot to verify rendering with subfeature labels
  const canvases = await findAllByTestId(/prerendered_canvas/, ...opts)
  expectCanvasMatch(canvases[0]!)
}, 50000)
