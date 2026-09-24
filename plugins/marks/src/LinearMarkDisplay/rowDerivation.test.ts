import { waitFor } from '@testing-library/react'

import { runMarkClustering } from './runMarkClustering.ts'
import {
  REGION,
  createTestEnvironment,
  features,
  workerResult,
} from './testEnv.ts'

import type { LinearMarkDisplayModel } from './model.ts'

const BARS = [
  {
    mark: 'bar',
    encoding: {
      y: 'score',
      color: { field: 'source', scale: 'categorical' },
    },
  },
]

const FAMILY = features([
  { source: 's10', start: 500, end: 900, score: 4 },
  { source: 'mom', start: 0, end: 400, score: 7 },
  { source: 's2', start: 100, end: 300, score: 2 },
  { source: 'dad', start: 200, end: 800, score: 9 },
  { source: 'mom', start: 600, end: 700, score: 3 },
])

function loaded(display: Record<string, unknown>, feats = FAMILY) {
  const { display: model } = createTestEnvironment({
    marks: BARS,
    ...display,
  }).createDisplay()
  model.setRpcData(0, workerResult(model, feats), REGION)
  return model
}

function drawn(display: LinearMarkDisplayModel) {
  return {
    request: display.rpcProps().facet,
    rowCount: display.rowCount,
    renderRowCount: display.renderState.rowCount,
    domain: display.domain,
    layers: [...display.rpcDataMap.values()].map(region =>
      region.layers.map(l => ({
        count: l.count,
        x: [...l.x],
        x2: [...l.x2],
        y: [...(l.y ?? [])],
        row: [...(l.row ?? [])],
        color: [...(l.color ?? [])],
      })),
    ),
    valueScales: display.valueScales.map(
      ({ domain, height, offset, bandTops }) => ({
        domain,
        height,
        offset,
        bandTops,
      }),
    ),
    legend: display.colorScales.map(scale =>
      scale.kind === 'categorical'
        ? scale.entries.map(({ value, label, color }) => ({
            value,
            label,
            color,
          }))
        : scale,
    ),
  }
}

test('bars faceted by source draw a band per source under its chip', () => {
  const display = loaded({ facet: 'source' })
  expect(drawn(display)).toMatchSnapshot()
  const { sections, rowCount, firstRowOf } = display.facetLayout
  expect({ sections, rowCount, firstRowOf }).toMatchSnapshot()
})

test('a facet domain leads the bands and the key', () => {
  const display = loaded({ facet: { field: 'source', domain: ['s10', 'mom'] } })
  expect(drawn(display)).toMatchSnapshot()
})

function sidebar(display: LinearMarkDisplayModel) {
  return {
    editableSources: display.editableSources.map(
      ({ name, label, labelColor }) => ({ name, label, labelColor }),
    ),
    sources: display.sources.map(row => row.name),
    rowTree: display.rowTree,
    treeDrawn: display.hierarchy !== undefined,
    rowArrangementIsCustom: display.rowArrangementIsCustom,
    bands: display.facetLayout.sections.map(({ label, firstRow }) => ({
      label,
      firstRow,
    })),
    chips: !display.facetLayout.rows,
  }
}

function rowOfEach(display: LinearMarkDisplayModel) {
  const layer = display.rpcDataMap.get(0)!.layers[0]!
  return [...layer.row!].map((row, i) => `${layer.y![i]}@${row}`)
}

// What the worker's clustering hands back: its leaves in the order it names
// them, indexed into the rows it was given.
async function clusterRun(display: LinearMarkDisplayModel, tree: string) {
  const leaves = tree.match(/\w+/g)!
  await runMarkClustering({
    model: display,
    regions: [REGION],
    rpcManager: {
      call: (_sessionId, _method, args) =>
        Promise.resolve({
          order: leaves.map(name => args.rows.indexOf(name)),
          tree,
        }),
    },
    sessionId: 'test',
    signal: new AbortController().signal,
    statusCallback: () => {},
  })
}

test('rows draw what the facet drew, one labelled row per source and no chips', () => {
  const rows = loaded({ rows: 'source' })
  expect(drawn(rows)).toEqual(drawn(loaded({ facet: 'source' })))
  expect(sidebar(rows)).toMatchSnapshot()
})

test('a rows domain leads the rows as a facet domain leads the bands', () => {
  const domain = ['s10', 'mom']
  expect(drawn(loaded({ rows: { field: 'source', domain } }))).toEqual(
    drawn(loaded({ facet: { field: 'source', domain } })),
  )
})

