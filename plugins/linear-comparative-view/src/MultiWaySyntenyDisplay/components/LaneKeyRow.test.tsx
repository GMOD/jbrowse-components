import '@testing-library/jest-dom'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import { SimpleFeature } from '@jbrowse/core/util'
import { ThemeProvider } from '@mui/material'
import { render, screen } from '@testing-library/react'

import { KEY_LINE_PX, keyRowsOf } from '../legend.ts'
import { createDisplay } from '../testEnv.ts'
import LaneKeyRow from './LaneKeyRow.tsx'

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

function bothStrandsDisplay(width: number) {
  const display = createDisplay()
  display.lgv.setWidth(width)
  display.setFeatures(
    [1, -1].map(
      (strand, i) =>
        new SimpleFeature({
          uniqueId: `f${i}`,
          refName: 'ctgA',
          start: 10 + i * 60,
          end: 60 + i * 60,
          strand,
          mate: {
            assemblyName: 'volvox_random',
            refName: 'ctgB',
            start: 110 + i * 60,
            end: 160 + i * 60,
          },
        }),
    ),
  )
  display.setLaneFrames(0, new Map([['volvox_random', decision]]))
  return display
}

function renderRow(display: ReturnType<typeof createDisplay>) {
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <LaneKeyRow model={display} />
    </ThemeProvider>,
  )
  return screen.getByTestId('multiway-key-row')
}

test.each([800, 160])(
  'at %i px the key row shows every mark drawn whole, in a band holding every line its labels wrap to',
  width => {
    const display = bothStrandsDisplay(width)
    const labels = display.keyRowScales.flatMap(scale =>
      scale.kind === 'categorical' ? scale.entries.map(e => e.label) : [],
    )
    expect(labels).toEqual(
      expect.arrayContaining([
        'Same orientation as lane above',
        'Inverted vs lane above',
        'Lane sequence',
      ]),
    )
    const row = renderRow(display)
    expect(
      screen.getAllByTestId('multiway-key-entry').map(e => e.textContent),
    ).toEqual(labels)
    expect(row).not.toHaveStyle({ overflow: 'hidden' })
    expect(row).not.toHaveStyle({ whiteSpace: 'nowrap' })
    expect(row).toHaveStyle({ height: `${display.keyBandPx}px` })
    expect(display.keyBandPx).toBeGreaterThanOrEqual(
      KEY_LINE_PX * keyRowsOf(labels, display.canvasWidthPx),
    )
    expect(screen.queryByText(/more/)).toBeNull()
  },
)

test('the key row draws nothing where no lane is placed', () => {
  const display = createDisplay()
  display.setFeatures([])
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <LaneKeyRow model={display} />
    </ThemeProvider>,
  )
  expect(display.keyBandPx).toBe(0)
  expect(screen.queryByTestId('multiway-key-row')).toBeNull()
})
