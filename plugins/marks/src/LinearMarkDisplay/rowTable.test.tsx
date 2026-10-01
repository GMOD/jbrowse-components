import { setConf } from '@jbrowse/core/configuration'
import { MockHal } from '@jbrowse/render-core/hal'
import { rowSlot } from '@jbrowse/render-core/marks'
import { GpuMarkBackend } from '@jbrowse/render-core/marks/backend'
import { render, screen } from '@testing-library/react'

import MarkTooltip from './components/MarkTooltip.tsx'
import { findMarkHit } from './findMarkHit.ts'
import { listingNamesRows } from './rowTable.ts'
import {
  REGION,
  createTestEnvironment,
  features,
  workerResult,
} from './testEnv.ts'
import { placeTextMarks } from './textMarks.ts'

import type { MarkHitInfo } from './findMarkHit.ts'
import type { LinearMarkDisplayModel } from './model.ts'
import type { Feature } from '@jbrowse/core/util/simpleFeature'

const BARS = [
  {
    mark: 'bar',
    encoding: {
      y: 'score',
      color: { field: 'tissue', scale: 'categorical' },
    },
  },
]

const FAMILY = features([
  { source: 'mom', tissue: 'liver', start: 0, end: 400, score: 7 },
  { source: 'dad', tissue: 'brain', start: 200, end: 800, score: 9 },
  { source: 's2', tissue: 'liver', start: 100, end: 300, score: 2 },
  { source: 's10', tissue: 'heart', start: 500, end: 900, score: 40 },
  { source: 'mom', tissue: 'liver', start: 600, end: 700, score: 3 },
])

function loaded(
  display: Record<string, unknown>,
  marks: unknown[] = BARS,
  feats: readonly Feature[] = FAMILY,
) {
  const env = createTestEnvironment({ marks, ...display })
  const { display: model } = env.createDisplay()
  model.setRpcData(0, workerResult(model, feats), REGION)
  return model
}

function reorder(display: LinearMarkDisplayModel, order: string[]) {
  display.setRowOrder(
    order.map(name => display.editableSources.find(row => row.name === name)!),
  )
}

function legendValues(display: LinearMarkDisplayModel) {
  return display.colorScales.flatMap(scale =>
    scale.kind === 'categorical' ? scale.entries.map(e => e.value) : [],
  )
}

// Every hit a sweep of the plot finds, so a hidden row is shown to answer none.
function sweepHits(display: LinearMarkDisplayModel) {
  const { canvasWidth, canvasHeight } = display.renderState
  const hits: MarkHitInfo[] = []
  for (let x = 0; x < canvasWidth; x += 4) {
    for (let y = 0; y < canvasHeight; y += 2) {
      const hit = findMarkHit(
        x,
        y,
        display.renderBlocks,
        display.rpcDataMap,
        display.markList,
        display.renderState,
        display.host.displayedRegions,
      )
      if (hit) {
        hits.push(hit)
      }
    }
  }
  return hits
}

// The key the display's regions hold `name` at, keyed as they are read.
function keyOf(display: LinearMarkDisplayModel, name: string) {
  void display.rpcDataMap
  return display.rowKeys.lookup(name)!
}

function rowNameOf(display: LinearMarkDisplayModel, hit: MarkHitInfo) {
  return display.rowKeys.names[hit.row!]
}

test('a reorder and a focus upload the row table and no instance bytes', () => {
  const display = loaded({ rows: 'source' })
  const hal = new MockHal(display.markList.map(m => m.pass))
  display.startRenderingBackend(new GpuMarkBackend(hal, display.markList))
  const uploads = () => ({
    buffers: hal.callsOf('uploadBuffer').length,
    tables: hal.callsOf('uploadTexture').filter(c => c.args[4] === 'rowTable')
      .length,
  })
  const data = display.rpcDataMap
  const before = uploads()
  expect(before).toEqual({ buffers: 1, tables: 1 })

  reorder(display, ['s10', 's2', 'dad', 'mom'])
  expect(display.rpcDataMap).toBe(data)
  expect(uploads()).toEqual({ buffers: 1, tables: 2 })

  display.setRowFocus(['mom', 's10'])
  expect(display.rpcDataMap).toBe(data)
  expect(uploads()).toEqual({ buffers: 1, tables: 3 })
})

