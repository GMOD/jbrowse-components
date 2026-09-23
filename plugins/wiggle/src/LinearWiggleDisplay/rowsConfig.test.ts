import { readConfObject } from '@jbrowse/core/configuration'

import { checkRowsField } from '../shared/checkRowsField.ts'
import configSchema from './configSchema.ts'

const base = { type: 'LinearWiggleDisplay', displayId: 'test' }

test('scales.y has the autoscale defaults', () => {
  const config = configSchema.create(base)
  expect(readConfObject(config, ['scales', 'y', 'autoscale'])).toBe(
    'localpercentile',
  )
  expect(readConfObject(config, ['scales', 'y', 'numStdDev'])).toBe(3)
  expect(readConfObject(config, ['scales', 'y', 'numQuantile'])).toBe(0.99)
})

test('the rows shorthand reads as one row per subtrack', () => {
  const config = configSchema.create({ ...base, rows: 'source' })
  expect(readConfObject(config, ['rows', 'field'])).toBe('source')
})

test('no rows is the default, and every source shares one plot', () => {
  expect(readConfObject(configSchema.create(base), ['rows', 'field'])).toBe('')
})

test('rows on any other field are refused where the config is read', () => {
  expect(() => configSchema.create({ ...base, rows: 'group' })).toThrow(
    /puts "source" alone on rows/,
  )
})

test('a facet left over from the old spelling is refused by name', () => {
  expect(() => configSchema.create({ ...base, facet: 'source' })).toThrow(
    /`rows: "source"`/,
  )
})

// A track's `displays` union runs every candidate schema's preprocessor over
// every entry while it works out which display a snapshot is, so a refusal that
// did not ask whose snapshot it had would reject the mark display's
// `facet: 'source'` from the schema it was never meant for.
test("leaves another display type's facet alone", () => {
  const foreign = { type: 'LinearMarkDisplay', facet: 'source' }
  expect(checkRowsField('LinearWiggleDisplay')(foreign)).toBe(foreign)
})

test('the arrangement rides on rows, and there is no `domain` slot', () => {
  const config = configSchema.create({
    ...base,
    rows: {
      field: 'source',
      domain: ['b', 'a'],
      labels: { a: 'Sample A' },
      kept: ['a'],
    },
  })
  expect(readConfObject(config, ['rows', 'domain'])).toEqual(['b', 'a'])
  expect(readConfObject(config, ['rows', 'labels'])).toEqual({ a: 'Sample A' })
  expect(readConfObject(config, ['rows', 'kept'])).toEqual(['a'])
  expect(readConfObject(config, ['rows', 'tree'])).toBeUndefined()
  expect('domain' in config).toBe(false)
})

test('rowColor pairs each named subtrack with its colour', () => {
  const config = configSchema.create({
    ...base,
    rowColor: { domain: ['a', 'b'], range: ['#f00', '#0f0'] },
  })
  expect(readConfObject(config, ['rowColor', 'domain'])).toEqual(['a', 'b'])
  expect(readConfObject(config, ['rowColor', 'range'])).toEqual([
    '#f00',
    '#0f0',
  ])
})
