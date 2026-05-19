import { AdapterType } from '@jbrowse/core/pluggableElementTypes'

import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function MafTabixAdapterF(pluginManager: PluginManager) {
  return pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'MafTabixAdapter',
        configSchema,
        getAdapterClass: () =>
          import('./MafTabixAdapter.ts').then(f => f.default),
      }),
  )
}
