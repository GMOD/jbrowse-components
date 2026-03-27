import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function GfaAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'GfaAdapter',
        displayName: 'GFA adapter',
        configSchema,
        adapterMetadata: {
          category: 'Synteny adapters',
          hiddenFromGUI: true,
        },
        getAdapterClass: () => import('./GfaAdapter.ts').then(r => r.default),
      }),
  )
}
