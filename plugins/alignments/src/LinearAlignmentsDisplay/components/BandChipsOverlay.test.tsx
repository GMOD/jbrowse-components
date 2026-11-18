import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { createTestAlignmentsDisplay, oneReadWithMate } from '../testUtils.ts'
import BandChipsOverlay from './BandChipsOverlay.tsx'

afterEach(cleanup)

function displayWithArcs() {
  const { display } = createTestAlignmentsDisplay()
  display.setDrawnReadConnections('link')
  display.setReadConnectionsPlacement('down')
  display.setRpcData(
    0,
    { groups: [{ key: '', label: '', data: oneReadWithMate(2000) }] },
    display.view.displayedRegions[0]!,
  )
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <BandChipsOverlay model={display} />
    </ThemeProvider>,
  )
  return display
}

test('each band draws its chip at its own top, the stack no taller for them', () => {
  const display = displayWithArcs()
  const [lane] = display.renderSections
  expect(display.sections.contentHeight).toBe(
    lane!.bands.bottom + lane!.pileupHeight,
  )
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
