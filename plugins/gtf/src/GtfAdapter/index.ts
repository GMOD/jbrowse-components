import { AdapterType } from '@jbrowse/core/pluggableElementTypes'

import configSchema, { normalizeSnapshot } from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function GtfAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'GtfAdapter',
        displayName: 'GTF adapter',
        normalizeSnapshot,
        configSchema,
        getAdapterClass: () => import('./GtfAdapter.ts').then(r => r.default),
      }),
  )
}
