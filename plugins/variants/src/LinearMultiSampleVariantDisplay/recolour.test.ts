import Flatbush from '@jbrowse/core/util/flatbush'
import { autorun } from 'mobx'

import { ALT_HUE, cellFill } from '../shared/cellFill.ts'
import { CELL_ALT } from '../shared/variantCellStyles.ts'
import { getCachedABGR } from '../shared/variantWebglUtils.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { CellDataResult } from '../VariantRPC/executeVariantCellData.ts'
import type { CellHueRead } from '../shared/cellHue.ts'

const SAMPLES = ['S0', 'S1', 'S2']
const AF = { field: 'INFO.AF', scale: 'categorical' as const }
const het = (css: string) => getCachedABGR(cellFill(css, 128, true))

function featureIndexData() {
  const index = new Flatbush(1, 16, Uint32Array)
  index.add(100, 0, 200, 1)
  index.finish()
  return index.data
}

// one variant whose AF reads '0.5', a het cell on every sample
function cellData(colorRead: CellHueRead): CellDataResult {
  return {
    mode: 'regular',
    samplePloidy: Object.fromEntries(SAMPLES.map(name => [name, 2])),
    rowNames: SAMPLES,
    hasPhasedOrHaploid: false,
    hasSecondaryAlt: false,
    hasUnphased: false,
    hasNoCall: false,
    colorRead,
    hasConsequence: false,
    hasSvType: false,
    hasPhaseSet: false,
    simplifiedFeatures: [
      { id: 'v0', data: { start: 100, end: 200, refName: 'ctgA', name: 'v0' } },
    ],
    genotypeDict: ['0/1'],
    sampleNames: SAMPLES,
    perRegionCellData: {
      0: {
        cellPositions: Uint32Array.from([100, 200, 100, 200, 100, 200]),
        cellRowIndices: Uint32Array.from([0, 1, 2]),
        cellColors: new Uint32Array(3).fill(het(ALT_HUE)),
        cellShapeTypes: new Uint8Array(3),
        cellAltDosage: new Uint8Array(3).fill(128),
        cellCategories: new Uint8Array(3).fill(CELL_ALT),
        cellFeatureIndices: new Uint32Array(3),
        numCells: 3,
        refCellCount: 0,
        paintedCategories: 0,
        colorValues: ['0.5'],
        paintedColorValues: [0],
        featureColorValues: Uint32Array.of(1),
        featureGenotypeMap: {},
        featureIdList: ['v0'],
        featurePositions: Uint32Array.from([100, 200]),
        featureIndexData: featureIndexData(),
        featureInsertedBp: Int32Array.from([0]),
      },
    },
  }
}

function setup() {
  const { display } = createTestEnvironment().createDisplay()
  display.setSources(SAMPLES.map(name => ({ name })))
  display.setColor({ ...AF, domain: ['0.5'], range: ['#aa0000'] })
  display.setCellData(cellData({ field: 'INFO.AF' }))
  // the views are observed, as the renderer observes them, so each keeps its
  // value until an input moves
  const dispose = autorun(() => {
    void display.perRegionCellMap
    void display.regionFeatureColors
  })
  return { display, dispose }
}

const cells = (display: ReturnType<typeof setup>['display']) => [
  ...display.perRegionCellMap.get(0)!.cellColors,
]

test('a recolour repaints the loaded cells, the lane and the key', () => {
  const { display, dispose } = setup()
  const key = display.rpcProps()
  expect(cells(display)).toEqual(new Array(3).fill(het('#aa0000')))
  expect(display.paintedDomain).toEqual(['0.5'])

  display.setColor({ ...AF, domain: ['0.5'], range: ['#00aa00'] })
  expect(display.rpcProps()).toEqual(key)
  expect(cells(display)).toEqual(new Array(3).fill(het('#00aa00')))
  expect([...display.regionFeatureColors.get(0)!]).toEqual([
    getCachedABGR('#00aa00'),
  ])

  display.setShadeByDosage(false)
  expect(cells(display)).toEqual(new Array(3).fill(getCachedABGR('#00aa00')))
  dispose()
})

