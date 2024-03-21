import PluginManager from '@jbrowse/core/PluginManager'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema'

export default (pluginManager: PluginManager) => {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        adapterMetadata: {
          hiddenFromGUI: true,
        },
        configSchema,
        displayName: 'Sequence search adapter',
        getAdapterClass: () =>
          import('./SequenceSearchAdapter').then(r => r.default),
        name: 'SequenceSearchAdapter',
      }),
  )
}
