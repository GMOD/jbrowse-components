import { createJBrowseTheme } from '@jbrowse/core/ui'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { render } from '@testing-library/react'

import SVGTracks from './SVGTracks.tsx'
import { TRACK_LABEL_GAP } from './util.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

function drawTracks({
  trackLabels = 'hidden',
  trackLabelOffset = 0,
  displays,
}: {
  trackLabels?: 'hidden' | 'left'
  trackLabelOffset?: number
  displays: Record<string, unknown>[]
}) {
  const session = createTestSession({
    sessionSnapshot: {
      views: [
        {
          type: 'LinearGenomeView',
          offsetPx: 0,
          bpPerPx: 1,
          displayedRegions: [
            { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 100 },
            { assemblyName: 'volvox', refName: 'ctgB', start: 0, end: 100 },
          ],
          tracks: [],
        },
      ],
    },
  }) as any
  const model = session.views[0]
  model.setWidth(800)
  const { container } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <svg>
        <SVGTracks
          model={model}
          textHeight={0}
          fontSize={10}
          trackLabels={trackLabels}
          trackLabelOffset={trackLabelOffset}
          leftBuffer={0}
          legendWidth={0}
          displayResults={displays.map((display, i) => ({
            track: {
              configuration: { trackId: `t${i}`, name: `t${i}` },
              displays: [{ height: 40, ...display }],
            } as any,
            result: <g data-testid="body" />,
          }))}
        />
      </svg>
    </ThemeProvider>,
  )
  return container
}

function separatorCount(display: {
  regionTooLarge?: boolean
  drawsWhenTooLarge?: boolean
}) {
  return drawTracks({ displays: [display] }).querySelectorAll('rect[width="3"]')
    .length
}

test('a track with data gets a separator at each region end', () => {
  expect(separatorCount({})).toBe(2)
})

test('the too-large note is not struck through by the separators', () => {
  expect(separatorCount({ regionTooLarge: true })).toBe(0)
})

test('a display drawing its own too-large body keeps its separators', () => {
  expect(
    separatorCount({ regionTooLarge: true, drawsWhenTooLarge: true }),
  ).toBe(2)
})

test('a left track name right-aligns past its own sidebar, not the widest one', () => {
  const container = drawTracks({
    trackLabels: 'left',
    trackLabelOffset: 300,
    displays: [{}, { svgSidebarWidth: () => 100 }],
  })
  expect(
    [...container.querySelectorAll('text')].map(t => t.getAttribute('x')),
  ).toEqual([String(300 - TRACK_LABEL_GAP), String(200 - TRACK_LABEL_GAP)])
})
