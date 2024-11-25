import { AdapterType } from '@jbrowse/core/pluggableElementTypes'

import configSchema from './configSchema'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function RefNameAliasAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'RefNameAliasAdapter',
        configSchema,
        getAdapterClass: () =>
          import('./RefNameAliasAdapter').then(r => r.default),
        adapterMetadata: {
          hiddenFromGUI: true,
        },
      }),
  )
}
