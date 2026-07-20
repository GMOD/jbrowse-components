import { readConfObject } from '@jbrowse/core/configuration'

import multiConfigSchema from './configSchema.ts'
import linearConfigSchema from '../LinearWiggleDisplay/configSchema.ts'

test('MultiLinearWiggleDisplay config schema has autoscale and numQuantile defaults', () => {
  const config = multiConfigSchema.create({
    type: 'MultiLinearWiggleDisplay',
    displayId: 'test',
  })
  expect(readConfObject(config, 'autoscale')).toBe('localpercentile')
  expect(readConfObject(config, 'numStdDev')).toBe(3)
  expect(readConfObject(config, 'numQuantile')).toBe(0.99)
})

test('LinearWiggleDisplay config schema has autoscale and numQuantile defaults', () => {
  const config = linearConfigSchema.create({
    type: 'LinearWiggleDisplay',
    displayId: 'test',
  })
  expect(readConfObject(config, 'autoscale')).toBe('localpercentile')
  expect(readConfObject(config, 'numStdDev')).toBe(3)
  expect(readConfObject(config, 'numQuantile')).toBe(0.99)
})

test('MultiLinearWiggleDisplay remaps single-source defaultRendering names', () => {
  const config = multiConfigSchema.create({
    type: 'MultiLinearWiggleDisplay',
    displayId: 'test',
    defaultRendering: 'xyplot',
  })
  expect(readConfObject(config, 'defaultRendering')).toBe('multixyplot')
})
