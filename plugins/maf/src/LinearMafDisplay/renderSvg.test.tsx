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
    samples: [{ id: 'hg38' }, { id: 'mm10' }],
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
