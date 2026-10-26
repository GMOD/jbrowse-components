import { createJBrowseTheme } from '@jbrowse/core/ui'
import { floorOf } from '@jbrowse/core/util/fieldPredicate'
import { ThemeProvider } from '@mui/material'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import {
  DEFAULT_MIN_INTERCHROM_READS,
  DEFAULT_MIN_SASHIMI_READS,
} from '../../shared/alignmentsFilter.ts'
import {
  bootAlignmentsDisplay,
  createTestAlignmentsDisplay,
} from '../testUtils.ts'
import MoreFiltersDialog from './MoreFiltersDialog.tsx'

afterEach(cleanup)

// The dialog over a real display, whose members are MST views: a plain-object
// stand-in answers a spread or a `this` that the display does not
function openOn(
  display: ReturnType<typeof createTestAlignmentsDisplay>['display'],
) {
  cleanup()
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <MoreFiltersDialog model={display} handleClose={() => {}} />
    </ThemeProvider>,
  )
}

function drawingBothLayers() {
  const { display } = createTestAlignmentsDisplay()
  display.setShowSashimi(true)
  display.setDrawnReadConnections('link')
  display.setJunctionFilter({ minReads: 7 })
  display.setConnectionFilter({ minInterchromReads: 9 })
  return display
}

test('a Submit with no edit leaves the layer floors as they were', () => {
  const display = drawingBothLayers()
  openOn(display)
  fireEvent.click(screen.getByText('Submit'))
  expect(display.junctionFilter.minReads).toBe(7)
  expect(display.connectionFilter.minInterchromReads).toBe(9)
})

test('Reset keeps each drawn layer, and Submit writes its declared floor', () => {
  const display = drawingBothLayers()
  openOn(display)
  fireEvent.click(screen.getByText('Reset defaults'))
  expect(screen.getByText('Sashimi arcs')).toBeTruthy()
  expect(screen.getByText('Read connections')).toBeTruthy()
  fireEvent.click(screen.getByText('Submit'))
  expect(display.junctionFilter.minReads).toBe(DEFAULT_MIN_SASHIMI_READS)
  expect(display.connectionFilter.minInterchromReads).toBe(
    DEFAULT_MIN_INTERCHROM_READS,
  )
})

function declaringFilter(filter: unknown[]) {
  const trackConfig = {
    displays: [{ type: 'LinearAlignmentsDisplay', displayId: 'd1', filter }],
  }
  const { baseSession, mount } = bootAlignmentsDisplay({ trackConfig })
  const Session = baseSession
    .volatile(() => ({ rpcManager: {} }))
    .views(() => ({
      baseTrackConfig: () => trackConfig,
    }))
  return mount(Session, { configuration: 'd1' }).display
}

test('a declared strict MAPQ floor stays strict through Submit and Reset', () => {
  const display = declaringFilter([{ field: 'mapq', gt: 20 }])
  const strict = { min: 20, strict: true }
  openOn(display)
  fireEvent.click(screen.getByText('Submit'))
  expect(floorOf(display.filterPredicates, 'mapq')).toEqual(strict)

  display.setFilterFields({ mapq: [] })
  expect(display.filterNarrowing().count).toBe(1)
  openOn(display)
  fireEvent.click(screen.getByText('Reset defaults'))
  fireEvent.click(screen.getByText('Submit'))
  expect(floorOf(display.filterPredicates, 'mapq')).toEqual(strict)
  expect(display.filterNarrowing().count).toBe(0)
})
