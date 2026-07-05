import { saveAs } from '@jbrowse/core/util'
import { fireEvent } from '@testing-library/react'

import { createView, doBeforeEach, hts, setup } from './util.tsx'

import './svgExportMocks.ts'
jest.mock('@jbrowse/core/util/FileSaver', () => ({ saveAs: jest.fn() }))

setup()

beforeEach(() => {
  jest.clearAllMocks()
  doBeforeEach()
})

const delay = { timeout: 40000 }
const opts = [{}, delay] as const

function getSavedSvg(): string {
  const mock = saveAs as unknown as { mock: { calls: unknown[][] } }
  const blob = mock.mock.calls[0]![0] as { content: string[] }
  return blob.content[0]!
}

// The exported cells are per-row `<rect>`s; their `y` distribution tells us
// whether rows were laid out down the display or collapsed to the top.
function cellRowYs(svg: string) {
  const ys = [...svg.matchAll(/<rect[^>]*\by="([\d.]+)"/g)].map(m =>
    Number(m[1]),
  )
  return {
    rectCount: ys.length,
    distinctY: new Set(ys).size,
    yMin: Math.min(...ys),
    yMax: Math.max(...ys),
  }
}

// Regression guard for the fit-to-display-height SVG export. The display
// defaults to fit mode (rowHeight 0), which is resolved by the
// `effectiveRowHeight` getter. The export path used to read the raw `rowHeight`
// property instead, so in fit mode every cell drew at y=0 with a 1px height —
// the whole matrix collapsed into a strip at the top (distinctY 1, yMax 0). The
// fix reads effectiveRowHeight, so the 1094 sample rows spread down the full
// display height. Asserted on both multi-sample variant display types since
// each has its own renderSvg.
async function exportFitModeAndCheck(displayType: 'matrix' | 'regular') {
  const displayText =
    displayType === 'matrix'
      ? 'Multi-sample variant display (matrix)'
      : 'Multi-sample variant display (regular)'
  const doneTestId =
    displayType === 'matrix'
      ? 'variant-matrix-display-done'
      : 'variant-display-done'

  const { view, findByTestId, findByText } = await createView()
  await view.navToLocString('ctgA')
  fireEvent.click(await findByTestId(hts('volvox_test_vcf'), ...opts))

  fireEvent.click(await findByTestId('track_menu_icon', ...opts))
  fireEvent.click(await findByText('Display types', ...opts))
  fireEvent.click(await findByText(displayText, ...opts))
  await findByTestId(doneTestId, ...opts)

  await view.exportSvg({ rasterizeLayers: false })
  const { rectCount, distinctY, yMin, yMax } = cellRowYs(getSavedSvg())

  expect(rectCount).toBeGreaterThan(1000)
  // rows spread down the display rather than collapsing to a single y=0 band
  expect(yMin).toBe(0)
  expect(yMax).toBeGreaterThan(100)
  expect(distinctY).toBeGreaterThan(100)
}

test(
  'matrix multi-sample variant SVG export spreads rows in fit mode',
  () => exportFitModeAndCheck('matrix'),
  45000,
)

test(
  'regular multi-sample variant SVG export spreads rows in fit mode',
  () => exportFitModeAndCheck('regular'),
  45000,
)
