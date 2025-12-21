import '@testing-library/jest-dom'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import { createView, doBeforeEach, hts, setup } from './util'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 30000 }
const opts = [{}, delay]

// Create a mock EDEN gene feature with mRNA subfeatures containing CDS
// This structure is needed for the "Collapse introns" menu item to appear
function createEdenGeneFeature() {
  return new SimpleFeature({
    uniqueId: 'test-eden-gene',
    refName: 'ctgA',
    start: 1049,
    end: 9000,
    name: 'EDEN',
    type: 'gene',
    subfeatures: [
      {
        uniqueId: 'eden-mrna-1',
        refName: 'ctgA',
        start: 1049,
        end: 9000,
        name: 'EDEN.1',
        type: 'mRNA',
        subfeatures: [
          { uniqueId: 'cds1', refName: 'ctgA', start: 1200, end: 1500, type: 'CDS' },
          { uniqueId: 'cds2', refName: 'ctgA', start: 3000, end: 3900, type: 'CDS' },
          { uniqueId: 'cds3', refName: 'ctgA', start: 5000, end: 5500, type: 'CDS' },
          { uniqueId: 'cds4', refName: 'ctgA', start: 7000, end: 7600, type: 'CDS' },
        ],
      },
      {
        uniqueId: 'eden-mrna-2',
        refName: 'ctgA',
        start: 1049,
        end: 9000,
        name: 'EDEN.2',
        type: 'mRNA',
        subfeatures: [
          { uniqueId: 'cds5', refName: 'ctgA', start: 1200, end: 1500, type: 'CDS' },
          { uniqueId: 'cds6', refName: 'ctgA', start: 5000, end: 5500, type: 'CDS' },
          { uniqueId: 'cds7', refName: 'ctgA', start: 7000, end: 7600, type: 'CDS' },
        ],
      },
      {
        uniqueId: 'eden-mrna-3',
        refName: 'ctgA',
        start: 1299,
        end: 9000,
        name: 'EDEN.3',
        type: 'mRNA',
        subfeatures: [
          { uniqueId: 'cds8', refName: 'ctgA', start: 3000, end: 3900, type: 'CDS' },
          { uniqueId: 'cds9', refName: 'ctgA', start: 5000, end: 5500, type: 'CDS' },
          { uniqueId: 'cds10', refName: 'ctgA', start: 7000, end: 7600, type: 'CDS' },
        ],
      },
    ],
  })
}

test('collapse introns on gene feature', async () => {
  const user = userEvent.setup()
  const { view, session, findByTestId, findByText, findAllByTestId } =
    await createView()

  // Navigate to the region with the EDEN gene (1050-9000)
  await view.navToLocString('ctgA:907..10,000')

  // Load the gff3tabix_genes track
  await user.click(await screen.findByTestId(hts('gff3tabix_genes'), ...opts))

  // Wait for the track to render
  await findAllByTestId(/prerendered_canvas.*done/, ...opts)

  // Get the display
  const display = view.tracks[0]?.displays[0]

  // Enable the accessible feature overlay for testing
  display.setShowAccessibleFeatureOverlay(true)

  // Wait for accessible feature buttons to appear
  // These are rendered based on the layout data
  await waitFor(
    () => {
      const featureButtons = screen.queryAllByTestId(/^feature-/)
      expect(featureButtons.length).toBeGreaterThan(0)
    },
    { timeout: 10000 },
  )

  // Find a gene feature button and right-click it
  const featureButtons = screen.getAllByTestId(/^feature-/)
  fireEvent.contextMenu(featureButtons[0]!)

  // Click on "Collapse introns" in the context menu
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
  const { view, findAllByTestId, findByText, findByTestId } = await createView()

  // Navigate to the region with the EDEN gene
  await view.navToLocString('ctgA:907..10,000')

  // Load the gff3tabix_genes track
  await user.click(await screen.findByTestId(hts('gff3tabix_genes'), ...opts))

  // Wait for the track to render
  await findAllByTestId(/prerendered_canvas.*done/, ...opts)

  // Get the display
  const display = view.tracks[0]?.displays[0]

  // Create mock EDEN gene feature and set it as context menu feature
  const edenFeature = createEdenGeneFeature()
  display.setContextMenuFeature(edenFeature)

  // Find the display element and trigger context menu
  const displayElement = await findByTestId(
    `display-${display.configuration.displayId}`,
    ...opts,
  )
  fireEvent.contextMenu(displayElement)

  // Click on "Collapse introns"
  fireEvent.click(await findByText('Collapse introns', ...opts))

  // Dialog should appear
  await findByText('Select transcript to collapse', ...opts)

  // Click to show all transcripts button
  // Note: "Show all transcripts" also appears in the description text, so use button role
  const showButton = await screen.findByRole('button', {
    name: /Show all transcripts/,
  })
  fireEvent.click(showButton)

  // Wait for the transcript table to render
  // The table should show "Name/ID" header
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
