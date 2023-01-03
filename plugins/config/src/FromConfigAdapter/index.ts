import { AdapterType } from '@jbrowse/core/pluggableElementTypes'
import PluginManager from '@jbrowse/core/PluginManager'
import configSchema from './configSchema'

export default (pluginManager: PluginManager) => {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'FromConfigAdapter',
        configSchema,
        getAdapterClass: () =>
          import('./FromConfigAdapter').then(r => r.default),
        adapterMetadata: {
          hiddenFromGUI: true,
        },
      }),
  )
}
