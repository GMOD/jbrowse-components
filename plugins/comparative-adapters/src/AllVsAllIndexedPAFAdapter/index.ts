import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema, { normalizeSnapshot } from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function AllVsAllIndexedPAFAdapterF(
  pluginManager: PluginManager,
) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'AllVsAllIndexedPAFAdapter',
        displayName: 'All-vs-all indexed PAF adapter',
        normalizeSnapshot,
        configSchema,
        adapterMetadata: {
          category: 'Synteny adapters',
          // a .pif.gz is claimed by PairwiseIndexedPAFAdapter; same file name,
          // same ambiguity as the unindexed pair above
          alsoReads: /\.pif\.gz$/i,
        },
        getAdapterClass: () =>
          import('./AllVsAllIndexedPAFAdapter.ts').then(r => r.default),
      }),
  )
}
