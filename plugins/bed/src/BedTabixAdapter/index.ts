import PluginManager from '@jbrowse/core/PluginManager'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema'

export default (pluginManager: PluginManager) => {
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
