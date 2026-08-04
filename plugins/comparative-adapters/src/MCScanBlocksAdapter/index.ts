import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function MCScanBlocksAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'MCScanBlocksAdapter',
        displayName: 'MCScan multi-genome blocks adapter',
        configSchema,
        adapterMetadata: {
          category: 'Synteny adapters',
          // no guesser claims .blocks at all, so without this the file resolves
          // to UNKNOWN and the adapter has to be found by name
          alsoReads: /\.blocks$/i,
        },
        getAdapterClass: () =>
          import('./MCScanBlocksAdapter.ts').then(r => r.default),
      }),
  )
}
