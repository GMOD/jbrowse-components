import PluginManager from '@jbrowse/core/PluginManager'
import { AdapterType } from '@jbrowse/core/pluggableElementTypes'

import MafTabixAdapter from './MafTabixAdapter'
import configSchema from './configSchema'

export default function MafTabixAdapterF(pluginManager: PluginManager) {
  return pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'MafTabixAdapter',
        AdapterClass: MafTabixAdapter,
        configSchema,
      }),
  )
}
