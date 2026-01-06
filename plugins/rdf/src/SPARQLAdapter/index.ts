import { AdapterType } from '@jbrowse/core/pluggableElementTypes'

import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function SPARQLAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'SPARQLAdapter',
        displayName: 'SPARQL adapter',
        configSchema,
        adapterMetadata: {
          category: 'Uncommon',
        },
        getAdapterClass: () =>
          import('./SPARQLAdapter.ts').then(r => r.default),
      }),
  )
}
