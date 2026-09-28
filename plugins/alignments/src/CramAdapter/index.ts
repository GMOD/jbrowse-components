import { READS_REFERENCE } from '@jbrowse/core/data_adapters/dataAdapterCache'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema, { normalizeSnapshot } from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function CramAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(() => {
    return new AdapterType({
      name: 'CramAdapter',
      adapterCapabilities: [READS_REFERENCE],
      displayName: 'CRAM adapter',
      normalizeSnapshot,
      configSchema,
      getAdapterClass: () => import('./CramAdapter.ts').then(r => r.default),
    })
  })
}
