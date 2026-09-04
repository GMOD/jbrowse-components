import { createTestEnvironment } from '../testEnv.ts'
import { variantMatrixSurface } from './VariantMatrixComponent.tsx'
import { matrixCellAt } from './matrixHitTest.ts'

import type { CellDataResult } from '../../VariantRPC/executeVariantCellData.ts'

// Enough samples that the fit height falls well under a pixel, which is what
// puts several rows under the cursor and gives the walk somewhere to go wrong.
const NUM_SAMPLES = 1000
const SAMPLE_NAMES = Array.from({ length: NUM_SAMPLES }, (_, i) => `S${i}`)

// dict[0] is the empty genotype string. Reachable at this boundary by
// construction: the payload is what the display hit-tests against, and the
// invariant that keeps '' out of the dictionary lives two modules away in the
// worker, restated by hand on each of `computeSampleInfo`'s two genotype paths.
const GENOTYPE_DICT = ['', '0|1']

function matrixCellData(codesBySample: Record<number, number>): CellDataResult {
  const genotypeCodes = new Uint32Array(NUM_SAMPLES)
  for (const [sampleIdx, code] of Object.entries(codesBySample)) {
    genotypeCodes[Number(sampleIdx)] = code
  }
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
    simplifiedFeatures: [
      { id: 'v0', data: { start: 100, end: 101, refName: 'ctgA', name: 'v0' } },
    ],
    genotypeDict: GENOTYPE_DICT,
    sampleNames: SAMPLE_NAMES,
    cellFeatureIndices: new Float32Array(0),
    cellRowIndices: new Uint32Array(0),
    cellColors: new Uint32Array(0),
    numCells: 0,
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

function setup(codesBySample: Record<number, number>) {
  const { display } = createTestEnvironment().createDisplay()
  display.setSources(SAMPLE_NAMES.map(name => ({ name, sampleName: name })))
  display.setFitToHeight()
  display.setCellData(matrixCellData(codesBySample))
  return display
}

const MOUSE_Y = 100

// The rows the walk will visit, off the display's own geometry, so the fixture
// files its genotypes against the right sample indices.
function rowsAt(display: ReturnType<typeof setup>) {
  return matrixCellAt(
    {
      columnWidth: display.columnGeometry.columnWidth,
      effectiveRowHeight: display.effectiveRowHeight,
      scrollTop: display.scrollTop,
    },
    0,
    MOUSE_Y,
  )
}

test('the hovered cell reports its own row, not the next one down', () => {
  const { nearest, lowest } = rowsAt(setup({}))
  expect(nearest).toBeGreaterThan(lowest)

  // The row the cursor is in carries an empty genotype; the row below it, the
  // next one the walk would try, carries a real one.
  const display = setup({ [nearest]: 1, [nearest - 1]: 2 })
  const hit = variantMatrixSurface(display).getHit(0, MOUSE_Y)

  expect(hit?.fields.sampleName).toBe(SAMPLE_NAMES[nearest])
  expect(hit?.fields.genotype).toBe('')
})

// Walking past rows with nothing filed against them is the point of the band —
// at the 2,504-sample fit height eleven rows share a pixel and only some are
// called — so the guard must not become "report the nearest row whatever".
test('a row with no genotype at all is still walked past', () => {
  const { nearest } = rowsAt(setup({}))

  const display = setup({ [nearest - 1]: 2 })
  const hit = variantMatrixSurface(display).getHit(0, MOUSE_Y)

  expect(hit?.fields.sampleName).toBe(SAMPLE_NAMES[nearest - 1])
  expect(hit?.fields.genotype).toBe('0|1')
})
