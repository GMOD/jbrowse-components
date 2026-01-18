import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema.ts'
import configSchemaTabix from './configSchemaTabix.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function PlinkLDAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'PlinkLDAdapter',
        displayName: 'PLINK LD adapter',
        configSchema,
        adapterMetadata: {
          category: 'Linkage disequilibrium',
          description:
            'Adapter for pre-computed LD data from PLINK --r2 output (loads into memory)',
        },
        getAdapterClass: () =>
          import('./PlinkLDAdapter.ts').then(r => r.default),
      }),
  )
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'PlinkLDTabixAdapter',
        displayName: 'PLINK LD tabix adapter',
        configSchema: configSchemaTabix,
        adapterMetadata: {
          category: 'Linkage disequilibrium',
          description:
            'Adapter for pre-computed LD data from PLINK --r2 output (tabix-indexed)',
        },
        getAdapterClass: () =>
          import('./PlinkLDTabixAdapter.ts').then(r => r.default),
      }),
  )
}
