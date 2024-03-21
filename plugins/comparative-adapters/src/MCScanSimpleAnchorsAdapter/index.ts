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
        displayName: 'MCScan anchors.simple adapter',
        getAdapterClass: () =>
          import('./MCScanSimpleAnchorsAdapter').then(r => r.default),
        name: 'MCScanSimpleAnchorsAdapter',
      }),
  )
}
