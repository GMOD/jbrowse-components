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
  display.setLayoutAndClusterTree([...display.sources], '(hg38:1,mm10:1);', {
    regions: [{ refName: 'ctgA', start: 0, end: 1000 }],
  })
  return { display, view }
}

// The exported figure is where "which locus is this tree from" has no other
// answer: the on-screen chip only draws once the view has drifted off the
// clustered span, and a shared PNG cannot be hovered.
test('an exported dendrogram carries the locus it was clustered on', async () => {
  const { display } = clusteredDisplay()
  expect(draw(await renderSvg(display, {}))).toContain('ctgA')
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
  expect(display.legendItems.length).toBeGreaterThan(0)
  expect(draw(await renderSvg(display, {}))).toContain('maf-color-legend')
  display.setShowLegend(false)
  expect(draw(await renderSvg(display, {}))).not.toContain('maf-color-legend')
})
