import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema, { normalizeSnapshot } from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function BigBedAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'BigBedAdapter',
        displayName: 'BigBed adapter',
        normalizeSnapshot,
        configSchema,
        getAdapterClass: () =>
          import('./BigBedAdapter.ts').then(r => r.default),
      }),
  )
}
