import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function BigBedAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'BigBedAdapter',
        displayName: 'BigBed adapter',
        configSchema,
        getAdapterClass: () =>
          import('./BigBedAdapter.ts').then(r => r.default),
      }),
  )
}
