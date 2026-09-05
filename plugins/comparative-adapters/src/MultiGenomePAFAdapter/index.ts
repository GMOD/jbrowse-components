import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

// #region alsoReads
export default function MultiGenomePAFAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'MultiGenomePAFAdapter',
        aliases: ['AllVsAllPAFAdapter'],
        displayName: 'Multi-genome PAF adapter',
        configSchema,
        adapterMetadata: {
          category: 'Synteny adapters',
          // a .paf is claimed by PAFAdapter, and a multi-genome one is
          // indistinguishable by name; read as pairwise it attributes one
          // genome's contigs to another rather than merely dropping them
          alsoReads: /\.paf(\.gz)?$/i,
        },
        getAdapterClass: () =>
          import('./MultiGenomePAFAdapter.ts').then(r => r.default),
      }),
  )
}
// #endregion
