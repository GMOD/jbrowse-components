import { autorun } from 'mobx'

import stateModelFactory from './SpreadsheetModel.tsx'

const SpreadsheetStateModel = stateModelFactory()

function makeModel(overrides = {}) {
  return SpreadsheetStateModel.create({
    rowSet: undefined,
    columns: [],
    visibleColumns: {},
    ...overrides,
  })
}

test('rows returns undefined when no rowSet', () => {
  const model = makeModel()
  expect(model.rows).toBeUndefined()
})

test('rows maps cellData format to GridRow', () => {
  const feature = {
    refName: 'chr1',
    start: 0,
    end: 100,
    name: 'f1',
    uniqueId: 'f1',
  }
  const model = makeModel({
    rowSet: { rows: [{ feature, cellData: { score: 99, name: 'foo' } }] },
    columns: [{ name: 'score' }, { name: 'name' }],
  })
  expect(model.rows).toEqual([{ id: 0, feature, score: 99, name: 'foo' }])
})

test('rows handles legacy cells format', () => {
  const model = makeModel({
    rowSet: { rows: [{ cells: [{ text: 'chrX' }, { text: 42 }] }] },
    columns: [{ name: 'chr' }, { name: 'pos' }],
  })
  expect(model.rows).toEqual([
    { id: 0, feature: undefined, chr: 'chrX', pos: 42 },
  ])
})

test('rows assigns sequential ids across multiple rows', () => {
  const model = makeModel({
    rowSet: {
      rows: [
        { cellData: { x: 1 } },
        { cellData: { x: 2 } },
        { cellData: { x: 3 } },
      ],
    },
    columns: [{ name: 'x' }],
  })
  expect(model.rows?.map(r => r.id)).toEqual([0, 1, 2])
})

test('visibleRows returns all rows when no filter applied', () => {
  const model = makeModel({
    rowSet: { rows: [{ cellData: {} }, { cellData: {} }, { cellData: {} }] },
    columns: [],
  })
  expect(model.visibleRows?.length).toBe(3)
})

test('visibleRows filters rows based on visibleRowFlags', () => {
  const model = makeModel({
    rowSet: { rows: [{ cellData: {} }, { cellData: {} }, { cellData: {} }] },
    columns: [],
  })
  model.setVisibleRows({ 0: false, 2: false })
  expect(model.visibleRows?.map(r => r.id)).toEqual([1])
})

test('setVisibleRows(undefined) restores full row list', () => {
  const model = makeModel({
    rowSet: { rows: [{ cellData: {} }, { cellData: {} }] },
    columns: [],
  })
  model.setVisibleRows({ 0: false })
  expect(model.visibleRows?.length).toBe(1)
  model.setVisibleRows(undefined)
  expect(model.visibleRows?.length).toBe(2)
})

// Regression: the grid rebuilds its visible-rows lookup on passes that cannot
// have changed the answer (a rows-set, a column-visibility change while a quick
// filter is on), and a fresh object each time re-derived visibleRows — which in
// the SV inspector is a whole new chord track built from every visible feature
test('re-reporting the same visible rows does not invalidate visibleRows', () => {
  const model = makeModel({
    rowSet: { rows: [{ cellData: {} }, { cellData: {} }, { cellData: {} }] },
    columns: [],
  })
  let recomputes = 0
  const dispose = autorun(() => {
    void model.visibleRows
    recomputes++
  })
  expect(recomputes).toBe(1)

  model.setVisibleRows({ 0: false, 1: true, 2: true })
  expect(recomputes).toBe(2)
  // the same answer in a new object: nothing downstream should hear about it
  model.setVisibleRows({ 0: false, 1: true, 2: true })
  expect(recomputes).toBe(2)

  // a lookup that really differs still gets through, in either direction
  model.setVisibleRows({ 0: false, 1: false, 2: true })
  expect(recomputes).toBe(3)
  expect(model.visibleRows?.map(r => r.id)).toEqual([2])
  model.setVisibleRows({ 0: true, 1: true })
  expect(model.visibleRows?.map(r => r.id)).toEqual([0, 1, 2])
  dispose()
})

test('svType getters are inert without an INFO.SVTYPE column', () => {
  const model = makeModel({
    rowSet: { rows: [{ cellData: { ALT: '<DEL>' } }] },
    columns: [{ name: 'ALT' }],
  })
  expect(model.svTypeColumnField).toBeUndefined()
  expect(model.svTypeOptions).toEqual([])
})

test('svTypeOptions lists the distinct sorted SVTYPE values', () => {
  const model = makeModel({
    rowSet: {
      rows: [
        { cellData: { 'INFO.SVTYPE': 'DEL' } },
        { cellData: { 'INFO.SVTYPE': 'DUP' } },
        { cellData: { 'INFO.SVTYPE': 'DEL' } },
        { cellData: { 'INFO.SVTYPE': '' } },
      ],
    },
    columns: [{ name: 'INFO.SVTYPE' }],
  })
  expect(model.svTypeColumnField).toBe('INFO.SVTYPE')
  expect(model.svTypeOptions).toEqual(['DEL', 'DUP'])
})

test('setSvTypeFilter stores the selected value', () => {
  const model = makeModel({
    rowSet: { rows: [{ cellData: { 'INFO.SVTYPE': 'DEL' } }] },
    columns: [{ name: 'INFO.SVTYPE' }],
  })
  expect(model.svTypeFilter).toBeUndefined()
  model.setSvTypeFilter('DEL')
  expect(model.svTypeFilter).toBe('DEL')
  model.setSvTypeFilter(undefined)
  expect(model.svTypeFilter).toBeUndefined()
})
