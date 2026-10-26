import { createJBrowseTheme } from '@jbrowse/core/ui'
import { PaletteProvider } from '@jbrowse/core/ui/PaletteContext'
import { resolvePalette } from '@jbrowse/core/ui/palette'
import { getPaletteHost } from '@jbrowse/core/util'
import { ThemeProvider } from '@mui/material'
import { renderToString } from 'react-dom/server'

import { createTestAlignmentsDisplay, oneReadWithMate } from './testUtils.ts'

import type { JBrowsePalette } from '@jbrowse/core/ui/palette'
import type React from 'react'

// The export waits on the fetch reaching a terminal state, and this harness
// never fetches.
jest.mock('@jbrowse/core/svg/svgReady', () => ({
  ...jest.requireActual('@jbrowse/core/svg/svgReady'),
  awaitSvgReady: () => Promise.resolve(),
}))

function arcDisplay() {
  const { view, display } = createTestAlignmentsDisplay()
  // wide enough that the read and its mate are both on screen
  view.setNewView(10, 0)
  display.setDrawnReadConnections('link')
  display.setRpcData(
    0,
    { groups: [{ key: '', label: '', data: oneReadWithMate(5000) }] },
    display.view.displayedRegions[0]!,
  )
  return display
}

async function exportedIn(
  display: ReturnType<typeof arcDisplay>,
  palette: JBrowsePalette,
) {
  const body = await display.renderSvg({})
  return renderToString(
    <ThemeProvider theme={createJBrowseTheme()}>
      <PaletteProvider palette={palette}>
        <svg>{body as React.ReactElement}</svg>
      </PaletteProvider>
    </ThemeProvider>,
  )
}

const arcStrokes = (svg: string) =>
  [...svg.matchAll(/<path [^>]*stroke="([^"]+)"/g)].map(m => m[1])

// The export dialog picks a theme the session need not be showing, and the
// read connections bake their colors into the feed. A body that took the
// session's sections would draw the reads in the export's theme and the arcs
// in the screen's.
test('the export colors the read connections in its own theme', async () => {
  const display = arcDisplay()
  const session = getPaletteHost(display).palette
  const other = resolvePalette({
    mode: session.mode === 'dark' ? 'light' : 'dark',
  })
  const inSession = arcStrokes(await exportedIn(display, session))
  const inOther = arcStrokes(await exportedIn(display, other))
  expect(inSession).toHaveLength(1)
  expect(inOther).toHaveLength(1)
  expect(inOther).not.toEqual(inSession)
})
