import PluginManager from '@jbrowse/core/PluginManager'

import ThisPlugin from '../index.ts'

test('preProcessSnapshot tolerates non-array displays', () => {
  const pluginManager = new PluginManager([new ThisPlugin()])
  pluginManager.createPluggableElements()
  pluginManager.configure()

  const { configSchema } = pluginManager.getTrackType('ReferenceSequenceTrack')

  // `displays` is always an array, but a malformed config (or MST's union
  // type determination probing this schema's preProcessSnapshot with another
  // track's snapshot) can hand it a non-array object, so it must not throw.
  expect(() =>
    configSchema.is({
      type: 'ReferenceSequenceTrack',
      trackId: 'volvox_refseq',
      displays: { color: 'green' },
    }),
  ).not.toThrow()
})
