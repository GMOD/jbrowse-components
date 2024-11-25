import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function BedGraphTabixAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'BedGraphTabixAdapter',
        displayName: 'BedGraphTabix adapter',
        configSchema,
        getAdapterClass: () =>
          import('./BedGraphTabixAdapter').then(r => r.default),
      }),
  )
}
