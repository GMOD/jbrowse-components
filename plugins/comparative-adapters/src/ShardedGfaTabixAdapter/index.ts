import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function ShardedGfaTabixAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'ShardedGfaTabixAdapter',
        displayName: 'Sharded GFA tabix adapter',
        configSchema,
        adapterMetadata: {
          category: 'Synteny adapters',
          hiddenFromGUI: true,
        },
        getAdapterClass: () =>
          import('./ShardedGfaTabixAdapter.ts').then(r => r.default),
      }),
  )
}
