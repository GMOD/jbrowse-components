import { readConfObject } from '@jbrowse/core/configuration'

import multiConfigSchema from './configSchema.ts'
import linearConfigSchema from '../LinearWiggleDisplay/configSchema.ts'

test('MultiLinearWiggleDisplay config schema has autoscale and numStdDev defaults', () => {
  const config = multiConfigSchema.create({ type: 'MultiLinearWiggleDisplay' })
  expect(readConfObject(config, 'autoscale')).toBe('local')
  expect(readConfObject(config, 'numStdDev')).toBe(3)
})

test('LinearWiggleDisplay config schema has autoscale and numStdDev defaults', () => {
  const config = linearConfigSchema.create({ type: 'LinearWiggleDisplay' })
  expect(readConfObject(config, 'autoscale')).toBe('local')
  expect(readConfObject(config, 'numStdDev')).toBe(3)
})
