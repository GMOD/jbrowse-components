import { AdapterType } from '@jbrowse/core/pluggableElementTypes'

import configSchema, { normalizeSnapshot } from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function GenbankAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'GenbankAdapter',
        displayName: 'GenBank adapter',
        normalizeSnapshot,
        configSchema,
        getAdapterClass: () =>
          import('./GenbankAdapter.ts').then(r => r.default),
      }),
  )
}