test('a focus leaves the hidden rows out of the legend and the axis, as a hidden section does', () => {
  const rows = loaded({ rows: 'source' })
  expect(legendValues(rows)).toEqual(['brain', 'heart', 'liver'])
  expect(rows.autoscaleRange![1]).toBe(40)

  rows.setRowFocus(['dad', 'mom'])
  expect(legendValues(rows)).toEqual(['brain', 'liver'])
  expect(rows.autoscaleRange![1]).toBe(9)

  const facet = loaded({ facet: 'source' })
  facet.hideGroup('s2')
  facet.hideGroup('s10')
  expect(legendValues(rows)).toEqual(legendValues(facet))
  expect(rows.autoscaleRange).toEqual(facet.autoscaleRange)
  expect(rows.domain).toEqual(facet.domain)
})

test('a hidden row answers no hit and lights no ink', () => {
  const display = loaded({ rows: 'source' })
  const s10 = keyOf(display, 's10')
  expect(sweepHits(display).some(hit => hit.row === s10)).toBe(true)
  const instance = [...display.rpcDataMap.get(0)!.layers[0]!.row!].indexOf(s10)
  const hover: MarkHitInfo = {
    markIndex: 0,
    regionIndex: 0,
    instance,
    featureIndex: instance,
    refName: 'ctgA',
    start: 500,
    end: 900,
    bp: 600,
    y: 40,
    color: undefined,
    colorValue: undefined,
    glyph: undefined,
    row: s10,
    screenX: 0,
    screenY: 0,
  }
  display.setHoveredFeature(hover)
  expect(display.hoverInk).toHaveLength(1)

  display.setRowFocus(['dad', 'mom', 's2'])
  const hits = sweepHits(display)
  expect(hits.length).toBeGreaterThan(0)
  expect(hits.some(hit => hit.row === s10)).toBe(false)
  expect(display.hoverInk).toEqual([])
})

test('the hover ring follows a reorder through the table', () => {
  const display = loaded({ rows: 'source' })
  const layer = display.rpcDataMap.get(0)!.layers[0]!
  const dad = keyOf(display, 'dad')
  const instance = [...layer.row!].indexOf(dad)
  display.setHoveredFeature({
    markIndex: 0,
    regionIndex: 0,
    instance,
    featureIndex: instance,
    refName: 'ctgA',
    start: 200,
    end: 800,
    bp: 300,
    y: 9,
    color: undefined,
    colorValue: undefined,
    glyph: undefined,
    row: dad,
    screenX: 0,
    screenY: 0,
  })
  const band = display.effectiveRowHeight
  const topAt = () => display.hoverInk[0]!.top - display.rowsTopOffset
  expect(Math.floor(topAt() / band)).toBe(0)
  reorder(display, ['s10', 's2', 'mom', 'dad'])
  expect(Math.floor(topAt() / band)).toBe(3)
})

test('text labels follow a reorder, and a hidden row places none', () => {
  const display = loaded({ rows: 'source' }, [
    { mark: 'text', encoding: { text: 'source' } },
  ])
  const bandOf = () => {
    const band = display.effectiveRowHeight
    return Object.fromEntries(
      placeTextMarks(
        display.textMarkEntries,
        display.rpcDataMap,
        display.renderBlocks,
        display.renderState,
        { size: 11, family: 'sans-serif' },
        'black',
      ).map(label => [label.text, Math.floor(label.baseline / band)]),
    )
  }
  expect(bandOf()).toEqual({ dad: 0, mom: 1, s2: 2, s10: 3 })
  reorder(display, ['s10', 's2', 'mom', 'dad'])
  expect(bandOf()).toEqual({ s10: 0, s2: 1, mom: 2, dad: 3 })
  display.setRowFocus(['mom', 'dad'])
  expect(bandOf()).toEqual({ mom: 0, dad: 1 })
})

