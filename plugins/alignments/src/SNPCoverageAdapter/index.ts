import PluginManager from '@jbrowse/core/PluginManager'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import configSchema from './configSchema'
import { capabilities } from './SNPCoverageAdapter'

export default function (pluginManager: PluginManager) {
  pluginManager.addAdapterType(() => {
    return new AdapterType({
      name: 'SNPCoverageAdapter',
      adapterMetadata: {
        category: null,
        displayName: null,
        hiddenFromGUI: true,
        description: null,
      },
      getAdapterClass: () =>
        import('./SNPCoverageAdapter').then(r => r.default),
      configSchema,
      adapterCapabilities: capabilities,
    })
  })
}
