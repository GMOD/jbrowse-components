import PluginManager from '@jbrowse/core/PluginManager'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema'

export default function BedGraphAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'BedGraphAdapter',
        displayName: 'BedGraph adapter',
        configSchema,
        getAdapterClass: () => import('./BedGraphAdapter').then(r => r.default),
      }),
  )
}
