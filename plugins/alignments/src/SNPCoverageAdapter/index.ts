import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import configSchema from './configSchema'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function SNPCoverageAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(() => {
    return new AdapterType({
      name: 'SNPCoverageAdapter',
      displayName: 'SNPCoverage adapter',
      adapterMetadata: {
        hiddenFromGUI: true,
      },
      getAdapterClass: () =>
        import('./SNPCoverageAdapter').then(r => r.default),
      configSchema,
    })
  })
}
