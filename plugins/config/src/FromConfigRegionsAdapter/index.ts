import { AdapterType } from '@jbrowse/core/pluggableElementTypes'
import configSchema from './configSchema'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function FromConfigRegionsAdapterF(
  pluginManager: PluginManager,
) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'FromConfigRegionsAdapter',
        configSchema,
        getAdapterClass: () =>
          import('./FromConfigRegionsAdapter').then(r => r.default),
        adapterMetadata: {
          hiddenFromGUI: true,
        },
      }),
  )
}
