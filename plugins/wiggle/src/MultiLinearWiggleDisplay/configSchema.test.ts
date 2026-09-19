import { readConfObject } from '@jbrowse/core/configuration'

import linearConfigSchema from '../LinearWiggleDisplay/configSchema.ts'
import multiConfigSchema from './configSchema.ts'

test('MultiLinearWiggleDisplay scales.y has the autoscale defaults', () => {
  const config = multiConfigSchema.create({
    type: 'MultiLinearWiggleDisplay',
    displayId: 'test',
  })
  expect(readConfObject(config, ['scales', 'y', 'autoscale'])).toBe(
    'localpercentile',
  )
  expect(readConfObject(config, ['scales', 'y', 'numStdDev'])).toBe(3)
  expect(readConfObject(config, ['scales', 'y', 'numQuantile'])).toBe(0.99)
})

test('LinearWiggleDisplay scales.y has the autoscale defaults', () => {
  const config = linearConfigSchema.create({
    type: 'LinearWiggleDisplay',
    displayId: 'test',
  })
  expect(readConfObject(config, ['scales', 'y', 'autoscale'])).toBe(
    'localpercentile',
  )
  expect(readConfObject(config, ['scales', 'y', 'numStdDev'])).toBe(3)
  expect(readConfObject(config, ['scales', 'y', 'numQuantile'])).toBe(0.99)
})

test('the facet shorthand reads as one row per subtrack', () => {
  const config = multiConfigSchema.create({
    type: 'MultiLinearWiggleDisplay',
    displayId: 'test',
    facet: 'source',
  })
  expect(readConfObject(config, ['facet', 'field'])).toBe('source')
})

test.each([multiConfigSchema, linearConfigSchema])(
  'a facet on any other field is refused where the config is read',
  schema => {
    expect(() =>
      schema.create({
        type: 'MultiLinearWiggleDisplay',
        displayId: 'test',
        facet: 'group',
      }),
    ).toThrow(/sections on "source" alone/)
  },
)
