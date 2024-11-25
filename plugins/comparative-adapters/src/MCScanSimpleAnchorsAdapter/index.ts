import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import configSchema from './configSchema'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function MCScanSimpleAnchorsAdapterF(
  pluginManager: PluginManager,
) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'MCScanSimpleAnchorsAdapter',
        displayName: 'MCScan anchors.simple adapter',
        configSchema,
        adapterMetadata: {
          hiddenFromGUI: true,
        },
        getAdapterClass: () =>
          import('./MCScanSimpleAnchorsAdapter').then(r => r.default),
      }),
  )
}
