import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema, { normalizeSnapshot } from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function MultiGenomeIndexedPAFAdapterF(
  pluginManager: PluginManager,
) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'MultiGenomeIndexedPAFAdapter',
        aliases: ['AllVsAllIndexedPAFAdapter'],
        displayName: 'Multi-genome indexed PAF adapter',
        normalizeSnapshot,
        configSchema,
        adapterMetadata: {
          category: 'Synteny adapters',
          // a .pif.gz is claimed by PairwiseIndexedPAFAdapter; same file name,
          // same ambiguity as the unindexed pair above
          alsoReads: /\.pif\.gz$/i,
        },
        getAdapterClass: () =>
          import('./MultiGenomeIndexedPAFAdapter.ts').then(r => r.default),
      }),
  )
}
