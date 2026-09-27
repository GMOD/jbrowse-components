import { DERIVES_FROM_SEQUENCE } from '@jbrowse/core/data_adapters/dataAdapterCache'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function SequenceSearchAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(() => {
    return new AdapterType({
      name: 'SequenceSearchAdapter',
      adapterCapabilities: [DERIVES_FROM_SEQUENCE],
      displayName: 'Sequence search adapter',
      adapterMetadata: {
        hiddenFromGUI: true,
      },
      configSchema,
      getAdapterClass: () =>
        import('./SequenceSearchAdapter.ts').then(r => r.default),
    })
  })
}
