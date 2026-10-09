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
// samples the canvas alone — the circular view's ring — gets its text through
// `floatingLabels` instead
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

test('a text mark answers its labels as floating labels, below the rows header', () => {
  const palette = createJBrowseTheme().palette
  const { display, view } = createTestEnvironment({
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
  const [label, ...rest] = display.floatingLabels(palette)
  expect(rest).toEqual([])
  expect(label).toMatchObject({ text: 'geneA', color: palette.text.primary })
  expect(label!.y).toBeGreaterThanOrEqual(display.rowsTopOffset)
  expect(label!.x + label!.width / 2).toBeCloseTo(
    view.bpToPx({ refName: 'ctgA', coord: 2500 })!.offsetPx - view.offsetPx,
  )

  const { display: points } = createTestEnvironment({
    marks: [{ mark: 'point', encoding: { y: 'score' } }],
  }).createDisplay()
  expect(points.floatingLabels(palette)).toEqual([])
})

test('a text mark inherits the font the export picked', async () => {
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
  const svg = draw(await renderSvg(display, { fontFamily: 'serif' }))
  const labels = [...svg.matchAll(/<text[^>]*>geneA<\/text>/g)]
  expect(labels).toHaveLength(2)
  for (const [label] of labels) {
    expect(label).not.toContain('font-family')
  }
})

test('under rows the export places labels through the row table, a focused-out row placing none', async () => {
  const { display } = createTestEnvironment({
    rows: 'source',
    marks: [{ mark: 'text', encoding: { text: 'name' } }],
  }).createDisplay()
  display.setRpcData(
    0,
    workerResult(
      display,
      features([
        { source: 'dad', start: 1000, end: 4000, name: 'fromDad' },
        { source: 'mom', start: 5000, end: 8000, name: 'fromMom' },
      ]),
    ),
    REGION,
  )
  display.setRowFocus(['mom'])
  const svg = draw(await renderSvg(display, {}))
  expect(svg).toContain('fromMom')
  expect(svg).not.toContain('fromDad')
})
