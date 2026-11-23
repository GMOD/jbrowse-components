import Flatbush from '@jbrowse/core/util/flatbush'
import { onPatch } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { featureInfoOf } from '../shared/cellData.fixture.ts'
import { ALT_HUE, cellFill } from '../shared/cellFill.ts'
import { CELL_ALT } from '../shared/variantCellStyles.ts'
import { getCachedABGR } from '../shared/variantWebglUtils.ts'
import { densityRung } from './densityFade.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { CellDataResult } from '../VariantRPC/executeVariantCellData.ts'
import type { CellHueRead } from '../shared/cellHue.ts'

const SAMPLES = ['S0', 'S1', 'S2']
const AF = { field: 'INFO.AF', scale: { type: 'ordinal' } }

function recolor(color: Record<string, unknown>) {
  return { encoding: { color } }
}

function afIn(range: string[]) {
  return recolor({
    ...AF,
    scale: { ...AF.scale, domain: ['0.5'], range },
  })
}
const het = (css: string) => getCachedABGR(cellFill(css, 128))

function featureIndexData() {
  const index = new Flatbush(1, 16, Uint32Array)
  index.add(100, 0, 200, 1)
  index.finish()
  return index.data
}

// one variant whose AF reads '0.5', a het cell on every sample
function cellData(colorRead: CellHueRead): CellDataResult {
  return {
    samplePloidy: Object.fromEntries(SAMPLES.map(name => [name, 2])),
    rowNames: SAMPLES,
    hasPhasedOrHaploid: false,
    colorRead,
    hasConsequence: false,
    hasSvType: false,
    hasPhaseSet: false,
    simplifiedFeatures: [
      { id: 'v0', data: { start: 100, end: 200, refName: 'ctgA', name: 'v0' } },
    ],
    genotypeDict: ['0/1'],
    sampleNames: SAMPLES,
    recordCounts: [],
    perRegionCellData: {
      0: {
        cellRowIndices: Uint32Array.from([0, 1, 2]),
        cellColors: new Uint32Array(3).fill(het(ALT_HUE)),
        cellAltDosage: new Uint8Array(3).fill(128),
        cellFeatureIndices: new Uint32Array(3),
        numCells: 3,
        refCellCount: 0,
        featureCategories: Uint16Array.of(1 << CELL_ALT),
        colorValues: ['0.5'],
        featureColorValues: Uint32Array.of(1),
        featureInfo: [featureInfoOf('v0', { length: 100, svType: 'DEL' })],
        featurePositions: Uint32Array.from([100, 200]),
        featureIndexData: featureIndexData(),
      },
    },
  }
}

// one-base records at each of `starts`, a het cell on every sample, AF '0.5'
function snvsAt(starts: number[], colorRead: CellHueRead): CellDataResult {
  const data = cellData(colorRead)
  const index = new Flatbush(starts.length, 16, Uint32Array)
  for (const [f, start] of starts.entries()) {
    index.add(start, f, start + 1, f + 1)
  }
  index.finish()
  const numCells = starts.length * SAMPLES.length
  return {
    ...data,
    simplifiedFeatures: starts.map((start, f) => ({
      id: `v${f}`,
      data: { start, end: start + 1, refName: 'ctgA', name: `v${f}` },
    })),
    perRegionCellData: {
      0: {
        ...data.perRegionCellData[0]!,
        cellRowIndices: Uint32Array.from({ length: numCells }, (_, i) => i % 3),
        cellColors: new Uint32Array(numCells).fill(het(ALT_HUE)),
        cellAltDosage: new Uint8Array(numCells).fill(128),
        cellFeatureIndices: Uint32Array.from({ length: numCells }, (_, i) =>
          Math.floor(i / 3),
        ),
        numCells,
        featureCategories: new Uint16Array(starts.length).fill(1 << CELL_ALT),
        featureColorValues: new Uint32Array(starts.length).fill(1),
        featureInfo: starts.map((_, f) => featureInfoOf(`v${f}`)),
        featurePositions: Uint32Array.from(starts.flatMap(s => [s, s + 1])),
        featureIndexData: index.data,
      },
    },
  }
}

