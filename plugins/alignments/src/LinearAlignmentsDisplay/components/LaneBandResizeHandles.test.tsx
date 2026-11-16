import { stackBands } from '@jbrowse/core/util/bandLayout'
import { cleanup, render, screen } from '@testing-library/react'

import { LANE_BAND_ORDER } from '../sectionLayout.ts'
import { LaneBandResizeHandles } from './PileupComponent.tsx'

import type { LinearAlignmentsDisplayModel } from '../model.ts'

afterEach(cleanup)

const titleOf = (band: string) =>
  `Drag to resize the ${band} band of every group`

// Two groups, each folding the same band settings: coverage over a
// read-connection strip, the sashimi strip off unless a case turns it on.
function renderHandles(
  heights: {
    coverage: number
    readConnections: number
    sashimi: number
  },
  showPileup = true,
) {
  const bands = stackBands(LANE_BAND_ORDER, {
    coverage: { active: true, height: heights.coverage },
    readConnections: { active: true, height: heights.readConnections },
    sashimi: { active: true, height: heights.sashimi },
  })
  const model = {
    showPileup,
    height: 400,
    isGrouped: true,
    scrollModel: { isGrouped: true, scrollTop: 0, canvasHeight: 400 },
    setCoverageHeight: jest.fn(),
    setReadConnectionsHeight: jest.fn(),
    setSashimiHeight: jest.fn(),
    renderSections: [0, 1].map(i => ({
      groupKey: `g${i}`,
      coverageTop: i * 200,
      bands,
    })),
  } as unknown as LinearAlignmentsDisplayModel
  render(<LaneBandResizeHandles model={model} />)
}

test('every band a group reserves gets a handle in that group', () => {
  renderHandles({ coverage: 40, readConnections: 30, sashimi: 20 })
  for (const band of ['coverage', 'read connections', 'sashimi']) {
    expect(screen.getAllByTitle(titleOf(band))).toHaveLength(2)
  }
})

// a band bound to 0 px has nothing to resize, and its handle would sit on the
// seam of the band above it
test('a band reserving no px gets no handle', () => {
  renderHandles({ coverage: 0, readConnections: 30, sashimi: 0 })
  expect(screen.queryAllByTitle(titleOf('coverage'))).toHaveLength(0)
  expect(screen.queryAllByTitle(titleOf('sashimi'))).toHaveLength(0)
  expect(screen.getAllByTitle(titleOf('read connections'))).toHaveLength(2)
})

// with the pileup hidden the bands fill the track, which its own bottom edge
// sizes, so no band offers a drag of its own
test('no band gets a handle while the pileup is hidden', () => {
  renderHandles({ coverage: 40, readConnections: 30, sashimi: 20 }, false)
  for (const band of ['coverage', 'read connections', 'sashimi']) {
    expect(screen.queryAllByTitle(titleOf(band))).toHaveLength(0)
  }
})
