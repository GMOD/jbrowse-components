import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function BedTabixAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'BedTabixAdapter',
        displayName: 'BED tabix adapter',
        configSchema,
        getAdapterClass: () => import('./BedTabixAdapter').then(r => r.default),
      }),
  )
}
