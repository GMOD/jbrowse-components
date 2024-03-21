import PluginManager from '@jbrowse/core/PluginManager'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import configSchema from './configSchema'

export default (pluginManager: PluginManager) => {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        adapterMetadata: {
          hiddenFromGUI: true,
        },
        configSchema,
        displayName: 'MCScan anchors adapter',
        getAdapterClass: () =>
          import('./MCScanAnchorsAdapter').then(r => r.default),

        name: 'MCScanAnchorsAdapter',
      }),
  )
}
