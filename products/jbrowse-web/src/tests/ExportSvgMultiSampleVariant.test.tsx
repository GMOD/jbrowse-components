import './svgExportMocks.ts'

import { openMultiSampleVariantDisplay } from './testLinearMultiSampleVariantDisplay.tsx'
import {
  doBeforeEach,
  findDisplayPainted,
  getSavedSvg,
  getSavedSvgs,
  setup,
} from './util.tsx'

// `view.tracks[0].displays[0]` is untyped; annotating it makes a getter that
// doesn't exist on the model a typecheck error rather than a silent undefined.
import type {
  LinearMultiSampleVariantDisplayModel,
  LinearMultiSampleVariantMatrixDisplayModel,
} from '@jbrowse/plugin-variants'

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
  const { view, info } = await openMultiSampleVariantDisplay({
    displayType,
  })
  await findDisplayPainted(info.displayTestId, { timeout: 40000 })

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
  const { view, info } = await openMultiSampleVariantDisplay({
    displayType: 'matrix',
  })
  await findDisplayPainted(info.displayTestId, { timeout: 40000 })
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

// The variant lane end to end, through the real adapter and the real model
// rather than a fixture: the band has to come out of the ROWS (the display
// height is unchanged, the rows start lower and get shorter) and it has to be
// painted, not merely reserved. Reserved-but-blank is the failure mode the slot
// is deliberately kept off the matrix schema to avoid, so it is worth a real
// assertion rather than a geometry unit test alone.
test('the variant lane is painted, and takes its height from the rows', async () => {
  const { view, info } = await openMultiSampleVariantDisplay({
    displayType: 'regular',
  })
  await findDisplayPainted(info.displayTestId, { timeout: 40000 })
  const display: LinearMultiSampleVariantDisplayModel =
    view.tracks[0].displays[0]

  const height = display.height
  const rowsBefore = display.availableHeight
  await view.exportSvg({ rasterizeLayers: false })

  display.setShowVariantLane(true)
  const { laneHeight, markHeight, labelsFit } = display.topBands
  await view.exportSvg({ rasterizeLayers: false })

  // two exports in one test, so index rather than getSavedSvg()
  const [withoutLane, svg] = getSavedSvgs() as [string, string]
  const before = cellRowYs(withoutLane)

  // the track did not grow; the rows gave up the band
  expect(laneHeight).toBeGreaterThan(0)
  expect(display.height).toBe(height)
  expect(display.availableHeight).toBe(rowsBefore - laneHeight)

  // rows, labels and dendrogram all move into one group below the band
  expect(svg).toContain(`transform="translate(0 ${laneHeight})"`)

  // and the band is actually painted: marks at y=0, above that translate, which
  // the lane-less export had none of. `markHeight`, not `laneHeight` — labels
  // are on by default and the marks give up the text strip's height to them.
  const laneMarks = [
    ...svg.matchAll(/<rect[^>]*\by="0"[^>]*\bheight="([\d.]+)"/g),
  ].filter(m => Number(m[1]) === markHeight)
  expect(laneMarks.length).toBeGreaterThan(0)
  expect(cellRowYs(svg).rectCount).toBeGreaterThan(before.rectCount)

  // the labels are exported too, and are the records' own IDs — this VCF's are
  // rs-numbers, so a lettered lane is one that found real names rather than
  // drawing empty strings
  expect(labelsFit).toBe(true)
  expect(markHeight).toBeLessThan(laneHeight)
  expect(svg).toMatch(/<text[^>]*>rs\d+</)
}, 60000)
