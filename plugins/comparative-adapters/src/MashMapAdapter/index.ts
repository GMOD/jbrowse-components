import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function MashMapAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'MashMapAdapter',
        displayName: 'MashMap adapter',
        configSchema,
        adapterMetadata: {
          category: 'Synteny adapters',
        },
        getAdapterClass: () => import('./MashMapAdapter').then(r => r.default),
      }),
  )
}
