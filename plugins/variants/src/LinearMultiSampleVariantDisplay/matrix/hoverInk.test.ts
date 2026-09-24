import { f2 } from '../../shared/constants.ts'
import { findCellIndex } from '../../shared/variantCellLookup.ts'
import { variantMatrixSurface } from './VariantMatrixComponent.tsx'
import { createTestEnvironment } from './testEnv.ts'

import type { CellDataResult } from '../../VariantRPC/executeVariantCellData.ts'

type MatrixCellDataResult = Extract<CellDataResult, { mode: 'matrix' }>

// Two sites over two samples, every cell called: S0 is hom-ref at both, S1
// carries the alt at both, so the reference bucket holds S0's two cells and the
// non-reference bucket S1's. Rows are named in the worker's order, and the
// sources below reverse it, so a screen row is not its worker row.
const ROW_NAMES = ['S0', 'S1']
const SOURCES = [
  { name: 'S1', sampleName: 'S1' },
  { name: 'S0', sampleName: 'S0' },
]

function matrixCellData(): MatrixCellDataResult {
  return {
    mode: 'matrix',
    sampleInfo: {},
    rowNames: ROW_NAMES,
    hasPhased: false,
    hasPhasedOrHaploid: false,
    hasSecondaryAlt: false,
    hasUnphased: false,
    hasNoCall: false,
    hasConsequence: false,
    hasSvType: false,
    hasPhaseSet: false,
    svTypeColors: {},
    paintedCategories: 0,
    paintedDomain: [],
    simplifiedFeatures: [0, 1000].map((start, i) => ({
      id: `v${i}`,
      data: { start, end: start + 1, refName: 'ctgA', name: `v${i}` },
    })),
    genotypeDict: ['0/0', '1/1'],
    sampleNames: ROW_NAMES,
    // reference bucket first, then non-reference, each feature-major
    cellFeatureIndices: Float32Array.of(0, 1, 0, 1),
    cellRowIndices: Uint32Array.of(0, 0, 1, 1),
    cellColors: Uint32Array.of(0xffcccccc, 0xffcccccc, 0xff0000ff, 0xff0000ff),
    numCells: 4,
    refCellCount: 2,
    numFeatures: 2,
    featureData: [0, 1].map(i => ({
      featureId: `v${i}`,
      ref: 'A',
      alt: ['T'],
      name: `v${i}`,
      description: '',
      length: 1,
      insertedBp: 0,
      type: 'SNV',
      genotypeCodes: Uint32Array.of(1, 2),
    })),
  }
}

// An 8kb window at bpPerPx 10 fills the 800px viewport, so the two columns are
// 400px each and the content starts at the viewport's left edge.
function loadedDisplay() {
  const { display, view } = createTestEnvironment().createDisplay()
  view.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 8000, refName: 'ctgA' },
  ])
  view.zoomTo(10)
  view.scrollTo(0)
  display.setSources(SOURCES)
  display.setRowHeight(20)
  display.setCellData(matrixCellData())
  return display
}

test('the hovered cell lights the box its instance painted, in the chrome', () => {
  const display = loadedDisplay()
  expect(display.hoverInk).toEqual([])

  // S1's cell at site 1: worker row 1, drawn on screen row 0
  display.setHoveredMatrixCell({ cellIndex: 3 })
  const { rowsTopOffset } = display
  expect(display.columnGeometry).toEqual({ n: 2, columnWidth: 400, left: 0 })
  expect(display.hoverInk).toHaveLength(1)
  const { left, top, width, height } = display.hoverInk[0]!
  expect(left).toBeCloseTo(400 - f2)
  expect(top).toBeCloseTo(rowsTopOffset - f2)
  expect(width).toBeCloseTo(400 + f2)
  expect(height).toBeCloseTo(20 + f2)
  expect(display.highlightStyle).toBe('box')
})

test('the hit names the drawn cell the tooltip reports, and the hover lights it', () => {
  const display = loadedDisplay()
  const surface = variantMatrixSurface(display)

  // column 1, screen row 1: S0 at site 1, a reference cell
  const hit = surface.getHit(410, 25)!
  expect(hit.fields.sampleName).toBe('S0')
  expect(hit.fields.genotype).toBe('0/0')
  expect(hit.cell).toEqual({
    cellIndex: findCellIndex(display.placedMatrixData!, 1, 0),
  })
  expect(hit.cell!.cellIndex).toBe(1)

  surface.onHover!(hit)
  expect(display.hoveredMatrixCell).toEqual({ cellIndex: 1 })
  expect(display.hoverInk[0]!.top).toBeCloseTo(display.rowsTopOffset + 20 - f2)

  display.clearHoveredFeature()
  expect(display.hoveredMatrixCell).toBeUndefined()
  expect(display.hoverInk).toEqual([])
})

test('a genotype the worker drew no cell for hovers with no box', () => {
  const display = loadedDisplay()
  // a hom-ref call at S0, site 0, but the reference bucket holds only site 1
  display.setCellData({
    ...matrixCellData(),
    cellFeatureIndices: Float32Array.of(1, 0, 1),
    cellRowIndices: Uint32Array.of(0, 1, 1),
    cellColors: Uint32Array.of(0xffcccccc, 0xff0000ff, 0xff0000ff),
    numCells: 3,
    refCellCount: 1,
  })
  const hit = variantMatrixSurface(display).getHit(10, 25)!
  expect(hit.fields.genotype).toBe('0/0')
  expect(hit.cell).toBeUndefined()
})
