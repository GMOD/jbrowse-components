import '@testing-library/jest-dom'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { createView, doBeforeEach, hts, setup } from './util'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { Feature } from '@jbrowse/core/util'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 30000 }
const opts = [{}, delay]

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
  const display = view.tracks[0]?.displays[0] as {
    features: Map<string, Feature>
    setContextMenuFeature: (feature: Feature) => void
    configuration: { displayId: string }
  }

  // Wait for features to be available from the renderer
  await waitFor(
    () => {
      expect(display.features.size).toBeGreaterThan(0)
    },
    { timeout: 10000 },
  )

  // Find the EDEN gene feature from the rendered features
  const edenFeature = [...display.features.values()].find(
    f => f.get('name') === 'EDEN' && f.get('type') === 'gene',
  )
  expect(edenFeature).toBeDefined()

  // Set the feature for context menu (simulates right-clicking on the feature)
  display.setContextMenuFeature(edenFeature!)

  // Find the display element and trigger context menu
  const displayElement = await findByTestId(
    `display-${display.configuration.displayId}`,
    ...opts,
  )
  fireEvent.contextMenu(displayElement)

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
  const display = view.tracks[0]?.displays[0] as {
    features: Map<string, Feature>
    setContextMenuFeature: (feature: Feature) => void
    configuration: { displayId: string }
  }

  // Wait for features to be available from the renderer
  await waitFor(
    () => {
      expect(display.features.size).toBeGreaterThan(0)
    },
    { timeout: 10000 },
  )

  // Find the EDEN gene feature from the rendered features
  const edenFeature = [...display.features.values()].find(
    f => f.get('name') === 'EDEN' && f.get('type') === 'gene',
  )
  expect(edenFeature).toBeDefined()

  // Set the feature for context menu
  display.setContextMenuFeature(edenFeature!)

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
  // The EDEN gene has mRNA subfeatures
  expect(screen.getByText('EDEN.1')).toBeInTheDocument()
  expect(screen.getByText('EDEN.2')).toBeInTheDocument()
  expect(screen.getByText('EDEN.3')).toBeInTheDocument()

  // Cancel the dialog
  fireEvent.click(await findByText('Cancel', ...opts))
}, 60000)
