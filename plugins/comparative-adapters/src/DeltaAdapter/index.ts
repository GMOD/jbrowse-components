import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema, { normalizeSnapshot } from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function DeltaAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'DeltaAdapter',
        displayName: 'MUMmer delta adapter',
        normalizeSnapshot,
        configSchema,
        adapterMetadata: {
          category: 'Synteny adapters',
        },
        getAdapterClass: () => import('./DeltaAdapter.ts').then(r => r.default),
      }),
  )
}
