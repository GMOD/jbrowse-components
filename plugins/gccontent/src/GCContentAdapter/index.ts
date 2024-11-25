import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchemaF from './configSchema'
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
          import('./GCContentAdapter').then(r => r.default),
      }),
  )
}
