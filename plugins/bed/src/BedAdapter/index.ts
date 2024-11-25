import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema'
import type PluginManager from '@jbrowse/core/PluginManager'

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
