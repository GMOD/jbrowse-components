import PluginManager from '@jbrowse/core/PluginManager'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema'

export default (pluginManager: PluginManager) => {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'SequenceSearchAdapter',
        adapterMetadata: {
          category: null,
          hiddenFromGUI: true,
          displayName: null,
          description: null,
        },
        configSchema,
        getAdapterClass: () =>
          import('./SequenceSearchAdapter').then(r => r.default),
      }),
  )
}