test('a switch to a constant and back keeps the fetch key', () => {
  const { display, dispose } = setup()
  const key = display.rpcProps()
  display.setColorField('')
  expect(display.rpcProps()).toEqual(key)
  expect(cells(display)).toEqual(new Array(3).fill(het(ALT_HUE)))
  expect(display.paintedDomain).toEqual([])
  display.setColorField('INFO.AF')
  expect(display.rpcProps()).toEqual(key)
  expect(cells(display)).toEqual(new Array(3).fill(het('#aa0000')))
  dispose()
})

test('values read for another field paint as though none were read', () => {
  const { display, dispose } = setup()
  display.setCellData(cellData({ field: 'INFO.DP' }))
  expect(cells(display)).toEqual(new Array(3).fill(het(ALT_HUE)))
  expect(display.paintedDomain).toEqual([])
  dispose()
})

test('a key label repaints nothing, and a reorder or shading moves only what it reads', () => {
  const { display, dispose } = setup()
  const colors = display.regionCellColors
  const lane = display.regionFeatureColors
  const rows = display.placedRegionRows

  display.setColor({
    ...AF,
    domain: ['0.5'],
    range: ['#aa0000'],
    labels: ['half'],
    title: 'Allele frequency',
  })
  expect(display.regionCellColors).toBe(colors)
  expect(display.regionFeatureColors).toBe(lane)

  display.setRowOrder([{ name: 'S1' }, { name: 'S0' }, { name: 'S2' }])
  expect(display.regionCellColors).toBe(colors)
  expect(display.placedRegionRows).not.toBe(rows)

  const placed = display.placedRegionRows
  display.setShadeByDosage(false)
  expect(display.placedRegionRows).toBe(placed)
  expect(display.regionFeatureColors).toBe(lane)
  expect(display.regionCellColors).not.toBe(colors)
  dispose()
})

test('a recolour of one field keeps the fetch key', () => {
  const { display } = createTestEnvironment().createDisplay()
  display.setColor(AF)
  const key = display.rpcProps()
  display.setColor({ ...AF, range: ['#aa0000'] })
  expect(display.rpcProps()).toEqual(key)
  display.setColor({ field: 'INFO.AF', scale: 'threshold', domain: ['0.01'] })
  expect(display.rpcProps()).toEqual(key)
  display.setShadeByDosage(false)
  expect(display.rpcProps()).toEqual(key)
  display.setColor({ field: 'INFO.DP', scale: 'threshold', domain: ['10'] })
  expect(display.rpcProps()).not.toEqual(key)
})

test('a constant reads nothing, and a jexl callback is read in the worker', () => {
  const { display } = createTestEnvironment().createDisplay()
  const key = display.rpcProps()
  display.setColor({ value: '#123456' })
  expect(display.rpcProps()).toEqual(key)
  display.setColor({ value: "jexl:'#123456'" })
  expect(display.rpcProps().color).toBe("jexl:'#123456'")
})

test('the frequency band stacks the painted cells and follows a recolour without a refetch', () => {
  const { display, dispose } = setup()
  const key = display.rpcProps()
  display.setShowGenotypeFrequencies(true)
  const band = () => display.regionFrequencyColumns.get(0)!.columns
  expect([...band().segmentColor]).toEqual([het('#aa0000')])
  expect([...band().segmentCount]).toEqual([3])

  display.setColor({ ...AF, domain: ['0.5'], range: ['#00aa00'] })
  expect([...band().segmentColor]).toEqual([het('#00aa00')])
  expect(display.rpcProps()).toEqual(key)
  dispose()
})

// A focus is a fetch input, so the payload that lands can carry a row the
// display no longer draws; its cell is placed on HIDDEN_ROW and not counted.
test('the frequency band counts the drawn rows alone', () => {
  const { display, dispose } = setup()
  display.setShowGenotypeFrequencies(true)
  display.setRowFocus(['S0', 'S2'])
  display.setCellData(cellData({ field: 'INFO.AF' }))
  const { columns } = display.regionFrequencyColumns.get(0)!
  expect(columns.drawnRows).toBe(2)
  expect([...columns.segmentCount]).toEqual([2])
  dispose()
})
