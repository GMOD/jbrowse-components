import { readConfObject } from '@jbrowse/core/configuration'

import { configSchemaFactory } from './configSchema.ts'

const schema = configSchemaFactory()
const Y = ['encoding', 'y'] as const

test('a bare string at the display-level encoding.y is refused', () => {
  expect(() =>
    schema.create({ displayId: 'd', encoding: { y: 'score' } }),
  ).toThrow('YChannel')
})

test('the fence starts at 1, the extremes', () => {
  const conf = schema.create({ displayId: 'd' })
  expect(readConfObject(conf, [...Y, 'scale', 'fenceQuantile'])).toBe(1)
})
