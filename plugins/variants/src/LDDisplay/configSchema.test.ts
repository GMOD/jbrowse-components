import { getConfigurationSchemaDefinition } from '@jbrowse/core/configuration'

import ldTrackDisplayConfigSchema from './configSchemaLDTrack.ts'

const slots = () =>
  Object.keys(getConfigurationSchemaDefinition(ldTrackDisplayConfigSchema())!)

test('keeps what its mixins read, and its identifier', () => {
  expect(slots()).toEqual(
    expect.arrayContaining(['height', 'showLegend', 'squashToHeight']),
  )
  expect(
    ldTrackDisplayConfigSchema().create({
      type: 'LDTrackDisplay',
      displayId: 'ld-test',
    }).displayId,
  ).toBe('ld-test')
})

// An LD file serves no features and the display takes no byte gate.
test.each(['mouseover', 'fetchSizeLimit', 'forceLoad'])(
  'publishes no %s slot, which it never reads',
  slot => {
    expect(slots()).not.toContain(slot)
  },
)