test('a reorder moves the drawn rows and the key with them', () => {
  const display = loaded({ rows: 'source' })
  const [dad, mom, s2, s10] = display.editableSources
  display.setRowOrder([s10!, s2!, dad!, mom!])
  expect(display.rowDomain).toEqual(['s10', 's2', 'dad', 'mom'])
  expect(drawn(display)).toEqual(
    drawn(
      loaded({
        facet: { field: 'source', domain: ['s10', 's2', 'dad', 'mom'] },
      }),
    ),
  )
})

test('a cluster run lands its tree turned towards the seed, and orders the rows', async () => {
  const display = loaded({ rows: { field: 'source', domain: ['s10'] } })
  await clusterRun(display, '((dad,s2),(mom,s10));')
  expect(sidebar(display)).toMatchSnapshot()
  expect(rowOfEach(display)).toEqual(['9@2', '7@1', '3@1', '2@3', '4@0'])
  expect(display.rowTreeProvenance).toMatchSnapshot()
})

test('a focus draws the rows it keeps and leaves the rest out of the plot', () => {
  const display = loaded({ rows: 'source' })
  display.setRowFocus(['mom', 's10'])
  expect(sidebar(display)).toMatchSnapshot()
  expect(display.rowCount).toBe(2)
  expect(rowOfEach(display)).toEqual(['7@0', '3@0', '4@1'])
  display.setRowFocus(undefined)
  expect(drawn(display)).toEqual(drawn(loaded({ facet: 'source' })))
})

test('sort at a column orders the rows by the value each stands at there', () => {
  const display = loaded({ rows: 'source' })
  expect(display.sortRowsByValueAt('ctgA', 250)).toBe(true)
  expect(display.rowDomain).toEqual(['dad', 'mom', 's2', 's10'])
  expect(drawn(display)).toEqual(
    drawn(loaded({ facet: { field: 'source', domain: display.rowDomain } })),
  )
  expect(display.sortRowsByValueAt('ctgA', 650)).toBe(true)
  expect(display.rowDomain).toEqual(['dad', 's10', 'mom', 's2'])
  expect(drawn(display)).toEqual(
    drawn(loaded({ facet: { field: 'source', domain: display.rowDomain } })),
  )
})

test('a region arriving with a new value adds its row, and the arranged rows keep their places', () => {
  const display = loaded({ rows: 'source' })
  const [dad, mom, s2, s10] = display.editableSources
  display.applyRowEdits([s10!, { ...mom!, label: 'Mother' }, dad!, s2!])
  const before = display.discoveredRows
  display.setRpcData(0, workerResult(display, FAMILY), REGION)
  expect(display.discoveredRows).toBe(before)

  const nextRegion = { ...REGION, refName: 'ctgB' }
  display.setRpcData(
    1,
    workerResult(
      display,
      features([
        { source: 'mom', start: 0, end: 100, score: 1 },
        { source: 'aunt', start: 0, end: 100, score: 6 },
      ]),
    ),
    nextRegion,
  )
  expect(
    display.editableSources.map(({ name, label }) => label ?? name),
  ).toEqual(['s10', 'Mother', 'dad', 's2', 'aunt'])
  const layer = display.rpcDataMap.get(1)!.layers[0]!
  expect([...layer.row!].map((row, i) => `${layer.y![i]}@${row}`)).toEqual([
    '6@4',
    '1@1',
  ])
})

const LISTED = [
  { name: 'dad' },
  { name: 'mom', label: 'Mother', color: '#aa0000' },
  { name: 's2' },
  { name: 's10' },
  { name: 's99', label: 'Unsequenced' },
]

async function listingSources(
  display: Record<string, unknown>,
  listed: { name: string; label?: string; color?: string }[] = LISTED,
) {
  const env = createTestEnvironment({ marks: BARS, ...display })
  env.mockRpcCall.mockImplementation((_sessionId: string, method: string) =>
    method === 'MarkGetRowSources'
      ? Promise.resolve(listed)
      : new Promise(() => {}),
  )
  const { display: model } = env.createDisplay()
  model.setRpcData(0, workerResult(model, FAMILY), REGION)
  await waitFor(() => {
    expect(model.adapterSources).toBe(listed)
  })
  return model
}

test("under rows: 'source' every source the adapter lists has a row, with its label and colour", async () => {
  const display = await listingSources({ rows: 'source' })
  expect(
    display.editableSources.map(({ name, label, labelColor }) => ({
      name,
      label,
      labelColor,
    })),
  ).toEqual([
    { name: 'dad', label: undefined, labelColor: undefined },
    { name: 'mom', label: 'Mother', labelColor: '#aa0000' },
    { name: 's2', label: undefined, labelColor: undefined },
    { name: 's10', label: undefined, labelColor: undefined },
    { name: 's99', label: 'Unsequenced', labelColor: undefined },
  ])
  expect(display.rowCount).toBe(5)
})

