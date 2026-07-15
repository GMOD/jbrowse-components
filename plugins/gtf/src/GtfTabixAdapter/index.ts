import { AdapterType } from '@jbrowse/core/pluggableElementTypes'

import configSchema, { normalizeSnapshot } from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function GtfTabixAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'GtfTabixAdapter',
        displayName: 'GTF tabix adapter',
        normalizeSnapshot,
        configSchema,
        getAdapterClass: () =>
          import('./GtfTabixAdapter.ts').then(r => r.default),
      }),
  )
}
