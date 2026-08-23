import Flatbush from '@jbrowse/core/util/flatbush'

import { HIDDEN_ROW } from '../shared/constants.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { CellDataResult } from '../VariantRPC/executeVariantCellData.ts'

const SAMPLES = ['S0', 'S1', 'S2']

function featureIndexData(numFeatures: number) {
  const index = new Flatbush(Math.max(numFeatures, 1), 16, Uint32Array)
  for (let i = 0; i < Math.max(numFeatures, 1); i++) {
    index.add(100, 0, 200, 1)
  }
  index.finish()
  return index.data
}

/**
 * One variant, one cell per sample, rows numbered in the worker's own order —
 * i.e. the order `rowNames` declares, which is deliberately unrelated to what
 * the display draws. `rowNames` is what the client places against.
 */
function regularCellData(rowNames: string[]): CellDataResult {
  const numCells = rowNames.length
  return {
    mode: 'regular',
    sampleInfo: Object.fromEntries(
      SAMPLES.map(name => [name, { maxPloidy: 2, isPhased: false }]),
    ),
    rowNames,
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
      { id: 'v0', data: { start: 100, end: 200, refName: 'ctgA', name: 'v0' } },
    ],
    genotypeDict: ['0|1'],
    sampleNames: SAMPLES,
    perRegionCellData: {
      0: {
        cellPositions: Uint32Array.from(rowNames.flatMap(() => [100, 200])),
        // worker row r gets a cell whose colour encodes r, so a mis-placement
        // is visible as the wrong colour on a row rather than just a wrong index
        cellRowIndices: Uint32Array.from(rowNames.map((_, r) => r)),
        cellColors: Uint32Array.from(rowNames.map((_, r) => 0xff0000 + r)),
        cellShapeTypes: new Uint8Array(numCells),
        cellAltDosage: new Uint8Array(numCells).fill(1),
        cellFeatureIndices: new Uint32Array(numCells),
        numCells,
        refCellCount: 0,
        featureGenotypeMap: {},
        featureIdList: ['v0'],
        featurePositions: Uint32Array.from([100, 200]),
        featureIndexData: featureIndexData(1),
        featureInsertedBp: Int32Array.from([0]),
        featureColors: Uint32Array.from([0xff00ff00]),
      },
    },
  }
}

// worker row -> screen row, read off the placed cells' colours
function placement(display: { perRegionCellMap: Map<number, unknown> }) {
  const region = display.perRegionCellMap.get(0) as
    | { cellRowIndices: Uint32Array; cellColors: Uint32Array; numCells: number }
    | undefined
  if (!region) {
    return undefined
  }
  const out: Record<number, number> = {}
  for (let i = 0; i < region.numCells; i++) {
    out[region.cellColors[i]! - 0xff0000] = region.cellRowIndices[i]!
  }
  return out
}

function setup() {
  const { display } = createTestEnvironment().createDisplay()
  display.setSources(SAMPLES.map(name => ({ name })))
  // the worker's row order is its own; here it happens to be reversed relative
  // to the adapter order, which is exactly the case identity placement gets
  // wrong while looking plausible
  display.setCellData(regularCellData(['S2', 'S1', 'S0']))
  return display
}

describe('multi-sample variant row placement', () => {
  test('places worker rows by name, not by position', () => {
    const display = setup()
    // no layout: rows draw in adapter order S0,S1,S2, so the worker's row 0
    // ("S2") belongs at the bottom
    expect(placement(display)).toEqual({ 0: 2, 1: 1, 2: 0 })
  })

  test('a reorder re-places the cells already in hand', () => {
    const display = setup()
    display.setLayout([{ name: 'S1' }, { name: 'S0' }, { name: 'S2' }])
    // worker rows are ["S2","S1","S0"], screen order is S1,S0,S2
    expect(placement(display)).toEqual({ 0: 2, 1: 0, 2: 1 })
  })

  test('a reorder does not invalidate the fetch', () => {
    const display = setup()
    const before = display.rpcPropsCacheKey
    display.setLayout([{ name: 'S2' }, { name: 'S0' }, { name: 'S1' }])

    // `SettingsInvalidate` watches exactly this string — an unchanged key is
    // what makes a reorder a re-upload instead of a fresh download of the whole
    // VCF window. The row order used to be in the payload, so it changed here.
    expect(display.rpcPropsCacheKey).toBe(before)
    expect(display.cellData).toBeDefined()
  })

  test('the fetched row set is sent sorted, so only membership can change it', () => {
    const display = setup()
    expect(display.sampleFilter).toEqual(['S0', 'S1', 'S2'])
    display.setLayout([{ name: 'S2' }, { name: 'S1' }, { name: 'S0' }])
    expect(display.sampleFilter).toEqual(['S0', 'S1', 'S2'])
    // a layout is an ordering hint, not the row set: one that omits a sample
    // still fetches it (the omitted row is appended), same rule the other row
    // displays get from `reconcileLayout`
    display.setLayout([{ name: 'S2' }, { name: 'S0' }])
    expect(display.sampleFilter).toEqual(['S0', 'S1', 'S2'])

    // membership genuinely changing does invalidate: fewer rows is less to
    // compute, so it stays a fetch input. Narrowing is the subtree filter's
    // job — the same call maf makes.
    const key = display.rpcPropsCacheKey
    display.setSubtreeFilter(['S0', 'S2'])
    expect(display.sampleFilter).toEqual(['S0', 'S2'])
    expect(display.rpcPropsCacheKey).not.toBe(key)
  })

  test('a row the display is not drawing is placed off-canvas, not at row 0', () => {
    const { display } = createTestEnvironment().createDisplay()
    display.setSources(SAMPLES.map(name => ({ name })))
    // Narrow the drawn rows first, so the payload that arrives afterwards
    // carries a row the display has no place for. Doing it the other way round
    // clears the cells outright — a membership change IS a fetch input, as the
    // test above pins — so this is the order the case actually occurs in.
    display.setSubtreeFilter(['S0', 'S2'])
    display.setCellData(regularCellData(['S2', 'S1', 'S0']))

    // S1 has no screen row; placing it at 0 would paint it under S0's label
    expect(placement(display)).toEqual({ 0: 1, 1: HIDDEN_ROW, 2: 0 })
  })

  test('places haplotype rows, whose names both sides have to spell alike', () => {
    const { display } = createTestEnvironment().createDisplay()
    // phased first: switching mode is a real fetch input, so doing it after the
    // data lands would just clear it
    display.setPhasedMode('phased')
    display.setSources([{ name: 'S0' }, { name: 'S1' }])
    // the worker's rows, in its own order — `buildCanonicalRows` produces these
    // strings, `sources` produces the screen ones, and if the two conventions
    // ever drift every phased row silently lands on HIDDEN_ROW
    display.setCellData(
      regularCellData(['S1 HP1', 'S0 HP0', 'S1 HP0', 'S0 HP1']),
    )

    expect(display.sources.map(s => s.name)).toEqual([
      'S0 HP0',
      'S0 HP1',
      'S1 HP0',
      'S1 HP1',
    ])
    expect(placement(display)).toEqual({ 0: 3, 1: 0, 2: 2, 3: 1 })
    // and the fetched set is per SAMPLE, not per haplotype
    expect(display.sampleFilter).toEqual(['S0', 'S1'])
  })

  test('holds nothing until the row names are known', () => {
    const { display } = createTestEnvironment().createDisplay()
    display.setSources(SAMPLES.map(name => ({ name })))
    expect(display.perRegionCellMap.size).toBe(0)
    expect(display.rowRemap).toBeUndefined()
  })
})
