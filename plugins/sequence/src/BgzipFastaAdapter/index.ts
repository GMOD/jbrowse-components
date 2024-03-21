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
        displayName: 'Bgzip-indexed FASTA adapter',
        getAdapterClass: () =>
          import('./BgzipFastaAdapter').then(r => r.default),
        name: 'BgzipFastaAdapter',
      }),
  )
}
