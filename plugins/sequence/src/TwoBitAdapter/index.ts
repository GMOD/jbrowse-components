import PluginManager from '@jbrowse/core/PluginManager'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema'

export default (pluginManager: PluginManager) => {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'TwoBitAdapter',
        displayName: 'TwoBit adapter',
        configSchema,
        adapterMetadata: {
          hiddenFromGUI: true,
        },
        getAdapterClass: () => import('./TwoBitAdapter').then(r => r.default),
      }),
  )
}
