import { AdapterType } from '@jbrowse/core/pluggableElementTypes'

import MafTabixAdapter from './MafTabixAdapter'
import configSchema from './configSchema'

import type PluginManager from '@jbrowse/core/PluginManager'

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
