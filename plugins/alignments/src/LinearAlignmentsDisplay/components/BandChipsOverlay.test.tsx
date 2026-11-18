import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'

import { createTestAlignmentsDisplay, oneReadWithMate } from '../testUtils.ts'
import BandChipsOverlay from './BandChipsOverlay.tsx'
import GroupLabelsOverlay from './GroupLabelsOverlay.tsx'

import type { LinearAlignmentsDisplayModel } from '../model.ts'

afterEach(cleanup)

function renderOverlays(display: LinearAlignmentsDisplayModel) {
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <GroupLabelsOverlay model={display} />
      <BandChipsOverlay model={display} />
    </ThemeProvider>,
  )
}

function displayWithArcs() {
  const { display } = createTestAlignmentsDisplay()
  display.setDrawnReadConnections('link')
  display.setReadConnectionsPlacement('down')
  display.setRpcData(
    0,
    { groups: [{ key: '', label: '', data: oneReadWithMate(2000) }] },
    display.view.displayedRegions[0]!,
  )
  renderOverlays(display)
  return display
}

function facetedWithArcs() {
  const { display } = createTestAlignmentsDisplay()
  display.setDrawnReadConnections('link')
  display.setRpcData(
    0,
    {
      groups: [
        { key: 'a', label: 'HP: 1', data: oneReadWithMate(2000) },
        {
          key: 'b',
          label: 'HP: 2',
          data: oneReadWithMate(2000, { key: 'r1', name: 'readB' }),
        },
      ],
    },
    display.view.displayedRegions[0]!,
  )
  return display
}

test('each band draws its chip at its own top', () => {
  const display = displayWithArcs()
  const [lane] = display.renderSections
  expect(screen.getByTestId('band_chips_coverage').style.top).toBe(
    `${lane!.coverageTop + 1}px`,
  )
  expect(screen.getByTestId('band_chips_readConnections').style.top).toBe(
    `${lane!.coverageTop + lane!.bands.top.readConnections + 1}px`,
  )
  expect(screen.getByTestId('band_chips_pileup').style.top).toBe(
    `${lane!.pileupTop + 1}px`,
  )
})

test('the read arcs chip hides the read connections band', () => {
  const display = displayWithArcs()
  fireEvent.click(screen.getByTitle('Hide read arcs'))
  expect(display.drawnReadConnections).toBe('off')
  expect(display.showCoverage).toBe(true)
  expect(display.showPileup).toBe(true)
})

test('the coverage chip hides the coverage band', () => {
  const display = displayWithArcs()
  fireEvent.click(screen.getByTitle('Hide coverage'))
  expect(display.showCoverage).toBe(false)
  expect(display.drawnReadConnections).toBe('link')
})

test('the pileup chip hides the pileup', () => {
  const display = displayWithArcs()
  fireEvent.click(screen.getByTitle('Hide pileup'))
  expect(display.showPileup).toBe(false)
  expect(display.showCoverage).toBe(true)
})

test('under a facet the coverage chip leads the topmost group chip', () => {
  const display = facetedWithArcs()
  renderOverlays(display)
  const [firstGroupChip] = screen.getAllByTestId('group-label-chip')
  expect(within(firstGroupChip!).getByTitle('Hide coverage')).toBeTruthy()
  expect(screen.queryByTestId('band_chips_coverage')).toBeNull()
})

test('under a facet with coverage hidden, the strip heading the first lane leads the topmost group chip', () => {
  const display = facetedWithArcs()
  display.setShowCoverage(false)
  renderOverlays(display)
  const [firstGroupChip] = screen.getAllByTestId('group-label-chip')
  expect(display.renderSections[0]!.bands.top.readConnections).toBe(0)
  expect(within(firstGroupChip!).getByTitle('Hide read arcs')).toBeTruthy()
  expect(screen.queryByTestId('band_chips_readConnections')).toBeNull()
})
