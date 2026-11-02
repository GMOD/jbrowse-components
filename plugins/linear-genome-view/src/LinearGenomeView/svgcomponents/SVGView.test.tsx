import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { render } from '@testing-library/react'

import SVGView from './SVGView.tsx'
import { trackSpacing } from './util.ts'

import type { LinearGenomeViewModel } from '../index.ts'
import type { SvgDisplayResult } from './util.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

const ctgA = { assemblyName: 'volvox', refName: 'ctgA' }
const TrackConf = ConfigurationSchema(
  'StubTrack',
  {},
  { explicitIdentifier: 'trackId' },
)

function drawView(displays: { drawsGenomicCoordinates?: boolean }[]) {
  const session = createTestSession({
    sessionSnapshot: {
      views: [
        {
          type: 'LinearGenomeView',
          offsetPx: 0,
          bpPerPx: 1,
          displayedRegions: [{ ...ctgA, start: 0, end: 1000 }],
          tracks: [],
        },
      ],
    },
  })
  const view = session.views[0] as LinearGenomeViewModel
  view.setWidth(800)
  session.addHighlight({ ...ctgA, start: 100, end: 117 })
  const displayResults: SvgDisplayResult[] = displays.map((display, i) => ({
    track: {
      configuration: TrackConf.create({ trackId: `t${i}` }),
      displays: [{ height: 40, ...display }],
    },
    result: null,
  }))
  const { container } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <svg>
        <SVGView
          view={view}
          displayResults={displayResults}
          header={null}
          fontSize={10}
          textHeight={0}
          trackLabels="hidden"
          trackLabelOffset={0}
          contentTop={0}
          tracksHeight={displays.length * (40 + trackSpacing)}
          showGridlines={false}
          leftBuffer={0}
        />
      </svg>
    </ThemeProvider>,
  )
  return [...container.querySelectorAll('rect[width="17"]')].map(r => ({
    top: Number(r.getAttribute('y')),
    height: Number(r.getAttribute('height')),
  }))
}

test('the band covers every track when all draw in genomic coordinates', () => {
  expect(drawView([{}, {}])).toEqual([{ top: 0, height: 84 }])
})

test('the band leaves out the body of a track that does not', () => {
  expect(drawView([{}, { drawsGenomicCoordinates: false }, {}])).toEqual([
    { top: 0, height: 42 },
    { top: 82, height: 44 },
  ])
})