test('sort at a column after a reorder names each value by its key, not its slot', () => {
  const display = loaded({ rows: 'source' })
  reorder(display, ['s10', 's2', 'dad', 'mom'])
  expect(display.sortRowsByValueAt('ctgA', 250)).toBe(true)
  expect(display.rowDomain).toEqual(['dad', 'mom', 's2', 's10'])
})

test('a focused-out row sorts with the rows that have no value there', () => {
  const display = loaded({ rows: 'source' })
  display.setRowFocus(['mom', 's2', 's10'])
  expect(display.sortRowsByValueAt('ctgA', 250)).toBe(true)
  expect(display.rowDomain).toEqual(['mom', 's2', 'dad', 's10'])
})

test('the tooltip names the hovered row by its key after a reorder', async () => {
  const display = loaded({ rows: 'source' })
  reorder(display, ['s10', 's2', 'dad', 'mom'])
  const hit = sweepHits(display).find(
    h => rowNameOf(display, h) !== display.sources[h.row!]!.name,
  )!
  const name = rowNameOf(display, hit)
  display.setHoveredFeature(hit)
  render(
    <MarkTooltip
      model={display}
      mouseState={{ x: 10, y: 10, clientX: 10, clientY: 10 }}
    />,
  )
  expect((await screen.findByRole('tooltip')).textContent).toContain(
    `source: ${name}`,
  )
})

test('a region arriving with a new value keys it next, and moves no key or region already keyed', () => {
  const display = loaded({ rows: 'source' })
  const first = display.rpcDataMap.get(0)
  const { rowKeys } = display
  const names = [...rowKeys.names]
  display.setRpcData(
    1,
    workerResult(
      display,
      features([
        { source: 'aunt', tissue: 'liver', start: 0, end: 100, score: 6 },
        { source: 'mom', tissue: 'liver', start: 0, end: 100, score: 1 },
      ]),
    ),
    { ...REGION, refName: 'ctgB' },
  )
  expect(display.rpcDataMap.get(0)).toBe(first)
  expect(display.rowKeys).toBe(rowKeys)
  expect(rowKeys.names).toEqual([...names, 'aunt'])
  expect([...display.rpcDataMap.get(1)!.layers[0]!.row!]).toEqual([
    rowKeys.lookup('aunt'),
    rowKeys.lookup('mom'),
  ])
  expect(display.rowTable!.keys).toBe(5)
})

test('a rows field change starts a new key space', () => {
  const display = loaded({ rows: 'source' })
  const { rowKeys } = display
  setConf(display.conf, ['rows', 'field'], 'tissue')
  const stale = display.rpcDataMap.get(0)!.layers[0]!.row!
  expect([...stale].map((_, i) => rowSlot(stale, i, display.rowTable))).toEqual(
    new Array(stale.length).fill(undefined),
  )
  expect(display.rowKeys.names).toEqual([])
  display.setRpcData(0, workerResult(display, FAMILY), REGION)
  const { row } = display.rpcDataMap.get(0)!.layers[0]!
  expect(display.rowKeys).not.toBe(rowKeys)
  expect(display.rowKeys.names).toEqual(['brain', 'heart', 'liver'])
  expect([...row!].map((_, i) => rowSlot(row, i, display.rowTable))).toEqual([
    0, 1, 2, 2, 2,
  ])
  expect(display.drawnKeys).toBeUndefined()
  expect(display.scaleDataMap).toBe(display.rpcDataMap)
})

// A Uint32Array this long fails the test rather than being allocated, so an
// index sized by the hidden key cannot take the 16 GB it would ask for.
const RUNAWAY_LENGTH = 1e8

