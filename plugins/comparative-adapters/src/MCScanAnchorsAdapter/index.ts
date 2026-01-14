import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function MCScanAnchorsAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'MCScanAnchorsAdapter',
        displayName: 'MCScan anchors adapter',
        configSchema,
        adapterMetadata: {
          category: 'Synteny adapters',
        },

        getAdapterClass: () =>
          import('./MCScanAnchorsAdapter.ts').then(r => r.default),
      }),
  )
}
