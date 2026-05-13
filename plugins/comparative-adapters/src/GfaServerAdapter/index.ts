import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function GfaServerAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'GfaServerAdapter',
        displayName: 'GFA server adapter (express + odgi)',
        configSchema,
        adapterMetadata: {
          category: 'Synteny adapters',
          hiddenFromGUI: true,
        },
        getAdapterClass: () =>
          import('./GfaServerAdapter.ts').then(r => r.default),
      }),
  )
}
