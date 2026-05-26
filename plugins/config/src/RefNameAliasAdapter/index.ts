import { AdapterType } from '@jbrowse/core/pluggableElementTypes'

import configSchema, { normalizeSnapshot } from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function RefNameAliasAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'RefNameAliasAdapter',
        normalizeSnapshot,
        configSchema,
        getAdapterClass: () =>
          import('./RefNameAliasAdapter.ts').then(r => r.default),
        adapterMetadata: {
          hiddenFromGUI: true,
        },
      }),
  )
}
