import { createJBrowseTheme } from '@jbrowse/core/ui'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { render } from '@testing-library/react'

import SVGTracks from './SVGTracks.tsx'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

function separatorCount(display: {
  regionTooLarge?: boolean
  drawsWhenTooLarge?: boolean
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
          trackLabels="hidden"
          trackLabelOffset={0}
          leftBuffer={0}
          legendWidth={0}
          displayResults={[
            {
              track: {
                configuration: { trackId: 't1', name: 't1' },
                displays: [{ height: 40, ...display }],
              } as any,
              result: <g data-testid="body" />,
            },
          ]}
        />
      </svg>
    </ThemeProvider>,
  )
  return container.querySelectorAll('rect[width="3"]').length
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
