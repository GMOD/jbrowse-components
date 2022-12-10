import PluginManager from '@jbrowse/core/PluginManager'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchemaF from './configSchema'

export default (pluginManager: PluginManager) => {
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