test('a window where one source is empty keeps its row and the tree', async () => {
  const display = await listingSources({ rows: 'source' })
  await clusterRun(display, '(((dad,s2),(mom,s10)),s99);')
  const rows = display.discoveredRows
  const order = display.sources.map(row => row.name)
  expect(display.hierarchy).toBeDefined()

  display.setRpcData(
    0,
    workerResult(
      display,
      FAMILY.filter(f => f.get('source') !== 's2'),
    ),
    REGION,
  )
  expect(display.discoveredRows).toBe(rows)
  expect(display.sources.map(row => row.name)).toEqual(order)
  expect(display.hierarchy).toBeDefined()
})

test('a list is asked for only under rows on source', () => {
  const env = createTestEnvironment({ marks: BARS, rows: 'strand' })
  env.createDisplay()
  expect(
    env.mockRpcCall.mock.calls.filter(
      ([, method]) => method === 'MarkGetRowSources',
    ),
  ).toEqual([])
})

test('a reset returns the order, labels, tree and focus to the config', async () => {
  const seed = { rows: { field: 'source', domain: ['s10'] } }
  const display = loaded(seed)
  await clusterRun(display, '((dad,s2),(mom,s10));')
  const [first, ...rest] = display.editableSources
  display.applyRowEdits([
    ...rest,
    { ...first!, label: 'Last', labelColor: '#0000ff' },
  ])
  display.setRowFocus(['mom'])
  expect(display.rowArrangementIsCustom).toBe(true)
  display.resetRowArrangement()
  expect(sidebar(display)).toEqual(sidebar(loaded(seed)))
  expect(drawn(display)).toEqual(drawn(loaded(seed)))
})

test('rows beside a facet leave the facet drawing, and say so on another field', () => {
  const same = loaded({ facet: 'source', rows: 'source' })
  expect(drawn(same)).toEqual(drawn(loaded({ facet: 'source' })))
  expect(same.sources).toEqual([])
  expect(same.notices).toEqual([])
  const other = loaded({ facet: 'tissue', rows: 'source' })
  expect(drawn(other)).toEqual(drawn(loaded({ facet: 'tissue' })))
  expect(other.notices).toEqual([
    'rows.field: facet stacks a labelled section per value and rows one row per value; bands of rows over two fields are not drawn yet, so the facet draws alone',
  ])
})

test('the Plot field default facets a display with no rows, and leaves rows drawing', () => {
  const plot = {
    field: 'score',
    mark: 'point',
    colorField: '',
    binned: false,
  } as const
  const fields = { numeric: ['score'], categorical: [], facet: 'source' }
  const bare = loaded({})
  bare.setPlotFields(fields)
  bare.setPlotMarks(plot)
  expect(bare.facet?.field).toBe('source')

  const rows = loaded({ rows: 'source' })
  rows.setPlotFields(fields)
  rows.setPlotMarks(plot)
  expect(rows.facet).toBeUndefined()
  expect(rows.drawsRows).toBe(true)
  expect(rows.sources.map(row => row.name)).toEqual(['dad', 'mom', 's2', 's10'])
})

test("under rows: 'source' the listed sources keep the adapter's order, and values it does not list follow", async () => {
  const display = await listingSources({ rows: 'source' }, [
    { name: 's10' },
    { name: 'mom' },
    { name: 'dad' },
  ])
  expect(display.sources.map(row => row.name)).toEqual([
    's10',
    'mom',
    'dad',
    's2',
  ])
})

test("rows on a field with a vocabulary stack in the order the facet's sections do", () => {
  const stranded = features([
    { strand: -1, start: 0, end: 100, score: 1 },
    { strand: 0, start: 100, end: 200, score: 2 },
    { strand: 1, start: 200, end: 300, score: 3 },
  ])
  const rows = loaded({ rows: 'strand' }, stranded)
  const facet = loaded({ facet: 'strand' }, stranded)
  expect(rows.sources.map(row => row.name)).toEqual(
    facet.facetLayout.sections.map(section => section.key),
  )
})

test('a listing that answers another adapter config lists no rows', async () => {
  const display = await listingSources({ rows: 'source' })
  expect(display.sources.map(row => row.name)).toContain('s99')
  display.setSourceListing({
    adapterConfig: { type: 'BedAdapter' },
    value: LISTED,
  })
  expect(display.adapterSources).toBeUndefined()
  expect(display.sources.map(row => row.name)).toEqual([
    'dad',
    'mom',
    's2',
    's10',
  ])
})
