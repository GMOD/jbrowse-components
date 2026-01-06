import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function SyRIAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'SyRIAdapter',
        displayName: 'SyRI adapter',
        configSchema,
        adapterMetadata: {
          category: 'Synteny adapters',
          description: 'Adapter for SyRI (Synteny and Rearrangement Identifier) output files',
        },
        getAdapterClass: () => import('./SyRIAdapter.ts').then(r => r.default),
      }),
  )
}
