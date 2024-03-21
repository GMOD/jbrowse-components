import PluginManager from '@jbrowse/core/PluginManager'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema'

export default (pluginManager: PluginManager) => {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        configSchema,
        displayName: 'BED adapter',
        getAdapterClass: () => import('./BedAdapter').then(r => r.default),
        name: 'BedAdapter',
      }),
  )
}
