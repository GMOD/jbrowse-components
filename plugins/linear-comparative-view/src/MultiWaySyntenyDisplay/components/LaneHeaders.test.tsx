import '@testing-library/jest-dom'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import { SimpleFeature } from '@jbrowse/core/util'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render, screen } from '@testing-library/react'

import { lanePairKey } from '../alignmentOps.ts'
import { createDisplay } from '../testEnv.ts'
import LaneHeaders from './LaneHeaders.tsx'

const decision = {
  refName: 'ctgB',
  flipped: false,
  rung: 1,
  pivotAnchor: { refName: 'ctgA', coord: 200 },
  pivotLaneBp: 200,
  pivotInHoleBp: 0,
  fitMin: 100,
  fitMax: 300,
  alsoOn: [],
  alsoOnMore: 0,
  alsoAt: [],
  pinned: false,
  orientationPinned: false,
}

function twoLaneDisplay(lanes: [string, string]) {
  const display = createDisplay()
  display.setFeatures(
    lanes.map(
      (mateAssembly, i) =>
        new SimpleFeature({
          uniqueId: `f${i}`,
          refName: 'ctgA',
          start: 100,
          end: 300,
          strand: 1,
          mate: {
            assemblyName: mateAssembly,
            refName: 'ctgB',
            start: 100,
            end: 300,
          },
        }),
    ),
  )
  display.setLaneFrames(0, new Map(lanes.map(lane => [lane, decision])))
  return display
}

function renderHeaders(display: ReturnType<typeof createDisplay>) {
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <LaneHeaders model={display} />
    </ThemeProvider>,
  )
}

test('a gutter next to an undescribed genome names the assembly to add', () => {
  const undeclared = 'sample#1#undeclared'
  const display = twoLaneDisplay(['volvox_random', undeclared])
  display.beginDescribingLanes([undeclared])
  display.endDescribingLanes([undeclared], {})
  renderHeaders(display)
  expect(screen.getByTestId('multiway-gutter-unheld')).toHaveTextContent(
    `Add ${undeclared} as an assembly to draw these ribbons`,
  )
})

test('a lane whose fetch failed says so, and Retry asks for it again', () => {
  const display = twoLaneDisplay(['volvox_random', 'volvox_ins'])
  const spec = {
    lane: 'volvox_random',
    key: 'k',
    assemblyName: 'volvox_random',
  }
  display.setLaneGenes(
    new Map([
      [spec.lane, { key: spec.key, genes: [], error: new Error('503') }],
    ]),
    [spec],
    display.anchorAssemblyName,
  )
  renderHeaders(display)
  const failure = screen.getByTestId('multiway-lane-failed-volvox_random')
  expect(failure).toHaveTextContent('Failed to load Retry')
  expect(failure).toHaveAttribute('title', 'Error: 503')

  fireEvent.click(
    screen.getByTestId('multiway-lane-failed-volvox_random-retry'),
  )
  expect(display.laneFetchErrors.size).toBe(0)
  expect(display.laneGenes.held?.has(spec.lane)).toBe(false)
  expect(
    screen.queryByTestId('multiway-lane-failed-volvox_random'),
  ).not.toBeInTheDocument()
})

test('a lane pair whose fetch failed says so in its gutter', () => {
  const display = twoLaneDisplay(['volvox_random', 'volvox_ins'])
  const [upper, lower] = display.rowAssemblies
  const lane = lanePairKey(upper!, lower!)
  display.setLaneLinks(
    new Map([
      [lane, { key: 'k', links: [], ops: new Map(), error: new Error('503') }],
    ]),
    [{ lane, key: 'k', assemblyName: upper! }],
    display.anchorAssemblyName,
  )
  renderHeaders(display)
  expect(screen.getByTestId('multiway-gutter-failed')).toHaveTextContent(
    'Failed to load alignments Retry',
  )
})
