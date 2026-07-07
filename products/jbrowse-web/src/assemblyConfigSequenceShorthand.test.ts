import PluginManager from '@jbrowse/core/PluginManager'
import assemblyConfigSchemaFactory from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import corePlugins from './corePlugins.ts'

function getAssemblyConfigSchema() {
  const pluginManager = new PluginManager(corePlugins.map(P => new P()))
    .createPluggableElements()
    .configure()
  return assemblyConfigSchemaFactory(pluginManager)
}

test('sequence.type/trackId can be omitted, filled in from the assembly name', () => {
  const model = getAssemblyConfigSchema().create({
    name: 'volvox',
    sequence: {
      adapter: {
        type: 'BgzipFastaAdapter',
        uri: 'volvox.fa.gz',
      },
    },
  })

  expect(model.sequence.type).toBe('ReferenceSequenceTrack')
  expect(model.sequence.trackId).toBe('volvox-ReferenceSequenceTrack')
  expect(getSnapshot(model.sequence.adapter)).toMatchObject({
    type: 'BgzipFastaAdapter',
  })
})

test('an explicit sequence.type/trackId is left untouched', () => {
  const model = getAssemblyConfigSchema().create({
    name: 'volvox',
    sequence: {
      type: 'ReferenceSequenceTrack',
      trackId: 'volvox-custom-id',
      adapter: {
        type: 'BgzipFastaAdapter',
        uri: 'volvox.fa.gz',
      },
    },
  })

  expect(model.sequence.trackId).toBe('volvox-custom-id')
})
