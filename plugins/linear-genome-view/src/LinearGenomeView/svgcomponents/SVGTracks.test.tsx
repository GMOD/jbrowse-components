import { createJBrowseTheme } from '@jbrowse/core/ui'
import { measureText } from '@jbrowse/core/util'
import { leftAxisGutterWidth } from '@jbrowse/display-ui/axisPlacement'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { render } from '@testing-library/react'

import { SVGTrackRows } from './SVGTracks.tsx'
import {
  TRACK_LABEL_GAP,
  sessionTrackRows,
  trackLabelGutterWidth,
} from './util.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

function drawTracks({
  trackLabels = 'hidden',
  trackLabelOffset = 0,
  textHeight = 0,
  displays,
  legendHeights = [],
}: {
  trackLabels?: 'hidden' | 'left'
  trackLabelOffset?: number
  textHeight?: number
  displays: Record<string, unknown>[]
  legendHeights?: (number | undefined)[]
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
        <SVGTrackRows
          view={model}
          textHeight={textHeight}
          fontSize={10}
          trackLabels={trackLabels}
          trackLabelOffset={trackLabelOffset}
          leftBuffer={0}
          rows={sessionTrackRows(
            displays.map((display, i) => ({
              track: {
                configuration: { trackId: `t${i}`, name: `t${i}` },
                displays: [{ height: 40, ...display }],
              } as any,
              result: <g data-testid="body" />,
              legendHeight: legendHeights[i],
            })),
            session,
          )}
        />
      </svg>
    </ThemeProvider>,
  )
  return container
}

function separatorCount(display: { regionTooLarge?: boolean }) {
  return drawTracks({ displays: [display] }).querySelectorAll('rect[width="3"]')
    .length
}

test('a track with data gets a separator at each region end', () => {
  expect(separatorCount({})).toBe(2)
})

test('the too-large note is not struck through by the separators', () => {
  expect(separatorCount({ regionTooLarge: true })).toBe(0)
})

test('a left track name right-aligns in the gutter, and goes offset above a track with a sidebar', () => {
  const container = drawTracks({
    trackLabels: 'left',
    trackLabelOffset: 300,
    textHeight: 20,
    displays: [{}, { svgSidebarWidth: () => 100 }],
  })
  const texts = [...container.querySelectorAll('text')]
  expect(texts[0]!.getAttribute('x')).toBe(String(300 - TRACK_LABEL_GAP))
  expect(texts[0]!.getAttribute('text-anchor')).toBe('end')
  expect(texts[1]!.getAttribute('text-anchor')).toBeNull()
  expect(Number(texts[1]!.getAttribute('x'))).toBeGreaterThanOrEqual(300)
  expect(Number(texts[1]!.getAttribute('y'))).toBeLessThan(20)
  expect(
    [...container.querySelectorAll('[data-testid="body"]')].map(b =>
      b.parentElement!.getAttribute('transform'),
    ),
  ).toEqual(['translate(300 0)', 'translate(300 20)'])
})

// The body is clipped to the plot, so a key inside that clip would be cut off at
// the plot's right edge, and a key over the plot hides the data under it
test("a key draws right of its track's body, outside the body's clip", () => {
  const container = drawTracks({
    trackLabels: 'left',
    trackLabelOffset: 300,
    textHeight: 20,
    displays: [
      {
        id: 'keyed',
        showLegend: true,
        legendSpec: {
          sections: [{ id: 'a', items: [{ label: 'a', color: 'red' }] }],
        },
        setShowLegend() {},
        dismissLegendSection() {},
      },
    ],
    legendHeights: [40],
  })
  const key = container.querySelector('[data-testid="color-legend"]')!
  expect(key.closest('g[clip-path]')).toBeNull()
  expect(key.getAttribute('transform')).toBe('translate(810 0)')
  expect(key.parentElement!.getAttribute('transform')).toBe('translate(300 0)')
})

test('a track with no room for a key draws none', () => {
  const container = drawTracks({
    displays: [
      {
        id: 'keyed',
        showLegend: true,
        legendSpec: {
          sections: [{ id: 'a', items: [{ label: 'a', color: 'red' }] }],
        },
        setShowLegend() {},
        dismissLegendSection() {},
      },
    ],
  })
  expect(container.querySelector('[data-testid="color-legend"]')).toBeNull()
})

// An exported left axis takes the gutter's last px before the body, its tick
// labels and caption reaching out to the axis's full width
test('a left track name ends clear of the y axis left of its body', () => {
  const axes = [
    {
      domain: [0, 10_000] as [number, number],
      scaleType: 'linear' as const,
      height: 40,
      ticks: {
        items: [{ value: 10_000, y: 0, label: '10,000' }],
        yTop: 0,
        yBottom: 40,
      },
      bandTops: [0],
      caption: 'depth',
    },
  ]
  const trackLabelOffset = trackLabelGutterWidth({
    rows: [{ track: { displays: [{ axes }] }, name: 't0' }],
    trackLabels: 'left',
    fontSize: 10,
  })
  const label = drawTracks({
    trackLabels: 'left',
    trackLabelOffset,
    textHeight: 20,
    displays: [{ axes }],
  }).querySelector('text')!
  const end = Number(label.getAttribute('x'))
  expect(end + TRACK_LABEL_GAP).toBeLessThanOrEqual(
    trackLabelOffset - leftAxisGutterWidth(axes),
  )
  expect(end - measureText('t0', 10)).toBeGreaterThanOrEqual(0)
})
