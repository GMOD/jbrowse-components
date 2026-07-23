import './svgExportMocks.ts'

import { openMultiSampleVariantDisplay } from './testLinearMultiSampleVariantDisplay.tsx'
import { doBeforeEach, getSavedSvg, setup } from './util.tsx'

jest.mock('@jbrowse/core/util/FileSaver', () => ({ saveAs: jest.fn() }))

setup()

beforeEach(() => {
  jest.clearAllMocks()
  doBeforeEach()
})

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
  const { view, findByTestId, info } = await openMultiSampleVariantDisplay({
    displayType,
  })
  await findByTestId(info.doneTestId, {}, { timeout: 40000 })

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
