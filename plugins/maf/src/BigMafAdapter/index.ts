import { AdapterType } from '@jbrowse/core/pluggableElementTypes'

import BigMafAdapter from './BigMafAdapter.ts'
import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function BigMafAdapterF(pluginManager: PluginManager) {
  return pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'BigMafAdapter',
        AdapterClass: BigMafAdapter,
        configSchema,
      }),
  )
}
