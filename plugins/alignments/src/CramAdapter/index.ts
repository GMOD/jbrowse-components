import PluginManager from '@jbrowse/core/PluginManager'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

// locals
import configSchema from './configSchema'

export default (pluginManager: PluginManager) => {
  pluginManager.addAdapterType(() => {
    return new AdapterType({
      name: 'CramAdapter',
      configSchema,
      getAdapterClass: () => import('./CramAdapter').then(r => r.default),
    })
  })
}
