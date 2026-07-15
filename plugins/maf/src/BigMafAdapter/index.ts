import { AdapterType } from '@jbrowse/core/pluggableElementTypes'

import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function BigMafAdapterF(pluginManager: PluginManager) {
  return pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'BigMafAdapter',
        configSchema,
        getAdapterClass: () =>
          import('./BigMafAdapter.ts').then(f => f.default),
      }),
  )
}
