import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function MultiPairwiseSyntenyAdapterF(
  pluginManager: PluginManager,
) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'MultiPairwiseSyntenyAdapter',
        displayName: 'Multiple pairwise synteny adapter',
        configSchema,
        adapterMetadata: {
          category: 'Synteny adapters',
        },
        getAdapterClass: () =>
          import('./MultiPairwiseSyntenyAdapter.ts').then(r => r.default),
      }),
  )
}
