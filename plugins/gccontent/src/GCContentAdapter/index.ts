import PluginManager from '@jbrowse/core/PluginManager'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchemaF from './configSchema'

export default (pluginManager: PluginManager) => {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        adapterMetadata: {
          hiddenFromGUI: true,
        },
        configSchema: configSchemaF(pluginManager),
        displayName: 'GC content adapter',
        getAdapterClass: () =>
          import('./GCContentAdapter').then(r => r.default),
        name: 'GCContentAdapter',
      }),
  )
}
