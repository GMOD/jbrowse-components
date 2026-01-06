import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchemaF from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function GCContentAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'GCContentAdapter',
        displayName: 'GC content adapter',
        adapterMetadata: {
          hiddenFromGUI: true,
        },
        configSchema: configSchemaF(pluginManager),
        getAdapterClass: () =>
          import('./GCContentAdapter.ts').then(r => r.default),
      }),
  )
}
