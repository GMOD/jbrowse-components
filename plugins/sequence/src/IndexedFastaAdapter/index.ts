import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function IndexedFastaAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(() => {
    return new AdapterType({
      name: 'IndexedFastaAdapter',
      displayName: 'Indexed FASTA adapter',
      configSchema,
      adapterMetadata: {
        hiddenFromGUI: true,
      },

      getAdapterClass: () =>
        import('./IndexedFastaAdapter.ts').then(r => r.default),
    })
  })
}
