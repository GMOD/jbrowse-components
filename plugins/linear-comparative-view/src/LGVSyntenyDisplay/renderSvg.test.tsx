import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { renderToString } from 'react-dom/server'

import { makeEmptyPileupData } from '../../../alignments/src/LinearAlignmentsDisplay/testUtils.ts'
import { createDisplay } from './testEnv.ts'

import type React from 'react'

// The export waits on the fetch reaching a terminal state, and this harness
// never fetches.
jest.mock('@jbrowse/core/svg/svgReady', () => ({
  ...jest.requireActual('@jbrowse/core/svg/svgReady'),
  awaitSvgReady: () => Promise.resolve(),
}))

const getDisplayName = (name: string) =>
  name === 'GCF_000346465.2' ? 'peach' : name

async function exportedSvg(display: ReturnType<typeof createDisplay>) {
  const body = await display.renderSvg({})
  return renderToString(
    <ThemeProvider theme={createJBrowseTheme()}>
      <svg>{body as React.ReactElement}</svg>
    </ThemeProvider>,
  )
}

test('the export names each mate-assembly lane as its chip on screen does', async () => {
  const display = createDisplay({ getDisplayName })
  display.facetByField('mateAssembly')
  display.setRpcData(
    0,
    {
      groups: ['GCF_000346465.2', 'arabidopsis'].map(key => ({
        key,
        label: key,
        data: makeEmptyPileupData(),
      })),
    },
    { refName: 'ctgA', start: 0, end: 1000, assemblyName: 'volvox' },
  )

  const svg = await exportedSvg(display)
  expect(svg).toContain('peach')
  expect(svg).toContain('arabidopsis')
  expect(svg).not.toContain('GCF_000346465.2')
})
