import { autorun } from 'mobx'

import { createTestEnvironment } from './testEnv.ts'

import type { CellDataResult } from '../VariantRPC/executeVariantCellData.ts'

// The matrix lays columns out by feature index, so only the positional fields of
// the payload matter here; the cell buffers stay empty (nothing is painted).
function matrixCellData(starts: number[], refNames?: string[]): CellDataResult {
  return {
    mode: 'matrix',
    sampleInfo: {},
    rowNames: [],
    hasPhased: false,
    hasSecondaryAlt: false,
    hasUnphased: false,
    hasNoCall: false,
    hasConsequence: false,
    hasSvType: false,
    hasPhaseSet: false,
    svTypeColors: {},
    simplifiedFeatures: starts.map((start, i) => ({
      id: `v${i}`,
      data: {
        start,
        end: start + 1,
        refName: refNames?.[i] ?? 'ctgA',
        name: `v${i}`,
      },
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
function loadedDisplay({
  reversed = false,
  starts = [0, 1000, 3000, 7000],
  refNames,
}: { reversed?: boolean; starts?: number[]; refNames?: string[] } = {}) {
  const { createDisplay } = createTestEnvironment()
  const { display, view } = createDisplay()
  view.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 8000, refName: 'ctgA', reversed },
  ])
  view.zoomTo(10)
  view.scrollTo(0)
  display.setCellData(matrixCellData(starts, refNames))
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

// The crosshair reads the same per-column list the field draws from, which is
// what `connectorCoordsByColumn` is for — the highlight IS one of the lines
// rather than a second computation of where that line goes, so it carries the
// label too.
test('the crosshair anchors to the column it sits in, not the nearest edge', () => {
  const { display } = loadedDisplay()

  // anywhere inside column 2 (400-600px) resolves to that column's center and
  // its own variant's genomic x
  expect(display.connectorLineAtScreenX(410)).toEqual(
    display.connectorLineCoords[2],
  )
  expect(display.connectorLineAtScreenX(599)).toEqual({
    mx: 500,
    gx: 300,
    label: 'v2',
  })
  expect(display.connectorLineAtScreenX(601)).toEqual({
    mx: 700,
    gx: 700,
    label: 'v3',
  })
})

// A reversed region takes no special case here at all: the worker reflects that
// region's features onto themselves before shipping them (orderByScreenPosition),
// so the payload below is descending in bp and the display just lays it out.
// What the display must not do is re-derive an orientation of its own — the
// mirror this replaced was a second opinion about which way the axis ran, and
// wrong whenever it disagreed with the order it was given.
test('a reversed region is drawn from the order the worker sent', () => {
  const { display } = loadedDisplay({
    reversed: true,
    starts: [7000, 3000, 1000, 0],
  })

  // gx on a reversed region is (8000 - bp) / 10, so both axes ascend together:
  // no connector crosses another
  expect(display.connectorLineCoords).toEqual([
    { mx: 100, gx: 100, label: 'v0' },
    { mx: 300, gx: 500, label: 'v1' },
    { mx: 500, gx: 700, label: 'v2' },
    { mx: 700, gx: 800, label: 'v3' },
  ])
  expect(display.connectorLineAtScreenX(100)).toEqual({
    mx: 100,
    gx: 100,
    label: 'v0',
  })
})

// A column still occupies its slot when its feature has no genomic x — the
// refName left the displayed regions, so there is nothing on the ruler to point
// at and the line is dropped. The crosshair must keep counting columns, not
// drawn lines: indexing the filtered list instead answers with the NEXT
// variant's connector for every column past the gap.
test('a column with no genomic x drops its line without shifting the rest', () => {
  const { display } = loadedDisplay({
    refNames: ['ctgA', 'ctgB', 'ctgA', 'ctgA'],
  })

  expect(display.connectorLineCoords).toEqual([
    { mx: 100, gx: 0, label: 'v0' },
    { mx: 500, gx: 300, label: 'v2' },
    { mx: 700, gx: 700, label: 'v3' },
  ])
  // column 1 is the dropped one; columns 2 and 3 still answer with their own
  expect(display.connectorLineAtScreenX(300)).toBeUndefined()
  expect(display.connectorLineAtScreenX(500)).toEqual({
    mx: 500,
    gx: 300,
    label: 'v2',
  })
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

// The matrix body sizes its canvas off `canvasWidth`, and it is an observer, so
// what it reads is what re-renders it. Reading the width out of `renderState`
// instead looks equivalent — the field holds this same number — but that getter
// also carries `scrollTop`, so every wheel frame over the rows invalidated the
// component that mounts the canvas and the whole hit-test wiring under it. Same
// reason `MatrixBodyOffset` is its own observer, one file over.
test('scrolling the rows does not invalidate the width the canvas is sized by', () => {
  const { display } = loadedDisplay()
  display.setSources(Array.from({ length: 40 }, (_, i) => ({ name: `HG${i}` })))
  display.setRowHeight(50)
  expect(display.scrollableHeight).toBeGreaterThan(0)

  let widthReads = 0
  const stop = autorun(() => {
    void display.canvasWidth
    widthReads++
  })
  display.setScrollTop(50)
  display.setScrollTop(100)
  stop()

  expect(display.scrollTop).toBe(100)
  expect(widthReads).toBe(1)
})
