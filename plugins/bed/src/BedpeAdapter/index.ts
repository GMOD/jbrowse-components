import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function BedpeAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'BedpeAdapter',
        displayName: 'BEDPE adapter',
        configSchema,
        getAdapterClass: () => import('./BedpeAdapter.ts').then(r => r.default),
      }),
  )
}
