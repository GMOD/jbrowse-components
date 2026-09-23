import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { renderToString } from 'react-dom/server'

import { renderSvg } from './renderSvg.tsx'
import { createMafTestEnvironment } from './testEnv.ts'

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

// The export says where the tree came from when the screen does: only once the
// view has drifted off the clustered span.
test('an exported dendrogram warns when it was clustered elsewhere', async () => {
  const { display } = clusteredDisplay()
  expect(draw(await renderSvg(display, {}))).not.toContain('⚠')
  display.setRowOrder([...display.sources], {
    tree: '(hg38:1,mm10:1);',
    provenance: {
      regions: [{ refName: 'ctgB', start: 0, end: 1000 }],
    },
  })
  expect(draw(await renderSvg(display, {}))).toContain('⚠ ctgB:1..1,000')
})

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
