import PluginManager from '@jbrowse/core/PluginManager'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema'

export default function BedAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'BedAdapter',
        displayName: 'BED adapter',
        configSchema,
        getAdapterClass: () => import('./BedAdapter').then(r => r.default),
      }),
  )
}
