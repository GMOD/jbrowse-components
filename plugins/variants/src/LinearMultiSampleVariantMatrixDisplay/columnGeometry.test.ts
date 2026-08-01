import { createTestEnvironment } from './testEnv.ts'

import type { CellDataResult } from '../VariantRPC/executeVariantCellData.ts'

// The matrix lays columns out by feature index, so only the positional fields of
// the payload matter here; the cell buffers stay empty (nothing is painted).
function matrixCellData(starts: number[]): CellDataResult {
  return {
    mode: 'matrix',
    sampleInfo: {},
    hasPhased: false,
    maxAltCount: 1,
    hasUnphased: false,
    hasNoCall: false,
    hasConsequence: false,
    hasSvType: false,
    hasPhaseSet: false,
    svTypeColors: {},
    simplifiedFeatures: starts.map((start, i) => ({
      id: `v${i}`,
      data: { start, end: start + 1, refName: 'ctgA', name: `v${i}` },
    })),
    genotypeDict: [],
    sampleNames: [],
    cellFeatureIndices: new Float32Array(0),
    cellRowIndices: new Uint32Array(0),
    cellColors: new Uint32Array(0),
    numCells: 0,
    numFeatures: starts.length,
    featureData: [],
  }
}

// Four variants in an 8kb window shown at bpPerPx 10, so the content is exactly
// the 800px viewport: four 200px columns, and each variant's genomic x is its
// own bp/10 (or mirrored, on a reversed region).
function loadedDisplay({ reversed = false } = {}) {
  const { createDisplay } = createTestEnvironment()
  const { display, view } = createDisplay()
  view.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 8000, refName: 'ctgA', reversed },
  ])
  view.zoomTo(10)
  view.scrollTo(0)
  display.setCellData(matrixCellData([0, 1000, 3000, 7000]))
  return { display, view }
}

test('columns are evenly pitched across the content width', () => {
  const { display } = loadedDisplay()

  expect(display.columnGeometry).toEqual({ n: 4, columnWidth: 200, left: 0 })
  expect(display.connectorLineCoords).toEqual([
    { mx: 100, gx: 0, label: 'v0' },
    { mx: 300, gx: 100, label: 'v1' },
    { mx: 500, gx: 300, label: 'v2' },
    { mx: 700, gx: 700, label: 'v3' },
  ])
})

test('the crosshair anchors to the column it sits in, not the nearest edge', () => {
  const { display } = loadedDisplay()

  // anywhere inside column 2 (400-600px) resolves to that column's center and
  // its own variant's genomic x
  expect(display.connectorLineAtScreenX(410)).toEqual({ mx: 500, gx: 300 })
  expect(display.connectorLineAtScreenX(599)).toEqual({ mx: 500, gx: 300 })
  expect(display.connectorLineAtScreenX(601)).toEqual({ mx: 700, gx: 700 })
})

// The regression risk `mirrorColumnIndex` carries: it is its own inverse, so a
// screen->data lookup that forgets the mirror still returns a plausible-looking
// column — just the wrong variant's genomic x, and the crosshair line points at
// a locus the user isn't hovering.
test('a flipped view mirrors the crosshair back to the data feature', () => {
  const { display } = loadedDisplay({ reversed: true })

  expect(display.flipped).toBe(true)
  // screen column 0 now holds the LAST variant (bp 7000), whose reversed
  // genomic x is (8000-7000)/10 = 100 — left of screen, like its column
  expect(display.connectorLineAtScreenX(100)).toEqual({ mx: 100, gx: 100 })
  // and the whole field runs right-to-left with it
  expect(display.connectorLineCoords).toEqual([
    { mx: 700, gx: 800, label: 'v0' },
    { mx: 500, gx: 700, label: 'v1' },
    { mx: 300, gx: 500, label: 'v2' },
    { mx: 100, gx: 100, label: 'v3' },
  ])
})

test('there is no connector off either end of the matrix', () => {
  const { display } = loadedDisplay()

  expect(display.connectorLineAtScreenX(-1)).toBeUndefined()
  expect(display.connectorLineAtScreenX(800)).toBeUndefined()
})

test('no data means no columns and no connectors', () => {
  const { createDisplay } = createTestEnvironment()
  const { display } = createDisplay()

  expect(display.columnGeometry.columnWidth).toBe(0)
  expect(display.connectorLineCoords).toEqual([])
  expect(display.connectorLineAtScreenX(400)).toBeUndefined()
})
