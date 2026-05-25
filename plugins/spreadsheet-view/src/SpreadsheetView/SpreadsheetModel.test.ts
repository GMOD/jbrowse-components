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
