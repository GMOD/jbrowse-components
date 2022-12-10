import PluginManager from '@jbrowse/core/PluginManager'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import configSchema from './configSchema'

export default (pluginManager: PluginManager) => {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'BigWigAdapter',
        displayName: 'BigWig adapter',
        configSchema,
        adapterCapabilities: [
          'hasResolution',
          'hasLocalStats',
          'hasGlobalStats',
        ],
        getAdapterClass: () => import('./BigWigAdapter').then(r => r.default),
      }),
  )
}
