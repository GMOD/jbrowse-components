import configSchema from './configSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

export default (pluginManager: PluginManager) => {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'HtsgetBamAdapter',
        adapterMetadata: {
          category: null,
          hiddenFromGUI: true,
          displayName: null,
          description: null,
        },
        configSchema,
        getAdapterClass: () =>
          import('./HtsgetBamAdapter').then(r => r.default),
      }),
  )
}
