import PluginManager from '@jbrowse/core/PluginManager'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema'

export default (pluginManager: PluginManager) => {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'IndexedFastaAdapter',
        displayName: 'Indexed FASTA adapter',
        configSchema,
        adapterMetadata: {
          hiddenFromGUI: true,
        },
        getAdapterClass: () =>
          import('./IndexedFastaAdapter').then(r => r.default),
      }),
  )
}
