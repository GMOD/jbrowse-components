import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema, { normalizeSnapshot } from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function ChainAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'ChainAdapter',
        displayName: 'Liftover chain adapter',
        normalizeSnapshot,
        configSchema,
        adapterMetadata: {
          category: 'Synteny adapters',
        },
        getAdapterClass: () => import('./ChainAdapter.ts').then(r => r.default),
      }),
  )
}
