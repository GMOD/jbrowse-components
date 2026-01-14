import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function BgzipFastaAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(() => {
    return new AdapterType({
      name: 'BgzipFastaAdapter',
      displayName: 'Bgzip-indexed FASTA adapter',
      configSchema,
      adapterMetadata: {
        hiddenFromGUI: true,
      },
      getAdapterClass: () =>
        import('./BgzipFastaAdapter.ts').then(r => r.default),
    })
  })
}
