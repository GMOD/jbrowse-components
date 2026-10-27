import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema, { normalizeSnapshot } from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function StarFusionAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'StarFusionAdapter',
        displayName: 'STAR-Fusion adapter',
        configSchema,
        getAdapterClass: () =>
          import('./StarFusionAdapter.ts').then(r => r.default),
        locationKey: 'starFusionLocation',
        normalizeSnapshot,
      }),
  )
}
