import { AdapterType } from '@jbrowse/core/pluggableElementTypes'
import configSchema from './configSchema'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function FromConfigAdapterF(pluginManager: PluginManager) {
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
