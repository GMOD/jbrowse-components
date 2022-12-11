import configSchema from './configSchema'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import PluginManager from '@jbrowse/core/PluginManager'

export default (pluginManager: PluginManager) => {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'MultiWiggleAdapter',
        displayName: 'Multi-wiggle adapter',
        configSchema,
        adapterCapabilities: [
          'hasResolution',
          'hasLocalStats',
          'hasGlobalStats',
        ],
        adapterMetadata: {
          hiddenFromGUI: true,
        },
        getAdapterClass: () =>
          import('./MultiWiggleAdapter').then(r => r.default),
      }),
  )
}
