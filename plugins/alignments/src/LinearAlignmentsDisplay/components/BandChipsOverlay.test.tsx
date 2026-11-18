import { namesToBlock } from '@jbrowse/alignments-core'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { GROUP_LABEL_HEIGHT } from '@jbrowse/display-kit/groupLabelStyle'
import { ThemeProvider } from '@mui/material'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'

import { coverageBandTop } from '../sectionLayout.ts'
import {
  createTestAlignmentsDisplay,
  makeEmptyPileupData,
  oneReadWithMate,
} from '../testUtils.ts'
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
  display.setReadConnectionsPlacement('below')
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

// Two interleaving junctions, so 'auto' draws the 20-read one over the
// coverage and pushes the 2-read one to the strip below.
function displayWithSplitJunctions() {
  const { display } = createTestAlignmentsDisplay()
  display.setShowSashimi(true)
  display.setSashimiPlacement('auto')
  display.setJunctionFilter({ minReads: 0 })
  display.setRpcData(
    0,
    {
      groups: [
        {
          key: '',
          label: '',
          data: {
            ...makeEmptyPileupData(),
            sashimiX1: new Uint32Array([100, 300]),
            sashimiX2: new Uint32Array([500, 700]),
            sashimiFwd: new Uint32Array([0, 0]),
            sashimiRev: new Uint32Array([0, 0]),
            sashimiDonors: new Uint8Array([0, 0]),
            sashimiAcceptors: new Uint8Array([0, 0]),
            sashimiClass: new Uint8Array([0, 0]),
            sashimiCounts: new Uint32Array([20, 2]),
          },
        },
      ],
    },
    display.view.displayedRegions[0]!,
  )
  renderOverlays(display)
  return display
}

function stackedReads(n: number, tag: string) {
  const positions = new Uint32Array(n * 2)
  for (let i = 0; i < n; i++) {
    positions[i * 2] = 1000
    positions[i * 2 + 1] = 1100
  }
  return {
    ...makeEmptyPileupData(),
    readKeys: Array.from({ length: n }, (_, i) => `${tag}r${i}`),
    ...namesToBlock(Array.from({ length: n }, (_, i) => `${tag}read${i}`)),
    readPositions: positions,
    readFlags: new Uint16Array(n),
    readMapqs: new Uint8Array(n).fill(60),
    readStrands: new Int8Array(n).fill(1),
    readInsertSizes: new Float32Array(n),
    readPairOrientations: new Uint8Array(n),
  }
}

test('each band draws its chip at its own top', () => {
  const display = displayWithArcs()
  const [lane] = display.renderSections
  expect(screen.getByTestId('band_chips_coverage').style.top).toBe(
    `${coverageBandTop(lane!) + 1}px`,
  )
  expect(screen.getByTestId('band_chips_readConnections').style.top).toBe(
    `${lane!.sectionTop + lane!.bands.top.readConnections + 1}px`,
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

test('junctions split by auto placement get one chip, on their strip', () => {
  const display = displayWithSplitJunctions()
  expect(display.renderSections[0]!.bands.reserved.sashimi).toBeGreaterThan(0)
  expect(screen.getAllByTestId('band_chip_Sashimi arcs')).toHaveLength(1)
  expect(
    within(screen.getByTestId('band_chips_sashimi')).getByTitle(
      'Hide sashimi arcs',
    ),
  ).toBeTruthy()
})

test('the sashimi chip hides the sashimi arcs', () => {
  const display = displayWithSplitJunctions()
  fireEvent.click(screen.getByTitle('Hide sashimi arcs'))
  expect(display.showSashimi).toBe(false)
  expect(display.showCoverage).toBe(true)
  expect(display.showPileup).toBe(true)
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

test('under a facet, arcs placed above the coverage lead the topmost group chip, the coverage chip at its band', () => {
  const display = facetedWithArcs()
  display.setReadConnectionsPlacement('above')
  renderOverlays(display)
  const [firstGroupChip] = screen.getAllByTestId('group-label-chip')
  expect(within(firstGroupChip!).getByTitle('Hide read arcs')).toBeTruthy()
  expect(within(firstGroupChip!).queryByTitle('Hide coverage')).toBeNull()
  expect(screen.getByTestId('band_chips_coverage').style.top).toBe(
    `${coverageBandTop(display.renderSections[0]!) + 1}px`,
  )
})

test('a band chip scrolling under the pinned group chip is not drawn', () => {
  const { display } = createTestAlignmentsDisplay()
  display.setRpcData(
    0,
    {
      groups: [
        { key: 'a', label: 'HP: 1', data: stackedReads(40, 'a') },
        { key: 'b', label: 'HP: 2', data: stackedReads(40, 'b') },
      ],
    },
    display.view.displayedRegions[0]!,
  )
  display.setHeight(60)
  const { pileupTop } = display.renderSections[0]!
  display.setScrollTop(pileupTop - GROUP_LABEL_HEIGHT - 1)
  renderOverlays(display)
  expect(screen.getAllByTestId('group-label-chip')[0]!.style.top).toBe('1px')
  expect(screen.getByTestId('band_chips_pileup').style.top).toBe(
    `${GROUP_LABEL_HEIGHT + 2}px`,
  )
  cleanup()
  display.setScrollTop(pileupTop - GROUP_LABEL_HEIGHT + 1)
  renderOverlays(display)
  expect(screen.getAllByTestId('group-label-chip')[0]!.style.top).toBe('1px')
  expect(screen.queryByTestId('band_chips_pileup')).toBeNull()
})
