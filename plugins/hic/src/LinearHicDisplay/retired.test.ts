import { readConfObject } from '@jbrowse/core/configuration'

import configSchemaFactory from './configSchema.ts'
import { retiredState } from './retired.ts'

// What a v4.3.0 share link's display wrote, created on the slots it lifts to:
// the schema is closed, so a lift that names no slot throws here.
function liftedConf(instance: Record<string, unknown>) {
  return configSchemaFactory().create({
    type: 'LinearHicDisplay',
    displayId: 'hic-LinearHicDisplay',
    ...retiredState.lift(instance),
  })
}

test('a v4 share link keeps its normalization, log scale, scheme, layout and legend', () => {
  const conf = liftedConf({
    resolution: 4,
    useLogScale: true,
    colorScheme: 'viridis',
    activeNormalization: 'VC',
    mode: 'adjust',
    showLegend: true,
  })
  expect(readConfObject(conf, ['data', 'resolution'])).toBe(2)
  expect(readConfObject(conf, ['data', 'normalization'])).toBe('VC')
  expect(readConfObject(conf, ['encoding', 'color', 'scale', 'type'])).toBe(
    'symlog',
  )
  expect(readConfObject(conf, ['encoding', 'color', 'scale', 'scheme'])).toBe(
    'viridis',
  )
  expect(readConfObject(conf, 'heightMode')).toBe('fit')
  expect(readConfObject(conf, ['legend', 'show'])).toBe(true)
})

test('a v4 display at its defaults writes nothing', () => {
  expect(
    retiredState.lift({
      resolution: 1,
      useLogScale: false,
      activeNormalization: 'KR',
      mode: 'triangular',
    }),
  ).toEqual({})
})

test('a coarser v4 resolution steps coarser', () => {
  expect(retiredState.lift({ resolution: 0.25 })).toEqual({
    data: { resolution: -2 },
  })
})
