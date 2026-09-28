import { READS_REFERENCE } from '@jbrowse/core/data_adapters/dataAdapterCache'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function HtsgetBamAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(() => {
    return new AdapterType({
      name: 'HtsgetBamAdapter',
      adapterCapabilities: [READS_REFERENCE],
      displayName: 'Htsget BAM adapter',
      adapterMetadata: {
        hiddenFromGUI: true,
      },
      configSchema,
      getAdapterClass: () =>
        import('./HtsgetBamAdapter.ts').then(r => r.default),
    })
  })
}
