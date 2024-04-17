import PluginManager from '@jbrowse/core/PluginManager'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import configSchema from './configSchema'

export default function MCScanAnchorsAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'MCScanAnchorsAdapter',
        displayName: 'MCScan anchors adapter',
        configSchema,
        adapterMetadata: {
          hiddenFromGUI: true,
        },

        getAdapterClass: () =>
          import('./MCScanAnchorsAdapter').then(r => r.default),
      }),
  )
}
