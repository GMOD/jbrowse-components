import { AdapterType } from '@jbrowse/core/pluggableElementTypes'
import PluginManager from '@jbrowse/core/PluginManager'

import configSchema from './configSchema'

export default (pluginManager: PluginManager) => {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        adapterMetadata: {
          hiddenFromGUI: true,
        },
        configSchema,
        getAdapterClass: () =>
          import('./RefNameAliasAdapter').then(r => r.default),
        name: 'RefNameAliasAdapter',
      }),
  )
}
