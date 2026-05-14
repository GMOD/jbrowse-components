import { AdapterType } from '@jbrowse/core/pluggableElementTypes'

import BigMafAdapter from './BigMafAdapter'
import configSchema from './configSchema'

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
