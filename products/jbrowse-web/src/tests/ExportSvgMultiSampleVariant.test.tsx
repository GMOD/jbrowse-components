import './svgExportMocks.ts'

import { openMultiSampleVariantDisplay } from './testLinearMultiSampleVariantDisplay.tsx'
import { doBeforeEach, getSavedSvg, setup } from './util.tsx'

// `view.tracks[0].displays[0]` is untyped; annotating it makes a getter that
// doesn't exist on the model a typecheck error rather than a silent undefined.
import type { LinearMultiSampleVariantMatrixDisplayModel } from '@jbrowse/plugin-variants'

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

// The matrix display reserves `lineZoneHeight` at the top for the lines tying
// each column to its genomic position. The export used to draw neither: rows
// started at y=0 (20px above where the live canvas and tree sidebar put them,
// leaving the bottom 20px blank) and the connector lines were missing entirely,
// even though the component already had an `exportSVG` mode nothing called.
test('matrix multi-sample variant SVG export draws the connector lines and offsets rows below them', async () => {
  const { view, findByTestId, info } = await openMultiSampleVariantDisplay({
    displayType: 'matrix',
  })
  await findByTestId(info.doneTestId, {}, { timeout: 40000 })
  const display: LinearMultiSampleVariantMatrixDisplayModel =
    view.tracks[0].displays[0]
  const { lineZoneHeight } = display

  await view.exportSvg({ rasterizeLayers: false })
  const svg = getSavedSvg()

  expect(lineZoneHeight).toBeGreaterThan(0)
  // cells, labels, and dendrogram all live in one row-space group below the
  // line zone
  expect(svg).toContain(`transform="translate(0 ${lineZoneHeight})"`)
  // each connector runs from its column center at the bottom of the zone up
  // to the genomic position on the ruler
  const connectors = svg.match(
    new RegExp(`M[\\d.]+ ${lineZoneHeight}L[\\d.]+ 0`, 'g'),
  )
  expect(connectors?.length).toBeGreaterThan(10)
}, 45000)

test(
  'regular multi-sample variant SVG export spreads rows in fit mode',
  () => exportFitModeAndCheck('regular'),
  45000,
)
