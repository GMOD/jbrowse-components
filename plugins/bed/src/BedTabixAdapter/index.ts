import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function BedTabixAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'BedTabixAdapter',
        displayName: 'BED tabix adapter',
        configSchema,
        getAdapterClass: () =>
          import('./BedTabixAdapter.ts').then(r => r.default),
      }),
  )
}
