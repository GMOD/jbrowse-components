import { AdapterType } from '@jbrowse/core/pluggableElementTypes'
import PluginManager from '@jbrowse/core/PluginManager'

import configSchema from './configSchema'

export default (pluginManager: PluginManager) => {
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
