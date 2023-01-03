import PluginManager from '@jbrowse/core/PluginManager'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import configSchema from './configSchema'

export default (pluginManager: PluginManager) => {
  pluginManager.addAdapterType(() => {
    return new AdapterType({
      name: 'BamAdapter',
      displayName: 'BAM adapter',
      configSchema,
      getAdapterClass: () => import('./BamAdapter').then(r => r.default),
    })
  })
}
