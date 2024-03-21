import PluginManager from '@jbrowse/core/PluginManager'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import configSchema from './configSchema'

export default function (pluginManager: PluginManager) {
  pluginManager.addAdapterType(() => {
    return new AdapterType({
      adapterMetadata: {
        hiddenFromGUI: true,
      },
      configSchema,
      displayName: 'SNPCoverage adapter',
      getAdapterClass: () =>
        import('./SNPCoverageAdapter').then(r => r.default),
      name: 'SNPCoverageAdapter',
    })
  })
}
