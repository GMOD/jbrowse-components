import PluginManager from '@jbrowse/core/PluginManager'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

import configSchema from './configSchema'

export default function BigBedAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'BigBedAdapter',
        displayName: 'BigBed adapter',
        configSchema,
        getAdapterClass: () => import('./BigBedAdapter').then(r => r.default),
      }),
  )
}
