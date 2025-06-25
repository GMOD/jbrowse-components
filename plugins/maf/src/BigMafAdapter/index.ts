import PluginManager from '@jbrowse/core/PluginManager'
import { AdapterType } from '@jbrowse/core/pluggableElementTypes'

import BigMafAdapter from './BigMafAdapter'
import configSchema from './configSchema'

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
