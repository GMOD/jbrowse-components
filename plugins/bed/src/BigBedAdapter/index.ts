import PluginManager from '@jbrowse/core/PluginManager'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema'

export default (pluginManager: PluginManager) => {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'BigBedAdapter',
        configSchema,
        getAdapterClass: () => import('./BigBedAdapter').then(r => r.default),
      }),
  )
}
