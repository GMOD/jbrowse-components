import { DERIVES_FROM_SEQUENCE } from '@jbrowse/core/data_adapters/dataAdapterCache'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function MotifListAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(() => {
    return new AdapterType({
      name: 'MotifListAdapter',
      adapterCapabilities: [DERIVES_FROM_SEQUENCE],
      displayName: 'Motif list adapter',
      adapterMetadata: {
        hiddenFromGUI: true,
      },
      configSchema,
      getAdapterClass: () =>
        import('./MotifListAdapter.ts').then(r => r.default),
    })
  })
}
