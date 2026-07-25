import { readConfObject } from '@jbrowse/core/configuration'

import linearConfigSchema from '../LinearWiggleDisplay/configSchema.ts'
import {
  MULTI_WIGGLE_RENDERING_TYPES,
  WIGGLE_RENDERING_TYPES,
} from '../util.ts'
import multiConfigSchema, { remapMultiWiggleRendering } from './configSchema.ts'

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

// An unmapped single-source name reaches the multi enum verbatim and MST
// rejects the whole track config, so the remap table has to cover every
// single-source rendering, not just the ones that predate it.
test.each([...WIGGLE_RENDERING_TYPES])(
  'single-source rendering %s remaps onto a valid multi rendering',
  rendering => {
    const { defaultRendering } = remapMultiWiggleRendering({
      defaultRendering: rendering,
    })
    expect(MULTI_WIGGLE_RENDERING_TYPES).toContain(defaultRendering)
    expect(
      readConfObject(
        multiConfigSchema.create({
          type: 'MultiLinearWiggleDisplay',
          displayId: 'test',
          defaultRendering: rendering,
        }),
        'defaultRendering',
      ),
    ).toBe(defaultRendering)
  },
)
