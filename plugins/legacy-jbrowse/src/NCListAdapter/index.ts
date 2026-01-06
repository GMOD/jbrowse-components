import { AdapterType } from '@jbrowse/core/pluggableElementTypes'

import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function NCListAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'NCListAdapter',
        displayName: 'NCList adapter',
        configSchema,
        adapterMetadata: {
          category: 'Uncommon',
        },
        getAdapterClass: () =>
          import('./NCListAdapter.ts').then(r => r.default),
      }),
  )
}
