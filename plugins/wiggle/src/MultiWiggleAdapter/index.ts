import configSchema from './configSchema'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import PluginManager from '@jbrowse/core/PluginManager'

export default (pluginManager: PluginManager) => {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        adapterCapabilities: [
          'hasResolution',
          'hasLocalStats',
          'hasGlobalStats',
        ],
        adapterMetadata: {
          hiddenFromGUI: true,
        },
        configSchema,
        displayName: 'Multi-wiggle adapter',
        getAdapterClass: () =>
          import('./MultiWiggleAdapter').then(r => r.default),
        name: 'MultiWiggleAdapter',
      }),
  )
}
