import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { renderToString } from 'react-dom/server'

import { renderSvg } from './renderSvg.tsx'
import { createMafTestEnvironment } from './testEnv.ts'

import type { Region } from '@jbrowse/core/util'
import type React from 'react'

// The export waits on the fetch reaching a terminal state, and this harness
// never fetches.
jest.mock('@jbrowse/core/svg/svgReady', () => ({
  ...jest.requireActual('@jbrowse/core/svg/svgReady'),
  awaitSvgReady: () => Promise.resolve(),
}))

function draw(result: React.ReactNode) {
  return renderToString(
    <ThemeProvider theme={createJBrowseTheme()}>
      <svg>{result as React.ReactElement}</svg>
    </ThemeProvider>,
  )
}

function clusteredDisplay() {
  const { display, view } = createMafTestEnvironment().createDisplay()
  view.zoomTo(1)
  display.setSamples({
    samples: [
      { id: 'hg38', label: 'hg38' },
      { id: 'mm10', label: 'mm10' },
    ],
    treeNewick: undefined,
    samplesCanonical: true,
  })
  display.setRowOrder([...display.sources], {
    tree: '(hg38:1,mm10:1);',
    provenance: {
      regions: [{ refName: 'ctgA', start: 0, end: 1000 }],
    },
  })
  return { display, view }
}

// The row painters cull by row, so a partly scrolled top row starts above the
// rows box. The screen's canvas edge clips it; a vector export needs a clip of
// its own or the row's letters land on the bands above.
test('the rows layer is clipped to the rows box', async () => {
  const { display } = clusteredDisplay()
  const svg = draw(await renderSvg(display, {}))
  const clip =
    /<clipPath id="(maf-rows-[^"]+)"><rect[^>]*height="([^"]+)"/.exec(svg)
  expect(clip).not.toBeNull()
  expect(Number(clip![2])).toBe(display.rowsHeight)
  expect(svg).toContain(`clip-path="url(#${clip![1]})"`)
})

// The key is the only decoder an exported figure ships with, and dismissing it
// on screen used to leave it in the figure: maf was the one row display with no
// `showLegend` at all.
test('a dismissed color key stays out of the export', async () => {
  const { display, view } = clusteredDisplay()
  display.setRowRendering('heatmap')
  // the identity plots swap themselves out for the bases at base level
  view.zoomTo(100)
  view.setCoarseDynamicBlocks(view.dynamicBlocks, view.bpPerPx)
  expect(display.colorScales.length).toBeGreaterThan(0)
  expect(draw(await renderSvg(display, {}))).toContain('color-legend')
  display.setShowLegend(false)
  expect(draw(await renderSvg(display, {}))).not.toContain('color-legend')
})

// A score-0 summary bar is the match colour at alpha 64/255.
const SUMMARY_FILL_OPACITY = `fill-opacity="${64 / 255}"`

function summaryTierDisplay() {
  const { display, view } = createMafTestEnvironment({
    summaryAdapter: { type: 'BigBedAdapter' },
  }).createDisplay()
  display.setSamples({
    samples: [
      { id: 'hg38', label: 'hg38' },
      { id: 'mm10', label: 'mm10' },
    ],
    treeNewick: undefined,
    samplesCanonical: true,
  })
  const summary = (src: string, start: number, end: number) => ({
    refName: 'ctgA',
    start,
    end,
    src,
    score: 0,
  })
  view.zoomTo(100)
  display.setCoarseTier(
    [
      {
        displayedRegionIndex: 0,
        payload: {
          data: [
            summary('hg38', 1000, 3000),
            summary('mm10', 1000, 3000),
            summary('hg38', 9_000_000, 9_000_100),
          ],
          frames: undefined,
        },
      },
    ],
    {
      regions: view.displayedRegions.map(
        (region: Region, displayedRegionIndex: number) => ({
          region,
          displayedRegionIndex,
        }),
      ),
      key: display.coarseTierIssueKey,
    },
  )
  expect(display.coarseTierActive).toBe(true)
  return display
}

const count = (svg: string, s: string) => svg.split(s).length - 1

// The summary bars were an overlay before they were a mark: a plot-only
// export left them out, and a vector layer writes a rect for every fill a
// clip hides, so the export culls what no block shows.
test('an export draws the summary bars on screen, and a plot-only one none', async () => {
  const display = summaryTierDisplay()
  expect(count(draw(await renderSvg(display, {})), SUMMARY_FILL_OPACITY)).toBe(
    2,
  )
  expect(
    count(
      draw(await renderSvg(display, { plotOnly: true })),
      SUMMARY_FILL_OPACITY,
    ),
  ).toBe(0)
})
