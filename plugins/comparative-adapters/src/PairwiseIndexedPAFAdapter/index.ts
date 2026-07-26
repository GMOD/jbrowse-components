import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema, { normalizeSnapshot } from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function PairwiseIndexedPAFAdapterF(
  pluginManager: PluginManager,
) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'PairwiseIndexedPAFAdapter',
        displayName: 'Pairwise indexed PAF adapter',
        normalizeSnapshot,
        configSchema,
        adapterMetadata: {
          category: 'Synteny adapters',
        },
        getAdapterClass: () =>
          import('./PairwiseIndexedPAFAdapter.ts').then(r => r.default),
      }),
  )
}
