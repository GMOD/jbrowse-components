import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import configSchema from './configSchema'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function PAFAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'PAFAdapter',
        displayName: 'PAF adapter',
        configSchema,
        adapterMetadata: {
          hiddenFromGUI: true,
        },
        getAdapterClass: () => import('./PAFAdapter').then(r => r.default),
      }),
  )
}
