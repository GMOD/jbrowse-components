import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema, { normalizeSnapshot } from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function BedGraphTabixAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'BedGraphTabixAdapter',
        displayName: 'BedGraphTabix adapter',
        normalizeSnapshot,
        configSchema,
        getAdapterClass: () =>
          import('./BedGraphTabixAdapter.ts').then(r => r.default),
      }),
  )
}
