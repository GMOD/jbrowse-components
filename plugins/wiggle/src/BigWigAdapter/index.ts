import PluginManager from '@jbrowse/core/PluginManager'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import configSchema from './configSchema'

export default (pluginManager: PluginManager) => {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        adapterCapabilities: [
          'hasResolution',
          'hasLocalStats',
          'hasGlobalStats',
        ],
        configSchema,
        displayName: 'BigWig adapter',
        getAdapterClass: () => import('./BigWigAdapter').then(r => r.default),
        name: 'BigWigAdapter',
      }),
  )
}
