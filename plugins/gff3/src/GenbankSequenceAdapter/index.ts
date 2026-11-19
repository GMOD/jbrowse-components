import { AdapterType } from '@jbrowse/core/pluggableElementTypes'

import configSchema, { normalizeSnapshot } from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function GenbankSequenceAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'GenbankSequenceAdapter',
        displayName: 'GenBank sequence adapter',
        normalizeSnapshot,
        configSchema,
        getAdapterClass: () =>
          import('./GenbankSequenceAdapter.ts').then(r => r.default),
      }),
  )
}
