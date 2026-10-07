import { readConfObject } from '@jbrowse/core/configuration'

import configSchema from './configSchema.ts'

const base = { type: 'LinearWiggleDisplay', displayId: 'test' }

test('scales.y clips at the 99th percentile by default', () => {
  const config = configSchema.create(base)
  expect(readConfObject(config, ['scales', 'y', 'domainQuantile'])).toBe(0.99)
})

test('the rows shorthand reads as one row per subtrack', () => {
  const config = configSchema.create({ ...base, rows: 'source' })
  expect(readConfObject(config, ['rows', 'field'])).toBe('source')
})

test('no rows is the default, and every source shares one plot', () => {
  expect(readConfObject(configSchema.create(base), ['rows', 'field'])).toBe('')
})

test('rows on any other field are refused by the slot itself', () => {
  expect(() => configSchema.create({ ...base, rows: 'group' })).toThrow(/group/)
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
