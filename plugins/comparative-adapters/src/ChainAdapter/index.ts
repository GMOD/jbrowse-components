import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import configSchema from './configSchema'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function ChainAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'ChainAdapter',
        displayName: 'Liftover chain adapter',
        configSchema,
        adapterMetadata: {
          hiddenFromGUI: true,
        },
        getAdapterClass: () => import('./ChainAdapter').then(r => r.default),
      }),
  )
}
