import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function BedGraphAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'BedGraphAdapter',
        displayName: 'BedGraph adapter',
        configSchema,
        getAdapterClass: () =>
          import('./BedGraphAdapter.ts').then(r => r.default),
      }),
  )
}
