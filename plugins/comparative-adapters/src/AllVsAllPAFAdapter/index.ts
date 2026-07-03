import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function AllVsAllPAFAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'AllVsAllPAFAdapter',
        displayName: 'All-vs-all PAF adapter',
        configSchema,
        adapterMetadata: {
          category: 'Synteny adapters',
        },

        getAdapterClass: () =>
          import('./AllVsAllPAFAdapter.ts').then(r => r.default),
      }),
  )
}
