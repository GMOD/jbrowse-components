import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function AllVsAllPAFAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'AllVsAllPAFAdapter',
        displayName: 'AllVsAllPAF adapter',
        configSchema,
        adapterMetadata: {
          category: 'Synteny adapters',
        },
        getAdapterClass: () =>
          import('./AllVsAllPAFAdapter').then(r => r.default),
      }),
  )
}
