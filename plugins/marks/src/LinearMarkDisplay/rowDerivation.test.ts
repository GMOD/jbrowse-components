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

function loaded(display: Record<string, unknown>) {
  const { display: model } = createTestEnvironment({
    marks: BARS,
    ...display,
  }).createDisplay()
  model.setRpcData(0, workerResult(model, FAMILY), REGION)
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
  expect(display.sortRowsByValueAt('ctgA', 650)).toBe(true)
  expect(display.rowDomain).toEqual(['dad', 's10', 'mom', 's2'])
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

// A MultiQuantitativeTrack seeds `rows: 'source'` for every display taking
// it, so a mark display there faceted by source carries both.
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
