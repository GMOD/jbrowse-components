import PluginManager from '@jbrowse/core/PluginManager'

import ThisPlugin from '../index.ts'

test('preProcessSnapshot tolerates non-array displays', () => {
  const pluginManager = new PluginManager([new ThisPlugin()])
  pluginManager.createPluggableElements()
  pluginManager.configure()

  const { configSchema } = pluginManager.getTrackType('ReferenceSequenceTrack')

  // `displays` is normally an array, but other track types accept a
  // shorthand settings object instead. MST's union type determination can
  // try this schema's preProcessSnapshot against such a snapshot while
  // looking for a matching type, so it must not throw.
  expect(() =>
    configSchema.is({
      type: 'ReferenceSequenceTrack',
      trackId: 'volvox_refseq',
      displays: { color: 'green' },
    }),
  ).not.toThrow()
})
