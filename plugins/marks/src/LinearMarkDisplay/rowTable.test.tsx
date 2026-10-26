import { setConf } from '@jbrowse/core/configuration'
import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'
import { MockHal } from '@jbrowse/render-core/hal'
import { rowSlot } from '@jbrowse/render-core/marks'
import { GpuMarkBackend } from '@jbrowse/render-core/marks/backend'
import { render, screen } from '@testing-library/react'

import MarkTooltip from './components/MarkTooltip.tsx'
import { findMarkHit } from './findMarkHit.ts'
import { listingNamesRows } from './rowTable.ts'
import { markRowMatrixArgs } from './runMarkClustering.ts'
import {
  REGION,
  createTestEnvironment,
  features,
  workerResult,
} from './testEnv.ts'
import { placeTextMarks } from './textMarks.ts'

import type { MarkHitInfo } from './findMarkHit.ts'
import type { LinearMarkDisplayModel } from './model.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util/simpleFeature'

const BARS = [
  {
    mark: 'bar',
    encoding: {
      y: 'score',
      color: { field: 'tissue', scale: { type: 'ordinal' } },
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
  for (let x = 0; x < canvasWidth; x += 16) {
    for (let y = 0; y < canvasHeight; y += 6) {
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

const FAMILY_GROUPS = {
  rows: 'source',
  rowGroups: [
    { match: '^(mom|dad)$', group: 'parents' },
    { match: '^s', group: 'children' },
  ],
}

test('a facet on the group rowGroups writes stacks the rows in bands, split by rows alone', () => {
  const display = loaded({ ...FAMILY_GROUPS, facet: 'group' }, [
    { mark: 'rect' },
  ])
  expect(display.bandsRows).toBe(true)
  expect(display.facet).toBeUndefined()
  expect(display.drawsRows).toBe(true)
  expect(display.rpcProps().facet).toEqual({ field: 'source' })
  expect(display.rowBands.map(b => b.label)).toEqual(['parents', 'children'])
  expect(display.sources.map(row => row.name)).toEqual([
    'dad',
    'mom',
    's2',
    's10',
  ])
  expect(display.clusterPartition).toEqual([
    ['dad', 'mom'],
    ['s2', 's10'],
  ])
  expect(display.configProblems).toEqual([])
  expect(display.rowColorFields).toContain('group')
})

test("a band's order follows facet.sort, and a hit names the row the band placed", () => {
  const display = loaded(
    { ...FAMILY_GROUPS, facet: { field: 'group', sort: ['children'] } },
    [{ mark: 'rect' }],
  )
  expect(display.rowBands.map(b => b.label)).toEqual(['children', 'parents'])
  const { canvasWidth, canvasHeight } = display.renderState
  let top: MarkHitInfo | undefined
  for (let y = 0; y < canvasHeight && !top; y += 2) {
    for (let x = 0; x < canvasWidth && !top; x += 8) {
      top = findMarkHit(
        x,
        y,
        display.renderBlocks,
        display.rpcDataMap,
        display.markList,
        display.renderState,
        display.host.displayedRegions,
      )
    }
  }
  // the children band stacks first, so the topmost span is a child's
  expect(['s2', 's10']).toContain(rowNameOf(display, top!))
})

test('a clustering run under bands clusters each band apart', async () => {
  const display = loaded({ ...FAMILY_GROUPS, facet: 'group' }, [
    { mark: 'rect' },
  ])
  const args = await markRowMatrixArgs(
    display,
    [REGION],
    new AbortController().signal,
  )
  expect(args.partition).toEqual([
    ['dad', 'mom'],
    ['s2', 's10'],
  ])
  expect(args.facet).toEqual({ field: 'source' })
})

test('beside rows a facet on a feature field still splits the features, and says so', () => {
  const display = loaded({ ...FAMILY_GROUPS, facet: 'tissue' }, [
    { mark: 'rect' },
  ])
  expect(display.bandsRows).toBe(false)
  expect(display.facet?.field).toBe('tissue')
  expect(display.drawsRows).toBe(false)
  expect(display.configProblems.map(p => p.rule)).toContain('rows-beside-facet')
})

test('sort at a column after a reorder names each value by its key, not its slot', () => {
  const display = loaded({ rows: 'source' })
  reorder(display, ['s10', 's2', 'dad', 'mom'])
  expect(display.sortRowsByValueAt('ctgA', 250)).toBe(true)
  expect(display.rowSort).toEqual(['dad', 'mom', 's2', 's10'])
})

test('span rows sort at a column by the color they paint there, the largest block first', () => {
  const display = loaded({ rows: 'source' }, [
    {
      mark: 'rect',
      encoding: {
        color: {
          field: 'tissue',
          scale: { domain: ['liver', 'brain'], range: ['black', 'white'] },
        },
      },
    },
  ])
  expect(display.rowCompare).toEqual({ mark: 0, by: 'colorKey' })
  expect(display.rowCompareLabel).toBe('tissue')
  expect(display.sortRowsByValueAt('ctgA', 250)).toBe(true)
  expect(display.rowSort).toEqual(['mom', 's2', 'dad', 's10'])

  // the block comes first whichever of the two colors packs higher
  const { color } = display.conf.marks[0]!.encoding
  setConf(color, ['scale', 'range'], ['white', 'black'])
  expect(display.sortRowsByValueAt('ctgA', 250)).toBe(true)
  expect(display.rowSort).toEqual(['mom', 's2', 'dad', 's10'])
})

test("span blocks of one size sort in their categories' order, whatever the palette", () => {
  for (const range of [
    ['black', 'white', 'gray'],
    ['white', 'gray', 'black'],
  ]) {
    const display = loaded({ rows: 'source' }, [
      {
        mark: 'rect',
        encoding: {
          color: {
            field: 'tissue',
            scale: { domain: ['liver', 'brain', 'heart'], range },
          },
        },
      },
    ])
    expect(display.sortRowsByValueAt('ctgA', 650)).toBe(true)
    // brain, heart, liver, then the row with nothing there
    expect(display.rowSort).toEqual(['dad', 's10', 'mom', 's2'])
  }
})

test('span rows under one color sort by whether they cover the column', () => {
  const display = loaded({ rows: 'source' }, [{ mark: 'rect' }])
  expect(display.rowCompare).toEqual({ mark: 0, by: 'presence' })
  expect(display.sortRowsByValueAt('ctgA', 650)).toBe(true)
  expect(display.rowSort).toEqual(['dad', 'mom', 's10', 's2'])
})

test('a sort at a column reads the span drawn last where two in one row meet', () => {
  const tissue = (range: string[]) => [
    {
      mark: 'rect',
      encoding: {
        color: {
          field: 'tissue',
          scale: { domain: ['liver', 'brain'], range },
        },
      },
    },
  ]
  const overlap = features([
    { source: 'mom', tissue: 'liver', start: 0, end: 400 },
    { source: 'mom', tissue: 'brain', start: 200, end: 400 },
    { source: 'dad', tissue: 'liver', start: 0, end: 400 },
    { source: 's2', tissue: 'brain', start: 0, end: 400 },
    { source: 's10', tissue: 'brain', start: 0, end: 400 },
  ])
  // whichever color packs higher, mom joins the brain block it shows on top
  for (const range of [
    ['black', 'white'],
    ['white', 'black'],
  ]) {
    const display = loaded({ rows: 'source' }, tissue(range), overlap)
    expect(display.sortRowsByValueAt('ctgA', 300)).toBe(true)
    expect(display.rowSort.slice(0, 3).toSorted()).toEqual(['mom', 's10', 's2'])
    expect(display.rowSort[3]).toBe('dad')
  }
})

test('a region still holding an earlier color gives a color sort nothing to read', () => {
  const display = loaded({ rows: 'source' }, [
    {
      mark: 'rect',
      encoding: { color: { field: 'score', scale: { type: 'linear' } } },
    },
  ])
  setConf(display.conf.marks[0]!.encoding.color, 'field', 'depth')
  expect(display.rowCompare).toEqual({ mark: 0, by: 'colorValue' })
  expect(display.rpcDataMap.get(0)!.layers[0]!.heldColor).toBe(true)
  // the held scores would put s10, 40, first
  display.sortRowsByValueAt('ctgA', 650)
  expect(display.rowSort).toEqual(['dad', 'mom', 's2', 's10'])
})

const TISSUE_RECTS = [
  {
    mark: 'rect',
    encoding: { color: { field: 'tissue', scale: { type: 'ordinal' } } },
  },
]

function menuLabels(display: LinearMarkDisplayModel) {
  const labelOf = (item: MenuItem) => ('label' in item ? item.label : '')
  return display
    .trackMenuItems()
    .flatMap(item => [
      labelOf(item),
      ...('subMenu' in item
        ? resolveSubMenu(item).map(sub => `  ${labelOf(sub)}`)
        : []),
    ])
}

test('hiding a key category drops its spans from the plot and the hover, and fetches nothing', () => {
  const display = loaded({ rows: 'source' }, TISSUE_RECTS)
  const count = () => display.rpcDataMap.get(0)!.layers[0]!.count
  const before = JSON.stringify(display.rpcProps())
  expect(count()).toBe(5)

  display.toggleCategory('tissue', ['liver'])

  expect(JSON.stringify(display.rpcProps())).toBe(before)
  expect(count()).toBe(2)
  expect(sweepHits(display).map(h => rowNameOf(display, h))).not.toContain('s2')
  const key = display.colorScales[0]!
  expect(
    key.kind === 'categorical' &&
      key.entries.map(e => [e.value, !!e.hidden] as const),
  ).toEqual([
    ['brain', false],
    ['heart', false],
    ['liver', true],
  ])
  expect(menuLabels(display)).toEqual(
    expect.arrayContaining([
      'Filter by (1)',
      '  Show all categories',
      'Categories (1 hidden)',
      '  liver',
    ]),
  )

  display.toggleCategory('tissue', ['liver'])
  expect(count()).toBe(5)
  display.toggleCategory('tissue', ['liver', 'brain'])
  expect(count()).toBe(1)
  display.showAllCategories()
  expect(count()).toBe(5)
  expect(display.hiddenCategories).toBeUndefined()
})

test('under a row focus a hidden category keeps its key row, its way back', () => {
  const display = loaded({ rows: 'source' }, TISSUE_RECTS)
  display.setRowFocus(['mom', 'dad', 's2'])
  display.toggleCategory('tissue', ['liver'])
  expect(legendValues(display)).toContain('liver')
  expect(menuLabels(display)).toContain('  liver')
})

test('a hide keeps across a palette edit and waits out a field change', () => {
  const display = loaded({ rows: 'source' }, TISSUE_RECTS)
  const count = () => display.rpcDataMap.get(0)!.layers[0]!.count
  display.toggleCategory('tissue', ['liver'])
  const { color } = display.conf.marks[0]!.encoding
  setConf(color, ['scale', 'range'], ['black', 'white', 'gray'])
  expect(count()).toBe(2)

  setConf(color, 'field', 'source')
  display.setRpcData(0, workerResult(display, FAMILY), REGION)
  expect(display.activeHiddenCategories).toEqual([])
  expect(count()).toBe(5)

  setConf(color, 'field', 'tissue')
  display.setRpcData(0, workerResult(display, FAMILY), REGION)
  expect(display.activeHiddenCategories).toHaveLength(1)
  expect(count()).toBe(2)
})

test('a bar beside a span is what the rows compare on', () => {
  const display = loaded({ rows: 'source' }, [{ mark: 'rect' }, ...BARS])
  expect(display.rowCompare).toEqual({ mark: 1, by: 'y' })
  expect(display.rowCompareLabel).toBe('value')
})

test('a focused-out row sorts with the rows that have no value there', () => {
  const display = loaded({ rows: 'source' })
  display.setRowFocus(['mom', 's2', 's10'])
  expect(display.sortRowsByValueAt('ctgA', 250)).toBe(true)
  expect(display.rowSort).toEqual(['mom', 's2', 'dad', 's10'])
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

test('clearing the facet draws nothing for a region it split until the refetch lands', () => {
  const display = loaded({ facet: 'source' })
  expect(display.rpcDataMap.get(0)!.layers[0]!.count).toBe(5)
  setConf(display.conf, ['facet', 'field'], '')
  expect(display.rpcDataMap.get(0)!.layers[0]!.count).toBe(0)
  display.setRpcData(0, workerResult(display, FAMILY), REGION)
  expect(display.rpcDataMap.get(0)!.layers[0]!.count).toBe(5)
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

test("rows beside a facet place the facet's rows through the facet's table", () => {
  const display = loaded({ facet: 'source', rows: 'source' })
  expect(display.drawsRows).toBe(false)
  expect([...display.rowTable!.slot]).toEqual(
    display.facetLayout.sections.map(s => s.firstRow),
  )
  expect(display.renderState.rowTable).toEqual(display.rowTable)
  const hal = new MockHal(display.markList.map(m => m.pass))
  display.startRenderingBackend(new GpuMarkBackend(hal, display.markList))
  const { width, height } = display.rowTable!.texture
  expect(
    hal
      .callsOf('uploadTexture')
      .filter(c => c.args[4] === 'rowTable')
      .map(c => c.args.slice(2)),
  ).toEqual([[width, height, 'rowTable']])
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
