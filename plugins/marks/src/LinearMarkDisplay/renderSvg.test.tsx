import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { renderToString } from 'react-dom/server'

import { renderSvg } from './renderSvg.tsx'
import {
  REGION,
  createTestEnvironment,
  features,
  workerResult,
} from './testEnv.ts'

import type React from 'react'

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

// the screen draws a text mark as a DOM layer over the canvas, so a reader that
// samples the canvas alone — the circular view's ring — gets no text from the
// export either
test('a text mark exports with the plot, and stays out of a plot-only export', async () => {
  const { display } = createTestEnvironment({
    marks: [{ mark: 'text', encoding: { y: 'score' } }],
  }).createDisplay()
  display.setRpcData(
    0,
    workerResult(
      display,
      features([{ start: 1000, end: 4000, score: 5, name: 'geneA' }]),
    ),
    REGION,
  )
  expect(draw(await renderSvg(display, {}))).toContain('geneA')
  expect(draw(await renderSvg(display, { plotOnly: true }))).not.toContain(
    'geneA',
  )
})
