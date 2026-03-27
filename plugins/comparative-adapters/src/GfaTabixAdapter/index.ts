import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function GfaTabixAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'GfaTabixAdapter',
        displayName: 'GFA tabix adapter',
        configSchema,
        adapterMetadata: {
          category: 'Synteny adapters',
          hiddenFromGUI: true,
        },
        getAdapterClass: () =>
          import('./GfaTabixAdapter.ts').then(r => r.default),
      }),
  )
}
