import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { ConfigurationSchema } from './configurationSchema.ts'
import { applyConfSettings, mergeConfSettings, setConf } from './getConf.ts'
import { plotOf, plotWrites } from './plot.ts'

const Rows = ConfigurationSchema(
  'KeyedRows',
  {
    field: { type: 'string', defaultValue: '' },
    sort: { type: 'stringArray', defaultValue: [] },
    labels: { type: 'stringMap', defaultValue: {} },
    step: { type: 'number', defaultValue: 0 },
  },
  {
    shorthand: 'field',
    writes: { keyedBy: 'field', keyed: ['sort', 'labels'] },
    plot: true,
  },
)

const Display = ConfigurationSchema('KeyedRowsDisplay', { rows: Rows })

const arranged = {
  rows: { field: 'source', sort: ['b', 'a'], labels: { a: 'A' }, step: 8 },
}

function rowsOf(conf: { rows: object }) {
  return getSnapshot(conf.rows)
}

const cases: {
  name: string
  base: Record<string, unknown>
  write: Record<string, unknown>
  rows: Record<string, unknown>
}[] = [
  {
    name: 'a new field unsets the keyed members and keeps the rest',
    base: arranged,
    write: { rows: 'tissue' },
    rows: { field: 'tissue', step: 8 },
  },
  {
    name: 'a new field keeps the keyed members it states',
    base: arranged,
    write: { rows: { field: 'tissue', sort: ['x'] } },
    rows: { field: 'tissue', sort: ['x'], step: 8 },
  },
  {
    name: 'a new field stated after a keyed member still keeps that member',
    base: arranged,
    write: { rows: { sort: ['x'], field: 'tissue' } },
    rows: { field: 'tissue', sort: ['x'], step: 8 },
  },
  {
    name: 'restating the field in force keeps the arrangement',
    base: arranged,
    write: { rows: 'source' },
    rows: arranged.rows,
  },
  {
    name: 'a write over an empty field resets nothing',
    base: { rows: { sort: ['b', 'a'] } },
    write: { rows: 'sample' },
    rows: { field: 'sample', sort: ['b', 'a'] },
  },
  {
    name: 'a write to an empty field resets nothing',
    base: arranged,
    write: { rows: { field: '' } },
    rows: { sort: ['b', 'a'], labels: { a: 'A' }, step: 8 },
  },
  {
    name: 'a member write without the field merges',
    base: arranged,
    write: { rows: { sort: ['a', 'b'] } },
    rows: { ...arranged.rows, sort: ['a', 'b'] },
  },
  {
    name: 'null resets one member',
    base: arranged,
    write: { rows: { labels: null } },
    rows: { field: 'source', sort: ['b', 'a'], step: 8 },
  },
]

describe.each(cases)('$name', ({ base, write, rows }) => {
  test('mergeConfSettings', () => {
    const merged = mergeConfSettings(Display, base, write)
    expect(rowsOf(Display.create(merged))).toEqual(rows)
  })

  test('applyConfSettings', () => {
    const conf = Display.create(base)
    applyConfSettings(conf, write)
    expect(rowsOf(conf)).toEqual(rows)
  })
})

test('setConf on the field unsets the keyed members', () => {
  const conf = Display.create(arranged)
  setConf(conf, ['rows', 'field'], 'tissue')
  expect(rowsOf(conf)).toEqual({ field: 'tissue', step: 8 })
})

test('setConf restating the field keeps the arrangement', () => {
  const conf = Display.create(arranged)
  setConf(conf, ['rows', 'field'], 'source')
  expect(rowsOf(conf)).toEqual(arranged.rows)
})

test('a keyed member the schema does not declare is refused', () => {
  expect(() =>
    ConfigurationSchema(
      'BadKeyedRows',
      { field: { type: 'string', defaultValue: '' } },
      { writes: { keyedBy: 'field', keyed: ['sort'] } },
    ),
  ).toThrow(/sort/)
})

describe('the plot', () => {
  test('a read keeps a field alone as an object', () => {
    const conf = Display.create({ rows: 'source' })
    expect(plotOf(conf)).toEqual({ rows: { field: 'source' } })
  })

  test('edit plot text changing the field drops the arrangement it restates', () => {
    const conf = Display.create(arranged)
    const text = { rows: { ...arranged.rows, field: 'tissue' } }
    expect(plotWrites(conf, text, { whole: true })).toEqual({
      rows: { field: 'tissue', step: 8 },
    })
  })

  test('edit plot text changing the field keeps an arrangement it changes', () => {
    const conf = Display.create(arranged)
    const text = { rows: { ...arranged.rows, field: 'tissue', sort: ['x'] } }
    expect(plotWrites(conf, text, { whole: true })).toEqual({
      rows: { field: 'tissue', sort: ['x'], step: 8 },
    })
  })

  test('edit plot text on the same field keeps the arrangement', () => {
    const conf = Display.create(arranged)
    const text = { rows: { ...arranged.rows, step: 4 } }
    expect(plotWrites(conf, text, { whole: true })).toEqual({
      rows: { ...arranged.rows, step: 4 },
    })
  })

  test('a patch changing the field drops the arrangement', () => {
    const conf = Display.create(arranged)
    expect(plotWrites(conf, { rows: 'tissue' })).toEqual({
      rows: { field: 'tissue', step: 8 },
    })
  })
})
