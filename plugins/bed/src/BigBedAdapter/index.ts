import PluginManager from '@jbrowse/core/PluginManager'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema'

export default (pluginManager: PluginManager) => {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        configSchema,
        displayName: 'BigBed adapter',
        getAdapterClass: () => import('./BigBedAdapter').then(r => r.default),
        name: 'BigBedAdapter',
      }),
  )
}
