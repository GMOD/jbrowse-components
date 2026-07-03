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
        },

        getAdapterClass: () =>
          import('./MCScanBlocksAdapter.ts').then(r => r.default),
      }),
  )
}
