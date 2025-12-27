import '@testing-library/jest-dom'
import { fireEvent, screen, waitFor } from '@testing-library/react'
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
  const { view, session, findAllByTestId } = await createView()

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

  // Wait for EDEN.1 label to appear
  const edenLabel = await screen.findByText('EDEN.1', ...opts)

  // Click on the EDEN.1 label
  fireEvent.click(edenLabel)

  // Verify the feature details widget opens with EDEN.1 data
  await waitFor(
    () => {
      // Check that a widget was added for the feature
      expect(session.widgets.size).toBeGreaterThan(0)
    },
    { timeout: 10000 },
  )

  // The feature widget should contain EDEN.1 information
  const widget = [...session.widgets.values()][0]
  expect(widget?.type).toBe('BaseFeatureWidget')
}, 60000)

test('click on transcript subfeature in canvas opens feature details', async () => {
  const user = userEvent.setup()
  const { view, session, findAllByTestId, findByTestId } = await createView()

  // Navigate to the region with gene features
  await view.navToLocString('ctgA:1000..5000')

  // Load the gff3tabix_genes track
  await user.click(await screen.findByTestId(hts('gff3tabix_genes'), ...opts))

  // Wait for the track to render
  const canvases = await findAllByTestId(/prerendered_canvas.*done/, ...opts)

  // Find the canvas overlay where click events are handled
  const overlay = await findByTestId('canvas-feature-overlay', ...opts)

  // Simulate a click on the canvas (coordinates within the EDEN gene region)
  // The exact coordinates depend on the rendered layout
  const rect = overlay.getBoundingClientRect()
  fireEvent.mouseDown(overlay, { clientX: rect.left + 100, clientY: rect.top + 20 })
  fireEvent.mouseUp(overlay, { clientX: rect.left + 100, clientY: rect.top + 20 })
  fireEvent.click(overlay, { clientX: rect.left + 100, clientY: rect.top + 20 })

  // Wait for the feature details widget to open
  await waitFor(
    () => {
      expect(session.widgets.size).toBeGreaterThan(0)
    },
    { timeout: 15000 },
  )
}, 60000)
