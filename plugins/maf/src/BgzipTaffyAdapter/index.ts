import { AdapterType } from '@jbrowse/core/pluggableElementTypes'

import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function BgzipTaffyAdapterF(pluginManager: PluginManager) {
  return pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'BgzipTaffyAdapter',
        configSchema,
        getAdapterClass: () =>
          import('./BgzipTaffyAdapter.ts').then(f => f.default),
      }),
  )
}
