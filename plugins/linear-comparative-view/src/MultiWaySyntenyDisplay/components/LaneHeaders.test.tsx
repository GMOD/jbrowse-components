import '@testing-library/jest-dom'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import { SimpleFeature } from '@jbrowse/core/util'
import { ThemeProvider } from '@mui/material'
import { render, screen } from '@testing-library/react'

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

test('a gutter next to an undescribed genome names the assembly to add', () => {
  const display = createDisplay()
  const undeclared = 'sample#1#undeclared'
  display.setFeatures(
    ['volvox_random', undeclared].map(
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
  display.setLaneFrames(
    0,
    new Map([
      ['volvox_random', decision],
      [undeclared, decision],
    ]),
  )
  display.beginDescribingLanes([undeclared])
  display.endDescribingLanes([undeclared], {})
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <LaneHeaders model={display} />
    </ThemeProvider>,
  )
  expect(screen.getByTestId('multiway-gutter-unheld')).toHaveTextContent(
    `Add ${undeclared} as an assembly to draw these ribbons`,
  )
})
