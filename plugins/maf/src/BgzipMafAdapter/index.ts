import { AdapterType } from '@jbrowse/core/pluggableElementTypes'

import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function BgzipMafAdapterF(pluginManager: PluginManager) {
  return pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'BgzipMafAdapter',
        configSchema,
        getAdapterClass: () =>
          import('./BgzipMafAdapter.ts').then(f => f.default),
      }),
  )
}
