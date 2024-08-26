import PluginManager from '@jbrowse/core/PluginManager'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema'

export default function UnindexedFastaAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'UnindexedFastaAdapter',
        displayName: 'Unindexed FASTA adapter',
        configSchema,
        adapterMetadata: {
          hiddenFromGUI: true,
        },
        getAdapterClass: () =>
          import('./UnindexedFastaAdapter').then(r => r.default),
      }),
  )
}
