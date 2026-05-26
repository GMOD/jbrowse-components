import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema, { normalizeSnapshot } from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function UnindexedFastaAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(() => {
    return new AdapterType({
      name: 'UnindexedFastaAdapter',
      displayName: 'Unindexed FASTA adapter',
      normalizeSnapshot,
      configSchema,
      adapterMetadata: {
        hiddenFromGUI: true,
      },
      getAdapterClass: () =>
        import('./UnindexedFastaAdapter.ts').then(r => r.default),
    })
  })
}
