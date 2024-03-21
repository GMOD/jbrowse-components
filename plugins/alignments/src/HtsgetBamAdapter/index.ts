import configSchema from './configSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

export default (pluginManager: PluginManager) => {
  pluginManager.addAdapterType(() => {
    return new AdapterType({
      adapterMetadata: {
        hiddenFromGUI: true,
      },
      configSchema,
      displayName: 'Htsget BAM adapter',
      getAdapterClass: () => import('./HtsgetBamAdapter').then(r => r.default),
      name: 'HtsgetBamAdapter',
    })
  })
}
