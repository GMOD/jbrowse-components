import { readConfObject } from '@jbrowse/core/configuration'

import configSchema from './configSchema.ts'

test('a bare color reaches the schema as solid color', () => {
  const conf = configSchema.create({
    type: 'LinearWiggleDisplay',
    displayId: 'test',
    color: 'green',
  })
  expect(readConfObject(conf, 'useBicolor')).toBe(false)
  expect(readConfObject(conf, 'color')).toBe('green')
})

test('color alongside posColor stays bicolor', () => {
  const conf = configSchema.create({
    type: 'LinearWiggleDisplay',
    displayId: 'test',
    color: 'green',
    posColor: 'red',
  })
  expect(readConfObject(conf, 'useBicolor')).toBe(true)
})
