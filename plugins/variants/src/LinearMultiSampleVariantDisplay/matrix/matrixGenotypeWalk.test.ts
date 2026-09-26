import { variantMatrixSurface } from './VariantMatrixComponent.tsx'
import { matrixCellAt } from './matrixHitTest.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { CellDataResult } from '../../VariantRPC/executeVariantCellData.ts'

// Enough samples that the fit height falls well under a pixel, which puts
// several rows under the cursor.
const NUM_SAMPLES = 1000
const SAMPLE_NAMES = Array.from({ length: NUM_SAMPLES }, (_, i) => `S${i}`)
const GENOTYPE_DICT = ['0/0', '0/1']
const REF = 1
const ALT = 2

interface Cells {
  ref?: number[]
  alt?: number[]
}

// One column; `ref` and `alt` list the sample rows the worker drew a cell for,
// emitted as it does: the reference bucket, then the alt bucket.
function matrixCellData({ ref = [], alt = [] }: Cells): CellDataResult {
  const genotypeCodes = new Uint32Array(NUM_SAMPLES)
  for (const row of ref) {
    genotypeCodes[row] = REF
  }
  for (const row of alt) {
    genotypeCodes[row] = ALT
  }
  const byRow = (a: number, b: number) => a - b
  const rows = [...ref.toSorted(byRow), ...alt.toSorted(byRow)]
  return {
    mode: 'matrix',
    sampleInfo: {},
    rowNames: SAMPLE_NAMES,
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
    simplifiedFeatures: [
      { id: 'v0', data: { start: 100, end: 101, refName: 'ctgA', name: 'v0' } },
    ],
    genotypeDict: GENOTYPE_DICT,
    sampleNames: SAMPLE_NAMES,
    cellFeatureIndices: new Float32Array(rows.length),
    cellRowIndices: Uint32Array.from(rows),
    cellColors: new Uint32Array(rows.length),
    numCells: rows.length,
    refCellCount: ref.length,
    numFeatures: 1,
    featureData: [
      {
        featureId: 'v0',
        ref: 'A',
        alt: ['T'],
        name: 'v0',
        description: '',
        length: 1,
        insertedBp: 0,
        type: 'SNV',
        genotypeCodes,
      },
    ],
  }
}

function setup(cells: Cells) {
  const { display } = createTestEnvironment().createDisplay()
  display.setSources(SAMPLE_NAMES.map(name => ({ name, sampleName: name })))
  display.setFitToHeight()
  display.setCellData(matrixCellData(cells))
  return display
}

const MOUSE_Y = 100

function rowsUnderCursor() {
  const display = setup({})
  const { nearest, lowest } = matrixCellAt(
    {
      columnWidth: display.columnGeometry.columnWidth,
      effectiveRowHeight: display.effectiveRowHeight,
      scrollTop: display.scrollTop,
    },
    0,
    MOUSE_Y,
  )
  expect(nearest).toBeGreaterThan(lowest)
  return Array.from({ length: nearest - lowest + 1 }, (_, i) => lowest + i)
}

function hitAt(cells: Cells) {
  return variantMatrixSurface(setup(cells)).getHit(0, MOUSE_Y)
}

// a rare variant's carrier pixel: its alt cell paints over the reference cells
// of the rows sharing the pixel, so the tooltip names the carrier
test('the pixel reports the carrier whose alt cell it shows', () => {
  const rows = rowsUnderCursor()
  const carrier = rows[1]!
  const hit = hitAt({ ref: rows.filter(r => r !== carrier), alt: [carrier] })

  expect(hit?.fields.sampleName).toBe(SAMPLE_NAMES[carrier])
  expect(hit?.fields.genotype).toBe('0/1')
})

test('among reference cells, the pixel reports the one painted last', () => {
  const rows = rowsUnderCursor()
  const hit = hitAt({ ref: rows })

  expect(hit?.fields.sampleName).toBe(SAMPLE_NAMES[rows.at(-1)!])
})

// a sample with no genotype at the site draws no cell, so the pixel is blank
test('rows with no drawn cell report nothing', () => {
  rowsUnderCursor()
  expect(hitAt({})).toBeUndefined()
})
