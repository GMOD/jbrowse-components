import { createJBrowseTheme } from '@jbrowse/core/ui'
import { exportedHeight } from '@jbrowse/display-kit/renderDisplaySvg'
import { ThemeProvider } from '@mui/material'
import { waitFor } from '@testing-library/react'
import { renderToString } from 'react-dom/server'

import { renderSvg } from './renderSvg.tsx'
import { createTestEnvironment, makeSource } from './testEnv.ts'

import type React from 'react'

jest.mock('@jbrowse/core/svg/svgReady', () => ({
  ...jest.requireActual('@jbrowse/core/svg/svgReady'),
  awaitSvgReady: () => Promise.resolve(),
}))

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

// The "Showing N of M rows" chip is a screen control the export leaves out,
// so its line goes too, rather than sitting blank above the rows.
test('a narrowed export leaves out the focus chip line', async () => {
  const env = createTestEnvironment({
    displayConfig: { rows: { field: 'source', kept: ['A', 'B'] } },
  })
  env.mockRpcCall.mockImplementation(() =>
    Promise.resolve([{ sources: ['A', 'B', 'C'].map(makeSource) }]),
  )
  const { display } = env.createDisplay()
  jest.advanceTimersByTime(700)
  await waitFor(() => {
    expect(display.discoveredRows).toHaveLength(3)
  })
  const line = display.rowFocusLineHeight
  expect(line).toBeGreaterThan(0)
  expect(display.rowsTopOffset).toBe(line)
  const svg = renderToString(
    <ThemeProvider theme={createJBrowseTheme()}>
      <svg>{(await renderSvg(display, {})) as React.ReactElement}</svg>
    </ThemeProvider>,
  )
  const rowShifts = [...svg.matchAll(/transform="translate\(0,([^"]+)\)"/g)]
  expect(rowShifts.map(m => Number(m[1]))).toEqual([0, 0])
  expect(exportedHeight(display)).toBe(display.height - line)
})