function setup() {
  const { display, view } = createTestEnvironment().createDisplay()
  display.setSources(SAMPLES.map(name => ({ name })))
  display.applyPlot(afIn(['#aa0000']))
  display.setCellData(cellData({ field: 'INFO.AF' }))
  // the views are observed, as the renderer observes them, so each keeps its
  // value until an input moves
  const dispose = autorun(() => {
    void display.perRegionCellMap
  })
  return { display, view, dispose }
}

const cells = (display: ReturnType<typeof setup>['display']) => [
  ...display.perRegionCellMap.get(0)!.cellColors,
]

test('a recolor repaints the loaded cells and the key', () => {
  const { display, dispose } = setup()
  const key = display.rpcProps()
  expect(cells(display)).toEqual(new Array(3).fill(het('#aa0000')))
  expect(display.paintedDomain).toEqual(['0.5'])

  display.applyPlot(afIn(['#00aa00']))
  expect(display.rpcProps()).toEqual(key)
  expect(cells(display)).toEqual(new Array(3).fill(het('#00aa00')))
  dispose()
})

test('a switch to a constant and back keeps the fetch key', () => {
  const { display, dispose } = setup()
  const key = display.rpcProps()
  display.colorByField(undefined)
  expect(display.rpcProps()).toEqual(key)
  expect(cells(display)).toEqual(new Array(3).fill(het(ALT_HUE)))
  expect(display.paintedDomain).toEqual([])
  display.colorByField('INFO.AF')
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

test('a key label repaints nothing, and a reorder moves only what it reads', () => {
  const { display, dispose } = setup()
  const colors = display.regionCellColors
  const rows = display.placedRegionRows

  display.applyPlot(
    recolor({
      ...AF,
      scale: {
        ...AF.scale,
        domain: ['0.5'],
        range: ['#aa0000'],
        names: ['half'],
      },
      legend: { title: 'Allele frequency' },
    }),
  )
  expect(display.regionCellColors).toBe(colors)

  display.setRowOrder([{ name: 'S1' }, { name: 'S0' }, { name: 'S2' }])
  expect(display.regionCellColors).toBe(colors)
  expect(display.placedRegionRows).not.toBe(rows)
  dispose()
})

test('a recolor of one field keeps the fetch key', () => {
  const { display } = createTestEnvironment().createDisplay()
  display.applyPlot(recolor(AF))
  const key = display.rpcProps()
  display.applyPlot(
    recolor({ ...AF, scale: { ...AF.scale, range: ['#aa0000'] } }),
  )
  expect(display.rpcProps()).toEqual(key)
  display.applyPlot(
    recolor({
      field: 'INFO.AF',
      scale: { type: 'threshold', domain: ['0.01'] },
    }),
  )
  expect(display.rpcProps()).toEqual(key)
  display.applyPlot(
    recolor({ field: 'INFO.DP', scale: { type: 'threshold', domain: ['10'] } }),
  )
  expect(display.rpcProps()).not.toEqual(key)
})

test('a constant reads nothing, and a jexl callback is read in the worker', () => {
  const { display } = createTestEnvironment().createDisplay()
  const key = display.rpcProps()
  display.applyPlot(recolor({ value: '#123456' }))
  expect(display.rpcProps()).toEqual(key)
  display.applyPlot(recolor({ value: "jexl:'#123456'" }))
  expect(display.rpcProps().color).toBe("jexl:'#123456'")
})

// A written field paints over the constant beside it, so the worker reads the
// field, not the callback.
test('the worker reads the field of a channel naming a field and a callback', () => {
  const { display } = createTestEnvironment({
    displayConfig: {
      encoding: { color: { value: "jexl:'#123456'", field: 'INFO.AF' } },
    },
  }).createDisplay()
  expect(display.rpcProps().color).toEqual({ field: 'INFO.AF' })
})

// An all-default `scale` or `legend` must compare alike with the snapshot,
// or a pick of what already paints writes and refetches.
test('a pick of what already paints writes nothing', () => {
  const { display } = createTestEnvironment({
    displayConfig: {
      encoding: { color: { value: '#123456', field: 'INFO.AF' } },
    },
  }).createDisplay()
  const patches: unknown[] = []
  onPatch(display, patch => patches.push(patch))
  display.colorByField('INFO.AF')
  expect(patches).toEqual([])
  display.colorByField(undefined)
  patches.length = 0
  display.setColorValue('#123456')
  expect(patches).toEqual([])
})

// two SNPs on one base, shorter than the 2 px a cell draws
test('records too short to see that share pixels paint their cells faded, keeping the hue', () => {
  const { display } = createTestEnvironment().createDisplay()
  display.setSources(SAMPLES.map(name => ({ name })))
  display.setCellData(snvsAt([100, 100], { field: '' }))
  const painted = [...display.regionCellColors.get(0)!]
  const full = het(ALT_HUE)
  expect(painted.every(c => c >>> 24 < full >>> 24)).toBe(true)
  expect(painted.every(c => (c & 0xffffff) === (full & 0xffffff))).toBe(true)
})

test('a record takes the color of its cells, and a recolor repaints it with no fetch', () => {
  const { display } = createTestEnvironment({
    displayConfig: { records: { show: true } },
  }).createDisplay()
  display.setSources(SAMPLES.map(name => ({ name })))
  display.applyPlot(afIn(['#aa0000']))
  display.setCellData(cellData({ field: 'INFO.AF' }), [0])
  const colorOf = () => [...display.recordsRenderDataMap.get(0)!.rectColors]
  const key = display.rpcProps()
  expect(colorOf()).toEqual([getCachedABGR('#aa0000')])

  display.applyPlot(afIn(['#00aa00']))
  expect(colorOf()).toEqual([getCachedABGR('#00aa00')])
  expect(display.rpcProps()).toEqual(key)
})

test('a zoom that keeps the density rung repaints no cell', () => {
  const { display, view, dispose } = setup()
  const rung = densityRung(view.bpPerPx)
  view.zoomTo(rung * 1.1)
  const painted = display.perRegionCellMap
  view.zoomTo(rung * 1.2)
  expect(densityRung(view.bpPerPx)).toBe(rung)
  expect(display.perRegionCellMap === painted).toBe(true)
  dispose()
})

// 10 bp apart, two one-base records share no pixel at 2 bp/px and share one
// at 8 bp/px
test('a zoom across a density rung that fades nothing repaints no cell', () => {
  const { display, view, dispose } = setup()
  display.setCellData(snvsAt([100, 110], { field: 'INFO.AF' }))
  view.zoomTo(1)
  const painted = display.perRegionCellMap
  view.zoomTo(2)
  expect(densityRung(view.bpPerPx)).toBe(2)
  expect(display.perRegionCellMap === painted).toBe(true)
  dispose()
})

test('a zoom across a density rung that changes a fade repaints the cells', () => {
  const { display, view, dispose } = setup()
  display.setCellData(snvsAt([100, 110], { field: 'INFO.AF' }))
  view.zoomTo(1)
  const painted = display.perRegionCellMap
  view.zoomTo(8)
  expect(densityRung(view.bpPerPx)).toBe(8)
  expect(display.perRegionCellMap === painted).toBe(false)
  expect(cells(display).every(c => c >>> 24 < het('#aa0000') >>> 24)).toBe(true)
  dispose()
})

test('a new payload whose records fade alike repaints its cells', () => {
  const { display, view, dispose } = setup()
  view.zoomTo(8)
  display.setCellData(snvsAt([100, 110], { field: 'INFO.AF' }))
  const alpha = display.regionRecordAlpha
  expect(alpha.get(0)).toBeDefined()
  const rgb = () => new Set(cells(display).map(c => c & 0xffffff))
  expect(rgb()).toEqual(new Set([het('#aa0000') & 0xffffff]))
  display.setCellData(snvsAt([100, 110], { field: 'INFO.DP' }))
  expect(display.regionRecordAlpha).toBe(alpha)
  expect(rgb()).toEqual(new Set([het(ALT_HUE) & 0xffffff]))
  dispose()
})

test('in columns, which draw no density fade, a zoom repaints no cell', () => {
  const { display, view, dispose } = setup()
  display.setVariantLayout('columns')
  const keep = autorun(() => {
    void display.paintedRegionRows
  })
  const painted = display.paintedRegionRows
  view.zoomTo(densityRung(view.bpPerPx) * 4)
  expect(display.paintedRegionRows === painted).toBe(true)
  keep()
  dispose()
})
