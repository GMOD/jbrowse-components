import PluginManager from '@jbrowse/core/PluginManager'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema'

export default (pluginManager: PluginManager) => {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        configSchema,
        displayName: 'BEDPE adapter',
        getAdapterClass: () => import('./BedpeAdapter').then(r => r.default),
        name: 'BedpeAdapter',
      }),
  )
}
