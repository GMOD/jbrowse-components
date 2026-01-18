import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function PlinkLDAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'PlinkLDAdapter',
        displayName: 'PLINK LD adapter',
        configSchema,
        getAdapterClass: () =>
          import('./PlinkLDAdapter.ts').then(r => r.default),
      }),
  )
}
