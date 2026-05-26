import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema, { normalizeSnapshot } from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function PAFAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'PAFAdapter',
        displayName: 'PAF adapter',
        normalizeSnapshot,
        configSchema,
        adapterMetadata: {
          category: 'Synteny adapters',
        },
        getAdapterClass: () => import('./PAFAdapter.ts').then(r => r.default),
      }),
  )
}
