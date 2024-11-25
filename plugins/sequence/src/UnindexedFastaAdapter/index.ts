import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema'
import type PluginManager from '@jbrowse/core/PluginManager'

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
