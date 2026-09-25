import { createTestEnvironment, ctgA } from './testEnv.ts'

import type { MultiRowRegionData } from './rendering/multiRowRenderingBackendTypes.ts'

const WOLF = { match: '^CLUP', group: 'Wolf', color: 'rgb(27,120,55)' }
const VILLAGE = {
  match: '^VILL',
  group: 'Village dog',
  color: 'rgb(90,174,97)',
}

function rows(names: string[]): MultiRowRegionData {
  return {
    featureStarts: new Uint32Array(0),
    featureEnds: new Uint32Array(0),
    featureColors: new Uint32Array(0),
    featureDeltas: new Int32Array(0),
    partitionValues: names,
    featurePartitionIndex: new Uint32Array(0),
    featureNames: [],
    featureIds: [],
    usedItemRgb: false,
    partitionCandidates: [],
    partitionCandidateValues: [],
    legendCandidates: [],
    resolvedPartitionField: 'name',
  }
}

function banded(names: string[], displayConfig: Record<string, unknown>) {
  const { display } = createTestEnvironment({
    displayConfig: { facet: 'group', ...displayConfig },
  }).createDisplay()
  display.setRpcData(0, rows(names), ctgA)
  return display
}

const drawn = (display: { sources: { name: string }[] }) =>
  display.sources.map(s => s.name)

test('rowGroups alone tag the rows and leave their order', () => {
  const { display } = createTestEnvironment({
    displayConfig: { rowGroups: [WOLF] },
  }).createDisplay()
  display.setRpcData(0, rows(['COLL000001', 'CLUPGR000001']), ctgA)
  expect(drawn(display)).toEqual(['CLUPGR000001', 'COLL000001'].sort())
  expect(display.rowBands).toEqual([])
  expect(display.sources.find(s => s.name === 'CLUPGR000001')?.group).toBe(
    'Wolf',
  )
})

test('facet group stacks the matched rows in a band ahead of the rest', () => {
  const display = banded(
    ['COLL000001', 'CLUPGR000001', 'DACH000001', 'CLUPRU000001'],
    { rowGroups: [WOLF] },
  )
  expect(drawn(display)).toEqual([
    'CLUPGR000001',
    'CLUPRU000001',
    'COLL000001',
    'DACH000001',
  ])
  expect(display.rowBands.map(b => b.label)).toEqual(['Wolf', '(no group)'])
})

test('the bands follow the order rowGroups declares them in', () => {
  const display = banded(['VILLCN000001', 'COLL000001', 'CLUP000001'], {
    rowGroups: [WOLF, VILLAGE],
  })
  expect(display.sources.map(s => s.group)).toEqual([
    'Wolf',
    'Village dog',
    undefined,
  ])
})

test('a facet domain stacks the bands it lists first', () => {
  const display = banded(['VILLCN000001', 'COLL000001', 'CLUP000001'], {
    rowGroups: [WOLF, VILLAGE],
    facet: { field: 'group', domain: ['Village dog'] },
  })
  expect(display.sources.map(s => s.group)).toEqual([
    'Village dog',
    'Wolf',
    undefined,
  ])
})

test('a band keeps its rows in their arranged order, so a sort survives', () => {
  const display = banded(['CLUPa', 'CLUPb', 'COLLx', 'COLLy'], {
    rowGroups: [WOLF],
    rows: { field: '', domain: ['COLLy', 'CLUPb', 'COLLx', 'CLUPa'] },
  })
  expect(drawn(display)).toEqual(['CLUPb', 'CLUPa', 'COLLy', 'COLLx'])
})

test('a recoloured row stays in its band', () => {
  const display = banded(['COLL000001', 'CLUPGR000001', 'CLUPRU000001'], {
    rowGroups: [WOLF],
    rowColor: { domain: ['CLUPGR000001'], range: ['rebeccapurple'] },
  })
  expect(drawn(display)).toEqual(['CLUPGR000001', 'CLUPRU000001', 'COLL000001'])
})
