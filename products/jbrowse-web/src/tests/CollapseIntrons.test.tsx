import '@testing-library/jest-dom'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { createView, doBeforeEach, hts, setup } from './util.tsx'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 30000 }
const opts = [{}, delay]

test('collapse introns on gene feature', async () => {
  const user = userEvent.setup()
  const { view, session, findByText, findAllByTestId } = await createView()

  // Navigate to the region with the EDEN gene (1050-9000)
  await view.navToLocString('ctgA:907..10,000')

  // Load the gff3tabix_genes track
  await user.click(await screen.findByTestId(hts('gff3tabix_genes'), ...opts))

  // Wait for the track to render
  await findAllByTestId(/prerendered_canvas.*done/, ...opts)

  // Find the floating label for EDEN and right-click it to open context menu
  const edenLabel = await screen.findByText('EDEN', ...opts)
  fireEvent.contextMenu(edenLabel)

  // Click on "Collapse introns" in the context menu (waits for menu to appear)
  fireEvent.click(await findByText('Collapse introns', ...opts))

  // The dialog should appear with transcript selection
  await findByText('Select transcript to collapse', ...opts)

  // Click Submit to collapse introns using all transcripts
  fireEvent.click(await findByText('Submit', ...opts))

  // Wait for the new view to be created
  await waitFor(
    () => {
      expect(session.views.length).toBe(2)
    },
    { timeout: 10000 },
  )

  // Get the new view
  const newView = session.views[1] as LinearGenomeViewModel

  // Wait for the new view to be initialized
  await waitFor(
    () => {
      expect(newView.initialized).toBe(true)
    },
    { timeout: 10000 },
  )

  // Verify that the new view has multiple displayed regions (collapsed introns)
  // The EDEN gene has multiple exons/CDS, so after collapsing introns
  // we should have multiple displayed regions
  expect(newView.displayedRegions.length).toBeGreaterThan(1)

  // Verify all displayed regions are on the same refName
  for (const region of newView.displayedRegions) {
    expect(region.refName).toBe('ctgA')
  }
}, 60000)

test('collapse introns dialog shows transcript table', async () => {
  const user = userEvent.setup()
  const { view, findAllByTestId, findByText } = await createView()

  // Navigate to the region with the EDEN gene
  await view.navToLocString('ctgA:907..10,000')

  // Load the gff3tabix_genes track
  await user.click(await screen.findByTestId(hts('gff3tabix_genes'), ...opts))

  // Wait for the track to render
  await findAllByTestId(/prerendered_canvas.*done/, ...opts)

  // Find the floating label for EDEN and right-click it to open context menu
  const edenLabel = await screen.findByText('EDEN', ...opts)
  fireEvent.contextMenu(edenLabel)

  // Click on "Collapse introns" (waits for menu to appear)
  fireEvent.click(await findByText('Collapse introns', ...opts))

  // Dialog should appear
  await findByText('Select transcript to collapse', ...opts)

  // Click to show all transcripts button
  const showButton = await screen.findByRole('button', {
    name: /Show all transcripts/,
  })
  fireEvent.click(showButton)

  // Wait for the transcript table to render
  await waitFor(
    () => {
      expect(screen.getByText('Name/ID')).toBeInTheDocument()
    },
    { timeout: 10000 },
  )

  // Verify EDEN transcripts appear in the table
  expect(screen.getByText('EDEN.1')).toBeInTheDocument()
  expect(screen.getByText('EDEN.2')).toBeInTheDocument()
  expect(screen.getByText('EDEN.3')).toBeInTheDocument()

  // Cancel the dialog
  fireEvent.click(await findByText('Cancel', ...opts))
}, 60000)
