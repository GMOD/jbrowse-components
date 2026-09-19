import { readConfObject } from '@jbrowse/core/configuration'

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

test('the facet shorthand reads as one row per subtrack', () => {
  const config = configSchema.create({ ...base, facet: 'source' })
  expect(readConfObject(config, ['facet', 'field'])).toBe('source')
})

test('no facet is the default, and every source shares one plot', () => {
  expect(readConfObject(configSchema.create(base), ['facet', 'field'])).toBe('')
})

test('a facet on any other field is refused where the config is read', () => {
  expect(() => configSchema.create({ ...base, facet: 'group' })).toThrow(
    /sections on "source" alone/,
  )
})

test('the row order rides on the facet, and there is no `domain` slot', () => {
  const config = configSchema.create({
    ...base,
    facet: { field: 'source', domain: ['b', 'a'] },
  })
  expect(readConfObject(config, ['facet', 'domain'])).toEqual(['b', 'a'])
  expect('domain' in config).toBe(false)
})