function refusingRunawayArrays<T>(run: () => T) {
  const Real = globalThis.Uint32Array
  globalThis.Uint32Array = new Proxy(Real, {
    construct(target, args: unknown[]) {
      if (typeof args[0] === 'number' && args[0] > RUNAWAY_LENGTH) {
        throw new RangeError(`Uint32Array(${args[0]})`)
      }
      return Reflect.construct(target, args) as object
    },
  })
  try {
    return run()
  } finally {
    globalThis.Uint32Array = Real
  }
}

// The held region keeps drawing under the refetch scrim, and the plot keeps
// asking it for hits, until the refetch under the new field lands.
test('a hover over a region the new rows field has not reached answers nothing', () => {
  const display = loaded({ rows: 'source' })
  setConf(display.conf, ['rows', 'field'], 'tissue')
  expect(refusingRunawayArrays(() => sweepHits(display))).toEqual([])
})

test('a value only a departed load knew hides nothing', () => {
  const display = loaded({ rows: 'source' })
  void display.rpcDataMap
  display.setRpcData(
    0,
    workerResult(
      display,
      features([
        { source: 'aunt', tissue: 'liver', start: 0, end: 100, score: 6 },
        { source: 'mom', tissue: 'liver', start: 0, end: 100, score: 1 },
      ]),
    ),
    REGION,
  )
  void display.rpcDataMap
  expect(display.rowKeys.names).toEqual(['dad', 'mom', 's2', 's10', 'aunt'])
  expect(display.sources.map(row => row.name)).toEqual(['aunt', 'mom'])
  expect(display.drawnKeys).toBeUndefined()
  expect(display.scaleDataMap).toBe(display.rpcDataMap)
  display.setRowFocus(['mom'])
  expect([...display.drawnKeys!]).toEqual([0, 1, 0, 0, 0])
})

// The refetch the split triggers replaces it; until then it names no value.
test('a region fetched before the split draws nothing and counts for nothing', () => {
  const display = loaded({ rows: 'source' })
  const { facet: _, ...unsplit } = workerResult(
    display,
    features([
      { source: 'aunt', tissue: 'kidney', start: 0, end: 400, score: 50 },
      { source: 'mom', tissue: 'kidney', start: 500, end: 900, score: 60 },
    ]),
  )
  display.setRpcData(1, unsplit, { ...REGION, refName: 'ctgB' })
  const { row } = display.rpcDataMap.get(1)!.layers[0]!
  expect([...row!].map((_, i) => rowSlot(row, i, display.rowTable))).toEqual([
    undefined,
    undefined,
  ])
  expect(display.drawnKeys).toBeDefined()
  expect(sweepHits(display).every(hit => hit.regionIndex === 0)).toBe(true)
  expect(legendValues(display)).toEqual(['brain', 'heart', 'liver'])
  expect(display.autoscaleRange?.[1]).toBeLessThan(50)
})

test('rows beside a facet bind no table, and the facet offsets its rows', () => {
  const display = loaded({ facet: 'source', rows: 'source' })
  expect(display.rowTable).toBeUndefined()
  expect(display.renderState.rowTable).toBeUndefined()
  const hal = new MockHal(display.markList.map(m => m.pass))
  display.startRenderingBackend(new GpuMarkBackend(hal, display.markList))
  expect(
    hal
      .callsOf('uploadTexture')
      .filter(c => c.args[4] === 'rowTable')
      .map(c => c.args.slice(2)),
  ).toEqual([[256, 1, 'rowTable']])
})

test('a listing names the rows on its field, or on the key a flatten wrote over it', () => {
  const flat = [{ type: 'flatten', field: 'alignments', key: 'species' }]
  expect(listingNamesRows('source', 'source', [])).toBe(true)
  expect(listingNamesRows('species', 'alignments', flat)).toBe(true)
  expect(listingNamesRows('species', 'alignments', [])).toBe(false)
  expect(listingNamesRows('seq', 'alignments', flat)).toBe(false)
  expect(listingNamesRows('alignments', 'alignments', flat)).toBe(true)
  expect(
    listingNamesRows('i', 'subfeatures', [{ type: 'flatten', key: 'i' }]),
  ).toBe(true)
})
